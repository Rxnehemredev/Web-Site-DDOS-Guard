'use strict';

const RateLimiter = require('../core/rateLimiter');
const ConnectionTracker = require('../core/connectionTracker');
const ReputationManager = require('../core/reputation');
const ChallengeManager = require('./challenge');

/**
 * Gerçek istemci IP'sini güvenli biçimde çözer.
 * trustProxy=false ise (varsayılan), X-Forwarded-For gibi başlıklara
 * güvenilmez — çünkü saldırgan bu başlığı sahteleyip rate-limit'i
 * bypass edebilir. Yalnızca gerçekten güvenilen bir ters proxy'nin
 * arkasındaysanız trustProxy=true yapın.
 */
function resolveClientIp(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      return xff.split(',')[0].trim();
    }
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * DDoS Shield: rate-limit + burst/flood tespiti + itibar sistemi +
 * opsiyonel JS challenge katmanlarını tek bir Express middleware'inde
 * birleştirir. Katmanlar en ucuzdan en pahalıya doğru sıralanır ki
 * saldırı trafiği erken ve düşük maliyetle reddedilsin.
 *
 * @param {object} config config/config.js şemasına uygun obje
 * @param {import('../utils/logger')} logger
 */
function createDdosShield(config, logger) {
  const rateLimiter = new RateLimiter(config.rateLimit.windowMs, config.rateLimit.maxRequests);
  const connectionTracker = new ConnectionTracker(config.connection);
  const reputation = new ReputationManager(config.reputation);
  const challenge = config.challenge.enabled ? new ChallengeManager(config.challenge) : null;

  // Bellek sızıntısını önlemek için periyodik temizlik
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    rateLimiter.sweep(now);
    connectionTracker.sweep(now);
    reputation.sweep(now);
  }, Math.max(config.rateLimit.windowMs, config.connection.burstWindowMs));
  sweepInterval.unref?.();

  const trustProxy = config.trustProxy === true;

  function reject(res, status, reasonCode, message) {
    res.status(status).json({
      error: message,
      code: reasonCode,
    });
  }

  /** Ana middleware fonksiyonu */
  function shield(req, res, next) {
    const ip = resolveClientIp(req, trustProxy);
    req.clientIp = ip;
    const now = Date.now();

    // --- 1. Whitelist: her şeyi atla ---
    if (reputation.isWhitelisted(ip)) {
      return next();
    }

    // --- 2. Statik blacklist ---
    if (reputation.isBlacklisted(ip)) {
      logger.warn('ddos-shield', `Engellendi (blacklist): ${ip}`);
      return reject(res, 403, 'BLACKLISTED', 'Erişiminiz kalıcı olarak engellenmiştir.');
    }

    // --- 3. Aktif ban kontrolü ---
    if (reputation.isBanned(ip, now)) {
      const remainingSec = Math.ceil(reputation.banRemainingMs(ip, now) / 1000);
      res.setHeader('Retry-After', String(remainingSec));
      return reject(res, 429, 'BANNED', `Çok fazla istek. ${remainingSec} saniye sonra tekrar deneyin.`);
    }

    // --- 4. Eşzamanlı bağlantı limiti (Slowloris tarzı saldırılara karşı) ---
    const openCount = connectionTracker.open(ip);
    res.once('finish', () => connectionTracker.close(ip));
    res.once('close', () => connectionTracker.close(ip));

    if (openCount > config.connection.maxConcurrentPerIp) {
      const { longBanTriggered } = reputation.recordViolation(ip, now);
      logger.warn('ddos-shield', `Eşzamanlı bağlantı limiti aşıldı: ${ip} (${openCount})`, {
        longBanTriggered,
      });
      reputation.banTemporarily(ip, config.rateLimit.banDurationMs, now);
      return reject(res, 429, 'TOO_MANY_CONNECTIONS', 'Çok fazla eşzamanlı bağlantı.');
    }

    // --- 5. Burst tespiti (kısa sürede anormal istek patlaması) ---
    const isBurst = connectionTracker.recordAndCheckBurst(ip, now);
    if (isBurst) {
      const { longBanTriggered } = reputation.recordViolation(ip, now);
      reputation.banTemporarily(ip, config.rateLimit.banDurationMs, now);
      logger.warn('ddos-shield', `Burst saldırısı tespit edildi: ${ip}`, { longBanTriggered });
      return reject(res, 429, 'BURST_DETECTED', 'Anormal trafik paterni tespit edildi.');
    }

    // --- 6. Sliding-window rate limit ---
    const { allowed, remaining, count } = rateLimiter.hit(ip, now);
    res.setHeader('X-RateLimit-Limit', String(config.rateLimit.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (!allowed) {
      const { longBanTriggered } = reputation.recordViolation(ip, now);
      reputation.banTemporarily(ip, config.rateLimit.banDurationMs, now);
      logger.warn('ddos-shield', `Rate limit aşıldı: ${ip} (${count} istek)`, { longBanTriggered });
      res.setHeader('Retry-After', String(Math.ceil(config.rateLimit.banDurationMs / 1000)));
      return reject(res, 429, 'RATE_LIMITED', 'İstek limiti aşıldı.');
    }

    // --- 7. Layer 7 JS challenge (şüphe eşiği aşıldıysa) ---
    if (challenge) {
      // Şüphe skoru: limite ne kadar yaklaşıldığı basit bir heuristik olarak kullanılır.
      const suspicionScore = config.rateLimit.maxRequests - remaining;

      if (req.path === '/__ddos_guard_verify' && req.method === 'POST') {
        const token = challenge.issueToken(now);
        res.setHeader(
          'Set-Cookie',
          `${config.challenge.cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(
            config.challenge.cookieTtlMs / 1000
          )}`
        );
        res.status(200).json({ verified: true });
        return;
      }

      if (suspicionScore >= config.challenge.suspicionThreshold) {
        const cookieToken = challenge.extractToken(req.headers.cookie);
        const isVerified = challenge.verifyToken(cookieToken, now);

        if (!isVerified) {
          logger.info('ddos-shield', `Challenge gösterildi: ${ip} (suspicion=${suspicionScore})`);
          res.status(403).set('Content-Type', 'text/html; charset=utf-8');
          res.send(challenge.renderChallengePage(req.originalUrl));
          return;
        }
      }
    }

    // --- Tüm katmanları geçti: isteği ilet ---
    next();
  }

  shield.internals = { rateLimiter, connectionTracker, reputation, challenge };
  shield.stopSweeping = () => clearInterval(sweepInterval);

  return shield;
}

module.exports = createDdosShield;
