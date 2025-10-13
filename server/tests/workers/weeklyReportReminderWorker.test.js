import test from 'node:test';
import assert from 'node:assert/strict';

import { createWeeklyReportReminderWorker } from '../../workers/weeklyReportReminderWorker.js';

class WeeklyProgressQuery {
  constructor(rows) {
    this.rows = rows;
    this.filters = [];
    this.updates = null;
    this.limitCount = null;
    this.returnRows = false;
    this.single = false;
  }

  update(values) {
    this.updates = values;
    return this;
  }

  eq(field, value) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  is(field, value) {
    if (value === null) {
      this.filters.push((row) => row[field] === null);
    } else {
      this.filters.push((row) => row[field] === value);
    }
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  select() {
    this.returnRows = true;
    return this;
  }

  maybeSingle() {
    this.returnRows = true;
    this.single = true;
    this.limitCount = 1;
    return this;
  }

  async _execute() {
    let matches = this.rows.filter((row) => this.filters.every((fn) => fn(row)));
    if (typeof this.limitCount === 'number') {
      matches = matches.slice(0, this.limitCount);
    }

    if (this.updates) {
      for (const row of matches) {
        Object.assign(row, this.updates);
      }
    }

    if (!this.returnRows) {
      return { data: [], error: null };
    }

    if (this.single) {
      return { data: matches[0] ? { ...matches[0] } : null, error: null };
    }

    return { data: matches.map((row) => ({ ...row })), error: null };
  }

  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }
}

class SingleRowQuery {
  constructor(rows, key) {
    this.rows = rows;
    this.filters = [];
    this.single = false;
    this.key = key;
  }

  select() {
    return this;
  }

  eq(field, value) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  async _execute() {
    const matches = this.rows.filter((row) => this.filters.every((fn) => fn(row)));
    if (this.single) {
      return { data: matches[0] ? { ...matches[0] } : null, error: null };
    }
    return { data: matches.map((row) => ({ ...row })), error: null };
  }

  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }
}

function createSupabaseMock({ weeklyProgressRows, usersRow, profileRow }) {
  return {
    from(table) {
      if (table === 'weekly_progress') {
        return new WeeklyProgressQuery(weeklyProgressRows);
      }
      if (table === 'users') {
        return new SingleRowQuery([usersRow], 'id');
      }
      if (table === 'profiles') {
        return new SingleRowQuery([profileRow], 'user_id');
      }
      throw new Error(`Unexpected table ${table}`);
    }
  };
}

function createResendStub() {
  const sent = [];
  return {
    client: {
      async sendEmail(payload) {
        sent.push(payload);
        return { id: 'test-email-id' };
      }
    },
    sent
  };
}

function createReminderWorkerContext() {
  const weekStart = '2024-07-15';
  const rows = [
    {
      user_id: 'user-123',
      week_start: weekStart,
      journal_count: 2,
      meditation_count: 0,
      week_timezone: 'America/New_York',
      weekly_report_sent_at: null,
      weekly_report_reminder_sent_at: null,
      weekly_report_reminder_attempted_at: null,
      meditations_unlocked_at: null,
      weekly_report_ready_at: null,
      eligible: false
    }
  ];

  const supabase = createSupabaseMock({
    weeklyProgressRows: rows,
    usersRow: { id: 'user-123', email: 'user@example.com' },
    profileRow: { user_id: 'user-123', name: 'Replay User' }
  });

  const { client: resendClient, sent } = createResendStub();
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {}
  };

  const worker = createWeeklyReportReminderWorker({
    supabase,
    logger,
    resendClient
  });

  return { worker, rows, sent, weekStart };
}

test('weekly report reminder worker sends email when thresholds unmet', async () => {
  const { worker, rows, sent, weekStart } = createReminderWorkerContext();
  const now = new Date('2024-07-19T00:30:00Z'); // Thursday 8:30 PM ET

  const result = await worker.run(now);

  assert.equal(result.sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(rows[0].weekly_report_reminder_sent_at !== null, true);
  assert.equal(rows[0].weekly_report_reminder_attempted_at !== null, true);
  assert.equal(sent[0].to[0], 'user@example.com');
  assert.ok(sent[0].html.includes('journal'));
  assert.equal(rows[0].week_timezone, 'America/New_York');
});

test('weekly report reminder worker skips before window and allows future retry', async () => {
  const { worker, rows } = createReminderWorkerContext();
  const beforeWindow = new Date('2024-07-18T21:00:00Z'); // Thursday 5:00 PM ET

  const result = await worker.run(beforeWindow);

  assert.equal(result.sent, 0);
  assert.equal(result.skippedBeforeWindow, 1);
  assert.equal(rows[0].weekly_report_reminder_attempted_at, null);
});
