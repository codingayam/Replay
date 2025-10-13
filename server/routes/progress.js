import {
  JOURNAL_UNLOCK_THRESHOLD,
  WEEKLY_JOURNAL_GOAL,
  WEEKLY_MEDITATION_GOAL,
  REPORT_JOURNAL_THRESHOLD,
  REPORT_MEDITATION_THRESHOLD,
  buildProgressSummary as buildProgressSummaryDefault,
  getCurrentWeekProgress as getCurrentWeekProgressDefault,
  loadUserTimezone as loadUserTimezoneDefault
} from '../utils/weeklyProgress.js';

import { DEFAULT_TIMEZONE } from '../utils/week.js';

function parseReferenceDate(value) {
  if (!value) {
    return { date: new Date(), error: null };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: null, error: 'Invalid date parameter' };
  }

  return { date: parsed, error: null };
}

export function registerProgressRoutes(deps) {
  const { app, requireAuth, supabase, weeklyProgressOverrides = {} } = deps;

  const loadUserTimezone = weeklyProgressOverrides.loadUserTimezone ?? loadUserTimezoneDefault;
  const getCurrentWeekProgress = weeklyProgressOverrides.getCurrentWeekProgress ?? getCurrentWeekProgressDefault;
  const buildProgressSummary = weeklyProgressOverrides.buildProgressSummary ?? buildProgressSummaryDefault;

  app.get('/api/progress/week', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { date: referenceDate, error: dateError } = parseReferenceDate(req.query.date);

      if (dateError) {
        return res.status(400).json({ error: dateError });
      }

      const timezone = await loadUserTimezone({ supabase, userId }) ?? DEFAULT_TIMEZONE;
      const { progress, weekStart } = await getCurrentWeekProgress({
        supabase,
        userId,
        referenceDate,
        timezone
      });

      const weeklyProgress = buildProgressSummary(progress, timezone);

      res.json({
        weekStart,
        timezone,
        weeklyProgress,
        thresholds: {
          unlockMeditations: JOURNAL_UNLOCK_THRESHOLD,
          weeklyJournals: WEEKLY_JOURNAL_GOAL,
          weeklyMeditations: WEEKLY_MEDITATION_GOAL,
          reportJournals: REPORT_JOURNAL_THRESHOLD,
          reportMeditations: REPORT_MEDITATION_THRESHOLD
        }
      });
    } catch (error) {
      console.error('Weekly progress route error:', error);
      res.status(500).json({ error: 'Failed to load weekly progress' });
    }
  });

  app.get('/api/progress/history', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const weeksParam = Number.parseInt(req.query.weeks ?? '8', 10);
      const weeks = Number.isNaN(weeksParam) ? 8 : Math.min(Math.max(weeksParam, 1), 26);

      const timezone = await loadUserTimezone({ supabase, userId }) ?? DEFAULT_TIMEZONE;

      const { data, error } = await supabase
        .from('weekly_progress')
        .select('*')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(weeks);

      if (error) {
        console.error('Weekly progress history error:', error);
        return res.status(500).json({ error: 'Failed to load progress history' });
      }

      const entries = (data || []).map((row) => buildProgressSummary(row, timezone));

      res.json({
        timezone,
        entries,
        requestedWeeks: weeks
      });
    } catch (error) {
      console.error('Progress history route error:', error);
      res.status(500).json({ error: 'Failed to load progress history' });
    }
  });
}

export default registerProgressRoutes;
