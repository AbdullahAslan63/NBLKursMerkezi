const PUBLIC_PATHS = new Set(['/login']);

export function requireAuth(req, res, next) {
  const enabled = process.env.AUTH_ENABLED !== 'false';
  if (!enabled || PUBLIC_PATHS.has(req.path)) {
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
  const enabled = process.env.AUTH_ENABLED !== 'false';
  if (!enabled) {
    return next();
  }

  if (req.session?.authenticated) {
    return res.redirect('/');
  }

  return next();
}
