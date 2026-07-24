# NOBELKURS — Etüt Yönetim Sistemi

Proje dokümantasyonu. Geliştirme sürecinde bu dosya güncel tutulmalı; yeni özellik/karar eklendikçe ilgili bölüm güncellenir.

---

## 1. Proje Özeti

Nobel Kurs Merkezi için web tabanlı etüt planlama ve takip sistemi. Kurs müdürü, haftalık etüt programını (gün x saat) tek ekrandan yönetir; öğretmen ve öğrenci ataması yapar; toplu/tekil PDF raporları üretir. Arayüzde koyu/açık tema arasında geçiş yapılabilir.

**Kullanıcı profili:** Tek kullanıcı — Nobel Kurs Merkezi Müdürü. Çok kullanıcılı yetkilendirme şu an kapsam dışı, ileride eklenebilir.

---

## 2. Teknoloji Yığını

| Katman | Teknoloji | Not |
|---|---|---|
| Backend | Node.js + Express | |
| ORM | Prisma + `@prisma/adapter-pg` / `@prisma/adapter-neon` | Driver adapter, Prisma v7; URL'ye göre otomatik seçim (`src/lib/prisma.js`) |
| Veritabanı | PostgreSQL (`pg` veya Neon serverless) | `*.neon.tech` → Neon; diğer Postgres → `pg`; `PRISMA_ADAPTER=neon\|pg` ile zorlanabilir |
| Template | EJS | Sayfa iskeleti + AJAX ile çekilen partial'lar |
| İstemci etkileşimi | Vanilla JS (fetch) | Build tooling yok; v1'de Alpine.js kullanılmaz |
| Oturum / auth | express-session + bcrypt | Tek kullanıcı; Faz 7, prod öncesi zorunlu |
| Stil / tasarım | Saf CSS (değişkenler + bileşen sınıfları) | Harici UI framework yok; bkz. §11 |
| İkonlar | Lucide (CDN) | Tutarlı çizgi ikon seti |
| Excel içe aktarma | xlsx (SheetJS) | MEBBIS IOG02005 `.xls` (Excel 97-2003); `exceljs` yalnızca `.xlsx` destekler |
| PDF üretimi | Puppeteer (HTML→PDF) | Aynı EJS şablonları; eşzamanlı en fazla 1 iş (kuyruk) |
| Dosya yükleme | multer | Excel upload için |
| Test | Node.js `node:test` + `supertest` | v1; bkz. §13 |

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
  subject       String         @default("")
  createdAt     DateTime       @default(now())
  studySessions StudySession[]
}

model SchoolClass {
  id        Int       @id @default(autoincrement())
  name      String    @unique
  students  Student[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Student {
  id            Int          @id @default(autoincrement())
  studentNumber String       @unique
  firstName     String
  lastName      String
  classId       Int
  schoolClass   SchoolClass @relation(fields: [classId], references: [id])
  createdAt     DateTime     @default(now())
  sessions      StudySessionStudent[]
}

model StudySession {
  id         Int                   @id @default(autoincrement())
  dayOfWeek  String
  startTime  String
  endTime    String
  month      Int                   @default(9)
  weekNumber Int                   @default(1)
  date       String                @default("")
  teacherId  Int
  teacher    Teacher               @relation(fields: [teacherId], references: [id])
  students   StudySessionStudent[]
  createdAt  DateTime              @default(now())
}

model StudySessionStudent {
  studySessionId Int
  studentId      Int
  studySession   StudySession @relation(fields: [studySessionId], references: [id], onDelete: Cascade)
  student        Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@id([studySessionId, studentId])
}
```

**Notlar:**
- **Program modeli:** Ay ve hafta bazlı dinamik takvim. `StudySession` `month` (ay), `weekNumber` (hafta) ve `date` (tarih) alanlarını içerir.
- Saat aralıkları (`09.00-10.00` vb.) ayrı bir DB tablosu değil, `config/schedule.js` içinde sabit dizi olarak tutulur. Değişiklik gerekirse tek yerden yönetilir.
- Aynı gün+saat hücresinde birden fazla etüt oturumu olabilir — hücreye tıklanınca o gün/saatteki tüm `StudySession` kayıtları listelenir, yenisi eklenebilir.
- `studentNumber` unique — excel içe aktarmada upsert anahtarı olarak kullanılır (bkz. §10).
- **Sınıf (`SchoolClass`):** Her öğrencinin bir sınıfı vardır (`classId` zorunlu). IOG02005 dosyasında sınıf kolonu yoktur; içe aktarma veya manuel eklemede hedef sınıf belirlenir (bkz. §10). Öğrenci düzenlemeden sınıf değiştirilebilir. Öğrencisi olan sınıf silinemez.
- **Öğretmen silme:** Bağlı `StudySession` kaydı varsa silme **engellenir**; kullanıcıya etüt sayısı ile birlikte anlaşılır hata mesajı gösterilir (cascade yok).
- **Öğrenci çakışması:** Aynı öğrenci aynı `dayOfWeek` + `startTime` + `endTime` aralığında birden fazla etüde **atanamaz**; `POST/PUT /api/sessions` sırasında uygulama katmanında kontrol edilir.

---

## 4. Route / API Yapısı

> JSON yanıt formatı, HTTP durum kodları ve hata kodları için bkz. **§12 API Sözleşmesi**.

```
GET  /                          Anasayfa (7 gün x saat tablosu) — HTML
GET  /login                     Giriş sayfası (Faz 7) — HTML
POST /login                     Oturum aç — form POST, redirect veya JSON hata
POST /logout                    Oturum kapat — redirect

GET  /api/calendar              Dinamik takvim günleri ve etüt verileri — JSON
GET  /api/calendar/weeks        Belirli ayın takvim haftaları — JSON
GET  /api/sessions/panel        Belirli gün+saat için modal içeriği — HTML partial
GET  /api/sessions/:id/details  Etüt detay görünümü — HTML partial
POST /api/sessions              Yeni etüt oluştur — JSON
PUT  /api/sessions/:id          Etüt düzenle — JSON
DELETE /api/sessions/:id        Etüt sil — JSON

GET  /teachers                  Öğretmen yönetim sekmesi — HTML
POST /teachers                  Yeni öğretmen — JSON (AJAX) veya form redirect
PUT  /teachers/:id              Düzenle — JSON
DELETE /teachers/:id            Sil — JSON

GET  /students                  Öğrenci yönetim sekmesi — HTML
POST /students                  Manuel öğrenci ekle — JSON
POST /students/import           Excel + hedef sınıf — JSON (multipart)
PUT  /students/:id              Düzenle — JSON
DELETE /students/:id            Sil — JSON

GET  /api/classes               Sınıf listesi — JSON
POST /api/classes               Yeni sınıf — JSON
PUT  /api/classes/:id           Sınıf adı düzenle — JSON
DELETE /api/classes/:id         Sil — JSON

GET  /pdf/students/all          Toplu PDF — `application/pdf`
GET  /pdf/teachers/all          Toplu PDF — `application/pdf`
GET  /pdf/students/:id          Tekil öğrenci PDF — `application/pdf`
GET  /pdf/teachers/:id          Tekil öğretmen PDF — `application/pdf`
```

---

## 5. Klasör Yapısı

```
src/
  routes/        teachers.js, students.js, classes.js, sessions.js, pdf.js, auth.js
  middleware/    auth.js, errorHandler.js, validate.js, upload.js
  lib/           apiResponse.js, prisma.js, renderPage.js, className.js, resolveTargetClass.js, sessionConflict.js, pdfScheduleData.js
  views/
    partials/    session-panel.ejs, session-form.ejs, table-cell.ejs, theme-toggle.ejs
    pages/       index.ejs, teachers.ejs, students.ejs
    pdf/         student-schedule.ejs, teacher-schedule.ejs
  public/
    css/
      tokens.css     (renk, tipografi, spacing — tema değişkenleri)
      base.css       (reset, layout, navbar, footer)
      components.css (buton, kart, tablo, modal, toast, rozet)
      pages.css      (sayfa özel düzenlemeler)
    js/          theme.js, ui.js, api.js, teachers.js, students.js
  services/      excelImport.js, pdfGenerator.js
  prisma/
    schema.prisma
  config/
    schedule.js  (gün/saat sabitleri)
tests/
  unit/          saf fonksiyon testleri
  integration/   API + veritabanı testleri
  fixtures/      IOG02005 örnek dosya kopyası
```

---

## 6. UI Akışları

> Görsel dil, bileşen standartları ve sayfa düzeni için bkz. **§11 Tasarım ve Görsel Dil**.

**Etüt oluşturma (modal içinde, sayfa yenilenmeden):**
1. Anasayfadaki tabloda bir hücreye tıklanır → ekranın ortasında popup açılır.
2. Popup üstte o gün/saat için mevcut etüt programlarını listeler.
3. "Yeni Etüt Ekle" ile form açılır: önce öğretmen listesi (radio button — tek seçim), ardından öğrenci listesi (checkbox — çoklu seçim).
4. Kaydet → AJAX ile `POST /api/sessions`, popup içeriği yenilenir, sayfa reload olmaz.

**Öğretmen/Öğrenci yönetimi:**
- Ayrı sekmelerde liste, arama (öğrenci için ad, numara veya sınıf), düzenleme ve silme.
- Öğretmenler elle eklenir (sadece isim). Bağlı etüt varsa silinemez.
- Öğrenciler MEBBIS **IOG02005** ile içe aktarılır veya manuel eklenir; her iki yolda da **sınıf zorunludur** (bkz. §10).
- Öğrenci düzenlemede sınıf combobox ile güncellenir.
- Etüt kaydında aynı öğrenci aynı gün+saate ikinci kez atanamaz; form hata mesajı gösterir.

**Koyu / açık tema geçişi (Faz 8):**
1. Tüm sayfalarda üst çubukta (navbar) tema değiştirme butonu bulunur (güneş/ay ikonu veya metin etiketi).
2. Tıklanınca `data-theme="light"` ↔ `data-theme="dark"` arasında geçiş yapılır; renkler CSS değişkenleri (`--bg`, `--text`, `--border` vb.) üzerinden uygulanır.
3. Seçilen tema `localStorage` (`nobelkurs-theme`) ile saklanır; sonraki ziyaretlerde ve sayfa geçişlerinde korunur.
4. Sistem tercihi (`prefers-color-scheme`) ilk ziyarette varsayılan olarak okunabilir; kullanıcı seçimi bunu geçersiz kılar.
5. PDF çıktıları her zaman açık tema ile üretilir (yazdırma okunabilirliği).

---

## 7. Geliştirme Fazları

| Faz | İçerik | Durum |
|---|---|---|
| 0 | Repo kurulumu, Prisma + PostgreSQL, Express+EJS iskeleti, tasarım temeli (§11), test altyapısı (§13), VPS deploy | Tamamlandı |
| 1 | Öğretmen/Öğrenci CRUD + yönetim sekmeleri (§11 liste/kart; öğrencide sınıf sütunu ve düzenleme) | Tamamlandı |
| 2 | Excel içe aktarma — MEBBIS IOG02005 + hedef sınıf seçimi (§11 sürükle-bırak + sınıf combobox) | Tamamlandı |
| 3 | Anasayfa tablo görünümü (§11 program ızgarası — ana vitrin) | Tamamlandı |
| 4 | Hücre tıklama → modal (§11 oturum paneli ve form) | Tamamlandı |
| 5 | Etüt düzenleme/silme (modal üzerinden) | Tamamlandı |
| 6 | PDF export (4 varyant — §11 baskı dostu şablon) | Tamamlandı |
| 7 | Admin login (tek kullanıcı, session+bcrypt), yedekleme, prod deploy (§8) | Tamamlandı |
| 8 | Koyu/açık tema geçişi (§11 renk token'ları, localStorage) | Tamamlandı |
| 9+ | Genişletilebilir modüller (bildirim, raporlama dışa aktarma, vb.) | Kapsam dışı — ileride değerlendirilecek |

---

## 8. Alınan Kararlar (v1)

Aşağıdaki kararlar netleşmiştir ve uygulama buna göre yapılır.

### Program ve iş kuralları

| Konu | Karar |
|---|---|
| Program modeli | Tekrarlayan haftalık şablon (`dayOfWeek` + saat); takvim tarihi veya dönem arşivi yok |
| Öğretmen silme | Bağlı etüt varsa **engelle**; cascade yok |
| Öğrenci çakışması | Aynı gün + aynı saat aralığında ikinci etüde atama **engellenir** |
| Öğrenci sınıfı | Import ve manuel eklemede **zorunlu**; `classId` şemada nullable değil |

### Dağıtım (deploy)

| Konu | Karar |
|---|---|
| Sunucu | Mevcut Contabo VPS (AidatPanel ile aynı makine) |
| İzolasyon | **Ayrı subdomain** (örn. `etut.example.com`) + **ayrı PostgreSQL veritabanı** + **ayrı Node süreci** (PM2) |
| AidatPanel | Kod, session ve veritabanı **paylaşılmaz**; yalnızca VPS ve reverse proxy (nginx/Caddy) ortak |
| TLS | Subdomain için Let's Encrypt sertifikası |

### Yetkilendirme (Faz 7 — prod öncesi bloklayıcı)

| Konu | Karar |
|---|---|
| Model | Tek kullanıcı, tek şifre (bcrypt hash — DB veya güvenli config) |
| Oturum | `express-session`, `httpOnly` cookie, AidatPanel'den **farklı** session secret ve cookie adı |
| Koruma | Login olmadan hiçbir sayfa/API erişilemez |
| Brute-force | Basit rate limit (örn. 5 başarısız deneme / 15 dk) |
| Çoklu kullanıcı | v1 kapsam dışı; ihtiyaç doğarsa ayrı faz |

### PDF ve istemci

| Konu | Karar |
|---|---|
| Puppeteer | Eşzamanlı en fazla **1** PDF işi; ikinci istek kuyruğa alınır veya bekletilir |
| Alpine.js | v1'de **kullanılmaz**; yalnızca vanilla JS |

### Gelecekte değerlendirilebilir (v1 dışı)

- Tüm etüt programını toplu sıfırlama (dönem sonu)
- Çoklu kullanıcı / rol yönetimi

---

## 9. Ertelenmiş Özellikler (Faz 0–8 tamamlandıktan sonra)

Aşağıdaki özellikler **aktif geliştirme kapsamında değildir**. Sistemin çalışması için bloklayıcı değiller; Faz 0–8 tamamlanıp kullanıcı projenin bittiğini açıkça onayladıktan sonra gündeme alınır.

**Öğrenci katılım oranı ve yoklama:**
- Etüt bazında katıldı/katılmadı işaretleme
- Öğrenci listesinde katılım oranı gösterimi (örn. `%75 (6/8)`)
- İstatistiksel özet (atanan / katıldığı / katılmadığı etüt sayıları)
- Yoklama sistemi ve dönem kapsamı henüz netleşmediği için şema, route ve UI tasarımı ertelendi

---

## 10. Excel İçe Aktarma — MEBBIS IOG02005

Öğrenci listesi, MEBBIS (e-Okul) üzerinden alınan **IOG02005 — Şube Listesi (Öğrenci No Sıralı)** raporunun Excel dışa aktarımı ile yüklenir. Tanıma ölçütü **dosya adı değil, içerik yapısıdır** (başlık satırı ve kolon düzeni); MEBBIS farklı dosya adlarıyla (örn. `IOG02005_629.XLS`) indirilebilir.

**Örnek dosya:** `IOG02005_629.XLS` (repo kökünde; yalnızca format referansı — dosya adı değişebilir)

### Dosya özellikleri

| Özellik | Değer |
|---|---|
| Tanıma | 1. satırda `S.No`, `Öğrenci No`, `Adı`, `Soyadı` başlıkları (dosya adından bağımsız) |
| Kaynak | MEBBIS → İlköğretim/Ortaöğretim Öğrenci İşlemleri → Raporlar → IOG02005 |
| Format | `.xls` (Microsoft Excel 97-2003, *Data Only*) |
| Kodlama | Windows Türkçe (`cp1254`) |
| Sayfa | Tek sayfa (`Sheet1`) |
| Başlık satırı | 1. satır (sabit) |
| Veri satırları | 2. satırdan itibaren |
| Alt bilgi | Son satırlarda özet (Kız/Erkek/Toplam öğrenci sayısı) — **içe aktarmaya dahil edilmez** |

### Kolon eşlemesi (0-tabanlı indeks)

| Excel kolonu | Başlık (1. satır) | DB alanı | Zorunlu | Not |
|---|---|---|---|---|
| A (0) | S.No | — | Hayır | Liste sıra numarası; içe aktarılmaz |
| B (1) | Öğrenci No | `studentNumber` | Evet | Upsert anahtarı; string olarak saklanır |
| E (4) | Adı | `firstName` | Evet | Boşluklar trim edilir |
| J (9) | Soyadı | `lastName` | Evet | Boşluklar trim edilir |
| N (13) | Cinsiyeti | — | Hayır | İçe aktarılmaz |
| C, D, F–I, K–M, O | *(boş)* | — | — | MEBBIS layout boşlukları; yok sayılır |

**Dosyada olmayan alan — sınıf:** IOG02005 çıktısında sınıf/şube kolonu yoktur. Tüm içe aktarılan öğrenciler, yükleme formunda seçilen veya o anda girilen **tek bir hedef sınıfa** atanır (`SchoolClass`).

### Sınıf seçimi (içe aktarma öncesi — zorunlu)

İçe aktarma modalında kullanıcı önce hedef sınıfı belirler:

1. **Mevcut sınıf:** Dropdown'dan daha önce oluşturulmuş sınıflardan biri seçilir (`GET /api/classes`).
2. **Yeni sınıf:** Metin alanına ad yazılır (örn. `12-A`). Ad trim edilir; yoksa `SchoolClass` kaydı oluşturulur, varsa mevcut kayıt kullanılır (ad benzersiz).
3. Sınıf seçilmeden dosya yüklenemez; istemci ve sunucu doğrulaması zorunlu.

Aynı öğrenci farklı sınıfla tekrar içe aktarılırsa upsert ile `classId` **yeni hedef sınıfa** güncellenir (ad/soyad ile birlikte).

### İçe aktarma kuralları

1. Dosya uzantısı `.xls` veya `.xlsx` olmalı; MIME tipi ve boyut üst sınırı doğrulanmalı.
2. İstek gövdesinde hedef sınıf zorunlu: `classId` (mevcut) **veya** `className` (yeni/mevcut ad).
3. Dosya adı kontrol edilmez; geçerlilik **içerik yapısına** bakılarak belirlenir.
4. 1. satır başlık olarak okunur; `Öğrenci No`, `Adı`, `Soyadı` kolonları varlığı kontrol edilir — uyuşmazsa anlaşılır hata mesajı döner.
5. Veri satırları işlenirken `Öğrenci No` boş veya sayısal olmayan satırlar atlanır (alt bilgi/özet satırları böyle elenir).
6. `studentNumber` mevcutsa kayıt **güncellenir** (upsert): `firstName`, `lastName`, `classId`. Yoksa **yeni kayıt** oluşturulur.
7. Hatalı satırlar sessizce yutulmaz; işlem sonunda özet rapor döner: eklenen, güncellenen, atlanan satır sayıları, hedef sınıf adı ve varsa hata detayları.
8. Aynı dosyanın tekrar yüklenmesi güvenlidir (idempotent upsert).

### UI akışı (Faz 2)

1. Öğrenci yönetim sekmesinde "Excel'den İçe Aktar" butonu → modal açılır.
2. **Sınıf alanı:** Combobox — üstte kayıtlı sınıflar listesi; altta veya "Yeni sınıf" seçeneğiyle metin girişi.
3. **Dosya alanı:** Sürükle-bırak veya dosya seçici (`.xls`).
4. "İçe Aktar" → `POST /students/import` (multipart: `file` + `classId` veya `className`).
5. Sonuç banner/toast: örn. *"27 öğrenci 12-A sınıfına aktarıldı (5 güncellendi, 22 eklendi)."*

---

## 11. Tasarım ve Görsel Dil

Bu bölüm, sistemi satın alacak kurs müdürünün **ilk izlenim** ve **günlük kullanım** beklentisini tanımlar. Amaç: "kurumsal, modern, pahasına değer" hissi — devlet okul yazılımı veya hazır admin şablonu görünümünden uzak durmak.

### 11.1 Tasarım felsefesi

**Kullanıcı:** Prestijli bir kurs merkezinin müdürü. Teknik detayla uğraşmak istemez; haftalık programı bir bakışta görmek, tek tıkla düzenlemek ve veliye/öğretmene sunacağı çıktıların düzgün görünmesini bekler.

**Temel ilkeler:**

| İlke | Açıklama |
|---|---|
| Netlik önce | Her ekranda tek ana odak; gereksiz panel, sekme veya uyarı yok |
| Sessiz lüks | Gösterişli animasyon yerine tutarlı boşluk, tipografi ve renk dengesi |
| Güven veren işçilik | Hizalı grid, tutarlı buton boyutları, Türkçe karakterlerin kusursuz görünümü |
| Masaüstü öncelikli | Müdür masasında geniş ekranda çalışır; tablet uyumu yeterli, mobil ikincil |
| Sıfır öğrenme stresi | İlk açılışta "ne yapacağım?" sorusuna cevap veren düzen; etiketler günlük Türkçe |

**Kaçınılacaklar:** Bootstrap varsayılan görünümü, küçük puntolar, gri kutular içinde gri kutular, `alert()` / `confirm()` gibi tarayıcı diyalogları, boş beyaz sayfa + ham tablo.

### 11.2 İlk açılış — anasayfa (vitrin ekran)

Müdür sisteme girdiğinde karşılaşması gereken ekran:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo]  Nobel Kurs Merkezi          Program │ Öğretmenler │ Öğrenciler │ PDF ▾ │  [☀ tema] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Haftalık Etüt Programı                    Pazartesi – Pazar (tekrarlayan) │
│   ─────────────────────                                                 │
│                                                                         │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐                               │
│   │ 12 etüt  │ │ 8 öğrt.  │ │ 47 öğr.  │   ← kompakt özet kartları      │
│   │ toplam   │ │ aktif    │ │ kayıtlı  │                               │
│   └──────────┘ └──────────┘ └──────────┘                               │
│                                                                         │
│   ┌────────┬────────┬────────┬────────┬────────┬────────┬────────┐   │
│   │  Pzt   │  Sal   │  Çar   │  Per   │  Cum   │  Cmt   │  Paz   │   │
│   ├────────┼────────┼────────┼────────┼────────┼────────┼────────┤   │
│   │09-10   │        │  ●2    │        │  ●1    │        │        │   │
│   │10-11   │  ●1    │        │  ●3    │        │        │        │   │
│   │  ...   │  ...   │  ...   │  ...   │  ...   │  ...   │  ...   │   │
│   └────────┴────────┴────────┴────────┴────────┴────────┴────────┘   │
│                                                                         │
│   ● = dolu hücre (öğretmen sayısı rozeti); bugünün sütunu vurgulu       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**İlk 3 saniyede müdür şunları hissetmeli:**
1. *"Programım burada, haftanın tamamını görüyorum."*
2. *"Dolu ve boş saatler hemen ayırt ediliyor."*
3. *"Bu yazılım kurumuma yakışır görünüyor."*

**Anasayfa bileşenleri:**
- **Üst çubuk (navbar):** Sol — kurum logosu + adı; orta — ana gezinme (aktif sekme alt çizgi veya dolgu ile belirgin); sağ — PDF menüsü, tema düğmesi, (Faz 7) çıkış.
- **Sayfa başlığı:** "Haftalık Etüt Programı" + alt metin: *Pazartesi – Pazar, tekrarlayan program*; sade, büyük puntolu.
- **Özet şeridi:** 2–3 küçük istatistik kartı (toplam etüt oturumu, aktif öğretmen, kayıtlı öğrenci). Abartılı dashboard değil; programa girmeden önce nabız.
- **Program ızgarası:** Sayfanın ~%70'i; gün sütunları eşit genişlik; saat satırları `config/schedule.js` ile hizalı; **bugünün sütunu** hafif arka plan vurgusu.
- **Hücre durumları:**
  - *Boş:* Açık zemin, ince kenarlık; hover'da hafif gölge + "Tıkla ve ekle" ipucu.
  - *Dolu:* Sol kenarda ince vurgu çizgisi (marka rengi) + öğretmen sayısı rozeti (örn. `2 öğrt.`).
  - *Tıklanabilir:* Tüm hücre imleç:pointer; tıklama anında modal açılır (sayfa titremez).

### 11.3 Renk paleti ve tipografi

**Marka hissi:** Eğitim kurumuna yakışan sıcak-ciddi ton — lacivert (güven) + altın/amber (başarı, prestij) aksan. Aşırı parlak veya neon renk yok.

**Açık tema (varsayılan):**

| Token | Değer (örnek) | Kullanım |
|---|---|---|
| `--color-primary` | `#1e3a5f` | Navbar, başlıklar, birincil buton |
| `--color-accent` | `#c9a227` | Rozet, vurgu çizgisi, aktif sekme |
| `--color-bg` | `#f8f9fb` | Sayfa arka planı |
| `--color-surface` | `#ffffff` | Kart, tablo, modal |
| `--color-text` | `#1a1a2e` | Ana metin |
| `--color-text-muted` | `#6b7280` | İkincil metin, saat etiketleri |
| `--color-border` | `#e5e7eb` | Tablo çizgileri, ayırıcılar |
| `--color-success` | `#059669` | Başarı toast |
| `--color-danger` | `#dc2626` | Silme, hata |

**Koyu tema (Faz 8):** Aynı token isimleri; arka plan koyu lacivert-gri, yüzeyler bir ton açık, metin açık gri — kontrast WCAG AA.

**Tipografi:**
- Birincil font: **Inter** veya **DM Sans** (Google Fonts CDN; Türkçe glif desteği).
- Başlık: 600–700 ağırlık; gövde: 400–500.
- Tablo içi minimum 14px; saat etiketleri 13px muted.
- Başlık hiyerarşisi: sayfa başlığı 1.5–1.75rem; kart başlığı 1rem; gövde 0.9375rem.

**Boşluk:** 4px tabanlı grid (4, 8, 12, 16, 24, 32, 48). Bileşenler arası nefes alanı; sıkışık tablo hissi yok.

**Köşe ve gölge:** `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px`. Gölgeler hafif (`0 1px 3px rgba(0,0,0,.08)`); modal biraz daha belirgin.

### 11.4 Bileşen kiti

Tüm sayfalarda aynı bileşen sınıfları kullanılır (`components.css`):

| Bileşen | Davranış / görünüm |
|---|---|
| **Buton birincil** | Dolu primary renk, beyaz metin, md radius, hover koyulaşma |
| **Buton ikincil** | Çerçeveli, şeffaf zemin |
| **Buton tehlike** | Silme işlemleri; onay modalı ile birlikte |
| **Kart** | Beyaz yüzey, hafif gölge, iç padding 20–24px |
| **Rozet** | Küçük pill; dolu hücre öğretmen sayısı, durum etiketleri |
| **Modal** | Ortalanmış, arka plan karartma (backdrop blur opsiyonel), ESC ile kapanır, odak tuzağı |
| **Toast** | Sağ üst; başarı/hata; 4 sn sonra kaybolur; `alert()` yerine |
| **Onay diyaloğu** | Özel modal; "Emin misiniz?" — tarayıcı `confirm()` yok |
| **Arama kutusu** | Sol ikon, yuvarlatılmış, debounce'lu; placeholder Türkçe |
| **Boş durum** | İkon + kısa metin + birincil aksiyon (örn. "Henüz öğretmen yok — Ekle") |
| **Yükleme** | Buton içi spinner veya tablo iskeleti (skeleton); boş ekran yok |
| **Dosya yükleme** | Kesikli kenarlı sürükle-bırak alanı; Excel ikonu; "MEBBIS listesini buraya bırakın" |
| **Combobox (sınıf)** | Kayıtlı sınıf listesi + yeni sınıf metin girişi; içe aktarma ve öğrenci düzenleme |

### 11.5 Sayfa bazlı tasarım notları

**Öğretmenler / Öğrenciler (Faz 1):**
- Üstte başlık + sağda birincil aksiyon ("Öğretmen Ekle" / "Excel'den İçe Aktar").
- Arama çubuğu hemen altında, tam genişlik değil (~320px) — filtre hissi.
- Liste: zebra değil; satır hover + ince ayırıcı. Satır sonunda düzenle/sil ikon butonları.
- Öğrenci listesinde ad + numara iki satırda (numara muted küçük punt); **sınıf** ayrı sütun veya numara altında muted etiket.
- Öğrenci düzenleme modalında sınıf combobox (içe aktarma ile aynı bileşen).

**Etüt modalı (Faz 4–5):**
- Genişlik ~560–640px; başlık: "Pazartesi · 09:00–10:00".
- Üst bölüm: mevcut etütler kart listesi (öğretmen adı + öğrenci sayısı).
- Alt: "Yeni Etüt Ekle" genişletilebilir bölüm veya sekme.
- Öğretmen seçimi: radyo kartları (isim + seçili kenarlık), checkbox öğrenci listesi kaydırılabilir.
- Kaydet sonrası toast + liste yenilenir; modal açık kalır.

**PDF menüsü (Faz 6):**
- Navbar'da dropdown: "Tüm Öğrenciler", "Tüm Öğretmenler" + ayırıcı.
- İndirme sırasında buton disabled + spinner; hazır olunca dosya iner.

**Giriş ekranı (Faz 7):**
- Minimal: ortada kart, logo, tek şifre alanı, "Giriş Yap".
- Arka plan: hafif gradient veya kurumsal desen — abartısız.

### 11.6 Mikro etkileşimler ve geri bildirim

- Buton/hücre hover: 150ms geçiş (`transition`).
- Modal açılış: hafif scale + fade (200ms).
- Form doğrulama: hatalı alan kırmızı kenarlık + alan altı kısa mesaj.
- Excel import sonucu: özet kart (eklenen / güncellenen / atlanan) toast veya inline banner.
- Silme: her zaman onay modalı; öğretmen adı modal metninde geçer.

### 11.7 Erişilebilirlik ve kalite çubuğu

Faz kapanışlarında §11'e göre gözden geçirilir:

- Klavye ile tüm aksiyonlara erişim (Tab, Enter, ESC).
- Odak halkası görünür (`:focus-visible`).
- Renk kontrastı WCAG AA (açık ve koyu tema).
- Türkçe karakterler tüm fontlarda ve PDF'te doğru.
- 1280px genişlikte program tablosu yatay kaydırma gerektirmeden okunabilir (veya kontrollü yatay scroll, gizli değil).

### 11.8 Uygulama sırası (faz eşlemesi)

| Faz | Tasarım teslimi |
|---|---|
| 0 | `tokens.css`, `base.css`, navbar/footer iskeleti, font yükleme |
| 1 | Liste sayfaları, form modal, arama, boş durum |
| 2 | Dosya yükleme alanı, sınıf combobox, import sonuç banner |
| 3 | Program ızgarası, hücre durumları, özet kartları, bugün vurgusu |
| 4–5 | Etüt paneli modal, radyo/checkbox kartları |
| 6 | PDF şablon tipografi (açık tema, kurumsal başlık) |
| 7 | Giriş ekranı |
| 8 | Koyu tema token override'ları |

---

## 12. API Sözleşmesi

Tüm mutasyon ve `/api/*` uç noktaları bu sözleşmeye uyar. İstemci (fetch) isteklerinde `Accept: application/json` gönderilir.

### 12.1 Yanıt türleri

| Tür | Content-Type | Kullanım |
|---|---|---|
| HTML sayfa | `text/html` | `GET /`, `/teachers`, `/students`, `/login` |
| HTML partial | `text/html` | `GET /api/sessions/panel` |
| JSON | `application/json; charset=utf-8` | CRUD, import, hatalar |
| PDF | `application/pdf` | `GET /pdf/*` |

Login (`POST /login`) başarıda **302 redirect** (`/`); AJAX isteğinde hata **JSON** döner.

### 12.2 JSON zarfı (envelope)

**Başarı:**

```json
{
  "ok": true,
  "data": { }
}
```

`message` opsiyoneldir (kullanıcıya gösterilecek kısa Türkçe metin).

**Hata:**

```json
{
  "ok": false,
  "error": {
    "code": "STUDENT_SCHEDULE_CONFLICT",
    "message": "Ali Yılmaz bu saatte başka bir etüde atanmış."
  },
  "details": { }
}
```

- `error.code` — makine okunur, sabit string (aşağıdaki tablo).
- `error.message` — Türkçe, kullanıcıya gösterilir.
- `details` — opsiyonel; alan bazlı doğrulama veya import satır hataları.

### 12.3 HTTP durum kodları

| Kod | Ne zaman |
|---|---|
| `200` | Başarılı GET, PUT, DELETE |
| `201` | Başarılı POST (kayıt oluşturma) |
| `302` | Login başarılı redirect |
| `400` | Geçersiz istek gövdesi, eksik zorunlu alan |
| `401` | Oturum yok (Faz 7+) |
| `404` | Kayıt bulunamadı (`:id` geçersiz) |
| `409` | İş kuralı çakışması (silme engeli, öğrenci çakışması, duplicate sınıf) |
| `422` | Excel formatı geçersiz veya parse edilemedi |
| `429` | Login rate limit aşıldı |
| `500` | Beklenmeyen sunucu hatası (detay istemciye sızmaz) |

### 12.4 Hata kodları (`error.code`)

| Kod | HTTP | Açıklama |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Genel doğrulama; `details.fields` ile alan listesi |
| `UNAUTHORIZED` | 401 | Giriş gerekli |
| `NOT_FOUND` | 404 | Kayıt yok |
| `TEACHER_HAS_SESSIONS` | 409 | Öğretmenin bağlı etütleri var, silinemez |
| `STUDENT_SCHEDULE_CONFLICT` | 409 | Öğrenci aynı gün+saatte başka etütte |
| `CLASS_HAS_STUDENTS` | 409 | Sınıfta öğrenci var, silinemez |
| `DUPLICATE_CLASS_NAME` | 409 | Sınıf adı zaten kayıtlı |
| `CLASS_REQUIRED` | 400 | Sınıf seçilmedi / `classId` eksik |
| `INVALID_EXCEL_FORMAT` | 422 | IOG02005 yapısı tanınmadı |
| `RATE_LIMITED` | 429 | Çok fazla başarısız giriş |
| `INTERNAL_ERROR` | 500 | Genel sunucu hatası |

### 12.5 Örnek istek / yanıtlar

**POST /api/sessions** — gövde:

```json
{
  "dayOfWeek": "MONDAY",
  "startTime": "09:00",
  "endTime": "10:00",
  "teacherId": 3,
  "studentIds": [1, 5, 12]
}
```

Başarı `201`:

```json
{
  "ok": true,
  "data": {
    "id": 42,
    "dayOfWeek": "MONDAY",
    "startTime": "09:00",
    "endTime": "10:00",
    "teacherId": 3,
    "studentIds": [1, 5, 12]
  },
  "message": "Etüt kaydedildi."
}
```

**POST /students/import** — `multipart/form-data`: `file`, `classId` *veya* `className`.

Başarı `200`:

```json
{
  "ok": true,
  "data": {
    "added": 22,
    "updated": 5,
    "skipped": 0,
    "className": "12-A",
    "rowErrors": []
  },
  "message": "27 öğrenci 12-A sınıfına aktarıldı."
}
```

Kısmi sorun (yine `200`, `skipped` > 0):

```json
{
  "ok": true,
  "data": {
    "added": 20,
    "updated": 5,
    "skipped": 2,
    "className": "12-A",
    "rowErrors": [
      { "row": 15, "reason": "Öğrenci numarası boş" }
    ]
  }
}
```

**GET /api/classes** — başarı `200`:

```json
{
  "ok": true,
  "data": {
    "classes": [
      { "id": 1, "name": "12-A", "studentCount": 27 }
    ]
  }
}
```

### 12.6 Uygulama kuralları

- Tüm JSON API route'ları `lib/apiResponse.js` üzerinden yanıt üretir (`res.success()`, `res.fail()`).
- Beklenmeyen hatalar `errorHandler` middleware ile yakalanır; loglanır, istemciye `INTERNAL_ERROR` döner.
- Faz 7 öncesi geliştirmede auth middleware devre dışı bırakılabilir; prod'a çıkmadan önce zorunlu.
- PDF endpoint'leri hata durumunda JSON değil, uygun HTTP kodu + kısa metin veya JSON (Accept başlığına göre) — tercih: PDF isteklerinde hata `400/404` + JSON `{ ok: false, error: ... }`.

---

## 13. Test Stratejisi

Ölçek ve tek kullanıcı profiline uygun, **pragmatik** test planı. Amaç: iş kurallarının ve kritik API'lerin regresyona uğramaması; %100 kapsam hedefi yok.

### 13.1 İlkeler

| İlke | Açıklama |
|---|---|
| Test piramidi | Çok unit, az integration, manuel UI smoke |
| Gerçek iş kuralları önce | Excel parse, çakışma, silme engelleri otomatik testte |
| E2E yok (v1) | Playwright/Cypress kapsam dışı; Puppeteer zaten PDF için var |
| Türkçe fixture | `IOG02005_629.XLS` kopyası `tests/fixtures/` altında |
| Hızlı geri bildirim | `npm test` < 30 sn hedef (integration dahil) |

### 13.2 Araçlar

| Araç | Rol |
|---|---|
| `node:test` | Test koşucu (Node 18+ yerleşik) |
| `node:assert/strict` | Assertion |
| `supertest` | HTTP integration (Express app'e istek) |
| Ayrı test DB | `DATABASE_URL` → `nobelkurs_test`; her integration dosyası öncesi seed/reset |

`package.json` scriptleri (hedef):

```json
{
  "test": "node --test tests/unit/**/*.test.js tests/integration/**/*.test.js",
  "test:unit": "node --test tests/unit/**/*.test.js",
  "test:integration": "node --test tests/integration/**/*.test.js"
}
```

### 13.3 Unit testler (`tests/unit/`)

Saf fonksiyonlar; veritabanı yok.

| Modül | Senaryolar |
|---|---|
| `excelImport` | IOG02005 başlık tanıma; kolon eşleme; özet satır atlama; cp1254 Türkçe karakter; geçersiz dosya → hata |
| `sessionConflict` | Aynı öğrenci aynı gün+saat → çakışma; farklı gün/saat → izin |
| `className` normalize | Trim; boş ad reddi |
| `schedule` | `config/schedule.js` slot listesi tutarlı mı |

### 13.4 Integration testler (`tests/integration/`)

Gerçek PostgreSQL test veritabanı + `supertest`.

| Alan | Senaryolar |
|---|---|
| Öğretmen | Oluştur, bağlı etüt varken sil → `409 TEACHER_HAS_SESSIONS` |
| Öğrenci | Manuel ekle (sınıf zorunlu), sınıfsız → `400 CLASS_REQUIRED` |
| Sınıf | Duplicate ad → `409`; öğrencili sınıf sil → `409` |
| Import | Fixture XLS + sınıf → upsert; ikinci import güncelleme; `rowErrors` |
| Etüt | Oluştur; aynı öğrenciyi aynı slota ikinci etüde → `409 STUDENT_SCHEDULE_CONFLICT` |
| Auth (Faz 7) | Oturumsuz `/api/*` → `401`; rate limit → `429` |
| API sözleşmesi | Tüm hata yanıtları `{ ok: false, error: { code, message } }` formatında mı |

### 13.5 Manuel smoke checklist (faz kapanışı)

Otomasyona alınmayan, müdür gözüyle kontrol:

| Faz | Kontrol |
|---|---|
| 3 | Program ızgarası dolu/boş, bugün vurgusu, özet kartları |
| 4–5 | Modal akışı, sayfa yenilenmeden kayıt |
| 6 | PDF Türkçe karakter; yazdırma düzeni |
| 8 | Tema geçişi tüm sayfalarda |

Checklist `NOBELKURS.md` güncellenmez; `AGENTS.md` faz kontrol noktaları ile eşleşir.

### 13.6 Ne test edilmiyor (bilinçli)

- Puppeteer görsel PDF pixel-perfect karşılaştırması
- Tarayıcılar arası UI uyumu
- Yük/stress testi
- AidatPanel yan yana deploy entegrasyonu

### 13.7 Faz eşlemesi

| Faz | Test teslimi |
|---|---|
| 0 | `npm test` altyapısı, boş smoke test geçiyor |
| 1 | Öğretmen/öğrenci/sınıf integration testleri |
| 2 | `excelImport` unit + import integration (fixture) |
| 4–5 | Etüt + çakışma integration |
| 7 | Auth integration |
| 6 | PDF: yalnızca manuel smoke (+ isteğe bağlı “PDF byte döndü mü” integration) |

---

*Son güncelleme: Bu doküman proje ilerledikçe güncellenmelidir.*
