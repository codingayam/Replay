const { setupTestDatabase, cleanupTestDatabase } = require('./utils/testDatabase');
const { mockExternalAPIs, restoreExternalAPIs } = require('./mocks/externalAPIs');

// Global test setup
beforeAll(async () => {
  // Setup test database
  await setupTestDatabase();
  
  // Mock external APIs
  mockExternalAPIs();
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.REPLICATE_API_TOKEN = 'test-replicate-token';
});

// Global test cleanup
afterAll(async () => {
  // Cleanup test database
  await cleanupTestDatabase();
  
  // Restore external API mocks
  restoreExternalAPIs();
});

// Per-test cleanup
afterEach(async () => {
  // Clear any test data created during individual tests
  jest.clearAllMocks();
});

// Mock console methods to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn((message) => {
    // Only show errors that are not expected in tests
    if (typeof message === 'string' && message.includes('Error')) {
      originalConsoleError(message);
    }
  });
  
  console.warn = jest.fn((message) => {
    // Suppress warnings in tests unless they're important
    if (typeof message === 'string' && message.includes('Warning')) {
      originalConsoleWarn(message);
    }
  });
  
  // Keep console.log for debugging but make it quieter
  console.log = jest.fn((message) => {
    if (process.env.DEBUG_TESTS === 'true') {
      originalConsoleLog(message);
    }
  });
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});