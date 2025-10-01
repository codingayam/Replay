import test from 'node:test';
import assert from 'node:assert/strict';

import { createWeeklyTagSyncWorker } from '../../workers/weeklyTagSyncWorker.js';

function createSupabase(rows) {
  let lastLimit = null;
  return {
    get lastLimit() {
      return lastLimit;
    },
    from(table) {
      assert.equal(table, 'profiles');
      return {
        select() {
          return this;
        },
        order() {
          return this;
        },
        limit(value) {
          lastLimit = value;
          return Promise.resolve({ data: rows, error: null });
        }
      };
    }
  };
}

test('weekly tag sync worker only processes eligible users', async () => {
  const rows = [
    {
      user_id: 'user-new-week',
      timezone: 'Europe/London',
      last_tag_week_key: '2024-20',
      last_tag_sync_at: '2024-05-20T00:00:00Z'
    },
    {
      user_id: 'user-stale',
      timezone: 'America/New_York',
      last_tag_week_key: '2024-21',
      last_tag_sync_at: '2024-05-21T00:00:00Z'
    },
    {
      user_id: 'user-fresh',
      timezone: 'America/Los_Angeles',
      last_tag_week_key: '2024-21',
      last_tag_sync_at: '2024-05-23T10:00:00Z'
    }
  ];

  const supabase = createSupabase(rows);
  const recompute = test.mock.fn(async ({ userId }) => ({
    userId,
    weekKey: '2024-21',
    updated: userId === 'user-new-week'
  }));

  const logger = {
    info: test.mock.fn(),
    warn: test.mock.fn(),
    error: test.mock.fn(),
    debug: test.mock.fn()
  };

  const worker = createWeeklyTagSyncWorker({
    supabase,
    batchSize: 2,
    staleHours: 6,
    recompute,
    logger
  });

  const now = new Date('2024-05-23T12:00:00Z');
  const summary = await worker.run({ now });

  assert.equal(summary.eligible, 2);
  assert.equal(summary.scanned, rows.length);
  assert.equal(recompute.mock.calls.length, 2);
  const processedIds = recompute.mock.calls.map((call) => call.arguments[0].userId);
  assert.deepEqual(processedIds, ['user-new-week', 'user-stale']);
  assert.equal(summary.updated, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.failures, 0);
});
