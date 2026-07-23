/** Haftalık program sabitleri — tek doğruluk kaynağı */

export const DAYS_OF_WEEK = [
  { key: 'MONDAY', label: 'Pazartesi', short: 'Pzt' },
  { key: 'TUESDAY', label: 'Salı', short: 'Sal' },
  { key: 'WEDNESDAY', label: 'Çarşamba', short: 'Çar' },
  { key: 'THURSDAY', label: 'Perşembe', short: 'Per' },
  { key: 'FRIDAY', label: 'Cuma', short: 'Cum' },
  { key: 'SATURDAY', label: 'Cumartesi', short: 'Cmt' },
  { key: 'SUNDAY', label: 'Pazar', short: 'Paz' },
];

/** Saat aralıkları — startTime/endTime "HH:MM" formatında */
export const TIME_SLOTS = [
  { startTime: '09:00', endTime: '10:00', label: '09:00–10:00' },
  { startTime: '10:00', endTime: '11:00', label: '10:00–11:00' },
  { startTime: '11:00', endTime: '12:00', label: '11:00–12:00' },
  { startTime: '13:00', endTime: '14:00', label: '13:00–14:00' },
  { startTime: '14:00', endTime: '15:00', label: '14:00–15:00' },
  { startTime: '15:00', endTime: '16:00', label: '15:00–16:00' },
  { startTime: '16:00', endTime: '17:00', label: '16:00–17:00' },
  { startTime: '17:00', endTime: '18:00', label: '17:00–18:00' },
];

/** JS Date.getDay() → DayOfWeek enum */
export function getTodayDayKey() {
  const map = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return map[new Date().getDay()];
}

/* ── Takvim Sistemi — Ay + Hafta Hesaplayıcılar ── */

/** Türkçe ay isimleri */
export const MONTHS = [
  { value: 1, label: 'Ocak' },
  { value: 2, label: 'Şubat' },
  { value: 3, label: 'Mart' },
  { value: 4, label: 'Nisan' },
  { value: 5, label: 'Mayıs' },
  { value: 6, label: 'Haziran' },
  { value: 7, label: 'Temmuz' },
  { value: 8, label: 'Ağustos' },
  { value: 9, label: 'Eylül' },
  { value: 10, label: 'Ekim' },
  { value: 11, label: 'Kasım' },
  { value: 12, label: 'Aralık' },
];

/** Türkçe kısa ay isimleri (gün pill'lerinde tarih göstermek için) */
const SHORT_MONTHS = [
  '', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
];

/** JS Date.getDay() → DayOfWeek enum dönüştürme map'i */
const JS_DAY_TO_KEY = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/**
 * Akademik yılı belirle.
 * Eylül–Aralık → mevcut yıl; Ocak–Ağustos → önceki yıl başlangıç.
 * Döndürür: { startYear, endYear } ör. { 2026, 2027 }
 */
export function getAcademicYear(refDate = new Date()) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth() + 1; // 1-based
  if (month >= 9) {
    return { startYear: year, endYear: year + 1 };
  }
  return { startYear: year - 1, endYear: year };
}

/**
 * Belirli bir ay ve yıl için takvim yılını belirle.
 * Eylül–Aralık → akademik yılın startYear'ı; Ocak–Ağustos → akademik yılın endYear'ı.
 */
export function getCalendarYear(month, refDate = new Date()) {
  const { startYear, endYear } = getAcademicYear(refDate);
  return month >= 9 ? startYear : endYear;
}

/**
 * Bir tarih için YYYY-MM-DD formatında string döner.
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Verilen ay için takvim haftalarını hesaplar.
 * Haftalar ayın 1'inden başlar ve haftanın kalan günlerini içerir.
 * Hafta sınırı: Pazartesi başlangıç.
 * 
 * @param {number} year  — Takvim yılı
 * @param {number} month — Ay (1-12)
 * @returns {Array} — Hafta dizisi, her biri:
 *   { weekNumber: 1-5, startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD',
 *     days: [{ dayKey, date, dateLabel, dayOfMonth, shortMonth }] }
 */
export function getWeeksOfMonth(year, month) {
  const weeks = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // ayın son günü
  const totalDays = lastDay.getDate();

  let currentDate = new Date(firstDay);
  let weekNumber = 1;

  while (currentDate.getMonth() === month - 1) {
    const weekDays = [];
    const weekStart = new Date(currentDate);

    // Haftanın günlerini doldur (Pazartesi–Pazar)
    // Eğer hafta başı Pazartesi değilse, o haftanın kalan günlerini al
    if (weekNumber === 1) {
      // İlk hafta: ayın 1'inden Pazar'a kadar
      while (currentDate.getMonth() === month - 1) {
        const jsDay = currentDate.getDay(); // 0=Pazar
        const dayKey = JS_DAY_TO_KEY[jsDay];
        const dateStr = formatDate(currentDate);
        const dayOfMonth = currentDate.getDate();
        const shortMonth = SHORT_MONTHS[month];

        weekDays.push({
          dayKey,
          date: dateStr,
          dateLabel: `${dayOfMonth} ${shortMonth}`,
          dayOfMonth,
          shortMonth,
        });

        // Pazar'a geldiysek haftayı bitir
        if (jsDay === 0) {
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // Sonraki haftalar: Pazartesi'den başla
      for (let i = 0; i < 7; i++) {
        if (currentDate.getMonth() !== month - 1) break;

        const jsDay = currentDate.getDay();
        const dayKey = JS_DAY_TO_KEY[jsDay];
        const dateStr = formatDate(currentDate);
        const dayOfMonth = currentDate.getDate();
        const shortMonth = SHORT_MONTHS[month];

        weekDays.push({
          dayKey,
          date: dateStr,
          dateLabel: `${dayOfMonth} ${shortMonth}`,
          dayOfMonth,
          shortMonth,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    if (weekDays.length > 0) {
      weeks.push({
        weekNumber,
        startDate: weekDays[0].date,
        endDate: weekDays[weekDays.length - 1].date,
        days: weekDays,
      });
      weekNumber++;
    }
  }

  return weeks;
}

/**
 * Bugünün ay ve hafta numarasını döner.
 * @returns {{ month: number, weekNumber: number }}
 */
export function getCurrentMonthAndWeek(refDate = new Date()) {
  const month = refDate.getMonth() + 1;
  const year = refDate.getFullYear();
  const weeks = getWeeksOfMonth(year, month);

  const todayStr = formatDate(refDate);
  for (const week of weeks) {
    const found = week.days.some((d) => d.date === todayStr);
    if (found) {
      return { month, weekNumber: week.weekNumber, year };
    }
  }

  // Fallback: son hafta
  return { month, weekNumber: weeks.length, year };
}

/**
 * Ay numarasını Türkçe label'a dönüştürür.
 */
export function getMonthLabel(monthNum) {
  return MONTHS.find((m) => m.value === monthNum)?.label ?? '';
}

/**
 * Verilen YYYY-MM-DD tarih stringinden dayOfWeek, month, weekNumber değerlerini hesaplar.
 * @param {string} dateStr — 'YYYY-MM-DD'
 * @returns {{ dayOfWeek: string, month: number, weekNumber: number }}
 */
export function getCalendarDetailsFromDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Geçersiz tarih formatı. YYYY-MM-DD olmalıdır.');
  }
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const date = new Date(y, m - 1, d);

  if (isNaN(date.getTime())) {
    throw new Error('Geçersiz tarih değeri.');
  }

  const jsDay = date.getDay(); // 0=Pazar, 1=Pazartesi, ...
  const dayOfWeek = JS_DAY_TO_KEY[jsDay];
  
  const month = m;
  const weeks = getWeeksOfMonth(y, month);
  let weekNumber = 1;
  let found = false;
  for (const week of weeks) {
    const matched = week.days.some((dayObj) => dayObj.date === dateStr);
    if (matched) {
      weekNumber = week.weekNumber;
      found = true;
      break;
    }
  }

  if (!found && weeks.length > 0) {
    weekNumber = weeks[weeks.length - 1].weekNumber;
  }

  return { dayOfWeek, month, weekNumber };
}

/**
 * legacy veya test istekleri için dayOfWeek, month, weekNumber değerlerinden tarih üretir.
 */
export function getDateFromCalendarDetails(year, month, weekNumber, dayOfWeek) {
  const weeks = getWeeksOfMonth(year, month);
  const week = weeks.find((w) => w.weekNumber === weekNumber) || weeks[0];
  if (!week) return '';
  const day = week.days.find((d) => d.dayKey === dayOfWeek) || week.days[0];
  return day ? day.date : '';
}
