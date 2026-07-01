# NOBELKURS

Nobel Kurs Merkezi için web tabanlı etüt planlama ve takip sistemi. Öğretmen/öğrenci ataması, haftalık etüt programı yönetimi ve PDF raporlama sağlar.

## Teknolojiler

- **Backend:** Node.js + Express
- **ORM:** Prisma
- **Veritabanı:** PostgreSQL
- **Template:** EJS (+ AJAX ile çekilen partial'lar)
- **İstemci etkileşimi:** Vanilla JS (fetch) + Alpine.js (opsiyonel)
- **Excel içe aktarma:** exceljs
- **PDF üretimi:** Puppeteer
- **Dosya yükleme:** multer

## Gereksinimler

- Node.js 18+
- PostgreSQL 14+
- npm

## Kurulum

```bash
git clone <repo-url>
cd nobelkurs
npm install
```

### Ortam Değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayıp doldurun:

```env
DATABASE_URL="postgresql://kullanici:sifre@localhost:5432/nobelkurs"
PORT=3000
```

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

```
src/
  routes/        Express route tanımları (teachers, students, sessions, pdf)
  views/         EJS şablonları (pages/, partials/, pdf/)
  services/      Excel içe aktarma, PDF üretimi gibi iş mantığı
  prisma/        schema.prisma ve migration'lar
  config/        Gün/saat gibi sabitler
```

## Dokümantasyon

- [`NOBELKURS.md`](./NOBELKURS.md) — Proje durumunun tek kaynağı: veritabanı şeması, route tablosu, geliştirme fazları, açık kararlar. Proje ilerledikçe güncellenir.
- [`AGENTS.md`](./AGENTS.md) — Bu repoda çalışan AI ajanları (Cursor vb.) için değerlendirme protokolü ve `NOBELKURS.md` ile senkronizasyon kuralları.

> Kod üzerinde çalışmaya başlamadan önce her iki dosyayı da okuyun; proje kararları ve güncel durum orada tutulur.

## Geliştirme Notları

- Kod içi isimlendirme/yorumlar İngilizce, kullanıcı arayüzü metinleri Türkçe.
- Yeni route, şema değişikliği veya bağımlılık eklendiğinde `NOBELKURS.md` **aynı commit içinde** güncellenir.

## Lisans

Özel kullanım — Vefa Yazılım / Nobel Kurs Merkezi.
