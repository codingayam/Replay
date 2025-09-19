Replicate concurrency handling doc
- Express meditation generation endpoint is stateless; each request creates its own `meditationId` and temp dir, so Node can work on many requests simultaneously without shared state issues.
- Replicate serves multiple runs in parallel up to the account/model concurrency quota; beyond that it returns 429/5xx and usage is billed per active prediction.
- Add retry/backoff around `replicate.run(...)` for transient 429/timeouts, and consider request queueing or batching (e.g. BullMQ) if spikes are expected.
- Capture metrics/logging on Replicate latency and errors so quota pressure is visible; scale the server horizontally or request higher concurrency if generation time grows.
