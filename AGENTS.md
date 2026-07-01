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
- EJS partial + AJAX yaklaşımından sapma var mı (örn. gereksiz yere tam sayfa reload)?
- Prisma şeması ile gerçek migration'lar senkron mu?

### 1.2 Veri Bütünlüğü
- `StudySession` — `Teacher`/`Student` ilişkilerinde cascade delete davranışı doğru mu (bir öğretmen silinirse bağlı etüt oturumları ne olacak — şu an tanımsız, karar verilmeli)?
- `studentNumber` unique kısıtı excel içe aktarmada upsert mantığıyla çelişiyor mu?
- Aynı öğrencinin aynı gün/saat aralığında iki farklı etüde atanması engelleniyor mu (şu an şemada bu kısıt yok — iş kuralı olarak uygulama katmanında kontrol edilmeli)?

### 1.3 Kullanıcı Deneyimi (Tek Kullanıcı — Müdür)
- Modal akışı gerçekten sayfa yenilemeden mi çalışıyor?
- Hata durumları (örn. excel formatı bozuk, aynı öğretmen adı iki kez girildi) kullanıcıya anlaşılır şekilde mi bildiriliyor?
- PDF üretimi büyük öğrenci sayısında (100+) makul sürede mi tamamlanıyor?

### 1.4 Güvenlik ve Dayanıklılık
- Excel upload endpoint'i dosya tipi/boyutu doğruluyor mu (keyfi dosya yüklemeye açık olmamalı)?
- Admin login eklendiğinde (Faz 7) session/auth katmanı VPS'teki diğer projelerden (AidatPanel) izole mi?
- Puppeteer PDF üretimi VPS kaynaklarını (RAM/CPU) tüketiyor mu, eşzamanlı istek limiti var mı?

### 1.5 Genişletilebilirlik
- Yeni bir özellik (devamsızlık takibi, bildirim vb.) mevcut şemaya kolayca oturur mu, yoksa köklü değişiklik mi gerektirir?
- `config/schedule.js`'teki saat aralıkları değiştiğinde kaç yerin etkilendiği hâlâ sınırlı mı?

---

## 2. Faz Bazlı Kontrol Noktaları

`NOBELKURS.md` §7'deki fazlarla birebir eşleşir. Bir faz "Tamamlandı" olarak işaretlenmeden önce ajan aşağıdakileri doğrular:

- [ ] **Faz 0:** Prisma migration çalışıyor, `.env` VPS'teki gerçek PostgreSQL bağlantısına işaret etmiyor (yerel/dev ayrımı net).
- [ ] **Faz 1:** Öğretmen/Öğrenci CRUD'da arama debounce'lu mı, silme işlemi onay istiyor mu.
- [ ] **Faz 2:** Excel mapping netleşti mi (bkz. NOBELKURS §8), hatalı satırlar sessizce yutulmuyor mu.
- [ ] **Faz 3:** Tablo hücreleri dolu/boş durumunu görsel olarak ayırt ediyor mu (örn. dolu hücrede öğretmen sayısı rozet olarak görünüyor mu).
- [ ] **Faz 4:** Radio (öğretmen) + checkbox (öğrenci) formu boş gönderimi engelliyor mu.
- [ ] **Faz 5:** Düzenleme sırasında mevcut öğrenci seçimleri formda önceden işaretli geliyor mu.
- [ ] **Faz 6:** 4 PDF varyantı da Türkçe karakterleri (ş, ğ, ı, ç, ö, ü) doğru render ediyor mu.
- [ ] **Faz 7:** Login olmadan hiçbir API endpoint'ine erişilemiyor mu.

---

## 3. Kod Yazarken Uyulacak Kısa Kurallar

- Yeni bağımlılık eklemeden önce `NOBELKURS.md` §2'deki teknoloji tablosunda karşılığı var mı kontrol et; yoksa hem tabloyu hem bu listeyi güncelle.
- Route eklerken `NOBELKURS.md` §4'teki tabloyu **aynı commit içinde** güncelle — ayrı bırakma.
- Şema değişikliği yapan her migration, `NOBELKURS.md` §3'teki Prisma bloğuna yansıtılır.
- Türkçe UI metinleri ve kod içi yorumlar/isimlendirme İngilizce kalabilir (mevcut proje konvansiyonuyla tutarlı — AidatPanel'de olduğu gibi kod İngilizce, kullanıcı arayüzü Türkçe).

---

## 4. Güncel Risk / Not Listesi

*(Ajan yeni bir risk veya karar tespit ettikçe buraya ekler, çözüldükçe siler. Boş liste = şu an bilinen açık risk yok.)*

- Öğretmen silme davranışı (cascade mi, engelleme mi) henüz karara bağlanmadı.
- Aynı öğrencinin çakışan saatlerde birden fazla etüde atanmasını engelleyen iş kuralı henüz tanımlanmadı.
- Excel kolon mapping'i bekleniyor (bkz. NOBELKURS §8).

---

*Bu dosya `NOBELKURS.md` ile birlikte, her yapısal değişiklikte güncellenir. Biri güncellenip diğeri geride kalırsa, bir sonraki oturumda ilk iş ikisini senkronlamaktır.*
