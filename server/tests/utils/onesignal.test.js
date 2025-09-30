import test from 'node:test';
import assert from 'node:assert/strict';

// Mock environment variables
const originalEnv = process.env;

test.beforeEach(() => {
  process.env = {
    ...originalEnv,
    ONESIGNAL_APP_ID: 'test-app-id',
    ONESIGNAL_REST_API_KEY: 'test-rest-key',
    ONESIGNAL_ENABLED: 'true',
    ONESIGNAL_CUSTOM_EVENTS: 'true',
    NODE_ENV: 'test'
  };
});

test.afterEach(() => {
  process.env = originalEnv;
});

// Import after env setup
let onesignal;

test.before(async () => {
  // Set env before importing
  process.env.ONESIGNAL_APP_ID = 'test-app-id';
  process.env.ONESIGNAL_REST_API_KEY = 'test-rest-key';
  process.env.NODE_ENV = 'production'; // Bypass test environment check

  onesignal = await import('../../utils/onesignal.js');
});

test('onesignalEnabled returns false in test environment', async () => {
  process.env.NODE_ENV = 'test';
  const module = await import('../../utils/onesignal.js?cachebust=1');
  assert.equal(module.onesignalEnabled(), false);
});

test('onesignalEnabled returns false when ONESIGNAL_ENABLED is "false"', async () => {
  process.env.ONESIGNAL_ENABLED = 'false';
  process.env.NODE_ENV = 'production';
  const module = await import('../../utils/onesignal.js?cachebust=2');
  assert.equal(module.onesignalEnabled(), false);
});

test('onesignalEnabled returns false when credentials missing', async () => {
  delete process.env.ONESIGNAL_APP_ID;
  process.env.NODE_ENV = 'production';
  const module = await import('../../utils/onesignal.js?cachebust=3');
  assert.equal(module.onesignalEnabled(), false);
});

test('updateOneSignalUser skips when not configured', async () => {
  process.env.NODE_ENV = 'test';
  const module = await import('../../utils/onesignal.js?cachebust=4');

  const result = await module.updateOneSignalUser('user-123', { tag1: 'value1' });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'not_configured');
});

test('updateOneSignalUser skips when no external ID', async () => {
  const result = await onesignal.updateOneSignalUser(null, { tag1: 'value1' });
  assert.equal(result.skipped, true);
});

test('updateOneSignalUser skips when no tags', async () => {
  const result = await onesignal.updateOneSignalUser('user-123', {});
  assert.equal(result.skipped, true);
});

test('updateOneSignalUser filters out null/undefined values', async () => {
  // Mock fetch
  const originalFetch = global.fetch;
  let capturedBody;

  global.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    };
  };

  try {
    await onesignal.updateOneSignalUser('user-123', {
      tag1: 'value1',
      tag2: null,
      tag3: undefined,
      tag4: 'value4'
    });

    assert.deepEqual(capturedBody.tags, {
      tag1: 'value1',
      tag4: 'value4'
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('updateOneSignalUser converts all values to strings', async () => {
  const originalFetch = global.fetch;
  let capturedBody;

  global.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    };
  };

  try {
    await onesignal.updateOneSignalUser('user-123', {
      string_tag: 'hello',
      number_tag: 42,
      boolean_tag: true
    });

    assert.equal(capturedBody.tags.string_tag, 'hello');
    assert.equal(capturedBody.tags.number_tag, '42');
    assert.equal(capturedBody.tags.boolean_tag, 'true');
    assert.equal(typeof capturedBody.tags.number_tag, 'string');
    assert.equal(typeof capturedBody.tags.boolean_tag, 'string');
  } finally {
    global.fetch = originalFetch;
  }
});

test('sendOneSignalNotification targets by external_id', async () => {
  const originalFetch = global.fetch;
  let capturedBody;

  global.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'notif-123' })
    };
  };

  try {
    await onesignal.sendOneSignalNotification({
      externalId: 'user-123',
      headings: { en: 'Test' },
      contents: { en: 'Message' }
    });

    assert.equal(capturedBody.app_id, 'test-app-id');
    assert.deepEqual(capturedBody.include_aliases, { external_id: ['user-123'] });
    assert.deepEqual(capturedBody.headings, { en: 'Test' });
  } finally {
    global.fetch = originalFetch;
  }
});

test('sendOneSignalNotification targets by subscription_id when no external_id', async () => {
  const originalFetch = global.fetch;
  let capturedBody;

  global.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'notif-123' })
    };
  };

  try {
    await onesignal.sendOneSignalNotification({
      subscriptionId: 'sub-123',
      headings: { en: 'Test' },
      contents: { en: 'Message' }
    });

    assert.deepEqual(capturedBody.include_player_ids, ['sub-123']);
    assert.equal(capturedBody.include_aliases, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test('sendOneSignalNotification skips when no target', async () => {
  const result = await onesignal.sendOneSignalNotification({
    headings: { en: 'Test' },
    contents: { en: 'Message' }
  });

  assert.equal(result.skipped, true);
});

test('attachExternalIdToSubscription handles 409 conflict gracefully', async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => {
    return {
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () => 'Alias already exists'
    };
  };

  try {
    const result = await onesignal.attachExternalIdToSubscription('sub-123', 'user-123');
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'alias_exists');
  } finally {
    global.fetch = originalFetch;
  }
});

test('attachExternalIdToSubscription throws on other errors', async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => {
    return {
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => 'Internal error'
    };
  };

  try {
    await assert.rejects(
      async () => await onesignal.attachExternalIdToSubscription('sub-123', 'user-123'),
      /OneSignal PATCH/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('onesignalCustomEventsEnabled returns false when flag not set', async () => {
  delete process.env.ONESIGNAL_CUSTOM_EVENTS;
  process.env.NODE_ENV = 'production';
  const module = await import('../../utils/onesignal.js?cachebust=5');
  assert.equal(module.onesignalCustomEventsEnabled(), false);
});

test('sendOneSignalEvent skips when custom events disabled', async () => {
  delete process.env.ONESIGNAL_CUSTOM_EVENTS;
  process.env.NODE_ENV = 'production';
  const module = await import('../../utils/onesignal.js?cachebust=6');

  const result = await module.sendOneSignalEvent('user-123', 'test_event', { data: 'value' });
  assert.equal(result.skipped, true);
});

test('sendOneSignalEvent sends event when enabled', async () => {
  const originalFetch = global.fetch;
  let capturedBody;

  global.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    };
  };

  try {
    await onesignal.sendOneSignalEvent('user-123', 'meditation_completed', {
      meditation_id: 'med-456',
      duration: 300
    });

    assert.equal(Array.isArray(capturedBody.events), true);
    assert.equal(capturedBody.events.length, 1);
    assert.equal(capturedBody.events[0].external_id, 'user-123');
    assert.equal(capturedBody.events[0].name, 'meditation_completed');
    assert.deepEqual(capturedBody.events[0].payload, {
      meditation_id: 'med-456',
      duration: 300
    });
  } finally {
    global.fetch = originalFetch;
  }
});