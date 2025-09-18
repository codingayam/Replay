# Foundation & Credentials

## Objective
Establish the credential backbone needed to operate dual-channel web push (FCM for Chromium-family browsers and APNs Web Push for Safari) so both the client and server codebases can authenticate, register devices, and deliver notifications securely.

## Deliverables
- Firebase project with Web app configuration and messaging artifacts
- Apple Developer Web Push enrollment with signed push package assets
- VAPID key pair and APNs key material stored in secure secrets management
- Environment variable templates and documentation for both client and server

## Technical Requirements

### 1. Firebase / FCM Setup
- Create or reuse a Firebase project dedicated to Replay (`replay-web-push` or similar) with billing enabled for quota safety.
- Add a Web App in Firebase console and capture:
  - `apiKey`
  - `authDomain`
  - `projectId`
  - `storageBucket`
  - `messagingSenderId`
  - `appId`
- Enable Cloud Messaging > Web configuration and upload app icons (`icon-192x192.png`, `badge-72x72.png`).
- Configure allowed web origins: local dev (`https://localhost:5173`), staging, production domains.
- Export values into `client/.env.example` using `VITE_FIREBASE_*` naming so the Vite build injects them into the service worker and notification utilities.

### 2. Apple Web Push Enrollment
- Ensure Replay is enrolled in the Apple Developer Program with Web Push entitlement.
- Generate an APNs Auth Key (`.p8` file) dedicated to web push; record Key ID and Team ID.
- Define a Web Push Identifier (e.g., `web.com.replay.app`).
- Prepare the push package assets directory matching Apple requirements:
  - `icon.iconset` with 16/32/128/256 px PNGs
  - `manifest.json` containing SHA-256 digests for all assets
  - `website.json` describing allowed domains, authentication token, web service URL
- Sign the package using the `.p8` key and SHA-1; store automation scripts to regenerate on asset updates.
- Update `client/public/site.webmanifest` to include `applinks` and push-related metadata (same identifier, icon references).

### 3. Web Push Authentication Keys
- Generate VAPID keys via Firebase console or `web-push generate-vapid-keys`.
- Store public key in `VITE_FIREBASE_VAPID_KEY`; store private key in server secrets for manual push testing or fallback providers.
- Validate that the VAPID subject matches Replay’s production URL (`https://app.replay.com`).

### 4. Secret Storage & Distribution
- Place the following into secure secret management (1Password, Vault, or similar):
  - Firebase Admin service account JSON (for server FCM Admin SDK)
  - APNs `.p8` key + Key ID + Team ID + Web Push ID
  - VAPID private key (if maintained outside Firebase)
- Update ops runbook with retrieval procedure and rotation policy (90-day review).

### 5. Environment Variables
- Update `server/.env.example` with placeholders:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY` (escaped newline format)
  - `FCM_SERVER_KEY`
  - `APNS_TEAM_ID`
  - `APNS_KEY_ID`
  - `APNS_KEY`
  - `APNS_WEB_PUSH_ID`
- Update `client/.env.example` with `VITE_FIREBASE_*` keys and `VITE_FIREBASE_VAPID_KEY`.
- Document load order so local dev, staging, and production pipelines inject the correct secrets.

## Acceptance Criteria
- Test Firebase configuration via `firebase messaging` quickstart to ensure tokens are issued for Chromium browsers.
- Safari push package passes Apple validation (`applesign` or `web-push-id-validate`).
- Secrets accessible to CI/CD without committing sensitive files to git.
- Environment templates committed; README updated with instructions for acquiring credentials.
