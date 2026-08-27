'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ReputationManager = require('../src/core/reputation');

function makeManager(overrides = {}) {
  return new ReputationManager({
    whitelist: ['1.1.1.1'],
    blacklist: ['6.6.6.6'],
    violationsBeforeLongBan: 3,
    longBanDurationMs: 10_000,
    ...overrides,
  });
}

test('whitelist ve blacklist doğru çalışır', () => {
  const rep = makeManager();
  assert.equal(rep.isWhitelisted('1.1.1.1'), true);
  assert.equal(rep.isWhitelisted('2.2.2.2'), false);
  assert.equal(rep.isBlacklisted('6.6.6.6'), true);
});

test('geçici ban süresi doğru hesaplanır ve sona erer', () => {
  const rep = makeManager();
  rep.banTemporarily('ip1', 5_000, 0);
  assert.equal(rep.isBanned('ip1', 1_000), true);
  assert.equal(rep.banRemainingMs('ip1', 1_000), 4_000);
  assert.equal(rep.isBanned('ip1', 5_001), false);
});

test('eşik sayıda ihlalden sonra uzun ban tetiklenir', () => {
  const rep = makeManager({ violationsBeforeLongBan: 3, longBanDurationMs: 10_000 });
  assert.equal(rep.recordViolation('ip1', 0).longBanTriggered, false);
  assert.equal(rep.recordViolation('ip1', 0).longBanTriggered, false);
  const third = rep.recordViolation('ip1', 0);
  assert.equal(third.longBanTriggered, true);
  assert.equal(rep.isBanned('ip1', 0), true);
});

test('unban ihlal geçmişini de temizler', () => {
  const rep = makeManager();
  rep.recordViolation('ip1', 0);
  rep.banTemporarily('ip1', 5_000, 0);
  rep.unban('ip1');
  assert.equal(rep.isBanned('ip1', 0), false);
});

test('mevcut ban daha uzunsa yeni kısa ban ile kısaltılmaz', () => {
  const rep = makeManager();
  rep.banTemporarily('ip1', 20_000, 0);
  rep.banTemporarily('ip1', 1_000, 0);
  assert.equal(rep.banRemainingMs('ip1', 0), 20_000);
});
