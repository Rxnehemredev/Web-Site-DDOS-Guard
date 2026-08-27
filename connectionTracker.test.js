'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ConnectionTracker = require('../src/core/connectionTracker');

function makeTracker(overrides = {}) {
  return new ConnectionTracker({
    maxConcurrentPerIp: 3,
    burstThreshold: 5,
    burstWindowMs: 1_000,
    ...overrides,
  });
}

test('bağlantı açma/kapama sayaçları doğru güncellenir', () => {
  const ct = makeTracker();
  assert.equal(ct.open('ip1'), 1);
  assert.equal(ct.open('ip1'), 2);
  assert.equal(ct.close('ip1'), 1);
  assert.equal(ct.close('ip1'), 0);
});

test('eşzamanlı bağlantı limiti doğru tespit edilir', () => {
  const ct = makeTracker({ maxConcurrentPerIp: 2 });
  ct.open('ip1');
  ct.open('ip1');
  assert.equal(ct.isConcurrentLimitExceeded('ip1'), false);
  ct.open('ip1');
  assert.equal(ct.isConcurrentLimitExceeded('ip1'), true);
});

test('burst eşiği aşılınca true döner', () => {
  const ct = makeTracker({ burstThreshold: 3, burstWindowMs: 1_000 });
  const now = 0;
  assert.equal(ct.recordAndCheckBurst('ip1', now), false);
  assert.equal(ct.recordAndCheckBurst('ip1', now), false);
  assert.equal(ct.recordAndCheckBurst('ip1', now), false);
  assert.equal(ct.recordAndCheckBurst('ip1', now), true);
});

test('burst penceresi kaydıkça eski istekler düşer', () => {
  const ct = makeTracker({ burstThreshold: 1, burstWindowMs: 1_000 });
  ct.recordAndCheckBurst('ip1', 0);
  assert.equal(ct.recordAndCheckBurst('ip1', 2_000), false);
});

test('close negatif sayaca düşmez', () => {
  const ct = makeTracker();
  assert.equal(ct.close('never-opened'), 0);
});
