import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TIMEZONE,
  getNextWeekStart,
  getWeekStart,
  hasReachedLocalMoment,
  normalizeTimezone
} from '../../utils/week.js';

test('getWeekStart returns Monday for midweek date in Asia/Singapore', () => {
  const date = new Date('2025-05-23T15:00:00Z'); // Friday UTC
  const weekStart = getWeekStart(date, 'Asia/Singapore');
  assert.equal(weekStart, '2025-05-19');
});

test('getWeekStart handles late-night Sunday in New York correctly', () => {
  const date = new Date('2025-05-26T03:30:00Z'); // Sunday 11:30pm EDT
  const weekStart = getWeekStart(date, 'America/New_York');
  assert.equal(weekStart, '2025-05-19');
});

test('getNextWeekStart advances exactly seven days', () => {
  assert.equal(getNextWeekStart('2025-05-19'), '2025-05-26');
});

test('hasReachedLocalMoment respects timezone midnight boundary', () => {
  const now = new Date('2025-05-26T04:01:00Z'); // Monday 00:01 EDT
  const reached = hasReachedLocalMoment({
    targetDate: '2025-05-26',
    targetTime: '00:00:00',
    timezone: 'America/New_York',
    now
  });
  assert.equal(reached, true);

  const notYet = hasReachedLocalMoment({
    targetDate: '2025-05-26',
    targetTime: '00:00:00',
    timezone: 'America/New_York',
    now: new Date('2025-05-26T03:59:00Z')
  });
  assert.equal(notYet, false);
});

test('normalizeTimezone falls back to default', () => {
  assert.equal(normalizeTimezone(null), DEFAULT_TIMEZONE);
});
