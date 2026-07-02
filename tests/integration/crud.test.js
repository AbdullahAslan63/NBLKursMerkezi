import 'dotenv/config';
import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestPrisma, resetDatabase, isDatabaseAvailable } from '../helpers/testDb.js';

const prisma = createTestPrisma();

describe('CRUD integration', () => {
  let app;
  let dbReady = false;

  before(async () => {
    dbReady = await isDatabaseAvailable(prisma);
    if (!dbReady) {
      console.warn('CRUD integration testleri atlandı — veritabanı bağlantısı yok.');
      return;
    }
    app = await createApp({ prisma });
  });

  beforeEach(async () => {
    if (dbReady) await resetDatabase(prisma);
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('öğretmen oluşturma', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const res = await request(app)
      .post('/teachers')
      .set('Accept', 'application/json')
      .send({ name: 'Ayşe Yılmaz' });

    assert.equal(res.status, 201);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.data.name, 'Ayşe Yılmaz');
  });

  test('bağlı etüt varken öğretmen silme → 409 TEACHER_HAS_SESSIONS', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const teacher = await prisma.teacher.create({ data: { name: 'Mehmet Kaya' } });
    await prisma.studySession.create({
      data: {
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
        teacherId: teacher.id,
      },
    });

    const res = await request(app)
      .delete(`/teachers/${teacher.id}`)
      .set('Accept', 'application/json');

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'TEACHER_HAS_SESSIONS');
  });

  test('sınıfsız öğrenci ekleme → 400 CLASS_REQUIRED', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const res = await request(app)
      .post('/students')
      .set('Accept', 'application/json')
      .send({ studentNumber: '1001', firstName: 'Ali', lastName: 'Veli' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'CLASS_REQUIRED');
  });

  test('öğrenci manuel ekleme (sınıf zorunlu)', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const schoolClass = await prisma.schoolClass.create({ data: { name: '12-A' } });

    const res = await request(app)
      .post('/students')
      .set('Accept', 'application/json')
      .send({
        studentNumber: '2024001',
        firstName: 'Zeynep',
        lastName: 'Demir',
        classId: schoolClass.id,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.className, '12-A');
  });

  test('duplicate sınıf adı → 409 DUPLICATE_CLASS_NAME', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    await prisma.schoolClass.create({ data: { name: '11-B' } });

    const res = await request(app)
      .post('/api/classes')
      .set('Accept', 'application/json')
      .send({ name: '11-B' });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'DUPLICATE_CLASS_NAME');
  });

  test('öğrencili sınıf silme → 409 CLASS_HAS_STUDENTS', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const schoolClass = await prisma.schoolClass.create({ data: { name: '9-C' } });
    await prisma.student.create({
      data: {
        studentNumber: '3001',
        firstName: 'Can',
        lastName: 'Öz',
        classId: schoolClass.id,
      },
    });

    const res = await request(app)
      .delete(`/api/classes/${schoolClass.id}`)
      .set('Accept', 'application/json');

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CLASS_HAS_STUDENTS');
  });

  test('aynı öğrenci aynı slota ikinci etüt → 409 STUDENT_SCHEDULE_CONFLICT', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const teacher = await prisma.teacher.create({ data: { name: 'Etüt Öğretmen' } });
    const schoolClass = await prisma.schoolClass.create({ data: { name: '10-A' } });
    const student = await prisma.student.create({
      data: {
        studentNumber: '9001',
        firstName: 'Deniz',
        lastName: 'Ak',
        classId: schoolClass.id,
      },
    });

    await prisma.studySession.create({
      data: {
        dayOfWeek: 'TUESDAY',
        startTime: '10:00',
        endTime: '11:00',
        teacherId: teacher.id,
        students: { create: [{ studentId: student.id }] },
      },
    });

    const teacher2 = await prisma.teacher.create({ data: { name: 'İkinci Öğretmen' } });

    const res = await request(app)
      .post('/api/sessions')
      .set('Accept', 'application/json')
      .send({
        dayOfWeek: 'TUESDAY',
        startTime: '10:00',
        endTime: '11:00',
        teacherId: teacher2.id,
        studentIds: [student.id],
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'STUDENT_SCHEDULE_CONFLICT');
  });
});
