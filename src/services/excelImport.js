import XLSX from 'xlsx';

const COL_STUDENT_NO = 1;
const COL_FIRST_NAME = 4;
const COL_LAST_NAME = 9;

const HEADER_MARKERS = {
  [COL_STUDENT_NO]: 'öğrenci no',
  [COL_FIRST_NAME]: 'adı',
  [COL_LAST_NAME]: 'soyadı',
};

function trim(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeHeader(value) {
  return trim(value).toLocaleLowerCase('tr-TR');
}

/** IOG02005 başlık satırını doğrula */
export function validateIog02005Headers(headerRow) {
  if (!Array.isArray(headerRow)) {
    return false;
  }

  return Object.entries(HEADER_MARKERS).every(([index, marker]) => {
    const cell = normalizeHeader(headerRow[Number(index)]);
    return cell.includes(marker);
  });
}

/** Öğrenci numarası sayısal mı */
export function isValidStudentNumber(value) {
  const num = trim(value);
  return num.length > 0 && /^\d+$/.test(num);
}

/**
 * IOG02005 buffer parse — saf fonksiyon
 * @returns {{ rows: Array<{studentNumber, firstName, lastName, row}>, rowErrors: Array<{row, reason}> }}
 */
export function parseIog02005(buffer) {
  if (!buffer?.length) {
    const err = new Error('Dosya boş veya okunamadı.');
    err.code = 'INVALID_EXCEL_FORMAT';
    throw err;
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    const err = new Error('Excel dosyası okunamadı.');
    err.code = 'INVALID_EXCEL_FORMAT';
    throw err;
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    const err = new Error('Excel dosyasında sayfa bulunamadı.');
    err.code = 'INVALID_EXCEL_FORMAT';
    throw err;
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawRows.length) {
    const err = new Error('IOG02005 formatı tanınmadı — başlık satırı bulunamadı.');
    err.code = 'INVALID_EXCEL_FORMAT';
    throw err;
  }

  const headerRow = rawRows[0];
  if (!validateIog02005Headers(headerRow)) {
    const err = new Error(
      'IOG02005 formatı tanınmadı. Beklenen başlıklar: Öğrenci No, Adı, Soyadı.',
    );
    err.code = 'INVALID_EXCEL_FORMAT';
    throw err;
  }

  const rows = [];
  const rowErrors = [];

  for (let i = 1; i < rawRows.length; i++) {
    const line = rawRows[i];
    const rowNumber = i + 1;
    const studentNumber = trim(line[COL_STUDENT_NO]);
    const firstName = trim(line[COL_FIRST_NAME]);
    const lastName = trim(line[COL_LAST_NAME]);

    if (!studentNumber && !firstName && !lastName) {
      continue;
    }

    if (!isValidStudentNumber(studentNumber)) {
      if (studentNumber || firstName || lastName) {
        rowErrors.push({ row: rowNumber, reason: 'Öğrenci numarası boş veya geçersiz' });
      }
      continue;
    }

    if (!firstName || !lastName) {
      rowErrors.push({ row: rowNumber, reason: 'Ad veya soyad eksik' });
      continue;
    }

    rows.push({ studentNumber, firstName, lastName, row: rowNumber });
  }

  return { rows, rowErrors };
}

/** Parse edilmiş satırları veritabanına upsert et */
export async function importStudents(prisma, classId, parsed) {
  let added = 0;
  let updated = 0;
  let skipped = parsed.rowErrors.length;

  for (const row of parsed.rows) {
    const existing = await prisma.student.findUnique({
      where: { studentNumber: row.studentNumber },
    });

    if (existing) {
      await prisma.student.update({
        where: { id: existing.id },
        data: {
          firstName: row.firstName,
          lastName: row.lastName,
          classId,
        },
      });
      updated += 1;
    } else {
      await prisma.student.create({
        data: {
          studentNumber: row.studentNumber,
          firstName: row.firstName,
          lastName: row.lastName,
          classId,
        },
      });
      added += 1;
    }
  }

  return { added, updated, skipped, rowErrors: parsed.rowErrors };
}
