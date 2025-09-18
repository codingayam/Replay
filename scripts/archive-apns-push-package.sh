#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="client/push-package"
ARCHIVE_PATH="${1:-pushPackage.apns}"

if [[ ! -f "$PACKAGE_ROOT/manifest.json" ]]; then
  echo "Manifest missing. Run scripts/generate-apns-manifest.mjs first."
  exit 1
fi

if [[ ! -f "$PACKAGE_ROOT/signature" ]]; then
  echo "Signature missing. Run scripts/sign-apns-push-package.sh <AuthKey.p8>."
  exit 1
fi

(cd "$PACKAGE_ROOT" && zip -r "../$ARCHIVE_PATH" icon.iconset manifest.json website.json signature >/dev/null)

echo "Created push package archive at client/${ARCHIVE_PATH}"
