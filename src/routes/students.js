import { Router } from 'express';
import { renderPage } from '../lib/renderPage.js';
import { requireFields } from '../middleware/validate.js';
import { excelUpload } from '../middleware/upload.js';
import { resolveTargetClass } from '../lib/resolveTargetClass.js';
import { parseIog02005, importStudents } from '../services/excelImport.js';

function trim(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function parseId(param) {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default function createStudentsRouter(prisma) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const students = await prisma.student.findMany({
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: { schoolClass: { select: { id: true, name: true } } },
      });

      await renderPage(res, 'pages/students', {
        title: 'Öğrenciler',
        activeNav: 'students',
        students: students.map((s) => ({
          id: s.id,
          studentNumber: s.studentNumber,
          firstName: s.firstName,
          lastName: s.lastName,
          classId: s.classId,
          className: s.schoolClass.name,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      if (!req.body.classId) {
        return res.fail('CLASS_REQUIRED', 'Öğrenci için sınıf seçimi zorunludur.', {
          status: 400,
          details: { fields: ['classId'] },
        });
      }

      const missing = requireFields(req.body, ['studentNumber', 'firstName', 'lastName']);
      if (missing.length) {
        return res.fail('VALIDATION_ERROR', 'Öğrenci numarası, ad ve soyad zorunludur.', {
          status: 400,
          details: { fields: missing },
        });
      }

      const studentNumber = trim(req.body.studentNumber);
      const firstName = trim(req.body.firstName);
      const lastName = trim(req.body.lastName);
      const classId = Number(req.body.classId);

      if (!studentNumber || !firstName || !lastName) {
        return res.fail('VALIDATION_ERROR', 'Öğrenci numarası, ad ve soyad zorunludur.', {
          status: 400,
          details: { fields: ['studentNumber', 'firstName', 'lastName'].filter((f) => !trim(req.body[f])) },
        });
      }

      if (!/^\d+$/.test(studentNumber)) {
        return res.fail('VALIDATION_ERROR', 'Öğrenci numarası sadece rakamlardan oluşmalıdır.', {
          status: 400,
          details: { fields: ['studentNumber'] },
        });
      }

      if (!Number.isInteger(classId) || classId < 1) {
        return res.fail('CLASS_REQUIRED', 'Geçerli bir sınıf seçin.', {
          status: 400,
          details: { fields: ['classId'] },
        });
      }

      const schoolClass = await prisma.schoolClass.findUnique({ where: { id: classId } });
      if (!schoolClass) {
        return res.fail('NOT_FOUND', 'Seçilen sınıf bulunamadı.', { status: 404 });
      }

      const student = await prisma.student.create({
        data: { studentNumber, firstName, lastName, classId },
        include: { schoolClass: { select: { name: true } } },
      });

      return res.created(
        {
          id: student.id,
          studentNumber: student.studentNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          classId: student.classId,
          className: student.schoolClass.name,
        },
        'Öğrenci eklendi.',
      );
    } catch (err) {
      if (err.code === 'P2002') {
        return res.fail('VALIDATION_ERROR', 'Bu öğrenci numarası zaten kayıtlı.', {
          status: 400,
          details: { fields: ['studentNumber'] },
        });
      }
      next(err);
    }
  });

  router.post('/import', (req, res, next) => {
    excelUpload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'VALIDATION_ERROR') {
          return res.fail('VALIDATION_ERROR', err.message, { status: 400 });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.fail('VALIDATION_ERROR', 'Dosya boyutu 5 MB sınırını aşıyor.', { status: 400 });
        }
        return next(err);
      }
      next();
    });
  }, async (req, res, next) => {
    try {
      if (!req.file) {
        return res.fail('VALIDATION_ERROR', 'Excel dosyası zorunludur.', {
          status: 400,
          details: { fields: ['file'] },
        });
      }

      if (!req.body.classId && !req.body.className) {
        return res.fail('CLASS_REQUIRED', 'Hedef sınıf seçimi zorunludur.', {
          status: 400,
          details: { fields: ['classId', 'className'] },
        });
      }

      const schoolClass = await resolveTargetClass(prisma, {
        classId: req.body.classId,
        className: req.body.className,
      });

      if (!schoolClass) {
        return res.fail('CLASS_REQUIRED', 'Geçerli bir hedef sınıf belirtin.', {
          status: 400,
          details: { fields: ['classId', 'className'] },
        });
      }

      let parsed;
      try {
        parsed = parseIog02005(req.file.buffer);
      } catch (err) {
        if (err.code === 'INVALID_EXCEL_FORMAT') {
          return res.fail('INVALID_EXCEL_FORMAT', err.message, { status: 422 });
        }
        throw err;
      }

      const result = await importStudents(prisma, schoolClass.id, schoolClass.name, parsed);
      const total = result.added + result.updated;
      const message =
        total > 0
          ? `${total} öğrenci ${schoolClass.name} sınıfına aktarıldı (${result.updated} güncellendi, ${result.added} eklendi).`
          : `Aktarılacak öğrenci bulunamadı (${result.skipped} satır atlandı).`;

      return res.success(
        {
          added: result.added,
          updated: result.updated,
          skipped: result.skipped,
          className: schoolClass.name,
          rowErrors: result.rowErrors,
          students: result.students,
        },
        { message },
      );
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.fail('NOT_FOUND', 'Öğrenci bulunamadı.', { status: 404 });
      }

      if (!req.body.classId) {
        return res.fail('CLASS_REQUIRED', 'Öğrenci için sınıf seçimi zorunludur.', {
          status: 400,
          details: { fields: ['classId'] },
        });
      }

      const missing = requireFields(req.body, ['studentNumber', 'firstName', 'lastName']);

      const studentNumber = trim(req.body.studentNumber);
      const firstName = trim(req.body.firstName);
      const lastName = trim(req.body.lastName);
      const classId = Number(req.body.classId);

      if (!studentNumber || !firstName || !lastName) {
        return res.fail('VALIDATION_ERROR', 'Öğrenci numarası, ad ve soyad zorunludur.', {
          status: 400,
          details: { fields: ['studentNumber', 'firstName', 'lastName'].filter((f) => !trim(req.body[f])) },
        });
      }

      if (!/^\d+$/.test(studentNumber)) {
        return res.fail('VALIDATION_ERROR', 'Öğrenci numarası sadece rakamlardan oluşmalıdır.', {
          status: 400,
          details: { fields: ['studentNumber'] },
        });
      }

      const existing = await prisma.student.findUnique({ where: { id } });
      if (!existing) {
        return res.fail('NOT_FOUND', 'Öğrenci bulunamadı.', { status: 404 });
      }

      const schoolClass = await prisma.schoolClass.findUnique({ where: { id: classId } });
      if (!schoolClass) {
        return res.fail('NOT_FOUND', 'Seçilen sınıf bulunamadı.', { status: 404 });
      }

      const student = await prisma.student.update({
        where: { id },
        data: { studentNumber, firstName, lastName, classId },
        include: { schoolClass: { select: { name: true } } },
      });

      return res.success(
        {
          id: student.id,
          studentNumber: student.studentNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          classId: student.classId,
          className: student.schoolClass.name,
        },
        { message: 'Öğrenci güncellendi.' },
      );
    } catch (err) {
      if (err.code === 'P2002') {
        return res.fail('VALIDATION_ERROR', 'Bu öğrenci numarası zaten kayıtlı.', {
          status: 400,
          details: { fields: ['studentNumber'] },
        });
      }
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.fail('NOT_FOUND', 'Öğrenci bulunamadı.', { status: 404 });
      }

      const existing = await prisma.student.findUnique({ where: { id } });
      if (!existing) {
        return res.fail('NOT_FOUND', 'Öğrenci bulunamadı.', { status: 404 });
      }

      await prisma.student.delete({ where: { id } });
      return res.success({}, { message: 'Öğrenci silindi.' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
