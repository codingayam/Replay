# Group 02 — Mobile Bootstrap (Expo + TS + EAS)

Effort: M

Overview
- Initialize the React Native app using Expo Managed workflow with a Custom Dev Client (Dev Client) for native needs like RNBU, plus TypeScript, React Navigation, and NativeWind.
- Configure EAS for repeatable iOS builds (simulator/device) using dev-client profiles and enable running on simulators early.
- Establish base test/lint scaffolding for mobile code to enable parallel feature development.

Deliverables
- `mobile/` app initialized with Expo + TS; configured app.json/app.config for bundle ID, scheme, deep links placeholder.
- EAS project configured (`eas.json`, `eas build` works for iOS simulator and device).
- React Navigation, NativeWind, Safe Area, and basic screen scaffolding.
- Jest + React Native Testing Library setup with one sample test.

Tasks
- Project init
  - `npx create-expo-app mobile --template` (TypeScript template) and adopt workspace settings.
  - Configure `app.json` with bundle identifier, scheme (e.g., `replay://`), and iOS permissions (microphone, photo library).
  - Add `NativeWind`, `react-native-safe-area-context`, `@react-navigation/native` and stack/tab dependencies.
- Build & run
  - Configure `eas.json` for development using a Custom Dev Client (`dev-client` profile) and preview builds.
  - Create an EAS project, link Apple Developer account, and set up provisioning.
  - Verify: run on iOS simulator; produce first `eas build -p ios --profile development`.
- Developer experience
  - Add ESLint config aligned with repo standards; Prettier optional if used.
  - Add Jest + RN Testing Library configuration; example component test.
  - Document `npm scripts` to run app, tests, and EAS builds.

Acceptance Criteria
- App boots in iOS simulator with a placeholder Home screen and navigation.
- EAS development build succeeds and installs on simulator or device.
- Jest unit test executes successfully in CI/local.

Dependencies
- Group 01 optional (to consume shared code later), but not required for initial bootstrap.

External Dependencies / Blockers
- Apple Developer account access for provisioning.
- Xcode + iOS simulators installed.

Integration Points
- Consumes `@replay/shared` as it becomes available.
- Deep link scheme reserved for Group 04 (Auth).

Notes
- Use Expo Managed workflow with a Custom Dev Client consistently when RNBU/native modules are in play (see Group 05).
- Keep profiles: dev-client for development/testing; preview/release for TestFlight/app store.
