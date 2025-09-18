import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_ENV_PATH = 'client/.env';
const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const envPath = resolve(process.cwd(), process.argv[2] ?? DEFAULT_ENV_PATH);

let rawEnv;
try {
  rawEnv = readFileSync(envPath, 'utf8');
} catch (error) {
  console.error(`Unable to read env file at ${envPath}. Pass the path as the first argument.`);
  process.exit(1);
}

const envMap = {};
for (const line of rawEnv.split(/\r?\n/)) {
  if (!line || line.trim().startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  const key = line.slice(0, idx).trim();
  const value = line.slice(idx + 1).trim();
  envMap[key] = value;
}

const missingKeys = REQUIRED_KEYS.filter((key) => !envMap[key]);
if (missingKeys.length > 0) {
  console.error('Missing Firebase keys in env file:', missingKeys.join(', '));
  process.exit(1);
}

const config = `self.__REPLAY_FIREBASE_CONFIG = ${JSON.stringify({
  apiKey: envMap['VITE_FIREBASE_API_KEY'],
  authDomain: envMap['VITE_FIREBASE_AUTH_DOMAIN'],
  projectId: envMap['VITE_FIREBASE_PROJECT_ID'],
  storageBucket: envMap['VITE_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: envMap['VITE_FIREBASE_MESSAGING_SENDER_ID'],
  appId: envMap['VITE_FIREBASE_APP_ID']
}, null, 2)};\n`;

const outputPath = resolve(process.cwd(), 'firebase-sw-config.js');
writeFileSync(outputPath, config, 'utf8');
console.log(`Firebase messaging config written to ${outputPath}. Keep this file out of source control.`);
