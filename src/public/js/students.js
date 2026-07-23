import { apiJson, apiFormData } from './api.js';
import { showToast, showConfirm } from './ui.js';
import { exportListPdf } from './listPdfExport.js';
import { downloadPdf } from './pdf.js';

const tbody = document.getElementById('students-tbody');
const emptyEl = document.getElementById('students-empty');
const tableWrap = document.getElementById('students-table-wrap');
const searchInput = document.getElementById('student-search');
const modal = document.getElementById('student-modal');
const form = document.getElementById('student-form');
const modalTitle = document.getElementById('student-modal-title');
const formError = document.getElementById('student-form-error');
const classSelect = document.getElementById('student-class-select');
const classNewInput = document.getElementById('student-class-new');

let editingId = null;
let classesCache = [];

async function loadClasses() {
  const result = await apiJson('/api/classes');
  classesCache = result.data.classes;
  renderClassOptions();
}

function renderClassOptions(selectedId = '') {
  classSelect.innerHTML = '<option value="">Sınıf seçin...</option>';
  classesCache.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (String(c.id) === String(selectedId)) opt.selected = true;
    classSelect.appendChild(opt);
  });
}

function updateEmptyState() {
  const hasRows = tbody.querySelectorAll('tr').length > 0;
  emptyEl.style.display = hasRows ? 'none' : '';
  tableWrap.style.display = hasRows ? '' : 'none';
}

let activeClassFilter = 'Tümü';
const filterChipsContainer = document.getElementById('class-filter-chips');

function getUniqueClassNames() {
  const names = new Set();
  tbody.querySelectorAll('tr').forEach(row => {
    if (row.dataset.className) {
      names.add(row.dataset.className.trim());
    }
  });
  return [...names].sort((a, b) => a.localeCompare(b, { numeric: true }));
}

function renderClassFilterChips() {
  if (!filterChipsContainer) return;
  filterChipsContainer.innerHTML = '';

  const classes = getUniqueClassNames();
  
  if (activeClassFilter !== 'Tümü' && !classes.includes(activeClassFilter)) {
    activeClassFilter = 'Tümü';
  }

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = `filter-chip${activeClassFilter === 'Tümü' ? ' filter-chip--active' : ''}`;
  allChip.textContent = 'Tümü';
  allChip.addEventListener('click', () => {
    activeClassFilter = 'Tümü';
    updateActiveChipStyles();
    filterRows();
  });
  filterChipsContainer.appendChild(allChip);

  classes.forEach(cName => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `filter-chip${activeClassFilter === cName ? ' filter-chip--active' : ''}`;
    chip.textContent = cName;
    chip.addEventListener('click', () => {
      activeClassFilter = cName;
      updateActiveChipStyles();
      filterRows();
    });
    filterChipsContainer.appendChild(chip);
  });
}

function updateActiveChipStyles() {
  filterChipsContainer.querySelectorAll('.filter-chip').forEach(chip => {
    const isActive = chip.textContent === activeClassFilter;
    chip.classList.toggle('filter-chip--active', isActive);
  });
}

function filterRows() {
  const q = searchInput.value.trim().toLowerCase();
  tbody.querySelectorAll('tr').forEach((row) => {
    const rowSearch = row.dataset.search || '';
    const rowClass = row.dataset.className || '';
    
    const matchesSearch = !q || rowSearch.includes(q);
    const matchesClass = activeClassFilter === 'Tümü' || rowClass === activeClassFilter;
    
    row.hidden = !(matchesSearch && matchesClass);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function appendRow(student) {
  const tr = document.createElement('tr');
  tr.className = 'row-fade-in';
  tr.dataset.id = student.id;
  tr.dataset.number = student.studentNumber;
  tr.dataset.first = student.firstName;
  tr.dataset.last = student.lastName;
  tr.dataset.classId = student.classId;
  tr.dataset.className = student.className;
  tr.dataset.search = `${student.firstName} ${student.lastName} ${student.studentNumber} ${student.className}`.toLowerCase();
  tr.innerHTML = `
    <td>
      <div class="student-cell">
        <span class="student-cell__name">${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</span>
        <span class="student-cell__number">${escapeHtml(student.studentNumber)}</span>
      </div>
    </td>
    <td><span class="badge">${escapeHtml(student.className)}</span></td>
    <td class="col-actions">
      <button type="button" class="btn btn--secondary btn--icon" data-action="download-pdf" data-pdf-url="/pdf/students/${student.id}" aria-label="PDF indir" title="PDF indir">⬇</button>
      <button type="button" class="btn btn--secondary btn--icon" data-action="edit" aria-label="Düzenle" title="Düzenle">✎</button>
      <button type="button" class="btn btn--secondary btn--icon" data-action="delete" aria-label="Sil" title="Sil">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
  updateEmptyState();
  renderClassFilterChips();
}

function updateRow(row, student) {
  row.dataset.number = student.studentNumber;
  row.dataset.first = student.firstName;
  row.dataset.last = student.lastName;
  row.dataset.classId = student.classId;
  row.dataset.className = student.className;
  row.dataset.search = `${student.firstName} ${student.lastName} ${student.studentNumber} ${student.className}`.toLowerCase();
  row.querySelector('.student-cell__name').textContent = `${student.firstName} ${student.lastName}`;
  row.querySelector('.student-cell__number').textContent = student.studentNumber;
  row.querySelector('.badge').textContent = student.className;
  renderClassFilterChips();
}

async function resolveClassId() {
  const newName = classNewInput.value.trim();
  if (newName) {
    const existing = classesCache.find((c) => c.name.toLowerCase() === newName.toLowerCase());
    if (existing) {
      renderClassOptions(existing.id);
      classNewInput.value = '';
      return existing.id;
    }

    const created = await apiJson('/api/classes', { method: 'POST', body: { name: newName } });
    classesCache.push(created.data);
    renderClassOptions(created.data.id);
    classNewInput.value = '';
    return created.data.id;
  }

  if (classSelect.value) return Number(classSelect.value);
  return null;
}

async function openModal(student = null) {
  editingId = student?.id ?? null;
  modalTitle.textContent = student ? 'Öğrenci Düzenle' : 'Öğrenci Ekle';
  formError.hidden = true;

  try {
    await loadClasses();
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  document.getElementById('student-number').value = student?.studentNumber ?? '';
  document.getElementById('student-first').value = student?.firstName ?? '';
  document.getElementById('student-last').value = student?.lastName ?? '';
  classNewInput.value = '';
  renderClassOptions(student?.classId ?? '');
  modal.showModal();
  document.getElementById('student-number').focus();
}

function closeModal() {
  modal.close();
  editingId = null;
  form.reset();
  classNewInput.value = '';
}

document.getElementById('btn-add-student')?.addEventListener('click', () => openModal());
document.querySelector('[data-action="add-student"]')?.addEventListener('click', () => openModal());
form.querySelector('[data-action="cancel"]')?.addEventListener('click', closeModal);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.hidden = true;

  try {
    const classId = await resolveClassId();
    if (!classId) {
      formError.textContent = 'Sınıf seçin veya yeni sınıf adı girin.';
      formError.hidden = false;
      return;
    }

    const studentNumber = document.getElementById('student-number').value.trim();
    const firstName = document.getElementById('student-first').value.trim();
    const lastName = document.getElementById('student-last').value.trim();

    if (!studentNumber || !firstName || !lastName) {
      formError.textContent = 'Öğrenci numarası, ad ve soyad zorunludur.';
      formError.hidden = false;
      return;
    }

    if (!/^\d+$/.test(studentNumber)) {
      formError.textContent = 'Öğrenci numarası sadece rakamlardan oluşmalıdır.';
      formError.hidden = false;
      return;
    }

    const payload = {
      studentNumber,
      firstName,
      lastName,
      classId,
    };

    const result = editingId
      ? await apiJson(`/students/${editingId}`, { method: 'PUT', body: payload })
      : await apiJson('/students', { method: 'POST', body: payload });

    const student = result.data;
    if (editingId) {
      const row = tbody.querySelector(`tr[data-id="${editingId}"]`);
      if (row) updateRow(row, student);
      showToast(result.message || 'Öğrenci güncellendi.');
    } else {
      appendRow(student);
      showToast(result.message || 'Öğrenci eklendi.');
    }
    closeModal();
    filterRows();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row = btn.closest('tr');
  const id = row.dataset.id;

  if (btn.dataset.action === 'download-pdf') {
    e.preventDefault();
    e.stopPropagation();
    openPdfDateModal(btn.dataset.pdfUrl, btn);
    return;
  }

  if (btn.dataset.action === 'edit') {
    openModal({
      id: Number(id),
      studentNumber: row.dataset.number,
      firstName: row.dataset.first,
      lastName: row.dataset.last,
      classId: row.dataset.classId,
    });
    return;
  }

  if (btn.dataset.action === 'delete') {
    const name = `${row.dataset.first} ${row.dataset.last}`;
    const ok = await showConfirm(`${name} öğrencisini silmek istediğinize emin misiniz?`, {
      title: 'Öğrenciyi sil',
      confirmLabel: 'Sil',
    });
    if (!ok) return;

    try {
      const result = await apiJson(`/students/${id}`, { method: 'DELETE' });
      row.classList.add('row-fade-out');
      setTimeout(() => {
        row.remove();
        updateEmptyState();
        renderClassFilterChips();
      }, 300);
      showToast(result.message || 'Öğrenci silindi.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

classNewInput?.addEventListener('input', () => {
  if (classNewInput.value.trim()) {
    classSelect.value = '';
    classSelect.classList.remove('is-invalid');
  }
});

classSelect?.addEventListener('change', () => {
  if (classSelect.value) {
    classNewInput.value = '';
    formError.hidden = true;
  }
});

let searchTimer;
searchInput?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(filterRows, 200);
});

/* Excel içe aktarma */
const importModal = document.getElementById('import-modal');
const importForm = document.getElementById('import-form');
const importClassSelect = document.getElementById('import-class-select');
const importClassNew = document.getElementById('import-class-new');
const importFileInput = document.getElementById('import-file');
const importFileName = document.getElementById('import-file-name');
const importFormError = document.getElementById('import-form-error');
const importResult = document.getElementById('import-result');
const fileDrop = document.getElementById('file-drop');
let importFile = null;

function renderImportClassOptions() {
  importClassSelect.innerHTML = '<option value="">Sınıf seçin...</option>';
  classesCache.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    importClassSelect.appendChild(opt);
  });
}

async function resolveImportClass() {
  const newName = importClassNew.value.trim();
  if (newName) {
    const existing = classesCache.find((c) => c.name.toLowerCase() === newName.toLowerCase());
    if (existing) return { classId: existing.id };

    const created = await apiJson('/api/classes', { method: 'POST', body: { name: newName } });
    classesCache.push(created.data);
    return { className: created.data.name };
  }

  if (importClassSelect.value) return { classId: importClassSelect.value };
  return null;
}

function setImportFile(file) {
  if (!file) {
    importFile = null;
    importFileName.hidden = true;
    importFileName.textContent = '';
    return;
  }

  const ext = file.name.toLowerCase();
  if (!ext.endsWith('.xls') && !ext.endsWith('.xlsx')) {
    showToast('Yalnızca .xls veya .xlsx dosyaları kabul edilir.', 'error');
    return;
  }

  importFile = file;
  importFileName.textContent = file.name;
  importFileName.hidden = false;
}

async function openImportModal() {
  importFormError.hidden = true;
  importResult.hidden = true;
  importFile = null;
  importFileInput.value = '';
  importFileName.hidden = true;
  importClassNew.value = '';

  try {
    await loadClasses();
    renderImportClassOptions();
    importModal.showModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeImportModal() {
  importModal.close();
  importForm.reset();
  importFile = null;
}

document.getElementById('btn-import-students')?.addEventListener('click', openImportModal);
importForm.querySelector('[data-action="cancel-import"]')?.addEventListener('click', closeImportModal);
document.getElementById('btn-pick-file')?.addEventListener('click', () => importFileInput.click());

importFileInput?.addEventListener('change', () => {
  const file = importFileInput.files?.[0];
  if (file) setImportFile(file);
});

importClassNew?.addEventListener('input', () => {
  if (importClassNew.value.trim()) importClassSelect.value = '';
});

importClassSelect?.addEventListener('change', () => {
  if (importClassSelect.value) importClassNew.value = '';
});

fileDrop?.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileDrop.classList.add('file-drop--active');
});

fileDrop?.addEventListener('dragleave', () => {
  fileDrop.classList.remove('file-drop--active');
});

fileDrop?.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDrop.classList.remove('file-drop--active');
  const file = e.dataTransfer.files?.[0];
  if (file) setImportFile(file);
});

importForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  importFormError.hidden = true;
  importResult.hidden = true;

  if (!importFile) {
    importFormError.textContent = 'Excel dosyası seçin.';
    importFormError.hidden = false;
    return;
  }

  try {
    const classInfo = await resolveImportClass();
    if (!classInfo) {
      importFormError.textContent = 'Hedef sınıf seçin veya yeni sınıf adı girin.';
      importFormError.hidden = false;
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);
    if (classInfo.classId) formData.append('classId', classInfo.classId);
    if (classInfo.className) formData.append('className', classInfo.className);

    const btn = document.getElementById('btn-do-import');
    btn.disabled = true;

    const result = await apiFormData('/students/import', formData);

    importResult.innerHTML = `
      <p><strong>${result.data.added}</strong> eklendi · <strong>${result.data.updated}</strong> güncellendi · <strong>${result.data.skipped}</strong> atlandı</p>
      <p>Sınıf: ${result.data.className}</p>
    `;
    importResult.hidden = false;
    showToast(result.message, 'success');

    // Dynamically insert or update imported student records in the DOM
    if (Array.isArray(result.data.students)) {
      result.data.students.forEach(student => {
        const existingRow = tbody.querySelector(`tr[data-id="${student.id}"]`);
        if (existingRow) {
          updateRow(existingRow, student);
        } else {
          appendRow(student);
        }
      });
      filterRows();
    }

    setTimeout(() => {
      closeImportModal();
      importResult.hidden = true;
      importResult.innerHTML = '';
    }, 2000);
  } catch (err) {
    importFormError.textContent = err.message;
    importFormError.hidden = false;
  } finally {
    document.getElementById('btn-do-import').disabled = false;
  }
});

// Dynamic Class Chips Initial Load
renderClassFilterChips();

/* PDF Date Modal ve İndirme Mantığı */
const pdfDateModal = document.getElementById('pdf-date-modal');
const pdfDateForm = document.getElementById('pdf-date-form');
let currentPdfUrl = '';
let currentPdfTrigger = null;

function openPdfDateModal(url, trigger) {
  currentPdfUrl = url;
  currentPdfTrigger = trigger;
  
  const monthSelect = document.getElementById('pdf-month-select');
  if (monthSelect) {
    monthSelect.value = "9"; // default to Eylül (9)
  }
  
  const weekSelect = document.getElementById('pdf-week-select');
  if (weekSelect) {
    weekSelect.value = "1";
  }

  pdfDateModal.showModal();
}

pdfDateModal?.querySelector('[data-action="cancel-pdf"]')?.addEventListener('click', () => {
  pdfDateModal.close();
});

pdfDateForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const month = document.getElementById('pdf-month-select').value;
  const week = document.getElementById('pdf-week-select').value;
  pdfDateModal.close();

  const url = `${currentPdfUrl}?month=${month}&week=${week}`;
  await downloadPdf(url, { trigger: currentPdfTrigger });
});

document.getElementById('btn-export-pdf-students')?.addEventListener('click', (e) => {
  e.preventDefault();
  openPdfDateModal('/pdf/students/all', e.currentTarget);
});
