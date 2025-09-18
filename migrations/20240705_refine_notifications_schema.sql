-- Migration: Refine notification schema to dedicated tables
BEGIN;

-- Ensure pgcrypto is available for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure notification preferences table exists with required structure
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure notification devices table exists with required structure
CREATE TABLE IF NOT EXISTS notification_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT,
  timezone TEXT,
  app_version TEXT,
  device_id TEXT,
  device_name TEXT,
  language TEXT,
  push_provider TEXT NOT NULL DEFAULT 'fcm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_registered_at TIMESTAMPTZ
);

-- Align existing columns with expected defaults and constraints
ALTER TABLE notification_devices
  ALTER COLUMN token SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN push_provider SET DEFAULT 'fcm';

ALTER TABLE notification_preferences
  ALTER COLUMN preferences SET DEFAULT '{}'::jsonb,
  ALTER COLUMN preferences SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- Add helpful indexes and constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_devices_token_unique
  ON notification_devices(token)
  WHERE token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_devices_user_id
  ON notification_devices(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_devices_user_provider
  ON notification_devices(user_id, push_provider);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_updated_at
  ON notification_preferences(updated_at);

-- Constrain provider values to known channels
ALTER TABLE notification_devices
  ADD CONSTRAINT notification_devices_push_provider_check
  CHECK (push_provider IN ('fcm', 'apns'))
  NOT VALID;

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_devices_set_updated_at ON notification_devices;
CREATE TRIGGER notification_devices_set_updated_at
  BEFORE UPDATE ON notification_devices
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS notification_preferences_set_updated_at ON notification_preferences;
CREATE TRIGGER notification_preferences_set_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- Migrate per-user notification preferences out of profiles
INSERT INTO notification_preferences (user_id, preferences, created_at, updated_at)
SELECT
  p.user_id,
  COALESCE(p.notification_preferences, '{}'::jsonb),
  NOW(),
  NOW()
FROM profiles p
WHERE p.notification_preferences IS NOT NULL
ON CONFLICT (user_id)
DO UPDATE SET
  preferences = EXCLUDED.preferences,
  updated_at = NOW();

-- Migrate existing push tokens into notification_devices
INSERT INTO notification_devices (
  user_id,
  token,
  platform,
  timezone,
  app_version,
  device_id,
  device_name,
  language,
  push_provider,
  last_registered_at,
  created_at,
  updated_at
)
SELECT
  p.user_id,
  p.fcm_token,
  COALESCE(LOWER(p.browser_info ->> 'browser'), 'web'),
  p.timezone,
  p.browser_info ->> 'appVersion',
  p.browser_info ->> 'deviceId',
  COALESCE(p.browser_info ->> 'deviceName', p.browser_info ->> 'browser'),
  p.browser_info ->> 'language',
  'fcm',
  p.push_token_updated_at,
  COALESCE(p.push_token_updated_at, NOW()),
  NOW()
FROM profiles p
WHERE p.fcm_token IS NOT NULL
ON CONFLICT (token)
DO UPDATE SET
  user_id = EXCLUDED.user_id,
  platform = COALESCE(EXCLUDED.platform, notification_devices.platform),
  timezone = COALESCE(EXCLUDED.timezone, notification_devices.timezone),
  app_version = COALESCE(EXCLUDED.app_version, notification_devices.app_version),
  device_id = COALESCE(EXCLUDED.device_id, notification_devices.device_id),
  device_name = COALESCE(EXCLUDED.device_name, notification_devices.device_name),
  language = COALESCE(EXCLUDED.language, notification_devices.language),
  push_provider = EXCLUDED.push_provider,
  last_registered_at = COALESCE(EXCLUDED.last_registered_at, notification_devices.last_registered_at),
  updated_at = NOW();

INSERT INTO notification_devices (
  user_id,
  token,
  platform,
  timezone,
  app_version,
  device_id,
  device_name,
  language,
  push_provider,
  last_registered_at,
  created_at,
  updated_at
)
SELECT
  p.user_id,
  p.apns_web_token,
  COALESCE(LOWER(p.browser_info ->> 'browser'), 'safari'),
  p.timezone,
  p.browser_info ->> 'appVersion',
  p.browser_info ->> 'deviceId',
  COALESCE(p.browser_info ->> 'deviceName', p.browser_info ->> 'browser'),
  p.browser_info ->> 'language',
  'apns',
  p.push_token_updated_at,
  COALESCE(p.push_token_updated_at, NOW()),
  NOW()
FROM profiles p
WHERE p.apns_web_token IS NOT NULL
ON CONFLICT (token)
DO UPDATE SET
  user_id = EXCLUDED.user_id,
  platform = COALESCE(EXCLUDED.platform, notification_devices.platform),
  timezone = COALESCE(EXCLUDED.timezone, notification_devices.timezone),
  app_version = COALESCE(EXCLUDED.app_version, notification_devices.app_version),
  device_id = COALESCE(EXCLUDED.device_id, notification_devices.device_id),
  device_name = COALESCE(EXCLUDED.device_name, notification_devices.device_name),
  language = COALESCE(EXCLUDED.language, notification_devices.language),
  push_provider = EXCLUDED.push_provider,
  last_registered_at = COALESCE(EXCLUDED.last_registered_at, notification_devices.last_registered_at),
  updated_at = NOW();

-- Remove now-redundant columns from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS fcm_token;
ALTER TABLE profiles DROP COLUMN IF EXISTS apns_web_token;
ALTER TABLE profiles DROP COLUMN IF EXISTS browser_info;
ALTER TABLE profiles DROP COLUMN IF EXISTS notification_preferences;
ALTER TABLE profiles DROP COLUMN IF EXISTS push_token_updated_at;

-- Enable RLS and policies for new tables
ALTER TABLE notification_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_devices'
      AND policyname = 'notification_devices_select_self'
  ) THEN
    EXECUTE 'CREATE POLICY notification_devices_select_self ON notification_devices FOR SELECT USING (auth.uid() = user_id);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_devices'
      AND policyname = 'notification_devices_modify_self'
  ) THEN
    EXECUTE 'CREATE POLICY notification_devices_modify_self ON notification_devices FOR ALL USING (auth.uid() = user_id);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'notification_preferences_select_self'
  ) THEN
    EXECUTE 'CREATE POLICY notification_preferences_select_self ON notification_preferences FOR SELECT USING (auth.uid() = user_id);';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'notification_preferences_modify_self'
  ) THEN
    EXECUTE 'CREATE POLICY notification_preferences_modify_self ON notification_preferences FOR ALL USING (auth.uid() = user_id);';
  END IF;
END;
$$;

-- Ensure service role retains full access
GRANT ALL ON notification_devices TO service_role;
GRANT ALL ON notification_preferences TO service_role;

COMMIT;
