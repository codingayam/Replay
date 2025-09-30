# OneSignal Integration Tests

This document describes the test coverage for the OneSignal integration in the Replay application.

## Test Files

### Server-Side Tests

#### 1. `server/tests/utils/onesignal.test.js`
Tests for the core OneSignal utility functions.

**Coverage:**
- ✅ Environment detection (test vs production)
- ✅ Configuration validation (API keys, flags)
- ✅ `onesignalEnabled()` returns false in test environment
- ✅ `onesignalEnabled()` returns false when disabled via flag
- ✅ `onesignalEnabled()` returns false when credentials missing
- ✅ `updateOneSignalUser()` skips when not configured
- ✅ `updateOneSignalUser()` skips when no external ID
- ✅ `updateOneSignalUser()` skips when no tags provided
- ✅ `updateOneSignalUser()` filters out null/undefined values
- ✅ `updateOneSignalUser()` converts all values to strings
- ✅ `sendOneSignalNotification()` targets by external_id
- ✅ `sendOneSignalNotification()` targets by subscription_id when no external_id
- ✅ `sendOneSignalNotification()` skips when no target specified
- ✅ `attachExternalIdToSubscription()` handles 409 conflict gracefully
- ✅ `attachExternalIdToSubscription()` throws on other errors
- ✅ `onesignalCustomEventsEnabled()` checks flag correctly
- ✅ `sendOneSignalEvent()` skips when custom events disabled
- ✅ `sendOneSignalEvent()` sends event with correct structure

**Run:**
```bash
cd server
npm test tests/utils/onesignal.test.js
```

#### 2. `server/tests/routes/notesRoutes.onesignal.test.js`
Integration tests for OneSignal in note creation flows.

**Coverage:**
- ✅ Audio note creation calls OneSignal functions in sequence
- ✅ Alias sync extracts subscription ID from request header
- ✅ Tags are sent with correct structure (last_note_ts, journals_to_unlock, meditation_unlocked)
- ✅ Events are sent with correct structure (note_logged event)
- ✅ OneSignal operations skip when disabled
- ✅ Handles missing subscription ID gracefully
- ✅ Note creation succeeds even if OneSignal fails
- ✅ 100ms delay between alias sync and tag/event operations

**Run:**
```bash
cd server
npm test tests/routes/notesRoutes.onesignal.test.js
```

### Client-Side Tests

#### 3. `client/src/contexts/__tests__/AuthContext.onesignal.test.tsx`
Tests for OneSignal SDK integration in AuthContext.

**Coverage:**
- ✅ Calls `OneSignal.login()` when user authenticates
- ✅ Calls `OneSignal.logout()` when user signs out
- ✅ Stores subscription ID in localStorage
- ✅ Prompts for push notification permission
- ✅ Handles OneSignal login failure gracefully
- ✅ Clears subscription ID when user signs out
- ✅ Does not initialize OneSignal on disallowed origins
- ✅ Requests permission only once per session
- ✅ Subscribes to subscription ID change events

**Run:**
```bash
cd client
npm test src/contexts/__tests__/AuthContext.onesignal.test.tsx
```

#### 4. `client/src/__tests__/utils/api.onesignal.test.ts`
Tests for OneSignal subscription ID in API requests.

**Coverage:**
- ✅ Adds `X-OneSignal-Subscription-Id` header when available
- ✅ Omits header when subscription ID not available
- ✅ Handles localStorage errors gracefully
- ✅ Subscription ID added to authenticated requests
- ✅ Removes header when subscription ID becomes unavailable
- ✅ Preserves other headers when adding subscription ID
- ✅ Works with both authenticated and unauthenticated API instances

**Run:**
```bash
cd client
npm test src/__tests__/utils/api.onesignal.test.ts
```

## Running All Tests

### Server Tests
```bash
cd server
npm test
```

### Client Tests
```bash
cd client
npm test
```

### With Coverage
```bash
# Server
cd server
npm run test:coverage

# Client
cd client
npm run test:coverage
```

## Test Scenarios Covered

### 1. User Authentication Flow
- ✅ User logs in → `OneSignal.login(userId)` called
- ✅ User subscription created → ID stored in localStorage
- ✅ User logs out → `OneSignal.logout()` called, localStorage cleared

### 2. Note Creation Flow
- ✅ Note created → `syncOneSignalAlias()` called
- ✅ 100ms delay for OneSignal propagation
- ✅ Tags synced with user data (journals_to_unlock, meditation_unlocked, last_note_ts)
- ✅ Event emitted (note_logged)

### 3. Tag Management
- ✅ Tags filtered for null/undefined values
- ✅ Tags converted to strings
- ✅ Unix timestamp conversion for date fields
- ✅ Boolean conversion to 'true'/'false' strings

### 4. Error Handling
- ✅ 409 conflict (alias already exists) handled gracefully
- ✅ Network errors logged but don't break user flows
- ✅ OneSignal disabled → operations skipped
- ✅ Missing credentials → operations skipped

### 5. API Integration
- ✅ Subscription ID sent in request headers
- ✅ Subscription ID linked to external_id on server
- ✅ Both external_id and subscription_id targeting work

## Expected Behavior

### When OneSignal is Enabled:
1. User logs in → OneSignal user created with external_id
2. User creates note → Tags updated, event sent
3. Server receives subscription ID in header
4. Server links subscription to user's external_id
5. Tags appear in OneSignal dashboard within seconds

### When OneSignal is Disabled:
1. All operations return `{ skipped: true }`
2. No API calls made to OneSignal
3. User flows work normally
4. Logs indicate operations were skipped

## Test Data Examples

### Tag Structure
```javascript
{
  last_note_ts: 1234567890,           // Unix timestamp
  journals_to_unlock: 2,              // Number
  meditation_unlocked: 'true'         // String (not boolean)
}
```

### Event Structure
```javascript
{
  external_id: 'user-uuid',
  name: 'note_logged',
  payload: {
    note_id: 'note-uuid',
    note_type: 'audio',
    timestamp: '2025-09-30T12:00:00Z'
  }
}
```

### Notification Structure
```javascript
{
  app_id: 'onesignal-app-id',
  target_channel: 'push',
  include_aliases: { external_id: ['user-uuid'] },
  headings: { en: 'Title' },
  contents: { en: 'Message' }
}
```

## Debugging Failed Tests

### Server Tests
If server tests fail, check:
1. Environment variables are set correctly
2. Mock functions are properly configured
3. OneSignal module imports correctly (ESM vs CommonJS)

### Client Tests
If client tests fail, check:
1. Jest/React Testing Library setup
2. OneSignal SDK mock is properly configured
3. localStorage mock is available
4. Window origin is in allowed list

## Continuous Integration

These tests run automatically on:
- Pull requests
- Pushes to main branch
- Manual triggers

### CI Configuration
```yaml
# Example for GitHub Actions
- name: Run server tests
  run: cd server && npm test

- name: Run client tests
  run: cd client && npm test
```

## Manual Testing Checklist

After running automated tests, manually verify:

- [ ] Login triggers OneSignal.login() in browser console
- [ ] Create note shows OneSignal logs in server console
- [ ] Tags appear in OneSignal dashboard
- [ ] Logout triggers OneSignal.logout() in browser console
- [ ] Subscription ID appears in request headers (Network tab)
- [ ] Server logs show successful API calls to OneSignal

## Future Test Improvements

- [ ] Add E2E tests with real OneSignal sandbox
- [ ] Test notification delivery end-to-end
- [ ] Test tag updates across multiple note creations
- [ ] Test meditation completion flow with tags
- [ ] Test error recovery and retry logic
- [ ] Add performance tests for high-volume scenarios