'use strict';

const crypto = require('crypto');

/**
 * Şüpheli istemcilere basit bir JavaScript doğrulama testi gösterir.
 * Gerçek tarayıcılar JS çalıştırıp bir sonraki isteğe imzalı çerezi ekler;
 * script çalıştırmayan bot/flood araçları bu adımda elenir.
 *
 * Not: Bu, gelişmiş bot yönetim sistemlerinin (örn. Cloudflare) basitleştirilmiş
 * bir muadilidir; kriptografik olarak imzalanmış zaman damgalı bir çerez kullanır,
 * böylece çerez tahmin edilemez ve süresi dolunca geçersiz olur.
 */
class ChallengeManager {
  /**
   * @param {object} opts
   * @param {string} opts.secret HMAC imzalama anahtarı
   * @param {string} opts.cookieName
   * @param {number} opts.cookieTtlMs
   */
  constructor({ secret, cookieName, cookieTtlMs }) {
    if (!secret || secret.length < 8) {
      throw new Error('challenge.secret en az 8 karakter olmalı (production için güçlü bir değer verin)');
    }
    this.secret = secret;
    this.cookieName = cookieName;
    this.cookieTtlMs = cookieTtlMs;
  }

  _sign(payload) {
    return crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  /** İmzalı bir doğrulama tokenı üretir: "<expiresAt>.<hmac>" */
  issueToken(now = Date.now()) {
    const expiresAt = now + this.cookieTtlMs;
    const payload = String(expiresAt);
    const sig = this._sign(payload);
    return `${expiresAt}.${sig}`;
  }

  /** Tokenın geçerli ve süresinin dolmadığını doğrular. */
  verifyToken(token, now = Date.now()) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [expiresAtStr, sig] = parts;
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt)) return false;
    if (expiresAt <= now) return false;

    const expectedSig = this._sign(expiresAtStr);

    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  }

  /** İstekteki cookie header'ından token'ı çıkarır. */
  extractToken(cookieHeader) {
    if (!cookieHeader) return null;
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${this.cookieName}=`));
    if (!match) return null;
    return match.substring(this.cookieName.length + 1);
  }

  /** Tarayıcıda çalışacak, basit bir hesaplama-tabanlı doğrulama sayfası üretir. */
  renderChallengePage(redirectPath) {
    const safePath = String(redirectPath || '/').replace(/"/g, '&quot;');
    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<title>Güvenlik Doğrulaması</title>
<meta name="robots" content="noindex" />
<style>
  body { font-family: -apple-system, Arial, sans-serif; background:#0f172a; color:#e2e8f0;
         display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
  .card { background:#1e293b; padding:32px 40px; border-radius:12px; text-align:center; max-width:420px; }
  .spinner { width:36px; height:36px; border:4px solid #334155; border-top-color:#38bdf8;
             border-radius:50%; margin:16px auto; animation:spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <div class="card">
    <h2>Trafiğiniz doğrulanıyor</h2>
    <div class="spinner"></div>
    <p>Lütfen bekleyin, güvenlik kontrolü tamamlanıyor...</p>
  </div>
  <script>
    (function () {
      fetch('/__ddos_guard_verify', { method: 'POST', credentials: 'same-origin' })
        .then(function (res) {
          if (res.ok) {
            window.location.href = "${safePath}";
          } else {
            document.querySelector('.card p').textContent = 'Doğrulama başarısız, sayfa yenileniyor...';
            setTimeout(function () { window.location.reload(); }, 1500);
          }
        })
        .catch(function () {
          setTimeout(function () { window.location.reload(); }, 1500);
        });
    })();
  </script>
</body>
</html>`;
  }
}

module.exports = ChallengeManager;
