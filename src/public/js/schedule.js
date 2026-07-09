import { apiJson } from './api.js';
import { showToast, showConfirm } from './ui.js';

/* ── DOM referansları ── */
const modal = document.getElementById('schedule-modal');
const modalBody = document.getElementById('schedule-modal-body');
const daySelector = document.querySelector('.day-selector');
let activeCell = null;      // tıklanan .timeline-row
let editingSessionId = null;
let activeDayKey = document.querySelector('.day-selector__pill--active')?.dataset.day;

/* ── Gün seçici ── */
function switchDay(dayKey) {
  if (dayKey === activeDayKey) return;

  // Pill güncelle
  document.querySelectorAll('.day-selector__pill').forEach((pill) => {
    const isTarget = pill.dataset.day === dayKey;
    pill.classList.toggle('day-selector__pill--active', isTarget);
    pill.setAttribute('aria-pressed', String(isTarget));
  });

  // Timeline paneli güncelle
  document.querySelectorAll('.day-timeline').forEach((panel) => {
    const isTarget = panel.dataset.day === dayKey;
    panel.classList.toggle('day-timeline--active', isTarget);
    panel.hidden = !isTarget;
  });

  activeDayKey = dayKey;
}

daySelector?.addEventListener('click', (e) => {
  const pill = e.target.closest('.day-selector__pill');
  if (!pill) return;
  switchDay(pill.dataset.day);
});

/* ── Modal yönetimi ── */
function openModal() {
  modal.showModal();
}

function closeModal() {
  modal.close();
  modalBody.innerHTML = '';
  activeCell = null;
  editingSessionId = null;
}

modal?.querySelector('[data-action="close-modal"]')?.addEventListener('click', closeModal);

modal?.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

modal?.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeModal();
});

/* ── İstatistik güncelleme ── */
function bumpSessionStat(delta) {
  const el = document.getElementById('stat-sessions');
  if (!el) return;
  const current = Number(el.textContent) || 0;
  el.textContent = String(Math.max(0, current + delta));
}

/* ── Panel yükleme (AJAX ile modal içeriği) ── */
async function loadPanel(trigger, { quiet = false } = {}) {
  const { day, start, end } = trigger.dataset;

  // .timeline-row'u bul (trigger kart veya buton olabilir)
  activeCell = trigger.closest('.timeline-row') || trigger;

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

/* ── Timeline satırını güncelle ── */
function updateTimelineRow(row, delta) {
  const count = Math.max(0, Number(row.dataset.sessionCount || 0) + delta);
  row.dataset.sessionCount = String(count);

  // Düğüm noktasını güncelle
  const dot = row.querySelector('.timeline-row__dot');
  if (dot) {
    dot.classList.toggle('timeline-row__dot--filled', count > 0);
  }
}

/* ── Düzenleme modu ── */
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
  form?.syncWizardState?.();
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

  form.syncWizardState?.();

  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── Panel yenileme ── */
async function refreshPanel() {
  if (!activeCell) return;
  const prevEditId = editingSessionId;

  // activeCell bir .timeline-row — içinden trigger bulmamız lazım
  const trigger = activeCell.querySelector('.timeline-card') || activeCell.querySelector('.timeline-empty');
  if (!trigger) return;

  await loadPanel(trigger, { quiet: true });
  if (prevEditId) {
    const item = modalBody.querySelector(`[data-session-id="${prevEditId}"]`);
    if (item) startEditMode(item);
  }
}

/* ── Zaman Hesaplayıcı Yardımcı Fonksiyonu ── */
function addMinutesToTime(timeStr, minutes) {
  if (!timeStr) return '';
  const [hours, mins] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins + minutes, 0, 0);
  const nextHours = String(date.getHours()).padStart(2, '0');
  const nextMins = String(date.getMinutes()).padStart(2, '0');
  return `${nextHours}:${nextMins}`;
}

/* ── Wizard Başlatıcı ── */
function initWizard(form) {
  if (!form) return;

  const nextBtn = form.querySelector('[data-action="next-step"]');
  const prevBtn = form.querySelector('[data-action="prev-step"]');
  const step1 = form.querySelector('[data-step="1"]');
  const step2 = form.querySelector('[data-step="2"]');
  const searchInput = form.querySelector('#student-search-input');
  const chipsContainer = form.querySelector('#selected-chips-container');
  const studentRows = form.querySelectorAll('.student-choice-row');
  const progressDots = modalBody.querySelectorAll('[data-step-indicator]');

  // Zaman girdileri ve süre butonları
  const startTimeInput = form.querySelector('#session-start-time');
  const endTimeInput = form.querySelector('#session-end-time');
  const durationChips = form.querySelectorAll('.duration-chip');

  /* ── Modern Digital Picker & Stepper Initialization ── */
  function initDigitalPickers(form) {
    const startCard = form.querySelector('#start-time-picker');
    const endCard = form.querySelector('#end-time-picker');
    if (!startCard || !endCard) return;

    function updatePickerDisplay(card, hours, minutes) {
      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');

      const hDisplay = card.querySelector('.digital-number--hours');
      const mDisplay = card.querySelector('.digital-number--minutes');
      if (hDisplay) hDisplay.textContent = hStr;
      if (mDisplay) mDisplay.textContent = mStr;

      const input = card.querySelector('input[type="hidden"]');
      if (input) {
        const oldVal = input.value;
        const newVal = `${hStr}:${mStr}`;
        if (oldVal !== newVal) {
          input.value = newVal;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }

    function setupPickerCard(card) {
      const input = card.querySelector('input[type="hidden"]');
      
      function getVal() {
        const val = input.value || '09:00';
        const [h, m] = val.split(':').map(Number);
        return { hours: h, minutes: m };
      }

      // Hour Steppers
      const hourGroup = card.querySelector('[data-unit="hours"]');
      const hourUp = hourGroup?.querySelector('.stepper-btn--up');
      const hourDown = hourGroup?.querySelector('.stepper-btn--down');
      const hourDisplay = hourGroup?.querySelector('.digital-number');

      hourUp?.addEventListener('click', () => {
        if (input.disabled) return;
        const current = getVal();
        let newHours = current.hours + 1;
        if (newHours > 23) newHours = 0;
        updatePickerDisplay(card, newHours, current.minutes);
        triggerGlow(hourDisplay);
      });

      hourDown?.addEventListener('click', () => {
        if (input.disabled) return;
        const current = getVal();
        let newHours = current.hours - 1;
        if (newHours < 0) newHours = 23;
        updatePickerDisplay(card, newHours, current.minutes);
        triggerGlow(hourDisplay);
      });

      // Minute Steppers
      const minuteGroup = card.querySelector('[data-unit="minutes"]');
      const minuteUp = minuteGroup?.querySelector('.stepper-btn--up');
      const minuteDown = minuteGroup?.querySelector('.stepper-btn--down');
      const minuteDisplay = minuteGroup?.querySelector('.digital-number');

      minuteUp?.addEventListener('click', () => {
        if (input.disabled) return;
        const current = getVal();
        let newMinutes = current.minutes + 1;
        if (newMinutes > 59) newMinutes = 0;
        updatePickerDisplay(card, current.hours, newMinutes);
        triggerGlow(minuteDisplay);
      });

      minuteDown?.addEventListener('click', () => {
        if (input.disabled) return;
        const current = getVal();
        let newMinutes = current.minutes - 1;
        if (newMinutes < 0) newMinutes = 59;
        updatePickerDisplay(card, current.hours, newMinutes);
        triggerGlow(minuteDisplay);
      });

      // Quick Minute Pills
      card.querySelectorAll('.minute-pill-btn').forEach(pill => {
        pill.addEventListener('click', () => {
          if (input.disabled) return;
          const current = getVal();
          const targetMins = Number(pill.dataset.value);
          updatePickerDisplay(card, current.hours, targetMins);
          triggerGlow(minuteDisplay);
        });
      });
    }

    function triggerGlow(element) {
      if (!element) return;
      element.classList.add('digital-number--focused');
      setTimeout(() => {
        element.classList.remove('digital-number--focused');
      }, 500);
    }

    setupPickerCard(startCard);
    setupPickerCard(endCard);

    // Expose setter for calculated times
    form.setWheelTime = function(pickerId, timeStr) {
      const card = form.querySelector(`#${pickerId}`);
      if (card && timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        updatePickerDisplay(card, h, m);
      }
    };

    // Sync disabled state
    form.syncWheelDisabledState = function(isEditMode) {
      form.querySelectorAll('.digital-picker-card').forEach(card => {
        card.classList.toggle('digital-picker-card--disabled', isEditMode);
        const input = card.querySelector('input[type="hidden"]');
        if (input) input.disabled = isEditMode;
        
        card.querySelectorAll('.stepper-btn, .minute-pill-btn').forEach(btn => {
          btn.disabled = isEditMode;
        });
      });
    };
  }

  // Initialize Custom Digital Stepper Pickers
  initDigitalPickers(form);

  function goToStep(stepNum) {
    if (stepNum === 1) {
      step1.classList.add('wizard-step--active');
      step2.classList.remove('wizard-step--active');
      progressDots.forEach(dot => {
        dot.classList.toggle('wizard-progress__dot--active', dot.dataset.stepIndicator === '1');
      });
    } else if (stepNum === 2) {
      step1.classList.remove('wizard-step--active');
      step2.classList.add('wizard-step--active');
      progressDots.forEach(dot => {
        dot.classList.toggle('wizard-progress__dot--active', dot.dataset.stepIndicator === '2');
      });
    }
  }

  nextBtn?.addEventListener('click', () => goToStep(2));
  prevBtn?.addEventListener('click', () => goToStep(1));

  // Hızlı Süre Butonları Tıklama Dinleyicisi
  durationChips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (startTimeInput && endTimeInput && !startTimeInput.disabled) {
        const minutes = Number(chip.dataset.minutes);
        const startTimeVal = startTimeInput.value;
        if (startTimeVal) {
          const calculatedEndTime = addMinutesToTime(startTimeVal, minutes);
          endTimeInput.value = calculatedEndTime;
          endTimeInput.dispatchEvent(new Event('change', { bubbles: true }));
          // Programmatically spin/scroll the End Time wheels to reflect the calculation!
          form.setWheelTime('end-time-picker', calculatedEndTime);
        }
      }
    });
  });

  const teacherRadios = form.querySelectorAll('input[name="teacherId"]');
  function updateNextButtonState() {
    const isSelected = [...teacherRadios].some(radio => radio.checked);
    if (nextBtn) nextBtn.disabled = !isSelected;
  }
  form.addEventListener('change', (e) => {
    if (e.target.name === 'teacherId') {
      updateNextButtonState();
    }
  });

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    studentRows.forEach(row => {
      const text = row.dataset.searchText || '';
      if (!query || text.includes(query)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });

  function createChip(studentId, label) {
    if (chipsContainer.querySelector(`[data-chip-id="${studentId}"]`)) return;

    const chip = document.createElement('span');
    chip.className = 'student-chip';
    chip.dataset.chipId = studentId;
    chip.innerHTML = `
      <span class="student-chip__label">${label}</span>
      <button type="button" class="student-chip__remove" aria-label="Kaldır">✕</button>
    `;
    
    chip.querySelector('.student-chip__remove').addEventListener('click', () => {
      const checkbox = form.querySelector(`input[name="studentIds"][value="${studentId}"]`);
      if (checkbox) {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    chipsContainer.appendChild(chip);
  }

  function removeChip(studentId) {
    const chip = chipsContainer.querySelector(`[data-chip-id="${studentId}"]`);
    chip?.remove();
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'studentIds') {
      const cb = e.target;
      const label = cb.dataset.label || cb.parentElement.querySelector('.choice-row__main')?.textContent || '';
      const row = cb.closest('.student-choice-row');
      
      if (cb.checked) {
        createChip(cb.value, label);
        row?.classList.add('student-choice-row--selected');
      } else {
        removeChip(cb.value);
        row?.classList.remove('student-choice-row--selected');
      }
    }
  });

  form.syncWizardState = function() {
    updateNextButtonState();
    if (chipsContainer) chipsContainer.innerHTML = '';
    
    const checkedBoxes = form.querySelectorAll('input[name="studentIds"]:checked');
    checkedBoxes.forEach(cb => {
      const label = cb.dataset.label || cb.parentElement.querySelector('.choice-row__main')?.textContent || '';
      createChip(cb.value, label);
      cb.closest('.student-choice-row')?.classList.add('student-choice-row--selected');
    });

    const uncheckedBoxes = form.querySelectorAll('input[name="studentIds"]:not(:checked)');
    uncheckedBoxes.forEach(cb => {
      cb.closest('.student-choice-row')?.classList.remove('student-choice-row--selected');
    });

    // Zaman alanlarını düzenleme moduna göre etkinleştir/devre dışı bırak
    const isEditMode = editingSessionId !== null;
    form.syncWheelDisabledState(isEditMode);
    
    durationChips.forEach(chip => {
      chip.disabled = isEditMode;
    });

    // Sync wheels scroll states to input pre-filled values
    if (form.setWheelTime) {
      if (startTimeInput) form.setWheelTime('start-time-picker', startTimeInput.value);
      if (endTimeInput) form.setWheelTime('end-time-picker', endTimeInput.value);
    }

    goToStep(1);
    if (searchInput) {
      searchInput.value = '';
      studentRows.forEach(row => row.style.display = '');
    }
  };

  form.syncWizardState();
}

/* ── Panel olay dinleyicileri ── */
function bindPanelEvents() {
  const form = modalBody.querySelector('#session-form');
  const errorEl = modalBody.querySelector('#session-form-error');
  const cancelEditBtn = modalBody.querySelector('#session-form-cancel-edit');

  initWizard(form);

  cancelEditBtn?.addEventListener('click', clearEditMode);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.hidden = true;

    const container = modalBody.querySelector('.session-modal');
    const teacherInput = form.querySelector('input[name="teacherId"]:checked');
    const studentInputs = [...form.querySelectorAll('input[name="studentIds"]:checked')];

    // Form üzerindeki zaman picker değerlerini oku
    const startTimeInput = form.querySelector('#session-start-time');
    const endTimeInput = form.querySelector('#session-end-time');

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
              startTime: startTimeInput ? startTimeInput.value : container.dataset.start,
              endTime: endTimeInput ? endTimeInput.value : container.dataset.end,
              ...payload,
            },
          });

      showToast(result.message || (editingSessionId ? 'Etüt güncellendi.' : 'Etüt kaydedildi.'));
      closeModal();
      setTimeout(() => {
        window.location.reload();
      }, 500);
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
        closeModal();
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // Re-run lucide icons inside modal
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({
      attrs: {
        class: 'choice-card__icon'
      },
      nameAttr: 'data-lucide'
    });
  }
}

/* ── Timeline tıklama delegasyonu ── */
document.querySelectorAll('.day-timeline').forEach((timeline) => {
  timeline.addEventListener('click', (e) => {
    const trigger = e.target.closest('.timeline-card');
    if (!trigger) return;
    editingSessionId = null;
    loadPanel(trigger).catch((err) => {
      showToast(err.message || 'Panel açılamadı.', 'error');
    });
  });
});

/* ── Floating Action Button (FAB) Tıklama Dinleyicisi ── */
const fabBtn = document.getElementById('fab-add-session');
fabBtn?.addEventListener('click', () => {
  editingSessionId = null;
  // Mock trigger to load the modal for the active day with a default time range
  const triggerMock = {
    dataset: {
      day: activeDayKey,
      start: '09:00',
      end: '10:00'
    },
    closest: () => null
  };
  loadPanel(triggerMock).catch((err) => {
    showToast(err.message || 'Panel açılamadı.', 'error');
  });
});

/* ── Lucide ikonlarını yeniden render et ── */
if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}
