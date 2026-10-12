# Church Library Lending System — Task Breakdown

> Source of truth: `docs/ARCHITECTURE.md` and `README.md`.
> If anything in this file contradicts the architecture doc, follow the architecture doc.

---

## Phase 0 — Project scaffolding

| # | Task | Notes |
|---|------|-------|
| 0.1 | Initialize Next.js (App Router) with TypeScript | `create-next-app --ts` |
| 0.2 | Install dependencies: `better-sqlite3` (or Drizzle), `zxing-js/library` (barcode scanning), `next-intl` (i18n) | Keep deps light; justify each one |
| 0.3 | Set up local development environment (`npm run dev`) | Confirm it runs on a normal laptop first |
| 0.4 | Configure Prettier / ESLint with Church Library conventions | Simple config; document in README |
| 0.5 | Create `lib/db.ts` — SQLite initialization and migration | Single SQLite file; use `better-sqlite3` or Drizzle; auto-create DB and tables on first run if empty |
| 0.6 | Verify DB migration runs cleanly | Manually run and confirm tables exist |

---

## Phase 1 — Database schema

| # | Task | Notes |
|---|------|-------|
| 1.1 | Create `people` table | `id (PK)`, `name`, `email (unique, nullable)`, `is_borrower`, `is_system` |
| 1.2 | Create `titles` table | `id (PK)`, `title`, `author`, `isbn` (unique) |
| 1.3 | Create `copies` table | `id (PK)`, `title_id (FK)`, `qr_code (unique, nullable)`, `status` |
| 1.4 | Create `loans` table | `id (PK)`, `copy_id (FK)`, `person_id (FK)`, `borrowed_at`, `due_at`, `returned_at (nullable)` |
| 1.5 | Create `reservations` table | `id (PK)`, `title_id (FK)`, `person_id (FK)`, `requested_at`, `notified_at (nullable)` |
| 1.6 | Create `donations` table | `id (PK)`, `copy_id (FK)`, `person_id (nullable, FK)`, `donated_at` |
| 1.7 | Create `seed` script — insert the "Church" system person | Row with no email, `is_system = true`, `is_borrower = false` |
| 1.8 | Write helper functions for status derivation | `copy_status` derived from `SELECT returned_at IS NULL FROM loans` — never store redundantly |

---

## Phase 1.5 — i18n setup

| # | Task | Notes |
|---|------|-------|
| 1.5.1 | Configure `next-intl` (or Next.js built-in i18n) | Dutch, English, French |
| 1.5.2 | Create translation files: `en.json`, `nl.json`, `fr.json` | Key/value pairs for ALL UI text — no hardcoded labels |
| 1.5.3 | Add language switcher component to layout / home page | Persists choice per device (localStorage) |
| 1.5.4 | Define translation keys for all screens (see Phase 2 below) | Document the key schema so future languages are easy |

---

## Phase 2 — Core screens (MVP)

### 2.1 — Home screen

| # | Task | Notes |
|---|------|-------|
| 2.1.1 | Create home page: `/` | Three top-level buttons: **Lend**, **Return**, **Add to inventory** |
| 2.1.2 | Add language switcher to home | Already done in 1.5.3; wire it here |
| 2.1.3 | Wire each button to its respective route/page | `/lend`, `/return`, `/add`, `/search` |

### 2.2 — Lend screen (`/lend`)

| # | Task | Notes |
|---|------|-------|
| 2.2.1 | Borrower picker screen | List existing borrowers (exclude "Church" row where `is_borrower = false`); "Sign up" button for new |
| 2.2.2 | Sign-up form (first name, last name, email) | Email = unique key; validate email format |
| 2.2.3 | Confirmation popup: "Lend to [name]?" | Cancel returns to home with nothing saved |
| 2.2.4 | Camera / barcode scan screen | Live webcam feed using `zxing` or `BarcodeDetector`; running list of scanned books beside the feed |
| 2.2.5 | ISBN lookup integration | On each barcode scan → call Open Library / Google Books API → display title, author, cover image |
| 2.2.6 | Duplicate-ISBN warning | If ISBN already exists in `titles`, show: "This book is already in the library — add another copy anyway?" |
| 2.2.7 | Manual fallback | If lookup fails, allow manual entry of title/author/ISBN via on-screen form |
| 2.2.8 | Add scanned book to running list | Books accumulate in a state list beside the camera feed |
| 2.2.9 | Confirm lend button | Saves all loans in a single transaction; each scanned copy → new loan row |
| 2.2.10 | Auto-confirm countdown (1–2 min) | If user walks away, auto-confirm after countdown; Cancel during countdown backs out completely |
| 2.2.11 | Cancel during scan | Cancels the entire operation; no loans are saved |

### 2.3 — Return screen (`/return`)

| # | Task | Notes |
|---|------|-------|
| 2.3.1 | Camera / barcode scan screen | Same scanning component as Lend screen |
| 2.3.2 | After scan: look up open loan for that copy | Query `loans` where `copy_id = ? AND returned_at IS NULL` |
| 2.3.3 | Borrower confirmation popup | "Return by [name]?" |
| 2.3.4 | Multiple copies to different people | If several open loans match, list all borrowers and let the user pick |
| 2.3.5 | Close the loan | Set `returned_at = NOW()` |

### 2.4 — Add to inventory (`/add`)

| # | Task | Notes |
|---|------|-------|
| 2.4.1 | Camera / barcode scan screen | Same scanning component; scans ISBN |
| 2.4.2 | ISBN lookup → display title, author, cover | Open Library / Google Books |
| 2.4.3 | Confirm or edit fields | "OK" accepts; fields editable via on-screen form if wrong or not found |
| 2.4.4 | Duplicate-ISBN check (Add flow) | "This book is already in the library — add another copy anyway?" |
| 2.4.5 | Title/author/ISBN validation | Required fields before saving |
| 2.4.6 | Create title + copy rows | Insert into `titles` / `copies`; generate a unique `qr_code` value for this copy |
| 2.4.7 | Donor dropdown | Existing borrowers (from `people`), "Sign up" for new donor, or default "Church"; `is_system` row included here but excluded from borrower picker |
| 2.4.8 | Save donation record | Insert into `donations` table; `person_id` may be null (e.g., bulk-loaded church stock) |

### 2.5 — Search screen (`/search`)

| # | Task | Notes |
|---|------|-------|
| 2.5.1 | Search/filter UI | Filter by title and by author |
| 2.5.2 | Results list | Show title, author, copy count, availability status (how many copies are available) |
| 2.5.3 | Pagination or scroll | For library catalog scale (not expected to be huge, but good practice) |

---

## Phase 2.5 — HTTPs on Raspberry Pi 5

> _Open item: exact HTTPS approach to be confirmed with maintainer._

| # | Task | Notes |
|---|------|-------|
| 2.5.1 | Plan HTTPS approach | Options: self-signed cert + install on client devices, local CA, or Caddy reverse proxy |
| 2.5.2 | Obtain/create certificate(s) | Ensure browsers on church devices trust them |
| 2.5.3 | Configure Next.js to serve over HTTPS | Or set up a reverse proxy (Caddy/Nginx) on the Pi |
| 2.5.4 | Test camera access on actual devices | Verify `BarcodeDetector` / `zxing` works over HTTPS on laptops, tablets, phones |

---

## Phase 3 — Nice-to-haves (Stage Two)

All additive, no schema changes required.

| # | Task | Notes |
|---|------|-------|
| 3.1 | Print QR codes for donated / unbarcoded books | Generate a QR payload pointing to the copy's `qr_code` value; design a printable template |
| 3.2 | Second scanning station | Support multiple concurrent sessions (database level already handles this); ensure scan queueing / conflict resolution is solid |
| 3.3 | Overdue detection script | Scheduled job (cron / Node script) finds loans where `returned_at IS NULL AND due_at < NOW()` |
| 3.4 | Overdue email reminders | Send one month after borrowing; email via a simple SMTP config |
| 3.5 | Reservation system | User can `reserve` a title; when any copy returns, mark `reservations.notified_at = NOW()` |
| 3.6 | Reservation email on availability | Notify the person who requested a title when a copy is free |
| 3.7 | "Withdrawn" status for copies | Mark copies taken out of circulation; used for tracking and reporting |

---

## Cross-cutting tasks

| # | Task | Notes |
|---|------|-------|
| C.1 | Database backups script | Simple file-copy script; run via cron on the Pi |
| C.2 | Error boundaries and user-facing error messages | Friendly messages for scan failures, API failures, DB errors |
| C.3 | Responsive design | Must work on laptops, tablets, and phones |
| C.4 | Documentation in README | Database location, HTTPS setup steps on Pi, how to add a language, dependency list |
| C.5 | Open questions to resolve with maintainer | Local HTTPS approach, exact i18n library, loan duration + grace period for "lost", login / access control beyond church network |

---

## Order of execution (summary)

1. **Phase 0** — Scaffolding + DB setup
2. **Phase 1** — All 6 tables + helpers + seed "Church" row
3. **Phase 1.5** — i18n + language switcher
4. **Phase 2** — Home → Lend → Return → Add → Search (in that order)
5. **Phase 2.5** — HTTPS on Pi (parallel, needed to test scanning on actual devices)
6. **Phase 3** — Nice-to-haves (after MVP is stable)
7. **Cross-cutting** — Backups, error handling, documentation (throughout)
