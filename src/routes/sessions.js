import { Router } from 'express';
import { DAYS_OF_WEEK } from '../config/schedule.js';
import { requireFields } from '../middleware/validate.js';
import { findStudentScheduleConflicts } from '../lib/sessionConflict.js';

function parseId(param) {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getDayLabel(dayKey) {
  return DAYS_OF_WEEK.find((d) => d.key === dayKey)?.label ?? dayKey;
}

function isValidDayKey(dayKey) {
  return DAYS_OF_WEEK.some((d) => d.key === dayKey);
}

export default function createSessionsRouter(prisma) {
  const router = Router();

  router.get('/panel', async (req, res, next) => {
    try {
      const { dayOfWeek, startTime, endTime } = req.query;

      if (!dayOfWeek || !startTime || !endTime || !isValidDayKey(dayOfWeek)) {
        return res.status(400).send('Geçersiz gün veya saat aralığı.');
      }

      const [sessions, teachers, students] = await Promise.all([
        prisma.studySession.findMany({
          where: { dayOfWeek, startTime, endTime },
          include: {
            teacher: { select: { id: true, name: true } },
            students: { select: { studentId: true } },
            _count: { select: { students: true } },
          },
          orderBy: { id: 'asc' },
        }),
        prisma.teacher.findMany({ orderBy: { name: 'asc' } }),
        prisma.student.findMany({
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          include: { schoolClass: { select: { name: true } } },
        }),
      ]);

      res.render('partials/session-modal', {
        layout: false,
        dayOfWeek,
        dayLabel: getDayLabel(dayOfWeek),
        startTime,
        endTime,
        timeLabel: `${startTime}–${endTime}`,
        sessions: sessions.map((s) => ({
          id: s.id,
          teacherId: s.teacher.id,
          teacherName: s.teacher.name,
          studentCount: s._count.students,
          studentIds: s.students.map((link) => link.studentId),
        })),
        teachers,
        students: students.map((s) => ({
          id: s.id,
          label: `${s.firstName} ${s.lastName}`,
          sublabel: `${s.studentNumber} · ${s.schoolClass.name}`,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const missing = requireFields(req.body, ['dayOfWeek', 'startTime', 'endTime', 'teacherId']);
      if (missing.length) {
        return res.fail('VALIDATION_ERROR', 'Gün, saat ve öğretmen zorunludur.', {
          status: 400,
          details: { fields: missing },
        });
      }

      const { dayOfWeek, startTime, endTime } = req.body;
      const teacherId = Number(req.body.teacherId);
      const studentIds = Array.isArray(req.body.studentIds)
        ? req.body.studentIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
        : [];

      if (!isValidDayKey(dayOfWeek)) {
        return res.fail('VALIDATION_ERROR', 'Geçersiz gün.', { status: 400 });
      }

      if (!Number.isInteger(teacherId) || teacherId < 1) {
        return res.fail('VALIDATION_ERROR', 'Geçerli bir öğretmen seçin.', {
          status: 400,
          details: { fields: ['teacherId'] },
        });
      }

      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher) {
        return res.fail('NOT_FOUND', 'Öğretmen bulunamadı.', { status: 404 });
      }

      if (studentIds.length === 0) {
        return res.fail('VALIDATION_ERROR', 'En az bir öğrenci seçin.', {
          status: 400,
          details: { fields: ['studentIds'] },
        });
      }

      const conflicts = await findStudentScheduleConflicts(prisma, {
        dayOfWeek,
        startTime,
        endTime,
        studentIds,
      });

      if (conflicts.length > 0) {
        const first = conflicts[0];
        return res.fail(
          'STUDENT_SCHEDULE_CONFLICT',
          `${first.studentName} bu saatte başka bir etüde atanmış.`,
          { status: 409, details: { conflicts } },
        );
      }

      const session = await prisma.studySession.create({
        data: {
          dayOfWeek,
          startTime,
          endTime,
          teacherId,
          students: {
            create: studentIds.map((studentId) => ({ studentId })),
          },
        },
      });

      return res.created(
        {
          id: session.id,
          dayOfWeek: session.dayOfWeek,
          startTime: session.startTime,
          endTime: session.endTime,
          teacherId: session.teacherId,
          studentIds,
        },
        'Etüt kaydedildi.',
      );
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.fail('NOT_FOUND', 'Etüt bulunamadı.', { status: 404 });
      }

      const existing = await prisma.studySession.findUnique({ where: { id } });
      if (!existing) {
        return res.fail('NOT_FOUND', 'Etüt bulunamadı.', { status: 404 });
      }

      const missing = requireFields(req.body, ['teacherId']);
      if (missing.length) {
        return res.fail('VALIDATION_ERROR', 'Öğretmen seçimi zorunludur.', {
          status: 400,
          details: { fields: missing },
        });
      }

      const teacherId = Number(req.body.teacherId);
      const studentIds = Array.isArray(req.body.studentIds)
        ? req.body.studentIds.map(Number).filter((sid) => Number.isInteger(sid) && sid > 0)
        : [];

      if (!Number.isInteger(teacherId) || teacherId < 1) {
        return res.fail('VALIDATION_ERROR', 'Geçerli bir öğretmen seçin.', {
          status: 400,
          details: { fields: ['teacherId'] },
        });
      }

      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher) {
        return res.fail('NOT_FOUND', 'Öğretmen bulunamadı.', { status: 404 });
      }

      if (studentIds.length === 0) {
        return res.fail('VALIDATION_ERROR', 'En az bir öğrenci seçin.', {
          status: 400,
          details: { fields: ['studentIds'] },
        });
      }

      const conflicts = await findStudentScheduleConflicts(prisma, {
        dayOfWeek: existing.dayOfWeek,
        startTime: existing.startTime,
        endTime: existing.endTime,
        studentIds,
        excludeSessionId: id,
      });

      if (conflicts.length > 0) {
        const first = conflicts[0];
        return res.fail(
          'STUDENT_SCHEDULE_CONFLICT',
          `${first.studentName} bu saatte başka bir etüde atanmış.`,
          { status: 409, details: { conflicts } },
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.studySession.update({
          where: { id },
          data: { teacherId },
        });
        await tx.studySessionStudent.deleteMany({ where: { studySessionId: id } });
        await tx.studySessionStudent.createMany({
          data: studentIds.map((studentId) => ({ studySessionId: id, studentId })),
        });
      });

      return res.success(
        {
          id,
          dayOfWeek: existing.dayOfWeek,
          startTime: existing.startTime,
          endTime: existing.endTime,
          teacherId,
          studentIds,
        },
        { message: 'Etüt güncellendi.' },
      );
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.fail('NOT_FOUND', 'Etüt bulunamadı.', { status: 404 });
      }

      const existing = await prisma.studySession.findUnique({ where: { id } });
      if (!existing) {
        return res.fail('NOT_FOUND', 'Etüt bulunamadı.', { status: 404 });
      }

      await prisma.studySession.delete({ where: { id } });
      return res.success({}, { message: 'Etüt silindi.' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
