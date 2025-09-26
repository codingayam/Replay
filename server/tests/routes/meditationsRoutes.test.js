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

test('POST /api/meditate serves pre-recorded day meditation', async (t) => {
  const { app, routes } = createMockApp();
  const supabase = createSupabaseMock({
    notes: [
      { id: 'note-1', transcript: 'Ref', title: 'Day Note', type: 'text', date: '2025-01-01' }
    ]
  });

  registerMeditationRoutes({
    app,
    requireAuth: createRequireAuth(),
    supabase,
    uuidv4: () => 'meditation-1',
    gemini: { getGenerativeModel: () => ({ generateContent: async () => ({ response: { text: () => '' } }) }) },
    replicate: { run: async () => { throw new Error('should not run replicate for day meditation'); } },
    createSilenceBuffer,
    mergeAudioBuffers,
    resolveVoiceSettings,
    processJobQueue: async () => {}
  });

  const route = routes.post.find((r) => r.path === '/api/meditate');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, {
    auth: null,
    body: { noteIds: ['note-1'], reflectionType: 'Day', duration: 10 }
  }, resWrapper);

  assert.equal(resWrapper.statusCode, 200);
  assert.equal(resWrapper.json.success, true);
  assert.equal(resWrapper.json.meditation.title, 'Daily Reflection');
  assert.ok(resWrapper.json.expiresAt);
  assert.ok(Array.isArray(resWrapper.json.playlist));
  assert.equal(resWrapper.json.playlist[0].audioUrl, 'signed://meditations/default/day-meditation.wav');

  const storedMeditation = supabase.state.meditations[0];
  assert.equal(storedMeditation.audio_storage_path, 'default/day-meditation.wav');
  assert.ok(storedMeditation.audio_expires_at);
  assert.equal(storedMeditation.playlist[0].audioUrl, 'default/day-meditation.wav');
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
    processJobQueue: async () => {}
  });

  const route = routes.post.find((r) => r.path === '/api/meditate');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, {
    auth: null,
    body: { noteIds: ['note-1'], reflectionType: 'Night', duration: 8, title: 'Evening Wind-down' }
  }, resWrapper);

  assert.equal(resWrapper.statusCode, 201);
  assert.equal(supabase.state.uploads.length, 1);
  assert.equal(replicateCalls.length >= 1, true);

  const storedMeditation = supabase.state.meditations[0];
  assert.ok(storedMeditation.audio_storage_path);
  assert.ok(storedMeditation.audio_expires_at);
  assert.equal(Array.isArray(resWrapper.json.playlist), true);
  assert.equal(typeof resWrapper.json.summary, 'string');
});

test('POST /api/replay/radio generates show and playlist', async (t) => {
  const { app, routes } = createMockApp();
  const supabase = createSupabaseMock({
    notes: [
      { id: 'note-1', transcript: 'Idea alpha', title: 'Idea', type: 'text', date: '2025-03-01' }
    ],
    profile: { name: 'Jordan', values: 'Curiosity', mission: 'Explore', thinking_about: 'Innovation' }
  });

  const radioScript = 'Speaker 1: Welcome listeners!\nSpeaker 2: Great to be here!';
  const gemini = {
    getGenerativeModel: () => ({
      generateContent: async () => ({ response: { text: () => radioScript } })
    })
  };

  const replicate = {
    async run() {
      return { url: () => new URL('https://example.com/segment.wav') };
    }
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, arrayBuffer: async () => SIMPLE_AUDIO });
  t.after(() => {
    global.fetch = originalFetch;
  });

  stubFsForAudio(t);

  registerMeditationRoutes({
    app,
    requireAuth: createRequireAuth(),
    supabase,
    uuidv4: () => 'radio-1',
    gemini,
    replicate,
    createSilenceBuffer,
    mergeAudioBuffers,
    resolveVoiceSettings,
    processJobQueue: async () => {}
  });

  const route = routes.post.find((r) => r.path === '/api/replay/radio');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, {
    auth: null,
    body: { noteIds: ['note-1'], duration: 5, title: 'Replay Radio' }
  }, resWrapper);

  assert.equal(resWrapper.statusCode, 200);
  assert.equal(supabase.state.uploads.length, 1);
  assert.equal(resWrapper.json.radioShow.user_id, DEFAULT_USER);
  assert.ok(resWrapper.json.title);
  assert.ok(resWrapper.json.summary);
  const storedRadioShow = supabase.state.meditations[0];
  assert.ok(storedRadioShow.audio_storage_path);
  assert.ok(storedRadioShow.audio_expires_at);
  assert.equal(storedRadioShow.playlist[0].audioUrl, `${DEFAULT_USER}/radio_radio-1.wav`);
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
