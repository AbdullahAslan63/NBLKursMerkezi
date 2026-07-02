import { test } from 'node:test';
import assert from 'node:assert/strict';
import { success, fail } from '../../src/lib/apiResponse.js';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

test('success — ok:true zarfı', () => {
  const res = mockRes();
  success(res, { id: 1 }, { message: 'Kaydedildi.' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.data, { id: 1 });
  assert.equal(res.body.message, 'Kaydedildi.');
});

test('fail — ok:false ve error.code', () => {
  const res = mockRes();
  fail(res, 'NOT_FOUND', 'Kayıt bulunamadı.', { status: 404 });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.equal(res.body.error.message, 'Kayıt bulunamadı.');
});
