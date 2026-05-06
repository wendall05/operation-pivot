/**
 * Operation Pivot — Game Day Eligibility Engine
 * Period-by-period SIS attendance → game-day clearance
 * SIS/GPS conflict resolution (bus scan overrides absent)
 */

const { query } = require('./db');

async function checkGameDayEligibility(gameEventId, schoolId, checkSource = 'manual') {
  const gameR = await query(`
    SELECT ge.*, sp.name AS sport_name, sp.head_coach,
           COALESCE(ge.periods_required, 4) AS eff_required,
           COALESCE(ge.periods_total, 7) AS eff_total
    FROM game_events ge
    JOIN sports sp ON sp.id = ge.sport_id
    WHERE ge.id = $1 AND ge.school_id = $2
  `, [gameEventId, schoolId]);

  if (!gameR.rows.length) throw new Error(`Game event ${gameEventId} not found`);
  const game = gameR.rows[0];

  const athletesR = await query(`
    SELECT a.id, a.name AS athlete_name, a.student_id, a.year, a.gender,
           a.eligibility_status, a.eligibility_note, a.sport_id
    FROM athletes a
    WHERE a.sport_id = $1 AND a.school_id = $2
  `, [game.sport_id, schoolId]);

  const results = [];
  const redFlags = [];

  for (const athlete of athletesR.rows) {
    const result = await checkAthleteEligibility(athlete, game, checkSource);
    results.push(result);
    if (!result.is_cleared && !result.conflict_flag) redFlags.push(result);
  }

  if (redFlags.length > 0) {
    const coachR = await query(`SELECT id FROM users WHERE school_id=$1 AND sport_id=$2 AND role='coach' LIMIT 1`, [schoolId, game.sport_id]);
    if (coachR.rows[0]) await notifyCoach(coachR.rows[0].id, redFlags, gameEventId);
  }

  const cleared   = results.filter(r => r.is_cleared === true).length;
  const blocked   = results.filter(r => r.is_cleared === false).length;
  const conflicts = results.filter(r => r.conflict_flag && !r.conflict_resolved).length;

  return {
    game_event_id: gameEventId,
    sport: game.sport_name,
    opponent: game.opponent,
    game_date: game.game_date,
    game_time: game.game_time,
    check_time: new Date().toISOString(),
    check_source: checkSource,
    total_athletes: results.length,
    cleared, blocked, conflicts,
    cleared_pct: results.length > 0 ? Math.round(cleared / results.length * 100) : 0,
    results,
  };
}

async function checkAthleteEligibility(athlete, game, checkSource) {
  const periodsRequired = parseInt(game.eff_required);
  const periodsTotal    = parseInt(game.eff_total);

  const periodsR = await query(`
    SELECT period_number, status FROM attendance_periods
    WHERE athlete_id = $1 AND date = $2
    ORDER BY period_number ASC
  `, [athlete.id, game.game_date]);

  let periodsAttended = 0;
  const hasPeriodData = periodsR.rows.length > 0;

  if (hasPeriodData) {
    periodsAttended = periodsR.rows.filter(p => p.status === 'present' || p.status === 'tardy').length;
  }

  const conflict = await detectConflict(athlete.id, game.game_date);

  let isCleared = periodsAttended >= periodsRequired;
  let blockedReason = null;

  if (conflict && conflict.type === 'sis_absent_gps_present') {
    isCleared = true;
    blockedReason = null;
  }

  if (!isCleared) {
    blockedReason = `${periodsAttended} of ${periodsTotal} periods attended — need ${periodsRequired}`;
  }

  await query(`
    INSERT INTO game_day_eligibility
      (game_event_id, athlete_id, is_cleared, periods_attended, periods_required, periods_total,
       conflict_flag, conflict_type, conflict_data, last_checked_at, check_source, cleared_at, blocked_reason)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11,$12)
    ON CONFLICT (game_event_id, athlete_id) DO UPDATE SET
      is_cleared       = EXCLUDED.is_cleared,
      periods_attended = EXCLUDED.periods_attended,
      conflict_flag    = EXCLUDED.conflict_flag,
      conflict_type    = EXCLUDED.conflict_type,
      conflict_data    = EXCLUDED.conflict_data,
      last_checked_at  = NOW(),
      check_source     = EXCLUDED.check_source,
      cleared_at       = CASE WHEN EXCLUDED.is_cleared THEN NOW() ELSE NULL END,
      blocked_reason   = EXCLUDED.blocked_reason
  `, [
    game.id, athlete.id, isCleared, periodsAttended, periodsRequired, periodsTotal,
    !!conflict, conflict?.type || null,
    conflict ? JSON.stringify(conflict) : null,
    checkSource,
    isCleared ? new Date().toISOString() : null,
    blockedReason,
  ]);

  return {
    athlete_id: athlete.id,
    athlete_name: athlete.athlete_name,
    student_id: athlete.student_id,
    year: athlete.year,
    is_cleared: isCleared,
    periods_attended: periodsAttended,
    periods_required: periodsRequired,
    periods_total: periodsTotal,
    has_period_data: hasPeriodData,
    conflict_flag: !!conflict,
    conflict_type: conflict?.type || null,
    conflict_resolved: false,
    blocked_reason: blockedReason,
    eligibility_status: athlete.eligibility_status,
  };
}

async function detectConflict(athleteId, gameDate) {
  const [busR] = await Promise.all([
    query(`
      SELECT bs.scanned_at, br.route_name FROM bus_scans bs
      JOIN bus_routes br ON br.id = bs.route_id
      WHERE bs.athlete_id = $1 AND bs.scanned_at::date = $2 AND bs.scan_type = 'board'
      ORDER BY bs.scanned_at DESC LIMIT 1
    `, [athleteId, gameDate]),
  ]);

  const onBus = busR.rows.length > 0;
  const periodsR = await query(`SELECT status FROM attendance_periods WHERE athlete_id=$1 AND date=$2 ORDER BY period_number ASC LIMIT 1`, [athleteId, gameDate]);
  const sisAbsent = periodsR.rows[0]?.status === 'absent';

  if (onBus && sisAbsent) {
    return {
      type: 'sis_absent_gps_present',
      bus_scan_time: busR.rows[0].scanned_at,
      route: busR.rows[0].route_name,
      sis_status: 'absent',
      resolution: 'auto_cleared',
      reason: 'Athlete scanned onto team bus — school-sanctioned activity',
    };
  }
  return null;
}

async function notifyCoach(coachId, redFlags, gameEventId) {
  for (const athlete of redFlags) {
    const message = `⚠️ ${athlete.athlete_name} NOT cleared — ${athlete.blocked_reason}`;
    await query(`
      INSERT INTO coach_notifications (coach_id, athlete_id, game_event_id, type, message)
      VALUES ($1,$2,$3,'red_flag',$4)
      ON CONFLICT DO NOTHING
    `, [coachId, athlete.athlete_id, gameEventId, message]).catch(() => {});
  }
}

async function getTeamReadiness(schoolId, date) {
  const targetDate = date || new Date().toISOString().split('T')[0];

  const r = await query(`
    SELECT
      ge.id AS game_event_id,
      ge.opponent,
      ge.game_time,
      ge.location,
      ge.is_home,
      ge.status,
      sp.id AS sport_id,
      sp.name AS sport_name,
      sp.name AS team_name,
      COUNT(DISTINCT a.id)                                                      AS total_athletes,
      COUNT(DISTINCT a.id) FILTER (WHERE gde.is_cleared = true)                AS cleared,
      COUNT(DISTINCT a.id) FILTER (WHERE gde.is_cleared = false)               AS blocked,
      COUNT(DISTINCT a.id) FILTER (WHERE gde.conflict_flag AND NOT COALESCE(gde.conflict_resolved,false)) AS conflicts,
      COUNT(DISTINCT a.id) FILTER (WHERE gde.is_cleared IS NULL)               AS unchecked,
      MAX(gde.last_checked_at)                                                  AS last_checked_at
    FROM game_events ge
    JOIN sports sp ON sp.id = ge.sport_id
    LEFT JOIN athletes a ON a.sport_id = sp.id AND a.school_id = ge.school_id
    LEFT JOIN game_day_eligibility gde ON gde.game_event_id = ge.id AND gde.athlete_id = a.id
    WHERE ge.school_id = $1 AND ge.game_date = $2 AND ge.status != 'cancelled'
    GROUP BY ge.id, sp.id
    ORDER BY ge.game_time ASC NULLS LAST
  `, [schoolId, targetDate]);

  return r.rows.map(row => ({
    ...row,
    total_athletes: parseInt(row.total_athletes),
    cleared: parseInt(row.cleared),
    blocked: parseInt(row.blocked),
    conflicts: parseInt(row.conflicts),
    unchecked: parseInt(row.unchecked),
    cleared_pct: parseInt(row.total_athletes) > 0
      ? Math.round(parseInt(row.cleared) / parseInt(row.total_athletes) * 100)
      : 0,
  }));
}

async function getGameRoster(gameEventId, schoolId) {
  const r = await query(`
    SELECT
      a.id AS athlete_id,
      a.name AS athlete_name,
      a.student_id,
      a.year,
      a.gender,
      a.eligibility_status,
      a.eligibility_note,
      gde.id AS eligibility_id,
      gde.is_cleared,
      gde.periods_attended,
      gde.periods_required,
      gde.periods_total,
      gde.conflict_flag,
      gde.conflict_type,
      gde.conflict_resolved,
      gde.conflict_resolution,
      gde.conflict_data,
      gde.blocked_reason,
      gde.last_checked_at
    FROM athletes a
    JOIN game_events ge ON ge.sport_id = a.sport_id AND ge.school_id = a.school_id
    LEFT JOIN game_day_eligibility gde ON gde.game_event_id = ge.id AND gde.athlete_id = a.id
    WHERE ge.id = $1 AND ge.school_id = $2
    ORDER BY
      CASE WHEN gde.is_cleared = false AND NOT COALESCE(gde.conflict_flag,false) THEN 0
           WHEN gde.conflict_flag AND NOT COALESCE(gde.conflict_resolved,false) THEN 1
           WHEN gde.is_cleared = true THEN 2
           ELSE 3 END,
      a.name ASC
  `, [gameEventId, schoolId]);

  return r.rows;
}

async function resolveConflict(eligibilityId, resolution, resolvedByUserId) {
  const isCleared = resolution === 'override_cleared';
  const r = await query(`
    UPDATE game_day_eligibility SET
      conflict_resolved    = true,
      conflict_resolved_by = $1,
      conflict_resolved_at = NOW(),
      conflict_resolution  = $2,
      is_cleared           = $3,
      cleared_at           = $4,
      blocked_reason       = CASE WHEN $3 THEN NULL ELSE blocked_reason END
    WHERE id = $5
    RETURNING game_event_id, athlete_id
  `, [resolvedByUserId, resolution, isCleared, isCleared ? new Date() : null, eligibilityId]);
  return { id: eligibilityId, resolved: true, is_cleared: isCleared, ...r.rows[0] };
}

async function runEligibilityPulse(source) {
  const today = new Date().toISOString().split('T')[0];
  const gamesR = await query(`SELECT ge.id, ge.school_id FROM game_events ge WHERE ge.game_date = $1 AND ge.status IN ('scheduled','active')`, [today]);
  const results = [];
  for (const game of gamesR.rows) {
    try {
      const r = await checkGameDayEligibility(game.id, game.school_id, source);
      results.push({ game_id: game.id, ok: true, summary: r });
      console.log(`[eligibility] ${source} — Game ${game.id}: ${r.cleared}/${r.total_athletes} cleared`);
    } catch (e) {
      console.error(`[eligibility] pulse failed game ${game.id}:`, e.message);
      results.push({ game_id: game.id, ok: false, error: e.message });
    }
  }
  return results;
}

module.exports = { checkGameDayEligibility, getTeamReadiness, getGameRoster, resolveConflict, runEligibilityPulse };
