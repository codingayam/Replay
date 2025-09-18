# Group 04 — Authentication (Supabase, Deep Linking, Secure Store)

Effort: M

Overview
- Implement mobile authentication with Supabase using secure token storage and deep linking for OAuth/password flows.
- Support session persistence, refresh, and optional biometric unlock.

Deliverables
- Auth screens (Sign In/Up, Forgot Password) with validation and RN-friendly UX.
- Supabase client configured for RN; session persisted with `expo-secure-store`.
- Deep link URL scheme configured; OAuth redirect callback verified (cold/warm starts).
- Optional biometric unlock flow (Face ID/Touch ID) after initial login.

Tasks
- Supabase client
  - Configure Supabase for RN, wire base URL and keys via env.
  - Token/session management and refresh logic; background-safe.
- Deep linking
  - Configure `app.json` scheme and universal links; map redirect URIs in Supabase.
  - Validate flows on simulator and physical device (especially OAuth providers).
- UI
  - RN screens with form validation (shared validators where possible).
  - Error states, loading states, keyboard management.
- Security
  - Persist session in `expo-secure-store`; never in plaintext AsyncStorage.
  - Optional: biometric gate to re-open app when locked.
- Tests
  - Unit tests for auth manager and validators.
  - Integration test: mocked Supabase API; deep-link handling test.

Acceptance Criteria
- Users can sign in/sign up and remain authenticated across app restarts.
- Redirect-based OAuth works on cold/warm start; failure states handled.
- Tokens stored securely; no sensitive data in logs.

Dependencies
- Group 02 (app + scheme). Group 01 helpful for shared validators/types.

External Dependencies / Blockers
- Supabase OAuth provider configuration; Apple Sign-In optional.

Integration Points
- Consumes `@replay/shared` validators/types.
- Downstream groups rely on authenticated API access (e.g., experiences, uploads).

