import test from 'node:test';
import assert from 'node:assert/strict';

import { registerNotesRoutes } from '../../routes/notes.js';

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
  return { res, get statusCode() { return statusCode; }, get json() { return jsonBody; } };
}

function runRequireAuth(handler, req) {
  return new Promise((resolve, reject) => {
    try {
      handler(req, {}, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function runMiddleware(handler, req, res) {
  return new Promise((resolve, reject) => {
    try {
      handler(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function computeReportRemaining(journalCount = 0, meditationCount = 0) {
  const journalsNeededOnly = Math.max(5 - journalCount, 0);
  const journalsNeededCombo = Math.max(3 - journalCount, 0);
  const medNeededCombo = Math.max(1 - meditationCount, 0);

  const comboTaskCount = journalsNeededCombo + medNeededCombo;
  const journalOnlyTaskCount = journalsNeededOnly;
  const useComboPath = comboTaskCount === 0 ? true : comboTaskCount <= journalOnlyTaskCount;

  return {
    reportJournalRemaining: useComboPath ? Math.max(journalsNeededCombo, 0) : Math.max(journalsNeededOnly, 0),
    reportMeditationRemaining: useComboPath ? Math.max(medNeededCombo, 0) : 0
  };
}

function createWeeklyProgressOverrides() {
  return {
    loadUserTimezone: async () => 'America/New_York',
    incrementJournalProgress: async () => ({
      week_start: '2025-05-19',
      journal_count: 1,
      meditation_count: 0,
      eligible: false,
      next_report_at_utc: null,
      weekly_report_sent_at: null,
      weekly_report_ready_at: null
    }),
    decrementJournalProgress: async () => ({
      week_start: '2025-05-19',
      journal_count: 0,
      meditation_count: 0,
      eligible: false,
      next_report_at_utc: null,
      weekly_report_sent_at: null,
      weekly_report_ready_at: null
    }),
    buildProgressSummary: () => {
      const remaining = computeReportRemaining(1, 0);
      return {
        weekStart: '2025-05-19',
        journalCount: 1,
        meditationCount: 0,
        meditationsUnlocked: true,
        reportReady: false,
        reportSent: false,
        timezone: 'America/New_York',
        unlocksRemaining: 0,
        reportJournalRemaining: remaining.reportJournalRemaining,
        reportMeditationRemaining: remaining.reportMeditationRemaining,
        nextReportDate: '2025-05-26',
        eligible: false,
        nextReportAtUtc: null,
        weekTimezone: 'America/New_York'
      };
    }
  };
}

test('registerNotesRoutes transforms snake_case note fields for GET /api/notes', async () => {
  const { app, routes } = createMockApp();

  const supabaseQuery = {
    select() { return this; },
    eq() { return this; },
    order() {
      return Promise.resolve({
        data: [
          {
            id: 'note-1',
            title: 'Test',
            image_url: 'image/path',
            image_urls: ['image/path', 'image/path-2'],
            audio_url: 'audio/path',
            original_caption: 'caption',
            ai_image_description: 'desc'
          }
        ],
        error: null
      });
    }
  };

  const supabase = {
    from(table) {
      assert.equal(table, 'notes');
      return supabaseQuery;
    }
  };

  const requireAuth = () => (req, _res, next) => {
    req.auth = { userId: 'user-123', user: { email: 'user@example.com' } };
    next();
  };

  const upload = { 
    single: () => (_req, _res, next) => next(),
    array: () => (_req, _res, next) => next()
  };
  const uuidv4 = () => 'uuid';
  const gemini = { getGenerativeModel: () => ({ generateContent: async () => ({ response: { text: () => '' } }) }) };

  const weeklyProgressOverrides = createWeeklyProgressOverrides();

  registerNotesRoutes({ app, requireAuth, supabase, upload, uuidv4, gemini, weeklyProgressOverrides });

  const route = routes.get.find((r) => r.path === '/api/notes');
  assert.ok(route, 'notes route should be registered');

  const [authMiddleware, handler] = route.handlers;
  const req = { auth: null };
  await runRequireAuth(authMiddleware, req);

  const resWrapper = createMockResponse();
  await handler(req, resWrapper.res);

  assert.equal(resWrapper.statusCode, 200);
  assert.ok(resWrapper.json);
  assert.deepEqual(resWrapper.json, {
      notes: [
      {
        id: 'note-1',
        title: 'Test',
        imageUrl: 'image/path',
        imageUrls: ['image/path', 'image/path-2'],
        audioUrl: 'audio/path',
        originalCaption: 'caption',
        aiImageDescription: 'desc',
        image_url: undefined,
        image_urls: undefined,
        audio_url: undefined,
        original_caption: undefined,
        ai_image_description: undefined
      }
    ]
  });
});

test('POST /api/notes creates note without storing audio file', async () => {
  const { app, routes } = createMockApp();

  let storageCalled = false;
  const insertedRecords = [];

  const supabase = {
    from(table) {
      assert.equal(table, 'notes');
      return {
        insert(records) {
          const clonedRecords = records.map((record) => ({ ...record }));
          insertedRecords.push(...clonedRecords);
          const inserted = { ...clonedRecords[0] };
          return {
            select() { return this; },
            single() {
              return Promise.resolve({ data: inserted, error: null });
            }
          };
        }
      };
    },
    storage: {
      from() {
        storageCalled = true;
        throw new Error('storage.from should not be called when creating audio notes');
      }
    }
  };

  const requireAuth = () => (req, _res, next) => {
    req.auth = { userId: 'user-123', user: { email: 'user@example.com' } };
    next();
  };

  const upload = {
    single: () => (_req, _res, next) => next(),
    array: () => (_req, _res, next) => next()
  };

  const uuidv4 = () => 'note-123';
  const gemini = {
    getGenerativeModel: () => ({
      generateContent: async (input) => {
        if (Array.isArray(input)) {
          return { response: { text: () => 'Transcribed audio text' } };
        }
        return { response: { text: () => 'Generated Audio Title' } };
      }
    })
  };

  const weeklyProgressOverrides = createWeeklyProgressOverrides();

  registerNotesRoutes({
    app,
    requireAuth,
    supabase,
    upload,
    uuidv4,
    gemini,
    weeklyProgressOverrides,
    onesignalOverrides: { onesignalEnabled: () => false }
  });

  const route = routes.post.find((r) => r.path === '/api/notes');
  assert.ok(route, 'audio note creation route should be registered');

  const [authMiddleware, uploadMiddleware, handler] = route.handlers;
  const req = {
    auth: null,
    headers: {},
    body: { date: '2025-05-20T12:00:00.000Z' },
    file: {
      buffer: Buffer.from('fake audio'),
      mimetype: 'audio/wav',
      originalname: 'note.wav'
    }
  };

  const resWrapper = createMockResponse();

  await runRequireAuth(authMiddleware, req);
  await runMiddleware(uploadMiddleware, req, resWrapper.res);
  await handler(req, resWrapper.res);

  assert.equal(resWrapper.statusCode, 201);
  assert.equal(storageCalled, false);
  assert.equal(insertedRecords.length, 1);
  assert.equal(insertedRecords[0].audio_url, null);
  assert.equal(resWrapper.json.note.audio_url, null);
  assert.equal(resWrapper.json.note.title, 'Generated Audio Title');
  assert.equal(resWrapper.json.note.transcript, 'Transcribed audio text');
  assert.ok(resWrapper.json.weeklyProgress);
});

test('DELETE /api/notes/:id decrements weekly progress and returns summary', async () => {
  const { app, routes } = createMockApp();

  const noteRecord = {
    id: 'note-1',
    user_id: 'user-123',
    type: 'text',
    date: '2025-05-20T12:00:00.000Z'
  };

  const progressRowBase = {
    week_start: '2025-05-19',
    journal_count: 1,
    meditation_count: 0,
    meditations_unlocked_at: '2025-05-19T12:00:00.000Z',
    eligible: false,
    next_report_at_utc: null,
    weekly_report_ready_at: null,
    weekly_report_sent_at: null
  };

  const notesBuilder = {
    select() { return this; },
    eq() { return this; },
    single: async () => ({ data: noteRecord, error: null }),
    delete() {
      return {
        eq() {
          return {
            eq() {
              return Promise.resolve({ error: null });
            }
          };
        }
      };
    }
  };

  const supabase = {
    from(table) {
      assert.equal(table, 'notes');
      return notesBuilder;
    },
    storage: {
      from() {
        return {
          remove: async () => ({ error: null })
        };
      }
    }
  };

  const requireAuth = () => (req, _res, next) => {
    req.auth = { userId: 'user-123', user: { email: 'user@example.com' } };
    next();
  };

  const upload = { 
    single: () => (_req, _res, next) => next(),
    array: () => (_req, _res, next) => next()
  };
  const uuidv4 = () => 'uuid';
  const gemini = { getGenerativeModel: () => ({ generateContent: async () => ({ response: { text: () => '' } }) }) };

  let decrementArgs = null;
  const weeklyProgressOverrides = {
    loadUserTimezone: async () => 'America/New_York',
    incrementJournalProgress: async () => progressRowBase,
    decrementJournalProgress: async (args) => {
      decrementArgs = args;
      return {
        ...progressRowBase,
        journal_count: 0,
        meditation_count: 0,
        meditations_unlocked_at: null,
        eligible: false,
        next_report_at_utc: null,
        weekly_report_ready_at: null,
        weekly_report_sent_at: null
      };
    },
    buildProgressSummary: (progress) => {
      const remaining = computeReportRemaining(progress.journal_count ?? 0, progress.meditation_count ?? 0);
      return {
        weekStart: progress.week_start ?? '2025-05-19',
        journalCount: progress.journal_count ?? 0,
        meditationCount: progress.meditation_count ?? 0,
        meditationsUnlocked: true,
        reportReady: Boolean(progress.weekly_report_ready_at),
        reportSent: Boolean(progress.weekly_report_sent_at),
        timezone: 'America/New_York',
        unlocksRemaining: 0,
        reportJournalRemaining: remaining.reportJournalRemaining,
        reportMeditationRemaining: remaining.reportMeditationRemaining,
        nextReportDate: '2025-05-27',
        eligible: Boolean(progress.eligible),
        nextReportAtUtc: progress.next_report_at_utc ?? null,
        weekTimezone: 'America/New_York'
      };
    }
  };

  registerNotesRoutes({ app, requireAuth, supabase, upload, uuidv4, gemini, weeklyProgressOverrides });

  const route = routes.delete.find((r) => r.path === '/api/notes/:id');
  assert.ok(route, 'delete route should be registered');

  const [authMiddleware, handler] = route.handlers;
  const req = { auth: null, params: { id: 'note-1' } };
  await runRequireAuth(authMiddleware, req);

  const resWrapper = createMockResponse();
  await handler(req, resWrapper.res);

  assert.equal(resWrapper.statusCode, 200);
  assert.ok(decrementArgs, 'decrementJournalProgress should be called');
  assert.equal(decrementArgs?.noteDate, noteRecord.date);
  assert.deepEqual(resWrapper.json, {
    message: 'Note deleted successfully',
    weeklyProgress: {
      weekStart: '2025-05-19',
      journalCount: 0,
      meditationCount: 0,
      meditationsUnlocked: true,
      reportReady: false,
      reportSent: false,
      timezone: 'America/New_York',
      unlocksRemaining: 0,
      reportJournalRemaining: 3,
      reportMeditationRemaining: 1,
      nextReportDate: '2025-05-27',
      eligible: false,
      nextReportAtUtc: null,
      weekTimezone: 'America/New_York'
    }
  });
});
