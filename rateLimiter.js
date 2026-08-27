'use strict';

/**
 * Sliding-window (kayan pencere) rate limiter.
 * Sabit pencereli (fixed-window) yöntemin pencere sınırında yaşadığı
 * "iki katı istek" açığını önlemek için, her IP'nin son N ms içindeki
 * istek zaman damgalarını tutar ve pencere dışına çıkanları eler.
 */
class RateLimiter {
  /**
   * @param {number} windowMs Pencere süresi (ms)
   * @param {number} maxRequests Pencere başına izin verilen maksimum istek
   */
  constructor(windowMs, maxRequests) {
    if (windowMs <= 0) throw new Error('windowMs pozitif olmalı');
    if (maxRequests <= 0) throw new Error('maxRequests pozitif olmalı');

    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    /** @type {Map<string, number[]>} ip -> timestamp listesi */
    this.hits = new Map();
  }

  /**
   * Bir isteği kaydeder ve limitin aşılıp aşılmadığını döner.
   * @param {string} key genelde IP adresi
   * @param {number} [now] test edilebilirlik için zaman enjekte edilebilir
   * @returns {{ allowed: boolean, remaining: number, count: number }}
   */
  hit(key, now = Date.now()) {
    let timestamps = this.hits.get(key);

    if (!timestamps) {
      timestamps = [];
      this.hits.set(key, timestamps);
    }

    const windowStart = now - this.windowMs;

    // Pencere dışına çıkan eski kayıtları temizle (baştan, çünkü sıralı ekleniyor)
    let start = 0;
    while (start < timestamps.length && timestamps[start] <= windowStart) {
      start += 1;
    }
    if (start > 0) {
      timestamps.splice(0, start);
    }

    timestamps.push(now);

    const count = timestamps.length;
    const allowed = count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - count);

    return { allowed, remaining, count };
  }

  /**
   * Bellek sızıntısını önlemek için boş/eski kayıtları periyodik temizler.
   * setInterval ile çağırılması önerilir.
   */
  sweep(now = Date.now()) {
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.hits.entries()) {
      const lastIndex = timestamps.length - 1;
      if (lastIndex < 0 || timestamps[lastIndex] <= windowStart) {
        this.hits.delete(key);
      }
    }
  }

  reset(key) {
    this.hits.delete(key);
  }

  size() {
    return this.hits.size;
  }
}

module.exports = RateLimiter;
