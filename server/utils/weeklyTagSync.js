import { createHash } from 'node:crypto';

import {
  buildProgressSummary as buildProgressSummaryDefault,
  getCurrentWeekProgress as getCurrentWeekProgressDefault,
  loadUserTimezone as loadUserTimezoneDefault
} from './weeklyProgress.js';
import { normalizeTimezone, getLocalDateParts, getWeekStart, DEFAULT_TIMEZONE } from './week.js';
import { updateOneSignalUser as updateOneSignalUserDefault } from './onesignal.js';

const MS_PER_HOUR = 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

function computeIsoWeekKeyFromDate(dateUtcMidnight) {
  const dayNumber = (dateUtcMidnight.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(dateUtcMidnight);
  thursday.setUTCDate(thursday.getUTCDate() + 3 - dayNumber);

  const weekYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstThursdayDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - firstThursdayDayNumber);

  const diffWeeks = Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weekNumber = 1 + diffWeeks;

  return `${weekYear}-${pad(weekNumber)}`;
}

function parseWeekStartToDate(weekStart) {
  if (!weekStart) {
    return null;
  }
  const [year, month, day] = weekStart.split('-').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function getIsoWeekKeyForDate(date, timezone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimezone(timezone);
  const { year, month, day } = getLocalDateParts(date, tz);
  const localMidnightUtc = new Date(Date.UTC(year, month - 1, day));
  return computeIsoWeekKeyFromDate(localMidnightUtc);
}

export function getIsoWeekKeyFromWeekStart(weekStart) {
  const date = parseWeekStartToDate(weekStart);
  if (!date) {
    return 'unknown-week';
  }
  return computeIsoWeekKeyFromDate(date);
}

function buildWeeklyTagPayload({ summary, weekKey, timezone }) {
  const tags = {
    weekly_week_key: weekKey,
    weekly_week_start: summary.weekStart ?? '',
    weekly_timezone: timezone,
    weekly_journal_count: summary.journalCount ?? 0,
    weekly_meditation_count: summary.meditationCount ?? 0,
    weekly_unlocks_remaining: summary.unlocksRemaining ?? 0,
    weekly_report_journal_remaining: summary.reportJournalRemaining ?? 0,
    weekly_report_meditation_remaining: summary.reportMeditationRemaining ?? 0,
    weekly_meditations_unlocked: summary.meditationsUnlocked ? 'true' : 'false',
    weekly_report_ready: summary.reportReady ? 'true' : 'false',
    weekly_report_sent: summary.reportSent ? 'true' : 'false',
    weekly_report_eligible: summary.eligible ? 'true' : 'false',
    weekly_next_report_at_utc: summary.nextReportAtUtc ?? '',
    weekly_next_report_date: summary.nextReportDate ?? ''
  };

  const serialized = Object.fromEntries(
    Object.entries(tags).map(([key, value]) => [key, value == null ? undefined : String(value)])
  );

  return serialized;
}

async function upsertTagState({ supabase, userId, profile, payload }) {
  if (profile) {
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .insert([{ user_id: userId, ...payload }]);

  if (error && error.code === '23505') {
    await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', userId);
    return;
  }

  if (error) {
    throw error;
  }
}

export async function recomputeWeeklyProgress({
  supabase,
  userId,
  now = new Date(),
  timezone,
  overrides = {},
  logger = console
}) {
  if (!supabase) {
    throw new Error('Supabase client is required for recomputeWeeklyProgress');
  }

  if (!userId) {
    throw new Error('userId is required for recomputeWeeklyProgress');
  }

  const loadUserTimezone = overrides.loadUserTimezone ?? loadUserTimezoneDefault;
  const getCurrentWeekProgress = overrides.getCurrentWeekProgress ?? getCurrentWeekProgressDefault;
  const buildProgressSummary = overrides.buildProgressSummary ?? buildProgressSummaryDefault;
  const updateOneSignalUser = overrides.updateOneSignalUser ?? updateOneSignalUserDefault;

  const timezoneToUse = normalizeTimezone(
    timezone
      ?? (await loadUserTimezone({ supabase, userId }))
      ?? DEFAULT_TIMEZONE
  );

  const { progress, weekStart } = await getCurrentWeekProgress({
    supabase,
    userId,
    referenceDate: now,
    timezone: timezoneToUse
  });

  const summary = buildProgressSummary(progress, timezoneToUse);
  const resolvedWeekStart = summary.weekStart ?? weekStart ?? getWeekStart(now, timezoneToUse);
  const weekKey = getIsoWeekKeyFromWeekStart(resolvedWeekStart);
  const tags = buildWeeklyTagPayload({ summary, weekKey, timezone: timezoneToUse });

  const hashValue = createHash('sha256')
    .update(JSON.stringify({ weekKey, tags }))
    .digest('hex');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('last_tag_week_key, last_tag_hash, last_tag_sync_at, timezone')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    throw profileError;
  }

  const unchanged = Boolean(profile)
    && profile.last_tag_week_key === weekKey
    && profile.last_tag_hash === hashValue;

  const syncedAt = now.toISOString();

  if (!unchanged) {
    try {
      await updateOneSignalUser(userId, tags);
    } catch (error) {
      logger.error?.('[OneSignal] weekly tag sync failed', {
        userId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  await upsertTagState({
    supabase,
    userId,
    profile,
    payload: {
      last_tag_week_key: weekKey,
      last_tag_hash: hashValue,
      last_tag_sync_at: syncedAt,
      timezone: profile?.timezone ?? timezoneToUse
    }
  });

  return {
    userId,
    weekKey,
    tags,
    summary,
    updated: !unchanged,
    lastSyncAt: syncedAt
  };
}

export function hoursSince(date, now = new Date()) {
  if (!date) {
    return Infinity;
  }
  return (now.getTime() - date.getTime()) / MS_PER_HOUR;
}

export default {
  recomputeWeeklyProgress,
  getIsoWeekKeyForDate,
  getIsoWeekKeyFromWeekStart,
  hoursSince
};
