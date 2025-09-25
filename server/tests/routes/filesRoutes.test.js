import test from 'node:test';
import assert from 'node:assert/strict';

import { registerFileRoutes } from '../../routes/files.js';

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

function createRequireAuth(userId = 'user-1') {
  return () => (req, _res, next) => {
    req.auth = { userId, user: { email: `${userId}@example.com` } };
    next();
  };
}

test('registerFileRoutes generates signed URL for matching user', async () => {
  const { app, routes } = createMockApp();
  const buckets = [];

  const supabase = {
    storage: {
      from(bucket) {
        buckets.push(bucket);
        return {
          async createSignedUrl(path, ttl) {
            assert.equal(ttl, 3600);
            return { data: { signedUrl: `signed://${bucket}/${path}` }, error: null };
          }
        };
      }
    }
  };

  registerFileRoutes({ app, requireAuth: createRequireAuth('user-1'), supabase });

  const route = routes.get.find((r) => r.path === '/api/files/images/:userId/:filename');
  assert.ok(route);

  const req = { auth: null, params: { userId: 'user-1', filename: 'photo.png' } };
  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, req, resWrapper);

  assert.equal(resWrapper.statusCode, 200);
  assert.deepEqual(resWrapper.json, { signedUrl: 'signed://images/user-1/photo.png' });
  assert.deepEqual(buckets, ['images']);
});

test('registerFileRoutes denies access for other users', async () => {
  const { app, routes } = createMockApp();
  let attempted = false;

  const supabase = {
    storage: {
      from() {
        attempted = true;
        return {
          async createSignedUrl() {
            return { data: null, error: null };
          }
        };
      }
    }
  };

  registerFileRoutes({ app, requireAuth: createRequireAuth('user-1'), supabase });

  const route = routes.get.find((r) => r.path === '/api/files/audio/:userId/:filename');
  assert.ok(route);

  const req = { auth: null, params: { userId: 'other-user', filename: 'note.mp3' } };
  const resWrapper = createMockResponse();
  await runHandlers(route.handlers, req, resWrapper);

  assert.equal(resWrapper.statusCode, 403);
  assert.deepEqual(resWrapper.json, { error: 'Access denied' });
  assert.equal(attempted, false);
});
