/**
 * Operation Pivot — Academic Risk Sync
 * Pulls grade/attendance data from SchoolBridge bridge API.
 * Flags athletes at academic risk and notifies their coaches before ineligibility hits.
 *
 * Risk levels:
 *   safe     — avg ≥ 70%, < 3 missing assignments, attendance ≥ 80%
 *   warning  — avg 60–69% OR 3–4 missing assignments OR attendance 70–79%
 *   critical — avg < 60% OR 5+ missing assignments OR will be ineligible next grading period
 */

const { query } = require('./db');

const SB_URL = process.env.SCHOOLBRIDGE_URL || '';
const BRIDGE_KEY = process.env.BRIDGE_API_KEY || '';

async function syncAcademicStatus() {
  if (!SB_URL || !BRIDGE_KEY) {
    console.log('[academic-sync] SCHOOLBRIDGE_URL or BRIDGE_API_KEY not set — skipping');
    return;
  }

  console.log('[academic-sync] Starting academic risk sync from SchoolBridge…');

  // Get all active athletes with their schoolbridge_student_id or name for matching
  const athletesR = await query(`
    SELECT a.id, a.name, a.schoolbridge_student_id, a.sport_id, a.school_id,
           a.academic_risk_level
    FROM athletes a
    WHERE a.school_id IS NOT NULL
  `);

  if (!athletesR.rows.length) return;

  // Build request: prefer ID match, fall back to name
  const withIds   = athletesR.rows.filter(a => a.schoolbridge_student_id);
  const withNames = athletesR.rows.filter(a => !a.schoolbridge_student_id);

  let academicData = [];

  if (withIds.length) {
    const ids = withIds.map(a => a.schoolbridge_student_id).join(',');
    const r = await fetchBridge(`/academic-status?student_ids=${encodeURIComponent(ids)}`);
    if (r) academicData = academicData.concat(r);
  }

  if (withNames.length) {
    const names = withNames.map(a => a.name).join(',');
    const r = await fetchBridge(`/academic-status?names=${encodeURIComponent(names)}`);
    if (r) academicData = academicData.concat(r);
  }

  if (!academicData.length) {
    console.log('[academic-sync] No academic data returned from SchoolBridge');
    return;
  }

  // Build lookup map: name → academic data
  const byName = {};
  const byId   = {};
  for (const d of academicData) {
    byName[d.student_name?.toLowerCase()] = d;
    if (d.student_id) byId[d.student_id] = d;
  }

  let flagged = 0;

  for (const athlete of athletesR.rows) {
    const data = byId[athlete.schoolbridge_student_id] || byName[athlete.name?.toLowerCase()];
    if (!data) continue;

    const prevRisk = athlete.academic_risk_level || 'safe';
    const newRisk  = data.risk_level;

    // Update athlete academic status
    await query(`
      UPDATE athletes SET
        academic_risk_level  = $1,
        academic_risk_data   = $2,
        academic_synced_at   = NOW()
      WHERE id = $3
    `, [newRisk, JSON.stringify(data), athlete.id]);

    // Notify coach only when risk level worsens (safe→warning, warning→critical, safe→critical)
    const riskWorsened = (prevRisk === 'safe' && (newRisk === 'warning' || newRisk === 'critical'))
                      || (prevRisk === 'warning' && newRisk === 'critical');

    if (riskWorsened) {
      flagged++;
      await notifyCoachAcademicRisk(athlete, data);
      console.log(`[academic-sync] ${athlete.name} flagged ${prevRisk} → ${newRisk}: ${data.risk_reasons.join('; ')}`);
    }
  }

  console.log(`[academic-sync] Sync complete — ${academicData.length} athletes checked, ${flagged} newly flagged`);
}

async function fetchBridge(path) {
  try {
    const res = await fetch(`${SB_URL}/api/bridge${path}`, {
      headers: { 'x-bridge-api-key': BRIDGE_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[academic-sync] Bridge error ${res.status}: ${await res.text()}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('[academic-sync] Bridge fetch failed:', e.message);
    return null;
  }
}

async function notifyCoachAcademicRisk(athlete, data) {
  // Find coach for this sport
  const coachR = await query(`
    SELECT id FROM users WHERE sport_id = $1 AND role = 'coach' LIMIT 1
  `, [athlete.sport_id]);

  const emoji = data.risk_level === 'critical' ? '🚨' : '⚠️';
  const levelLabel = data.risk_level === 'critical' ? 'CRITICAL academic risk' : 'Academic warning';
  const reasons = data.risk_reasons.join(' · ');

  const message = `${emoji} ${athlete.name} — ${levelLabel}: ${reasons}. Intervene now to prevent ineligibility.`;

  if (coachR.rows[0]) {
    await query(`
      INSERT INTO coach_notifications (coach_id, athlete_id, game_event_id, type, message)
      VALUES ($1, $2, NULL, 'academic_risk', $3)
      ON CONFLICT DO NOTHING
    `, [coachR.rows[0].id, athlete.id, message]).catch(() => {});
  }

  // Also notify all admins
  const adminsR = await query(`SELECT id FROM users WHERE school_id=$1 AND role='admin'`, [athlete.school_id]);
  for (const admin of adminsR.rows) {
    await query(`
      INSERT INTO coach_notifications (coach_id, athlete_id, game_event_id, type, message)
      VALUES ($1, $2, NULL, 'academic_risk', $3)
      ON CONFLICT DO NOTHING
    `, [admin.id, athlete.id, message]).catch(() => {});
  }
}

module.exports = { syncAcademicStatus };
