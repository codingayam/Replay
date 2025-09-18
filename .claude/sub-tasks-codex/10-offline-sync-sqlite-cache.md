# Group 10 — Offline Support (SQLite + Cache + Sync)

Effort: L

Overview
- Provide resilient offline capabilities: local SQLite store for notes/experiences, background sync jobs, and cached media for playback.

Deliverables
- SQLite schema for notes/experiences and an upload/sync queue (jobs table per plan).
- Conflict resolution strategy (last-write-wins or server-authoritative with timestamps).
- Cached audio/image files with eviction policy.

Tasks
- Data storage
  - Define SQLite schema and migrations; wrap access in a small data layer.
  - Read/write experiences locally and sync with server when online.
- Sync engine
  - Queue local changes; retry with backoff; reconcile conflicts.
  - Integrate with Group 05 uploads and Group 06 CRUD UI.
- Caching
  - Cache audio for offline playback; manage disk usage and cleanup.
- Testing
  - Unit tests for sync logic with mocked network; instrumentation for cache hit rates.

Acceptance Criteria
- Experiences created/edited offline are preserved and synced on reconnect.
- Uploads queued offline are processed later without user action.
- App remains usable without network; clear status indicators.

Dependencies
- Groups 05 and 06; Group 01 for shared types.

External Dependencies / Blockers
- None.

Integration Points
- Works with player (Group 07) for offline playback; with UI (Group 06).

