import test from 'node:test';
import assert from 'node:assert/strict';

import { registerStatsRoutes } from '../../routes/stats.js';

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

function createMeditationsBuilder(responses) {
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  return {
    select() { return this; },
    eq() { return this; },
    not() { return this; },
    order() {
      return Promise.resolve(queue.shift() ?? { data: [], error: null });
    },
    gte() { return this; },
    lte() {
      return Promise.resolve(queue.shift() ?? { data: [], error: null });
    }
  };
}

function requireAuth() {
  return (req, _res, next) => {
    req.auth = { userId: 'user-1', user: { email: 'user@example.com' } };
    next();
  };
}

test('registerStatsRoutes calendar endpoint returns unique ISO dates', async () => {
  const { app, routes } = createMockApp();

  const meditationsData = [
    { completed_at: '2025-01-01T10:00:00.000Z' },
    { completed_at: '2025-01-01T12:00:00.000Z' },
    { completed_at: '2025-01-02T08:00:00.000Z' }
  ];

  const notesData = [
    { date: '2025-01-02' },
    { date: '2025-01-03' },
    { date: null, created_at: '2025-01-04T09:15:00.000Z' }
  ];

  const supabase = {
    from(table) {
      if (table === 'meditations') {
        return createMeditationsBuilder({ data: meditationsData, error: null });
      }
      if (table === 'notes') {
        return {
          select() { return this; },
          eq() { return this; },
          order() {
            return Promise.resolve({ data: notesData, error: null });
          }
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }
  };

  registerStatsRoutes({ app, requireAuth, supabase });

  const route = routes.get.find((r) => r.path === '/api/stats/calendar');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, { auth: null }, resWrapper);

  assert.equal(resWrapper.statusCode, 200);
  assert.deepEqual(resWrapper.json.reflections.sort(), ['2025-01-01', '2025-01-02']);
  assert.deepEqual(resWrapper.json.dates.sort(), ['2025-01-01', '2025-01-02']);
  assert.deepEqual(resWrapper.json.journals.sort(), ['2025-01-02', '2025-01-03', '2025-01-04']);
});
