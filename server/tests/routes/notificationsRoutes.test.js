import test from 'node:test';
import assert from 'node:assert/strict';

import moment from 'moment-timezone';
import { registerNotificationRoutes } from '../../routes/notifications.js';

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

test('registerNotificationRoutes enforces metrics token and returns snapshot', async () => {
  const { app, routes } = createMockApp();

  const requireAuth = () => (_req, _res, next) => next();

  const snapshot = { tokensRegistered: 5 };

  registerNotificationRoutes({
    app,
    requireAuth,
    supabase: { from: () => ({ select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) },
    notificationService: {
      normalizeToken: (token) => token,
      logEvent: async () => {},
      getDefaultPreferences: () => ({ enabled: true })
    },
    getMetricsSnapshot: () => snapshot,
    recordTokenRegistration: () => {},
    moment,
    notificationMetricsToken: 'secret-token'
  });

  const route = routes.get.find((r) => r.path === '/api/internal/notifications/metrics');
  assert.ok(route, 'metrics route registered');

  const resWrapper = createMockResponse();
  const req = { headers: { 'x-notification-admin-token': 'secret-token' } };
  await route.handlers[0](req, resWrapper.res);

  assert.equal(resWrapper.statusCode, 200);
  assert.deepEqual(resWrapper.json, snapshot);
});

test('registerNotificationRoutes returns default preferences when none stored', async () => {
  const { app, routes } = createMockApp();

  const requireAuth = () => (req, _res, next) => {
    req.auth = { userId: 'user-42', user: { email: 'user@example.com' } };
    next();
  };

  const supabase = {
    from(table) {
      if (table === 'notification_preferences') {
        return {
          select() { return this; },
          eq() { return this; },
          limit() { return Promise.resolve({ data: [], error: null }); }
        };
      }

      if (table === 'profiles') {
        return {
          select() { return this; },
          eq() { return this; },
          limit() { return Promise.resolve({ data: [{ push_channel_preference: 'apns' }], error: null }); }
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }
  };

  const defaultPreferences = { enabled: true, daily_reminder: { enabled: true, time: '20:00' } };
  const notificationService = {
    normalizeToken: (token) => token,
    logEvent: async () => {},
    getDefaultPreferences: () => defaultPreferences
  };

  registerNotificationRoutes({
    app,
    requireAuth,
    supabase,
    notificationService,
    getMetricsSnapshot: () => ({}),
    recordTokenRegistration: () => {},
    moment,
    notificationMetricsToken: 'secret-token'
  });

  const route = routes.get.find((r) => r.path === '/api/notifications/preferences');
  assert.ok(route, 'preferences route registered');

  const req = { auth: null };
  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, req, resWrapper);

  assert.equal(resWrapper.statusCode, 200);
  assert.deepEqual(resWrapper.json, {
    preferences: defaultPreferences,
    push_channel_preference: 'apns'
  });
});

