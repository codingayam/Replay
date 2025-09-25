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

  const upload = { single: () => (_req, _res, next) => next() };
  const uuidv4 = () => 'uuid';
  const gemini = { getGenerativeModel: () => ({ generateContent: async () => ({ response: { text: () => '' } }) }) };

  registerNotesRoutes({ app, requireAuth, supabase, upload, uuidv4, gemini });

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
        audioUrl: 'audio/path',
        originalCaption: 'caption',
        aiImageDescription: 'desc',
        image_url: undefined,
        audio_url: undefined,
        original_caption: undefined,
        ai_image_description: undefined
      }
    ]
  });
});
