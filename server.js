require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { initDb, getDb } = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'op-dev-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function logActivity(db, schoolId, userId, action, detail, entityType, entityId) {
  try {
    db.prepare(`INSERT INTO activity_log (school_id, user_id, action, detail, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)`).run(
      schoolId, userId, action, detail, entityType || null, entityId || null
    );
  } catch {}
}

// ── Auth ─────────────────────────────────────────────────────────────────────

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid email or password' });
  req.session.userId = user.id;
  req.session.schoolId = user.school_id;
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, school_id: user.school_id });
});

app.post('/auth/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = getDb().prepare('SELECT id, name, email, role, school_id, phone FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not found' });
  res.json(user);
});

// ── School ────────────────────────────────────────────────────────────────────

app.get('/api/school', requireAuth, (req, res) => {
  res.json(getDb().prepare('SELECT * FROM schools WHERE id = ?').get(req.session.schoolId) || {});
});

app.put('/api/school', requireAuth, (req, res) => {
  const { name, division, state, ein, address, phone, website } = req.body;
  getDb().prepare(`UPDATE schools SET name=?,division=?,state=?,ein=?,address=?,phone=?,website=? WHERE id=?`).run(
    name, division, state, ein, address, phone, website, req.session.schoolId
  );
  res.json({ ok: true });
});

// ── Sports ────────────────────────────────────────────────────────────────────

app.get('/api/sports', requireAuth, (req, res) => {
  res.json(getDb().prepare('SELECT * FROM sports WHERE school_id=? ORDER BY name').all(req.session.schoolId));
});

app.post('/api/sports', requireAuth, (req, res) => {
  const { name, season, gender, head_coach } = req.body;
  const r = getDb().prepare('INSERT INTO sports (school_id,name,season,gender,head_coach) VALUES (?,?,?,?,?)').run(
    req.session.schoolId, name, season, gender, head_coach
  );
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/sports/:id', requireAuth, (req, res) => {
  const { name, season, gender, head_coach } = req.body;
  getDb().prepare('UPDATE sports SET name=?,season=?,gender=?,head_coach=? WHERE id=? AND school_id=?').run(
    name, season, gender, head_coach, req.params.id, req.session.schoolId
  );
  res.json({ ok: true });
});

app.delete('/api/sports/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM sports WHERE id=? AND school_id=?').run(req.params.id, req.session.schoolId);
  res.json({ ok: true });
});

// ── Athletes ──────────────────────────────────────────────────────────────────

app.get('/api/athletes', requireAuth, (req, res) => {
  const { sport_id, status } = req.query;
  let sql = `SELECT a.*, s.name as sport_name FROM athletes a LEFT JOIN sports s ON s.id=a.sport_id WHERE a.school_id=?`;
  const params = [req.session.schoolId];
  if (sport_id) { sql += ' AND a.sport_id=?'; params.push(sport_id); }
  if (status) { sql += ' AND a.eligibility_status=?'; params.push(status); }
  sql += ' ORDER BY s.name, a.name';
  res.json(getDb().prepare(sql).all(...params));
});

app.post('/api/athletes', requireAuth, (req, res) => {
  const { sport_id, name, student_id, dob, gender, year, eligibility_status, eligibility_note } = req.body;
  const db = getDb();
  const r = db.prepare(`INSERT INTO athletes (school_id,sport_id,name,student_id,dob,gender,year,eligibility_status,eligibility_note) VALUES (?,?,?,?,?,?,?,?,?)`).run(
    req.session.schoolId, sport_id, name, student_id, dob, gender, year, eligibility_status || 'eligible', eligibility_note
  );
  logActivity(db, req.session.schoolId, req.session.userId, 'athlete_added', `Added: ${name}`, 'athlete', r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/athletes/:id', requireAuth, (req, res) => {
  const { sport_id, name, student_id, dob, gender, year, eligibility_status, eligibility_note } = req.body;
  const db = getDb();
  const prev = db.prepare('SELECT * FROM athletes WHERE id=? AND school_id=?').get(req.params.id, req.session.schoolId);
  if (!prev) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE athletes SET sport_id=?,name=?,student_id=?,dob=?,gender=?,year=?,eligibility_status=?,eligibility_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND school_id=?`).run(
    sport_id, name, student_id, dob, gender, year, eligibility_status, eligibility_note, req.params.id, req.session.schoolId
  );
  if (prev.eligibility_status !== eligibility_status) {
    logActivity(db, req.session.schoolId, req.session.userId, 'eligibility_change',
      `${name}: ${prev.eligibility_status} → ${eligibility_status}${eligibility_note ? ' — ' + eligibility_note : ''}`, 'athlete', req.params.id);
  }
  res.json({ ok: true });
});

app.delete('/api/athletes/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM athletes WHERE id=? AND school_id=?').run(req.params.id, req.session.schoolId);
  res.json({ ok: true });
});

// ── Trips ─────────────────────────────────────────────────────────────────────

app.get('/api/trips', requireAuth, (req, res) => {
  const { status, sport_id } = req.query;
  let sql = `SELECT t.*, s.name as sport_name,
    (SELECT COUNT(*) FROM trip_manifest tm WHERE tm.trip_id=t.id AND tm.status='confirmed') as manifest_count,
    (SELECT COUNT(*) FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id WHERE tm.trip_id=t.id AND tm.status='confirmed' AND a.eligibility_status!='eligible') as conflict_count
    FROM trips t LEFT JOIN sports s ON s.id=t.sport_id WHERE t.school_id=?`;
  const params = [req.session.schoolId];
  if (status) { sql += ' AND t.status=?'; params.push(status); }
  if (sport_id) { sql += ' AND t.sport_id=?'; params.push(sport_id); }
  sql += ' ORDER BY t.depart_date';
  res.json(getDb().prepare(sql).all(...params));
});

app.post('/api/trips', requireAuth, (req, res) => {
  const { sport_id, name, destination, opponent, event_type, depart_date, return_date, charter_vendor, charter_contact, charter_amount, charter_state, notes } = req.body;
  const db = getDb();
  const r = db.prepare(`INSERT INTO trips (school_id,sport_id,name,destination,opponent,event_type,depart_date,return_date,charter_vendor,charter_contact,charter_amount,charter_state,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    req.session.schoolId, sport_id, name, destination, opponent, event_type || 'game', depart_date, return_date,
    charter_vendor, charter_contact, charter_amount || null, charter_state, notes
  );
  logActivity(db, req.session.schoolId, req.session.userId, 'trip_created', `Created: ${name}`, 'trip', r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

app.get('/api/trips/:id', requireAuth, (req, res) => {
  const trip = getDb().prepare(`SELECT t.*, s.name as sport_name FROM trips t LEFT JOIN sports s ON s.id=t.sport_id WHERE t.id=? AND t.school_id=?`).get(req.params.id, req.session.schoolId);
  if (!trip) return res.status(404).json({ error: 'Not found' });
  res.json(trip);
});

app.put('/api/trips/:id', requireAuth, (req, res) => {
  const { sport_id, name, destination, opponent, event_type, depart_date, return_date, charter_vendor, charter_contact, charter_amount, charter_state, status, notes } = req.body;
  getDb().prepare(`UPDATE trips SET sport_id=?,name=?,destination=?,opponent=?,event_type=?,depart_date=?,return_date=?,charter_vendor=?,charter_contact=?,charter_amount=?,charter_state=?,status=?,notes=? WHERE id=? AND school_id=?`).run(
    sport_id, name, destination, opponent, event_type, depart_date, return_date, charter_vendor, charter_contact,
    charter_amount || null, charter_state, status, notes, req.params.id, req.session.schoolId
  );
  res.json({ ok: true });
});

app.delete('/api/trips/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM trip_manifest WHERE trip_id=?').run(req.params.id);
  db.prepare('DELETE FROM trips WHERE id=? AND school_id=?').run(req.params.id, req.session.schoolId);
  res.json({ ok: true });
});

app.post('/api/trips/:id/lock', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare(`UPDATE trips SET roster_locked=1,roster_locked_at=CURRENT_TIMESTAMP,status='confirmed' WHERE id=? AND school_id=?`).run(req.params.id, req.session.schoolId);
  const trip = db.prepare('SELECT name FROM trips WHERE id=?').get(req.params.id);
  logActivity(db, req.session.schoolId, req.session.userId, 'roster_locked', `Roster locked: ${trip?.name}`, 'trip', req.params.id);
  res.json({ ok: true });
});

app.post('/api/trips/:id/unlock', requireAuth, (req, res) => {
  getDb().prepare(`UPDATE trips SET roster_locked=0,roster_locked_at=NULL WHERE id=? AND school_id=?`).run(req.params.id, req.session.schoolId);
  res.json({ ok: true });
});

// ── Manifest ──────────────────────────────────────────────────────────────────

app.get('/api/trips/:id/manifest', requireAuth, (req, res) => {
  const rows = getDb().prepare(`
    SELECT tm.*, a.name, a.student_id, a.year, a.gender, a.eligibility_status, a.eligibility_note, s.name as sport_name
    FROM trip_manifest tm
    JOIN athletes a ON a.id=tm.athlete_id
    LEFT JOIN sports s ON s.id=a.sport_id
    WHERE tm.trip_id=? AND tm.status='confirmed'
    ORDER BY a.name
  `).all(req.params.id);
  res.json(rows);
});

app.post('/api/trips/:id/manifest', requireAuth, (req, res) => {
  const { athlete_id } = req.body;
  try {
    getDb().prepare('INSERT OR REPLACE INTO trip_manifest (trip_id,athlete_id,status) VALUES (?,?,?)').run(req.params.id, athlete_id, 'confirmed');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/trips/:id/manifest/:athleteId', requireAuth, (req, res) => {
  const db = getDb();
  const a = db.prepare('SELECT name FROM athletes WHERE id=?').get(req.params.athleteId);
  db.prepare(`UPDATE trip_manifest SET status='removed',removed_at=CURRENT_TIMESTAMP WHERE trip_id=? AND athlete_id=?`).run(req.params.id, req.params.athleteId);
  if (a) logActivity(db, req.session.schoolId, req.session.userId, 'manifest_removed', `${a.name} removed from manifest`, 'trip', req.params.id);
  res.json({ ok: true });
});

// ── Tax Certs ─────────────────────────────────────────────────────────────────

app.get('/api/tax-certs', requireAuth, (req, res) => {
  res.json(getDb().prepare('SELECT * FROM tax_certs WHERE school_id=? ORDER BY state').all(req.session.schoolId));
});

app.post('/api/tax-certs', requireAuth, upload.single('cert_file'), (req, res) => {
  const { state, cert_number, issued_date, expiry_date } = req.body;
  const db = getDb();
  const file = req.file;
  const r = db.prepare('INSERT INTO tax_certs (school_id,state,cert_number,issued_date,expiry_date,file_name,file_path) VALUES (?,?,?,?,?,?,?)').run(
    req.session.schoolId, state, cert_number, issued_date, expiry_date,
    file ? file.originalname : null, file ? file.path : null
  );
  logActivity(db, req.session.schoolId, req.session.userId, 'cert_uploaded', `Tax cert uploaded: ${state}`, 'cert', r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/tax-certs/:id', requireAuth, (req, res) => {
  const db = getDb();
  const cert = db.prepare('SELECT * FROM tax_certs WHERE id=? AND school_id=?').get(req.params.id, req.session.schoolId);
  if (cert?.file_path && fs.existsSync(cert.file_path)) fs.unlinkSync(cert.file_path);
  db.prepare('DELETE FROM tax_certs WHERE id=? AND school_id=?').run(req.params.id, req.session.schoolId);
  res.json({ ok: true });
});

app.get('/api/tax-certs/:id/download', requireAuth, (req, res) => {
  const cert = getDb().prepare('SELECT * FROM tax_certs WHERE id=? AND school_id=?').get(req.params.id, req.session.schoolId);
  if (!cert?.file_path || !fs.existsSync(cert.file_path)) return res.status(404).json({ error: 'File not found' });
  res.download(cert.file_path, cert.file_name);
});

// ── Reports ───────────────────────────────────────────────────────────────────

app.get('/api/reports', requireAuth, (req, res) => {
  res.json(getDb().prepare(`SELECT r.*, s.name as sport_name FROM gsa_reports r LEFT JOIN sports s ON s.id=r.sport_id WHERE r.school_id=? ORDER BY r.generated_at DESC`).all(req.session.schoolId));
});

app.post('/api/reports/generate', requireAuth, (req, res) => {
  const { sport_id, academic_year, report_type } = req.body;
  const db = getDb();
  let athletes;
  if (sport_id) {
    athletes = db.prepare('SELECT a.*, s.name as sport_name, s.gender as sport_gender FROM athletes a JOIN sports s ON s.id=a.sport_id WHERE a.school_id=? AND a.sport_id=?').all(req.session.schoolId, sport_id);
  } else {
    athletes = db.prepare('SELECT a.*, s.name as sport_name, s.gender as sport_gender FROM athletes a JOIN sports s ON s.id=a.sport_id WHERE a.school_id=?').all(req.session.schoolId);
  }
  const report_data = JSON.stringify({
    generated: new Date().toISOString(), academic_year, report_type: report_type || 'eada',
    athletes: athletes.map(a => ({ name: a.name, student_id: a.student_id, sport: a.sport_name, gender: a.sport_gender || a.gender, year: a.year, eligibility: a.eligibility_status })),
    summary: { total: athletes.length, eligible: athletes.filter(a => a.eligibility_status === 'eligible').length, ineligible: athletes.filter(a => a.eligibility_status === 'ineligible').length, pending: athletes.filter(a => a.eligibility_status === 'pending').length }
  });
  const r = db.prepare('INSERT INTO gsa_reports (school_id,sport_id,academic_year,report_type,report_data) VALUES (?,?,?,?,?)').run(
    req.session.schoolId, sport_id || null, academic_year, report_type || 'eada', report_data
  );
  logActivity(db, req.session.schoolId, req.session.userId, 'report_generated', `Report generated: ${academic_year}`, 'report', r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid, data: JSON.parse(report_data) });
});

app.put('/api/reports/:id/submit', requireAuth, (req, res) => {
  getDb().prepare('UPDATE gsa_reports SET submitted_at=CURRENT_TIMESTAMP WHERE id=? AND school_id=?').run(req.params.id, req.session.schoolId);
  res.json({ ok: true });
});

app.get('/api/reports/:id/csv', requireAuth, (req, res) => {
  const report = getDb().prepare('SELECT * FROM gsa_reports WHERE id=? AND school_id=?').get(req.params.id, req.session.schoolId);
  if (!report) return res.status(404).json({ error: 'Not found' });
  const data = JSON.parse(report.report_data);
  const rows = [['Name', 'Student ID', 'Sport', 'Gender', 'Year', 'Eligibility Status']];
  data.athletes.forEach(a => rows.push([a.name, a.student_id || '', a.sport, a.gender, a.year, a.eligibility]));
  const csv = rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="roster-report-${report.academic_year}.csv"`);
  res.send(csv);
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

app.get('/api/dashboard', requireAuth, (req, res) => {
  const db = getDb();
  const sid = req.session.schoolId;
  const today = new Date().toISOString().split('T')[0];
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const in60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

  const upcomingTrips = db.prepare(`SELECT COUNT(*) as n FROM trips WHERE school_id=? AND depart_date>=?`).get(sid, today).n;
  const conflicts = db.prepare(`SELECT COUNT(DISTINCT tm.id) as n FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id JOIN trips t ON t.id=tm.trip_id WHERE t.school_id=? AND tm.status='confirmed' AND a.eligibility_status!='eligible' AND t.depart_date>=?`).get(sid, today).n;
  const expiringCerts = db.prepare(`SELECT COUNT(*) as n FROM tax_certs WHERE school_id=? AND expiry_date BETWEEN ? AND ?`).get(sid, today, in60).n;
  const ineligibleAthletes = db.prepare(`SELECT COUNT(*) as n FROM athletes WHERE school_id=? AND eligibility_status='ineligible'`).get(sid).n;

  const trips = db.prepare(`SELECT t.*, s.name as sport_name,
    (SELECT COUNT(*) FROM trip_manifest tm WHERE tm.trip_id=t.id AND tm.status='confirmed') as manifest_count,
    (SELECT COUNT(*) FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id WHERE tm.trip_id=t.id AND tm.status='confirmed' AND a.eligibility_status!='eligible') as conflict_count
    FROM trips t LEFT JOIN sports s ON s.id=t.sport_id WHERE t.school_id=? AND t.depart_date>=? ORDER BY t.depart_date LIMIT 5`).all(sid, today);

  const conflictDetails = db.prepare(`SELECT a.name as athlete_name, a.eligibility_status, a.eligibility_note, t.name as trip_name, t.depart_date, t.id as trip_id FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id JOIN trips t ON t.id=tm.trip_id WHERE t.school_id=? AND tm.status='confirmed' AND a.eligibility_status!='eligible' AND t.depart_date>=? ORDER BY t.depart_date`).all(sid, today);

  const activity = db.prepare(`SELECT al.*, u.name as user_name FROM activity_log al LEFT JOIN users u ON u.id=al.user_id WHERE al.school_id=? ORDER BY al.created_at DESC LIMIT 8`).all(sid);

  res.json({ upcomingTrips, conflicts, expiringCerts, ineligibleAthletes, trips, conflictDetails, activity });
});

// ── Activity + Users ──────────────────────────────────────────────────────────

app.get('/api/activity', requireAuth, (req, res) => {
  res.json(getDb().prepare(`SELECT al.*, u.name as user_name FROM activity_log al LEFT JOIN users u ON u.id=al.user_id WHERE al.school_id=? ORDER BY al.created_at DESC LIMIT 50`).all(req.session.schoolId));
});

app.get('/api/users', requireAuth, (req, res) => {
  res.json(getDb().prepare('SELECT id,name,email,role,phone,created_at FROM users WHERE school_id=? ORDER BY name').all(req.session.schoolId));
});

app.post('/api/users', requireAuth, (req, res) => {
  const { name, email, password, role, phone } = req.body;
  try {
    const r = getDb().prepare('INSERT INTO users (school_id,name,email,password_hash,role,phone) VALUES (?,?,?,?,?,?)').run(
      req.session.schoolId, name, email.toLowerCase(), bcrypt.hashSync(password, 10), role || 'staff', phone
    );
    res.json({ id: r.lastInsertRowid });
  } catch { res.status(400).json({ error: 'Email already in use' }); }
});

app.put('/api/users/:id', requireAuth, (req, res) => {
  const { name, email, role, phone, password } = req.body;
  const db = getDb();
  if (password) {
    db.prepare('UPDATE users SET name=?,email=?,role=?,phone=?,password_hash=? WHERE id=? AND school_id=?').run(name, email.toLowerCase(), role, phone, bcrypt.hashSync(password, 10), req.params.id, req.session.schoolId);
  } else {
    db.prepare('UPDATE users SET name=?,email=?,role=?,phone=? WHERE id=? AND school_id=?').run(name, email.toLowerCase(), role, phone, req.params.id, req.session.schoolId);
  }
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, (req, res) => {
  if (req.params.id == req.session.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
  getDb().prepare('DELETE FROM users WHERE id=? AND school_id=?').run(req.params.id, req.session.schoolId);
  res.json({ ok: true });
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  try { getDb().prepare('SELECT 1').get(); res.json({ status: 'ok', ts: new Date().toISOString() }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[operation-pivot] running on :${PORT}`);
    console.log(`  AD login: ad@cortlandstate.edu / pivot123`);
  });
}

start().catch(console.error);
