import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  recomputeWeeklyProgress,
  getIsoWeekKeyForDate
} from '../../utils/weeklyTagSync.js';

function createSupabaseMock({ profile, onUpdate, onInsert }) {
  let currentProfile = profile ?? null;

  return {
    from(table) {
      assert.equal(table, 'profiles');
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: currentProfile, error: null };
                }
              };
            }
          };
        },
        update(payload) {
          return {
            async eq(field, value) {
              onUpdate?.(payload, field, value);
              if (currentProfile) {
                currentProfile = { ...currentProfile, ...payload };
              }
              return { error: null };
            }
          };
        },
        insert(rows) {
          onInsert?.(rows);
          if (rows && rows[0]) {
            currentProfile = { ...rows[0] };
          }
          return Promise.resolve({ error: null });
        }
      };
    }
  };
}

test('getIsoWeekKeyForDate handles year boundaries by timezone', () => {
  const date = new Date('2023-12-31T22:30:00Z');
  const keyNz = getIsoWeekKeyForDate(date, 'Pacific/Auckland');
  const keyNy = getIsoWeekKeyForDate(date, 'America/New_York');

  assert.equal(keyNz.startsWith('2024-'), true, 'Auckland should be in week year 2024');
  assert.equal(keyNy.startsWith('2023-'), true, 'New York should remain in 2023 week year');
});

test('recomputeWeeklyProgress pushes tags when state changed', async () => {
  const updateCalls = [];
  const insertCalls = [];
  const mockUpdateOneSignalUser = test.mock.fn(async () => ({ ok: true }));

  const supabase = createSupabaseMock({
    profile: null,
    onUpdate: (payload) => updateCalls.push(payload),
    onInsert: (rows) => insertCalls.push(rows)
  });

  const summary = {
    weekStart: '2024-05-20',
    journalCount: 4,
    meditationCount: 2,
    unlocksRemaining: 0,
    reportJournalRemaining: 1,
    reportMeditationRemaining: 0,
    meditationsUnlocked: true,
    reportReady: true,
    reportSent: false,
    eligible: true,
    nextReportAtUtc: '2024-05-27T04:00:00Z',
    nextReportDate: '2024-05-27'
  };

  const overrides = {
    loadUserTimezone: async () => 'America/New_York',
    getCurrentWeekProgress: async () => ({ progress: {}, weekStart: '2024-05-20' }),
    buildProgressSummary: () => summary,
    updateOneSignalUser: mockUpdateOneSignalUser
  };

  const result = await recomputeWeeklyProgress({
    supabase,
    userId: 'user-1',
    now: new Date('2024-05-22T12:00:00Z'),
    overrides
  });

  assert.equal(result.updated, true);
  assert.equal(mockUpdateOneSignalUser.mock.calls.length, 1);
  const [userId, tags] = mockUpdateOneSignalUser.mock.calls[0].arguments;
  assert.equal(userId, 'user-1');
  assert.equal(tags.weekly_week_key, '2024-21');
  assert.equal(tags.weekly_journal_count, '4');
  assert.equal(tags.weekly_report_eligible, 'true');

  assert.equal(insertCalls.length, 1, 'Should insert profile tag state when missing');
  assert.equal(updateCalls.length, 0, 'No update expected on first insert');
});

test('recomputeWeeklyProgress skips OneSignal when hash unchanged', async () => {
  const summary = {
    weekStart: '2024-05-20',
    journalCount: 4,
    meditationCount: 2,
    unlocksRemaining: 0,
    reportJournalRemaining: 1,
    reportMeditationRemaining: 0,
    meditationsUnlocked: true,
    reportReady: true,
    reportSent: false,
    eligible: true,
    nextReportAtUtc: '2024-05-27T04:00:00Z',
    nextReportDate: '2024-05-27'
  };

  const tags = {
    weekly_week_key: '2024-21',
    weekly_week_start: summary.weekStart,
    weekly_timezone: 'America/New_York',
    weekly_journal_count: String(summary.journalCount),
    weekly_meditation_count: String(summary.meditationCount),
    weekly_unlocks_remaining: String(summary.unlocksRemaining),
    weekly_report_journal_remaining: String(summary.reportJournalRemaining),
    weekly_report_meditation_remaining: String(summary.reportMeditationRemaining),
    weekly_meditations_unlocked: 'true',
    weekly_report_ready: 'true',
    weekly_report_sent: 'false',
    weekly_report_eligible: 'true',
    weekly_next_report_at_utc: summary.nextReportAtUtc,
    weekly_next_report_date: summary.nextReportDate
  };

  const hashValue = createHash('sha256')
    .update(JSON.stringify({ weekKey: '2024-21', tags }))
    .digest('hex');

  const updateCalls = [];
  const mockUpdateOneSignalUser = test.mock.fn(async () => ({ ok: true }));

  const supabase = createSupabaseMock({
    profile: {
      user_id: 'user-1',
      last_tag_week_key: '2024-21',
      last_tag_hash: hashValue,
      last_tag_sync_at: '2024-05-21T00:00:00Z',
      timezone: 'America/New_York'
    },
    onUpdate: (payload) => updateCalls.push(payload)
  });

  const overrides = {
    loadUserTimezone: async () => 'America/New_York',
    getCurrentWeekProgress: async () => ({ progress: {}, weekStart: '2024-05-20' }),
    buildProgressSummary: () => summary,
    updateOneSignalUser: mockUpdateOneSignalUser
  };

  const result = await recomputeWeeklyProgress({
    supabase,
    userId: 'user-1',
    now: new Date('2024-05-23T12:00:00Z'),
    overrides
  });

  assert.equal(result.updated, false, 'Should flag as skipped');
  assert.equal(mockUpdateOneSignalUser.mock.calls.length, 0, 'Should not call OneSignal when unchanged');
  assert.equal(updateCalls.length, 1, 'Should update sync timestamp');
  assert.equal(updateCalls[0].last_tag_week_key, '2024-21');
});
