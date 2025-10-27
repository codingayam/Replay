import test from 'node:test';
import assert from 'node:assert/strict';

const DEFAULT_USER = 'user-1';
const SIMPLE_AUDIO = Buffer.alloc(64, 1);

function createSupabaseProxy() {
  const proxy = {
    scenario: {},
    state: {},
    setScenario(scenario) {
      proxy.scenario = {
        notes: [],
        profile: null,
        pendingJobs: [],
        signedUrl: 'signed://meditations/default.wav',
        ...scenario
      };
      proxy.state = {
        jobUpdates: [],
        meditations: [],
        storageSigned: [],
        uploads: []
      };
    },
    storage: {
      from(bucket) {
        return {
          async createSignedUrl(path, ttl) {
            proxy.state.storageSigned.push({ bucket, path, ttl });
            return { data: { signedUrl: proxy.scenario.signedUrl }, error: null };
          },
          async upload(path, buffer) {
            proxy.state.uploads.push({ bucket, path, size: buffer?.length ?? 0 });
            return { data: { path }, error: null };
          }
        };
      }
    },
    from(table) {
      const scenario = proxy.scenario;
      const state = proxy.state;
      switch (table) {
        case 'meditation_jobs':
          return {
            update(values) {
              state.jobUpdates.push({ table, values, filters: [] });
              const builder = {
                eq(field, value) {
                  const entry = state.jobUpdates[state.jobUpdates.length - 1];
                  entry.filters.push({ field, value });
                  return builder;
                },
                select() { return builder; },
                single() {
                  const base = scenario.pendingJobs?.[0] || {};
                  return Promise.resolve({ data: { ...base, ...values }, error: null });
                }
              };
              return builder;
            },
            select() {
              const builder = {
                eq() { return builder; },
                order() { return builder; },
                limit() {
                  return Promise.resolve({ data: scenario.pendingJobs || [], error: null });
                }
              };
              return builder;
            }
          };
        case 'notes':
          return {
            select() { return this; },
            eq() { return this; },
            in() { return Promise.resolve({ data: scenario.notes || [], error: null }); }
          };
        case 'profiles':
          return {
            select() { return this; },
            eq() { return this; },
            single() { return Promise.resolve({ data: scenario.profile, error: null }); }
          };
        case 'meditations':
          return {
            insert(payload) {
              const record = Array.isArray(payload) ? payload[0] : payload;
              const stored = { ...record, id: record.id || 'meditation-generated' };
              state.meditations.push(stored);
              this._record = stored;
              return this;
            },
            select() { return this; },
            single() { return Promise.resolve({ data: this._record, error: null }); }
          };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    }
  };
  proxy.setScenario({});
  return proxy;
}

function createDayScenario() {
  return {
    notes: [
      {
        id: 'note-1',
        title: 'Journal',
        transcript: 'Grateful for today',
        type: 'text',
        date: '2025-01-01'
      }
    ],
    profile: {
      name: 'Jamie',
      values: 'Compassion',
      mission: 'Grow',
      thinking_about: 'Balance'
    }
  };
}

test('processMeditationJob completes day reflection jobs', async (t) => {
  process.env.REPLAY_SKIP_SERVER_START = '1';
  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';

  const supabaseProxy = createSupabaseProxy();
  const { supabase } = await import('../../middleware/auth.js');
  const originalFrom = supabase.from.bind(supabase);
  const originalStorage = supabase.storage;
  supabase.from = (...args) => supabaseProxy.from(...args);
  supabase.storage = { from: (...args) => supabaseProxy.storage.from(...args) };
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, arrayBuffer: async () => SIMPLE_AUDIO });
  const replicatePrediction = { id: 'pred-worker-day', output: 'https://example.com/worker-day.wav' };
  const replicateStub = {
    deployments: {
      predictions: {
        async create() {
          return replicatePrediction;
        }
      }
    },
    async wait(prediction) {
      return prediction;
    }
  };
  const geminiStub = {
    getGenerativeModel: () => ({
      generateContent: async () => ({ response: { text: () => 'Center yourself.[PAUSE=2s]Begin your day.' } })
    })
  };
  const transcodeStub = async (buffer) => ({
    buffer,
    contentType: 'audio/mpeg',
    extension: 'mp3'
  });
  globalThis.__REPLAY_TEST_REPLICATE__ = replicateStub;
  globalThis.__REPLAY_TEST_GEMINI__ = geminiStub;
  globalThis.__REPLAY_TEST_TRANSCODE__ = transcodeStub;
  t.after(() => {
    supabase.from = originalFrom;
    supabase.storage = originalStorage;
    global.fetch = originalFetch;
    delete globalThis.__REPLAY_TEST_REPLICATE__;
    delete globalThis.__REPLAY_TEST_GEMINI__;
    delete globalThis.__REPLAY_TEST_TRANSCODE__;
  });

  supabaseProxy.setScenario(createDayScenario());

  const { processMeditationJob } = await import(`../../server.js?day=${Date.now()}`);

  const job = {
    id: 'job-1',
    user_id: DEFAULT_USER,
    note_ids: ['note-1'],
    duration: 10,
    reflection_type: 'Day'
  };

  await processMeditationJob(job);

  assert.equal(supabaseProxy.state.jobUpdates.length, 2);
  assert.equal(supabaseProxy.state.meditations.length, 1);
  assert.equal(supabaseProxy.state.uploads.length, 1);
  assert.equal(supabaseProxy.state.uploads[0].path.endsWith('.mp3'), true);
  assert.equal(supabaseProxy.state.storageSigned.length >= 1, true);
});

test('processJobQueue claims pending job and delegates to worker', async (t) => {
  process.env.REPLAY_SKIP_SERVER_START = '1';
  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';

  const supabaseProxy = createSupabaseProxy();
  supabaseProxy.setScenario({
    ...createDayScenario(),
    pendingJobs: [
      {
        id: 'job-queue-1',
        user_id: DEFAULT_USER,
        note_ids: ['note-1'],
        duration: 5,
        reflection_type: 'Day',
        status: 'pending'
      }
    ]
  });

  const { supabase } = await import('../../middleware/auth.js');
  const originalFrom = supabase.from.bind(supabase);
  const originalStorage = supabase.storage;
  supabase.from = (...args) => supabaseProxy.from(...args);
  supabase.storage = { from: (...args) => supabaseProxy.storage.from(...args) };
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, arrayBuffer: async () => SIMPLE_AUDIO });
  const replicatePrediction = { id: 'pred-worker-queue', output: 'https://example.com/worker-day.wav' };
  const replicateStub = {
    deployments: {
      predictions: {
        async create() {
          return replicatePrediction;
        }
      }
    },
    async wait(prediction) {
      return prediction;
    }
  };
  const geminiStub = {
    getGenerativeModel: () => ({
      generateContent: async () => ({ response: { text: () => 'Center yourself.[PAUSE=2s]Begin your day.' } })
    })
  };
  const transcodeStub = async (buffer) => ({
    buffer,
    contentType: 'audio/mpeg',
    extension: 'mp3'
  });
  globalThis.__REPLAY_TEST_REPLICATE__ = replicateStub;
  globalThis.__REPLAY_TEST_GEMINI__ = geminiStub;
  globalThis.__REPLAY_TEST_TRANSCODE__ = transcodeStub;
  t.after(() => {
    supabase.from = originalFrom;
    supabase.storage = originalStorage;
    global.fetch = originalFetch;
    delete globalThis.__REPLAY_TEST_REPLICATE__;
    delete globalThis.__REPLAY_TEST_GEMINI__;
    delete globalThis.__REPLAY_TEST_TRANSCODE__;
  });

  const moduleSpecifier = `../../server.js?queue=${Date.now()}`;
  const serverModule = await import(moduleSpecifier);

  await serverModule.processJobQueue();

  assert.equal(supabaseProxy.state.jobUpdates[0].values.status, 'processing');
  assert.equal(supabaseProxy.state.jobUpdates[supabaseProxy.state.jobUpdates.length - 1].values.status, 'completed');
  assert.equal(supabaseProxy.state.meditations.length, 1);
  assert.equal(supabaseProxy.state.uploads.length, 1);
  assert.equal(supabaseProxy.state.uploads[0].path.endsWith('.mp3'), true);
});
