odebase Review

  - client/src/contexts/JobContext.tsx:300 – the unmount cleanup closes over the initial pollingInterval because of an empty dependency array, so active timers keep running after navigation; keep the ref in a
  useRef or include the state in the deps before clearing.
  - client/src/contexts/AuthContext.tsx:4 – context values and auth responses are typed any, and Supabase errors are silently swallowed; hook into User/Session types and surface failures so consumers can
  distinguish auth errors from loading states.
  - client/src/hooks/useNotifications.ts:221 – the service-worker/setup effect omits trackEvent/handleForegroundMessage from its dependencies and the hook wraps a broad mix of responsibilities; extract
  registration/state-sync into smaller hooks or a reducer and include stable dependencies to avoid stale closures during user re-auth.
  - server/server.js:1 – the entry point is a 4k-line grab bag of routing, background job orchestration, and audio processing; split it into feature routers plus dedicated services/jobs modules so the API
  surface is testable and easier to reason about.
  - server/server.js:798 – multer.memoryStorage() keeps up to 50 MB uploads in RAM per request; switch to streaming uploads to disk/Supabase (or pipe straight to storage) to prevent memory exhaustion under
  load.
  - server/tests/notificationService.test.js:1 – server coverage is limited to a single service test; add integration tests around the meditation job queue and notification preference endpoints to catch
  regressions from the refactor above.

  Next steps: 1) Patch the job polling leak and add a regression test around unmounting the provider; 2) Carve server/server.js into routers/services, then backfill tests for the new modules.