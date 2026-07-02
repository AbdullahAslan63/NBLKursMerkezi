import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudentCellMap,
  buildTeacherCellMap,
  sessionCellKey,
} from '../../src/lib/pdfScheduleData.js';

describe('pdfScheduleData', () => {
  test('sessionCellKey — gün ve saat birleşimi', () => {
    assert.equal(
      sessionCellKey({ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00' }),
      'MONDAY:09:00:10:00',
    );
  });

  test('buildStudentCellMap — öğretmen adları', () => {
    const map = buildStudentCellMap([
      {
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
        teacher: { name: 'Ayşe Öğretmen' },
      },
    ]);
    assert.deepEqual(map['MONDAY:09:00:10:00'], ['Ayşe Öğretmen']);
  });

  test('buildTeacherCellMap — öğrenci listesi kısaltılır', () => {
    const students = [
      { student: { firstName: 'Ali', lastName: 'Yılmaz' } },
      { student: { firstName: 'Ayşe', lastName: 'Kaya' } },
      { student: { firstName: 'Can', lastName: 'Demir' } },
      { student: { firstName: 'Deniz', lastName: 'Ak' } },
    ];
    const map = buildTeacherCellMap([
      {
        dayOfWeek: 'FRIDAY',
        startTime: '14:00',
        endTime: '15:00',
        students,
      },
    ]);
    assert.equal(map['FRIDAY:14:00:15:00'], 'Ali Yılmaz, Ayşe Kaya, Can Demir +1');
  });
});
