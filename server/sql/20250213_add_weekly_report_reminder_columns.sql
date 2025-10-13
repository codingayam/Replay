-- Adds reminder tracking columns for weekly report nudges.
ALTER TABLE weekly_progress
  ADD COLUMN IF NOT EXISTS week_timezone text,
  ADD COLUMN IF NOT EXISTS weekly_report_reminder_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS weekly_report_reminder_sent_at timestamptz;
