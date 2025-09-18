# Platform Operations & Monitoring

## Objective
Provide operational guardrails that keep the push notification system observable, resilient, and easy to ship across environments.

## Technical Requirements

### 1. Secure Local & Staging Environments
- Configure HTTPS for local development using dev certificates (e.g., mkcert) and update Vite/Express dev servers to serve HTTPS endpoints required by service workers.
- Publish documentation describing how to trust the local CA on macOS/iOS to enable Safari PWA testing.
- For staging, ensure TLS certificates cover both web app and push package endpoints (wildcard or SAN certs).

### 2. Service Worker Lifecycle Management
- Establish versioning convention (`SW_VERSION` constant + hashed filename in build artifacts).
- Implement update pipeline:
  - In CI, invalidate CDN caches (e.g., `vercel deploy --force`) when service worker changes.
  - In client runtime, listen for `waiting` worker and notify user or auto-activate after closing idle tabs.
- Define caching strategy: precache critical assets, bypass for notification payload endpoints, ensure push manifests aren’t cached stale.

### 3. Monitoring & Alerting
- Instrument server transports (FCM/APNs) to emit structured logs: request ID, channel, latency, status code, error.
- Forward metrics to observability stack (Datadog, Grafana, or similar):
  - Delivery success rate per channel and notification type
  - Token registration failures by browser
  - Queue depth for scheduled jobs
- Set alert thresholds:
  - Delivery success < 90% over 15 min
  - Token registration error rate > 5%
  - Scheduler lag > 2 intervals
- Integrate log correlation IDs so support can trace end-to-end per notification.

### 4. Analytics & KPIs
- Emit frontend analytics events (Segment/Amplitude) for:
  - Permission prompt shown/accepted/declined
  - Notification opened
  - Preference toggled
- Emit backend events for send/acknowledge/failure to support KPI tracking defined in the requirements doc (opt-in rate, open rate, retention lift).
- Provide weekly dashboard snapshots for product stakeholders.

### 5. Deployment Automation
- Update deployment scripts (Vercel/nixpacks) to:
  - Inject latest environment variables for Firebase/APNs during build.
  - Sync static assets referenced by push package (icons, manifest) to hosting bucket/CDN.
  - Trigger regeneration of Safari push package when assets change; upload to push package endpoint (`/pushPackages/<id>`).
- Add pre-deploy checks ensuring required secrets exist and run smoke tests (FCM and APNs test endpoints).

### 6. Reliability Practices
- Implement retry queues (e.g., BullMQ dead-letter queue) for failed notifications with exponential backoff.
- Schedule daily job to prune expired tokens and stale history records (>90 days) to maintain compliance.
- Document incident response playbook: how to rotate APNs key, regenerate Firebase service account, disable notification type temporarily.

### 7. Documentation & Runbooks
- Create internal wiki page covering:
  - Browser-specific instructions (install Safari web app, enable notifications, troubleshooting denied permissions).
  - Testing checklist for regression cycles.
  - Rollback procedures if notification service misbehaves (disable scheduler toggle, feature flag).
- Link runbooks in on-call rotation tooling.

## Acceptance Criteria
- Local developers can run HTTPS dev server and receive push notifications in Chrome and Safari.
- Monitoring dashboards and alerts operational before production launch.
- Deployments automatically propagate service worker updates and regenerate Safari assets when necessary.
- On-call engineers have documented steps to diagnose delivery failures and rotate credentials within SLA.
