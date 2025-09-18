# Group 11 — Testing, CI/CD, Detox, TestFlight

Effort: M

Overview
- Establish reliable build/test automation for both shared and mobile code, plus e2e testing with Detox and distribution via TestFlight.

Deliverables
- CI workflows: unit tests for shared + mobile; lint; typecheck; build verification.
- Detox E2E test harness for iOS (simulator) with at least one end-to-end smoke test.
- EAS build profiles for development/preview/release; TestFlight deployment path.
- Crash reporting (Sentry) integration and basic release notes pipeline.

Tasks
- Unit testing
  - Ensure Jest runs for `packages/shared` and `mobile` in CI with coverage.
  - Add minimal tests for auth, list rendering, and player state reducers.
- Detox setup
  - Configure Detox with `@detox/test` for iOS simulator; add build/run scripts.
  - Create a smoke test: launch app → login (mock) → open experiences → play/pause audio.
- CI/CD
  - GitHub Actions (or equivalent): install, cache deps, run tests/lint/typecheck.
  - Optional: nightly Detox E2E run (simulator) on macOS runner.
  - EAS credentials and profiles; `eas submit` to TestFlight for beta testers.
- Telemetry
  - Integrate Sentry (or Expo Crash) for runtime errors and native crashes.

Acceptance Criteria
- A PR triggers CI: lint + unit tests pass for shared/mobile.
- Detox smoke test runs locally and in CI (macOS) against iOS simulator.
- EAS build artifacts produced; TestFlight build available to testers.

Dependencies
- Group 02 (mobile bootstrap), Group 01 (shared). Some tests depend on Groups 04–07 features.

External Dependencies / Blockers
- macOS CI runners with Xcode for Detox and iOS builds.
- Apple Developer account for TestFlight.

Integration Points
- Works across all feature groups; provides the validation backbone “along the way”.

Notes
- Start CI early with unit/lint; add Detox as soon as navigation + auth are stable.

