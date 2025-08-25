# Testing Guide for Replay Application

This guide provides comprehensive information about the testing setup, strategies, and best practices for the Replay application.

## Overview

The Replay application uses a multi-layered testing strategy:

- **Unit Tests**: Fast, isolated tests for individual components and functions
- **Integration Tests**: Tests for API endpoints and database interactions  
- **End-to-End Tests**: Full user journey tests using Playwright

## Quick Start

### Install Dependencies

```bash
# Install all dependencies (root, client, server)
npm run install:all

# Or individually
cd client && npm install
cd server && npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run client tests only
npm run test:client

# Run server tests only  
npm run test:server

# Run E2E tests
npm run test:e2e

# Run tests with coverage
cd client && npm run test:coverage
cd server && npm run test:coverage
```

### Watch Mode (Development)

```bash
# Client tests in watch mode
cd client && npm run test:watch

# Server tests in watch mode
cd server && npm run test:watch

# E2E tests with UI
npm run test:e2e:ui
```

## Testing Architecture

### Client Testing Stack

- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing focused on user behavior
- **MSW (Mock Service Worker)**: API mocking for integration tests
- **@testing-library/user-event**: User interaction simulation

### Server Testing Stack

- **Jest**: Test runner and assertion library
- **Supertest**: HTTP assertion library for API testing
- **Test Database**: Isolated PostgreSQL instance for integration tests

### E2E Testing Stack

- **Playwright**: Modern E2E testing framework
- **Multiple Browsers**: Chrome, Firefox, Safari, Mobile viewports

## Directory Structure

```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── __tests__/           # Component unit tests
│   │   ├── contexts/
│   │   │   └── __tests__/           # Context unit tests
│   │   ├── utils/
│   │   │   └── __tests__/           # Utility unit tests
│   │   └── test/
│   │       ├── fixtures/            # Test data
│   │       ├── mocks/               # Mock implementations
│   │       ├── utils/               # Test utilities
│   │       └── setup.ts             # Test setup
│   └── jest.config.js
├── server/
│   └── tests/
│       ├── unit/                    # Server unit tests
│       ├── integration/             # API integration tests
│       ├── mocks/                   # External API mocks
│       ├── utils/                   # Test utilities
│       ├── factories/               # Test data factories
│       └── setup.js                 # Test setup
└── tests/
    └── e2e/                         # End-to-end tests
        ├── auth/                    # Authentication flows
        ├── journaling/              # Journaling features
        ├── reflection/              # Reflection features
        └── fixtures/                # E2E test data
```

## Writing Tests

### Client Unit Tests

```typescript
// components/__tests__/MyComponent.test.tsx
import { render, screen, fireEvent } from '../../test/utils/testUtils';
import { createMockNote } from '../../test/factories';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render note title', () => {
    const note = createMockNote({ title: 'Test Note' });
    
    render(<MyComponent note={note} />);
    
    expect(screen.getByText('Test Note')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const handleClick = jest.fn();
    const note = createMockNote();
    
    render(<MyComponent note={note} onClick={handleClick} />);
    
    await fireEvent.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledWith(note);
  });
});
```

### Server Integration Tests

```javascript
// tests/integration/notes.test.js
const request = require('supertest');
const { createTestUser, createTestNote } = require('../factories');
const { setupTestDatabase, cleanupTestDatabase } = require('../utils/testDatabase');

describe('Notes API', () => {
  let testUser;

  beforeEach(async () => {
    await cleanupTestDatabase();
    testUser = await createTestUser();
  });

  it('should create a new note', async () => {
    const audioBuffer = Buffer.from('mock audio data');
    
    const response = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${testUser.token}`)
      .attach('audio', audioBuffer, 'test.wav')
      .expect(201);

    expect(response.body).toMatchObject({
      title: expect.any(String),
      transcript: expect.any(String),
      type: 'audio'
    });
  });
});
```

### E2E Tests

```typescript
// tests/e2e/journaling/audio-journaling.spec.ts
import { test, expect } from '@playwright/test';
import { testUsers, selectors } from '../fixtures/test-data';

test.describe('Audio Journaling', () => {
  test('should record and save audio note', async ({ page }) => {
    await page.goto('/experiences');
    await page.context().grantPermissions(['microphone']);
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    const recordButton = page.locator('button:has-text("Start Recording")');
    await recordButton.click();
    
    await page.waitForTimeout(2000);
    
    const stopButton = page.locator('button:has-text("Stop Recording")');
    await stopButton.click();
    
    await expect(page.locator(selectors.noteCard)).toBeVisible();
  });
});
```

## Test Data Management

### Using Factories

Client-side factories are available in `client/src/test/factories/`:

```typescript
import { createMockNote, createMockUser, createMockProfile } from '../test/factories';

const note = createMockNote({ title: 'Custom Title' });
const user = createMockUser({ email: 'custom@email.com' });
const profile = createMockProfile({ name: 'Custom Name' });
```

Server-side factories are available in `server/tests/factories/`:

```javascript
const { 
  createTestUser, 
  createTestNote, 
  createTestMeditation,
  createTestScenarios 
} = require('./factories');

// Create individual entities
const user = createTestUser();
const note = createTestNote(user.id);
const meditation = createTestMeditation(user.id, [note.id]);

// Create complete test scenarios
const { user, profile, notes, meditations } = createTestScenarios.activeUser();
```

### Mock API Responses

Mock external APIs in tests:

```javascript
const { setMockGeminiResponse, setMockOpenAIResponse } = require('../mocks/externalAPIs');

// Mock Gemini AI response
setMockGeminiResponse({
  transcript: 'Custom transcript',
  title: 'Custom Title',
  category: 'experience'
});

// Mock OpenAI TTS response
setMockOpenAIResponse({
  body: Buffer.from('mock audio data'),
  headers: { 'content-type': 'audio/wav' }
});
```

## Test Utilities

### Client Test Utilities

```typescript
import { 
  renderWithAuth, 
  renderWithoutAuth, 
  setupAuthenticatedTest,
  mockMediaRecorder 
} from '../test/utils/testUtils';

// Render with authenticated user
const { getByText } = renderWithAuth(<MyComponent />);

// Setup authenticated test context
setupAuthenticatedTest();

// Mock media recording
const recorder = mockMediaRecorder();
```

### Server Test Utilities

```javascript
const { 
  createTestUserWithData,
  createMockFiles,
  createTestDates 
} = require('./factories');

// Create complete user with related data
const userData = await createTestUserWithData();

// Create mock file uploads
const audioFile = createMockFiles.audioFile();
const imageFile = createMockFiles.imageFile();

// Generate test dates
const { startDate, endDate } = createTestDates.dateRange(7); // Last 7 days
```

## Mocking Strategies

### External APIs

All external APIs are mocked in tests:

- **Google Gemini**: Mocked for transcription and AI responses
- **OpenAI**: Mocked for text-to-speech generation
- **Replicate**: Mocked for alternative TTS
- **Supabase Storage**: Mocked for file operations

### Browser APIs

Browser APIs are mocked in test setup:

- MediaRecorder API for audio recording
- File API for file uploads
- LocalStorage for data persistence
- Geolocation API (if used)

## CI/CD Integration

### GitHub Actions Workflow

The test suite runs automatically on:

- Push to `main` and `develop` branches
- Pull requests to `main`

Workflow includes:
- Linting and type checking
- Unit tests with coverage
- Integration tests with test database
- E2E tests across multiple browsers
- Security scanning
- Performance testing (Lighthouse)

### Local Development

Pre-commit hooks run:
- Linting
- Unit tests for changed files
- Type checking

## Coverage Requirements

Minimum coverage targets:
- **Overall**: 80% line coverage
- **Critical paths**: 95% coverage
- **Authentication**: 90% coverage
- **Data persistence**: 85% coverage

View coverage reports:
```bash
cd client && npm run test:coverage
cd server && npm run test:coverage
```

## Debugging Tests

### Debug Client Tests

```bash
# Run specific test file
cd client && npm test -- --testNamePattern="MyComponent"

# Debug with Node inspector
cd client && node --inspect-brk node_modules/.bin/jest --runInBand

# Run single test
cd client && npm test -- --testNamePattern="should render note title"
```

### Debug Server Tests

```bash
# Run specific test file
cd server && npm test -- tests/integration/notes.test.js

# Debug with inspector
cd server && node --inspect-brk node_modules/.bin/jest --runInBand

# Run integration tests only
cd server && npm run test:integration
```

### Debug E2E Tests

```bash
# Run with browser visible
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e -- tests/e2e/auth/

# Debug with Playwright inspector
npm run test:e2e -- --debug

# Run with UI
npm run test:e2e:ui
```

## Best Practices

### Test Naming

Use descriptive test names that explain the scenario:

```javascript
// Good
it('should show error message when login fails with invalid credentials')
it('should create audio note when recording is successful')

// Avoid
it('should work correctly')
it('test login')
```

### Test Structure

Follow Arrange-Act-Assert pattern:

```javascript
it('should update note when transcript is edited', async () => {
  // Arrange
  const note = createTestNote();
  const newTranscript = 'Updated transcript';
  
  // Act
  const response = await request(app)
    .put(`/api/notes/${note.id}/transcript`)
    .send({ transcript: newTranscript });
  
  // Assert
  expect(response.status).toBe(200);
  expect(response.body.transcript).toBe(newTranscript);
});
```

### Test Isolation

Each test should be independent:

```javascript
beforeEach(async () => {
  await cleanupTestDatabase();
  // Setup fresh test data
});

afterEach(() => {
  jest.clearAllMocks();
});
```

### Async Testing

Handle async operations properly:

```javascript
// Use async/await
it('should fetch notes', async () => {
  const notes = await api.getNotes();
  expect(notes).toHaveLength(2);
});

// Wait for elements
await waitFor(() => {
  expect(screen.getByText('Loading...')).not.toBeInTheDocument();
});
```

## Troubleshooting

### Common Issues

**Tests timing out**
- Increase timeout: `jest.setTimeout(10000)`
- Check for unhandled promises
- Ensure cleanup is working

**Flaky tests**
- Check for race conditions
- Use proper waiting mechanisms
- Ensure test isolation

**Mock issues**
- Clear mocks between tests: `jest.clearAllMocks()`
- Check mock implementation
- Verify mock calls: `expect(mockFn).toHaveBeenCalled()`

**E2E test failures**
- Check element selectors
- Wait for elements to be visible
- Verify test data setup

### Getting Help

1. Check existing test examples in the codebase
2. Review test utilities and factories
3. Check CI logs for specific error messages
4. Use debug mode to step through tests

## Performance

### Test Performance Tips

- Use `it.only()` and `describe.only()` for focused testing
- Run tests in parallel when possible
- Mock heavy operations
- Use test databases for integration tests
- Clean up resources after tests

### Monitoring Test Performance

```bash
# Run with timing information
npm test -- --verbose

# Profile test performance
npm test -- --logHeapUsage
```

This comprehensive testing setup ensures the Replay application maintains high quality and reliability across all features and user flows.