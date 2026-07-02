/** PDF program ızgarası için hücre verisi */

export function sessionCellKey(session) {
  return `${session.dayOfWeek}:${session.startTime}:${session.endTime}`;
}

/** Öğrenci etütleri → hücrede öğretmen adları */
export function buildStudentCellMap(sessions) {
  const map = {};
  for (const session of sessions) {
    const key = sessionCellKey(session);
    if (!map[key]) map[key] = [];
    if (session.teacher?.name) {
      map[key].push(session.teacher.name);
    }
  }
  return map;
}

/** Öğretmen etütleri → hücrede öğrenci adları (kısaltılmış) */
export function buildTeacherCellMap(sessions) {
  const map = {};
  for (const session of sessions) {
    const key = sessionCellKey(session);
    const names = (session.students ?? []).map((link) => {
      const s = link.student ?? link;
      return `${s.firstName} ${s.lastName}`;
    });
    map[key] = formatStudentList(names);
  }
  return map;
}

function formatStudentList(names) {
  if (!names.length) return '';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}

export function studentDisplayName(student) {
  return `${student.firstName} ${student.lastName}`;
}

export function studentSubtitle(student) {
  const className = student.schoolClass?.name ?? student.className ?? '';
  return `${student.studentNumber}${className ? ` · ${className}` : ''}`;
}
