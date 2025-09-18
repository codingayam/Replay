# Group 05 — Audio Recording + Background Uploads

Effort: L

Overview
- Implement native audio recording with `expo-av` (m4a on iOS), proper AVAudioSession config, and resilient background uploads via `react-native-background-upload`.
- Add a persistent SQLite-backed jobs queue that survives app restarts and reattaches to iOS URLSession tasks.

Deliverables
- Recording component with start/pause/stop; waveform optional; file saved to `FileSystem`.
- Background upload integration with RNBU and foreground fallback with progress.
- SQLite jobs table with resume/retry semantics and OS task IDs persisted.
- Manual QA checklist for kill/resume, low-memory, airplane mode, and network transitions.

Tasks
- Recording
  - Configure `AVAudioSession` category/routes; request microphone permission; handle interruptions.
  - Record as m4a; write file to app sandbox; expose metadata (duration/size).
- Uploads
  - RNBU setup in Expo Managed workflow using a Custom Dev Client; stable URLSession identifier.
  - Persist jobs in SQLite (schema per plan); enqueue on record complete; emit progress.
  - Reattach logic on cold start; clean up completed/failed jobs with retention.
  - Foreground fallback using fetch/multipart if RNBU unavailable.
- API integration
  - Use `@replay/shared` API client for auth headers and endpoints.
  - Ensure server accepts m4a (Group 03) and returns expected response.
- QA & observability
  - In-app debug screen for pending jobs/state.
  - Checklist: pause/resume, kill/restart, offline enqueue, retry backoff.

Acceptance Criteria
- Record an audio clip and observe a successful upload that resumes after app kill/restart.
- Offline: job enqueues and auto-uploads on reconnect.
- Progress UI reflects real upload progress; errors retried with backoff.

Dependencies
- Group 02 (Custom Dev Client) and Group 03 (server m4a support). Group 01 for API client.

External Dependencies / Blockers
- Apple background tasks behavior (URLSession); EAS Dev Client required.

Integration Points
- Downstream UI groups (06/07) consume recorded content.
