# Backend Notification Service

## Objective
Design and implement a channel-aware notification platform that can register user devices, respect preferences, and deliver push notifications through Firebase Cloud Messaging (FCM) and Apple Push Notification service (APNs) Web Push, aligned with the functional priorities defined in `.claude/docs/req-basic-push_notifications.md`.

## Architecture Overview
- Introduce a `NotificationService` module responsible for:
  - Token lifecycle management (create/update/expire) for both `fcm` and `apns` channels
  - Message composition helpers (title/body/actions) per notification type
  - Transport adapters: `FcmTransport`, `ApnsTransport`
  - Delivery analytics logging to `notification_history`
- Expose REST endpoints under `/api/notifications` to support the React client.
- Integrate with existing job queues to trigger notifications (meditation completion, reminders).

## Technical Requirements

### 1. Dependencies & Configuration
- Import Firebase Admin SDK (`firebase-admin`) with service account credentials loaded via environment variables.
- Add an APNs HTTP/2 client (e.g., `@parse/node-apn` or custom `node-apn-http2`) that supports JWT token auth and `webpush` topics.
- Centralize configuration (`config/notifications.ts`) to read:
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  - `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY`, `APNS_WEB_PUSH_ID`
  - `DEFAULT_TIMEZONE`, retry policies, rate limits.

### 2. Data Model Updates
- Migration to add columns to `profiles`:
  - `fcm_token TEXT`
  - `apns_web_token TEXT`
  - `push_channel_preference VARCHAR(20) DEFAULT 'auto'`
  - `notification_preferences JSONB` (structure from requirements doc)
  - `push_token_updated_at TIMESTAMP`
- Create `notification_history` table capturing `type`, `channel`, `payload`, `sent_at`, `delivered`, `opened` fields.
- Create `scheduled_notifications` table storing user schedule configuration (time-of-day, days-of-week, next_send).

### 3. Token Management Endpoints
- `POST /api/notifications/token`
  - Validates auth
  - Body `{ token, channel, browser, userAgent, appVersion }`
  - Persists token + metadata, updates `push_token_updated_at`.
  - Responds with `{ success: true }` or error message.
- `DELETE /api/notifications/token`
  - Removes token on logout/uninstall.
- Implement token normalization (trim, deduplicate) and rotation detection.

### 4. Preference APIs
- `GET /api/notifications/preferences`
  - Returns merged server defaults with user overrides.
- `PUT /api/notifications/preferences`
  - Accepts validated partial updates per notification type.
  - Persists to `notification_preferences` JSONB.
  - Recalculates `scheduled_notifications` rows as needed.
- Enforce caps (e.g., maximum daily reminders) and guard rails for quiet hours.

### 5. Notification Dispatch Flow
- Introduce `sendPushNotification(userId, payload)` signature:
  - Payload includes `{ type, title, body, data, channelOverride?, sound, actions }`.
  - Service inspects user preferences + channel availability to choose `fcm` or `apns`.
  - FCM path sends via `admin.messaging().sendToDevice(token, message)` using `webpush` options (icon, badge, actions).
  - APNs path builds HTTP/2 request with `:path /3/device/<token>` and payload matching Apple Web Push schema.
- Implement exponential backoff retry (max 3 attempts) and mark failure reasons in `notification_history.error`.
- Hook into meditation job completion: when status changes to `completed`, call dispatch with deep link data.

### 6. Scheduled Notifications
- Add cron scheduler (e.g., `node-cron`): evaluate every 5 minutes.
- For each pending `scheduled_notifications`, check user timezone, whether quiet hours apply, and if user already satisfied the goal (e.g., created a note today).
- Queue notifications for `daily_reflection`, `streak_reminder`, `weekly_reflection`, `inactivity_reengagement` per rules in requirements doc.
- Record `last_sent` / `next_send` and decrement cadence if user opts out.

### 7. History & Analytics
- Log every attempt in `notification_history` with `data` blob (meditationId, url, metadata).
- Expose `GET /api/notifications/history?limit=50&offset=0` for frontend history view.
- Optionally add `POST /api/notifications/ack` to mark `opened` when the service worker reports click-through.

### 8. Test Utilities
- Create `POST /api/notifications/test` (protected admin route) allowing developers to send self notifications of a specific type.
- Provide local mocks for APNs when `.p8` not available (return 200 with fake response).

## Acceptance Criteria
- Automated tests cover channel selection logic, preference enforcement, and schema migrations.
- End-to-end smoke test demonstrates meditation completion triggering push through both FCM (Chrome) and APNs (Safari PWA).
- Scheduled jobs obey user timezone and quiet hours, verified by unit/integration tests with time fakes.
- Notification history entries created for success and failure cases with actionable error messages.
- API endpoints return validation errors when payloads are malformed, preventing inconsistent data.

## Acceptance Checks and fixes
Backend Notifications

  - Swapped the APNs transport to real HTTP/2 + JWT auth, added reusable Supabase client access, and hardened preference gating logic (services/notificationService.js:22, services/notificationService.js:109,
  services/notificationService.js:378).
  - Added timezone-aware schedule evaluation and eliminated duplicate sends through a dedicated helper, while logging failures with the actual channel (services/notificationService.js:581, services/
  notificationService.js:318).
  - Tightened API validation and schedule updates so preference payloads must be well-formed and weekly reminders can move days without breaking cadence (server/server.js:24, server/server.js:3801, server/
  server.js:3976).
  - Ensured config exposes the required APNs bundle id for the new transport (config/notifications.js:21).
  - Introduced a Node test suite exercising channel selection, preference enforcement, FCM/APNs “smoke” paths, failure logging, scheduled window logic, and migration coverage (server/tests/
  notificationService.test.js:64-219).
  - Enabled a portable npm test entry point so CI/devs can run the Node test runner locally (server/package.json).

  What Was Missing

  - APNs still used the deprecated apn client, so Safari notifications never satisfied the HTTP/2/JWT requirement.
  - Preference updates accepted any payload and couldn’t adjust weekly reminder days, risking invalid schedules and noisy jobs.
  - There were no automated tests for the acceptance checkpoints (channel choice, preferences, timezone scheduling, migrations), so regressions or broken Meditations hooks would go unnoticed.

  Verification

  - npm test (Node’s built-in runner executes the new notification suite).

▌ where do i run npm test from?

> Run it from the server package root: cd server && npm test.