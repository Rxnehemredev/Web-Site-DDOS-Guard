'use strict';

/**
 * Aynı anda açık kalan bağlantı sayısını ve kısa sürede gelen
 * ani istek patlamalarını (burst) IP bazında izler.
 * Slowloris tarzı saldırılar (çok sayıda yarı-açık bağlantı) ile
 * volumetrik burst saldırılarını ayrı ayrı tespit eder.
 */
class ConnectionTracker {
  /**
   * @param {object} opts
   * @param {number} opts.maxConcurrentPerIp
   * @param {number} opts.burstThreshold
   * @param {number} opts.burstWindowMs
   */
  constructor({ maxConcurrentPerIp, burstThreshold, burstWindowMs }) {
    this.maxConcurrentPerIp = maxConcurrentPerIp;
    this.burstThreshold = burstThreshold;
    this.burstWindowMs = burstWindowMs;

    /** @type {Map<string, number>} ip -> açık bağlantı sayısı */
    this.concurrent = new Map();
    /** @type {Map<string, number[]>} ip -> son istek zaman damgaları (burst penceresi) */
    this.burstLog = new Map();
  }

  /** Yeni bir bağlantı açıldığında çağrılır. */
  open(ip) {
    const current = this.concurrent.get(ip) || 0;
    this.concurrent.set(ip, current + 1);
    return current + 1;
  }

  /** Bağlantı kapandığında (response finish/close) çağrılır. */
  close(ip) {
    const current = this.concurrent.get(ip) || 0;
    const next = Math.max(0, current - 1);
    if (next === 0) {
      this.concurrent.delete(ip);
    } else {
      this.concurrent.set(ip, next);
    }
    return next;
  }

  isConcurrentLimitExceeded(ip) {
    return (this.concurrent.get(ip) || 0) > this.maxConcurrentPerIp;
  }

  /**
   * Burst tespiti: kısa pencerede eşik üstü istek var mı?
   * @returns {boolean} true ise burst saldırısı şüphesi var
   */
  recordAndCheckBurst(ip, now = Date.now()) {
    let log = this.burstLog.get(ip);
    if (!log) {
      log = [];
      this.burstLog.set(ip, log);
    }

    const windowStart = now - this.burstWindowMs;
    let start = 0;
    while (start < log.length && log[start] <= windowStart) start += 1;
    if (start > 0) log.splice(0, start);

    log.push(now);

    return log.length > this.burstThreshold;
  }

  sweep(now = Date.now()) {
    const windowStart = now - this.burstWindowMs;
    for (const [ip, log] of this.burstLog.entries()) {
      const last = log[log.length - 1];
      if (last === undefined || last <= windowStart) {
        this.burstLog.delete(ip);
      }
    }
    for (const [ip, count] of this.concurrent.entries()) {
      if (count <= 0) this.concurrent.delete(ip);
    }
  }
}

module.exports = ConnectionTracker;
