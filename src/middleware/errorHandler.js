import { fail } from '../lib/apiResponse.js';

export function errorHandler(err, req, res, _next) {
  console.error('[hata]', err);

  if (res.headersSent) {
    return;
  }

  const acceptsJson =
    req.xhr ||
    req.headers.accept?.includes('application/json') ||
    req.path.startsWith('/api/');

  if (acceptsJson) {
    return fail(res, 'INTERNAL_ERROR', 'Beklenmeyen bir sunucu hatası oluştu.', { status: 500 });
  }

  return res.status(500).send('Beklenmeyen bir sunucu hatası oluştu.');
}
