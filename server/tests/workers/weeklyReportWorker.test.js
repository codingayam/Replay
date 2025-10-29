import test from 'node:test';
import assert from 'node:assert/strict';

import createWeeklyReportWorker from '../../workers/weeklyReportWorker.js';
import { createWeeklyReportSupabaseStub } from '../../utils/testing/createWeeklyReportSupabaseStub.js';

function createSupabaseStub() {
  return createWeeklyReportSupabaseStub({
    progressRows: [
      {
        id: 'progress-1',
        user_id: 'user-1',
        week_start: '2025-05-19',
        journal_count: 5,
        meditation_count: 2,
        weekly_report_ready_at: '2025-05-25T18:00:00Z',
        weekly_report_sent_at: null,
        eligible: true,
        next_report_at_utc: '2025-05-26T04:00:00Z',
        claimed_at: null,
        retry_attempts: 0
      }
    ],
    notes: [
      {
        id: 'note-1',
        title: 'Morning gratitude',
        transcript: 'Felt grateful for family breakfast.',
        date: '2025-05-20T12:00:00Z'
      },
      {
        id: 'note-2',
        title: 'Evening reflection',
        transcript: 'Challenging day but learned patience.',
        date: '2025-05-22T22:15:00Z'
      }
    ],
    meditations: [
      {
        id: 'med-1',
        title: 'Calming breath',
        completed_at: '2025-05-23T11:00:00Z'
      },
      {
        id: 'med-2',
        title: 'Evening unwind',
        completed_at: '2025-05-24T21:30:00Z'
      }
    ],
    user: { email: 'weekly@example.com' },
    profile: {
      name: 'Alex',
      timezone: 'America/New_York',
      values: ['empathy', 'growth'],
      mission: 'Help people build mindful routines',
      thinking_about: 'Balancing work and rest'
    },
    weeklyReports: []
  });
}

const stubGemini = {
  getGenerativeModel: () => ({
    generateContent: async () => ({ response: { text: () => '## Highlights\n- You stayed consistent this week.' } })
  })
};

test('weekly report worker sends summary when thresholds met', async () => {
  const supabase = createSupabaseStub();
  const sentEmails = [];
  const resendClient = {
    async sendEmail(payload) {
      sentEmails.push(payload);
      return { id: 'msg_123' };
    }
  };

  const worker = createWeeklyReportWorker({
    supabase,
    gemini: stubGemini,
    resendClient
  });

  const result = await worker.run(new Date('2025-05-26T05:00:00Z'));

  assert.equal(result.sent, 1);
  assert.equal(result.processed, 1);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to[0], 'weekly@example.com');
  assert.ok(supabase.state.weeklyReports.length >= 1);
  assert.equal(supabase.state.progressRows[0].weekly_report_sent_at !== null, true);
  assert.equal(supabase.state.progressRows[0].eligible, false);
  assert.equal(supabase.state.progressRows[0].claimed_at, null);
  assert.equal(supabase.state.progressRows[0].retry_attempts, 0);
});

test('weekly report worker skips before Monday midnight', async () => {
  const supabase = createSupabaseStub();
  const resendClient = {
    async sendEmail() {
      throw new Error('sendEmail should not be called');
    }
  };

  const worker = createWeeklyReportWorker({
    supabase,
    gemini: stubGemini,
    resendClient
  });

  const result = await worker.run(new Date('2025-05-25T16:00:00Z'));

  assert.equal(result.sent, 0);
  assert.equal(result.processed, 0);
  assert.equal(supabase.state.weeklyReports.length, 0);
  assert.equal(supabase.state.progressRows[0].claimed_at, null);
  assert.equal(supabase.state.progressRows[0].retry_attempts, 0);
});

test('weekly report worker schedules retry on send failure', async () => {
  const supabase = createSupabaseStub();
  const resendClient = {
    async sendEmail() {
      throw new Error('send failure');
    }
  };

  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {}
  };

  const worker = createWeeklyReportWorker({
    supabase,
    gemini: stubGemini,
    resendClient,
    logger
  });

  const result = await worker.run(new Date('2025-05-26T05:00:00Z'));

  assert.equal(result.sent, 0);
  assert.equal(result.processed, 1);
  const row = supabase.state.progressRows[0];
  assert.equal(row.retry_attempts, 1);
  assert.equal(row.eligible, true);
  assert.equal(row.claimed_at, null);
  assert.ok(row.next_report_at_utc, 'retry should set next_report_at_utc');
  assert.ok(new Date(row.next_report_at_utc).getTime() > new Date('2025-05-26T05:00:00Z').getTime());
});
