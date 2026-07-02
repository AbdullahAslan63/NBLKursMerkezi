/** §12 JSON API yanıt yardımcıları */

export function success(res, data = {}, options = {}) {
  const { status = 200, message } = options;
  const body = { ok: true, data };
  if (message) body.message = message;
  return res.status(status).json(body);
}

export function created(res, data = {}, message) {
  return success(res, data, { status: 201, message });
}

export function fail(res, code, message, options = {}) {
  const { status = 400, details } = options;
  const body = {
    ok: false,
    error: { code, message },
  };
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}

/** Express middleware — res.success / res.fail kısayolları */
export function apiResponseMiddleware(req, res, next) {
  res.success = (data, options) => success(res, data, options);
  res.created = (data, message) => created(res, data, message);
  res.fail = (code, message, options) => fail(res, code, message, options);
  next();
}
