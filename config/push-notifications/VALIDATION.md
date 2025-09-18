# Push Notification Credential Validation

## Firebase Cloud Messaging
- [ ] Run Firebase Messaging web quickstart locally (Chromium-based browser).
- [ ] Confirm registration token returned in dev tools console.
- [ ] Send test message via Firebase console using the token.
- [ ] Verify notification received by client.

Record date, engineer, and browser version in the ops log after each validation run.

## Safari Web Push Package
- [ ] Run `npm run push:manifest` after adjusting assets.
- [ ] Sign package with `npm run push:sign -- path/to/AuthKey.p8`.
- [ ] Validate manifest hashing: `npm run push:validate`.
- [ ] Upload package to Apple tester or run `web-push-id-validate` for final confirmation.

Document validation output (command logs or screenshots) in the ops knowledge base for auditability.
