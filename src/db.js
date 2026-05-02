const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const dbUrl = process.env.DATABASE_URL || '';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('.railway.internal') || !dbUrl ? false : { rejectUnauthorized: false },
});

async function query(text, params) {
  const client = await pool.connect();
  try { return await client.query(text, params); }
  finally { client.release(); }
}

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS schools (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      division TEXT,
      state TEXT,
      ein TEXT,
      address TEXT,
      phone TEXT,
      website TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      phone TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sports (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id),
      name TEXT NOT NULL,
      season TEXT,
      gender TEXT,
      head_coach TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS athletes (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id),
      sport_id INTEGER REFERENCES sports(id),
      name TEXT NOT NULL,
      student_id TEXT,
      dob TEXT,
      gender TEXT,
      year TEXT,
      eligibility_status TEXT DEFAULT 'eligible',
      eligibility_note TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trips (
      id SERIAL PRIMARY KEY,
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
      charter_amount NUMERIC,
      charter_state TEXT,
      roster_locked INTEGER DEFAULT 0,
      roster_locked_at TIMESTAMPTZ,
      status TEXT DEFAULT 'planning',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trip_manifest (
      id SERIAL PRIMARY KEY,
      trip_id INTEGER REFERENCES trips(id),
      athlete_id INTEGER REFERENCES athletes(id),
      status TEXT DEFAULT 'confirmed',
      removed_reason TEXT,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      removed_at TIMESTAMPTZ,
      UNIQUE(trip_id, athlete_id)
    );

    CREATE TABLE IF NOT EXISTS tax_certs (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id),
      state TEXT NOT NULL,
      cert_number TEXT,
      issued_date TEXT,
      expiry_date TEXT,
      file_name TEXT,
      file_path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gsa_reports (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id),
      sport_id INTEGER,
      academic_year TEXT NOT NULL,
      report_type TEXT DEFAULT 'eada',
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      submitted_at TIMESTAMPTZ,
      report_data TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id),
      user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE`);
  await query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS per_diem_rate NUMERIC`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sport_id INTEGER REFERENCES sports(id)`);

  await query(`
    UPDATE users SET role='coach', sport_id=(SELECT id FROM sports WHERE school_id=users.school_id AND name='Men''s Basketball' LIMIT 1)
    WHERE email='coach@operationpivot.demo' AND (role != 'coach' OR sport_id IS NULL)
  `);

  const { rows } = await query('SELECT COUNT(*) as n FROM schools');
  if (parseInt(rows[0].n) > 0) return;

  const hash = bcrypt.hashSync('pivot123', 10);

  const { rows: [school] } = await query(
    `INSERT INTO schools (name, division, state, ein, address, phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    ['University of the Cumberlands', 'NAIA', 'KY', '61-0549200', '6191 College Station Dr, Williamsburg, KY 40769', '(606) 549-2200']
  );
  const schoolId = school.id;

  const { rows: [mbb] } = await query(`INSERT INTO sports (school_id,name,season,gender,head_coach) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [schoolId,"Men's Basketball",'winter','mens','Coach Davis']);
  const { rows: [wbb] } = await query(`INSERT INTO sports (school_id,name,season,gender,head_coach) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [schoolId,"Women's Basketball",'winter','womens','Coach Rivera']);
  const { rows: [msoc] } = await query(`INSERT INTO sports (school_id,name,season,gender,head_coach) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [schoolId,"Men's Soccer",'fall','mens','Coach Thompson']);
  await query(`INSERT INTO sports (school_id,name,season,gender,head_coach) VALUES ($1,$2,$3,$4,$5)`, [schoolId,"Women's Soccer",'fall','womens','Coach Martinez']);

  await query(`INSERT INTO users (school_id,name,email,password_hash,role,phone) VALUES ($1,$2,$3,$4,$5,$6)`,
    [schoolId, 'Marcus Webb', 'admin@operationpivot.demo', hash, 'admin', '(607) 555-0101']);
  await query(`INSERT INTO users (school_id,name,email,password_hash,role,phone) VALUES ($1,$2,$3,$4,$5,$6)`,
    [schoolId, 'Jordan Hayes', 'staff@operationpivot.demo', hash, 'staff', '(607) 555-0102']);
  await query(`INSERT INTO users (school_id,name,email,password_hash,role,phone,sport_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [schoolId, 'Coach Davis', 'coach@operationpivot.demo', hash, 'coach', '(606) 555-0103', mbb.id]);

  const mbbAthletes = [
    ['Marcus Johnson','CSU-2201','JR','mens','eligible',null],
    ['Tyler Brooks','CSU-2202','SR','mens','eligible',null],
    ['Devon Williams','CSU-2203','SO','mens','ineligible','GPA below 2.0 — academic hold'],
    ['Jaylen Carter','CSU-2204','FR','mens','eligible',null],
    ['Malik Thompson','CSU-2205','JR','mens','eligible',null],
    ['Darius Cole','CSU-2206','SR','mens','pending','Transfer clearance in progress'],
  ];
  const mbbIds = [];
  for (const a of mbbAthletes) {
    const { rows: [r] } = await query(`INSERT INTO athletes (school_id,sport_id,name,student_id,year,gender,eligibility_status,eligibility_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [schoolId, mbb.id, ...a]);
    mbbIds.push(r.id);
  }

  const wbbAthletes = [
    ['Aaliyah Foster','CSU-2301','SR','womens','eligible',null],
    ['Simone Reed','CSU-2302','JR','womens','eligible',null],
    ['Brittany Miles','CSU-2303','SO','womens','eligible',null],
    ['Keisha Brown','CSU-2304','FR','womens','eligible',null],
    ['Tanya Morris','CSU-2305','JR','womens','eligible',null],
    ['Destiny Hughes','CSU-2306','SR','womens','ineligible','Suspension — code of conduct'],
  ];
  const wbbIds = [];
  for (const a of wbbAthletes) {
    const { rows: [r] } = await query(`INSERT INTO athletes (school_id,sport_id,name,student_id,year,gender,eligibility_status,eligibility_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [schoolId, wbb.id, ...a]);
    wbbIds.push(r.id);
  }

  for (const a of [
    ['Carlos Rivera','CSU-2401','SR','mens','eligible',null],
    ['Ahmed Hassan','CSU-2402','JR','mens','eligible',null],
    ['Luke Patterson','CSU-2403','SO','mens','eligible',null],
    ['James Wu','CSU-2404','FR','mens','eligible',null],
  ]) await query(`INSERT INTO athletes (school_id,sport_id,name,student_id,year,gender,eligibility_status,eligibility_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [schoolId, msoc.id, ...a]);

  const { rows: [trip1] } = await query(`INSERT INTO trips (school_id,sport_id,name,destination,opponent,event_type,depart_date,return_date,charter_vendor,charter_amount,charter_state,roster_locked,roster_locked_at,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13) RETURNING id`,
    [schoolId, mbb.id, '@ Albany State — Conference Game', 'Albany, NY', 'Albany State', 'game', '2026-05-10', '2026-05-10', 'Northeast Charter Services', 1850.00, 'NY', 1, 'confirmed']);

  const { rows: [trip2] } = await query(`INSERT INTO trips (school_id,sport_id,name,destination,opponent,event_type,depart_date,return_date,charter_vendor,charter_amount,charter_state,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [schoolId, wbb.id, 'Regional Championship Tournament', 'Buffalo, NY', 'TBD', 'tournament', '2026-05-18', '2026-05-20', 'Empire State Charter', 3200.00, 'NY', 'planning']);

  await query(`INSERT INTO trips (school_id,sport_id,name,destination,opponent,event_type,depart_date,return_date,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [schoolId, msoc.id, '@ Geneseo Invitational', 'Geneseo, NY', 'SUNY Geneseo', 'tournament', '2026-05-25', '2026-05-26', 'planning']);

  for (const id of mbbIds) await query(`INSERT INTO trip_manifest (trip_id,athlete_id,status) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [trip1.id, id, 'confirmed']);
  for (const id of wbbIds.slice(0,5)) await query(`INSERT INTO trip_manifest (trip_id,athlete_id,status) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [trip2.id, id, 'confirmed']);

  await query(`INSERT INTO tax_certs (school_id,state,cert_number,issued_date,expiry_date,file_name) VALUES ($1,$2,$3,$4,$5,$6)`,
    [schoolId, 'NY', 'NY-EX-2024-7743', '2024-01-15', '2026-07-15', 'ny_tax_exemption_2024.pdf']);

  await query(`INSERT INTO activity_log (school_id,user_id,action,detail,entity_type,entity_id) VALUES ($1,$2,$3,$4,$5,$6)`, [schoolId,1,'roster_locked','@ Albany State — Conference Game roster locked','trip',trip1.id]);
  await query(`INSERT INTO activity_log (school_id,user_id,action,detail,entity_type,entity_id) VALUES ($1,$2,$3,$4,$5,$6)`, [schoolId,1,'eligibility_change','Devon Williams marked ineligible — GPA below 2.0','athlete',mbbIds[2]]);
  await query(`INSERT INTO activity_log (school_id,user_id,action,detail,entity_type,entity_id) VALUES ($1,$2,$3,$4,$5,$6)`, [schoolId,1,'trip_created','Trip created: Regional Championship Tournament','trip',trip2.id]);

  console.log('[db] Seed data inserted');
}

module.exports = { query, initDb };
