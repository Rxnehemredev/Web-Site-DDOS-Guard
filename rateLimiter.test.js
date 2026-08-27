'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const RateLimiter = require('../src/core/rateLimiter');

test('limit içindeki istekleri kabul eder', () => {
  const rl = new RateLimiter(10_000, 3);
  const now = 1_000;
  assert.equal(rl.hit('ip1', now).allowed, true);
  assert.equal(rl.hit('ip1', now).allowed, true);
  assert.equal(rl.hit('ip1', now).allowed, true);
});

test('limiti aşan isteği reddeder', () => {
  const rl = new RateLimiter(10_000, 2);
  const now = 1_000;
  rl.hit('ip1', now);
  rl.hit('ip1', now);
  const third = rl.hit('ip1', now);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
});

test('pencere kaydıktan sonra sayaç sıfırlanır', () => {
  const rl = new RateLimiter(5_000, 1);
  assert.equal(rl.hit('ip1', 0).allowed, true);
  // Aynı pencere içinde ikinci istek: limit(1) aşılır.
  assert.equal(rl.hit('ip1', 100).allowed, false);
  // İlk iki isteğin ikisi de 5000ms'lik pencerenin tamamen dışına
  // çıktığında (100 + 5000 = 5100'den sonra) sayaç sıfırlanmalı.
  assert.equal(rl.hit('ip1', 5_101).allowed, true);
});

test('farklı IP adresleri birbirini etkilemez', () => {
  const rl = new RateLimiter(10_000, 1);
  assert.equal(rl.hit('ip1', 0).allowed, true);
  assert.equal(rl.hit('ip2', 0).allowed, true);
});

test('sweep süresi dolmuş kayıtları temizler', () => {
  const rl = new RateLimiter(1_000, 5);
  rl.hit('ip1', 0);
  assert.equal(rl.size(), 1);
  rl.sweep(5_000);
  assert.equal(rl.size(), 0);
});

test('geçersiz constructor parametreleri hata fırlatır', () => {
  assert.throws(() => new RateLimiter(0, 5));
  assert.throws(() => new RateLimiter(1000, 0));
});
