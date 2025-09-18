# Group 09 — Notifications (Reminders, Streaks)

Effort: M

Overview
- Implement push notifications for meditation reminders, daily reflections, and streak nudges using `expo-notifications`.

Deliverables
- Permission flow and settings screen for notification preferences.
- Device push token registration with server; topic/segment support optional.
- Scheduled local notifications and/or server-driven pushes.

Tasks
- Setup
  - Configure `expo-notifications` with Apple credentials; update app capabilities.
  - Request, store, and respect user permissions and preferences.
- Flows
  - Daily reflection prompt at configurable times; per-user locale/timezone handling.
  - Meditation reminders and streak celebrations; deep link to relevant screens.
- Server
  - Minimal endpoints to register/unregister device tokens; broadcast or schedule if required.
- Testing
  - Manual QA plan across permission states; background/terminated app handling.

Acceptance Criteria
- Users can enable/disable notifications and set preferences.
- Notifications arrive on schedule and open the correct screen via deep links.
- Token lifecycle handled (refresh, revoke).

Dependencies
- Group 02 for EAS setup and iOS capabilities; Group 04 for deep links.

External Dependencies / Blockers
- Apple Push configuration; potential server push provider.

Integration Points
- Settings UI; deep linking routes.

