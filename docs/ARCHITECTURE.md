# Church Library Lending System — Architecture

> Source of truth for system design. Task file `TASKS.md` should follow this document.

## Overview

A single-device, single-database library management app built with Next.js (App Router). Runs on a Raspberry Pi 5 as its origin server and serves a responsive web UI to laptops, tablets, and phones on the local network. All data is stored in a local SQLite database.

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14+ (App Router) + TypeScript | Modern, well-supported, built-in API routes for the backend |
| Database | SQLite via `better-sqlite3` | Single-file, zero config, perfect for single-device deployment |
| ORM | Drizzle ORM (lightweight) or raw SQL | Minimal overhead; Drizzle provides type safety without heavy footprint |
| i18n | `next-intl` | App Router support, JSON-based translations, no server-side dependency |
| Barcode scanning | `zxing-js/library` (fallback: `BarcodeDetector` API) | Works over HTTPS, camera-based, robust |
| HTTPS approach | Caddy reverse proxy with local CA certs or self-signed (to be confirmed) | Camera APIs require HTTPS; local networking needs certificate trust |

## Database Schema

### `people`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `name` | TEXT | NOT NULL | Display name |
| `email` | TEXT | UNIQUE, nullable | Contact info |
| `is_borrower` | INTEGER | NOT NULL DEFAULT 0 | 1 = can borrow |
| `is_system` | INTEGER | NOT NULL DEFAULT 0 | 1 = system account (e.g. "Church") |

**Seed row**: `id=1, name="Church", is_borrower=0, is_system=1`
This row represents the library itself and appears in donor pickers but NOT in borrower pickers.

### `titles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `title` | TEXT | NOT NULL | Display title |
| `author` | TEXT | NOT NULL | Author |
| `isbn` | TEXT | UNIQUE, nullable | ISBN-10 or ISBN-13 |

### `copies`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `title_id` | INTEGER | NOT NULL, FK → `titles.id` | |
| `qr_code` | TEXT | UNIQUE, nullable | Unique identifier for this copy (used for QR scanning) |
| `status` | TEXT | (DERIVED — see below) | **Never stored redundantly.** Derived from loans. |

**Derived status rule**: A copy is "borrowed" if any loan row with this `copy_id` has `returned_at IS NULL`. A copy is "available" when no such row exists.

### `loans`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `copy_id` | INTEGER | NOT NULL, FK → `copies.id` | |
| `person_id` | INTEGER | NOT NULL, FK → `people.id` | Borrower |
| `borrowed_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | When borrowed |
| `due_at` | DATETIME | NOT NULL | Due date (configurable, default +X days) |
| `returned_at` | DATETIME | nullable | When returned; null = active loan |

**Indexes**: `(copy_id, returned_at IS NULL)` for fast active-loan lookups.

### `reservations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `title_id` | INTEGER | NOT NULL, FK → `titles.id` | Title being reserved |
| `person_id` | INTEGER | NOT NULL, FK → `people.id` | Who reserved |
| `requested_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `notified_at` | DATETIME | nullable | When person was notified |

### `donations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `copy_id` | INTEGER | NOT NULL, FK → `copies.id` | The copy donated |
| `person_id` | INTEGER | nullable, FK → `people.id` | Donor (can be null for bulk library stock) |
| `donated_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

### Relationships Diagram

```
people (1) ─┬─ (0..N) loans ── (1) copies ── (1) titles
            └─ (0..N) donations ── (1) copies
            └─ (0..N) reservations ── (1) titles
```

## Status Derivation

**Copy status** is never stored in the `copies` table. It is derived on query:

```sql
-- Copy is "borrowed" if there's an active loan
SELECT CASE 
  WHEN EXISTS (
    SELECT 1 FROM loans 
    WHERE loans.copy_id = copies.id 
    AND loans.returned_at IS NULL
  ) THEN 'borrowed'
  ELSE 'available'
END AS status
FROM copies;
```

All UI-facing queries should use this expression rather than a stored `status` field. This avoids inconsistency between the status field and loan data.

## Application Architecture

### Directory Structure (Target)

```
├── app/                 # Next.js App Router
│   ├── layout.tsx       # Root layout (language provider, nav shell)
│   ├── page.tsx         # Home screen (Lend / Return / Add / Search buttons)
│   ├── lend/            # /lend — Lend books flow
│   ├── return/          # /return — Return books flow
│   ├── add/             # /add — Add to inventory flow
│   ├── search/          # /search — Catalog search
│   └── api/             # API routes (optional — server components preferred)
│       └── books/       # Barcode/ISBN lookup
├── lib/
│   ├── db.ts            # DB init, migration, helper functions
│   ├── i18n/
│   │   ├── config.ts    # next-intl config, locale settings
│   │   └── translations/
│   │       ├── en.json
│   │       ├── nl.json
│   │       └── fr.json
│   └── utils/           # Shared helpers (QR generation, date formatting, etc.)
├── docs/
│   ├── ARCHITECTURE.md  # This file
│   └── TASKS.md         # Task breakdown
├── public/              # Static assets (images, fonts)
├── package.json
├── tsconfig.json
└── next.config.js
```

### Key Technical Details

#### 1. Barcode Scanning

Barcode/QR scanning uses `zxing-js/library` as the primary scanner, falling back to the browser-native `BarcodeDetector` API. Camera access requires HTTPS (see Phase 2.5).

#### 2. ISBN Lookup

On barcode scan, the ISBN is looked up via the Open Library API:

```
GET https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data
```

Returns: title, author, cover image URL. Falls back to manual entry if lookup fails.

#### 3. QR Code System

Each `copy` gets a unique `qr_code` value (UUID v4) that serves as:
- A scannable QR code printed on the physical copy
- A lookup key for the return flow — scan the QR → find the copy → find active loans

#### 4. i18n

The app uses `next-intl` for client-side localization. Translation keys are JSON files in `lib/i18n/translations/`. Language preference is persisted in `localStorage` per device.

### Language Switcher

Component: `<LanguageSwitcher />`
- Renders as buttons (EN | NL | FR)
- Sets `locale` in `next-intl` provider
- Persists choice to `localStorage`

### Loan Duration & Grace Period

**TODO**: These are open questions to resolve with the maintainer.
- Default loan: TBD days
- Grace period: TBD days
- Lost book handling: TBD

### Access Control

Currently: no authentication. The system relies on the church LAN being trusted.

**OPEN**: Whether to add basic login for admin functions (inventory management) while keeping lending/return public.

### Backup Strategy

- Simple file copy of the SQLite DB, run via cron
- Target schedule: daily at 02:00
- Retention: 30 days

```bash
# Cron example
0 2 * * * cp $HOME/Documents/git-projects/Library-system/lib/data/library.db $HOME/Library-backups/library.db.$(date +\%Y\%m\%d)
```

## HTTPS on Raspberry Pi 5

**OPEN**: Exact approach to be confirmed with maintainer. Options in order of preference:

1. **Caddy reverse proxy** — Automatic HTTP→HTTPS redirect, handles certs
2. **Self-signed cert** — Install on each client device that needs camera access
3. **Local CA** — Issue certs via church's local CA, install root cert on client devices

The key requirement: **camera access for barcode scanning requires HTTPS** in modern browsers.

## Migration Strategy

1. SQLite schema is defined in `lib/db.ts`
2. On first run, the app checks if the DB file exists
3. If not, it creates the DB and runs all CREATE TABLE statements
4. Existing apps should handle table-alteration migrations manually
