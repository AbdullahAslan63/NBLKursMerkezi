import { Router } from 'express';
import {
  DAYS_OF_WEEK,
  getCalendarDetailsFromDate,
  getDateFromCalendarDetails,
} from '../config/schedule.js';
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
      const month = req.query.month ? Number(req.query.month) : null;
      const weekNumber = req.query.weekNumber ? Number(req.query.weekNumber) : null;
      const isGlobalAdd = req.query.isGlobalAdd === 'true';

      if (!dayOfWeek || !startTime || !endTime || !isValidDayKey(dayOfWeek)) {
        return res.status(400).send('Geçersiz gün veya saat aralığı.');
      }

      const [sessions, teachers, students] = await Promise.all([
        prisma.studySession.findMany({
          where: {
            dayOfWeek,
            startTime,
            endTime,
            ...(month ? { month } : {}),
            ...(weekNumber ? { weekNumber } : {}),
          },
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
        isGlobalAdd,
        sessions: sessions.map((s) => ({
          id: s.id,
          teacherId: s.teacher.id,
          teacherName: s.teacher.name,
          studentCount: s._count.students,
          studentIds: s.students.map((link) => link.studentId),
          startTime: s.startTime,
          endTime: s.endTime,
        })),
        teachers,
        students: students.map((s) => ({
          id: s.id,
          label: `${s.firstName} ${s.lastName}`,
          sublabel: `${s.studentNumber} · ${s.schoolClass?.name || 'Sınıf Yok'}`,
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

      const { dayOfWeek: dayBody, startTime, endTime } = req.body;
      const teacherId = Number(req.body.teacherId);
      const monthBody = Number(req.body.month) || 9;
      const weekNumberBody = Number(req.body.weekNumber) || 1;
      let date = typeof req.body.date === 'string' ? req.body.date : '';
      const studentIds = Array.isArray(req.body.studentIds)
        ? req.body.studentIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
        : [];

      if (!isValidDayKey(dayBody)) {
        return res.fail('VALIDATION_ERROR', 'Geçersiz gün.', { status: 400 });
      }

      // Fallback date resolution if date is missing
      if (!date) {
        const currentYear = new Date().getFullYear();
        date = getDateFromCalendarDetails(currentYear, monthBody, weekNumberBody, dayBody);
      }

      // Calculate details from date (single source of truth)
      let calDetails;
      try {
        calDetails = getCalendarDetailsFromDate(date);
      } catch (err) {
        return res.fail('VALIDATION_ERROR', err.message, { status: 400 });
      }

      const { dayOfWeek, month, weekNumber } = calDetails;

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
        month,
        weekNumber,
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
          month,
          weekNumber,
          date,
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
          month: session.month,
          weekNumber: session.weekNumber,
          date: session.date,
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

      const dayBody = req.body.dayOfWeek || existing.dayOfWeek;
      const startTime = req.body.startTime || existing.startTime;
      const endTime = req.body.endTime || existing.endTime;

      if (!isValidDayKey(dayBody)) {
        return res.fail('VALIDATION_ERROR', 'Geçersiz gün.', { status: 400 });
      }

      let date = typeof req.body.date === 'string' ? req.body.date : existing.date;

      // Fallback date resolution if date is missing
      if (!date) {
        const monthBody = Number(req.body.month) || existing.month || 9;
        const weekNumberBody = Number(req.body.weekNumber) || existing.weekNumber || 1;
        const currentYear = new Date().getFullYear();
        date = getDateFromCalendarDetails(currentYear, monthBody, weekNumberBody, dayBody);
      }

      // Calculate details from date (single source of truth)
      let calDetails;
      try {
        calDetails = getCalendarDetailsFromDate(date);
      } catch (err) {
        return res.fail('VALIDATION_ERROR', err.message, { status: 400 });
      }

      const { dayOfWeek, month, weekNumber } = calDetails;

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
        excludeSessionId: id,
        month,
        weekNumber,
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
          data: {
            teacherId,
            dayOfWeek,
            startTime,
            endTime,
            month,
            weekNumber,
            date,
          },
        });
        await tx.studySessionStudent.deleteMany({ where: { studySessionId: id } });
        await tx.studySessionStudent.createMany({
          data: studentIds.map((studentId) => ({ studySessionId: id, studentId })),
        });
      });

      return res.success(
        {
          id,
          dayOfWeek,
          startTime,
          endTime,
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

  router.get('/:id/details', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(404).send('Etüt bulunamadı.');
      }

      const session = await prisma.studySession.findUnique({
        where: { id },
        include: {
          teacher: { select: { id: true, name: true, subject: true } },
          students: {
            include: {
              student: {
                include: {
                  schoolClass: { select: { name: true } }
                }
              }
            }
          }
        }
      });

      if (!session) {
        return res.status(404).send('Etüt bulunamadı.');
      }

      res.render('partials/session-detail', {
        layout: false,
        session
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
