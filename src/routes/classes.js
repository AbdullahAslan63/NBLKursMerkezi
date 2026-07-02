import { Router } from 'express';
import { normalizeClassName, isValidClassName } from '../lib/className.js';

export default function createClassesRouter(prisma) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const classes = await prisma.schoolClass.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { students: true } } },
      });

      res.success({
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          studentCount: c._count.students,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const name = normalizeClassName(req.body.name);
      if (!isValidClassName(name)) {
        return res.fail('VALIDATION_ERROR', 'Sınıf adı zorunludur.', {
          status: 400,
          details: { fields: ['name'] },
        });
      }

      const created = await prisma.schoolClass.create({ data: { name } });
      return res.created(
        { id: created.id, name: created.name, studentCount: 0 },
        'Sınıf oluşturuldu.',
      );
    } catch (err) {
      if (err.code === 'P2002') {
        return res.fail('DUPLICATE_CLASS_NAME', 'Bu sınıf adı zaten kayıtlı.', { status: 409 });
      }
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.fail('NOT_FOUND', 'Sınıf bulunamadı.', { status: 404 });
      }

      const name = normalizeClassName(req.body.name);
      if (!isValidClassName(name)) {
        return res.fail('VALIDATION_ERROR', 'Sınıf adı zorunludur.', {
          status: 400,
          details: { fields: ['name'] },
        });
      }

      const existing = await prisma.schoolClass.findUnique({ where: { id } });
      if (!existing) {
        return res.fail('NOT_FOUND', 'Sınıf bulunamadı.', { status: 404 });
      }

      const updated = await prisma.schoolClass.update({
        where: { id },
        data: { name },
        include: { _count: { select: { students: true } } },
      });

      return res.success(
        {
          id: updated.id,
          name: updated.name,
          studentCount: updated._count.students,
        },
        { message: 'Sınıf güncellendi.' },
      );
    } catch (err) {
      if (err.code === 'P2002') {
        return res.fail('DUPLICATE_CLASS_NAME', 'Bu sınıf adı zaten kayıtlı.', { status: 409 });
      }
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.fail('NOT_FOUND', 'Sınıf bulunamadı.', { status: 404 });
      }

      const schoolClass = await prisma.schoolClass.findUnique({
        where: { id },
        include: { _count: { select: { students: true } } },
      });

      if (!schoolClass) {
        return res.fail('NOT_FOUND', 'Sınıf bulunamadı.', { status: 404 });
      }

      if (schoolClass._count.students > 0) {
        return res.fail(
          'CLASS_HAS_STUDENTS',
          `${schoolClass.name} sınıfında ${schoolClass._count.students} öğrenci var; silinemez.`,
          { status: 409, details: { studentCount: schoolClass._count.students } },
        );
      }

      await prisma.schoolClass.delete({ where: { id } });
      return res.success({}, { message: 'Sınıf silindi.' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
