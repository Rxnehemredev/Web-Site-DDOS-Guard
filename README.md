# 🛡️ Emre Tool

**Real-time Layer 4 & Layer 7 DDoS protection and reverse-proxy system, built with Node.js.**

Developed by **Emre Tool**.

> 🇬🇧 English version first — 🇹🇷 Türkçe versiyon aşağıdadır.

---

# 🇬🇧 English

## What is Emre Tool?

Emre Tool sits in front of your backend as a reverse-proxy. Every incoming request passes
through several layers of protection before clean traffic is forwarded to your real server.

```
Client → [ Emre Tool ] → Your Backend
              │
              ├─ 1) Whitelist / Blacklist check
              ├─ 2) Active ban check
              ├─ 3) Concurrent connection limit (Slowloris protection)
              ├─ 4) Burst / traffic-spike detection
              ├─ 5) Sliding-window rate limiting
              └─ 6) Layer 7 JS Challenge (bot filtering)
```

## Features

- **Sliding-window rate limiting** — avoids the classic "double request" gap that fixed-window limiters have at the window boundary.
- **Concurrent connection limit** — protects against Slowloris-style slow-connection attacks.
- **Burst detection** — catches abnormal spikes of requests arriving in a very short time.
- **Progressive IP reputation system** — repeated violations automatically escalate into a long-term ban.
- **Layer 7 JS Challenge** — HMAC-SHA256 signed, unforgeable cookie-based bot verification.
- **Whitelist / Blacklist** support.
- **No memory leaks** — all internal counters are periodically swept/cleaned.
- **Docker & docker-compose** ready — up and running with a single command.
- **100% unit-tested core modules** (`node --test`, 16 passing tests, zero external test dependencies).
- WebSocket support in the proxy layer.

## Requirements

- Node.js **18 or newer** (tested on Node 22)
- npm (comes with Node.js)
- Docker + Docker Compose (optional, only if you want containerized deployment)

## Installation

```bash
git clone https://github.com/your-username/emre-tool.git
cd emre-tool
npm install
cp .env.example .env
```

Then open `.env` and set at least these two values:

- `TARGET_URL` — the real backend you want to protect (e.g. `http://localhost:3000`)
- `CHALLENGE_SECRET` — a strong random secret (generate one with `openssl rand -hex 32`)

## Running the tool

### Option A — Run against your own backend

```bash
npm start
```

By default Emre Tool listens on port `8080` and forwards clean traffic to whatever
`TARGET_URL` points to in your `.env` file.

### Option B — Try it with the included demo backend

Open two terminals:

```bash
# Terminal 1 — starts a fake backend on port 3000
npm run target
```

```bash
# Terminal 2 — starts Emre Tool, protecting the fake backend
npm start
```

Now send requests to `http://localhost:8080` — traffic passes through all protection
layers and is forwarded to the demo backend on success.

### Option C — Run with Docker Compose (recommended for quick testing)

```bash
docker compose up --build
```

This spins up both the `emre-tool` service and the demo `target` backend together.
Visit `http://localhost:8080`.

### Development mode (auto-restart on file changes)

```bash
npm run dev
```

## Running the test suite

```bash
npm test
```

This runs 16 unit tests covering the core modules (`RateLimiter`, `ConnectionTracker`,
`ReputationManager`) using Node's built-in `node:test` runner — no extra dependencies
required to run the tests themselves.

## Configuration reference

All configuration is done through the `.env` file (see `.env.example` for the full list
with defaults):

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port Emre Tool listens on | `8080` |
| `TARGET_URL` | The real backend to protect | `http://localhost:3000` |
| `TRUST_PROXY` | Only set to `true` if you're behind a trusted reverse proxy/load balancer | `false` |
| `RATE_WINDOW_MS` / `RATE_MAX_REQUESTS` | Sliding-window rate limit settings | `10000` / `100` |
| `RATE_BAN_MS` | Temporary ban duration after exceeding the rate limit | `60000` |
| `MAX_CONCURRENT_PER_IP` | Max concurrent connections allowed per IP | `50` |
| `BURST_THRESHOLD` / `BURST_WINDOW_MS` | Burst-spike detection threshold | `30` / `1000` |
| `VIOLATIONS_BEFORE_LONG_BAN` | Number of violations before a long ban is triggered | `5` |
| `LONG_BAN_MS` | Long ban duration | `1800000` (30 min) |
| `WHITELIST_IPS` / `BLACKLIST_IPS` | Comma-separated IP lists | `127.0.0.1,::1` / empty |
| `CHALLENGE_ENABLED` | Turn the Layer 7 JS challenge on/off | `true` |
| `SUSPICION_THRESHOLD` | How aggressively the challenge triggers | `3` |
| `CHALLENGE_SECRET` | **Change this in production** | — |
| `LOG_LEVEL` | `error` / `warn` / `info` / `debug` | `info` |

> ⚠️ **Security note:** Enabling `TRUST_PROXY=true` makes Emre Tool trust the
> `X-Forwarded-For` header. Only enable this if you're genuinely running behind a trusted
> load balancer/proxy — otherwise attackers can spoof this header and bypass IP-based
> protection entirely.

## Monitoring endpoint

```
GET /__ddos_guard_status
```

Returns live stats: number of tracked IPs, active bans, uptime, etc. In production, put
this endpoint behind your own authentication layer before exposing it.

## Project structure

```
emre-tool/
├── config/config.js          # Central configuration
├── src/
│   ├── core/
│   │   ├── rateLimiter.js       # Sliding-window rate limiter
│   │   ├── connectionTracker.js # Connection & burst detection
│   │   └── reputation.js        # IP reputation / ban system
│   ├── middleware/
│   │   ├── ddosShield.js        # Orchestrates all protection layers
│   │   └── challenge.js         # Layer 7 JS challenge
│   ├── utils/logger.js
│   └── server.js                # Express + reverse-proxy entry point
├── test/                        # Unit tests + demo backend
├── Dockerfile
└── docker-compose.yml
```

## Honest limitations

- This is **application-layer (L7)** protection. For massive **volumetric Layer 3/4
  attacks** (e.g. UDP floods that saturate your bandwidth), you also need an
  infrastructure-level service (Cloudflare, AWS Shield, etc.). No application-level tool
  — including this one — can claim 100% immunity to every kind of DDoS attack.
- State is kept **in-memory** in a single process. For real production scale, run multiple
  instances behind a load balancer with a shared store (e.g. Redis) for rate-limit data.
- The JS challenge filters out simple scripts/flood tools, not sophisticated
  headless-browser bots.

## License

MIT — see [LICENSE](./LICENSE)

---

# 🇹🇷 Türkçe

## Emre Tool nedir?

Emre Tool, backend'inizin önüne bir ters proxy (reverse-proxy) olarak yerleşir. Gelen her
istek, temiz trafik gerçek sunucunuza iletilmeden önce birkaç koruma katmanından geçer.

```
İstemci → [ Emre Tool ] → Backend'iniz
              │
              ├─ 1) Whitelist / Blacklist kontrolü
              ├─ 2) Aktif ban kontrolü
              ├─ 3) Eşzamanlı bağlantı limiti (Slowloris koruması)
              ├─ 4) Burst / ani trafik patlaması tespiti
              ├─ 5) Sliding-window rate limiting
              └─ 6) Layer 7 JS Challenge (bot filtreleme)
```

## Özellikler

- **Sliding-window (kayan pencere) rate limiting** — sabit pencere yönteminin sınırda
  yaşadığı klasik "çift istek" açığını ortadan kaldırır.
- **Eşzamanlı bağlantı limiti** — Slowloris tarzı yavaş bağlantı saldırılarına karşı korur.
- **Burst tespiti** — çok kısa sürede gelen anormal istek patlamalarını yakalar.
- **Kademeli IP itibar sistemi** — tekrar eden ihlaller otomatik olarak uzun süreli ban'a
  dönüşür.
- **Layer 7 JS Challenge** — HMAC-SHA256 ile imzalanmış, sahtelenemez çerez tabanlı bot
  doğrulama.
- **Whitelist / Blacklist** desteği.
- **Bellek sızıntısı yok** — tüm sayaçlar periyodik olarak temizlenir (sweep).
- **Docker & docker-compose** desteği — tek komutla ayağa kalkar.
- **Çekirdek modüllerde %100 birim test kapsamı** (`node --test`, 16 test, harici test
  bağımlılığı yok).
- Proxy katmanında WebSocket desteği.

## Gereksinimler

- Node.js **18 veya üzeri** (Node 22 üzerinde test edildi)
- npm (Node.js ile birlikte gelir)
- Docker + Docker Compose (opsiyonel, sadece container ile çalıştırmak isterseniz)

## Kurulum

```bash
git clone https://github.com/kullanici-adiniz/emre-tool.git
cd emre-tool
npm install
cp .env.example .env
```

Ardından `.env` dosyasını açıp en azından şu iki değeri girin:

- `TARGET_URL` — korumak istediğiniz gerçek backend (örn. `http://localhost:3000`)
- `CHALLENGE_SECRET` — güçlü, rastgele bir anahtar (`openssl rand -hex 32` ile üretebilirsiniz)

## Çalıştırma

### Seçenek A — Kendi backend'inize karşı çalıştırma

```bash
npm start
```

Emre Tool varsayılan olarak `8080` portunu dinler ve temiz trafiği `.env` dosyanızdaki
`TARGET_URL` adresine iletir.

### Seçenek B — Örnek/demo backend ile deneme

İki terminal açın:

```bash
# Terminal 1 — 3000 portunda sahte bir backend başlatır
npm run target
```

```bash
# Terminal 2 — Emre Tool'u başlatır, sahte backend'i korur
npm start
```

Şimdi `http://localhost:8080` adresine istek gönderin — trafik tüm koruma katmanlarından
geçip başarılı olursa demo backend'e iletilir.

### Seçenek C — Docker Compose ile çalıştırma (hızlı test için önerilir)

```bash
docker compose up --build
```

Bu komut hem `emre-tool` servisini hem de demo `target` backend'ini birlikte ayağa
kaldırır. `http://localhost:8080` adresini ziyaret edin.

### Geliştirme modu (dosya değişikliklerinde otomatik yeniden başlatma)

```bash
npm run dev
```

## Testleri çalıştırma

```bash
npm test
```

Bu komut, çekirdek modülleri (`RateLimiter`, `ConnectionTracker`, `ReputationManager`)
kapsayan 16 birim testini Node'un yerleşik `node:test` test çalıştırıcısıyla çalıştırır —
testlerin kendisini çalıştırmak için ekstra bir bağımlılık gerekmez.

## Konfigürasyon referansı

Tüm ayarlar `.env` dosyası üzerinden yapılır (varsayılan değerlerin tam listesi için
`.env.example` dosyasına bakın):

| Değişken | Açıklama | Varsayılan |
|---|---|---|
| `PORT` | Emre Tool'un dinleyeceği port | `8080` |
| `TARGET_URL` | Korunan gerçek backend adresi | `http://localhost:3000` |
| `TRUST_PROXY` | Yalnızca güvenilen bir ters proxy/load balancer arkasındaysanız `true` yapın | `false` |
| `RATE_WINDOW_MS` / `RATE_MAX_REQUESTS` | Kayan pencere rate limit ayarları | `10000` / `100` |
| `RATE_BAN_MS` | Rate limit aşımından sonraki geçici ban süresi | `60000` |
| `MAX_CONCURRENT_PER_IP` | IP başına izin verilen maksimum eşzamanlı bağlantı | `50` |
| `BURST_THRESHOLD` / `BURST_WINDOW_MS` | Ani patlama tespit eşiği | `30` / `1000` |
| `VIOLATIONS_BEFORE_LONG_BAN` | Uzun ban tetiklenmeden önceki ihlal sayısı | `5` |
| `LONG_BAN_MS` | Uzun ban süresi | `1800000` (30 dk) |
| `WHITELIST_IPS` / `BLACKLIST_IPS` | Virgülle ayrılmış IP listeleri | `127.0.0.1,::1` / boş |
| `CHALLENGE_ENABLED` | Layer 7 JS challenge açık/kapalı | `true` |
| `SUSPICION_THRESHOLD` | Challenge'ın ne kadar agresif tetikleneceği | `3` |
| `CHALLENGE_SECRET` | **Production'da mutlaka değiştirin** | — |
| `LOG_LEVEL` | `error` / `warn` / `info` / `debug` | `info` |

> ⚠️ **Güvenlik notu:** `TRUST_PROXY=true` yapıldığında Emre Tool, `X-Forwarded-For`
> başlığına güvenir. Bunu yalnızca gerçekten güvenilen bir yük dengeleyici/proxy
> arkasında çalışıyorsanız açın; aksi halde saldırganlar bu başlığı sahteleyerek IP
> tabanlı korumayı tamamen bypass edebilir.

## İzleme endpoint'i

```
GET /__ddos_guard_status
```

Anlık istatistikleri döner: izlenen IP sayısı, aktif ban sayısı, uptime vb. Production'da
bu endpoint'i kendi kimlik doğrulama katmanınızın arkasına almanız önerilir.

## Proje yapısı

```
emre-tool/
├── config/config.js          # Merkezi konfigürasyon
├── src/
│   ├── core/
│   │   ├── rateLimiter.js       # Sliding-window rate limiter
│   │   ├── connectionTracker.js # Bağlantı & burst tespiti
│   │   └── reputation.js        # IP itibar / ban sistemi
│   ├── middleware/
│   │   ├── ddosShield.js        # Tüm koruma katmanlarını birleştiren orkestratör
│   │   └── challenge.js         # Layer 7 JS challenge
│   ├── utils/logger.js
│   └── server.js                # Express + reverse-proxy giriş noktası
├── test/                        # Birim testleri + demo backend
├── Dockerfile
└── docker-compose.yml
```

## Dürüst sınırlamalar

- Bu bir **uygulama katmanı (L7)** korumasıdır. Devasa **hacimsel Katman 3/4 saldırıları**
  için (örn. bant genişliğinizi doygunluğa ulaştıran UDP flood saldırıları) altyapı
  seviyesinde bir hizmete de ihtiyacınız olur (Cloudflare, AWS Shield vb.). Bu araç dahil,
  hiçbir uygulama-seviyesi araç her türlü DDoS saldırısına karşı %100 dokunulmazlık iddia
  edemez.
- State (durum) tek bir process içinde **bellekte (in-memory)** tutulur. Gerçek production
  ölçeği için, rate-limit verisi için paylaşımlı bir depo (örn. Redis) kullanan, bir yük
  dengeleyici arkasında birden fazla instance çalıştırmanız önerilir.
- JS challenge, basit script/flood araçlarını eler; gelişmiş headless-browser tabanlı
  botları değil.

## Lisans

MIT — bkz. [LICENSE](./LICENSE)

---

**Developed by Emre Tool** 🛡️
