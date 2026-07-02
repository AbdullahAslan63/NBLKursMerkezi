import 'dotenv/config';
import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestPrisma, resetDatabase, isDatabaseAvailable } from '../helpers/testDb.js';

const prisma = createTestPrisma();

describe('Etüt oturumu integration', () => {
  let app;
  let dbReady = false;

  before(async () => {
    dbReady = await isDatabaseAvailable(prisma);
    if (dbReady) app = await createApp({ prisma });
  });

  beforeEach(async () => {
    if (dbReady) await resetDatabase(prisma);
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('etüt düzenleme — mevcut öğrenciler güncellenir', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const teacher = await prisma.teacher.create({ data: { name: 'Öğretmen A' } });
    const teacher2 = await prisma.teacher.create({ data: { name: 'Öğretmen B' } });
    const schoolClass = await prisma.schoolClass.create({ data: { name: '11-A' } });
    const s1 = await prisma.student.create({
      data: { studentNumber: '101', firstName: 'Ali', lastName: 'Yılmaz', classId: schoolClass.id },
    });
    const s2 = await prisma.student.create({
      data: { studentNumber: '102', firstName: 'Ayşe', lastName: 'Kaya', classId: schoolClass.id },
    });

    const session = await prisma.studySession.create({
      data: {
        dayOfWeek: 'WEDNESDAY',
        startTime: '14:00',
        endTime: '15:00',
        teacherId: teacher.id,
        students: { create: [{ studentId: s1.id }] },
      },
    });

    const res = await request(app)
      .put(`/api/sessions/${session.id}`)
      .set('Accept', 'application/json')
      .send({ teacherId: teacher2.id, studentIds: [s1.id, s2.id] });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.data.teacherId, teacher2.id);
    assert.deepEqual(res.body.data.studentIds.sort(), [s1.id, s2.id].sort());
  });

  test('düzenlemede çakışma → 409 STUDENT_SCHEDULE_CONFLICT', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const teacher = await prisma.teacher.create({ data: { name: 'Öğretmen A' } });
    const teacher2 = await prisma.teacher.create({ data: { name: 'Öğretmen B' } });
    const schoolClass = await prisma.schoolClass.create({ data: { name: '11-B' } });
    const student = await prisma.student.create({
      data: { studentNumber: '201', firstName: 'Can', lastName: 'Demir', classId: schoolClass.id },
    });

    await prisma.studySession.create({
      data: {
        dayOfWeek: 'THURSDAY',
        startTime: '15:00',
        endTime: '16:00',
        teacherId: teacher.id,
        students: { create: [{ studentId: student.id }] },
      },
    });

    const session2 = await prisma.studySession.create({
      data: {
        dayOfWeek: 'THURSDAY',
        startTime: '15:00',
        endTime: '16:00',
        teacherId: teacher2.id,
        students: { create: [] },
      },
    });

    const res = await request(app)
      .put(`/api/sessions/${session2.id}`)
      .set('Accept', 'application/json')
      .send({ teacherId: teacher2.id, studentIds: [student.id] });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'STUDENT_SCHEDULE_CONFLICT');
  });
});
