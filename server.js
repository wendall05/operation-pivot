require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { query, initDb } = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

const dbUrl = process.env.DATABASE_URL || '';
const sessionPool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('.railway.internal') || !dbUrl ? false : { rejectUnauthorized: false },
});

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new pgSession({ pool: sessionPool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'op-dev-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { rows } = await query('SELECT role FROM users WHERE id=$1', [req.session.userId]);
  if (!rows[0] || rows[0].role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

async function logActivity(schoolId, userId, action, detail, entityType, entityId) {
  try {
    await query(`INSERT INTO activity_log (school_id,user_id,action,detail,entity_type,entity_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [schoolId, userId, action, detail, entityType||null, entityId||null]);
  } catch {}
}

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const { rows } = await query('SELECT * FROM users WHERE email=$1', [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Invalid email or password' });
    req.session.userId = user.id;
    req.session.schoolId = user.school_id;
    req.session.role = user.role;
    req.session.sportId = user.sport_id || null;
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, school_id: user.school_id, sport_id: user.sport_id || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/auth/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id,name,email,role,school_id,phone,sport_id FROM users WHERE id=$1', [req.session.userId]);
  if (!rows[0]) return res.status(401).json({ error: 'Not found' });
  res.json(rows[0]);
});

// ── School ────────────────────────────────────────────────────────────────────
app.get('/api/school', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM schools WHERE id=$1', [req.session.schoolId]);
  res.json(rows[0] || {});
});

app.put('/api/school', requireAdmin, async (req, res) => {
  const { name, division, state, ein, address, phone, website } = req.body;
  await query(`UPDATE schools SET name=$1,division=$2,state=$3,ein=$4,address=$5,phone=$6,website=$7 WHERE id=$8`,
    [name, division, state, ein, address, phone, website, req.session.schoolId]);
  res.json({ ok: true });
});

// ── Sports ────────────────────────────────────────────────────────────────────
app.get('/api/sports', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM sports WHERE school_id=$1 ORDER BY name', [req.session.schoolId]);
  res.json(rows);
});

app.post('/api/sports', requireAdmin, async (req, res) => {
  const { name, season, gender, head_coach } = req.body;
  const { rows } = await query('INSERT INTO sports (school_id,name,season,gender,head_coach) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [req.session.schoolId, name, season, gender, head_coach]);
  res.json({ id: rows[0].id });
});

app.put('/api/sports/:id', requireAdmin, async (req, res) => {
  const { name, season, gender, head_coach } = req.body;
  await query('UPDATE sports SET name=$1,season=$2,gender=$3,head_coach=$4 WHERE id=$5 AND school_id=$6',
    [name, season, gender, head_coach, req.params.id, req.session.schoolId]);
  res.json({ ok: true });
});

app.delete('/api/sports/:id', requireAdmin, async (req, res) => {
  await query('DELETE FROM sports WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  res.json({ ok: true });
});

// ── Athletes ──────────────────────────────────────────────────────────────────
app.get('/api/athletes', requireAuth, async (req, res) => {
  const { sport_id, status } = req.query;
  let sql = `SELECT a.*,s.name as sport_name FROM athletes a LEFT JOIN sports s ON s.id=a.sport_id WHERE a.school_id=$1`;
  const params = [req.session.schoolId];
  const effectiveSportId = req.session.role === 'coach' ? req.session.sportId : sport_id;
  if (effectiveSportId) { sql += ` AND a.sport_id=$${params.length+1}`; params.push(effectiveSportId); }
  if (status) { sql += ` AND a.eligibility_status=$${params.length+1}`; params.push(status); }
  sql += ' ORDER BY s.name, a.name';
  const { rows } = await query(sql, params);
  res.json(rows);
});

app.post('/api/athletes', requireAuth, async (req, res) => {
  const { sport_id, name, student_id, dob, gender, year, eligibility_status, eligibility_note } = req.body;
  const { rows } = await query(`INSERT INTO athletes (school_id,sport_id,name,student_id,dob,gender,year,eligibility_status,eligibility_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [req.session.schoolId, sport_id, name, student_id, dob, gender, year, eligibility_status||'eligible', eligibility_note]);
  await logActivity(req.session.schoolId, req.session.userId, 'athlete_added', `Added: ${name}`, 'athlete', rows[0].id);
  res.json({ id: rows[0].id });
});

app.put('/api/athletes/:id', requireAuth, async (req, res) => {
  const { sport_id, name, student_id, dob, gender, year, eligibility_status, eligibility_note } = req.body;
  const { rows: prev } = await query('SELECT * FROM athletes WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  if (!prev[0]) return res.status(404).json({ error: 'Not found' });
  await query(`UPDATE athletes SET sport_id=$1,name=$2,student_id=$3,dob=$4,gender=$5,year=$6,eligibility_status=$7,eligibility_note=$8,updated_at=NOW() WHERE id=$9 AND school_id=$10`,
    [sport_id, name, student_id, dob, gender, year, eligibility_status, eligibility_note, req.params.id, req.session.schoolId]);
  if (prev[0].eligibility_status !== eligibility_status)
    await logActivity(req.session.schoolId, req.session.userId, 'eligibility_change',
      `${name}: ${prev[0].eligibility_status} → ${eligibility_status}${eligibility_note?' — '+eligibility_note:''}`, 'athlete', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/athletes/:id', requireAdmin, async (req, res) => {
  await query('DELETE FROM athletes WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  res.json({ ok: true });
});

app.patch('/api/athletes/:id/eligibility', requireAuth, async (req, res) => {
  const { eligibility_status, eligibility_note } = req.body;
  const { rows: prev } = await query('SELECT name,eligibility_status FROM athletes WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  if (!prev[0]) return res.status(404).json({ error: 'Not found' });
  await query('UPDATE athletes SET eligibility_status=$1,eligibility_note=$2,updated_at=NOW() WHERE id=$3 AND school_id=$4',
    [eligibility_status, eligibility_note||null, req.params.id, req.session.schoolId]);
  if (prev[0].eligibility_status !== eligibility_status)
    await logActivity(req.session.schoolId, req.session.userId, 'eligibility_change',
      `${prev[0].name}: ${prev[0].eligibility_status} → ${eligibility_status}`, 'athlete', parseInt(req.params.id));
  res.json({ ok: true });
});

app.post('/api/athletes/import', requireAuth, upload.single('csv_file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const content = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path);
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV needs a header row and at least one data row' });
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const col = h => headers.indexOf(h);
    if (col('name') === -1 || col('sport') === -1)
      return res.status(400).json({ error: 'CSV must have "name" and "sport" columns' });
    const { rows: allSports } = await query('SELECT id,name FROM sports WHERE school_id=$1', [req.session.schoolId]);
    const sportMap = Object.fromEntries(allSports.map(s => [s.name.toLowerCase(), s.id]));
    let imported = 0, skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const name = cols[col('name')];
      const sport_id = sportMap[(cols[col('sport')] || '').toLowerCase()];
      if (!name || !sport_id) { skipped++; continue; }
      await query(`INSERT INTO athletes (school_id,sport_id,name,student_id,year,gender,eligibility_status,eligibility_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [req.session.schoolId, sport_id, name,
         col('student_id') > -1 ? cols[col('student_id')] || null : null,
         col('year') > -1 ? cols[col('year')] || null : null,
         col('gender') > -1 ? cols[col('gender')] || null : null,
         col('eligibility_status') > -1 ? cols[col('eligibility_status')] || 'eligible' : 'eligible',
         col('eligibility_note') > -1 ? cols[col('eligibility_note')] || null : null]);
      imported++;
    }
    await logActivity(req.session.schoolId, req.session.userId, 'roster_import', `CSV import: ${imported} athletes added`, null, null);
    res.json({ imported, skipped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Trips ─────────────────────────────────────────────────────────────────────
app.get('/api/trips', requireAuth, async (req, res) => {
  const { status, sport_id } = req.query;
  let sql = `SELECT t.*,s.name as sport_name,
    (SELECT COUNT(*) FROM trip_manifest tm WHERE tm.trip_id=t.id AND tm.status='confirmed') as manifest_count,
    (SELECT COUNT(*) FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id WHERE tm.trip_id=t.id AND tm.status='confirmed' AND a.eligibility_status!='eligible') as conflict_count
    FROM trips t LEFT JOIN sports s ON s.id=t.sport_id WHERE t.school_id=$1`;
  const params = [req.session.schoolId];
  if (status) { sql += ` AND t.status=$${params.length+1}`; params.push(status); }
  const tripSportId = req.session.role === 'coach' ? req.session.sportId : sport_id;
  if (tripSportId) { sql += ` AND t.sport_id=$${params.length+1}`; params.push(tripSportId); }
  sql += ' ORDER BY t.depart_date';
  const { rows } = await query(sql, params);
  res.json(rows);
});

app.post('/api/trips', requireAuth, async (req, res) => {
  const { sport_id, name, destination, opponent, event_type, depart_date, return_date, charter_vendor, charter_contact, charter_amount, charter_state, notes } = req.body;
  const { rows } = await query(`INSERT INTO trips (school_id,sport_id,name,destination,opponent,event_type,depart_date,return_date,charter_vendor,charter_contact,charter_amount,charter_state,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [req.session.schoolId, sport_id, name, destination, opponent, event_type||'game', depart_date, return_date||null, charter_vendor||null, charter_contact||null, charter_amount||null, charter_state||null, notes||null]);
  await logActivity(req.session.schoolId, req.session.userId, 'trip_created', `Created: ${name}`, 'trip', rows[0].id);
  res.json({ id: rows[0].id });
});

app.get('/api/trips/:id', requireAuth, async (req, res) => {
  const { rows } = await query(`SELECT t.*,s.name as sport_name FROM trips t LEFT JOIN sports s ON s.id=t.sport_id WHERE t.id=$1 AND t.school_id=$2`, [req.params.id, req.session.schoolId]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

app.put('/api/trips/:id', requireAuth, async (req, res) => {
  const { sport_id, name, destination, opponent, event_type, depart_date, return_date, charter_vendor, charter_contact, charter_amount, charter_state, status, notes } = req.body;
  await query(`UPDATE trips SET sport_id=$1,name=$2,destination=$3,opponent=$4,event_type=$5,depart_date=$6,return_date=$7,charter_vendor=$8,charter_contact=$9,charter_amount=$10,charter_state=$11,status=$12,notes=$13 WHERE id=$14 AND school_id=$15`,
    [sport_id, name, destination||null, opponent||null, event_type, depart_date, return_date||null, charter_vendor||null, charter_contact||null, charter_amount||null, charter_state||null, status, notes||null, req.params.id, req.session.schoolId]);
  res.json({ ok: true });
});

app.delete('/api/trips/:id', requireAdmin, async (req, res) => {
  await query('DELETE FROM trip_manifest WHERE trip_id=$1', [req.params.id]);
  await query('DELETE FROM trips WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  res.json({ ok: true });
});

app.post('/api/trips/:id/lock', requireAuth, async (req, res) => {
  await query(`UPDATE trips SET roster_locked=1,roster_locked_at=NOW(),status='confirmed' WHERE id=$1 AND school_id=$2`, [req.params.id, req.session.schoolId]);
  const { rows } = await query('SELECT name FROM trips WHERE id=$1', [req.params.id]);
  await logActivity(req.session.schoolId, req.session.userId, 'roster_locked', `Roster locked: ${rows[0]?.name}`, 'trip', req.params.id);
  res.json({ ok: true });
});

app.post('/api/trips/:id/unlock', requireAuth, async (req, res) => {
  await query(`UPDATE trips SET roster_locked=0,roster_locked_at=NULL WHERE id=$1 AND school_id=$2`, [req.params.id, req.session.schoolId]);
  res.json({ ok: true });
});

// ── Manifest ──────────────────────────────────────────────────────────────────
app.get('/api/trips/:id/manifest', requireAuth, async (req, res) => {
  const { rows } = await query(`
    SELECT tm.*,a.name,a.student_id,a.year,a.gender,a.eligibility_status,a.eligibility_note,s.name as sport_name
    FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id LEFT JOIN sports s ON s.id=a.sport_id
    WHERE tm.trip_id=$1 AND tm.status='confirmed' ORDER BY a.name`, [req.params.id]);
  res.json(rows);
});

app.post('/api/trips/:id/manifest', requireAuth, async (req, res) => {
  const { athlete_id } = req.body;
  try {
    await query('INSERT INTO trip_manifest (trip_id,athlete_id,status) VALUES ($1,$2,$3) ON CONFLICT (trip_id,athlete_id) DO UPDATE SET status=$3', [req.params.id, athlete_id, 'confirmed']);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/trips/:id/manifest/:athleteId', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT name FROM athletes WHERE id=$1', [req.params.athleteId]);
  await query(`UPDATE trip_manifest SET status='removed',removed_at=NOW() WHERE trip_id=$1 AND athlete_id=$2`, [req.params.id, req.params.athleteId]);
  if (rows[0]) await logActivity(req.session.schoolId, req.session.userId, 'manifest_removed', `${rows[0].name} removed from manifest`, 'trip', req.params.id);
  res.json({ ok: true });
});

// ── Tax Certs ─────────────────────────────────────────────────────────────────
app.get('/api/tax-certs', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM tax_certs WHERE school_id=$1 ORDER BY state', [req.session.schoolId]);
  res.json(rows);
});

app.post('/api/tax-certs', requireAdmin, upload.single('cert_file'), async (req, res) => {
  const { state, cert_number, issued_date, expiry_date } = req.body;
  const file = req.file;
  const { rows } = await query('INSERT INTO tax_certs (school_id,state,cert_number,issued_date,expiry_date,file_name,file_path) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [req.session.schoolId, state, cert_number||null, issued_date||null, expiry_date||null, file?.originalname||null, file?.path||null]);
  await logActivity(req.session.schoolId, req.session.userId, 'cert_uploaded', `Tax cert uploaded: ${state}`, 'cert', rows[0].id);
  res.json({ id: rows[0].id });
});

app.delete('/api/tax-certs/:id', requireAdmin, async (req, res) => {
  const { rows } = await query('SELECT * FROM tax_certs WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  if (rows[0]?.file_path && fs.existsSync(rows[0].file_path)) fs.unlinkSync(rows[0].file_path);
  await query('DELETE FROM tax_certs WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  res.json({ ok: true });
});

app.get('/api/tax-certs/:id/download', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM tax_certs WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  if (!rows[0]?.file_path || !fs.existsSync(rows[0].file_path)) return res.status(404).json({ error: 'File not found' });
  res.download(rows[0].file_path, rows[0].file_name);
});

// ── Reports ───────────────────────────────────────────────────────────────────
app.get('/api/reports', requireAuth, async (req, res) => {
  const { rows } = await query(`SELECT r.*,s.name as sport_name FROM gsa_reports r LEFT JOIN sports s ON s.id=r.sport_id WHERE r.school_id=$1 ORDER BY r.generated_at DESC`, [req.session.schoolId]);
  res.json(rows);
});

app.post('/api/reports/generate', requireAuth, async (req, res) => {
  const { sport_id, academic_year, report_type } = req.body;
  let athleteRows;
  if (sport_id) {
    const { rows } = await query('SELECT a.*,s.name as sport_name,s.gender as sport_gender FROM athletes a JOIN sports s ON s.id=a.sport_id WHERE a.school_id=$1 AND a.sport_id=$2', [req.session.schoolId, sport_id]);
    athleteRows = rows;
  } else {
    const { rows } = await query('SELECT a.*,s.name as sport_name,s.gender as sport_gender FROM athletes a JOIN sports s ON s.id=a.sport_id WHERE a.school_id=$1', [req.session.schoolId]);
    athleteRows = rows;
  }
  const report_data = JSON.stringify({
    generated: new Date().toISOString(), academic_year, report_type: report_type||'eada',
    athletes: athleteRows.map(a => ({ name: a.name, student_id: a.student_id, sport: a.sport_name, gender: a.sport_gender||a.gender, year: a.year, eligibility: a.eligibility_status })),
    summary: { total: athleteRows.length, eligible: athleteRows.filter(a=>a.eligibility_status==='eligible').length, ineligible: athleteRows.filter(a=>a.eligibility_status==='ineligible').length, pending: athleteRows.filter(a=>a.eligibility_status==='pending').length }
  });
  const { rows } = await query('INSERT INTO gsa_reports (school_id,sport_id,academic_year,report_type,report_data) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [req.session.schoolId, sport_id||null, academic_year, report_type||'eada', report_data]);
  await logActivity(req.session.schoolId, req.session.userId, 'report_generated', `Report: ${academic_year}`, 'report', rows[0].id);
  res.json({ id: rows[0].id, data: JSON.parse(report_data) });
});

app.put('/api/reports/:id/submit', requireAuth, async (req, res) => {
  await query('UPDATE gsa_reports SET submitted_at=NOW() WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  res.json({ ok: true });
});

app.get('/api/reports/:id/csv', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM gsa_reports WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const data = JSON.parse(rows[0].report_data);
  const csvRows = [['Name','Student ID','Sport','Gender','Year','Eligibility Status']];
  data.athletes.forEach(a => csvRows.push([a.name, a.student_id||'', a.sport, a.gender, a.year, a.eligibility]));
  const csv = csvRows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="roster-report-${rows[0].academic_year}.csv"`);
  res.send(csv);
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
app.get('/api/dashboard', requireAuth, async (req, res) => {
  const sid = req.session.schoolId;
  const today = new Date().toISOString().split('T')[0];
  const in60 = new Date(Date.now()+60*86400000).toISOString().split('T')[0];

  const isCoach = req.session.role === 'coach';
  const cSportId = req.session.sportId;
  const tripSportFilter = isCoach && cSportId ? ` AND sport_id=${parseInt(cSportId)}` : '';
  const tripAliasSportFilter = isCoach && cSportId ? ` AND t.sport_id=${parseInt(cSportId)}` : '';
  const athleteSportFilter = isCoach && cSportId ? ` AND sport_id=${parseInt(cSportId)}` : '';

  const [r1,r2,r3,r4,r5,r6,r7] = await Promise.all([
    query(`SELECT COUNT(*) as n FROM trips WHERE school_id=$1 AND depart_date>=$2${tripSportFilter}`, [sid,today]),
    query(`SELECT COUNT(DISTINCT tm.id) as n FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id JOIN trips t ON t.id=tm.trip_id WHERE t.school_id=$1 AND tm.status='confirmed' AND a.eligibility_status!='eligible' AND t.depart_date>=$2${tripAliasSportFilter}`, [sid,today]),
    query(`SELECT COUNT(*) as n FROM tax_certs WHERE school_id=$1 AND expiry_date BETWEEN $2 AND $3`, [sid,today,in60]),
    query(`SELECT COUNT(*) as n FROM athletes WHERE school_id=$1 AND eligibility_status='ineligible'${athleteSportFilter}`, [sid]),
    query(`SELECT t.*,s.name as sport_name,(SELECT COUNT(*) FROM trip_manifest tm WHERE tm.trip_id=t.id AND tm.status='confirmed') as manifest_count,(SELECT COUNT(*) FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id WHERE tm.trip_id=t.id AND tm.status='confirmed' AND a.eligibility_status!='eligible') as conflict_count FROM trips t LEFT JOIN sports s ON s.id=t.sport_id WHERE t.school_id=$1 AND t.depart_date>=$2${tripAliasSportFilter} ORDER BY t.depart_date LIMIT 5`, [sid,today]),
    query(`SELECT a.name as athlete_name,a.eligibility_status,a.eligibility_note,t.name as trip_name,t.depart_date,t.id as trip_id FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id JOIN trips t ON t.id=tm.trip_id WHERE t.school_id=$1 AND tm.status='confirmed' AND a.eligibility_status!='eligible' AND t.depart_date>=$2${tripAliasSportFilter} ORDER BY t.depart_date`, [sid,today]),
    query(`SELECT al.*,u.name as user_name FROM activity_log al LEFT JOIN users u ON u.id=al.user_id WHERE al.school_id=$1 ORDER BY al.created_at DESC LIMIT 8`, [sid]),
  ]);

  res.json({ upcomingTrips: parseInt(r1.rows[0].n), conflicts: parseInt(r2.rows[0].n), expiringCerts: parseInt(r3.rows[0].n), ineligibleAthletes: parseInt(r4.rows[0].n), trips: r5.rows, conflictDetails: r6.rows, activity: r7.rows });
});

// ── Activity + Users ──────────────────────────────────────────────────────────
app.get('/api/activity', requireAuth, async (req, res) => {
  const { rows } = await query(`SELECT al.*,u.name as user_name FROM activity_log al LEFT JOIN users u ON u.id=al.user_id WHERE al.school_id=$1 ORDER BY al.created_at DESC LIMIT 50`, [req.session.schoolId]);
  res.json(rows);
});

app.get('/api/users', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id,name,email,role,phone,created_at FROM users WHERE school_id=$1 ORDER BY name', [req.session.schoolId]);
  res.json(rows);
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  try {
    const { rows } = await query('INSERT INTO users (school_id,name,email,password_hash,role,phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [req.session.schoolId, name, email.toLowerCase(), bcrypt.hashSync(password,10), role||'staff', phone||null]);
    res.json({ id: rows[0].id });
  } catch { res.status(400).json({ error: 'Email already in use' }); }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  const { name, email, role, phone, password } = req.body;
  if (password) {
    await query('UPDATE users SET name=$1,email=$2,role=$3,phone=$4,password_hash=$5 WHERE id=$6 AND school_id=$7',
      [name, email.toLowerCase(), role, phone||null, bcrypt.hashSync(password,10), req.params.id, req.session.schoolId]);
  } else {
    await query('UPDATE users SET name=$1,email=$2,role=$3,phone=$4 WHERE id=$5 AND school_id=$6',
      [name, email.toLowerCase(), role, phone||null, req.params.id, req.session.schoolId]);
  }
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  if (req.params.id == req.session.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
  await query('DELETE FROM users WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  res.json({ ok: true });
});

app.patch('/api/trips/:id/per-diem', requireAuth, async (req, res) => {
  const { per_diem_rate } = req.body;
  await query('UPDATE trips SET per_diem_rate=$1 WHERE id=$2 AND school_id=$3', [per_diem_rate || null, req.params.id, req.session.schoolId]);
  res.json({ ok: true });
});

// ── Trip Share ────────────────────────────────────────────────────────────────
app.post('/api/trips/:id/share', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT share_token FROM trips WHERE id=$1 AND school_id=$2', [req.params.id, req.session.schoolId]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  let token = rows[0].share_token;
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    await query('UPDATE trips SET share_token=$1 WHERE id=$2', [token, req.params.id]);
  }
  res.json({ token, url: `${process.env.APP_URL || ''}/share/${token}` });
});

app.get('/api/share/:token', async (req, res) => {
  const { rows: trips } = await query(`SELECT t.*,s.name as sport_name,sc.name as school_name,sc.division FROM trips t JOIN sports s ON s.id=t.sport_id JOIN schools sc ON sc.id=t.school_id WHERE t.share_token=$1`, [req.params.token]);
  if (!trips[0]) return res.status(404).json({ error: 'Invalid or expired link' });
  const trip = trips[0];
  const [{ rows: manifest }, { rows: certs }] = await Promise.all([
    query(`SELECT a.name,a.student_id,a.year,a.eligibility_status,a.eligibility_note FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id WHERE tm.trip_id=$1 AND tm.status='confirmed' ORDER BY a.name`, [trip.id]),
    query(`SELECT state,cert_number,expiry_date,file_name FROM tax_certs WHERE school_id=$1 ORDER BY state`, [trip.school_id]),
  ]);
  res.json({ trip, manifest, certs });
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try { await query('SELECT 1'); res.json({ status: 'ok', ts: new Date().toISOString() }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});

app.get('/share/:token', (req, res) => {
  const token = req.params.token;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trip Info</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;min-height:100vh}
  .header{background:#0f172a;color:#fff;padding:16px 20px;display:flex;align-items:center;gap:10px}
  .logo{width:32px;height:32px;background:#059669;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .header h1{font-size:15px;font-weight:700;letter-spacing:.03em}
  .header p{font-size:11px;color:#94a3b8;margin-top:1px}
  .body{padding:16px;max-width:600px;margin:0 auto}
  .card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:14px;overflow:hidden}
  .card-head{padding:14px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between}
  .card-head h2{font-size:13px;font-weight:700;color:#0f172a}
  .card-body{padding:14px 16px}
  .meta-row{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid #f8fafc}
  .meta-row:last-child{border:none}
  .meta-label{color:#64748b}
  .meta-val{font-weight:600;text-align:right}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0}
  td{padding:9px 10px;border-bottom:1px solid #f1f5f9}
  tr:last-child td{border:none}
  tr.conflict td{background:#fff5f5}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
  .eligible{background:#d1fae5;color:#065f46}
  .ineligible{background:#fee2e2;color:#991b1b}
  .pending{background:#fef3c7;color:#92400e}
  .cert-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9}
  .cert-row:last-child{border:none}
  .cert-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
  .cert-active{background:#d1fae5;color:#065f46}
  .cert-expired{background:#fee2e2;color:#991b1b}
  .cert-expiring{background:#fef3c7;color:#92400e}
  .pulse{width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;margin-right:5px;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .updated{font-size:11px;color:#94a3b8;text-align:center;padding:12px}
  .err{padding:40px 20px;text-align:center;color:#64748b}
</style>
</head>
<body>
<div class="header">
  <div class="logo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
  <div><h1 id="trip-title">Loading…</h1><p id="trip-sub"></p></div>
</div>
<div class="body" id="body"><p class="err">Loading trip information…</p></div>
<div class="updated"><span class="pulse"></span><span id="last-updated">Connecting…</span></div>
<script>
const TOKEN = '${token}';
const today = new Date().toISOString().split('T')[0];
const in60 = new Date(Date.now()+60*86400000).toISOString().split('T')[0];
function fmt(d){if(!d)return '—';const p=d.split('T')[0].split('-');return p[1]+'/'+p[2]+'/'+p[0]}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

async function load(){
  try{
    const r=await fetch('/api/share/'+TOKEN);
    if(!r.ok){document.getElementById('body').innerHTML='<p class="err">This link is invalid or has been removed.</p>';return;}
    const {trip,manifest,certs}=await r.json();
    document.getElementById('trip-title').textContent=trip.name;
    document.getElementById('trip-sub').textContent=(trip.school_name||'')+(trip.division?' · '+trip.division:'')+(trip.sport_name?' · '+trip.sport_name:'');

    const charterCerts=certs.filter(c=>c.state?.toUpperCase()===trip.charter_state?.toUpperCase());
    const conflicts=manifest.filter(m=>m.eligibility_status!=='eligible');

    let certHtml='';
    if(!trip.charter_vendor){certHtml='<p style="color:#94a3b8;font-size:13px">No charter vendor set.</p>';}
    else if(charterCerts.length===0){certHtml='<div class="cert-row"><div class="cert-icon cert-expired">!</div><div><strong style="color:#dc2626">No cert on file for '+esc(trip.charter_state||'this state')+'</strong><div style="font-size:11px;color:#94a3b8">Contact your AD to add the certificate</div></div></div>';}
    else{certHtml=charterCerts.map(c=>{
      const exp=c.expiry_date&&c.expiry_date<today;
      const expiring=c.expiry_date&&!exp&&c.expiry_date<=in60;
      const cls=exp?'cert-expired':expiring?'cert-expiring':'cert-active';
      const icon=exp?'✕':expiring?'!':'✓';
      return '<div class="cert-row"><div class="cert-icon '+cls+'">'+icon+'</div><div><strong>'+esc(c.state)+' — '+(c.cert_number||'No cert #')+'</strong><div style="font-size:11px;color:#64748b">Expires '+fmt(c.expiry_date)+(exp?' <strong style=color:#dc2626>EXPIRED</strong>':expiring?' <strong style=color:#d97706>EXPIRING SOON</strong>':'')+'</div></div></div>';
    }).join('');}

    const allCerts=certs.filter(c=>c.state?.toUpperCase()!==trip.charter_state?.toUpperCase());
    if(allCerts.length>0){
      certHtml+='<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9"><p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin-bottom:6px">Other States on File</p>'+allCerts.map(c=>{
        const exp=c.expiry_date&&c.expiry_date<today;
        const cls=exp?'cert-expired':'cert-active';
        return '<div class="cert-row"><div class="cert-icon '+cls+'" style="width:22px;height:22px;font-size:10px">'+(exp?'✕':'✓')+'</div><div style="font-size:12px"><strong>'+esc(c.state)+'</strong>'+(c.cert_number?' — '+esc(c.cert_number):'')+'<span style="color:#94a3b8;margin-left:6px">exp '+fmt(c.expiry_date)+'</span></div></div>';
      }).join('')+'</div>';}

    document.getElementById('body').innerHTML=\`
      \${conflicts.length>0?'<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:13px;color:#991b1b"><strong>⚠ '+conflicts.length+' eligibility conflict'+(conflicts.length>1?'s':'')+' on manifest</strong><div style="margin-top:6px">'+conflicts.map(c=>'<div>'+esc(c.name)+' — '+c.eligibility_status+(c.eligibility_note?' ('+esc(c.eligibility_note)+')':'')+'</div>').join('')+'</div></div>':''}
      <div class="card">
        <div class="card-head"><h2>Trip Details</h2></div>
        <div class="card-body">
          <div class="meta-row"><span class="meta-label">Departs</span><span class="meta-val">\${fmt(trip.depart_date)}</span></div>
          \${trip.return_date?'<div class="meta-row"><span class="meta-label">Returns</span><span class="meta-val">'+fmt(trip.return_date)+'</span></div>':''}
          \${trip.destination?'<div class="meta-row"><span class="meta-label">Destination</span><span class="meta-val">'+esc(trip.destination)+'</span></div>':''}
          \${trip.opponent?'<div class="meta-row"><span class="meta-label">Opponent</span><span class="meta-val">'+esc(trip.opponent)+'</span></div>':''}
          \${trip.charter_vendor?'<div class="meta-row"><span class="meta-label">Charter</span><span class="meta-val">'+esc(trip.charter_vendor)+'</span></div>':''}
          \${trip.charter_amount?'<div class="meta-row"><span class="meta-label">Charter Amount</span><span class="meta-val">$'+Number(trip.charter_amount).toLocaleString()+'</span></div>':''}
          \${trip.per_diem_rate?'<div class="meta-row"><span class="meta-label">Per Diem</span><span class="meta-val" style="color:#059669">$'+Number(trip.per_diem_rate).toFixed(2)+'/day per athlete</span></div>':''}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Tax Exemption</h2></div>
        <div class="card-body" id="cert-live">\${certHtml}</div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Manifest</h2><span style="font-size:12px;color:#64748b">\${manifest.length} athletes</span></div>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>ID</th><th>Yr</th><th>Status</th></tr></thead>
          <tbody>\${manifest.map((m,i)=>'<tr class="'+(m.eligibility_status!=='eligible'?'conflict':'')+'">'+'<td style="color:#94a3b8">'+(i+1)+'</td><td style="font-weight:600">'+esc(m.name)+'</td><td style="font-family:monospace;font-size:11px;color:#64748b">'+esc(m.student_id||'—')+'</td><td style="color:#64748b">'+esc(m.year||'—')+'</td><td><span class="badge '+m.eligibility_status+'">'+m.eligibility_status+'</span></td></tr>').join('')}</tbody>
        </table>
      </div>\`;
    document.getElementById('last-updated').textContent='Live · Updated '+new Date().toLocaleTimeString();
  }catch(e){document.getElementById('last-updated').textContent='Connection error — retrying…';}
}
load();
setInterval(load,10000);
</script>
</body></html>`);
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[operation-pivot] running on :${PORT}`);
    console.log(`  AD login: admin@operationpivot.demo / pivot123`);
  });
}

start().catch(console.error);
