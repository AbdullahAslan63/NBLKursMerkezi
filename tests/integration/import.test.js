import 'dotenv/config';
import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestPrisma, resetDatabase, isDatabaseAvailable } from '../helpers/testDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, '../fixtures/IOG02005_629.XLS');
const prisma = createTestPrisma();

describe('Excel import integration', () => {
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

  test('IOG02005 fixture + className ile import', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const res = await request(app)
      .post('/students/import')
      .set('Accept', 'application/json')
      .field('className', '12-A')
      .attach('file', fixturePath);

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.data.added > 0);
    assert.equal(res.body.data.className, '12-A');
    assert.ok(Array.isArray(res.body.data.rowErrors));
  });

  test('ikinci import aynı dosya — güncelleme (upsert)', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    await request(app)
      .post('/students/import')
      .set('Accept', 'application/json')
      .field('className', '12-A')
      .attach('file', fixturePath);

    const res = await request(app)
      .post('/students/import')
      .set('Accept', 'application/json')
      .field('className', '12-B')
      .attach('file', fixturePath);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.updated > 0, true);
    assert.equal(res.body.data.className, '12-B');
  });

  test('sınıf olmadan import → 400 CLASS_REQUIRED', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const res = await request(app)
      .post('/students/import')
      .set('Accept', 'application/json')
      .attach('file', fixturePath);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'CLASS_REQUIRED');
  });

  test('geçersiz dosya → 422 INVALID_EXCEL_FORMAT', async (t) => {
    if (!dbReady) return t.skip('Veritabanı yok');

    const res = await request(app)
      .post('/students/import')
      .set('Accept', 'application/json')
      .field('className', '9-A')
      .attach('file', Buffer.from('not-excel'), 'bad.txt');

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });
});
