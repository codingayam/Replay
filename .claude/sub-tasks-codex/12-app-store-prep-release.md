# Group 12 — App Store Prep & Release

Effort: S

Overview
- Prepare the app for App Store submission: assets, metadata, privacy details, and release processes.

Deliverables
- App icon, launch screen, screenshots, and preview videos per device classes.
- App Store Connect config: description, keywords, age rating, privacy policy.
- Release checklist covering review guidelines and post-release monitoring.

Tasks
- Assets & metadata
  - Produce required icons/splashes; generate screenshots via simulator flows.
  - Write store description, keywords, and what’s new template.
- Privacy & compliance
  - Update privacy policy; document data usage for App Tracking transparency (if applicable).
  - Validate background modes, microphone usage descriptions, and notifications text.
- Submission
  - `eas submit -p ios` to TestFlight and then App Store review.
  - Verify Sentry/analytics enabled; set up A/B testing if used.

Acceptance Criteria
- App passes App Store review without rejection.
- Release notes and monitoring in place; crash-free rate tracked.

Dependencies
- Culmination of prior groups; must have stable builds from Group 11.

External Dependencies / Blockers
- Apple review timelines; legal/privacy content.

Integration Points
- CI/CD (Group 11) for distribution; Design (Group 08) for assets.

