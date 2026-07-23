import { Router } from 'express';
import {
  DAYS_OF_WEEK,
  MONTHS,
  getWeeksOfMonth,
  getCalendarYear,
  getMonthLabel,
  getTodayDayKey,
} from '../config/schedule.js';

/**
 * GET /api/calendar?month=9&week=1
 * Seçilen ay ve hafta için takvim günlerini ve etüt verilerini döner.
 */
export default function createCalendarRouter(prisma) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const month = Number(req.query.month);
      const week = Number(req.query.week);

      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return res.fail('VALIDATION_ERROR', 'Geçersiz ay değeri (1-12).', { status: 400 });
      }

      if (!Number.isInteger(week) || week < 1 || week > 6) {
        return res.fail('VALIDATION_ERROR', 'Geçersiz hafta değeri (1-5).', { status: 400 });
      }

      // Takvim yılını akademik yıla göre hesapla
      const year = getCalendarYear(month);
      const allWeeks = getWeeksOfMonth(year, month);

      // İstenen hafta bu ayda yoksa en yakınını kullan
      const selectedWeek = allWeeks.find((w) => w.weekNumber === week) || allWeeks[allWeeks.length - 1];
      if (!selectedWeek) {
        return res.fail('VALIDATION_ERROR', 'Bu ay için geçerli hafta bulunamadı.', { status: 400 });
      }

      // Bu hafta aralığındaki etütleri çek (month + weekNumber eşleşmesi)
      const sessions = await prisma.studySession.findMany({
        where: {
          month,
          weekNumber: selectedWeek.weekNumber,
        },
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          date: true,
          month: true,
          weekNumber: true,
          teacher: { select: { name: true, subject: true } },
          _count: { select: { students: true } },
        },
        orderBy: { id: 'asc' },
      });

      // daySessionsMap oluştur — bu haftanın günleri bazında
      const daySessionsMap = {};
      for (const day of selectedWeek.days) {
        daySessionsMap[day.dayKey] = [];
      }

      for (const session of sessions) {
        if (daySessionsMap[session.dayOfWeek]) {
          daySessionsMap[session.dayOfWeek].push({
            id: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            teacherName: session.teacher.name,
            teacherSubject: session.teacher.subject,
            studentCount: session._count.students,
            date: session.date,
          });
        }
      }

      // Kronolojik sırala
      for (const dayKey of Object.keys(daySessionsMap)) {
        daySessionsMap[dayKey].sort((a, b) => a.startTime.localeCompare(b.startTime));
      }

      // İstatistikler
      const [sessionCount, teacherCount, studentCount] = await Promise.all([
        prisma.studySession.count({ where: { month, weekNumber: selectedWeek.weekNumber } }),
        prisma.teacher.count(),
        prisma.student.count(),
      ]);

      const todayKey = getTodayDayKey();

      return res.success({
        calendarInfo: {
          month,
          monthLabel: getMonthLabel(month),
          weekNumber: selectedWeek.weekNumber,
          startDate: selectedWeek.startDate,
          endDate: selectedWeek.endDate,
          year,
          totalWeeks: allWeeks.length,
        },
        days: selectedWeek.days.map((d) => {
          const dayInfo = DAYS_OF_WEEK.find((dw) => dw.key === d.dayKey);
          return {
            key: d.dayKey,
            label: dayInfo?.label || d.dayKey,
            short: dayInfo?.short || d.dayKey.slice(0, 3),
            date: d.date,
            dateLabel: d.dateLabel,
            dayOfMonth: d.dayOfMonth,
          };
        }),
        daySessionsMap,
        stats: {
          sessions: sessionCount,
          teachers: teacherCount,
          students: studentCount,
        },
        todayKey,
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/calendar/weeks?month=9 — Ay için hafta listesi döner */
  router.get('/weeks', (req, res) => {
    const month = Number(req.query.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.fail('VALIDATION_ERROR', 'Geçersiz ay.', { status: 400 });
    }

    const year = getCalendarYear(month);
    const weeks = getWeeksOfMonth(year, month);

    return res.success({
      month,
      monthLabel: getMonthLabel(month),
      year,
      weeks: weeks.map((w) => ({
        weekNumber: w.weekNumber,
        label: `${w.weekNumber}. Hafta`,
        startDate: w.startDate,
        endDate: w.endDate,
        dayCount: w.days.length,
      })),
    });
  });

  return router;
}
