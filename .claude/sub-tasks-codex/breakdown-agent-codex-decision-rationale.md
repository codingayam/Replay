# Breakdown Agent (Codex) — Decision Rationale

Scope
- Convert the existing React web app to an iOS app using React Native (Expo) while keeping the Node/Express backend.
- Provide a build-and-test path throughout development so teams can validate progress continuously.

Rationale for Grouping
- Foundational separation first (Group 01) maximizes reuse and unblocks parallel frontends.
- Mobile bootstrap (Group 02) stands up a runnable app and EAS builds early for rapid iteration.
- Server audio support (Group 03) is independent and critical for iOS-native recording; doing this early unblocks audio work.
- Core user access (Group 04) allows secured feature flows, enabling realistic e2e testing.
- Audio recording + background uploads (Group 05) is complex and benefits from early iteration on Dev Client.
- Experience management (Group 06) and the Player (Group 07) are core features ported in parallel once foundation exists.
- Design system, navigation, and native components (Group 08) provide consistency and speed across all features.
- Notifications (Group 09) and Offline (Group 10) are platform-value features layered on top of core flows.
- Testing/CI/CD (Group 11) formalizes automation and release, but parts start on Day 1; the group consolidates and extends.
- App Store prep (Group 12) completes distribution requirements.

Parallelization Strategy
- Start Groups 01, 02, and 03 concurrently with different owners.
- After 02 stabilizes navigation shell, begin 04, 05, 06, and 08 in parallel:
  - 04 Auth and 06 Experiences can proceed with mocked/stubbed API while types/validators land in 01.
  - 05 Audio depends on 03 for m4a acceptance, but UI and queue scaffolding can begin earlier.
  - 08 Design system accelerates 06/07 development.
- 07 Player can start once 02 (shell) and 08 (design tokens) are in place; uses shared API/types from 01.
- 09 Notifications can be developed in parallel post-02, with server token registration as a small server extension.
- 10 Offline builds on 05/06 and can begin once list CRUD is live.
- 11 Testing/CI/CD starts with unit/lint in Week 1; Detox after 04 + basic nav.

Dependency Highlights
- 01 → all other groups (shared types/utils/api).
- 02 → 04/05/06/07/08/09 (mobile shell, EAS, navigation).
- 03 → 05 (m4a acceptance and conversion).
- 04 → any feature requiring authenticated API.
- 05 ↔ 10 (upload queue interacts with offline sync engine).
- 08 supports 06/07 with consistent UI/UX and navigation.
- 11 validates everything continuously; connects to 12 for release.

Recommended Development Sequence
1) Kickoff (parallel): 01 Monorepo/Shared, 02 Mobile Bootstrap/EAS, 03 Server Audio
2) Core: 04 Auth, 05 Audio + Uploads, 06 Experiences, 08 Design System/Navigation
3) Media: 07 Player
4) Platform: 09 Notifications, 10 Offline & Cache
5) Quality: 11 Testing/CI/CD/Detox/TestFlight (begin early, mature here)
6) Release: 12 App Store Prep & Submission

Build and Test Along the Way
- Week 1: CI runs unit tests for `@replay/shared` and lints repo. EAS set up to build iOS simulator/dev client.
- Week 2–3: Add mobile Jest tests; ship first TestFlight build to internal testers.
- Week 3–4: Add Detox smoke tests after auth + navigation stabilize.
- Ongoing: Per-group acceptance criteria include manual QA and tests. CI gates PRs.

Next Steps & Coordination
- Assign leads: (1) Monorepo/Shared, (2) Mobile Bootstrap/EAS, (3) Server Audio.
- Schedule integration checkpoints at the end of Weeks 2, 4, and 6 for cross-group demos.
- Align API contracts and types in `@replay/shared`; post changes via RFC in the repo.

Assumptions
- Apple Developer account available for EAS and TestFlight.
- Xcode/macOS CI runners exist for iOS simulator and Detox.
- Backend uses bundled ffmpeg via `@ffmpeg-installer/ffmpeg` to avoid system dependencies.

Risk Mitigation
- Begin with Dev Client to validate native capabilities (background upload, audio modes).
- Add observability early (Sentry) to catch native crashes during TestFlight.
