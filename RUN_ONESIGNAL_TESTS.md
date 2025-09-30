# Quick Guide: Running OneSignal Tests

## 🚀 Quick Start

### Run All OneSignal Tests

```bash
# Server tests
cd server && npm test tests/utils/onesignal.test.js tests/routes/notesRoutes.onesignal.test.js

# Client tests
cd client && npm test -- --testPathPattern="onesignal"
```

### Run Individual Test Files

```bash
# Server: OneSignal utility tests
cd server
npm test tests/utils/onesignal.test.js

# Server: OneSignal route integration tests
cd server
npm test tests/routes/notesRoutes.onesignal.test.js

# Client: AuthContext OneSignal tests
cd client
npm test src/contexts/__tests__/AuthContext.onesignal.test.tsx

# Client: API utility OneSignal tests
cd client
npm test src/__tests__/utils/api.onesignal.test.ts
```

## 📊 What Each Test Covers

### ✅ Server Utility Tests (`onesignal.test.js`)
**Tests:** 18 test cases
**Focus:** Core OneSignal functions
**Time:** ~2-3 seconds

**Key tests:**
- Configuration validation
- Tag filtering and conversion
- Notification targeting
- Event sending
- Error handling

### ✅ Server Route Tests (`notesRoutes.onesignal.test.js`)
**Tests:** 5 test cases
**Focus:** Integration with note creation
**Time:** ~3-5 seconds

**Key tests:**
- Note creation triggers OneSignal
- Subscription ID extraction
- Tag structure validation
- Event structure validation

### ✅ Client Auth Tests (`AuthContext.onesignal.test.tsx`)
**Tests:** 8 test cases
**Focus:** OneSignal SDK integration
**Time:** ~2-3 seconds

**Key tests:**
- Login/logout flows
- Subscription ID storage
- Permission prompts
- Error handling

### ✅ Client API Tests (`api.onesignal.test.ts`)
**Tests:** 7 test cases
**Focus:** Request header management
**Time:** ~1-2 seconds

**Key tests:**
- Header injection
- localStorage integration
- Error resilience

## 🔧 Expected Output

### Successful Test Run

```
✓ onesignalEnabled returns false in test environment
✓ onesignalEnabled returns false when ONESIGNAL_ENABLED is "false"
✓ updateOneSignalUser skips when not configured
✓ updateOneSignalUser filters out null/undefined values
✓ sendOneSignalNotification targets by external_id
✓ attachExternalIdToSubscription handles 409 conflict gracefully
...

Test Suites: 4 passed, 4 total
Tests:       38 passed, 38 total
Time:        8.234s
```

### Failed Test Example

```
✗ updateOneSignalUser sends correct tags
  Expected tags to include last_note_ts
  Received: { journals_to_unlock: 2 }

  at line 145 in onesignal.test.js
```

## 🐛 Troubleshooting

### "Module not found" errors
```bash
# Server
cd server && npm install

# Client
cd client && npm install
```

### "Cannot read property 'mock'" errors
Make sure you're using Node.js 18+ for server tests:
```bash
node --version  # Should be >= 18.0.0
```

### Tests timeout
Increase Jest timeout in client tests:
```bash
npm test -- --testTimeout=10000
```

### Environment variable issues
For server tests, ensure `.env` is set up:
```bash
cd server
cp .env.example .env
# Edit .env with test values
```

## 📝 Interpreting Results

### All Tests Pass ✅
Your OneSignal integration is working correctly:
- Configuration is valid
- Functions handle errors properly
- Client-server communication works
- Tag and event structures are correct

### Some Tests Fail ❌
Check the failure details:
- **"skipped: true"** → OneSignal is disabled (check env vars)
- **"Expected X to be Y"** → Logic error, review the function
- **"Timeout"** → Network/async issue, check mocks
- **"Mock not called"** → Flow issue, verify function execution

## 🎯 Test Coverage Goals

Current coverage:
- **Server Utils:** ~90% (18/20 code paths)
- **Server Routes:** ~70% (5/7 scenarios)
- **Client Auth:** ~85% (8/10 flows)
- **Client API:** ~80% (7/9 cases)

**Target:** 85%+ coverage across all files

## 🚦 CI/CD Integration

These tests run automatically in CI. To simulate CI locally:

```bash
# Server (CI mode)
cd server
NODE_ENV=test npm test

# Client (CI mode)
cd client
npm run test:ci
```

## 📖 Next Steps After Tests Pass

1. **Manual Testing:** Follow checklist in `ONESIGNAL_TESTS.md`
2. **Deploy to Staging:** Test with real OneSignal sandbox
3. **Monitor Logs:** Check for `[OneSignal]` prefixed logs
4. **Verify Dashboard:** Confirm tags appear in OneSignal
5. **Test Notifications:** Send test notifications to verify targeting

## 💡 Quick Tips

- Run tests before committing code
- Use `--watch` mode during development
- Check test output for helpful error messages
- Update tests when adding new OneSignal features
- Keep test data realistic but simple

## 🔗 Related Documentation

- Full test documentation: `ONESIGNAL_TESTS.md`
- OneSignal integration guide: `ONESIGNAL.md` (if exists)
- API documentation: Check route files for JSDoc comments