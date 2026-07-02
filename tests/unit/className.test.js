import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClassName, isValidClassName } from '../../src/lib/className.js';

test('normalizeClassName — trim', () => {
  assert.equal(normalizeClassName('  12-A  '), '12-A');
});

test('normalizeClassName — boş ad', () => {
  assert.equal(normalizeClassName('   '), '');
  assert.equal(normalizeClassName(null), '');
});

test('isValidClassName — geçerli / geçersiz', () => {
  assert.equal(isValidClassName('10-B'), true);
  assert.equal(isValidClassName(''), false);
});
