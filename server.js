require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, initDb } = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

app.set('trust proxy', 1);
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
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, school_id: user.school_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/auth/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id,name,email,role,school_id,phone FROM users WHERE id=$1', [req.session.userId]);
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
  if (sport_id) { sql += ` AND a.sport_id=$${params.length+1}`; params.push(sport_id); }
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
  if (sport_id) { sql += ` AND t.sport_id=$${params.length+1}`; params.push(sport_id); }
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

  const [r1,r2,r3,r4,r5,r6,r7] = await Promise.all([
    query(`SELECT COUNT(*) as n FROM trips WHERE school_id=$1 AND depart_date>=$2`, [sid,today]),
    query(`SELECT COUNT(DISTINCT tm.id) as n FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id JOIN trips t ON t.id=tm.trip_id WHERE t.school_id=$1 AND tm.status='confirmed' AND a.eligibility_status!='eligible' AND t.depart_date>=$2`, [sid,today]),
    query(`SELECT COUNT(*) as n FROM tax_certs WHERE school_id=$1 AND expiry_date BETWEEN $2 AND $3`, [sid,today,in60]),
    query(`SELECT COUNT(*) as n FROM athletes WHERE school_id=$1 AND eligibility_status='ineligible'`, [sid]),
    query(`SELECT t.*,s.name as sport_name,(SELECT COUNT(*) FROM trip_manifest tm WHERE tm.trip_id=t.id AND tm.status='confirmed') as manifest_count,(SELECT COUNT(*) FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id WHERE tm.trip_id=t.id AND tm.status='confirmed' AND a.eligibility_status!='eligible') as conflict_count FROM trips t LEFT JOIN sports s ON s.id=t.sport_id WHERE t.school_id=$1 AND t.depart_date>=$2 ORDER BY t.depart_date LIMIT 5`, [sid,today]),
    query(`SELECT a.name as athlete_name,a.eligibility_status,a.eligibility_note,t.name as trip_name,t.depart_date,t.id as trip_id FROM trip_manifest tm JOIN athletes a ON a.id=tm.athlete_id JOIN trips t ON t.id=tm.trip_id WHERE t.school_id=$1 AND tm.status='confirmed' AND a.eligibility_status!='eligible' AND t.depart_date>=$2 ORDER BY t.depart_date`, [sid,today]),
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

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try { await query('SELECT 1'); res.json({ status: 'ok', ts: new Date().toISOString() }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
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
