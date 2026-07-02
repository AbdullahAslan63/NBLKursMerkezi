/** Öğrenci etüt çakışma kontrolü — §8 */

export async function findStudentScheduleConflicts(
  prisma,
  { dayOfWeek, startTime, endTime, studentIds, excludeSessionId = null },
) {
  if (!studentIds?.length) return [];

  const conflicts = await prisma.studySessionStudent.findMany({
    where: {
      studentId: { in: studentIds },
      studySession: {
        dayOfWeek,
        startTime,
        endTime,
        ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      },
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      studySession: { select: { id: true, teacher: { select: { name: true } } } },
    },
  });

  return conflicts.map((c) => ({
    studentId: c.student.id,
    studentName: `${c.student.firstName} ${c.student.lastName}`,
    sessionId: c.studySession.id,
    teacherName: c.studySession.teacher.name,
  }));
}
