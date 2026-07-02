/** Faz 7 öncesi devre dışı; prod'da zorunlu (§12.6) */

const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';

const PUBLIC_PATHS = new Set(['/login']);

export function requireAuth(req, res, next) {
  if (!AUTH_ENABLED || PUBLIC_PATHS.has(req.path)) {
    return next();
  }

  if (req.session?.authenticated) {
    return next();
  }

  const acceptsJson =
    req.xhr ||
    req.headers.accept?.includes('application/json') ||
    req.path.startsWith('/api/');

  if (acceptsJson) {
    return res.fail('UNAUTHORIZED', 'Giriş yapmanız gerekiyor.', { status: 401 });
  }

  return res.redirect('/login');
}

export function redirectIfAuthenticated(req, res, next) {
  if (!AUTH_ENABLED) {
    return next();
  }

  if (req.session?.authenticated) {
    return res.redirect('/');
  }

  return next();
}
