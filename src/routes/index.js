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

      const cellMap = {};
      for (const session of sessions) {
        const key = `${session.dayOfWeek}:${session.startTime}:${session.endTime}`;
        if (!cellMap[key]) cellMap[key] = { count: 0, sessions: [] };
        cellMap[key].count += 1;
        cellMap[key].sessions.push({
          id: session.id,
          teacherName: session.teacher.name,
          studentCount: session._count.students,
        });
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
