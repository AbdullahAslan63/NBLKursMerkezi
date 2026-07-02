import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStudentScheduleConflicts } from '../../src/lib/sessionConflict.js';

test('findStudentScheduleConflicts — mock prisma ile çakışma bulur', async () => {
  const prisma = {
    studySessionStudent: {
      findMany: async () => [
        {
          student: { id: 1, firstName: 'Ali', lastName: 'Yılmaz' },
          studySession: { id: 5, teacher: { name: 'Ayşe Öğretmen' } },
        },
      ],
    },
  };

  const conflicts = await findStudentScheduleConflicts(prisma, {
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '10:00',
    studentIds: [1],
  });

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].studentName, 'Ali Yılmaz');
});

test('findStudentScheduleConflicts — boş öğrenci listesi', async () => {
  const prisma = { studySessionStudent: { findMany: async () => { throw new Error('çağrılmamalı'); } } };
  const conflicts = await findStudentScheduleConflicts(prisma, {
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '10:00',
    studentIds: [],
  });
  assert.equal(conflicts.length, 0);
});
