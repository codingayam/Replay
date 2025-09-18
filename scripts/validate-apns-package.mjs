import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PACKAGE_ROOT = resolve('client', 'push-package');
const manifestPath = resolve(PACKAGE_ROOT, 'manifest.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let isValid = true;

for (const [file, expectedHash] of Object.entries(manifest)) {
  const absPath = resolve(PACKAGE_ROOT, file);
  if (!existsSync(absPath)) {
    console.error(`Missing file listed in manifest: ${file}`);
    isValid = false;
    continue;
  }
  const actualHash = createHash('sha256').update(readFileSync(absPath)).digest('base64');
  if (actualHash !== expectedHash) {
    console.error(`Hash mismatch for ${file}. Expected ${expectedHash} but found ${actualHash}`);
    isValid = false;
  }
}

const signaturePath = resolve(PACKAGE_ROOT, 'signature');
if (!existsSync(signaturePath)) {
  console.warn('Signature file not found. Run scripts/sign-apns-push-package.sh after generating your .p8 key.');
}

if (!isValid) {
  console.error('Push package validation failed.');
  process.exit(1);
}

console.log('Push package manifest validated.');
