const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'operation-pivot.sqlite');
let db;

function getDb() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      division TEXT,
      state TEXT,
      ein TEXT,
      address TEXT,
      phone TEXT,
      website TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER REFERENCES schools(id),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER REFERENCES schools(id),
      name TEXT NOT NULL,
      season TEXT,
      gender TEXT,
      head_coach TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS athletes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER REFERENCES schools(id),
      sport_id INTEGER REFERENCES sports(id),
      name TEXT NOT NULL,
      student_id TEXT,
      dob TEXT,
      gender TEXT,
      year TEXT,
      eligibility_status TEXT DEFAULT 'eligible',
      eligibility_note TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER REFERENCES schools(id),
      sport_id INTEGER REFERENCES sports(id),
      name TEXT NOT NULL,
      destination TEXT,
      opponent TEXT,
      event_type TEXT DEFAULT 'game',
      depart_date TEXT NOT NULL,
      return_date TEXT,
      charter_vendor TEXT,
      charter_contact TEXT,
      charter_amount REAL,
      charter_state TEXT,
      roster_locked INTEGER DEFAULT 0,
      roster_locked_at DATETIME,
      status TEXT DEFAULT 'planning',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trip_manifest (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER REFERENCES trips(id),
      athlete_id INTEGER REFERENCES athletes(id),
      status TEXT DEFAULT 'confirmed',
      removed_reason TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      removed_at DATETIME,
      UNIQUE(trip_id, athlete_id)
    );

    CREATE TABLE IF NOT EXISTS tax_certs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER REFERENCES schools(id),
      state TEXT NOT NULL,
      cert_number TEXT,
      issued_date TEXT,
      expiry_date TEXT,
      file_name TEXT,
      file_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gsa_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER REFERENCES schools(id),
      sport_id INTEGER,
      academic_year TEXT NOT NULL,
      report_type TEXT DEFAULT 'eada',
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      submitted_at DATETIME,
      report_data TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER REFERENCES schools(id),
      user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const existing = db.prepare('SELECT COUNT(*) as n FROM schools').get();
  if (existing.n > 0) return;

  // School
  const schoolId = db.prepare(`INSERT INTO schools (name, division, state, ein, address, phone) VALUES (?, ?, ?, ?, ?, ?)`).run(
    'Cortland State University', 'D3', 'NY', '14-6001765', '1 Academic Dr, Cortland, NY 13045', '(607) 753-2000'
  ).lastInsertRowid;

  // Users
  const hash = bcrypt.hashSync('pivot123', 10);
  db.prepare(`INSERT INTO users (school_id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)`).run(
    schoolId, 'Marcus Webb', 'ad@cortlandstate.edu', hash, 'admin', '(607) 555-0101'
  );
  db.prepare(`INSERT INTO users (school_id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)`).run(
    schoolId, 'Jordan Hayes', 'staff@cortlandstate.edu', hash, 'staff', '(607) 555-0102'
  );

  // Sports
  const ins = db.prepare(`INSERT INTO sports (school_id, name, season, gender, head_coach) VALUES (?, ?, ?, ?, ?)`);
  const mbb = ins.run(schoolId, "Men's Basketball", 'winter', 'mens', 'Coach Davis').lastInsertRowid;
  const wbb = ins.run(schoolId, "Women's Basketball", 'winter', 'womens', 'Coach Rivera').lastInsertRowid;
  const msoc = ins.run(schoolId, "Men's Soccer", 'fall', 'mens', 'Coach Thompson').lastInsertRowid;
  const wsoc = ins.run(schoolId, "Women's Soccer", 'fall', 'womens', 'Coach Martinez').lastInsertRowid;

  // Athletes
  const ia = db.prepare(`INSERT INTO athletes (school_id, sport_id, name, student_id, year, gender, eligibility_status, eligibility_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  const mbbIds = [
    ['Marcus Johnson', 'CSU-2201', 'JR', 'mens', 'eligible', null],
    ['Tyler Brooks', 'CSU-2202', 'SR', 'mens', 'eligible', null],
    ['Devon Williams', 'CSU-2203', 'SO', 'mens', 'ineligible', 'GPA below 2.0 — academic hold'],
    ['Jaylen Carter', 'CSU-2204', 'FR', 'mens', 'eligible', null],
    ['Malik Thompson', 'CSU-2205', 'JR', 'mens', 'eligible', null],
    ['Darius Cole', 'CSU-2206', 'SR', 'mens', 'pending', 'Transfer clearance in progress'],
  ].map(a => ia.run(schoolId, mbb, ...a).lastInsertRowid);

  const wbbIds = [
    ['Aaliyah Foster', 'CSU-2301', 'SR', 'womens', 'eligible', null],
    ['Simone Reed', 'CSU-2302', 'JR', 'womens', 'eligible', null],
    ['Brittany Miles', 'CSU-2303', 'SO', 'womens', 'eligible', null],
    ['Keisha Brown', 'CSU-2304', 'FR', 'womens', 'eligible', null],
    ['Tanya Morris', 'CSU-2305', 'JR', 'womens', 'eligible', null],
    ['Destiny Hughes', 'CSU-2306', 'SR', 'womens', 'ineligible', 'Suspension — code of conduct'],
  ].map(a => ia.run(schoolId, wbb, ...a).lastInsertRowid);

  [
    ['Carlos Rivera', 'CSU-2401', 'SR', 'mens', 'eligible', null],
    ['Ahmed Hassan', 'CSU-2402', 'JR', 'mens', 'eligible', null],
    ['Luke Patterson', 'CSU-2403', 'SO', 'mens', 'eligible', null],
    ['James Wu', 'CSU-2404', 'FR', 'mens', 'eligible', null],
    ['Noah Kelly', 'CSU-2405', 'JR', 'mens', 'eligible', null],
    ['Ethan Ross', 'CSU-2406', 'SR', 'mens', 'eligible', null],
  ].forEach(a => ia.run(schoolId, msoc, ...a));

  [
    ['Sofia Garcia', 'CSU-2501', 'SR', 'womens', 'eligible', null],
    ['Emma Chen', 'CSU-2502', 'JR', 'womens', 'eligible', null],
    ['Olivia Scott', 'CSU-2503', 'SO', 'womens', 'eligible', null],
    ['Ava Johnson', 'CSU-2504', 'FR', 'womens', 'eligible', null],
    ['Mia Torres', 'CSU-2505', 'JR', 'womens', 'eligible', null],
    ['Isabella Lee', 'CSU-2506', 'SR', 'womens', 'eligible', null],
  ].forEach(a => ia.run(schoolId, wsoc, ...a));

  // Trips
  const it = db.prepare(`INSERT INTO trips (school_id, sport_id, name, destination, opponent, event_type, depart_date, return_date, charter_vendor, charter_amount, charter_state, roster_locked, roster_locked_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const trip1 = it.run(schoolId, mbb, '@ Albany State — Conference Game', 'Albany, NY', 'Albany State', 'game',
    '2026-05-10', '2026-05-10', 'Northeast Charter Services', 1850.00, 'NY', 1, new Date().toISOString(), 'confirmed').lastInsertRowid;

  const trip2 = it.run(schoolId, wbb, 'Regional Championship Tournament', 'Buffalo, NY', 'TBD', 'tournament',
    '2026-05-18', '2026-05-20', 'Empire State Charter', 3200.00, 'NY', 0, null, 'planning').lastInsertRowid;

  it.run(schoolId, wsoc, '@ Geneseo Invitational', 'Geneseo, NY', 'SUNY Geneseo', 'tournament',
    '2026-05-25', '2026-05-26', null, null, null, 0, null, 'planning');

  // Manifests — trip1 includes Devon Williams (ineligible) = conflict
  const im = db.prepare(`INSERT OR IGNORE INTO trip_manifest (trip_id, athlete_id, status) VALUES (?, ?, ?)`);
  mbbIds.forEach(id => im.run(trip1, id, 'confirmed'));
  wbbIds.slice(0, 5).forEach(id => im.run(trip2, id, 'confirmed'));

  // Tax cert
  db.prepare(`INSERT INTO tax_certs (school_id, state, cert_number, issued_date, expiry_date, file_name) VALUES (?, ?, ?, ?, ?, ?)`).run(
    schoolId, 'NY', 'NY-EX-2024-7743', '2024-01-15', '2026-07-15', 'ny_tax_exemption_2024.pdf'
  );

  // Activity
  const il = db.prepare(`INSERT INTO activity_log (school_id, user_id, action, detail, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)`);
  il.run(schoolId, 1, 'roster_locked', '@ Albany State — Conference Game roster locked', 'trip', trip1);
  il.run(schoolId, 1, 'eligibility_change', 'Devon Williams marked ineligible — GPA below 2.0', 'athlete', mbbIds[2]);
  il.run(schoolId, 1, 'trip_created', 'Trip created: Regional Championship Tournament', 'trip', trip2);

  console.log('[db] Seed data inserted — demo: ad@cortlandstate.edu / pivot123');
}

module.exports = { initDb, getDb };
