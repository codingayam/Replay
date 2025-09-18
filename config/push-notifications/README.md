# Push Notification Credentials Runbook

## Secret Inventory
Store the following items in the Replay 1Password vault (or equivalent secret manager):

| Secret | Purpose |
| --- | --- |
| Firebase Admin service account JSON | Server-side access to FCM for sending notifications |
| FCM Server Key | Legacy key required for selected SDK integrations |
| Firebase Web App config (apiKey, authDomain, etc.) | Used to seed CI/CD and generate service worker config |
| VAPID Key Pair | Authenticates web push requests (public key distributed to clients) |
| APNs Auth Key (`.p8`) + Key ID + Team ID | Required for Safari web push signing |
| Web Push Authentication token (website.json) | Validates device registrations |

## Distribution & Rotation
- **Storage**: Secrets live only in 1Password. CI/CD pipelines retrieve them via environment variable injection.
- **Rotation cadence**: Review quarterly (90-day cycle). Track next rotation date in ops tracker.
- **Access**: Limit edit permissions to the platform team; read access for on-call engineers.
- **Revocation**: If a secret leaks, revoke in the respective console (Firebase / Apple) and rotate immediately. Update 1Password entry and notify #eng-ops.

## Local Development
1. Duplicate `client/.env.example` and `server/.env.example` into `.env` files locally.
2. Populate with values pulled from 1Password.
3. Run `npm run push:generate-sw-config` to emit `firebase-sw-config.js` for the service worker (this file stays untracked).

## CI/CD Consumption
- Vercel: create environment variables for all `VITE_FIREBASE_*` and `VITE_FIREBASE_VAPID_KEY` values.
- Backend deployment (Railway/Render): configure `FIREBASE_*`, `FCM_SERVER_KEY`, `VAPID_*`, and `APNS_*` environment variables using secrets manager references.

## Incident Response
1. Disable compromised key in Firebase/APNs immediately.
2. Clear the exposed value from git history if necessary.
3. Issue replacement credentials and redeploy with new values.
4. Document the incident in the ops log and notify compliance.

