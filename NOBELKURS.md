# NOBELKURS — Etüt Yönetim Sistemi

Proje dokümantasyonu. Geliştirme sürecinde bu dosya güncel tutulmalı; yeni özellik/karar eklendikçe ilgili bölüm güncellenir.

---

## 1. Proje Özeti

Nobel Kurs Merkezi için web tabanlı etüt planlama ve takip sistemi. Kurs müdürü, haftalık etüt programını (gün x saat) tek ekrandan yönetir; öğretmen ve öğrenci ataması yapar; toplu/tekil PDF raporları üretir.

**Kullanıcı profili:** Tek kullanıcı — Nobel Kurs Merkezi Müdürü. Çok kullanıcılı yetkilendirme şu an kapsam dışı, ileride eklenebilir.

---

## 2. Teknoloji Yığını

| Katman | Teknoloji | Not |
|---|---|---|
| Backend | Node.js + Express | |
| ORM | Prisma | |
| Veritabanı | PostgreSQL | |
| Template | EJS | Sayfa iskeleti + AJAX ile çekilen partial'lar |
| İstemci etkileşimi | Vanilla JS (fetch) + Alpine.js (opsiyonel, hafif reaktivite) | Build tooling yok |
| Excel içe aktarma | exceljs | MEB e-Okul formatı |
| PDF üretimi | Puppeteer (HTML→PDF) | Aynı EJS şablonları PDF için de kullanılır |
| Dosya yükleme | multer | Excel upload için |

**Mimari karar — EJS neden statik HTML+API yerine:**
Hücreye tıklandığında açılan modal içeriği (etüt listesi, öğretmen/öğrenci formu) sunucudan EJS partial olarak fetch edilip DOM'a basılır. Böylece template mantığı tek yerde (sunucuda) kalır, client ve server'da aynı görünümü iki kez yazmak gerekmez. Bu ölçekte (iç kullanım, tek kullanıcı) React/Vue gibi bir SPA framework gereksiz build karmaşıklığı getirir.

---

## 3. Veritabanı Şeması (Prisma)

```prisma
enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

model Teacher {
  id            Int            @id @default(autoincrement())
  name          String
  createdAt     DateTime       @default(now())
  studySessions StudySession[]
}

model Student {
  id            Int      @id @default(autoincrement())
  studentNumber String   @unique
  firstName     String
  lastName      String
  className     String?
  createdAt     DateTime @default(now())
  sessions      StudySessionStudent[]
}

model StudySession {
  id        Int       @id @default(autoincrement())
  dayOfWeek DayOfWeek
  startTime String    // "09:00"
  endTime   String    // "10:00"
  teacherId Int
  teacher   Teacher   @relation(fields: [teacherId], references: [id])
  students  StudySessionStudent[]
  createdAt DateTime  @default(now())
}

model StudySessionStudent {
  studySessionId Int
  studentId      Int
  studySession   StudySession @relation(fields: [studySessionId], references: [id])
  student        Student      @relation(fields: [studentId], references: [id])
  @@id([studySessionId, studentId])
}
```

**Notlar:**
- Saat aralıkları (`09.00-10.00` vb.) ayrı bir DB tablosu değil, `config/schedule.js` içinde sabit dizi olarak tutulur. Değişiklik gerekirse tek yerden yönetilir.
- Aynı gün+saat hücresinde birden fazla öğretmenin farklı etüt oturumu olabilir — hücreye tıklanınca o gün/saatteki tüm `StudySession` kayıtları listelenir, yenisi eklenebilir.
- `studentNumber` unique — excel içe aktarmada upsert anahtarı olarak kullanılır.

---

## 4. Route / API Yapısı

```
GET  /                          Anasayfa (7 gün x saat tablosu)
GET  /api/sessions/panel        Belirli gün+saat için modal içeriği (partial, AJAX)
POST /api/sessions              Yeni etüt programı oluştur
PUT  /api/sessions/:id          Etüt programını düzenle
DELETE /api/sessions/:id        Etüt programını sil

GET  /teachers                  Öğretmen yönetim sekmesi (liste + arama)
POST /teachers                  Yeni öğretmen ekle
PUT  /teachers/:id              Düzenle
DELETE /teachers/:id            Sil

GET  /students                  Öğrenci yönetim sekmesi (liste + arama: ad/numara)
POST /students/import           Excel yükleme (multer + exceljs)
PUT  /students/:id              Düzenle
DELETE /students/:id            Sil

GET  /pdf/students/all          Toplu PDF — sayfa başı 1 öğrenci
GET  /pdf/teachers/all          Toplu PDF — sayfa başı 1 öğretmen
GET  /pdf/students/:id          Tekil öğrenci PDF
GET  /pdf/teachers/:id          Tekil öğretmen PDF
```

---

## 5. Klasör Yapısı

```
src/
  routes/        teachers.js, students.js, sessions.js, pdf.js
  views/
    partials/    session-panel.ejs, session-form.ejs, table-cell.ejs
    pages/       index.ejs, teachers.ejs, students.ejs
    pdf/         student-schedule.ejs, teacher-schedule.ejs
  services/      excelImport.js, pdfGenerator.js
  prisma/
    schema.prisma
  config/
    schedule.js  (gün/saat sabitleri)
```

---

## 6. UI Akışları

**Etüt oluşturma (modal içinde, sayfa yenilenmeden):**
1. Anasayfadaki tabloda bir hücreye tıklanır → ekranın ortasında popup açılır.
2. Popup üstte o gün/saat için mevcut etüt programlarını listeler.
3. "Yeni Etüt Ekle" ile form açılır: önce öğretmen listesi (radio button — tek seçim), ardından öğrenci listesi (checkbox — çoklu seçim).
4. Kaydet → AJAX ile `POST /api/sessions`, popup içeriği yenilenir, sayfa reload olmaz.

**Öğretmen/Öğrenci yönetimi:**
- Ayrı sekmelerde liste, arama (öğrenci için ad veya numara), düzenleme ve silme.
- Öğretmenler elle eklenir (sadece isim).
- Öğrenciler MEB standart excel formatından içe aktarılır (kolon mapping'i henüz netleştirilmedi — örnek dosya paylaşıldığında tamamlanacak).

---

## 7. Geliştirme Fazları

| Faz | İçerik | Durum |
|---|---|---|
| 0 | Repo kurulumu, Prisma + PostgreSQL bağlantısı, Express+EJS iskeleti, VPS deploy pipeline | Planlandı |
| 1 | Öğretmen/Öğrenci CRUD + yönetim sekmeleri | Planlandı |
| 2 | Excel içe aktarma (öğrenci) | Planlandı — kolon mapping bekleniyor |
| 3 | Anasayfa tablo görünümü (7 gün x saat, dolu/boş hücre göstergesi) | Planlandı |
| 4 | Hücre tıklama → modal (mevcut etütler + yeni etüt formu) | Planlandı |
| 5 | Etüt düzenleme/silme (modal üzerinden) | Planlandı |
| 6 | PDF export (4 varyant) | Planlandı |
| 7 | Basit admin login (tek kullanıcı), yedekleme, prod deploy | Planlandı |
| 8+ | Genişletilebilir modüller (devamsızlık takibi, bildirim, vb.) | Kapsam dışı — ileride değerlendirilecek |

---

## 8. Açık Konular / Bekleyen Kararlar

- **Excel kolon mapping:** MEB e-Okul çıktısının kolon sırası/isimleri örnek dosya ile netleştirilecek.
- **Deploy hedefi:** Mevcut Contabo VPS üzerinde ayrı bir subdomain/port ile mi, yoksa AidatPanel altyapısından bağımsız mı barındırılacağı netleştirilecek.
- **Yetkilendirme:** Şu an tek kullanıcı varsayımıyla ilerleniyor; ileride çoklu kullanıcı/rol ihtiyacı doğarsa auth katmanı eklenecek.

---

*Son güncelleme: Bu doküman proje ilerledikçe güncellenmelidir.*
