import { Router } from 'express';
import { DAYS_OF_WEEK, TIME_SLOTS } from '../config/schedule.js';
import {
  buildStudentCellMap,
  buildTeacherCellMap,
  studentDisplayName,
  studentSubtitle,
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
    const students = await prisma.student.findMany({
      orderBy: [{ schoolClass: { name: 'asc' } }, { lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        schoolClass: true,
        sessions: {
          include: {
            studySession: { include: { teacher: true } },
          },
        },
      },
    });

    const base = pdfBaseData(req);
    const pages = students.map((student) => {
      const sessions = student.sessions.map((link) => link.studySession);
      return {
        heading: studentDisplayName(student),
        subheading: studentSubtitle(student),
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
    const teachers = await prisma.teacher.findMany({
      orderBy: { name: 'asc' },
      include: {
        studySessions: {
          include: {
            students: { include: { student: true } },
          },
        },
      },
    });

    const base = pdfBaseData(req);
    const pages = teachers.map((teacher) => ({
      heading: teacher.name,
      subheading: `${teacher.studySessions.length} etüt`,
      cellMap: buildTeacherCellMap(teacher.studySessions),
    }));

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

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        schoolClass: true,
        sessions: {
          include: {
            studySession: { include: { teacher: true } },
          },
        },
      },
    });

    if (!student) return res.fail('NOT_FOUND', 'Öğrenci bulunamadı.', { status: 404 });

    const sessions = student.sessions.map((link) => link.studySession);
    const name = studentDisplayName(student);
    const filename = `ogrenci-${student.studentNumber}.pdf`;

    return handlePdfRoute(res, filename, () =>
      generatePdfFromTemplate('student-schedule', {
        ...pdfBaseData(req),
        heading: name,
        subheading: studentSubtitle(student),
        cellMap: buildStudentCellMap(sessions),
      }),
    );
  });

  router.get('/teachers/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.fail('NOT_FOUND', 'Öğretmen bulunamadı.', { status: 404 });

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        studySessions: {
          include: {
            students: { include: { student: true } },
          },
        },
      },
    });

    if (!teacher) return res.fail('NOT_FOUND', 'Öğretmen bulunamadı.', { status: 404 });

    const filename = `ogretmen-${teacher.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;

    return handlePdfRoute(res, filename, () =>
      generatePdfFromTemplate('teacher-schedule', {
        ...pdfBaseData(req),
        heading: teacher.name,
        cellMap: buildTeacherCellMap(teacher.studySessions),
      }),
    );
  });

  return router;
}
