import { Router } from 'express';
import { DAYS_OF_WEEK, TIME_SLOTS, getMonthLabel } from '../config/schedule.js';
import {
  buildStudentCellMap,
  buildTeacherCellMap,
  studentDisplayName,
  studentSubtitle,
  getDynamicTimeSlots,
} from '../lib/pdfScheduleData.js';
import {
  enqueuePdfJob,
  generatePdfFromTemplate,
  pdfContentDisposition,
} from '../services/pdfGenerator.js';

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

function formatGeneratedAt() {
  return new Date().toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function pdfBaseData(req) {
  return {
    appName: req.app.locals.appName,
    days: DAYS_OF_WEEK,
    timeSlots: TIME_SLOTS,
    generatedAt: formatGeneratedAt(),
  };
}

function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', pdfContentDisposition(filename));
  return res.send(buffer);
}

async function handlePdfRoute(res, filename, jobFn) {
  try {
    const buffer = await enqueuePdfJob(jobFn);
    return sendPdf(res, buffer, filename);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.fail('NOT_FOUND', err.message, { status: 404 });
    }
    console.error('PDF hatası:', err);
    return res.fail('INTERNAL_ERROR', 'PDF oluşturulamadı.', { status: 500 });
  }
}

export default function createPdfRouter(prisma) {
  const router = Router();

  router.get('/students/all', async (req, res) => {
    const month = req.query.month ? Number(req.query.month) : null;
    const week = req.query.week ? Number(req.query.week) : null;

    const students = await prisma.student.findMany({
      orderBy: [{ schoolClass: { name: 'asc' } }, { lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        schoolClass: true,
        sessions: {
          include: {
            studySession: { include: { teacher: true } },
          },
          where: {
            studySession: {
              ...(month ? { month } : {}),
              ...(week ? { weekNumber: week } : {}),
            }
          }
        },
      },
    });

    let periodText = '';
    if (month && week) {
      periodText = ` (${getMonthLabel(month)} - ${week}. Hafta)`;
    }

    const base = pdfBaseData(req);
    const pages = students.map((student) => {
      const sessions = student.sessions.map((link) => link.studySession);
      const timeSlots = getDynamicTimeSlots(sessions);
      return {
        heading: studentDisplayName(student),
        subheading: studentSubtitle(student) + periodText,
        timeSlots,
        cellMap: buildStudentCellMap(sessions),
      };
    });

    return handlePdfRoute(res, 'ogrenci-programlari.pdf', () =>
      generatePdfFromTemplate('bulk-schedules', {
        ...base,
        documentTitle: 'Öğrenci Etüt Programları',
        emptyMessage: 'Henüz kayıtlı öğrenci yok.',
        pages,
      }),
    );
  });

  router.get('/teachers/all', async (req, res) => {
    const month = req.query.month ? Number(req.query.month) : null;
    const week = req.query.week ? Number(req.query.week) : null;

    const teachers = await prisma.teacher.findMany({
      orderBy: { name: 'asc' },
      include: {
        studySessions: {
          where: {
            ...(month ? { month } : {}),
            ...(week ? { weekNumber: week } : {}),
          },
          include: {
            students: { include: { student: true } },
          },
        },
      },
    });

    let periodText = '';
    if (month && week) {
      periodText = ` (${getMonthLabel(month)} - ${week}. Hafta)`;
    }

    const base = pdfBaseData(req);
    const pages = teachers.map((teacher) => {
      const sessions = teacher.studySessions;
      const timeSlots = getDynamicTimeSlots(sessions);
      return {
        heading: teacher.name,
        subheading: teacher.subject 
          ? `${teacher.subject} · ${sessions.length} etüt${periodText}` 
          : `${sessions.length} etüt${periodText}`,
        timeSlots,
        cellMap: buildTeacherCellMap(sessions),
      };
    });

    return handlePdfRoute(res, 'ogretmen-programlari.pdf', () =>
      generatePdfFromTemplate('bulk-schedules', {
        ...base,
        documentTitle: 'Öğretmen Etüt Programları',
        emptyMessage: 'Henüz kayıtlı öğretmen yok.',
        pages,
      }),
    );
  });

  router.get('/students/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.fail('NOT_FOUND', 'Öğrenci bulunamadı.', { status: 404 });

    const month = req.query.month ? Number(req.query.month) : null;
    const week = req.query.week ? Number(req.query.week) : null;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        schoolClass: true,
        sessions: {
          include: {
            studySession: { include: { teacher: true } },
          },
          where: {
            studySession: {
              ...(month ? { month } : {}),
              ...(week ? { weekNumber: week } : {}),
            }
          }
        },
      },
    });

    if (!student) return res.fail('NOT_FOUND', 'Öğrenci bulunamadı.', { status: 404 });

    const sessions = student.sessions.map((link) => link.studySession);

    // Prevent empty exports
    if (sessions.length === 0) {
      return res.fail('VALIDATION_ERROR', 'Bu tarih aralığında planlanmış etüt bulunmamaktadır.', { status: 400 });
    }

    let periodText = '';
    if (month && week) {
      periodText = ` (${getMonthLabel(month)} - ${week}. Hafta)`;
    }

    const name = studentDisplayName(student);
    const filename = `ogrenci-${student.studentNumber}.pdf`;
    const timeSlots = getDynamicTimeSlots(sessions);

    return handlePdfRoute(res, filename, () =>
      generatePdfFromTemplate('student-schedule', {
        ...pdfBaseData(req),
        timeSlots,
        heading: name,
        subheading: studentSubtitle(student) + periodText,
        cellMap: buildStudentCellMap(sessions),
      }),
    );
  });

  router.get('/teachers/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.fail('NOT_FOUND', 'Öğretmen bulunamadı.', { status: 404 });

    const month = req.query.month ? Number(req.query.month) : null;
    const week = req.query.week ? Number(req.query.week) : null;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        studySessions: {
          where: {
            ...(month ? { month } : {}),
            ...(week ? { weekNumber: week } : {}),
          },
          include: {
            students: { include: { student: true } },
          },
        },
      },
    });

    if (!teacher) return res.fail('NOT_FOUND', 'Öğretmen bulunamadı.', { status: 404 });

    const sessions = teacher.studySessions;

    // Prevent empty exports
    if (sessions.length === 0) {
      return res.fail('VALIDATION_ERROR', 'Bu tarih aralığında planlanmış etüt bulunmamaktadır.', { status: 400 });
    }

    let periodText = '';
    if (month && week) {
      periodText = ` (${getMonthLabel(month)} - ${week}. Hafta)`;
    }

    const filename = `ogretmen-${teacher.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    const timeSlots = getDynamicTimeSlots(sessions);
    const teacherSub = teacher.subject 
      ? `${teacher.subject} · ${sessions.length} etüt${periodText}` 
      : `${sessions.length} etüt${periodText}`;

    return handlePdfRoute(res, filename, () =>
      generatePdfFromTemplate('teacher-schedule', {
        ...pdfBaseData(req),
        timeSlots,
        heading: teacher.name,
        subheading: teacherSub,
        cellMap: buildTeacherCellMap(sessions),
      }),
    );
  });

  return router;
}
