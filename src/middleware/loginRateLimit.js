/** Login brute-force koruması — IP bazlı bellek içi sayaç (§8) */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

/** @type {Map<string, { count: number, resetAt: number }>} */
const attempts = new Map();

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getEntry(ip) {
  const entry = attempts.get(ip);
  if (!entry) return null;
  if (entry.resetAt <= Date.now()) {
    attempts.delete(ip);
    return null;
  }
  return entry;
}

/** POST /login öncesi — limit aşıldıysa 429 */
export function loginRateLimit(req, res, next) {
  const entry = getEntry(getClientIp(req));
  if (entry && entry.count >= MAX_FAILURES) {
    return res.fail(
      'RATE_LIMITED',
      'Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
      { status: 429 },
    );
  }
  return next();
}

/** Hatalı kullanıcı adı / şifre sonrası çağrılır */
export function recordLoginFailure(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = getEntry(ip);
  if (!entry) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/** Başarılı girişte sayacı temizle */
export function resetLoginFailures(req) {
  attempts.delete(getClientIp(req));
}

/** Testler için tüm sayaçları sıfırla */
export function resetLoginRateLimit() {
  attempts.clear();
}
