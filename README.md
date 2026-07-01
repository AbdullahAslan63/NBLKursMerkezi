# NOBELKURS

Nobel Kurs Merkezi için web tabanlı etüt planlama ve takip sistemi. Kurs müdürü haftalık etüt programını (gün × saat) tek ekrandan yönetir; öğretmen ve öğrenci ataması yapar; toplu/tekil PDF raporları üretir.

**Kullanıcı profili:** Tek kullanıcı — Nobel Kurs Merkezi Müdürü.

## Proje Durumu

Kod tabanı henüz oluşturulmadı; repo şu an dokümantasyon aşamasında. Tüm geliştirme fazları (Faz 0–7) **Planlandı** durumunda. Ayrıntılı faz tablosu ve açık kararlar için [`NOBELKURS.md`](./NOBELKURS.md) dosyasına bakın.

## Teknolojiler

| Katman | Teknoloji | Not |
|---|---|---|
| Backend | Node.js + Express | |
| ORM | Prisma | |
| Veritabanı | PostgreSQL | |
| Template | EJS | Sayfa iskeleti + AJAX ile çekilen partial'lar |
| İstemci etkileşimi | Vanilla JS (fetch) + Alpine.js (opsiyonel) | Build tooling yok |
| Excel içe aktarma | exceljs | MEB e-Okul formatı |
| PDF üretimi | Puppeteer (HTML→PDF) | Aynı EJS şablonları PDF için de kullanılır |
| Dosya yükleme | multer | Excel upload için |

## Gereksinimler

- Node.js 18+
- PostgreSQL 14+
- npm

## Kurulum

> Faz 0 (repo kurulumu) tamamlandığında aşağıdaki adımlar geçerli olacaktır.

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
```

Uygulama varsayılan olarak `http://localhost:3000` üzerinde çalışır.

## Proje Yapısı

Hedef klasör düzeni ([`NOBELKURS.md` §5](./NOBELKURS.md)):

```
src/
  routes/        teachers.js, students.js, sessions.js, pdf.js
  views/
    partials/    session-panel.ejs, session-form.ejs, table-cell.ejs
    pages/       index.ejs, teachers.ejs, students.ejs
    pdf/         student-schedule.ejs, teacher-schedule.ejs
  services/      excelImport.js, pdfGenerator.js
  prisma/        schema.prisma ve migration'lar
  config/        schedule.js (gün/saat sabitleri)
```

## Dokümantasyon

Üç dosya birlikte çalışır; yapısal değişikliklerde senkron tutulmalıdır:

| Dosya | Rol |
|---|---|
| [`NOBELKURS.md`](./NOBELKURS.md) | **Tek doğruluk kaynağı:** veritabanı şeması, route tablosu, klasör yapısı, geliştirme fazları, açık kararlar |
| [`AGENTS.md`](./AGENTS.md) | AI ajanları (Cursor vb.) için değerlendirme protokolü, faz kontrol noktaları, risk listesi ve `NOBELKURS.md` ile senkronizasyon kuralları |
| `README.md` | Repoya giriş noktası; kurulum ve genel özet |

> Kod veya mimari üzerinde çalışmaya başlamadan önce `NOBELKURS.md` ve `AGENTS.md` dosyalarını okuyun. İki dosya çelişirse `NOBELKURS.md` esas alınır.

### Bilinen açık konular

- Excel kolon mapping'i henüz netleşmedi (bkz. NOBELKURS §8).
- Öğretmen silme davranışı (cascade mi, engelleme mi) karara bağlanmadı.
- Aynı öğrencinin çakışan saatlerde birden fazla etüde atanması henüz engellenmiyor.

## Geliştirme Notları

- Kod içi isimlendirme, yorumlar ve kullanıcı arayüzü metinleri **Türkçe** olmalıdır.
- Yeni route, şema değişikliği veya bağımlılık eklendiğinde `NOBELKURS.md` **aynı commit içinde** güncellenir; ardından `AGENTS.md`'deki ilgili değerlendirme notları gözden geçirilir.
- Bir faz tamamlandığında `NOBELKURS.md`'deki durum sütunu ve `AGENTS.md`'deki faz kontrol listesi birlikte güncellenir.

## Lisans

Özel kullanım — Vefa Yazılım / Nobel Kurs Merkezi.
