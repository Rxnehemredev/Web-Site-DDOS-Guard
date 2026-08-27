'use strict';

const express = require('express');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');

const config = require('../config/config');
const Logger = require('./utils/logger');
const createDdosShield = require('./middleware/ddosShield');

const logger = new Logger(config.logging.level);
const app = express();

// Gerçek istemci IP'sini doğru çözebilmek için, SADECE güvenilen bir
// ters proxy'nin (nginx, cloud load balancer vb.) arkasındaysanız açın.
app.set('trust proxy', config.trustProxy === true);

app.use(
  helmet({
    contentSecurityPolicy: false, // upstream kendi CSP'sini yönetsin
  })
);

// --- DDoS koruma katmanı: proxy'den ÖNCE çalışmalı ---
const ddosShield = createDdosShield(config, logger);
app.use(ddosShield);

// --- İzleme/istatistik endpoint'i (isteğe bağlı, kendi auth'unuzu ekleyin) ---
app.get('/__ddos_guard_status', (req, res) => {
  const { rateLimiter, connectionTracker, reputation } = ddosShield.internals;
  res.json({
    status: 'active',
    trackedIps: rateLimiter.size(),
    reputation: reputation.stats(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// --- Korunan backend'e yönlendirme ---
app.use(
  '/',
  createProxyMiddleware({
    target: config.targetUrl,
    changeOrigin: true,
    ws: true, // websocket desteği
    logger: {
      info: (msg) => logger.debug('proxy', msg),
      warn: (msg) => logger.warn('proxy', msg),
      error: (msg) => logger.error('proxy', msg),
    },
    on: {
      error: (err, req, res) => {
        logger.error('proxy', `Upstream hatası: ${err.message}`);
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Backend sunucusuna ulaşılamıyor.' }));
        }
      },
    },
  })
);

const server = app.listen(config.port, () => {
  logger.info('server', `DDoS Guard aktif → http://localhost:${config.port}`);
  logger.info('server', `Hedef backend → ${config.targetUrl}`);
});

function shutdown(signal) {
  logger.info('server', `${signal} alındı, kapatılıyor...`);
  ddosShield.stopSweeping();
  server.close(() => {
    logger.info('server', 'Sunucu kapatıldı.');
    process.exit(0);
  });
  // Bağlantılar kapanmazsa zorla çık
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
