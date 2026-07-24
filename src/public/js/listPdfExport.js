/**
 * Liste PDF Dışa Aktarma — jsPDF + jspdf-autotable
 * Öğrenci ve Öğretmen listelerini yazıcı dostu PDF olarak dışa aktarır.
 */
import { showToast } from './ui.js';

/**
 * Tarihi YYYY-MM-DD formatında döndürür.
 */
function todayISO() {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Tarihi Türkçe okunur formatta döndürür.
 */
function todayTR() {
  return new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Tablodan veri satırlarını çıkarır.
 * @param {string} tbodyId - Tbody element ID
 * @param {number[]} colIndices - Dahil edilecek sütun indeksleri (0-tabanlı)
 * @returns {{ headers: string[], rows: string[][] }}
 */
function extractTableData(tbodyId, colIndices) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return { headers: [], rows: [] };

  const table = tbody.closest('table');
  const thCells = table.querySelectorAll('thead th');
  const headers = colIndices.map((i) => thCells[i]?.textContent?.trim() || '');

  const rows = [];
  tbody.querySelectorAll('tr').forEach((tr) => {
    // Gizli (filtrelenmiş) satırları atla
    if (tr.hidden) return;

    const cells = tr.querySelectorAll('td');
    const row = colIndices.map((i) => {
      const cell = cells[i];
      if (!cell) return '';
      // Hücre içindeki tüm metin içeriğini al (badge, span vs.)
      return cell.textContent.trim().replace(/\s+/g, ' ');
    });
    rows.push(row);
  });

  return { headers, rows };
}

/**
 * ArrayBuffer'ı base64 string'e dönüştürür.
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

let _fontsLoaded = false;
let _regFontBase64 = null;
let _boldFontBase64 = null;

/**
 * Roboto yazı tiplerini yerel olarak yükler ve jsPDF VFS'sine kaydeder.
 */
async function ensureFontsLoaded(doc) {
  if (!_fontsLoaded) {
    const [regRes, boldRes] = await Promise.all([
      fetch('/fonts/Roboto-Regular.ttf'),
      fetch('/fonts/Roboto-Bold.ttf')
    ]);

    if (!regRes.ok || !boldRes.ok) {
      throw new Error('Yazı tipi dosyaları yüklenemedi.');
    }

    const [regBuf, boldBuf] = await Promise.all([
      regRes.arrayBuffer(),
      boldRes.arrayBuffer()
    ]);

    _regFontBase64 = arrayBufferToBase64(regBuf);
    _boldFontBase64 = arrayBufferToBase64(boldBuf);
    _fontsLoaded = true;
  }

  doc.addFileToVFS('Roboto-Regular.ttf', _regFontBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

  doc.addFileToVFS('Roboto-Bold.ttf', _boldFontBase64);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
}

/**
 * jsPDF + autoTable ile PDF oluşturup indirir.
 * @param {object} options
 * @param {string} options.title - PDF başlık metni
 * @param {string} options.filename - İndirme dosya adı
 * @param {string} options.tbodyId - Tbody element ID
 * @param {number[]} options.colIndices - Dahil edilecek sütun indeksleri
 * @param {HTMLButtonElement} [options.triggerBtn] - Tetikleyen buton (UX durumu için)
 */
export async function exportListPdf({ title, filename, tbodyId, colIndices, triggerBtn }) {
  let originalText = '';
  if (triggerBtn) {
    originalText = triggerBtn.innerHTML;
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '<span class="btn__spinner"></span> Hazırlanıyor…';
  }

  try {
    await ensureLibrariesLoaded();
    const { headers, rows } = extractTableData(tbodyId, colIndices);

    if (rows.length === 0) {
      showToast('Tabloda dışa aktarılacak veri yok.', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    await ensureFontsLoaded(doc);
    const pageWidth = doc.internal.pageSize.getWidth();

    // ── Başlık alanı ──
    doc.setFillColor(26, 26, 46); // Koyu lacivert başlık bandı
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('Nobel Kurs Merkezi', 14, 12);

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(200, 200, 220);
    doc.text(title, 14, 19);

    // Tarih — sağ üst
    doc.setFontSize(9);
    doc.setTextColor(180, 180, 200);
    doc.text(todayTR(), pageWidth - 14, 12, { align: 'right' });
    doc.text(`Toplam: ${rows.length} kayıt`, pageWidth - 14, 19, { align: 'right' });

    // ── Tablo ──
    doc.autoTable({
      startY: 34,
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: {
        font: 'Roboto',
        fontSize: 10,
        textColor: [30, 30, 30],
        cellPadding: 4,
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [41, 41, 71],
        textColor: [255, 255, 255],
        font: 'Roboto',
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 250],
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        font: 'Roboto',
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Nobel Kurs Merkezi — ${todayISO()}`,
          14,
          pageH - 8
        );
        doc.text(
          `Sayfa ${doc.internal.getCurrentPageInfo().pageNumber}`,
          pageWidth - 14,
          pageH - 8,
          { align: 'right' }
        );
      },
    });

    doc.save(filename);
    showToast('PDF başarıyla indirildi.');
  } catch (err) {
    console.error('PDF dışa aktarma hatası:', err);
    showToast('PDF oluşturulurken bir hata oluştu.', 'error');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalText;
    }
  }
}

/**
 * jsPDF + autoTable ile haftalık genel program matrisini PDF olarak oluşturur.
 */
export async function exportMasterSchedulePdf({ triggerBtn } = {}) {
  let originalText = '';
  if (triggerBtn) {
    originalText = triggerBtn.innerHTML;
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '<span class="btn__spinner"></span> Hazırlanıyor…';
  }

  try {
    await ensureLibrariesLoaded();

    // 1. Benzersiz saat dilimlerini topla
    const slotsMap = new Set();
    document.querySelectorAll('.timeline-row').forEach(row => {
      const start = row.dataset.start;
      const end = row.dataset.end;
      if (start && end) {
        slotsMap.add(`${start} – ${end}`);
      }
    });
    const slots = Array.from(slotsMap).sort();

    if (slots.length === 0) {
      showToast('Programda etüt saati bulunamadı.', 'error');
      return;
    }

    // 2. Gün konfigürasyonu
    const daysConfig = [
      { key: 'MONDAY', label: 'Pazartesi' },
      { key: 'TUESDAY', label: 'Salı' },
      { key: 'WEDNESDAY', label: 'Çarşamba' },
      { key: 'THURSDAY', label: 'Perşembe' },
      { key: 'FRIDAY', label: 'Cuma' },
      { key: 'SATURDAY', label: 'Cumartesi' },
      { key: 'SUNDAY', label: 'Pazar' },
    ];

    const headers = ['Saat', ...daysConfig.map(d => d.label)];

    // 3. Tüm etüt kartı verilerini DOM'dan oku
    const sessions = [];
    document.querySelectorAll('.timeline-card').forEach(card => {
      const day = card.dataset.day;
      const start = card.dataset.start;
      const end = card.dataset.end;
      const subject = card.querySelector('.timeline-card__subject')?.textContent.trim() || 'Ders Belirtilmemiş';
      const teacher = card.querySelector('.timeline-card__teacher')?.textContent.trim() || '';
      
      sessions.push({
        day,
        slotKey: `${start} – ${end}`,
        subject,
        teacher
      });
    });

    // 4. Tablo satırlarını oluştur
    const rows = slots.map(slotKey => {
      const row = [slotKey];
      daysConfig.forEach(day => {
        const matches = sessions.filter(s => s.day === day.key && s.slotKey === slotKey);
        if (matches.length > 0) {
          row.push(matches.map(m => `${m.subject}\n(${m.teacher})`).join('\n\n'));
        } else {
          row.push('—');
        }
      });
      return row;
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    await ensureFontsLoaded(doc);
    const pageWidth = doc.internal.pageSize.getWidth();

    // ── Başlık alanı ──
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('Nobel Kurs Merkezi', 14, 12);

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(200, 200, 220);
    doc.text('Haftalık Genel Etüt Programı', 14, 19);

    doc.setFontSize(9);
    doc.setTextColor(180, 180, 200);
    doc.text(todayTR(), pageWidth - 14, 12, { align: 'right' });
    doc.text('Tüm Dersler ve Öğretmenler', pageWidth - 14, 19, { align: 'right' });

    // ── Tablo ──
    doc.autoTable({
      startY: 34,
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: {
        font: 'Roboto',
        fontSize: 8,
        textColor: [30, 30, 30],
        cellPadding: 3,
        lineColor: [180, 180, 180],
        lineWidth: 0.3,
        valign: 'middle',
        halign: 'center',
      },
      columnStyles: {
        0: { font: 'Roboto', fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 245], cellWidth: 25 },
      },
      headStyles: {
        fillColor: [41, 41, 71],
        textColor: [255, 255, 255],
        font: 'Roboto',
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [250, 250, 252],
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Nobel Kurs Merkezi Genel Programı — ${todayISO()}`,
          14,
          pageH - 8
        );
        doc.text(
          `Sayfa ${doc.internal.getCurrentPageInfo().pageNumber}`,
          pageWidth - 14,
          pageH - 8,
          { align: 'right' }
        );
      },
    });

    const today = todayISO();
    doc.save(`Genel_Program_${today}.pdf`);
    showToast('Genel Program PDF başarıyla indirildi.');
  } catch (err) {
    console.error('Genel Program PDF dışa aktarma hatası:', err);
    showToast('PDF oluşturulurken bir hata oluştu.', 'error');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalText;
    }
  }
}

/**
 * jsPDF + autoTable ile günlük etüt programını PDF olarak oluşturur.
 */
export async function exportDailySchedulePdf({ dayKey, dayLabel, triggerBtn }) {
  let originalText = '';
  if (triggerBtn) {
    originalText = triggerBtn.innerHTML;
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '<span class="btn__spinner"></span> Hazırlanıyor…';
  }

  try {
    await ensureLibrariesLoaded();

    // 1. Günlük etütleri DOM'dan topla
    const sessions = [];
    const activeTimeline = document.querySelector(`.day-timeline[data-day="${dayKey}"]`);
    if (!activeTimeline) {
      showToast('Günlük program bulunamadı.', 'error');
      return;
    }

    activeTimeline.querySelectorAll('.timeline-card').forEach(card => {
      const start = card.dataset.start;
      const end = card.dataset.end;
      const subject = card.querySelector('.timeline-card__subject')?.textContent.trim() || 'Ders Belirtilmemiş';
      const teacher = card.querySelector('.timeline-card__teacher')?.textContent.trim() || '';
      const studentsText = card.querySelector('.timeline-card__students')?.textContent.trim() || '0 öğrenci';
      
      sessions.push({
        slotKey: `${start} – ${end}`,
        subject,
        teacher,
        students: studentsText
      });
    });

    if (sessions.length === 0) {
      showToast(`${dayLabel} günü için planlanmış etüt bulunmamaktadır.`, 'error');
      return;
    }

    // Sırala
    sessions.sort((a, b) => a.slotKey.localeCompare(b.slotKey));

    const headers = ['Saat', 'Ders', 'Öğretmen', 'Öğrenci Sayısı'];
    const rows = sessions.map(s => [s.slotKey, s.subject, s.teacher, s.students]);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    await ensureFontsLoaded(doc);
    const pageWidth = doc.internal.pageSize.getWidth();

    // ── Başlık alanı ──
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFont('Roboto', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('Nobel Kurs Merkezi', 14, 12);

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(200, 200, 220);
    doc.text(`${dayLabel} Günlük Etüt Programı`, 14, 19);

    doc.setFontSize(9);
    doc.setTextColor(180, 180, 200);
    doc.text(todayTR(), pageWidth - 14, 12, { align: 'right' });
    const subtitleText = document.querySelector('.page-header__subtitle')?.textContent.trim() || '';
    if (subtitleText) {
      doc.text(subtitleText, pageWidth - 14, 19, { align: 'right' });
    }

    // ── Tablo ──
    doc.autoTable({
      startY: 34,
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: {
        font: 'Roboto',
        fontSize: 10,
        textColor: [30, 30, 30],
        cellPadding: 4,
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [41, 41, 71],
        textColor: [255, 255, 255],
        font: 'Roboto',
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 250],
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Nobel Kurs Merkezi — ${todayISO()}`,
          14,
          pageH - 8
        );
        doc.text(
          `Sayfa ${doc.internal.getCurrentPageInfo().pageNumber}`,
          pageWidth - 14,
          pageH - 8,
          { align: 'right' }
        );
      },
    });

    const dayNameClean = dayLabel.replace(/[\s\/,.-]+/g, '_');
    doc.save(`Gunluk_Program_${dayNameClean}_${todayISO()}.pdf`);
    showToast(`${dayLabel} günü programı PDF olarak indirildi.`);
  } catch (err) {
    console.error('Günlük Program PDF dışa aktarma hatası:', err);
    showToast('PDF oluşturulurken bir hata oluştu.', 'error');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalText;
    }
  }
}

/**
 * jsPDF ve autoTable kütüphanelerini CDN'den yükler (lazy load).
 */
let _libPromise = null;

function ensureLibrariesLoaded() {
  if (window.jspdf && window.jspdf.jsPDF) {
    window.jsPDF = window.jspdf.jsPDF;
  }

  if (window.jsPDF) {
    return Promise.resolve();
  }

  if (_libPromise) return _libPromise;

  _libPromise = new Promise((resolve, reject) => {
    const jspdfScript = document.createElement('script');
    jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    jspdfScript.onload = () => {
      window.jsPDF = window.jspdf.jsPDF;

      const atScript = document.createElement('script');
      atScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js';
      atScript.onload = () => resolve();
      atScript.onerror = () => {
        _libPromise = null;
        reject(new Error('jspdf-autotable yüklenemedi'));
      };
      document.head.appendChild(atScript);
    };
    jspdfScript.onerror = () => {
      _libPromise = null;
      reject(new Error('jsPDF yüklenemedi'));
    };
    document.head.appendChild(jspdfScript);
  });

  return _libPromise;
}
