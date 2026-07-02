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
