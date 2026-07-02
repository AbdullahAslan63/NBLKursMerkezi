import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseIog02005,
  validateIog02005Headers,
  isValidStudentNumber,
} from '../../src/services/excelImport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, '../fixtures/IOG02005_629.XLS');

test('validateIog02005Headers — geçerli başlık', () => {
  const header = ['S.No', 'Öğrenci No', '', '', 'Adı', '', '', '', '', 'Soyadı', '', '', '', 'Cinsiyeti', ''];
  assert.equal(validateIog02005Headers(header), true);
});

test('validateIog02005Headers — geçersiz başlık', () => {
  assert.equal(validateIog02005Headers(['Ad', 'Soyad']), false);
});

test('isValidStudentNumber — sayısal kontrol', () => {
  assert.equal(isValidStudentNumber('12345'), true);
  assert.equal(isValidStudentNumber(''), false);
  assert.equal(isValidStudentNumber('abc'), false);
});

test('parseIog02005 — fixture ile parse', () => {
  const buffer = fs.readFileSync(fixturePath);
  const result = parseIog02005(buffer);

  assert.ok(result.rows.length > 0);
  assert.equal(result.rows[0].firstName, 'ESMA NUR');
  assert.equal(result.rows[0].lastName, 'AKYAR');
  assert.equal(result.rows[0].studentNumber, '7');
});

test('parseIog02005 — geçersiz dosya', () => {
  assert.throws(() => parseIog02005(Buffer.from('not excel')), (err) => {
    return err.code === 'INVALID_EXCEL_FORMAT';
  });
});

test('parseIog02005 — Türkçe karakterler korunur', () => {
  const buffer = fs.readFileSync(fixturePath);
  const result = parseIog02005(buffer);
  const bozdas = result.rows.find((r) => r.lastName === 'BOZDAŞ');
  assert.ok(bozdas, 'BOZDAŞ soyadı bulunmalı');
});
