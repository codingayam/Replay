import test from 'node:test';
import assert from 'node:assert/strict';
import moment from 'moment-timezone';
import notificationService from '../../services/notificationService.js';

function createNotificationHistoryBuilder({ counts = [], onInsert } = {}) {
  const pendingCounts = [...counts];
  const builder = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.gte = () => Promise.resolve({ count: pendingCounts.shift() ?? 0 });
  builder.insert = async (payload) => {
    onInsert?.(payload);
    return { data: null, error: null };
  };
  builder.order = () => builder;
  builder.range = () => Promise.resolve({ data: [], error: null, count: 0 });
  builder.not = () => builder;
  builder.lt = () => builder;
  builder.gt = () => builder;
  return builder;
}

function createNotificationDeviceBuilder({ onDelete } = {}) {
  return {
    delete() {
      return {
        eq(column, value) {
          if (column === 'token') {
            onDelete?.(value);
          }
          return Promise.resolve({ error: null });
        }
      };
    }
  };
}

function buildSupabaseClient({ history, devices } = {}) {
  return {
    from(table) {
      if (table === 'notification_history') {
        return createNotificationHistoryBuilder(history);
      }

      if (table === 'notification_devices' && devices) {
        return createNotificationDeviceBuilder(devices);
      }

      throw new Error(`Unexpected table request: ${table}`);
    }
  };
}

function withSupabaseStub(t, config) {
  const original = notificationService.getSupabaseClient.bind(notificationService);
  notificationService.getSupabaseClient = () => buildSupabaseClient(config);
  t.after(() => {
    notificationService.getSupabaseClient = original;
  });
}

test.beforeEach((t) => {
  notificationService.initialized = true;
  t.mock.method(notificationService, 'logEvent', async () => {});
  t.mock.method(notificationService, 'enqueueRetry', async () => {});
});

test.afterEach((t) => {
  t.mock.restoreAll();
});

test('determineChannel respects explicit preferences', () => {
  const user = {
    push_channel_preference: 'apns'
  };
  const devices = [
    { push_provider: 'apns', token: 'token-apns', platform: 'safari', last_registered_at: new Date().toISOString() }
  ];

  const { channel, device } = notificationService.determineChannel(user, devices);

  assert.equal(channel, 'apns');
  assert.equal(device, devices[0]);
});

test('determineChannel falls back to FCM when auto and safari not available', () => {
  const user = {
    push_channel_preference: 'auto'
  };
  const devices = [
    { push_provider: 'fcm', token: 'token-fcm', platform: 'chrome', last_registered_at: new Date().toISOString() }
  ];

  const { channel } = notificationService.determineChannel(user, devices);
  assert.equal(channel, 'fcm');
});

test('determineChannel prefers APNs when auto and safari browser', () => {
  const user = {
    push_channel_preference: 'auto'
  };
  const devices = [
    { push_provider: 'apns', token: 'token-apns', platform: 'safari', last_registered_at: new Date().toISOString() },
    { push_provider: 'fcm', token: 'token-fcm', platform: 'chrome', last_registered_at: new Date(Date.now() - 1000).toISOString() }
  ];

  const { channel } = notificationService.determineChannel(user, devices);
  assert.equal(channel, 'apns');
});

test('isNotificationEnabled enforces global toggle and per-type preferences', () => {
  assert.equal(notificationService.isNotificationEnabled(undefined, 'daily_reminder'), false);

  const prefs = {
    enabled: true,
    daily_reminder: { enabled: false },
    meditation_ready: { enabled: true }
  };

  assert.equal(notificationService.isNotificationEnabled(prefs, 'daily_reminder'), false);
  assert.equal(notificationService.isNotificationEnabled(prefs, 'meditation_ready'), true);

  const disabled = { enabled: false, meditation_ready: { enabled: true } };
  assert.equal(notificationService.isNotificationEnabled(disabled, 'meditation_ready'), false);
});

test('sendPushNotification short-circuits when notification type disabled', async (t) => {
  const context = {
    profile: {
      user_id: 'user-1',
      push_channel_preference: 'fcm'
    },
    preferences: {
      enabled: true,
      meditation_ready: { enabled: false }
    },
    devices: [
      { push_provider: 'fcm', token: 'token-fcm', last_registered_at: new Date().toISOString() }
    ]
  };

  const clientConfig = {
    history: { counts: [0, 0] }
  };

  withSupabaseStub(t, clientConfig);
  t.mock.method(notificationService, 'fetchUserNotificationContext', async () => context);
  const fcmSpy = t.mock.method(notificationService, 'sendFCMNotification', async () => ({ success: true }));
  const apnsSpy = t.mock.method(notificationService, 'sendAppleWebPushNotification', async () => ({ success: true }));
  const enqueueSpy = t.mock.method(notificationService, 'enqueueRetry', async () => {});

  const result = await notificationService.sendPushNotification('user-1', {
    type: 'meditation_ready',
    title: 'Test',
    body: 'Body',
    data: {}
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, 'notifications_disabled');
  assert.equal(fcmSpy.mock.callCount(), 0);
  assert.equal(apnsSpy.mock.callCount(), 0);
  assert.equal(enqueueSpy.mock.callCount(), 0);
});

test('sendPushNotification routes through FCM when preference set', async (t) => {
  const inserted = [];

  const clientConfig = {
    history: {
      counts: [0, 0],
      onInsert: (row) => inserted.push(row)
    }
  };

  withSupabaseStub(t, clientConfig);
  t.mock.method(notificationService, 'fetchUserNotificationContext', async () => ({
    profile: {
      user_id: 'user-2',
      push_channel_preference: 'fcm'
    },
    preferences: {
      enabled: true,
      meditation_ready: { enabled: true }
    },
    devices: [
      { push_provider: 'fcm', token: 'token-fcm', last_registered_at: new Date().toISOString() }
    ]
  }));
  const fcmSpy = t.mock.method(notificationService, 'sendFCMNotification', async () => ({ success: true, messageId: 'mid' }));
  const apnsSpy = t.mock.method(notificationService, 'sendAppleWebPushNotification', async () => ({ success: true }));
  const enqueueSpy = t.mock.method(notificationService, 'enqueueRetry', async () => {});

  const result = await notificationService.sendPushNotification('user-2', {
    type: 'meditation_ready',
    title: 'Ready',
    body: 'Listen now',
    data: { url: '/' }
  });

  assert.equal(result.success, true);
  assert.equal(result.channel, 'fcm');
  assert.equal(fcmSpy.mock.callCount(), 1);
  assert.equal(apnsSpy.mock.callCount(), 0);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].channel, 'fcm');
  assert.equal(inserted[0].error, null);
  assert.equal(enqueueSpy.mock.callCount(), 0);
});

test('sendPushNotification logs failure details when transport throws', async (t) => {
  const inserted = [];

  const clientConfig = {
    history: {
      counts: [0, 0],
      onInsert: (row) => inserted.push(row)
    }
  };

  withSupabaseStub(t, clientConfig);
  t.mock.method(notificationService, 'fetchUserNotificationContext', async () => ({
    profile: {
      user_id: 'user-3',
      push_channel_preference: 'fcm'
    },
    preferences: {
      enabled: true,
      meditation_ready: { enabled: true }
    },
    devices: [
      { push_provider: 'fcm', token: 'token-fcm', last_registered_at: new Date().toISOString() }
    ]
  }));
  const transportSpy = t.mock.method(notificationService, 'sendFCMNotification', async () => {
    throw new Error('Transport unavailable');
  });
  const enqueueSpy = t.mock.method(notificationService, 'enqueueRetry', async () => {});

  const result = await notificationService.sendPushNotification('user-3', {
    type: 'meditation_ready',
    title: 'Ready',
    body: 'Listen now',
    data: { url: '/' }
  });

  assert.equal(result.success, false);
  assert.equal(result.error, 'Transport unavailable');
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].delivered, false);
  assert.equal(inserted[0].error, 'Transport unavailable');
  assert.equal(inserted[0].channel, 'fcm');
  assert.equal(transportSpy.mock.callCount(), 1);
  assert.equal(enqueueSpy.mock.callCount(), 1);
});

test('sendPushNotification prunes device and skips retry when token unregistered', async (t) => {
  const inserted = [];
  const deletedTokens = [];

  const clientConfig = {
    history: {
      counts: [0, 0],
      onInsert: (row) => inserted.push(row)
    },
    devices: {
      onDelete: (token) => deletedTokens.push(token)
    }
  };

  withSupabaseStub(t, clientConfig);
  t.mock.method(notificationService, 'fetchUserNotificationContext', async () => ({
    profile: {
      user_id: 'user-5',
      push_channel_preference: 'auto'
    },
    preferences: {
      enabled: true,
      daily_reminder: { enabled: true }
    },
    devices: [
      { push_provider: 'fcm', token: 'token-fcm-expired', platform: 'chrome', last_registered_at: new Date().toISOString() }
    ]
  }));

  t.mock.method(notificationService, 'sendFCMNotification', async () => {
    throw new Error('FCM send failed after 3 attempts: Requested entity was not found.');
  });

  const enqueueSpy = t.mock.method(notificationService, 'enqueueRetry', async () => {});

  const result = await notificationService.sendPushNotification('user-5', {
    type: 'daily_reminder',
    title: 'Reminder',
    body: 'Reflect today',
    data: { url: '/' }
  });

  assert.equal(result.success, false);
  assert.match(result.error, /Requested entity was not found/);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].delivered, false);
  assert.equal(inserted[0].channel, 'fcm');
  assert.deepEqual(deletedTokens, ['token-fcm-expired']);
  assert.equal(enqueueSpy.mock.callCount(), 0);
});

test('sendPushNotification routes through APNs when safari preference detected', async (t) => {
  const inserted = [];

  const clientConfig = {
    history: {
      counts: [0, 0],
      onInsert: (row) => inserted.push(row)
    }
  };

  withSupabaseStub(t, clientConfig);
  t.mock.method(notificationService, 'fetchUserNotificationContext', async () => ({
    profile: {
      user_id: 'user-4',
      push_channel_preference: 'auto'
    },
    preferences: {
      enabled: true,
      meditation_ready: { enabled: true }
    },
    devices: [
      { push_provider: 'apns', token: 'token-apns', platform: 'safari', last_registered_at: new Date().toISOString() },
      { push_provider: 'fcm', token: 'token-fcm', platform: 'chrome', last_registered_at: new Date(Date.now() - 1000).toISOString() }
    ]
  }));
  const apnsSpy = t.mock.method(notificationService, 'sendAppleWebPushNotification', async () => ({ success: true }));

  const result = await notificationService.sendPushNotification('user-4', {
    type: 'meditation_ready',
    title: 'Ready',
    body: 'Listen now',
    data: { url: '/' }
  });

  assert.equal(result.success, true);
  assert.equal(result.channel, 'apns');
  assert.equal(apnsSpy.mock.callCount(), 1);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].channel, 'apns');
});

test('shouldSendScheduledNotification respects timezone windows', () => {
  const scheduled = {
    scheduled_time: '20:00',
    days_of_week: [3], // Wednesday
    last_sent: null
  };

  const reference = moment.tz('2024-05-01T20:02:00', 'America/New_York');
  const result = notificationService.shouldSendScheduledNotification(scheduled, 'America/New_York', reference);
  assert.equal(result.shouldSend, true);

  const tooEarly = moment.tz('2024-05-01T19:30:00', 'America/New_York');
  assert.equal(notificationService.shouldSendScheduledNotification(scheduled, 'America/New_York', tooEarly).shouldSend, false);

  const wrongDayRef = moment.tz('2024-05-02T20:02:00', 'America/New_York');
  assert.equal(notificationService.shouldSendScheduledNotification(scheduled, 'America/New_York', wrongDayRef).shouldSend, false);
});

test('shouldSendScheduledNotification blocks duplicates within same day', () => {
  const scheduled = {
    scheduled_time: '09:00',
    days_of_week: [1], // Monday
    last_sent: '2024-06-03T13:00:00Z'
  };

  const reference = moment.tz('2024-06-03T09:03:00', 'America/New_York');
  const result = notificationService.shouldSendScheduledNotification(scheduled, 'America/New_York', reference);
  assert.equal(result.shouldSend, false);
});

test('migration adds required schema elements', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../../migrations/add_push_notifications_schema.sql', import.meta.url), 'utf8');

  assert.match(sql, /fcm_token TEXT/);
  assert.match(sql, /apns_web_token TEXT/);
  assert.match(sql, /notification_history/);
  assert.match(sql, /scheduled_notifications/);
  assert.match(sql, /notification_history ENABLE ROW LEVEL SECURITY/);
});
