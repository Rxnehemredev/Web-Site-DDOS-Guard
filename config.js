'use strict';

require('dotenv').config();

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toArray(value, fallback) {
  if (!value) return fallback;
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

const config = {
  // Proxy sunucusunun dinleyeceği port
  port: toInt(process.env.PORT, 8080),

  // Korunan gerçek backend (upstream) adresi
  targetUrl: process.env.TARGET_URL || 'http://localhost:3000',

  // SADECE gerçekten güvenilen bir ters proxy/load balancer arkasındaysanız true yapın.
  // Aksi halde saldırganlar X-Forwarded-For'u sahteleyerek rate-limit'i bypass edebilir.
  trustProxy: process.env.TRUST_PROXY === 'true',

  // Rate limiting ayarları (kayan pencere - sliding window)
  rateLimit: {
    windowMs: toInt(process.env.RATE_WINDOW_MS, 10_000), // 10 saniyelik pencere
    maxRequests: toInt(process.env.RATE_MAX_REQUESTS, 100), // pencere başına izin verilen istek
    banDurationMs: toInt(process.env.RATE_BAN_MS, 60_000), // limiti aşınca 60 sn ban
  },

  // Eşzamanlı bağlantı / flood tespiti
  connection: {
    maxConcurrentPerIp: toInt(process.env.MAX_CONCURRENT_PER_IP, 50),
    burstThreshold: toInt(process.env.BURST_THRESHOLD, 30), // 1 sn içinde izin verilen istek
    burstWindowMs: toInt(process.env.BURST_WINDOW_MS, 1_000),
  },

  // IP itibar sistemi
  reputation: {
    // Bir IP art arda kaç kez ihlal yaparsa kalıcı listeye (uzun süreli ban) alınır
    violationsBeforeLongBan: toInt(process.env.VIOLATIONS_BEFORE_LONG_BAN, 5),
    longBanDurationMs: toInt(process.env.LONG_BAN_MS, 30 * 60_000), // 30 dakika
    whitelist: toArray(process.env.WHITELIST_IPS, ['127.0.0.1', '::1']),
    blacklist: toArray(process.env.BLACKLIST_IPS, []),
  },

  // Layer 7 JS challenge ayarları
  challenge: {
    enabled: process.env.CHALLENGE_ENABLED !== 'false',
    // Şüphe skoru bu eşiği geçerse challenge sayfası gösterilir
    suspicionThreshold: toInt(process.env.SUSPICION_THRESHOLD, 3),
    cookieName: 'ddg_verified',
    cookieTtlMs: toInt(process.env.CHALLENGE_COOKIE_TTL_MS, 15 * 60_000), // 15 dk
    secret: process.env.CHALLENGE_SECRET || 'change-this-secret-in-production',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;
