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
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            teacher: { select: { name: true } },
            _count: { select: { students: true } },
          },
          orderBy: { id: 'asc' },
        }),
      ]);

      const daySessionsMap = {};
      DAYS_OF_WEEK.forEach((d) => {
        daySessionsMap[d.key] = [];
      });

      for (const session of sessions) {
        daySessionsMap[session.dayOfWeek].push({
          id: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          teacherName: session.teacher.name,
          studentCount: session._count.students,
        });
      }

      // Sort chronologically by startTime
      Object.keys(daySessionsMap).forEach((dayKey) => {
        daySessionsMap[dayKey].sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      await renderPage(res, 'pages/index', {
        title: 'Haftalık Etüt Programı',
        activeNav: 'program',
        days: DAYS_OF_WEEK,
        timeSlots: TIME_SLOTS,
        todayKey: getTodayDayKey(),
        daySessionsMap,
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
