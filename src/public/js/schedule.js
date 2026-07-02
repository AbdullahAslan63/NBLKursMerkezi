import { apiJson } from './api.js';
import { showToast, showConfirm } from './ui.js';

const modal = document.getElementById('schedule-modal');
const modalBody = document.getElementById('schedule-modal-body');
let activeCell = null;
let editingSessionId = null;

function openModal() {
  modal.showModal();
}

function closeModal() {
  modal.close();
  modalBody.innerHTML = '';
  activeCell = null;
  editingSessionId = null;
}

function bumpSessionStat(delta) {
  const el = document.getElementById('stat-sessions');
  if (!el) return;
  const current = Number(el.textContent) || 0;
  el.textContent = String(Math.max(0, current + delta));
}

async function loadPanel(cell, { quiet = false } = {}) {
  const { day, start, end } = cell.dataset;
  activeCell = cell;

  if (!quiet) {
    modalBody.innerHTML = '<p class="session-modal__loading">Yükleniyor...</p>';
    openModal();
  }

  const params = new URLSearchParams({ dayOfWeek: day, startTime: start, endTime: end });
  const res = await fetch(`/api/sessions/panel?${params}`, {
    headers: { Accept: 'text/html' },
  });

  if (!res.ok) {
    modalBody.innerHTML = '<p class="session-modal__empty">Panel yüklenemedi.</p>';
    return;
  }

  modalBody.innerHTML = await res.text();
  bindPanelEvents();

  if (!quiet) openModal();
}

function syncCellBadge(cell, count) {
  cell.dataset.sessionCount = String(count);
  cell.title = count > 0 ? `${count} etüt` : 'Etüt ekle';

  const badge = cell.querySelector('.schedule-cell__badge');
  const emptyHint = cell.querySelector('.schedule-cell__empty-hint');

  if (count > 0) {
    cell.classList.add('schedule-cell--filled');
    if (badge) {
      badge.textContent = `${count} öğrt.`;
    } else {
      const span = document.createElement('span');
      span.className = 'badge badge--filled schedule-cell__badge';
      span.textContent = `${count} öğrt.`;
      emptyHint?.remove();
      cell.appendChild(span);
    }
  } else {
    cell.classList.remove('schedule-cell--filled');
    badge?.remove();
    if (!emptyHint) {
      const hint = document.createElement('span');
      hint.className = 'schedule-cell__empty-hint';
      hint.textContent = 'Tıkla ve ekle';
      cell.appendChild(hint);
    }
  }
}

function updateCellBadge(cell, delta) {
  const count = Math.max(0, Number(cell.dataset.sessionCount || 0) + delta);
  syncCellBadge(cell, count);
}

function clearEditMode() {
  editingSessionId = null;
  const form = modalBody.querySelector('#session-form');
  const title = modalBody.querySelector('#session-form-title');
  const cancelBtn = modalBody.querySelector('#session-form-cancel-edit');
  const submitBtn = modalBody.querySelector('#session-form-submit');
  const errorEl = modalBody.querySelector('#session-form-error');

  if (title) title.textContent = 'Yeni Etüt Ekle';
  if (submitBtn) submitBtn.textContent = 'Etüt Kaydet';
  if (cancelBtn) cancelBtn.hidden = true;
  if (errorEl) errorEl.hidden = true;
  form?.reset();
}

function startEditMode(item) {
  const form = modalBody.querySelector('#session-form');
  if (!form) return;

  editingSessionId = Number(item.dataset.sessionId);
  const teacherId = item.dataset.teacherId;
  const studentIds = item.dataset.studentIds ? item.dataset.studentIds.split(',').filter(Boolean) : [];

  form.reset();
  const teacherInput = form.querySelector(`input[name="teacherId"][value="${teacherId}"]`);
  if (teacherInput) teacherInput.checked = true;

  studentIds.forEach((id) => {
    const cb = form.querySelector(`input[name="studentIds"][value="${id}"]`);
    if (cb) cb.checked = true;
  });

  const title = modalBody.querySelector('#session-form-title');
  const cancelBtn = modalBody.querySelector('#session-form-cancel-edit');
  const submitBtn = modalBody.querySelector('#session-form-submit');

  if (title) title.textContent = 'Etüt Düzenle';
  if (submitBtn) submitBtn.textContent = 'Güncelle';
  if (cancelBtn) cancelBtn.hidden = false;

  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function refreshPanel() {
  if (!activeCell) return;
  const prevEditId = editingSessionId;
  await loadPanel(activeCell, { quiet: true });
  if (prevEditId) {
    const item = modalBody.querySelector(`[data-session-id="${prevEditId}"]`);
    if (item) startEditMode(item);
  }
}

function bindPanelEvents() {
  const form = modalBody.querySelector('#session-form');
  const errorEl = modalBody.querySelector('#session-form-error');
  const cancelEditBtn = modalBody.querySelector('#session-form-cancel-edit');

  cancelEditBtn?.addEventListener('click', clearEditMode);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.hidden = true;

    const container = modalBody.querySelector('.session-modal');
    const teacherInput = form.querySelector('input[name="teacherId"]:checked');
    const studentInputs = [...form.querySelectorAll('input[name="studentIds"]:checked')];

    if (!teacherInput) {
      if (errorEl) {
        errorEl.textContent = 'Bir öğretmen seçin.';
        errorEl.hidden = false;
      }
      return;
    }

    if (studentInputs.length === 0) {
      if (errorEl) {
        errorEl.textContent = 'En az bir öğrenci seçin.';
        errorEl.hidden = false;
      }
      return;
    }

    const payload = {
      teacherId: Number(teacherInput.value),
      studentIds: studentInputs.map((i) => Number(i.value)),
    };

    try {
      const result = editingSessionId
        ? await apiJson(`/api/sessions/${editingSessionId}`, { method: 'PUT', body: payload })
        : await apiJson('/api/sessions', {
            method: 'POST',
            body: {
              dayOfWeek: container.dataset.day,
              startTime: container.dataset.start,
              endTime: container.dataset.end,
              ...payload,
            },
          });

      showToast(result.message || (editingSessionId ? 'Etüt güncellendi.' : 'Etüt kaydedildi.'));
      if (!editingSessionId && activeCell) {
        updateCellBadge(activeCell, 1);
        bumpSessionStat(1);
      }
      clearEditMode();
      await refreshPanel();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } else {
        showToast(err.message, 'error');
      }
    }
  });

  modalBody.querySelectorAll('[data-action="edit-session"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.session-list__item');
      if (item) startEditMode(item);
    });
  });

  modalBody.querySelectorAll('[data-action="delete-session"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await showConfirm('Bu etüt kaydını silmek istediğinize emin misiniz?', {
        title: 'Etütü sil',
        confirmLabel: 'Sil',
      });
      if (!ok) return;

      try {
        const sessionId = Number(btn.dataset.sessionId);
        const result = await apiJson(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        showToast(result.message || 'Etüt silindi.');
        if (editingSessionId === sessionId) clearEditMode();
        if (activeCell) {
          updateCellBadge(activeCell, -1);
          bumpSessionStat(-1);
        }
        await refreshPanel();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

document.querySelector('.schedule-grid')?.addEventListener('click', (e) => {
  const cell = e.target.closest('.schedule-cell');
  if (!cell) return;
  editingSessionId = null;
  loadPanel(cell).catch((err) => {
    showToast(err.message || 'Panel açılamadı.', 'error');
  });
});

modal?.querySelector('[data-action="close-modal"]')?.addEventListener('click', closeModal);

modal?.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

modal?.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeModal();
});
