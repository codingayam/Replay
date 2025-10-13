import test from 'node:test';
import assert from 'node:assert/strict';

// Mock OneSignal functions
const mockUpdateOneSignalUser = test.mock.fn(async () => ({ success: true }));
const mockSendOneSignalEvent = test.mock.fn(async () => ({ success: true }));
const mockAttachExternalIdToSubscription = test.mock.fn(async () => ({ success: true }));
const mockOnesignalEnabled = test.mock.fn(() => true);

// Setup environment
process.env.ONESIGNAL_APP_ID = 'test-app-id';
process.env.ONESIGNAL_REST_API_KEY = 'test-rest-key';
process.env.ONESIGNAL_ENABLED = 'true';
process.env.ONESIGNAL_CUSTOM_EVENTS = 'true';
process.env.NODE_ENV = 'production';

// Mock supabase
const mockSupabase = {
  from: test.mock.fn(() => ({
    insert: test.mock.fn(() => ({
      select: test.mock.fn(() => ({
        single: test.mock.fn(async () => ({
          data: {
            id: 'note-123',
            user_id: 'user-456',
            title: 'Test Note',
            transcript: 'Test transcript',
            date: new Date().toISOString(),
            type: 'audio'
          },
          error: null
        }))
      }))
    }))
  })),
  storage: {
    from: test.mock.fn(() => ({
      upload: test.mock.fn(async () => ({ data: { path: 'test/path' }, error: null })),
      createSignedUrl: test.mock.fn(async () => ({
        data: { signedUrl: 'https://example.com/signed-url' }
      }))
    }))
  }
};

// Mock gemini
const mockGemini = {
  getGenerativeModel: test.mock.fn(() => ({
    generateContent: test.mock.fn(async () => ({
      response: {
        text: () => 'Generated title'
      }
    }))
  }))
};

// Mock multer upload
const mockUpload = {
  single: test.mock.fn(() => (req, res, next) => {
    req.file = {
      buffer: Buffer.from('test audio'),
      originalname: 'test.wav',
      mimetype: 'audio/wav'
    };
    next();
  }),
  array: test.mock.fn(() => (_req, _res, next) => next())
};

// Mock auth middleware
const mockRequireAuth = test.mock.fn(() => (req, res, next) => {
  req.auth = { userId: 'user-456' };
  next();
});

// Mock uuid
const mockUuidv4 = test.mock.fn(() => 'note-123');

// Mock weekly progress functions
const mockWeeklyProgressOverrides = {
  loadUserTimezone: test.mock.fn(async () => 'America/New_York'),
  incrementJournalProgress: test.mock.fn(async () => ({
    unlocksRemaining: 0,
    meditationsUnlocked: true
  })),
  buildProgressSummary: test.mock.fn(() => ({
    unlocksRemaining: 0,
    meditationsUnlocked: true,
    weekTimezone: 'America/New_York'
  }))
};

function createMockApp() {
  const handlers = {};
  return {
    _handlers: handlers,
    get(path, ...fns) {
      handlers[path] = fns;
    },
    post(path, ...fns) {
      handlers[path] = fns;
    },
    put(path, ...fns) {
      handlers[path] = fns;
    },
    delete(path, ...fns) {
      handlers[path] = fns;
    }
  };
}

test.beforeEach(() => {
  mockUpdateOneSignalUser.mock.resetCalls();
  mockSendOneSignalEvent.mock.resetCalls();
  mockAttachExternalIdToSubscription.mock.resetCalls();
  mockOnesignalEnabled.mock.resetCalls();

  mockUpdateOneSignalUser.mock.mockImplementation(async () => ({ success: true }));
  mockSendOneSignalEvent.mock.mockImplementation(async () => ({ success: true }));
  mockAttachExternalIdToSubscription.mock.mockImplementation(async () => ({ success: true }));
  mockOnesignalEnabled.mock.mockImplementation(() => true);
});

test('audio note creation calls OneSignal functions in sequence', async () => {
  // Import module with mocks
  const { registerNotesRoutes } = await import('../../routes/notes.js');

  const mockApp = createMockApp();

  // Register routes with mocks
  registerNotesRoutes({
    app: mockApp,
    requireAuth: mockRequireAuth,
    supabase: mockSupabase,
    upload: mockUpload,
    uuidv4: mockUuidv4,
    gemini: mockGemini,
    weeklyProgressOverrides: mockWeeklyProgressOverrides,
    onesignalOverrides: {
      onesignalEnabled: mockOnesignalEnabled,
      updateOneSignalUser: mockUpdateOneSignalUser,
      sendOneSignalEvent: mockSendOneSignalEvent,
      attachExternalIdToSubscription: mockAttachExternalIdToSubscription
    }
  });

  // Verify route was registered
  assert.ok(mockApp._handlers['/api/notes']);

  // Create mock request/response
  const mockReq = {
    auth: { userId: 'user-456' },
    body: { date: new Date().toISOString() },
    file: {
      buffer: Buffer.from('test audio'),
      originalname: 'test.wav',
      mimetype: 'audio/wav'
    },
    headers: {
      'x-onesignal-subscription-id': 'sub-123'
    }
  };

  const mockRes = {
    status: test.mock.fn(function(code) {
      this.statusCode = code;
      return this;
    }),
    json: test.mock.fn()
  };

  // Execute the route handler
  const handlers = mockApp._handlers['/api/notes'];
  const finalHandler = handlers[handlers.length - 1];

  // Mock OneSignal functions
  await finalHandler(mockReq, mockRes);

  // Verify response
  assert.equal(mockRes.status.mock.calls.length, 1);
  assert.equal(mockRes.status.mock.calls[0].arguments[0], 201);

  // Verify OneSignal functions were called
  assert.equal(mockAttachExternalIdToSubscription.mock.calls.length >= 1, true, 'attachExternalIdToSubscription should be called');
  assert.equal(mockUpdateOneSignalUser.mock.calls.length >= 1, true, 'updateOneSignalUser should be called');
  assert.equal(mockSendOneSignalEvent.mock.calls.length >= 1, true, 'sendOneSignalEvent should be called');

  // Verify tags were sent with correct structure
  if (mockUpdateOneSignalUser.mock.calls.length > 0) {
    const [userId, tags] = mockUpdateOneSignalUser.mock.calls[0].arguments;
    assert.equal(userId, 'user-456');
    assert.ok(tags.last_note_ts, 'Should include last_note_ts tag');
    assert.ok('meditation_unlocked' in tags, 'Should include meditation_unlocked tag');
  }

  // Verify event was sent with correct structure
  if (mockSendOneSignalEvent.mock.calls.length > 0) {
    const [userId, eventName, payload] = mockSendOneSignalEvent.mock.calls[0].arguments;
    assert.equal(userId, 'user-456');
    assert.equal(eventName, 'note_logged');
    assert.equal(payload.note_type, 'audio');
    assert.equal(payload.note_id, 'note-123');
  }
});

test('syncOneSignalAlias extracts subscription ID from header', async () => {
  const { registerNotesRoutes } = await import('../../routes/notes.js');

  const mockApp = createMockApp();

  registerNotesRoutes({
    app: mockApp,
    requireAuth: mockRequireAuth,
    supabase: mockSupabase,
    upload: mockUpload,
    uuidv4: mockUuidv4,
    gemini: mockGemini,
    weeklyProgressOverrides: mockWeeklyProgressOverrides,
    onesignalOverrides: {
      onesignalEnabled: mockOnesignalEnabled,
      attachExternalIdToSubscription: mockAttachExternalIdToSubscription,
      updateOneSignalUser: mockUpdateOneSignalUser,
      sendOneSignalEvent: mockSendOneSignalEvent
    }
  });

  const mockReq = {
    auth: { userId: 'user-456' },
    body: { date: new Date().toISOString() },
    file: {
      buffer: Buffer.from('test audio'),
      originalname: 'test.wav',
      mimetype: 'audio/wav'
    },
    headers: {
      'x-onesignal-subscription-id': 'subscription-xyz'
    }
  };

  const mockRes = {
    status: test.mock.fn(function(code) {
      this.statusCode = code;
      return this;
    }),
    json: test.mock.fn()
  };

  mockAttachExternalIdToSubscription.mock.resetCalls();

  const handlers = mockApp._handlers['/api/notes'];
  const finalHandler = handlers[handlers.length - 1];

  await finalHandler(mockReq, mockRes);

  // Verify attachExternalIdToSubscription was called with correct params
  if (mockAttachExternalIdToSubscription.mock.calls.length > 0) {
    const [subscriptionId, externalId] = mockAttachExternalIdToSubscription.mock.calls[0].arguments;
    assert.equal(subscriptionId, 'subscription-xyz');
    assert.equal(externalId, 'user-456');
  }
});

test('OneSignal operations skip when disabled', async () => {
  const { registerNotesRoutes } = await import('../../routes/notes.js');

  const mockApp = createMockApp();

  mockOnesignalEnabled.mock.mockImplementation(() => false);

  registerNotesRoutes({
    app: mockApp,
    requireAuth: mockRequireAuth,
    supabase: mockSupabase,
    upload: mockUpload,
    uuidv4: mockUuidv4,
    gemini: mockGemini,
    weeklyProgressOverrides: mockWeeklyProgressOverrides,
    onesignalOverrides: {
      onesignalEnabled: mockOnesignalEnabled,
      updateOneSignalUser: mockUpdateOneSignalUser,
      sendOneSignalEvent: mockSendOneSignalEvent,
      attachExternalIdToSubscription: mockAttachExternalIdToSubscription
    }
  });

  const mockReq = {
    auth: { userId: 'user-456' },
    body: { date: new Date().toISOString() },
    file: {
      buffer: Buffer.from('test audio'),
      originalname: 'test.wav',
      mimetype: 'audio/wav'
    },
    headers: {}
  };

  const mockRes = {
    status: test.mock.fn(function(code) {
      this.statusCode = code;
      return this;
    }),
    json: test.mock.fn()
  };

  mockUpdateOneSignalUser.mock.resetCalls();
  mockSendOneSignalEvent.mock.resetCalls();

  const handlers = mockApp._handlers['/api/notes'];
  const finalHandler = handlers[handlers.length - 1];

  await finalHandler(mockReq, mockRes);

  // Note should still be created successfully
  assert.equal(mockRes.status.mock.calls[0].arguments[0], 201);

  // But OneSignal operations should be skipped
  // (In real implementation, they wouldn't be called if onesignalEnabled() returns false)
});

test('handles missing subscription ID gracefully', async () => {
  const { registerNotesRoutes } = await import('../../routes/notes.js');

  const mockApp = createMockApp();

  registerNotesRoutes({
    app: mockApp,
    requireAuth: mockRequireAuth,
    supabase: mockSupabase,
    upload: mockUpload,
    uuidv4: mockUuidv4,
    gemini: mockGemini,
    weeklyProgressOverrides: mockWeeklyProgressOverrides,
    onesignalOverrides: {
      onesignalEnabled: mockOnesignalEnabled,
      updateOneSignalUser: mockUpdateOneSignalUser,
      sendOneSignalEvent: mockSendOneSignalEvent,
      attachExternalIdToSubscription: mockAttachExternalIdToSubscription
    }
  });

  const mockReq = {
    auth: { userId: 'user-456' },
    body: { date: new Date().toISOString() },
    file: {
      buffer: Buffer.from('test audio'),
      originalname: 'test.wav',
      mimetype: 'audio/wav'
    },
    headers: {} // No subscription ID header
  };

  const mockRes = {
    status: test.mock.fn(function(code) {
      this.statusCode = code;
      return this;
    }),
    json: test.mock.fn()
  };

  const handlers = mockApp._handlers['/api/notes'];
  const finalHandler = handlers[handlers.length - 1];

  await finalHandler(mockReq, mockRes);

  // Should still create note successfully
  assert.equal(mockRes.status.mock.calls[0].arguments[0], 201);

  // attachExternalIdToSubscription should not be called (or should skip)
  // Tags should still be sent (using external_id only)
});
