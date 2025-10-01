import test from 'node:test';
import assert from 'node:assert/strict';

import { registerOneSignalRoutes } from '../../routes/onesignal.js';

function createMockApp() {
  const routes = { post: [] };
  return {
    routes,
    post(path, ...handlers) {
      routes.post.push({ path, handlers });
    }
  };
}

function createRequireAuth() {
  return () => (req, _res, next) => {
    req.auth = { userId: 'user-7' };
    next();
  };
}

function createMockResponse() {
  let statusCode = 200;
  let payload = null;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(body) {
      payload = body;
      return res;
    }
  };
  return {
    res,
    get statusCode() {
      return statusCode;
    },
    get json() {
      return payload;
    }
  };
}

test('sync-tags route recomputes and attaches alias when subscription provided', async () => {
  const mockApp = createMockApp();
  const recompute = test.mock.fn(async () => ({
    updated: true,
    weekKey: '2024-21',
    tags: { weekly_week_key: '2024-21' },
    summary: { journalCount: 4 },
    lastSyncAt: '2024-05-23T12:00:00Z'
  }));

  const attachMock = test.mock.fn(async () => ({ ok: true }));

  registerOneSignalRoutes({
    app: mockApp,
    requireAuth: createRequireAuth(),
    supabase: {},
    recomputeWeeklyProgress: recompute,
    onesignalOverrides: {
      onesignalEnabled: () => true,
      attachExternalIdToSubscription: attachMock
    }
  });

  const route = mockApp.routes.post.find((r) => r.path === '/internal/onesignal/sync-tags');
  assert.ok(route, 'Route should be registered');

  const mockReq = {
    auth: { userId: 'user-7' },
    body: { subscriptionId: 'sub-abc' },
    headers: {}
  };
  const resWrapper = createMockResponse();

  for (const handler of route.handlers) {
    await handler(mockReq, resWrapper.res, () => {});
  }

  assert.equal(recompute.mock.calls.length, 1);
  assert.equal(recompute.mock.calls[0].arguments[0].userId, 'user-7');
  assert.equal(attachMock.mock.calls.length, 1);
  assert.equal(attachMock.mock.calls[0].arguments[0], 'sub-abc');
  assert.equal(resWrapper.statusCode, 200);
  assert.equal(resWrapper.json.status, 'updated');
  assert.equal(resWrapper.json.weekKey, '2024-21');
});

test('sync-tags route skips alias when not provided and returns skipped status', async () => {
  const mockApp = createMockApp();
  const recompute = test.mock.fn(async () => ({
    updated: false,
    weekKey: '2024-21',
    tags: { weekly_week_key: '2024-21' },
    summary: {},
    lastSyncAt: '2024-05-23T12:00:00Z'
  }));

  const attachMock = test.mock.fn();

  registerOneSignalRoutes({
    app: mockApp,
    requireAuth: createRequireAuth(),
    supabase: {},
    recomputeWeeklyProgress: recompute,
    onesignalOverrides: {
      onesignalEnabled: () => false,
      attachExternalIdToSubscription: attachMock
    }
  });

  const route = mockApp.routes.post.find((r) => r.path === '/internal/onesignal/sync-tags');
  assert.ok(route);

  const mockReq = {
    auth: { userId: 'user-7' },
    body: {},
    headers: {}
  };
  const resWrapper = createMockResponse();

  for (const handler of route.handlers) {
    await handler(mockReq, resWrapper.res, () => {});
  }

  assert.equal(recompute.mock.calls.length, 1);
  assert.equal(attachMock.mock.calls.length, 0, 'Should not attach alias when disabled');
  assert.equal(resWrapper.json.status, 'skipped');
});
