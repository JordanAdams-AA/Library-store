# Church Library Lending System

A lightweight library management system designed for small church libraries running on a Raspberry Pi 5. Provides book lending, returns, inventory management, and catalog search via a responsive web interface.

## Features (MVP)

- **Lend books** — Scan barcodes/camera, lookup ISBNs, assign to borrowers
- **Return books** — Scan a book's QR/ISBN to close the loan
- **Add to inventory** — Scan or manually add new books and copies
- **Search catalog** — Browse titles and availability by title or author
- **Multilingual** — Dutch, English, and French (i18n via `next-intl`)
- **QR codes** — Per-copy QR codes for quick scanning

## Quick Start (Development)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Raspberry Pi Setup

1. Clone the repo onto the Pi
2. Run `npm install && npm run build`
3. Start with `npm start` or systemd service (details below)
4. Configure HTTPS — see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## Database

SQLite database stored at `lib/data/library.db` (auto-created on first run).

### Tables

- **people** — Library members and the "Church" system account
- **titles** — Book titles (title, author, ISBN)
- **copies** — Individual physical copies with QR codes
- **loans** — Active and returned loans
- **reservations** — Title reservations
- **donations** — Donation records linking copies to donors

### Backups

Simple file copy; run via cron on the Pi:

```bash
cp lib/data/library.db lib/data/library.db.bak.$(date +%Y%m%d)
```

## HTTPS on Raspberry Pi

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the HTTPS approach. Camera access requires HTTPS in browsers. Recommended: Caddy as a reverse proxy with a local CA or self-signed certificates installed on client devices.

## i18n

Supported languages: Dutch (`nl`), English (`en`), French (`fr`).

To add a language:
1. Add a new file in `lib/i18n/translations/<lang>.json`
2. Add the locale code to the language switcher config
3. Ship and test

## Dependencies

See [`package.json`](./package.json) for the full list. Key dependencies:

- **Next.js** (App Router + TypeScript)
- **better-sqlite3** — Local SQLite database
- **zxing-js/library** — Barcode scanning via webcam

## License

[MIT](./LICENSE) — Copyright (c) 2026 Jordan Adams
