import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Ensure the data directory exists
const dbPath = path.join(process.cwd(), "data", "library.db");
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Enable foreign keys
db.pragma("foreign_keys = ON");

// --- Schema ---

const createPeopleTable = `
  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    is_borrower INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0
  )
`;

const createTitlesTable = `
  CREATE TABLE IF NOT EXISTS titles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT UNIQUE
  )
`;

const createCopiesTable = `
  CREATE TABLE IF NOT EXISTS copies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_id INTEGER NOT NULL,
    qr_code TEXT UNIQUE,
    FOREIGN KEY (title_id) REFERENCES titles(id)
  )
`;

const createLoansTable = `
  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    copy_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL,
    borrowed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_at DATETIME NOT NULL,
    returned_at DATETIME,
    FOREIGN KEY (copy_id) REFERENCES copies(id),
    FOREIGN KEY (person_id) REFERENCES people(id)
  )
`;

const createReservationsTable = `
  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notified_at DATETIME,
    FOREIGN KEY (title_id) REFERENCES titles(id),
    FOREIGN KEY (person_id) REFERENCES people(id)
  )
`;

const createDonationsTable = `
  CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    copy_id INTEGER NOT NULL,
    person_id INTEGER,
    donated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (copy_id) REFERENCES copies(id),
    FOREIGN KEY (person_id) REFERENCES people(id)
  )
`;

// --- Indexes for active-loan lookups ---
const createLoansIndex = `
  CREATE INDEX IF NOT EXISTS idx_loans_active
  ON loans (copy_id, returned_at)
  WHERE returned_at IS NULL
`;

// Run all migrations
db.exec(createPeopleTable);
db.exec(createTitlesTable);
db.exec(createCopiesTable);
db.exec(createLoansTable);
db.exec(createReservationsTable);
db.exec(createDonationsTable);
db.exec(createLoansIndex);

console.log("✅ Database tables created/verified");

// --- Seed data ---

const insertChurchSystemPerson = `
  INSERT OR IGNORE INTO people (id, name, email, is_borrower, is_system)
  VALUES (1, 'Church', NULL, 0, 1)
`;

// Run seed - only inserts if not already present
db.exec(insertChurchSystemPerson);

console.log("✅ Seed data inserted");

export default db;
