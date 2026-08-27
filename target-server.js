'use strict';

/**
 * DDoS Guard'ın önünde koruyacağı, test amaçlı sahte bir backend.
 * Gerçek kullanımda burası sizin asıl uygulamanız olur.
 */
const http = require('http');

const port = process.env.TARGET_PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Merhaba, korunan backend buradan cevap veriyor.', path: req.url }));
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Test hedef sunucusu çalışıyor: http://localhost:${port}`);
});
