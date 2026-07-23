import { renderPage } from '../lib/renderPage.js';
import {
  DAYS_OF_WEEK,
  TIME_SLOTS,
  MONTHS,
  getTodayDayKey,
  getCurrentMonthAndWeek,
  getWeeksOfMonth,
  getCalendarYear,
  getMonthLabel,
} from '../config/schedule.js';

/** Anasayfa — dinamik takvim tabanlı program ızgarası */
export function createIndexHandler(prisma) {
  return async function getIndex(req, res, next) {
    try {
      // Mevcut ay ve haftayı belirle
      const current = getCurrentMonthAndWeek();
      const selectedMonth = current.month;
      const selectedWeek = current.weekNumber;
      const year = getCalendarYear(selectedMonth);

      // Bu ay için tüm haftaları hesapla
      const allWeeks = getWeeksOfMonth(year, selectedMonth);
      const weekData = allWeeks.find((w) => w.weekNumber === selectedWeek) || allWeeks[0];

      // Bu hafta/ay için etütleri çek
      const [sessionCount, teacherCount, studentCount, sessions] = await Promise.all([
        prisma.studySession.count({ where: { month: selectedMonth, weekNumber: selectedWeek } }),
        prisma.teacher.count(),
        prisma.student.count(),
        prisma.studySession.findMany({
          where: { month: selectedMonth, weekNumber: selectedWeek },
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            date: true,
            teacher: { select: { name: true, subject: true } },
            _count: { select: { students: true } },
          },
          orderBy: { id: 'asc' },
        }),
      ]);

      // daySessionsMap — bu haftanın günleri bazında
      const daySessionsMap = {};
      if (weekData) {
        for (const day of weekData.days) {
          daySessionsMap[day.dayKey] = [];
        }
      } else {
        DAYS_OF_WEEK.forEach((d) => {
          daySessionsMap[d.key] = [];
        });
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
          });
        }
      }

      // Kronolojik sırala
      Object.keys(daySessionsMap).forEach((dayKey) => {
        daySessionsMap[dayKey].sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      // Gün verisi — takvimden hesaplanan gerçek tarihli günler
      const calendarDays = weekData
        ? weekData.days.map((d) => {
            const dayInfo = DAYS_OF_WEEK.find((dw) => dw.key === d.dayKey);
            return {
              key: d.dayKey,
              label: dayInfo?.label || d.dayKey,
              short: dayInfo?.short || d.dayKey.slice(0, 3),
              date: d.date,
              dateLabel: d.dateLabel,
              dayOfMonth: d.dayOfMonth,
            };
          })
        : DAYS_OF_WEEK;

      await renderPage(res, 'pages/index', {
        title: 'Etüt Programı',
        activeNav: 'program',
        days: calendarDays,
        timeSlots: TIME_SLOTS,
        todayKey: getTodayDayKey(),
        daySessionsMap,
        stats: {
          sessions: sessionCount,
          teachers: teacherCount,
          students: studentCount,
        },
        // Takvim verileri
        months: MONTHS,
        selectedMonth,
        selectedWeek,
        selectedMonthLabel: getMonthLabel(selectedMonth),
        allWeeks: allWeeks.map((w) => ({
          weekNumber: w.weekNumber,
          label: `${w.weekNumber}. Hafta`,
          startDate: w.startDate,
          endDate: w.endDate,
        })),
        calendarYear: year,
      });
    } catch (err) {
      next(err);
    }
  };
}

