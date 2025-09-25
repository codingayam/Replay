import test from 'node:test';
import assert from 'node:assert/strict';

import { registerProfileRoutes } from '../../routes/profile.js';

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

test('registerProfileRoutes returns null profile when none exists', async () => {
  const { app, routes } = createMockApp();

  const requireAuth = () => (req, _res, next) => {
    req.auth = { userId: 'user-1', user: { email: 'user@example.com' } };
    next();
  };

  const supabase = {
    from(table) {
      if (table === 'profiles') {
        return {
          select() { return this; },
          eq() { return this; },
          single() { return Promise.resolve({ data: null, error: { code: 'PGRST116' } }); }
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }
  };

  const upload = { single: () => (_req, _res, next) => next() };
  const uuidv4 = () => 'uuid';

  registerProfileRoutes({ app, requireAuth, supabase, upload, uuidv4 });

  const route = routes.get.find((r) => r.path === '/api/profile');
  assert.ok(route);

  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, { auth: null }, resWrapper);

  assert.equal(resWrapper.statusCode, 200);
  assert.deepEqual(resWrapper.json, { profile: null });
});

test('registerProfileRoutes updates existing profile', async () => {
  const { app, routes } = createMockApp();

  const requireAuth = () => (req, _res, next) => {
    req.auth = { userId: 'user-1', user: { email: 'user@example.com' } };
    next();
  };

  let updatePayload = null;
  const supabase = {
    from(table) {
      if (table === 'profiles') {
        return {
          select() { return this; },
          eq() { return this; },
          single() { return Promise.resolve({ data: { id: 'profile-1' }, error: null }); },
          update(values) {
            updatePayload = values;
            return this;
          }
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }
  };

  const upload = { single: () => (_req, _res, next) => next() };
  const uuidv4 = () => 'uuid';

  registerProfileRoutes({ app, requireAuth, supabase, upload, uuidv4 });

  const route = routes.post.find((r) => r.path === '/api/profile');
  assert.ok(route);

  const req = { auth: null, body: { name: 'Test', values: 'Kindness', mission: 'Grow', thinking_about: 'AI' } };
  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, req, resWrapper);

  assert.equal(resWrapper.statusCode, 200);
  assert.ok(updatePayload);
  assert.equal(updatePayload.name, 'Test');
});

