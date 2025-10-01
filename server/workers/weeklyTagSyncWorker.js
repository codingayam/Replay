import { normalizeTimezone, DEFAULT_TIMEZONE } from '../utils/week.js';
import { getIsoWeekKeyForDate, recomputeWeeklyProgress, hoursSince } from '../utils/weeklyTagSync.js';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_STALE_HOURS = 6;
const CANDIDATE_MULTIPLIER = 4;

function parseDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}


export function createWeeklyTagSyncWorker({
  supabase,
  batchSize = DEFAULT_BATCH_SIZE,
  staleHours = DEFAULT_STALE_HOURS,
  recompute = recomputeWeeklyProgress,
  logger = console
}) {
  if (!supabase) {
    throw new Error('Supabase client is required for weekly tag sync worker');
  }

  async function fetchCandidateRows(limit) {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, timezone, last_tag_week_key, last_tag_sync_at')
      .order('last_tag_sync_at', { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async function run({ now = new Date() } = {}) {
    const scanLimit = Math.max(batchSize * CANDIDATE_MULTIPLIER, batchSize);
    const rows = await fetchCandidateRows(scanLimit);

    const eligible = [];
    for (const row of rows) {
      const timezone = normalizeTimezone(row.timezone ?? DEFAULT_TIMEZONE);
      const currentWeekKey = getIsoWeekKeyForDate(now, timezone);
      const lastSyncedWeek = row.last_tag_week_key ?? null;
      const lastSyncDate = parseDate(row.last_tag_sync_at);
      const stale = hoursSince(lastSyncDate, now) >= staleHours;
      const needsWeekRollover = currentWeekKey !== lastSyncedWeek;

      if (needsWeekRollover || stale) {
        eligible.push({ ...row, timezone });
      }

      if (eligible.length >= batchSize) {
        break;
      }
    }

    let updated = 0;
    let skipped = 0;
    let failures = 0;

    for (const row of eligible) {
      try {
        const result = await recompute({
          supabase,
          userId: row.user_id,
          now,
          timezone: row.timezone,
          logger
        });
        if (result.updated) {
          updated += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        failures += 1;
        logger.error?.('Weekly tag sync worker failed for user', {
          userId: row.user_id,
          error: error instanceof Error ? error.message : error
        });
      }
    }

    const summary = {
      scanned: rows.length,
      eligible: eligible.length,
      updated,
      skipped,
      failures,
      timestamp: now.toISOString()
    };

    if (eligible.length === 0) {
      logger.debug?.('Weekly tag sync worker found no eligible users', summary);
    } else {
      logger.info?.('Weekly tag sync worker run complete', summary);
      if (updated === 0) {
        logger.warn?.('Weekly tag sync worker updated zero users this run', summary);
      }
    }

    return summary;
  }

  return { run };
}

export default { createWeeklyTagSyncWorker };
