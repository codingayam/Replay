-- Migration: Add push notifications schema
-- This migration adds push notification support to the Replay database

-- Add push notification fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  fcm_token TEXT, -- Web push token from browser
  apns_web_token TEXT, -- Safari Web Push device token
  browser_info JSONB DEFAULT '{}', -- Browser type, version for compatibility
  notification_preferences JSONB DEFAULT '{
    "enabled": true,
    "daily_reminder": {"enabled": true, "time": "20:00"},
    "streak_reminder": {"enabled": true, "time": "21:00"},
    "meditation_ready": {"enabled": true},
    "weekly_reflection": {"enabled": true, "day": "sunday", "time": "19:00"},
    "replay_radio": {"enabled": false, "time": "07:00"},
    "achievements": {"enabled": true}
  }',
  push_token_updated_at TIMESTAMP,
  push_channel_preference VARCHAR(20) DEFAULT 'auto'; -- auto | fcm | apns

-- Notification tracking table
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL, -- 'fcm' | 'apns'
  title TEXT,
  body TEXT,
  data JSONB,
  sent_at TIMESTAMP DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE,
  opened BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMP,
  error TEXT
);

-- Scheduled notifications table
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  scheduled_time TIME NOT NULL,
  days_of_week INTEGER[], -- 0=Sunday, 6=Saturday
  enabled BOOLEAN DEFAULT TRUE,
  last_sent TIMESTAMP,
  next_send TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON notification_history(type);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user_id ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_enabled ON scheduled_notifications(enabled);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_time ON scheduled_notifications(scheduled_time);

-- Enable Row Level Security
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_history
CREATE POLICY IF NOT EXISTS "Users can view their own notification history" ON notification_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own notification history" ON notification_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for scheduled_notifications
CREATE POLICY IF NOT EXISTS "Users can view their own scheduled notifications" ON scheduled_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can manage their own scheduled notifications" ON scheduled_notifications
  FOR ALL USING (auth.uid() = user_id);

-- Function to create default scheduled notifications for new users
CREATE OR REPLACE FUNCTION create_default_scheduled_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Daily reminder at 8 PM
  INSERT INTO scheduled_notifications (user_id, type, scheduled_time, days_of_week, enabled)
  VALUES (NEW.user_id, 'daily_reminder', '20:00'::TIME, ARRAY[0,1,2,3,4,5,6], TRUE);

  -- Streak reminder at 9 PM
  INSERT INTO scheduled_notifications (user_id, type, scheduled_time, days_of_week, enabled)
  VALUES (NEW.user_id, 'streak_reminder', '21:00'::TIME, ARRAY[0,1,2,3,4,5,6], TRUE);

  -- Weekly reflection on Sunday at 7 PM
  INSERT INTO scheduled_notifications (user_id, type, scheduled_time, days_of_week, enabled)
  VALUES (NEW.user_id, 'weekly_reflection', '19:00'::TIME, ARRAY[0], TRUE);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default scheduled notifications for new users
DROP TRIGGER IF EXISTS create_default_scheduled_notifications_trigger ON profiles;
CREATE TRIGGER create_default_scheduled_notifications_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_scheduled_notifications();

-- Grant necessary permissions for service role
GRANT ALL ON notification_history TO service_role;
GRANT ALL ON scheduled_notifications TO service_role;