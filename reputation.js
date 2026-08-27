'use strict';

/**
 * IP itibar sistemi.
 * - Statik whitelist/blacklist
 * - İhlal sayacı: tekrarlayan kötü davranış kalıcı(uzun) ban tetikler
 * - Geçici ban: rate-limit ihlalinde kısa süreli otomatik ban
 */
class ReputationManager {
  /**
   * @param {object} opts
   * @param {string[]} opts.whitelist
   * @param {string[]} opts.blacklist
   * @param {number} opts.violationsBeforeLongBan
   * @param {number} opts.longBanDurationMs
   */
  constructor({ whitelist = [], blacklist = [], violationsBeforeLongBan = 5, longBanDurationMs = 1_800_000 }) {
    this.whitelist = new Set(whitelist);
    this.blacklist = new Set(blacklist);
    this.violationsBeforeLongBan = violationsBeforeLongBan;
    this.longBanDurationMs = longBanDurationMs;

    /** @type {Map<string, number>} ip -> ban bitiş zamanı (epoch ms) */
    this.bannedUntil = new Map();
    /** @type {Map<string, number>} ip -> toplam ihlal sayısı */
    this.violations = new Map();
  }

  isWhitelisted(ip) {
    return this.whitelist.has(ip);
  }

  isBlacklisted(ip) {
    return this.blacklist.has(ip);
  }

  isBanned(ip, now = Date.now()) {
    const until = this.bannedUntil.get(ip);
    if (!until) return false;
    if (until <= now) {
      this.bannedUntil.delete(ip);
      return false;
    }
    return true;
  }

  banRemainingMs(ip, now = Date.now()) {
    const until = this.bannedUntil.get(ip);
    if (!until) return 0;
    return Math.max(0, until - now);
  }

  /**
   * Geçici ban uygular (örn. rate-limit aşımı).
   */
  banTemporarily(ip, durationMs, now = Date.now()) {
    const current = this.bannedUntil.get(ip) || 0;
    const proposed = now + durationMs;
    // Var olan daha uzun bir ban varsa kısaltma
    this.bannedUntil.set(ip, Math.max(current, proposed));
  }

  /**
   * Bir ihlal kaydeder; ihlal sayısı eşiği geçerse otomatik uzun ban uygular.
   * @returns {{ violationCount: number, longBanTriggered: boolean }}
   */
  recordViolation(ip, now = Date.now()) {
    const count = (this.violations.get(ip) || 0) + 1;
    this.violations.set(ip, count);

    let longBanTriggered = false;
    if (count >= this.violationsBeforeLongBan) {
      this.banTemporarily(ip, this.longBanDurationMs, now);
      longBanTriggered = true;
      // Sayaç sıfırlanmaz; tekrar suç işlerse ban süresi her seferinde tazelenir.
    }

    return { violationCount: count, longBanTriggered };
  }

  unban(ip) {
    this.bannedUntil.delete(ip);
    this.violations.delete(ip);
  }

  sweep(now = Date.now()) {
    for (const [ip, until] of this.bannedUntil.entries()) {
      if (until <= now) this.bannedUntil.delete(ip);
    }
  }

  stats() {
    return {
      whitelisted: this.whitelist.size,
      blacklisted: this.blacklist.size,
      currentlyBanned: this.bannedUntil.size,
      trackedViolators: this.violations.size,
    };
  }
}

module.exports = ReputationManager;
