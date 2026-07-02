/** Sınıf adı normalleştirme */
export function normalizeClassName(name) {
  if (name === undefined || name === null) return '';
  return String(name).trim();
}

export function isValidClassName(name) {
  return normalizeClassName(name).length > 0;
}
