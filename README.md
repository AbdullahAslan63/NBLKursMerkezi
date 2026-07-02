# NOBELKURS

Nobel Kurs Merkezi için web tabanlı etüt planlama ve takip sistemi. Kurs müdürü haftalık etüt programını (gün × saat) tek ekrandan yönetir; öğretmen ve öğrenci ataması yapar; toplu/tekil PDF raporları üretir. Kurumsal, modern arayüz hedeflenir (bkz. NOBELKURS §11).

**Kullanıcı profili:** Tek kullanıcı — Nobel Kurs Merkezi Müdürü.

## Proje Durumu

**Faz 6 tamamlandı** — 4 PDF varyantı, navbar menüsü ve Puppeteer kuyruğu hazır. Aktif geliştirme: **Faz 7** (admin login). Ayrıntılı faz tablosu için [`NOBELKURS.md`](./NOBELKURS.md) dosyasına bakın.

## Teknolojiler

| Katman | Teknoloji | Not |
|---|---|---|
| Backend | Node.js + Express | |
| ORM | Prisma | |
| Veritabanı | PostgreSQL | |
| Template | EJS | Sayfa iskeleti + AJAX ile çekilen partial'lar |
| İstemci etkileşimi | Vanilla JS (fetch) | Build tooling yok |
| Oturum | express-session + bcrypt | Tek kullanıcı, Faz 7 |
| Excel içe aktarma | xlsx (SheetJS) | MEBBIS IOG02005 `.xls` formatı |
| PDF üretimi | Puppeteer (HTML→PDF) | Eşzamanlı tek iş |
| Dosya yükleme | multer | Excel upload |
| Test | Node.js `node:test` + supertest | bkz. NOBELKURS §13 |

## Gereksinimler

- Node.js 18+
- PostgreSQL 14+
- npm

## Kurulum

```bash
git clone <repo-url>
cd NBLKursMerkezi
npm install
```

### Ortam Değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayıp doldurun:

```env
DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/nobelkurs"
PORT=3000
```

Yerel geliştirme ile VPS üzerindeki üretim veritabanı ayrımı net tutulmalıdır; `.env` dosyası üretim bağlantı bilgilerini içermemelidir.

### Veritabanı

```bash
npx prisma migrate dev
npx prisma generate
```

### Çalıştırma

```bash
npm run dev     # geliştirme (nodemon)
npm start       # prodüksiyon
npm test        # unit + integration testleri
```

Uygulama varsayılan olarak `http://localhost:3000` üzerinde çalışır.

### PDF (Faz 6)

`npm install` sırasında Puppeteer Chrome indirilir. PDF üretimi çalışmıyorsa:

```bash
node node_modules/puppeteer/install.mjs
```

Alternatif olarak `.env` içinde `PUPPETEER_EXECUTABLE_PATH` ile sistem Chrome yolunu belirtin.

## Proje Yapısı

Hedef klasör düzeni ([`NOBELKURS.md` §5](./NOBELKURS.md)):

```
src/
  routes/        index.js, teachers.js, students.js, classes.js, sessions.js, pdf.js, auth.js
  views/
    partials/    session-panel.ejs, session-form.ejs, table-cell.ejs, theme-toggle.ejs, navbar.ejs, footer.ejs
    pages/       index.ejs, teachers.ejs, students.ejs, login.ejs, not-found.ejs
    pdf/         student-schedule.ejs, teacher-schedule.ejs
  services/      excelImport.js, pdfGenerator.js
  middleware/    auth.js, errorHandler.js, validate.js
  lib/           apiResponse.js, prisma.js, renderPage.js
  prisma/        schema.prisma ve migration'lar
  config/        schedule.js
  public/
    css/         tokens.css, base.css, components.css, pages.css
    js/          theme.js, ui.js
tests/           unit/, integration/, fixtures/, helpers/
```

## Dokümantasyon

Üç dosya birlikte çalışır; yapısal değişikliklerde senkron tutulmalıdır:

| Dosya | Rol |
|---|---|
| [`NOBELKURS.md`](./NOBELKURS.md) | **Tek doğruluk kaynağı:** şema, route, fazlar, §12 API sözleşmesi, §13 test stratejisi |
| [`AGENTS.md`](./AGENTS.md) | AI ajanları (Cursor vb.) için değerlendirme protokolü, faz kontrol noktaları, risk listesi ve `NOBELKURS.md` ile senkronizasyon kuralları |
| `README.md` | Repoya giriş noktası; kurulum ve genel özet |

> Kod veya mimari üzerinde çalışmaya başlamadan önce `NOBELKURS.md` ve `AGENTS.md` dosyalarını okuyun. İki dosya çelişirse `NOBELKURS.md` esas alınır.

### Bilinen açık konular

v1 iş kuralları ve deploy kararları netleşti (bkz. NOBELKURS §8). Ertelenmiş: öğrenci katılım oranı / yoklama (§9).

## Geliştirme Notları

- Kod içi isimlendirme, yorumlar ve kullanıcı arayüzü metinleri **Türkçe** olmalıdır.
- Yeni route, şema değişikliği veya bağımlılık eklendiğinde `NOBELKURS.md` **aynı commit içinde** güncellenir; ardından `AGENTS.md`'deki ilgili değerlendirme notları gözden geçirilir.
- Bir faz tamamlandığında `NOBELKURS.md`'deki durum sütunu ve `AGENTS.md`'deki faz kontrol listesi birlikte güncellenir.

## Lisans

Özel kullanım — Vefa Yazılım / Nobel Kurs Merkezi.
