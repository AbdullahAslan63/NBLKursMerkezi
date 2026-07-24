# AGENTS.md — NOBELKURS Proje Ajanı Talimatları

Bu dosya, bu repoda çalışan AI ajanları (Cursor vb.) için davranış protokolünü tanımlar. `NOBELKURS.md` proje durumunun **tek doğruluk kaynağı (source of truth)**'dur; bu dosya ise ajanın o kaynağı nasıl okuyup güncelleyeceğini ve projeyi hangi açılardan sürekli değerlendireceğini tanımlar.

---

## 0. Senkronizasyon Kuralı (En Kritik Kural)

`NOBELKURS.md` ve `AGENTS.md` **her zaman birbirini yansıtmalıdır**:

- Kod tabanında yapısal bir değişiklik olduğunda (yeni route, şema değişikliği, yeni bağımlılık, mimari karar) → **önce `NOBELKURS.md` güncellenir**, sonra bu dosyadaki ilgili değerlendirme notları gözden geçirilir.
- Bir faz tamamlandığında → `NOBELKURS.md`'deki "Durum" sütunu güncellenir **ve** bu dosyanın "Faz Bazlı Kontrol Noktaları" bölümündeki ilgili madde işaretlenir.
- Bir "Açık Konu" netleştiğinde → `NOBELKURS.md`'den kaldırılır, gerekiyorsa şema/route bölümlerine işlenir, bu dosyadaki ilgili risk notu kapatılır.
- Ajan, her önemli görev sonunda şu iki soruyu sorar: *"NOBELKURS.md güncel mi?"* ve *"AGENTS.md'deki değerlendirmeler hâlâ geçerli mi?"* — biri güncellenip diğeri unutulursa senkron bozulur, bu kabul edilemez.
- İki dosya çelişirse `NOBELKURS.md` esas alınır, `AGENTS.md` ona göre düzeltilir.

---

## 1. Ajanın Rolü

Bu ajan sadece kod yazmaz; her oturumda projeyi aşağıdaki **beş farklı mercekten** değerlendirir ve varsa riskleri/önerileri kısaca not düşer (bu dosyanın ilgili bölümüne). Değerlendirme, mevcut kodu okumadan varsayımla yapılmaz.

### 1.1 Mimari Tutarlılık
- Yeni eklenen route/servis, `NOBELKURS.md`'deki klasör yapısı ve route tablosuyla uyumlu mu?
- JSON API yanıtları §12 zarfına (`ok`, `data`, `error.code`) uyuyor mu?
- EJS partial + AJAX yaklaşımından sapma var mı (örn. gereksiz yere tam sayfa reload)?
- Prisma şeması ile gerçek migration'lar senkron mu?

### 1.2 Veri Bütünlüğü
- `StudySession` — öğretmen silme: bağlı etüt varsa engelleniyor mu (§8; cascade yok)?
- `studentNumber` unique kısıtı excel içe aktarmada upsert mantığıyla çelişiyor mu?
- Aynı öğrencinin aynı gün/saat aralığında iki farklı etüde atanması engelleniyor mu (§8)?
- `SchoolClass` silme: öğrencisi olan sınıf engelleniyor mu; öğrenci upsert'te `classId` doğru güncelleniyor mu (Faz 1–2)?
- `Student.classId` zorunlu mu; manuel ekleme ve import'ta sınıfsız kayıt oluşabiliyor mu?

### 1.3 Kullanıcı Deneyimi (Tek Kullanıcı — Müdür)
- Modal akışı gerçekten sayfa yenilemeden mi çalışıyor?
- Hata durumları (örn. excel formatı bozuk, aynı öğretmen adı iki kez girildi) kullanıcıya anlaşılır şekilde mi bildiriliyor?
- PDF üretimi büyük öğrenci sayısında (100+) makul sürede mi tamamlanıyor?
- Tema geçişi tüm sayfalarda tutarlı mı, tercih sayfa yenilemesinde ve oturumlar arası korunuyor mu (Faz 8)?
- Görsel dil §11 ile uyumlu mu: hazır admin şablonu hissi, tarayıcı `alert`/`confirm`, tutarsız spacing veya küçük puntolar var mı?
- Anasayfa ilk izlenim testi: program ızgarası bir bakışta okunuyor mu, dolu/boş hücreler ve bugün vurgusu net mi (Faz 3)?

### 1.4 Güvenlik ve Dayanıklılık
- Excel upload endpoint'i dosya tipi/boyutu doğruluyor mu; yalnızca `.xls`/`.xlsx` kabul ediliyor mu (keyfi dosya yüklemeye açık olmamalı)?
- Admin login eklendiğinde (Faz 7) session/auth katmanı VPS'teki diğer projelerden (AidatPanel) izole mi — ayrı secret, cookie, DB (§8)?
- Puppeteer PDF üretimi eşzamanlı tek iş kuralına uyuyor mu; VPS kaynaklarını tüketiyor mu (§8)?

### 1.5 Genişletilebilirlik
- Yeni bir özellik (bildirim, dışa aktarma vb.) mevcut şemaya kolayca oturur mu, yoksa köklü değişiklik mi gerektirir?
- `config/schedule.js`'teki saat aralıkları değiştiğinde kaç yerin etkilendiği hâlâ sınırlı mı?

### 1.6 Test ve API sözleşmesi
- Yeni iş kuralı için §13'e uygun unit veya integration test eklendi mi?
- Yeni `error.code` §12 tablosuna ve `AGENTS.md` kontrol listesine yansıtıldı mı?
- Faz kapanışında ilgili otomatik testler yeşil mi (`npm test`)?

---

## 2. Faz Bazlı Kontrol Noktaları

`NOBELKURS.md` §7'deki fazlarla birebir eşleşir. Bir faz "Tamamlandı" olarak işaretlenmeden önce ajan aşağıdakileri doğrular:

- [x] **Faz 0:** Prisma migration çalışıyor, `.env` yerel/dev ayrımı net, §11 tasarım iskeleti, `npm test` altyapısı (§13) çalışıyor.
- [x] **Faz 1:** CRUD + §8 iş kuralları; API yanıtları §12 formatında; integration testler yeşil.
- [x] **Faz 2:** §10 import + §12 `rowErrors` formatı; fixture ile integration test yeşil.
- [x] **Faz 3:** Tablo hücreleri dolu/boş durumunu görsel olarak ayırt ediyor mu; dolu hücrede öğretmen sayısı rozeti, bugün sütunu vurgusu ve özet kartları §11'e uygun mu.
- [x] **Faz 4:** Radio + checkbox formu boş gönderimi engelliyor mu; öğrenci aynı gün+saate ikinci etüde atanamıyor mu (§8).
- [x] **Faz 5:** Düzenleme sırasında mevcut öğrenci seçimleri formda önceden işaretli geliyor mu; çakışma kontrolü düzenlemede de çalışıyor mu.
- [x] **Faz 6:** 4 PDF varyantı Türkçe karakterleri doğru render ediyor mu; eşzamanlı tek PDF işi kuralı uygulanıyor mu (§8).
- [x] **Faz 7:** Login olmadan erişim yok; session AidatPanel'den izole; rate limit aktif (§8).
- [x] **Faz 8:** Tema butonu tüm sayfalarda çalışıyor mu, tercih localStorage'da kalıcı mı, PDF çıktıları açık temada mı üretiliyor.

---

## 3. Kod Yazarken Uyulacak Kısa Kurallar

- Yeni bağımlılık eklemeden önce `NOBELKURS.md` §2'deki teknoloji tablosunda karşılığı var mı kontrol et; yoksa hem tabloyu hem bu listeyi güncelle.
- Route eklerken `NOBELKURS.md` §4'teki tabloyu **aynı commit içinde** güncelle — ayrı bırakma.
- JSON API yanıtları `NOBELKURS.md` §12 sözleşmesine uymalı; yeni hata kodu §12 tablosuna eklenir.
- İş kuralı değişikliğinde §13 kapsamındaki testler aynı commit veya hemen sonraki commit'te güncellenir.
- Şema değişikliği yapan her migration, `NOBELKURS.md` §3'teki Prisma bloğuna yansıtılır.
- UI metinleri ve kod içi yorumlar/isimlendirmeler Türkçe olmalı.
- Yeni UI bileşeni eklerken `NOBELKURS.md` §11 bileşen kiti ve token'larına uy; tek seferlik inline stil yazma.
- **Ertelenmiş özellikler:** `NOBELKURS.md` §9'daki maddeler (öğrenci katılım oranı / yoklama) Faz 0–8 tamamlanıp kullanıcı projenin bittiğini açıkça onaylamadan plana veya koda dahil edilmez.

---

## 4. Güncel Risk / Not Listesi

*(Ajan yeni bir risk veya karar tespit ettikçe buraya ekler, çözüldükçe siler. Boş liste = şu an bilinen açık risk yok.)*

*(Şu an bilinen açık risk yok — v1 kararları §8'de netleşti. Prisma tek kaynak: `src/prisma/schema.prisma`; kök `prisma.config.ts` kaldırıldı.)*

---

*Bu dosya `NOBELKURS.md` ile birlikte, her yapısal değişiklikte güncellenir. Biri güncellenip diğeri geride kalırsa, bir sonraki oturumda ilk iş ikisini senkronlamaktır.*
