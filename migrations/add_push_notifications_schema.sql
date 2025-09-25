-- Placeholder schema used for tests to ensure required objects exist.

CREATE TABLE IF NOT EXISTS notification_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fcm_token TEXT,
  apns_web_token TEXT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type TEXT NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  days_of_week integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]
);

ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
