import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createMockPrisma } from '../helpers/mockPrisma.js';

let app;

before(async () => {
  process.env.AUTH_ENABLED = 'false';
  app = await createApp({ prisma: createMockPrisma() });
});

test('GET / — anasayfa HTML döner', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /html/);
  assert.match(res.text, /Haftalık Etüt Programı/);
  assert.match(res.text, /Nobel Kurs Merkezi/);
});

test('GET /teachers — öğretmen sayfası', async () => {
  const res = await request(app).get('/teachers');
  assert.equal(res.status, 200);
  assert.match(res.text, /Öğretmenler/);
});

test('GET /students — öğrenci sayfası', async () => {
  const res = await request(app).get('/students');
  assert.equal(res.status, 200);
  assert.match(res.text, /Öğrenciler/);
});

test('GET /api/classes — JSON zarfı', async () => {
  const res = await request(app).get('/api/classes').set('Accept', 'application/json');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(Array.isArray(res.body.data.classes));
});

test('GET /bilinmeyen — 404 JSON', async () => {
  const res = await request(app).get('/api/bilinmeyen').set('Accept', 'application/json');
  assert.equal(res.status, 404);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});
