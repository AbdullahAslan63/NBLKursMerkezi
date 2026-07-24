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

/** Onay diyaloğu — confirm() yerine native <dialog> + showModal() (Top Layer garantisi) */
export function showConfirm(message, { title = 'Emin misiniz?', confirmLabel = 'Evet', cancelLabel = 'İptal' } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('aria-labelledby', 'confirm-title');

    dialog.innerHTML = `
      <h2 id="confirm-title" class="confirm-dialog__title">${title}</h2>
      <p class="confirm-dialog__message">${message}</p>
      <div class="confirm-dialog__actions">
        <button type="button" class="btn btn--secondary" data-action="cancel">${cancelLabel}</button>
        <button type="button" class="btn btn--primary" data-action="confirm">${confirmLabel}</button>
      </div>
    `;

    document.body.appendChild(dialog);
    dialog.showModal();

    function close(result) {
      dialog.close();
      dialog.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') close(false);
    }

    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const clickedOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (clickedOutside) close(false);
    });

    dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));

    document.addEventListener('keydown', onKeydown);
    dialog.querySelector('[data-action="confirm"]').focus();
  });
}
