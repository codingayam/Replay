import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

import { registerMeditationRoutes } from '../../routes/meditations.js';

const DEFAULT_USER = 'user-1';

function createMockApp() {
  const routes = { get: [], post: [], put: [], delete: [] };
  const app = {
    get(path, ...handlers) {
      routes.get.push({ path, handlers });
    },
    post(path, ...handlers) {
      routes.post.push({ path, handlers });
    },
    put(path, ...handlers) {
      routes.put.push({ path, handlers });
    },
    delete(path, ...handlers) {
      routes.delete.push({ path, handlers });
    }
  };
  return { app, routes };
}

function createMockResponse() {
  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(body) {
      jsonBody = body;
      return res;
    }
  };
  return {
    res,
    get statusCode() { return statusCode; },
    get json() { return jsonBody; }
  };
}

async function runHandlers(handlers, req, res) {
  for (const handler of handlers) {
    if (handler.length === 3) {
      await new Promise((resolve, reject) => {
        handler(req, res.res ?? res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      await handler(req, res.res ?? res);
    }
  }
}

function createRequireAuth(userId = DEFAULT_USER, email = `${DEFAULT_USER}@example.com`) {
  return () => (req, _res, next) => {
    req.auth = { userId, user: { email } };
    next();
  };
}

function createNotesBuilder(data) {
  return {
    select() { return this; },
    eq() { return this; },
    in() { return this; },
    order() { return Promise.resolve({ data, error: null }); },
    limit() { return this; },
    gte() { return this; },
    lte() { return this; },
    then(resolve) { return resolve({ data, error: null }); }
  };
}

function createProfilesBuilder(profile) {
  return {
    select() { return this; },
    eq() { return this; },
    limit() { return Promise.resolve({ data: profile ? [profile] : [], error: null }); },
    single() {
      return Promise.resolve({
        data: profile,
        error: profile ? null : { code: 'PGRST116' }
      });
    }
  };
}

function createMeditationsBuilder(state) {
  return {
    _last: null,
    select() { return this; },
    insert(payload) {
      const record = Array.isArray(payload) ? payload[0] : payload;
      const id = record.id ?? `meditation-${state.meditations.length + 1}`;
      const stored = { ...record, id };
      state.meditations.push(stored);
      this._last = stored;
      return this;
    },
    update(values) {
      this._last = { ...(this._last || {}), ...values };
      return this;
    },
    eq() { return this; },
    single() { return Promise.resolve({ data: this._last, error: null }); },
    order() { return Promise.resolve({ data: state.meditations, error: null }); },
    range() { return Promise.resolve({ data: state.meditations, error: null }); }
  };
}

function createJobsBuilder(state) {
  return {
    _last: null,
    insert(payload) {
      const record = Array.isArray(payload) ? payload[0] : payload;
      const stored = { ...record, id: `job-${state.jobs.length + 1}` };
      state.jobs.push(stored);
      this._last = stored;
      return this;
    },
    select() { return this; },
    single() { return Promise.resolve({ data: this._last, error: null }); }
  };
}

function createSupabaseMock({
  notes = [],
  profile = null
} = {}) {
  const state = {
    notes,
    profile,
    meditations: [],
    jobs: [],
    uploads: [],
    signedUrls: [],
    removals: []
  };

  return {
    state,
    storage: {
      from(bucket) {
        return {
          async createSignedUrl(path, ttl) {
            state.signedUrls.push({ bucket, path, ttl });
            return { data: { signedUrl: `signed://${bucket}/${path}` }, error: null };
          },
          async upload(path, buffer) {
            state.uploads.push({ bucket, path, size: buffer.length });
            return { data: {}, error: null };
          },
          async remove(paths) {
            state.removals = state.removals || [];
            state.removals.push({ bucket, paths });
            return { data: {}, error: null };
          }
        };
      }
    },
    from(table) {
      if (table === 'notes') {
        return createNotesBuilder(state.notes);
      }
      if (table === 'profiles') {
        return createProfilesBuilder(state.profile);
      }
      if (table === 'meditations') {
        return createMeditationsBuilder(state);
      }
      if (table === 'meditation_jobs') {
        return createJobsBuilder(state);
      }
      throw new Error(`Unexpected table ${table}`);
    }
  };
}

function createSilenceBuffer() {
  return Buffer.alloc(44, 0);
}

function mergeAudioBuffers(buffers) {
  return Buffer.concat(buffers);
}

function resolveVoiceSettings() {
  return { voice: 'af_nicole', speed: 0.7 };
}

const SIMPLE_AUDIO = Buffer.alloc(64, 1);

function stubFsForAudio(t) {
  t.mock.method(fs, 'existsSync', () => false);
  t.mock.method(fs, 'mkdirSync', () => {});
  t.mock.method(fs, 'writeFileSync', () => {});
  t.mock.method(fs, 'readFileSync', () => SIMPLE_AUDIO);
  t.mock.method(fs, 'rmSync', () => {});
}

test('POST /api/meditate generates custom day meditation and uploads audio', async (t) => {
  const { app, routes } = createMockApp();
  const supabase = createSupabaseMock({
    notes: [
      { id: 'note-1', transcript: 'Morning gratitude reflection', title: 'Sunrise', type: 'text', date: '2025-01-01' }
    ],
    profile: { name: 'Jordan', values: 'Curiosity', mission: 'Grow', thinking_about: 'Momentum' }
  });

  const modelScript = 'Breathe in.[PAUSE=2s]Set your intention.';

  const gemini = {
    getGenerativeModel: () => ({
      generateContent: async () => ({ response: { text: () => modelScript } })
    })
  };

  const replicateCalls = [];
  const replicate = {
    async run(model, input) {
      replicateCalls.push({ model, input });
      return {
        url: () => new URL('https://example.com/day-audio.wav')
      };
    }
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, arrayBuffer: async () => SIMPLE_AUDIO });
  t.after(() => {
    global.fetch = originalFetch;
  });

  stubFsForAudio(t);

  const transcodeCalls = [];
  const transcodeAudio = async (buffer) => {
    transcodeCalls.push(buffer.length);
    return {
      buffer,
      contentType: 'audio/mpeg',
      extension: 'mp3'
    };
  };

  registerMeditationRoutes({
    app,
    requireAuth: createRequireAuth(),
    supabase,
    uuidv4: () => 'meditation-day',
    gemini,
    replicate,
    createSilenceBuffer,
    mergeAudioBuffers,
    resolveVoiceSettings,
    processJobQueue: async () => {},
    transcodeAudio
  });

  const route = routes.post.find((r) => r.path === '/api/meditate');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, {
    auth: null,
    body: { noteIds: ['note-1'], reflectionType: 'Day', duration: 8, title: 'Morning Momentum' }
  }, resWrapper);

  assert.equal(resWrapper.statusCode, 201);
  assert.equal(transcodeCalls.length, 1);
  assert.ok(Array.isArray(resWrapper.json.playlist));
  assert.equal(resWrapper.json.playlist[0].audioUrl.startsWith('signed://'), true);
  assert.equal(supabase.state.uploads.length, 1);
  assert.ok(replicateCalls.length >= 1);

  const storedMeditation = supabase.state.meditations[0];
  assert.ok(storedMeditation.audio_storage_path);
  assert.equal(storedMeditation.audio_storage_path.endsWith('.mp3'), true);
  assert.equal(storedMeditation.audio_storage_path.endsWith('.mp3'), true);
  assert.ok(storedMeditation.audio_expires_at);
  assert.equal(typeof storedMeditation.summary, 'string');
});

test('POST /api/meditate generates custom night meditation and uploads audio', async (t) => {
  const { app, routes } = createMockApp();
  const supabase = createSupabaseMock({
    notes: [
      { id: 'note-1', transcript: 'End of day reflection', title: 'Evening', type: 'text', date: '2025-02-01' }
    ],
    profile: { name: 'Alex', values: 'Growth', mission: 'Inspire', thinking_about: 'Reflection' }
  });

  const modelScript = 'Take a breath.[PAUSE=2s]Continue your reflection.';

  const gemini = {
    getGenerativeModel: () => ({
      generateContent: async () => ({ response: { text: () => modelScript } })
    })
  };

  const replicateCalls = [];
  const replicate = {
    async run(model, input) {
      replicateCalls.push({ model, input });
      return {
        url: () => new URL('https://example.com/audio.wav')
      };
    }
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, arrayBuffer: async () => SIMPLE_AUDIO });
  t.after(() => {
    global.fetch = originalFetch;
  });

  stubFsForAudio(t);

  const transcodeCalls = [];
  const transcodeAudio = async (buffer) => {
    transcodeCalls.push(buffer.length);
    return {
      buffer,
      contentType: 'audio/mpeg',
      extension: 'mp3'
    };
  };

  registerMeditationRoutes({
    app,
    requireAuth: createRequireAuth(),
    supabase,
    uuidv4: () => 'meditation-night',
    gemini,
    replicate,
    createSilenceBuffer,
    mergeAudioBuffers,
    resolveVoiceSettings,
    processJobQueue: async () => {},
    transcodeAudio
  });

  const route = routes.post.find((r) => r.path === '/api/meditate');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, {
    auth: null,
    body: { noteIds: ['note-1'], reflectionType: 'Night', duration: 8, title: 'Evening Wind-down' }
  }, resWrapper);

  assert.equal(resWrapper.statusCode, 201);
  assert.equal(transcodeCalls.length, 1);
  assert.equal(supabase.state.uploads.length, 1);
  assert.equal(replicateCalls.length >= 1, true);

  const storedMeditation = supabase.state.meditations[0];
  assert.ok(storedMeditation.audio_storage_path);
  assert.ok(storedMeditation.audio_expires_at);
  assert.equal(Array.isArray(resWrapper.json.playlist), true);
  assert.equal(typeof resWrapper.json.summary, 'string');
});

test('POST /api/meditate/jobs creates background job and triggers queue processing', async (t) => {
  const { app, routes } = createMockApp();
  const supabase = createSupabaseMock();
  const processCalls = [];

  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => {
    processCalls.push('scheduled');
    fn();
    return 0;
  };
  t.after(() => {
    global.setTimeout = originalSetTimeout;
  });

  registerMeditationRoutes({
    app,
    requireAuth: createRequireAuth(),
    supabase,
    uuidv4: () => 'job-meditation',
    gemini: { getGenerativeModel: () => ({ generateContent: async () => ({ response: { text: () => '' } }) }) },
    replicate: { run: async () => ({ url: () => new URL('https://example.com/file.wav') }) },
    createSilenceBuffer,
    mergeAudioBuffers,
    resolveVoiceSettings,
    processJobQueue: async () => {
      processCalls.push('run');
    }
  });

  const route = routes.post.find((r) => r.path === '/api/meditate/jobs');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, {
    auth: null,
    body: { noteIds: ['note-1'], duration: 10, reflectionType: 'Night' }
  }, resWrapper);

  assert.equal(resWrapper.statusCode, 201);
  assert.equal(supabase.state.jobs.length, 1);
  assert.deepEqual(processCalls, ['scheduled', 'run']);
});

test('POST /api/meditations/:id/complete updates weekly progress after completion', async () => {
  const { app, routes } = createMockApp();

  const state = {
    meditations: [
      { id: 'meditation-1', user_id: DEFAULT_USER, completed_at: null, completion_percentage: 0 }
    ],
    updatedValues: null
  };

  const supabase = {
    from(table) {
      if (table !== 'meditations') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: (fields) => {
          if (fields === 'id, completed_at') {
            return {
              eq: (column, value) => ({
                eq: (column2, value2) => ({
                  single: () => {
                    const record = state.meditations.find((entry) => entry[column] === value && entry[column2] === value2);
                    return Promise.resolve({ data: record ? { id: record.id, completed_at: record.completed_at } : null, error: null });
                  }
                })
              })
            };
          }

          if (fields === 'completed_at') {
            return {
              eq: (column, value) => ({
                not: () => ({
                  order: () => {
                    const data = state.meditations
                      .filter((entry) => entry[column] === value && entry.completed_at !== null)
                      .map(({ completed_at }) => ({ completed_at }));
                    return Promise.resolve({ data, error: null });
                  }
                })
              })
            };
          }

          return this;
        },
        update: (values) => ({
          eq: (column, value) => ({
            eq: (column2, value2) => {
              state.meditations = state.meditations.map((entry) => {
                if (entry[column] === value && entry[column2] === value2) {
                  state.updatedValues = values;
                  return { ...entry, ...values };
                }
                return entry;
              });
              return { error: null };
            }
          })
        })
      };
    }
  };

  let incrementArgs = null;
  const progressRow = {
    week_start: '2025-05-19',
    journal_count: 4,
    meditation_count: 1,
    meditations_unlocked_at: '2025-05-20T00:00:00Z',
    eligible: true,
    next_report_at_utc: '2025-05-27T04:00:00Z'
  };

  const weeklyProgressOverrides = {
    loadUserTimezone: async ({ userId }) => {
      assert.equal(userId, DEFAULT_USER);
      return 'America/New_York';
    },
    incrementMeditationProgress: async (args) => {
      incrementArgs = args;
      return progressRow;
    },
    buildProgressSummary: (row, timezone) => ({
      weekStart: row.week_start,
      journalCount: row.journal_count ?? 0,
      meditationCount: row.meditation_count ?? 0,
      timezone,
      meditationsUnlocked: true,
      reportReady: true,
      reportSent: false,
      unlocksRemaining: 0,
      reportJournalRemaining: 0,
      reportMeditationRemaining: Math.max(1 - (row.meditation_count ?? 0), 0),
      nextReportDate: '2025-05-26',
      eligible: Boolean(row.eligible),
      nextReportAtUtc: row.next_report_at_utc ?? null,
      weekTimezone: timezone
    })
  };

  registerMeditationRoutes({
    app,
    requireAuth: createRequireAuth(),
    supabase,
    uuidv4: () => 'meditation-1',
    gemini: { getGenerativeModel: () => ({ generateContent: async () => ({ response: { text: () => '' } }) }) },
    replicate: { run: async () => ({ url: () => new URL('https://example.com/audio.wav') }) },
    createSilenceBuffer,
    mergeAudioBuffers,
    resolveVoiceSettings,
    processJobQueue: async () => {},
    transcodeAudio: async (buffer) => ({ buffer, contentType: 'audio/mpeg', extension: 'mp3' }),
    ffmpegPathResolver: () => 'ffmpeg',
    weeklyProgressOverrides
  });

  const route = routes.post.find((r) => r.path === '/api/meditations/:id/complete');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, {
    auth: null,
    params: { id: 'meditation-1' },
    body: { completionPercentage: 100, completedAt: '2025-05-20T12:00:00.000Z' }
  }, resWrapper);

  assert.equal(resWrapper.statusCode, 200);
  assert.equal(resWrapper.json.completed, true);
  assert.ok(resWrapper.json.weeklyProgress);
  assert.equal(resWrapper.json.weeklyProgress.weekStart, '2025-05-19');
  assert.equal(resWrapper.json.weeklyProgress.meditationCount, 1);
  assert.equal(resWrapper.json.weeklyProgress.timezone, 'America/New_York');
  assert.ok(state.updatedValues);
  assert.equal(state.updatedValues.completed_at, '2025-05-20T12:00:00.000Z');
  assert.ok(incrementArgs);
  assert.equal(incrementArgs.userId, DEFAULT_USER);
  assert.equal(incrementArgs.referenceDate, '2025-05-20T12:00:00.000Z');
  assert.equal(incrementArgs.eventTimestamp, '2025-05-20T12:00:00.000Z');
});
