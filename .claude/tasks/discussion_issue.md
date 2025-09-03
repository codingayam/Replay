# Discussion Issue: Meditation Duration Database Constraint Violation

## Issue Summary
- **Error**: `null value in column "duration" of relation "meditations" violates not-null constraint`
- **Context**: Occurs when generating night meditation
- **Root Cause**: Duration calculation can result in `null` or `undefined` values when TTS generation fails

## Investigation Results
- **Location**: `server/server.js` lines 1049-1078 (POST /api/meditate endpoint)
- **Problem**: The `reduce()` operation for calculating total duration doesn't handle `undefined` duration values
- **Trigger**: When Replicate TTS API fails, fallback items may have undefined duration properties

## Solution Implemented
1. **Robust Duration Calculation**: Added defensive checks for undefined/null duration values
2. **Fallback Logic**: Multiple levels of fallback durations (requested duration, 5-minute default)
3. **Validation**: Added pre-database validation to prevent constraint violations

## Code Changes
- Modified duration calculation logic with proper error handling
- Added validation before database insert
- Maintained existing TTS fallback behavior

## Testing
- Server starts successfully after changes
- Syntax validation passed
- Ready for meditation generation testing

## Production Testing Strategy
**Documentation**: Comprehensive testing plan created in `.claude/docs/tester-meditation-duration-fix.md`

### Key Testing Requirements:
1. **Production Safety**: Database backup, test user isolation, rollback plan
2. **Test Coverage**: 5 comprehensive test cases covering happy path, TTS failures, edge cases
3. **Monitoring**: Real-time monitoring of constraints, performance, and error rates
4. **Validation**: SQL queries to verify no null duration values created
5. **Timeline**: 2-hour testing window with safety measures

### Critical Test Scenarios:
- Normal meditation generation (verify duration calculation)
- TTS API failure simulation (test fallback duration logic)
- Edge cases (empty playlists, malformed requests)
- Large duration requests (performance and stability)
- Error handling (no null duration constraints)

### Success Criteria:
- Zero database constraint violations
- All meditation records have valid duration values
- TTS failures handled gracefully with fallbacks
- No performance regression
- Rollback plan verified and ready

## Why No Issue Locally
The user mentioned they don't have this issue when running locally with `npm run dev`. This suggests:
1. Different environment conditions (TTS API reliability, network conditions)
2. Different data sets or meditation scripts being processed
3. Production vs development environment differences
4. Timing-related issues in API calls

The fix is defensive and will handle both local and production scenarios.