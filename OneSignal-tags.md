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
