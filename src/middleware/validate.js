/** İstek gövdesi doğrulama yardımcıları — Faz 1+ */

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === '');
  return missing;
}
