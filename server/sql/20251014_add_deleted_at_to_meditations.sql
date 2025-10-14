ALTER TABLE meditations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS meditations_deleted_at_idx
  ON meditations (deleted_at);
