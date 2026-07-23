import { apiJson } from './api.js';

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  const usernameInput = form.querySelector('input[name="username"]');
  const passwordInput = form.querySelector('input[name="password"]');

  const username = usernameInput?.value.trim();
  const password = passwordInput?.value;

  if (!username || !password) {
    if (errorEl) {
      errorEl.textContent = 'Kullanıcı adı ve şifre gereklidir.';
      errorEl.hidden = false;
    }
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Giriş Yapılıyor...';
  }

  try {
    await apiJson('/login', {
      method: 'POST',
      body: { username, password },
    });

    // Success -> redirect
    window.location.href = '/';
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Giriş başarısız.';
      errorEl.hidden = false;
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Giriş Yap';
    }
  }
});
