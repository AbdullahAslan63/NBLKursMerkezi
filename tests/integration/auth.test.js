import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../src/app.js';
import { createMockPrisma } from '../helpers/mockPrisma.js';
import { resetPrisma } from '../../src/lib/prisma.js';
import { resetLoginRateLimit } from '../../src/middleware/loginRateLimit.js';

describe('Auth integration', () => {
  let app;
  let adminRecord;

  before(async () => {
    process.env.AUTH_ENABLED = 'true';
    const passwordHash = await bcrypt.hash('password123', 10);
    adminRecord = { id: 1, username: 'admin', password: passwordHash };

    const prisma = {
      ...createMockPrisma(),
      admin: {
        findUnique: async ({ where }) =>
          where.username === adminRecord.username ? adminRecord : null,
        create: async ({ data }) => {
          adminRecord = { id: 1, ...data };
          return adminRecord;
        },
        update: async ({ data }) => {
          adminRecord = { ...adminRecord, ...data };
          return adminRecord;
        },
      },
    };

    app = await createApp({ prisma });
  });

  beforeEach(() => {
    resetLoginRateLimit();
  });

  after(() => {
    process.env.AUTH_ENABLED = 'false';
    resetPrisma();
    resetLoginRateLimit();
  });

  test('oturumsuz /api/* → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/classes').set('Accept', 'application/json');
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  test('5 hatalı login sonrası 6. deneme → 429 RATE_LIMITED', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/login')
        .set('Accept', 'application/json')
        .send({ username: 'admin', password: 'yanlis-sifre' });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }

    const limited = await request(app)
      .post('/login')
      .set('Accept', 'application/json')
      .send({ username: 'admin', password: 'yanlis-sifre' });

    assert.equal(limited.status, 429);
    assert.equal(limited.body.ok, false);
    assert.equal(limited.body.error.code, 'RATE_LIMITED');
  });

  test('başarılı login rate limit sayacını sıfırlar', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/login')
        .set('Accept', 'application/json')
        .send({ username: 'admin', password: 'yanlis-sifre' });
    }

    const ok = await request(app)
      .post('/login')
      .set('Accept', 'application/json')
      .send({ username: 'admin', password: 'password123' });

    assert.equal(ok.status, 200);
    assert.equal(ok.body.ok, true);

    // Sayaç sıfırlandı; tekrar 5 deneme hakkı olmalı
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/login')
        .set('Accept', 'application/json')
        .send({ username: 'admin', password: 'yanlis-sifre' });
      assert.equal(res.status, 400);
    }
  });
});
