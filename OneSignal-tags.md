## Journaling tags – written by syncJournalTags in server/routes/
  notes.js whenever a note is created, updated, or deleted:
      - last_note_ts: Unix seconds for the most recent journal entry (or
  '' when none remain).
      - meditation_unlocked: 'true'/'false' indicating whether the user
  has unlocked meditations for the current week.
## Meditation generation tags – written in processMeditationJob (server/
  server.js) after the background job finishes:
      - last_meditation_generated_ts: current Unix time when the AI session is generated.
## Meditation completion tags – written in the completion route (server/
  routes/meditations.js) whenever a user finishes a meditation:
      - last_meditation_completed_ts: completion timestamp in Unix
  seconds.
      - has_unfinished_meditation
## Weekly progress tags – written by recomputeWeeklyProgress via cron and
  /internal/onesignal/sync-tags:
      - weekly_week_key: ISO week key (IYYY-IW) for the user’s current
  week.
      - weekly_week_start: Monday date for the tracked week (YYYY-MM-DD).
      - weekly_timezone: user timezone used for week calculations.
      - weekly_journal_count: journals logged in the week.
      - weekly_meditation_count: meditations completed in the week.
      - weekly_unlocks_remaining: journal entries needed before
  meditations unlock.
      - weekly_report_journal_remaining: journal entries needed before a
  weekly report is eligible.
      - weekly_report_meditation_remaining: meditations needed before a
  weekly report is eligible.
      - weekly_meditations_unlocked / weekly_report_ready /
  weekly_report_sent / weekly_report_eligible: boolean flags for the
  week.
      - weekly_next_report_at_utc / weekly_next_report_date: upcoming
  report schedules.
