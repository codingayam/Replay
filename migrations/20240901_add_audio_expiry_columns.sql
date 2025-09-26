ALTER TABLE IF EXISTS meditations
  ADD COLUMN IF NOT EXISTS audio_storage_path text,
  ADD COLUMN IF NOT EXISTS audio_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS audio_removed_at timestamptz;
