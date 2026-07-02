/** §12 JSON API istek yardımcısı */
export async function apiJson(url, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({ ok: false, error: { message: 'Geçersiz yanıt' } }));

  if (!res.ok || !data.ok) {
    const err = new Error(data.error?.message || 'İstek başarısız');
    err.code = data.error?.code;
    err.status = res.status;
    err.details = data.details;
    throw err;
  }

  return data;
}

/** multipart/form-data istekleri */
export async function apiFormData(url, formData) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
  });
  const data = await res.json().catch(() => ({ ok: false, error: { message: 'Geçersiz yanıt' } }));

  if (!res.ok || !data.ok) {
    const err = new Error(data.error?.message || 'İstek başarısız');
    err.code = data.error?.code;
    err.status = res.status;
    err.details = data.details;
    throw err;
  }

  return data;
}
