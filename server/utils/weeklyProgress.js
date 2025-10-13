import {
  DEFAULT_TIMEZONE,
  computeNextReportAtUtc,
  getNextWeekStart,
  getUserTimezone,
  getWeekStart,
  normalizeTimezone
} from './week.js';

const JOURNAL_UNLOCK_THRESHOLD = 0;
const WEEKLY_JOURNAL_GOAL = 3;
const WEEKLY_MEDITATION_GOAL = 1;
const REPORT_JOURNAL_THRESHOLD = 5;
const REPORT_MEDITATION_THRESHOLD = 1;
const MAX_RETRY_ATTEMPTS = 5;

function determineReportScheduling({ record, journalCount, meditationCount, timezone, eventTimestamp }) {
  const reportProgress = computeReportProgress(journalCount, meditationCount);
  const shouldEnable = reportProgress.isEligible && !record.weekly_report_sent_at;
  const tz = normalizeTimezone(timezone);
  const scheduling = {
    eligible: shouldEnable,
    next_report_at_utc: shouldEnable ? computeNextReportAtUtc(record.week_start, tz) : null,
    claimed_at: null,
    retry_attempts: 0
  };

  if (shouldEnable && !record.weekly_report_ready_at) {
    scheduling.weekly_report_ready_at = eventTimestamp;
  }

  if (!shouldEnable && !reportProgress.isEligible && record.weekly_report_ready_at) {
    scheduling.weekly_report_ready_at = null;
  }

  return scheduling;
}

function computeReportProgress(journalCount, meditationCount) {
  const journalsNeededOnly = Math.max(REPORT_JOURNAL_THRESHOLD - journalCount, 0);
  const journalsNeededCombo = Math.max(WEEKLY_JOURNAL_GOAL - journalCount, 0);
  const medNeededCombo = Math.max(WEEKLY_MEDITATION_GOAL - meditationCount, 0);

  const meetsJournalOnly = journalsNeededOnly === 0;
  const meetsCombo = journalsNeededCombo === 0 && medNeededCombo === 0;

  const comboTaskCount = journalsNeededCombo + medNeededCombo;
  const journalOnlyTaskCount = journalsNeededOnly;
  const useComboPath = comboTaskCount === 0 ? true : comboTaskCount <= journalOnlyTaskCount;

  return {
    meetsJournalOnly,
    meetsCombo,
    isEligible: meetsJournalOnly || meetsCombo,
    reportJournalRemaining: useComboPath ? journalsNeededCombo : journalsNeededOnly,
    reportMeditationRemaining: useComboPath ? medNeededCombo : 0
  };
}

async function ensureWeeklyProgressRow(supabase, userId, weekStart, { timezone } = {}) {
  const { data: existing, error: fetchError } = await supabase
    .from('weekly_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (existing) {
    if (timezone && !existing.week_timezone) {
      const normalized = normalizeTimezone(timezone);
      await supabase
        .from('weekly_progress')
        .update({ week_timezone: normalized })
        .eq('user_id', userId)
        .eq('week_start', weekStart);
      existing.week_timezone = normalized;
    }
    return existing;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('weekly_progress')
    .insert({
      user_id: userId,
      week_start: weekStart,
      week_timezone: timezone ? normalizeTimezone(timezone) : null
    })
    .select()
    .single();

  if (insertError && insertError.code === '23505') {
    return ensureWeeklyProgressRow(supabase, userId, weekStart, { timezone });
  }

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

async function getWeeklyProgress({ supabase, userId, weekStart }) {
  const { data, error } = await supabase
    .from('weekly_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data ?? null;
}

async function getCurrentWeekProgress({ supabase, userId, referenceDate = new Date(), timezone }) {
  const tz = normalizeTimezone(timezone);
  const weekStart = getWeekStart(referenceDate, tz);
  const progress = await getWeeklyProgress({ supabase, userId, weekStart })
    ?? await ensureWeeklyProgressRow(supabase, userId, weekStart, { timezone: tz });

  return { progress, weekStart };
}

async function incrementJournalProgress({
  supabase,
  userId,
  eventTimestamp = new Date().toISOString(),
  noteDate,
  timezone
}) {
  const tz = normalizeTimezone(timezone);
  const weekStart = getWeekStart(noteDate ? new Date(noteDate) : new Date(), tz);
  const record = await ensureWeeklyProgressRow(supabase, userId, weekStart, { timezone: tz });

  const nextJournalCount = (record.journal_count ?? 0) + 1;
  const nextMeditationCount = record.meditation_count ?? 0;
  const updates = {
    journal_count: nextJournalCount,
    last_journal_at: eventTimestamp,
    updated_at: new Date().toISOString()
  };

  if (!record.meditations_unlocked_at && nextJournalCount >= JOURNAL_UNLOCK_THRESHOLD) {
    updates.meditations_unlocked_at = eventTimestamp;
  }

  Object.assign(updates, determineReportScheduling({
    record,
    journalCount: nextJournalCount,
    meditationCount: nextMeditationCount,
    timezone: tz,
    eventTimestamp
  }));

  const { data, error } = await supabase
    .from('weekly_progress')
    .update(updates)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function decrementJournalProgress({
  supabase,
  userId,
  eventTimestamp = new Date().toISOString(),
  noteDate,
  timezone
}) {
  const tz = normalizeTimezone(timezone);
  const weekStart = getWeekStart(noteDate ? new Date(noteDate) : new Date(), tz);
  const record = await ensureWeeklyProgressRow(supabase, userId, weekStart, { timezone: tz });

  const currentJournalCount = record.journal_count ?? 0;
  const nextJournalCount = Math.max(currentJournalCount - 1, 0);
  const nextMeditationCount = record.meditation_count ?? 0;

  const updates = {
    journal_count: nextJournalCount,
    updated_at: new Date().toISOString()
  };

  if (record.meditations_unlocked_at && nextJournalCount < JOURNAL_UNLOCK_THRESHOLD) {
    updates.meditations_unlocked_at = null;
  }

  Object.assign(updates, determineReportScheduling({
    record,
    journalCount: nextJournalCount,
    meditationCount: nextMeditationCount,
    timezone: tz,
    eventTimestamp
  }));

  const { data, error } = await supabase
    .from('weekly_progress')
    .update(updates)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function incrementMeditationProgress({
  supabase,
  userId,
  eventTimestamp = new Date().toISOString(),
  referenceDate,
  timezone
}) {
  const tz = normalizeTimezone(timezone);
  const weekStart = getWeekStart(referenceDate ? new Date(referenceDate) : new Date(), tz);
  const record = await ensureWeeklyProgressRow(supabase, userId, weekStart, { timezone: tz });

  const nextMeditationCount = (record.meditation_count ?? 0) + 1;
  const nextJournalCount = record.journal_count ?? 0;
  const updates = {
    meditation_count: nextMeditationCount,
    last_meditation_at: eventTimestamp,
    updated_at: new Date().toISOString()
  };

  Object.assign(updates, determineReportScheduling({
    record,
    journalCount: nextJournalCount,
    meditationCount: nextMeditationCount,
    timezone: tz,
    eventTimestamp
  }));

  const { data, error } = await supabase
    .from('weekly_progress')
    .update(updates)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function buildProgressSummary(progress, timezone = DEFAULT_TIMEZONE) {
  if (!progress) {
    return {
      weekStart: null,
      journalCount: 0,
      meditationCount: 0,
      meditationsUnlocked: true,
      reportReady: false,
      reportSent: false,
      timezone: normalizeTimezone(timezone),
      unlocksRemaining: Math.max(JOURNAL_UNLOCK_THRESHOLD, 0),
      reportJournalRemaining: WEEKLY_JOURNAL_GOAL,
      reportMeditationRemaining: WEEKLY_MEDITATION_GOAL,
      nextReportDate: null,
      eligible: false,
      nextReportAtUtc: null,
      weekTimezone: normalizeTimezone(timezone)
    };
  }

  const journalCount = progress.journal_count ?? 0;
  const meditationCount = progress.meditation_count ?? 0;
  const meditationsUnlocked = Boolean(progress.meditations_unlocked_at) || journalCount >= JOURNAL_UNLOCK_THRESHOLD;
  const reportProgress = computeReportProgress(journalCount, meditationCount);
  const reportReady = Boolean(progress.weekly_report_ready_at) || reportProgress.isEligible;
  const reportSent = Boolean(progress.weekly_report_sent_at);
  const tz = normalizeTimezone(timezone);
  const nextReportDate = getNextWeekStart(progress.week_start);

  return {
    weekStart: progress.week_start,
    journalCount,
    meditationCount,
    meditationsUnlocked,
    reportReady,
    reportSent,
    timezone: tz,
    unlocksRemaining: Math.max(JOURNAL_UNLOCK_THRESHOLD - journalCount, 0),
    reportJournalRemaining: reportProgress.reportJournalRemaining,
    reportMeditationRemaining: reportProgress.reportMeditationRemaining,
    nextReportDate,
    eligible: Boolean(progress.eligible),
    nextReportAtUtc: progress.next_report_at_utc ?? null,
    weekTimezone: progress.week_timezone ?? normalizeTimezone(timezone)
  };
}

function canAccessMeditations(progress) {
  if (!progress) {
    return true;
  }

  const journalCount = progress.journal_count ?? 0;
  return journalCount >= JOURNAL_UNLOCK_THRESHOLD;
}

function shouldQueueWeeklyReport(progress, _timezone = DEFAULT_TIMEZONE, now = new Date()) {
  if (!progress) {
    return false;
  }

  if (!progress.eligible || progress.weekly_report_sent_at) {
    return false;
  }

  if (!progress.next_report_at_utc) {
    return false;
  }

  return new Date(progress.next_report_at_utc).getTime() <= now.getTime();
}

async function markWeeklyReportSent({ supabase, userId, weekStart, sentAt = new Date().toISOString(), messageId, subject }) {
  const updates = {
    weekly_report_sent_at: sentAt,
    updated_at: new Date().toISOString(),
    eligible: false,
    next_report_at_utc: null,
    claimed_at: null,
    retry_attempts: 0
  };

  const { data, error } = await supabase
    .from('weekly_progress')
    .update(updates)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    progress: data,
    reportMetadata: {
      messageId: messageId ?? null,
      subject: subject ?? null,
      sentAt
    }
  };
}

async function loadUserTimezone({ supabase, userId }) {
  return getUserTimezone(supabase, userId);
}

export {
  JOURNAL_UNLOCK_THRESHOLD,
  WEEKLY_JOURNAL_GOAL,
  WEEKLY_MEDITATION_GOAL,
  REPORT_JOURNAL_THRESHOLD,
  REPORT_MEDITATION_THRESHOLD,
  buildProgressSummary,
  canAccessMeditations,
  getCurrentWeekProgress,
  incrementJournalProgress,
  decrementJournalProgress,
  incrementMeditationProgress,
  loadUserTimezone,
  markWeeklyReportSent,
  shouldQueueWeeklyReport,
  MAX_RETRY_ATTEMPTS
};
