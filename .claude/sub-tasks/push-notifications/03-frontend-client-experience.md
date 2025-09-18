# Frontend Client Experience

## Objective
Deliver a browser-aware push experience in the Replay React app that follows the dual-delivery requirements, provides a respectful permission flow, and surfaces notification controls/history to the user.

## Architecture Overview
- Shared service worker (`public/firebase-messaging-sw.js`) handling both FCM background messages and raw `push` events from APNs.
- `useNotifications` hook encapsulating permission state, token registration, and foreground handlers.
- UI surfaces: permission banner, notification settings screen, history view, in-app badges.

## Technical Requirements

### 1. SDK & Service Worker
- Install Firebase Web SDK (`firebase/app`, `firebase/messaging`).
- Create `public/firebase-messaging-sw.js` with:
  - Firebase app initialization using env vars.
  - `messaging.onBackgroundMessage` for FCM structured payloads.
  - `self.addEventListener('push')` for APNs JSON payloads.
  - `notificationclick` handler that deep-links via `clients.matchAll` / `clients.openWindow`.
- Version service worker (e.g., `const SW_VERSION = '2024.03.0'`) and broadcast updates to open tabs.
- Register service worker in `client/src/main.tsx` post-React bootstrap, ensuring HTTPS origin check.

### 2. Permission & Onboarding Flow
- Build `NotificationPermissionBanner` component that renders when `Notification.permission === 'default'` and user qualifies (generated first meditation, or after onboarding step).
- Provide call-to-action button that triggers `requestPermission()`; wrap Safari prompt in custom dialog explaining add-to-home requirement.
- Track user dismissal to re-prompt no sooner than 7 days later (per requirements doc).

### 3. Token Management
- Implement `useNotifications.initializeFCM()`:
  - Calls `navigator.serviceWorker.ready` then `getMessaging` and `getToken` with `vapidKey`.
  - Handles errors such as denied permission, blocked service worker.
  - Posts token to `/api/notifications/token` with channel `fcm`.
- Implement `initializeAppleWebPush()`:
  - Detect Safari PWA via `window.safari.pushNotification` and `navigator.standalone` (iOS) or `Notification.permission` checks.
  - Trigger `safari.pushNotification.requestPermission('/pushPackages/<id>', '<id>', { userId })` and send resulting `deviceToken` to backend with channel `apns`.
- Add token refresh listeners (`onTokenRefresh` equivalent or manual re-fetch on app load) to keep backend synchronized.

### 4. Foreground Message Handling
- Use `onMessage(messaging, callback)` to show toast notifications when the tab is active to avoid duplicate system notifications.
- Provide headless handler that updates in-app badge counts for meditation ready events.
- Respect tab focus detection: if `document.visibilityState === 'visible'` and user is in the relevant page, suppress redundant toasts.

### 5. Deep Linking
- Ensure React Router routes exist: `/meditation/:id`, `/experiences?action=record`, `/reflections?action=generate`.
- Implement `handleNotificationClick(data)` that navigates using `navigate()` within SPA context when the app is already open.
- Support query parameters to pre-select experience sets (weekly reflection) and highlight relevant UI.

### 6. Browser Capability Detection
- Add utilities in `src/utils/notifications.ts`:
  - `isPushSupported()` (checks `Notification`, `serviceWorker`, `PushManager`).
  - `isSafariWebPush()` to branch APNs flow.
  - `requiresPwaInstallForPush()` to prompt installation instructions on Safari.
- Display fallback UI (email reminders toggle, in-app banners) when push unsupported or denied.

### 7. Notification Settings UI
- Extend Profile > Settings > Notifications page:
  - Master toggle and per-notification toggles bound to backend preferences.
  - Time pickers (24h / locale aware) for daily/streak reminders.
  - Preview card showing sample notification (title/body/actions) per type.
  - Validation feedback when quiet hours overlap or times invalid.
- On save, call `PUT /api/notifications/preferences`; show optimistic UI with rollback on error.

### 8. Notification History View
- Create `NotificationHistoryList` component fetching `/api/notifications/history` (paginate 20 items).
- Display status chips (`Delivered`, `Opened`, `Failed`) and provide “open deep link” action for each entry.
- Allow clearing history via backend endpoint when implemented.

### 9. Testing Matrix
- Browser manual tests: Chrome (desktop/mobile), Firefox, Edge, Safari PWA on macOS and iOS.
- Automated tests:
  - Jest unit tests for `notificationUtils` detection logic.
  - React Testing Library tests for permission banner behavior and settings form validation.
  - Mock service worker tests to assert registration path executes with correct scope.
- Document scenario checklist: permission denied, token refresh, tab active/inactive, quiet hours, re-engagement schedule.

## Acceptance Criteria
- Service worker registers successfully over HTTPS in dev and production builds.
- Tokens are persisted and refreshed; backend reports channel and token matches for target browser.
- Notifications received in foreground and background with correct deep linking across supported browsers.
- Settings page reflects backend state and updates preferences without refresh.
- Unsupported browsers see graceful fallback messaging and alternate reminder options.
