/** PDF indirme — navbar ve satır butonları */
import { showToast } from './ui.js';

function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('is-loading', loading);
  if (loading) {
    btn.dataset.originalLabel = btn.textContent;
    btn.textContent = 'İndiriliyor…';
  } else if (btn.dataset.originalLabel) {
    btn.textContent = btn.dataset.originalLabel;
    delete btn.dataset.originalLabel;
  }
}

export async function downloadPdf(url, { trigger, filename } = {}) {
  setButtonLoading(trigger, true);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/pdf, application/json' },
    });

    const contentType = res.headers.get('content-type') ?? '';

    if (!res.ok) {
      if (contentType.includes('application/json')) {
        const body = await res.json();
        throw new Error(body.error?.message ?? 'PDF indirilemedi.');
      }
      throw new Error('PDF indirilemedi.');
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
    const suggestedName = filename ?? decodeURIComponent(match?.[1] ?? match?.[2] ?? 'program.pdf');

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = suggestedName;
    link.click();
    URL.revokeObjectURL(objectUrl);
    showToast('PDF indirildi.');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(trigger, false);
  }
}

function initPdfMenu() {
  const menu = document.getElementById('pdf-menu');
  if (!menu) return;

  const toggle = menu.querySelector('[data-action="toggle-pdf-menu"]');
  const panel = menu.querySelector('.pdf-menu__panel');

  toggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle('pdf-menu--open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) {
      menu.classList.remove('pdf-menu--open');
      toggle?.setAttribute('aria-expanded', 'false');
    }
  });

  panel?.addEventListener('click', (e) => {
    const link = e.target.closest('[data-pdf-url]');
    if (!link) return;
    e.preventDefault();
    menu.classList.remove('pdf-menu--open');
    downloadPdf(link.dataset.pdfUrl, { trigger: link });
  });
}

function initRowPdfButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="download-pdf"]');
    if (!btn) return;
    e.preventDefault();
    downloadPdf(btn.dataset.pdfUrl, { trigger: btn });
  });
}

initPdfMenu();
initRowPdfButtons();
