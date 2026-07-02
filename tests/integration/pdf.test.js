import 'dotenv/config';
import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestPrisma, resetDatabase, isDatabaseAvailable } from '../helpers/testDb.js';
import { isPdfEngineAvailable } from '../helpers/pdfEngine.js';
import { closePdfBrowser } from '../../src/services/pdfGenerator.js';

const prisma = createTestPrisma();

describe('PDF integration', () => {
  let app;
  let dbReady = false;
  let pdfReady = false;

  before(async () => {
    dbReady = await isDatabaseAvailable(prisma);
    pdfReady = await isPdfEngineAvailable();
    if (dbReady) app = await createApp({ prisma });
    if (!pdfReady) {
      console.warn('PDF integration testleri atlandı — Puppeteer Chrome bulunamadı.');
    }
  });

  beforeEach(async () => {
    if (dbReady) await resetDatabase(prisma);
  });

  after(async () => {
    await closePdfBrowser();
    await prisma.$disconnect();
  });

  test('tekil öğrenci PDF — application/pdf döner', { timeout: 90000 }, async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');
    if (!pdfReady) return t.skip('Puppeteer Chrome yok');

    const schoolClass = await prisma.schoolClass.create({ data: { name: '10-A' } });
    const teacher = await prisma.teacher.create({ data: { name: 'Öğretmen Test' } });
    const student = await prisma.student.create({
      data: {
        studentNumber: '501',
        firstName: 'Öğrenci',
        lastName: 'Test',
        classId: schoolClass.id,
      },
    });
    await prisma.studySession.create({
      data: {
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
        teacherId: teacher.id,
        students: { create: [{ studentId: student.id }] },
      },
    });

    const res = await request(app)
      .get(`/pdf/students/${student.id}`)
      .set('Accept', 'application/pdf');

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'] ?? '', /application\/pdf/);
    assert.ok(res.body.length > 100);
    assert.equal(res.body.subarray(0, 4).toString(), '%PDF');
  });

  test('olmayan öğrenci → 404 NOT_FOUND', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const res = await request(app)
      .get('/pdf/students/99999')
      .set('Accept', 'application/json');

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
