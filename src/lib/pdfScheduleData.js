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
      const subject = session.teacher.subject ? session.teacher.subject.trim() : '';
      const display = subject ? `${subject} (${session.teacher.name})` : session.teacher.name;
      map[key].push(display);
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

export function getDynamicTimeSlots(sessions) {
  const slotsMap = {};
  for (const session of sessions) {
    if (!session.startTime || !session.endTime) continue;
    const key = `${session.startTime}-${session.endTime}`;
    slotsMap[key] = {
      startTime: session.startTime,
      endTime: session.endTime,
      label: `${session.startTime}–${session.endTime}`,
    };
  }
  
  const sorted = Object.values(slotsMap).sort((a, b) => {
    const startCompare = a.startTime.localeCompare(b.startTime);
    if (startCompare !== 0) return startCompare;
    return a.endTime.localeCompare(b.endTime);
  });

  if (sorted.length === 0) {
    return [
      { startTime: '09:00', endTime: '10:00', label: '09:00–10:00' },
      { startTime: '10:00', endTime: '11:00', label: '10:00–11:00' },
      { startTime: '11:00', endTime: '12:00', label: '11:00–12:00' },
      { startTime: '13:00', endTime: '14:00', label: '13:00–14:00' },
      { startTime: '14:00', endTime: '15:00', label: '14:00–15:00' },
      { startTime: '15:00', endTime: '16:00', label: '15:00–16:00' },
      { startTime: '16:00', endTime: '17:00', label: '16:00–17:00' },
      { startTime: '17:00', endTime: '18:00', label: '17:00–18:00' },
    ];
  }
  return sorted;
}
