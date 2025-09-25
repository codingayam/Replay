import test from 'node:test';
import assert from 'node:assert/strict';

import { registerAuthRoutes, __TEST_ONLY__ } from '../../routes/auth.js';

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

test('registerAuthRoutes triggers Supabase reset and returns cooldown metadata', async () => {
  const { app, routes } = createMockApp();
  let capturedEmail = null;
  let capturedOptions = null;
  let callCount = 0;

  const supabase = {
    auth: {
      async resetPasswordForEmail(email, options) {
        callCount += 1;
        capturedEmail = email;
        capturedOptions = options;
        return { data: null, error: null };
      }
    }
  };

  const originalRedirect = process.env.PASSWORD_RESET_REDIRECT_URL;
  process.env.PASSWORD_RESET_REDIRECT_URL = 'https://app.example.com/reset-password';

  try {
    registerAuthRoutes({ app, supabase });
    const route = routes.post.find((r) => r.path === '/api/auth/forgot-password');
    assert.ok(route, 'forgot password route should be registered');
    assert.equal(route.handlers.length, 2, 'password reset route should include rate limiter');

    const handler = route.handlers[1];
    const resWrapper = createMockResponse();
    __TEST_ONLY__.clearPasswordResetCooldowns();

    const req = { body: { email: 'Person@example.com ' } };
    await handler(req, resWrapper.res);

    assert.equal(resWrapper.statusCode, 200);
    assert.deepEqual(resWrapper.json, {
      message: 'Password reset email sent.',
      cooldownSeconds: 60
    });
    assert.equal(callCount, 1);
    assert.equal(capturedEmail, 'person@example.com');
    assert.deepEqual(capturedOptions, { redirectTo: 'https://app.example.com/reset-password' });
  } finally {
    process.env.PASSWORD_RESET_REDIRECT_URL = originalRedirect;
  }
});

test('registerAuthRoutes rejects invalid email addresses', async () => {
  const { app, routes } = createMockApp();
  const supabase = {
    auth: {
      async resetPasswordForEmail() {
        throw new Error('should not be called');
      }
    }
  };

  registerAuthRoutes({ app, supabase });
  const route = routes.post.find((r) => r.path === '/api/auth/forgot-password');
  assert.ok(route);

  const handler = route.handlers[1];
  __TEST_ONLY__.clearPasswordResetCooldowns();
  const resWrapper = createMockResponse();

  await handler({ body: { email: 'invalid-email' } }, resWrapper.res);

  assert.equal(resWrapper.statusCode, 400);
  assert.deepEqual(resWrapper.json, { error: 'Please provide a valid email address.' });
});

test('registerAuthRoutes enforces per-email cooldown', async () => {
  const { app, routes } = createMockApp();
  let callCount = 0;
  const supabase = {
    auth: {
      async resetPasswordForEmail() {
        callCount += 1;
        return { data: null, error: null };
      }
    }
  };

  registerAuthRoutes({ app, supabase });
  const route = routes.post.find((r) => r.path === '/api/auth/forgot-password');
  assert.ok(route);

  const handler = route.handlers[1];
  __TEST_ONLY__.clearPasswordResetCooldowns();

  const firstResponse = createMockResponse();
  await handler({ body: { email: 'cooldown@example.com' } }, firstResponse.res);
  assert.equal(firstResponse.statusCode, 200);
  assert.equal(callCount, 1);

  const secondResponse = createMockResponse();
  await handler({ body: { email: 'cooldown@example.com' } }, secondResponse.res);
  assert.equal(secondResponse.statusCode, 429);
  assert.equal(callCount, 1, 'second request should be blocked before reaching Supabase');
  assert.equal(secondResponse.json.error, 'Please wait before requesting another reset email.');
  assert.ok(secondResponse.json.retryAfter > 0);
});
