import { apiJson } from './api.js';
import { showToast, showConfirm } from './ui.js';
import { exportMasterSchedulePdf, exportDailySchedulePdf } from './listPdfExport.js';

/* ── DOM referansları ── */
const modal = document.getElementById('schedule-modal');
const modalBody = document.getElementById('schedule-modal-body');
const daySelector = document.getElementById('day-selector-nav');
const timelinesContainer = document.getElementById('timelines-container');
const calendarNav = document.getElementById('calendar-nav');
const monthSelect = document.getElementById('calendar-month-select');
const weekSelect = document.getElementById('calendar-week-select');
const periodLabel = document.getElementById('calendar-period-label');

let activeCell = null;
let editingSessionId = null;
let activeDayKey = document.querySelector('.day-selector__pill--active')?.dataset.day;

// Mevcut takvim durumu
let currentMonth = calendarNav ? Number(calendarNav.dataset.month) : 9;
let currentWeek = calendarNav ? Number(calendarNav.dataset.week) : 1;
let currentYear = calendarNav ? Number(calendarNav.dataset.year) : new Date().getFullYear();

/* ── Takvim AJAX ── */

/** Ay değiştiğinde hafta listesini güncelle */
async function onMonthChange() {
  const month = Number(monthSelect.value);
  currentMonth = month;

  // Hafta listesini API'den çek
  try {
    const result = await apiJson(`/api/calendar/weeks?month=${month}`);
    const weeks = result.data.weeks;
    
    weekSelect.innerHTML = '';
    weeks.forEach((w) => {
      const opt = document.createElement('option');
      opt.value = w.weekNumber;
      opt.textContent = w.label;
      weekSelect.appendChild(opt);
    });

    // İlk haftayı seç
    currentWeek = weeks.length > 0 ? weeks[0].weekNumber : 1;
    weekSelect.value = currentWeek;

    await fetchAndRenderCalendar();
  } catch (err) {
    showToast(err.message || 'Hafta listesi alınamadı.', 'error');
  }
}

/** Hafta değiştiğinde takvim verilerini yenile */
async function onWeekChange() {
  currentWeek = Number(weekSelect.value);
  await fetchAndRenderCalendar();
}

/** Takvim verilerini çek ve UI'ı güncelle */
async function fetchAndRenderCalendar() {
  try {
    // Yükleniyor göstergesi
    if (timelinesContainer) {
      timelinesContainer.classList.add('timelines-loading');
    }

    const result = await apiJson(`/api/calendar?month=${currentMonth}&week=${currentWeek}`);
    const { days, daySessionsMap, stats, calendarInfo, todayKey } = result.data;

    currentYear = calendarInfo.year;

    // Takvim nav data güncelle
    if (calendarNav) {
      calendarNav.dataset.month = currentMonth;
      calendarNav.dataset.week = currentWeek;
      calendarNav.dataset.year = currentYear;
    }

    // Dönem etiketi güncelle
    if (periodLabel) {
      periodLabel.innerHTML = `
        <span class="calendar-nav__period-icon"><i data-lucide="calendar-days"></i></span>
        <span>${calendarInfo.startDate} — ${calendarInfo.endDate}</span>
      `;
    }

    // Başlık alt metnini güncelle
    const subtitle = document.querySelector('.page-header__subtitle');
    if (subtitle) {
      subtitle.textContent = `${calendarInfo.monthLabel} — ${calendarInfo.weekNumber}. Hafta, ${calendarInfo.year}`;
    }

    // İstatistikleri güncelle
    updateStats(stats);

    // Gün seçiciyi yeniden render et
    renderDayPills(days, todayKey);

    // Timeline'ları yeniden render et
    renderTimelines(days, daySessionsMap, todayKey);

    // Lucide ikonlarını render et
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    updateFabState();
  } catch (err) {
    showToast(err.message || 'Takvim verileri alınamadı.', 'error');
  } finally {
    if (timelinesContainer) {
      timelinesContainer.classList.remove('timelines-loading');
    }
  }
}

/** İstatistik kartlarını güncelle */
function updateStats(stats) {
  const el = (id) => document.getElementById(id);
  if (el('stat-sessions')) el('stat-sessions').textContent = String(stats.sessions);
  if (el('stat-teachers')) el('stat-teachers').textContent = String(stats.teachers);
  if (el('stat-students')) el('stat-students').textContent = String(stats.students);
}

/** Gün seçici pill'leri yeniden render et */
function renderDayPills(days, todayKey) {
  if (!daySelector) return;

  const now = new Date();
  const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayInWeek = days.some((d) => d.date === todayDateStr);
  const defaultActiveKey = todayInWeek
    ? days.find((d) => d.date === todayDateStr).key
    : (days[0]?.key || 'MONDAY');

  daySelector.innerHTML = days
    .map((day) => {
      const isActive = day.key === defaultActiveKey;
      const isToday = day.date === todayDateStr;
      let classes = 'day-selector__pill';
      if (isActive) classes += ' day-selector__pill--active';
      if (isToday) classes += ' day-selector__pill--today';

      return `
        <button
          type="button"
          class="${classes}"
          data-day="${day.key}"
          data-date="${day.date || ''}"
          aria-pressed="${isActive ? 'true' : 'false'}"
        >
          <span class="day-selector__short">${day.short}</span>
          ${day.dateLabel
            ? `<span class="day-selector__date">${day.dateLabel}</span>`
            : `<span class="day-selector__full">${day.label}</span>`
          }
        </button>
      `;
    })
    .join('');

  activeDayKey = defaultActiveKey;
}

/** Timeline panellerini yeniden render et */
function renderTimelines(days, daySessionsMap, todayKey) {
  if (!timelinesContainer) return;

  const now = new Date();
  const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayInWeek = days.some((d) => d.date === todayDateStr);
  const defaultActiveKey = todayInWeek
    ? days.find((d) => d.date === todayDateStr).key
    : (days[0]?.key || 'MONDAY');

  let html = '';
  days.forEach((day) => {
    const isActive = day.key === defaultActiveKey;
    const sessions = daySessionsMap[day.key] || [];

    html += `<div
      class="day-timeline${isActive ? ' day-timeline--active' : ''}"
      data-day="${day.key}"
      data-date="${day.date || ''}"
      role="region"
      aria-label="${day.label} programı"
      ${!isActive ? 'hidden' : ''}
    >`;

    if (sessions.length === 0) {
      html += `
        <div class="agenda-empty-state">
          <div class="agenda-empty-state__icon-wrapper">
            <i data-lucide="calendar" class="agenda-empty-state__icon"></i>
          </div>
          <h3 class="agenda-empty-state__title">Planlanmış Etüt Yok</h3>
          <p class="agenda-empty-state__text">Bu gün için planlanmış herhangi bir etüt bulunmuyor.</p>
          <button type="button" class="btn btn--primary btn--center-add" style="margin-top: var(--space-4);" data-action="center-add-session">
            <i data-lucide="plus" class="btn--center-add__icon"></i>
            <span>Yeni Etüt Ekle</span>
          </button>
        </div>
      `;
    } else {
      // Saat gruplarına ayır
      const timeGroups = [];
      sessions.forEach((session) => {
        const timeKey = session.startTime + ' – ' + session.endTime;
        let group = timeGroups.find((g) => g.timeKey === timeKey);
        if (!group) {
          group = { timeKey, startTime: session.startTime, endTime: session.endTime, sessions: [] };
          timeGroups.push(group);
        }
        group.sessions.push(session);
      });

      html += '<div class="agenda-timeline-container">';
      timeGroups.forEach((group) => {
        html += renderAgendaSlot(day.key, group);
      });
      html += '</div>';
    }

    html += '</div>';
  });

  timelinesContainer.innerHTML = html;

  // Yeniden event listener'ları bağla
  bindTimelineEvents();
  bindCenterAddButtons();

  activeDayKey = defaultActiveKey;
}

/** Agenda slot HTML oluştur (sunucu tarafındaki agenda-slot.ejs'nin JS karşılığı) */
function renderAgendaSlot(dayKey, group) {
  function getTeacherColorClass(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['blue', 'green', 'orange', 'purple', 'rose', 'amber'];
    const color = colors[Math.abs(hash) % colors.length];
    return `timeline-card--${color}`;
  }

  let html = `
    <div class="timeline-row agenda-row"
      data-day="${dayKey}"
      data-start="${group.startTime}"
      data-end="${group.endTime}"
      data-session-count="${group.sessions.length}"
    >
      <div class="timeline-row__time">${group.timeKey}</div>
      <div class="timeline-row__track">
        <span class="timeline-row__dot timeline-row__dot--filled"></span>
      </div>
      <div class="timeline-row__content timeline-cards-row">
  `;

  group.sessions.forEach((session) => {
    const colorClass = getTeacherColorClass(session.teacherName);
    html += `
      <button
        type="button"
        class="timeline-card ${colorClass}"
        data-day="${dayKey}"
        data-start="${session.startTime}"
        data-end="${session.endTime}"
        data-session-id="${session.id}"
        aria-label="${session.teacherName} — ${session.studentCount} öğrenci"
      >
        <div class="timeline-card__body">
          <span class="timeline-card__subject">${session.teacherSubject || 'Ders Belirtilmemiş'}</span>
          <span class="timeline-card__teacher">
            <i data-lucide="graduation-cap" class="timeline-card__teacher-icon"></i>
            ${session.teacherName}
          </span>
          <span class="timeline-card__students">
            <i data-lucide="users" class="timeline-card__students-icon"></i>
            ${session.studentCount} öğrenci
          </span>
        </div>
      </button>
    `;
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

/* ── Takvim dropdown event listener'ları ── */
monthSelect?.addEventListener('change', onMonthChange);
weekSelect?.addEventListener('change', onWeekChange);

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
  updateFabState();
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
  const { day, start, end, isGlobalAdd } = trigger.dataset;

  activeCell = trigger.closest('.timeline-row') || trigger;

  if (!quiet) {
    modalBody.innerHTML = '<p class="session-modal__loading">Yükleniyor...</p>';
    openModal();
  }

  const params = new URLSearchParams({
    dayOfWeek: day,
    startTime: start,
    endTime: end,
    month: currentMonth,
    weekNumber: currentWeek,
    ...(isGlobalAdd ? { isGlobalAdd } : {})
  });
  const res = await fetch(`/api/sessions/panel?${params}`, {
    headers: { Accept: 'text/html' },
  });

  if (!res.ok) {
    modalBody.innerHTML = '<p class="session-modal__empty">Panel yüklenemedi.</p>';
    return;
  }

  modalBody.innerHTML = await res.text();
  bindPanelEvents();

  // Strict JS State Control for global add flow
  if (isGlobalAdd === 'true') {
    const existingSection = modalBody.querySelector('section[aria-label="Mevcut etütler"]');
    if (existingSection) existingSection.style.display = 'none';

    const title = modalBody.querySelector('.session-modal__title');
    if (title) {
      title.textContent = 'Yeni Etüt Ekle';
      title.style.display = 'block';
    }

    const formSubtitle = modalBody.querySelector('#session-form-title');
    if (formSubtitle) formSubtitle.style.display = 'none';
  } else {
    const existingSection = modalBody.querySelector('section[aria-label="Mevcut etütler"]');
    if (existingSection) existingSection.style.display = '';

    const formSubtitle = modalBody.querySelector('#session-form-title');
    if (formSubtitle) formSubtitle.style.display = '';
  }

  if (!quiet) openModal();
}

/* ── Etüt Detayları Panel Yükleme (AJAX ile modal içeriği) ── */
async function loadSessionDetails(sessionId) {
  modalBody.innerHTML = '<p class="session-modal__loading">Yükleniyor...</p>';
  openModal();

  const res = await fetch(`/api/sessions/${sessionId}/details`);
  if (!res.ok) {
    modalBody.innerHTML = '<p class="session-modal__empty">Detaylar yüklenemedi.</p>';
    return;
  }

  modalBody.innerHTML = await res.text();
  bindDetailViewEvents();
}

/* ── Detay Görünümü Olay Dinleyicileri ── */
function bindDetailViewEvents() {
  const container = modalBody.querySelector('.session-detail-view');
  if (!container) return;

  const sessionId = Number(container.dataset.sessionId);
  const teacherId = container.dataset.teacherId;
  const studentIds = container.dataset.studentIds;
  const dayOfWeek = container.dataset.day;
  const startTime = container.dataset.start;
  const endTime = container.dataset.end;

  // Düzenle butonu
  container.querySelector('[data-action="detail-edit"]')?.addEventListener('click', async () => {
    modalBody.innerHTML = '<p class="session-modal__loading">Yükleniyor...</p>';
    
    const params = new URLSearchParams({
      dayOfWeek,
      startTime,
      endTime,
      month: currentMonth,
      weekNumber: currentWeek
    });
    const res = await fetch(`/api/sessions/panel?${params}`, {
      headers: { Accept: 'text/html' },
    });

    if (!res.ok) {
      modalBody.innerHTML = '<p class="session-modal__empty">Form yüklenemedi.</p>';
      return;
    }

    modalBody.innerHTML = await res.text();
    bindPanelEvents();

    const dummyItem = {
      dataset: {
        sessionId,
        teacherId,
        studentIds
      }
    };
    startEditMode(dummyItem);
  });

  // Sil butonu
  container.querySelector('[data-action="detail-delete"]')?.addEventListener('click', async () => {
    const ok = await showConfirm('Bu etüt kaydını silmek istediğinize emin misiniz?', {
      title: 'Etütü sil',
      confirmLabel: 'Sil',
    });
    if (!ok) return;

    try {
      const result = await apiJson(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      showToast(result.message || 'Etüt silindi.');
      closeModal();
      await fetchAndRenderCalendar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/* ── Timeline satırını güncelle ── */
function updateTimelineRow(row, delta) {
  const count = Math.max(0, Number(row.dataset.sessionCount || 0) + delta);
  row.dataset.sessionCount = String(count);

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
  const errorEl = modalBody.querySelector('#session-form-error');

  if (title) title.textContent = 'Yeni Etüt Ekle';
  form?.reset();
  form?.syncWizardState?.();
}

function startEditMode(item) {
  const form = modalBody.querySelector('#session-form');
  if (!form) return;

  const modalContainer = modalBody.querySelector('.session-modal');
  if (modalContainer) {
    modalContainer.classList.add('session-modal--editing');
  }

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

  const startTime = item.dataset.start;
  const endTime = item.dataset.end;

  if (startTime) {
    const startInput = form.querySelector('#session-start-time');
    if (startInput) startInput.value = startTime;
    const [sh, sm] = startTime.split(':');
    const startPicker = form.querySelector('#start-time-picker');
    if (startPicker) {
      const hEl = startPicker.querySelector('.digital-number--hours');
      const mEl = startPicker.querySelector('.digital-number--minutes');
      if (hEl) hEl.textContent = sh;
      if (mEl) mEl.textContent = sm;
    }
  }

  if (endTime) {
    const endInput = form.querySelector('#session-end-time');
    if (endInput) endInput.value = endTime;
    const [eh, em] = endTime.split(':');
    const endPicker = form.querySelector('#end-time-picker');
    if (endPicker) {
      const hEl = endPicker.querySelector('.digital-number--hours');
      const mEl = endPicker.querySelector('.digital-number--minutes');
      if (hEl) hEl.textContent = eh;
      if (mEl) mEl.textContent = em;
    }
  }

  const title = modalBody.querySelector('#session-form-title');
  if (title) title.textContent = 'Etüt Düzenle';

  form.syncWizardState?.();
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── Panel yenileme ── */
async function refreshPanel() {
  if (!activeCell) return;
  const prevEditId = editingSessionId;

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

    form.setWheelTime = function(pickerId, timeStr) {
      const card = form.querySelector(`#${pickerId}`);
      if (card && timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        updatePickerDisplay(card, h, m);
      }
    };

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

  initDigitalPickers(form);

  function goToStep(stepNum) {
    if (stepNum === 1) {
      step1.classList.add('wizard-step--active');
      step2.classList.remove('wizard-step--active');
      progressDots.forEach(dot => {
        dot.classList.toggle('wizard-progress__dot--active', dot.dataset.stepIndicator === '1');
      });
      // Footer actions step 1 göster, step 2 gizle
      const act1 = form.querySelector('[data-step-actions="1"]');
      const act2 = form.querySelector('[data-step-actions="2"]');
      if (act1) act1.style.display = 'flex';
      if (act2) act2.style.display = 'none';
    } else if (stepNum === 2) {
      step1.classList.remove('wizard-step--active');
      step2.classList.add('wizard-step--active');
      progressDots.forEach(dot => {
        dot.classList.toggle('wizard-progress__dot--active', dot.dataset.stepIndicator === '2');
      });
      // Footer actions step 1 gizle, step 2 göster
      const act1 = form.querySelector('[data-step-actions="1"]');
      const act2 = form.querySelector('[data-step-actions="2"]');
      if (act1) act1.style.display = 'none';
      if (act2) act2.style.display = 'flex';
    }
  }

  nextBtn?.addEventListener('click', () => goToStep(2));
  prevBtn?.addEventListener('click', () => goToStep(1));

  durationChips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (startTimeInput && endTimeInput && !startTimeInput.disabled) {
        const minutes = Number(chip.dataset.minutes);
        const startTimeVal = startTimeInput.value;
        if (startTimeVal) {
          const calculatedEndTime = addMinutesToTime(startTimeVal, minutes);
          endTimeInput.value = calculatedEndTime;
          endTimeInput.dispatchEvent(new Event('change', { bubbles: true }));
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
    
    // Placeholder güncellenmesi
    const placeholder = form.querySelector('.no-students-placeholder');
    if (placeholder) {
      placeholder.style.display = checkedBoxes.length === 0 ? 'inline' : 'none';
    }

    checkedBoxes.forEach(cb => {
      const label = cb.dataset.label || cb.parentElement.querySelector('.choice-row__main')?.textContent || '';
      createChip(cb.value, label);
      cb.closest('.student-choice-row')?.classList.add('student-choice-row--selected');
    });

    const uncheckedBoxes = form.querySelectorAll('input[name="studentIds"]:not(:checked)');
    uncheckedBoxes.forEach(cb => {
      cb.closest('.student-choice-row')?.classList.remove('student-choice-row--selected');
    });

    const isEditMode = editingSessionId !== null;
    form.syncWheelDisabledState(isEditMode);
    
    durationChips.forEach(chip => {
      chip.disabled = isEditMode;
    });

    // İptal ve Sil butonlarının ayarlanması
    const cancelBtn = form.querySelector('#session-form-cancel-edit');
    const deleteBtn = form.querySelector('#session-form-delete-btn');
    const submitBtn = form.querySelector('#session-form-submit');
    if (cancelBtn) cancelBtn.hidden = !isEditMode;
    if (deleteBtn) deleteBtn.hidden = !isEditMode;
    if (submitBtn) {
      submitBtn.textContent = isEditMode ? 'Güncelle' : 'Etüt Kaydet';
    }

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
  const deleteBtn = modalBody.querySelector('#session-form-delete-btn');

  initWizard(form);

  cancelEditBtn?.addEventListener('click', clearEditMode);

  deleteBtn?.addEventListener('click', async () => {
    if (!editingSessionId) return;
    const ok = await showConfirm('Bu etüt kaydını silmek istediğinize emin misiniz?', {
      title: 'Etütü sil',
      confirmLabel: 'Sil',
    });
    if (!ok) return;

    try {
      const result = await apiJson(`/api/sessions/${editingSessionId}`, { method: 'DELETE' });
      showToast(result.message || 'Etüt silindi.');
      closeModal();
      await fetchAndRenderCalendar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.hidden = true;

    const container = modalBody.querySelector('.session-modal');
    const teacherInput = form.querySelector('input[name="teacherId"]:checked');
    const studentInputs = [...form.querySelectorAll('input[name="studentIds"]:checked')];

    const startTimeInput = form.querySelector('#session-start-time');
    const endTimeInput = form.querySelector('#session-end-time');

    const startVal = startTimeInput ? startTimeInput.value : container.dataset.start;
    const endVal = endTimeInput ? endTimeInput.value : container.dataset.end;

    if (startVal && endVal) {
      const [sh, sm] = startVal.split(':').map(Number);
      const [eh, em] = endVal.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      if (startMins >= endMins) {
        if (errorEl) {
          errorEl.textContent = 'Başlangıç saati, bitiş saatinden sonra veya aynı olamaz!';
          errorEl.hidden = false;
        } else {
          showToast('Başlangıç saati, bitiş saatinden sonra veya aynı olamaz!', 'error');
        }
        return;
      }
    }

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

    // Aktif gün pill'inden date bilgisini al
    const activePill = document.querySelector('.day-selector__pill--active');
    const activeDate = activePill?.dataset.date || '';

    const payload = {
      teacherId: Number(teacherInput.value),
      studentIds: studentInputs.map((i) => Number(i.value)),
      dayOfWeek: container.dataset.day,
      startTime: startTimeInput ? startTimeInput.value : container.dataset.start,
      endTime: endTimeInput ? endTimeInput.value : container.dataset.end,
    };

    try {
      const result = editingSessionId
        ? await apiJson(`/api/sessions/${editingSessionId}`, { method: 'PUT', body: payload })
        : await apiJson('/api/sessions', {
            method: 'POST',
            body: {
              month: currentMonth,
              weekNumber: currentWeek,
              date: activeDate,
              ...payload,
            },
          });

      showToast(result.message || (editingSessionId ? 'Etüt güncellendi.' : 'Etüt kaydedildi.'));
      closeModal();
      await fetchAndRenderCalendar();
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
        await fetchAndRenderCalendar();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

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
function bindTimelineEvents() {
  document.querySelectorAll('.day-timeline').forEach((timeline) => {
    timeline.addEventListener('click', (e) => {
      const trigger = e.target.closest('.timeline-card');
      if (!trigger) return;
      
      const sessionId = trigger.dataset.sessionId;
      if (sessionId) {
        loadSessionDetails(Number(sessionId)).catch((err) => {
          showToast(err.message || 'Detaylar açılamadı.', 'error');
        });
      } else {
        editingSessionId = null;
        loadPanel(trigger).catch((err) => {
          showToast(err.message || 'Panel açılamadı.', 'error');
        });
      }
    });
  });
}

// İlk yüklemede bağla
bindTimelineEvents();

/* ── Floating Action Button (FAB) & Center Add Button ── */
function updateFabState() {
  const activeTimeline = document.querySelector('.day-timeline.day-timeline--active');
  const isEmpty = activeTimeline && activeTimeline.querySelector('.agenda-empty-state') !== null;
  const fab = document.getElementById('fab-add-session');
  if (fab) {
    if (isEmpty) {
      fab.classList.add('fab-btn--hidden');
    } else {
      fab.classList.remove('fab-btn--hidden');
    }
  }
}

/* ── Yeni Etüt Ekleme Modali Açıcı ── */
function openAddSessionModal() {
  editingSessionId = null;
  const triggerMock = {
    dataset: {
      day: activeDayKey,
      start: '09:00',
      end: '10:00',
      isGlobalAdd: 'true'
    },
    closest: () => null
  };
  loadPanel(triggerMock).catch((err) => {
    showToast(err.message || 'Panel açılamadı.', 'error');
  });
}

const fabBtn = document.getElementById('fab-add-session');
fabBtn?.addEventListener('click', openAddSessionModal);

function bindCenterAddButtons() {
  document.querySelectorAll('[data-action="center-add-session"]').forEach((btn) => {
    btn.addEventListener('click', openAddSessionModal);
  });
}

// İlk yüklemede bağla
bindCenterAddButtons();

// İlk yüklemede FAB durumunu ayarla
updateFabState();

// Genel program PDF dışa aktarma butonu dinleyicisi
document.getElementById('btn-export-master-pdf')?.addEventListener('click', (e) => {
  exportMasterSchedulePdf({ triggerBtn: e.currentTarget });
});

// Günlük program PDF dışa aktarma butonu dinleyicisi
document.getElementById('btn-export-daily-pdf')?.addEventListener('click', (e) => {
  const activePill = document.querySelector('.day-selector__pill--active');
  if (!activePill) {
    showToast('Aktif gün seçilemedi.', 'error');
    return;
  }
  const dayKey = activePill.dataset.day;
  const dayLabel = activePill.textContent.trim().replace(/\s+/g, ' ');
  exportDailySchedulePdf({ dayKey, dayLabel, triggerBtn: e.currentTarget });
});

/* ── Lucide ikonlarını yeniden render et ── */
if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}
