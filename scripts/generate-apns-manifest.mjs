import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PACKAGE_ROOT = resolve('client', 'push-package');
const FILES = [
  'website.json',
  'icon.iconset/icon_16x16.png',
  'icon.iconset/icon_16x16@2x.png',
  'icon.iconset/icon_32x32.png',
  'icon.iconset/icon_32x32@2x.png',
  'icon.iconset/icon_128x128.png',
  'icon.iconset/icon_256x256.png'
];

const manifest = {};

for (const file of FILES) {
  const absPath = resolve(PACKAGE_ROOT, file);
  const contents = readFileSync(absPath);
  const hash = createHash('sha256').update(contents).digest('base64');
  manifest[file] = hash;
}

const manifestPath = resolve(PACKAGE_ROOT, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${manifestPath}`);
