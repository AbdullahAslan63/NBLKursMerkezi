import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS_OF_WEEK,
  TIME_SLOTS,
  getTodayDayKey,
  getCalendarDetailsFromDate,
  getDateFromCalendarDetails,
} from '../../src/config/schedule.js';

test('DAYS_OF_WEEK — 7 gün tanımlı', () => {
  assert.equal(DAYS_OF_WEEK.length, 7);
  assert.ok(DAYS_OF_WEEK.every((d) => d.key && d.label && d.short));
});

test('TIME_SLOTS — başlangıç ve bitiş saatleri tutarlı', () => {
  assert.ok(TIME_SLOTS.length > 0);
  for (const slot of TIME_SLOTS) {
    assert.match(slot.startTime, /^\d{2}:\d{2}$/);
    assert.match(slot.endTime, /^\d{2}:\d{2}$/);
    assert.ok(slot.startTime < slot.endTime, `${slot.label} geçersiz aralık`);
  }
});

test('getTodayDayKey — geçerli enum değeri döner', () => {
  const keys = DAYS_OF_WEEK.map((d) => d.key);
  assert.ok(keys.includes(getTodayDayKey()));
});

test('getCalendarDetailsFromDate — tarihi doğru şekilde dayOfWeek, month, weekNumber değerlerine dönüştürür', () => {
  const details = getCalendarDetailsFromDate('2026-07-24');
  assert.equal(details.dayOfWeek, 'FRIDAY');
  assert.equal(details.month, 7);
  assert.equal(details.weekNumber, 4);
});

test('getDateFromCalendarDetails — gün, ay ve haftaya uygun doğru tarihi döner', () => {
  const date = getDateFromCalendarDetails(2026, 7, 4, 'FRIDAY');
  assert.equal(date, '2026-07-24');
});
