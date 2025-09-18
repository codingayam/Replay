-- Migration: Notification operations and monitoring support
BEGIN;

CREATE TABLE IF NOT EXISTS notification_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification JSONB NOT NULL,
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_scheduled_at
  ON notification_retry_queue(scheduled_at ASC);

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_source TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_events_created_at
  ON notification_events(created_at DESC);

CREATE OR REPLACE FUNCTION set_notification_retry_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_retry_queue_set_updated_at ON notification_retry_queue;
CREATE TRIGGER notification_retry_queue_set_updated_at
  BEFORE UPDATE ON notification_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION set_notification_retry_queue_updated_at();

GRANT ALL ON notification_retry_queue TO service_role;
GRANT ALL ON notification_events TO service_role;

COMMIT;
