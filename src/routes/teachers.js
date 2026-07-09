import { Router } from 'express';
import { renderPage } from '../lib/renderPage.js';

function normalizeName(name) {
  if (name === undefined || name === null) return '';
  return String(name).trim();
}

function parseId(param) {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default function createTeachersRouter(prisma) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const teachers = await prisma.teacher.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { studySessions: true } } },
      });

      await renderPage(res, 'pages/teachers', {
        title: 'Öğretmenler',
        activeNav: 'teachers',
        teachers: teachers.map((t) => ({
          id: t.id,
          name: t.name,
          subject: t.subject,
          sessionCount: t._count.studySessions,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const name = normalizeName(req.body.name);
      const subject = normalizeName(req.body.subject);
      if (!name) {
        return res.fail('VALIDATION_ERROR', 'Öğretmen adı zorunludur.', {
          status: 400,
          details: { fields: ['name'] },
        });
      }

      const teacher = await prisma.teacher.create({ data: { name, subject } });
      return res.created({ id: teacher.id, name: teacher.name, subject: teacher.subject }, 'Öğretmen eklendi.');
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.fail('NOT_FOUND', 'Öğretmen bulunamadı.', { status: 404 });
      }

      const name = normalizeName(req.body.name);
      const subject = normalizeName(req.body.subject);
      if (!name) {
        return res.fail('VALIDATION_ERROR', 'Öğretmen adı zorunludur.', {
          status: 400,
          details: { fields: ['name'] },
        });
      }

      const existing = await prisma.teacher.findUnique({ where: { id } });
      if (!existing) {
        return res.fail('NOT_FOUND', 'Öğretmen bulunamadı.', { status: 404 });
      }

      const teacher = await prisma.teacher.update({ where: { id }, data: { name, subject } });
      return res.success({ id: teacher.id, name: teacher.name, subject: teacher.subject }, { message: 'Öğretmen güncellendi.' });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.fail('NOT_FOUND', 'Öğretmen bulunamadı.', { status: 404 });
      }

      const teacher = await prisma.teacher.findUnique({
        where: { id },
        include: { _count: { select: { studySessions: true } } },
      });

      if (!teacher) {
        return res.fail('NOT_FOUND', 'Öğretmen bulunamadı.', { status: 404 });
      }

      if (teacher._count.studySessions > 0) {
        return res.fail(
          'TEACHER_HAS_SESSIONS',
          `${teacher.name} öğretmeninin ${teacher._count.studySessions} etüt kaydı var; silinemez.`,
          { status: 409, details: { sessionCount: teacher._count.studySessions } },
        );
      }

      await prisma.teacher.delete({ where: { id } });
      return res.success({}, { message: 'Öğretmen silindi.' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
