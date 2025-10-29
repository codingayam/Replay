#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import createWeeklyReportWorker from '../workers/weeklyReportWorker.js';
import { createWeeklyReportSupabaseStub } from '../utils/testing/createWeeklyReportSupabaseStub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(rawArgs) {
  const defaults = {
    fixture: path.resolve(__dirname, 'fixtures/weeklyReportSample.json'),
    outDir: path.resolve(__dirname, '../temp'),
    now: null,
    verbose: false
  };

  return rawArgs.reduce((options, arg) => {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }

    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
      return options;
    }

    const [key, value] = arg.split('=');

    switch (key) {
      case '--fixture':
        if (!value) {
          throw new Error('Missing value for --fixture option');
        }
        options.fixture = path.resolve(process.cwd(), value);
        break;
      case '--out':
        if (!value) {
          throw new Error('Missing value for --out option');
        }
        options.outDir = path.resolve(process.cwd(), value);
        break;
      case '--now':
        if (!value) {
          throw new Error('Missing value for --now option');
        }
        options.now = value;
        break;
      default:
        console.warn(`Ignoring unrecognised argument: ${arg}`);
        break;
    }

    return options;
  }, { ...defaults });
}

function loadFixture(fixturePath) {
  const contents = fs.readFileSync(fixturePath, 'utf8');
  const data = JSON.parse(contents);

  if (!Array.isArray(data.progressRows) || data.progressRows.length === 0) {
    throw new Error('Fixture must include at least one entry in "progressRows"');
  }

  return data;
}

function createGeminiStub(fixture) {
  if (fixture.gemini === false) {
    return null;
  }

  const text = fixture.gemini?.text ?? fixture.geminiSummary ?? '## Highlights\n- You stayed consistent this week.';

  return {
    getGenerativeModel: () => ({
      generateContent: async () => ({
        response: {
          text: () => text
        }
      })
    })
  };
}

function ensureDirectory(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function prettyPrint(obj) {
  return JSON.stringify(obj, null, 2);
}

function writeOutputFiles(outDir, email) {
  ensureDirectory(outDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const htmlPath = path.join(outDir, `weekly-report-preview-${timestamp}.html`);
  const textPath = path.join(outDir, `weekly-report-preview-${timestamp}.txt`);

  fs.writeFileSync(htmlPath, email.html, 'utf8');
  fs.writeFileSync(textPath, email.text, 'utf8');

  return { htmlPath, textPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(`Usage: node scripts/previewWeeklyReport.js [--fixture=path] [--out=path] [--now=ISO] [--verbose]\n\n` +
      `Generates a local weekly report email using stubbed Supabase data.\n` +
      `- --fixture: Path to JSON fixture (defaults to fixtures/weeklyReportSample.json).\n` +
      `- --out: Directory to write preview files (defaults to server/temp).\n` +
      `- --now: ISO timestamp to evaluate schedule logic (defaults to fixture.now or current time).\n` +
      `- --verbose: Print captured email payload and final progress row.`);
    return;
  }

  const fixture = loadFixture(options.fixture);
  const supabase = createWeeklyReportSupabaseStub({
    progressRows: fixture.progressRows,
    notes: fixture.notes ?? [],
    meditations: fixture.meditations ?? [],
    user: fixture.user ?? null,
    profile: fixture.profile ?? null,
    weeklyReports: fixture.weeklyReports ?? []
  });

  const resendCapture = [];
  const resendClient = {
    async sendEmail(payload) {
      resendCapture.push(payload);
      return { id: 'preview-message-id' };
    }
  };

  const logger = {
    info: (...args) => options.verbose && console.info('[info]', ...args),
    warn: (...args) => console.warn('[warn]', ...args),
    error: (...args) => console.error('[error]', ...args)
  };

  const gemini = createGeminiStub(fixture);
  const worker = createWeeklyReportWorker({
    supabase,
    gemini,
    resendClient,
    logger
  });

  const nowInput = options.now ?? fixture.now ?? new Date().toISOString();
  const now = new Date(nowInput);
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid --now timestamp: ${nowInput}`);
  }

  const result = await worker.run(now);

  if (options.verbose) {
    console.log('Worker result:', prettyPrint(result));
  }

  const email = resendCapture[0];
  if (!email) {
    console.warn('No email was generated. Check fixture eligibility and schedule.');
    return;
  }

  const paths = writeOutputFiles(options.outDir, email);

  console.log('Weekly report preview generated.');
  console.log(`Subject: ${email.subject}`);
  console.log(`HTML preview: ${paths.htmlPath}`);
  console.log(`Text preview: ${paths.textPath}`);

  if (options.verbose) {
    console.log('Captured email payload:', prettyPrint(email));
    console.log('Final weekly_progress row:', prettyPrint(supabase.state.progressRows[0]));
  }
}

main().catch((error) => {
  console.error('Preview generation failed:', error);
  process.exit(1);
});
