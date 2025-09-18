# Safari Web Push Package

This directory contains the scaffolding required to build the Safari (APNs) web push package for Replay.

## Contents
- `icon.iconset/` – Generated icon resources sized per Apple guidelines.
- `website.json` – Template metadata describing allowed domains and authentication token.
- `manifest.json` – SHA-256 digest manifest produced from the assets.
- `signature` – Generated during signing (never commit).
- `pushPackage.apns` – Zip archive produced when packaging (never commit).

## Workflow
1. `npm run push:setup-icons` – Regenerates the icon set (idempotent).
2. Edit `website.json` to set the production service URL and authentication token.
3. `npm run push:manifest` – Regenerate `manifest.json` after any asset change.
4. `npm run push:sign -- path/to/AuthKey.p8` – Sign the manifest with the APNs `.p8` key.
5. `npm run push:archive -- pushPackage.apns` – Build the push package zip.
6. `npm run push:validate` – Ensures the manifest matches the assets (hash check).

The signing step requires exporting the `.p8` key from secure secret storage. Do not store the generated `signature` or `.p8` files in git.
