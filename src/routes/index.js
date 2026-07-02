import { renderPage } from '../lib/renderPage.js';
import { DAYS_OF_WEEK, TIME_SLOTS, getTodayDayKey } from '../config/schedule.js';

/** Anasayfa — haftalık program ızgarası */
export function createIndexHandler(prisma) {
  return async function getIndex(req, res, next) {
    try {
      const [sessionCount, teacherCount, studentCount, sessions] = await Promise.all([
        prisma.studySession.count(),
        prisma.teacher.count(),
        prisma.student.count(),
        prisma.studySession.findMany({
          select: { dayOfWeek: true, startTime: true, endTime: true },
        }),
      ]);

      const cellMap = {};
      for (const session of sessions) {
        const key = `${session.dayOfWeek}:${session.startTime}:${session.endTime}`;
        cellMap[key] = (cellMap[key] || 0) + 1;
      }

      await renderPage(res, 'pages/index', {
        title: 'Haftalık Etüt Programı',
        activeNav: 'program',
        days: DAYS_OF_WEEK,
        timeSlots: TIME_SLOTS,
        todayKey: getTodayDayKey(),
        cellMap,
        stats: {
          sessions: sessionCount,
          teachers: teacherCount,
          students: studentCount,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
