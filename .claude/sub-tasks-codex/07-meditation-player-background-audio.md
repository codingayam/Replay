# Group 07 — Meditation Player & Background Audio

Effort: M

Overview
- Implement an audio player using `expo-av` with background playback, Control Center integration, and robust interruption handling.

Deliverables
- Player UI with play/pause/seek, progress bar, and track metadata.
- Background modes enabled (Audio, AirPlay, PiP as applicable); Control Center controls.
- Interruption handling (phone calls/other apps) with automatic resume rules.

Tasks
- Playback engine
  - Configure `AVAudioSession` for playback; manage focus/ducking.
  - Implement buffering, progress, and error states; preload strategies.
- Background & controls
  - Enable iOS background audio modes; show metadata to Control Center.
  - Hook media keys and remote events to player actions.
- UI & a11y
  - Accessible controls with large touch targets; dynamic type support.
  - Persist last position per track; resume on reopen.
- Testing
  - Unit tests for player state machine.
  - Manual QA checklist: interruptions, headphone plug/unplug, AirPlay.

Acceptance Criteria
- Audio continues in background with responsive Control Center actions.
- Interruptions handled gracefully; resume rules validated.
- Player persists position and restores state on app relaunch.

Dependencies
- Groups 01–02; optional 06 for integration points.

External Dependencies / Blockers
- Background audio entitlements and EAS build profile.

Integration Points
- Shares design system from Group 08.

