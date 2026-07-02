import { apiJson } from './api.js';
import { showToast, showConfirm } from './ui.js';

const tbody = document.getElementById('teachers-tbody');
const emptyEl = document.getElementById('teachers-empty');
const tableWrap = document.getElementById('teachers-table-wrap');
const searchInput = document.getElementById('teacher-search');
const modal = document.getElementById('teacher-modal');
const form = document.getElementById('teacher-form');
const nameInput = document.getElementById('teacher-name');
const modalTitle = document.getElementById('teacher-modal-title');
const nameError = document.getElementById('teacher-name-error');

let editingId = null;

function updateEmptyState() {
  const visible = tbody.querySelectorAll('tr:not([hidden])').length;
  const hasRows = tbody.querySelectorAll('tr').length > 0;
  emptyEl.style.display = hasRows ? 'none' : '';
  tableWrap.style.display = hasRows ? '' : 'none';
  if (!hasRows) emptyEl.style.display = '';
}

function filterRows() {
  const q = searchInput.value.trim().toLowerCase();
  tbody.querySelectorAll('tr').forEach((row) => {
    const match = !q || row.dataset.search.includes(q);
    row.hidden = !match;
  });
}

function openModal(teacher = null) {
  editingId = teacher?.id ?? null;
  modalTitle.textContent = teacher ? 'Öğretmen Düzenle' : 'Öğretmen Ekle';
  nameInput.value = teacher?.name ?? '';
  nameError.hidden = true;
  nameInput.classList.remove('is-invalid');
  modal.showModal();
  nameInput.focus();
}

function closeModal() {
  modal.close();
  editingId = null;
  form.reset();
}

function appendRow(teacher) {
  const tr = document.createElement('tr');
  tr.dataset.id = teacher.id;
  tr.dataset.name = teacher.name;
  tr.dataset.search = teacher.name.toLowerCase();
  tr.innerHTML = `
    <td>${escapeHtml(teacher.name)}</td>
    <td><span class="badge">0 etüt</span></td>
    <td class="col-actions">
      <button type="button" class="btn btn--secondary btn--icon" data-action="download-pdf" data-pdf-url="/pdf/teachers/${teacher.id}" aria-label="PDF indir" title="PDF indir">⬇</button>
      <button type="button" class="btn btn--secondary btn--icon" data-action="edit" aria-label="Düzenle" title="Düzenle">✎</button>
      <button type="button" class="btn btn--secondary btn--icon" data-action="delete" aria-label="Sil" title="Sil">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
  updateEmptyState();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.getElementById('btn-add-teacher')?.addEventListener('click', () => openModal());
document.querySelector('[data-action="add-teacher"]')?.addEventListener('click', () => openModal());

form.querySelector('[data-action="cancel"]')?.addEventListener('click', closeModal);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    nameError.textContent = 'Öğretmen adı zorunludur.';
    nameError.hidden = false;
    nameInput.classList.add('is-invalid');
    return;
  }

  try {
    const payload = { name };
    const result = editingId
      ? await apiJson(`/teachers/${editingId}`, { method: 'PUT', body: payload })
      : await apiJson('/teachers', { method: 'POST', body: payload });

    const teacher = result.data;
    if (editingId) {
      const row = tbody.querySelector(`tr[data-id="${editingId}"]`);
      if (row) {
        row.dataset.name = teacher.name;
        row.dataset.search = teacher.name.toLowerCase();
        row.querySelector('td').textContent = teacher.name;
      }
      showToast(result.message || 'Öğretmen güncellendi.');
    } else {
      appendRow(teacher);
      showToast(result.message || 'Öğretmen eklendi.');
    }
    closeModal();
    filterRows();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row = btn.closest('tr');
  const id = row.dataset.id;
  const name = row.dataset.name;

  if (btn.dataset.action === 'edit') {
    openModal({ id: Number(id), name });
    return;
  }

  if (btn.dataset.action === 'delete') {
    const ok = await showConfirm(`${name} öğretmenini silmek istediğinize emin misiniz?`, {
      title: 'Öğretmeni sil',
      confirmLabel: 'Sil',
    });
    if (!ok) return;

    try {
      const result = await apiJson(`/teachers/${id}`, { method: 'DELETE' });
      row.remove();
      updateEmptyState();
      showToast(result.message || 'Öğretmen silindi.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

let searchTimer;
searchInput?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(filterRows, 200);
});
