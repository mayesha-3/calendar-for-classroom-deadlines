import test from 'node:test';
import assert from 'node:assert/strict';

import { getTomorrowDateRange } from '../cron/deadlines.js';

test('gets tomorrow boundaries in Asia/Dhaka even when the server date differs', () => {
  const { start, end } = getTomorrowDateRange(new Date('2026-11-20T17:59:00.000Z'));

  assert.equal(start.toISOString(), '2026-11-20T18:00:00.000Z');
  assert.equal(end.toISOString(), '2026-11-21T18:00:00.000Z');
});

test('handles month and year boundaries in the configured timezone', () => {
  const { start, end } = getTomorrowDateRange(new Date('2026-12-31T12:00:00.000Z'));

  assert.equal(start.toISOString(), '2026-12-31T18:00:00.000Z');
  assert.equal(end.toISOString(), '2027-01-01T18:00:00.000Z');
});
