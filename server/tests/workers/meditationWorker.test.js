import test from 'node:test';
import assert from 'node:assert/strict';

const DEFAULT_USER = 'user-1';

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
  const notificationModule = await import('../../../services/notificationService.js');
  const sendPushMock = t.mock.method(notificationModule.default, 'sendPushNotification', async () => {});
  t.mock.method(notificationModule.default, 'logEvent', async () => {});

  const { supabase } = await import('../../middleware/auth.js');
  const originalFrom = supabase.from.bind(supabase);
  const originalStorage = supabase.storage;
  supabase.from = (...args) => supabaseProxy.from(...args);
  supabase.storage = { from: (...args) => supabaseProxy.storage.from(...args) };
  t.after(() => {
    supabase.from = originalFrom;
    supabase.storage = originalStorage;
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
  assert.equal(supabaseProxy.state.storageSigned.length, 1);
  assert.equal(sendPushMock.mock.calls.length, 1);
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

  const notificationModule = await import('../../../services/notificationService.js');
  t.mock.method(notificationModule.default, 'sendPushNotification', async () => {});

  const { supabase } = await import('../../middleware/auth.js');
  const originalFrom = supabase.from.bind(supabase);
  const originalStorage = supabase.storage;
  supabase.from = (...args) => supabaseProxy.from(...args);
  supabase.storage = { from: (...args) => supabaseProxy.storage.from(...args) };
  t.after(() => {
    supabase.from = originalFrom;
    supabase.storage = originalStorage;
  });

  const moduleSpecifier = `../../server.js?queue=${Date.now()}`;
  const serverModule = await import(moduleSpecifier);

  await serverModule.processJobQueue();

  assert.equal(supabaseProxy.state.jobUpdates[0].values.status, 'processing');
  assert.equal(supabaseProxy.state.jobUpdates[supabaseProxy.state.jobUpdates.length - 1].values.status, 'completed');
  assert.equal(supabaseProxy.state.meditations.length, 1);
});
