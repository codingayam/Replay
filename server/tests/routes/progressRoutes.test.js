import test from 'node:test';
import assert from 'node:assert/strict';

import { registerProgressRoutes } from '../../routes/progress.js';

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
    get statusCode() {
      return statusCode;
    },
    get json() {
      return jsonBody;
    }
  };
}

function createRequireAuth() {
  return () => (req, _res, next) => {
    req.auth = { userId: 'user-1' };
    next();
  };
}

async function runHandlers(handlers, req, res) {
  let index = 0;
  async function runNext(err) {
    if (err) {
      throw err;
    }
    if (index >= handlers.length) {
      return;
    }
    const handler = handlers[index];
    index += 1;
    await handler(req, res.res, runNext);
  }
  await runNext();
}

test('GET /api/progress/week returns weekly summary', async () => {
  const { app, routes } = createMockApp();
  const supabase = {};

  const weeklyProgressOverrides = {
    loadUserTimezone: async () => 'Asia/Singapore',
    getCurrentWeekProgress: async () => ({
      progress: {
        week_start: '2025-05-19',
        journal_count: 4,
        meditation_count: 1,
        meditations_unlocked_at: '2025-05-20T00:00:00Z'
      },
      weekStart: '2025-05-19'
    }),
    buildProgressSummary: () => ({
      weekStart: '2025-05-19',
      journalCount: 4,
      meditationCount: 1,
      timezone: 'Asia/Singapore',
      eligible: true,
      nextReportAtUtc: '2025-05-26T04:00:00Z'
    })
  };

  registerProgressRoutes({
    app,
    requireAuth: createRequireAuth(),
    supabase,
    weeklyProgressOverrides
  });

  const route = routes.get.find((r) => r.path === '/api/progress/week');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, { auth: null, query: {} }, resWrapper);

  assert.equal(resWrapper.statusCode, 200);
  assert.equal(resWrapper.json.timezone, 'Asia/Singapore');
  assert.equal(resWrapper.json.weeklyProgress.weekStart, '2025-05-19');
  assert.equal(resWrapper.json.weeklyProgress.journalCount, 4);
  assert.equal(resWrapper.json.weeklyProgress.meditationCount, 1);
  assert.equal(resWrapper.json.weeklyProgress.timezone, 'Asia/Singapore');
  assert.equal(resWrapper.json.weeklyProgress.eligible, true);
  assert.equal(resWrapper.json.weeklyProgress.nextReportAtUtc, '2025-05-26T04:00:00Z');
});

const HISTORY_ROWS = [
  { week_start: '2025-05-19', journal_count: 5, meditation_count: 2 },
  { week_start: '2025-05-12', journal_count: 3, meditation_count: 1 }
];

test('GET /api/progress/history returns list of entries', async () => {
  const { app, routes } = createMockApp();
  const supabase = {
    from(table) {
      if (table !== 'weekly_progress') {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return Promise.resolve({ data: HISTORY_ROWS, error: null });
        }
      };
    }
  };

  const weeklyProgressOverrides = {
    loadUserTimezone: async () => 'America/New_York',
    getCurrentWeekProgress: async () => ({ progress: HISTORY_ROWS[0], weekStart: HISTORY_ROWS[0].week_start }),
    buildProgressSummary: (row, timezone) => ({
      weekStart: row.week_start,
      journalCount: row.journal_count,
      meditationCount: row.meditation_count,
      timezone,
      eligible: row.week_start === '2025-05-19',
      nextReportAtUtc: row.week_start === '2025-05-19' ? '2025-05-26T04:00:00Z' : null
    })
  };

  registerProgressRoutes({
    app,
    requireAuth: createRequireAuth(),
    supabase,
    weeklyProgressOverrides
  });

  const route = routes.get.find((r) => r.path === '/api/progress/history');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, { auth: null, query: { weeks: '2' } }, resWrapper);

  assert.equal(resWrapper.statusCode, 200);
  assert.equal(resWrapper.json.timezone, 'America/New_York');
  assert.equal(resWrapper.json.entries.length, 2);
  assert.equal(resWrapper.json.entries[0].weekStart, '2025-05-19');
  assert.equal(resWrapper.json.entries[0].journalCount, 5);
  assert.equal(resWrapper.json.entries[0].meditationCount, 2);
  assert.equal(resWrapper.json.entries[0].timezone, 'America/New_York');
  assert.equal(resWrapper.json.entries[0].eligible, true);
  assert.equal(resWrapper.json.entries[0].nextReportAtUtc, '2025-05-26T04:00:00Z');
  assert.equal(resWrapper.json.requestedWeeks, 2);
});
