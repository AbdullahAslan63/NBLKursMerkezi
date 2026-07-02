/** Toast bildirimleri — alert() yerine */
export function showToast(message, type = 'success', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (!container.children.length) container.remove();
  }, duration);
}

/** Onay diyaloğu — confirm() yerine özel modal (Faz 1+) */
export function showConfirm(message, { title = 'Emin misiniz?', confirmLabel = 'Evet', cancelLabel = 'İptal' } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'presentation');

    const dialog = document.createElement('div');
    dialog.className = 'modal confirm-dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'confirm-title');

    dialog.innerHTML = `
      <h2 id="confirm-title" class="confirm-dialog__title">${title}</h2>
      <p class="confirm-dialog__message">${message}</p>
      <div class="confirm-dialog__actions">
        <button type="button" class="btn btn--secondary" data-action="cancel">${cancelLabel}</button>
        <button type="button" class="btn btn--primary" data-action="confirm">${confirmLabel}</button>
      </div>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    function close(result) {
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') close(false);
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
    });

    dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));

    document.addEventListener('keydown', onKeydown);
    dialog.querySelector('[data-action="confirm"]').focus();
  });
}
