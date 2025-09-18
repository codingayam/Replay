#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="client/push-package"
MANIFEST_PATH="$PACKAGE_ROOT/manifest.json"
OUTPUT_PATH="$PACKAGE_ROOT/signature"
APNS_KEY_PATH="${1:-}"

if [[ -z "$APNS_KEY_PATH" ]]; then
  echo "Usage: $0 path/to/AuthKey.p8"
  exit 1
fi

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "Manifest not found at $MANIFEST_PATH. Run scripts/generate-apns-manifest.mjs first."
  exit 1
fi

if [[ ! -f "$APNS_KEY_PATH" ]]; then
  echo "APNs key not found at $APNS_KEY_PATH"
  exit 1
fi

openssl dgst -sha256 -sign "$APNS_KEY_PATH" -out "$OUTPUT_PATH" "$MANIFEST_PATH"

echo "Signature written to $OUTPUT_PATH"
