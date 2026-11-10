Normal Firefox için tek eklenti: Fire Axolotl donöründen Aion karakterleri ve koşu oyunu, aynı XPI içinde uBO 1.76 motoru, konteynerler, sekme yan paneli, video/ses ve erişilebilir iframe kontrolleri, yerel çift altyazı, görünüm/font/site tercihleri, QR, isteğe bağlı Dark Reader ve manuel tercih Sync.

**İmzasız geliştirici önizlemesi.** Kalıcı normal kurulum için Mozilla imzası henüz yok. İmza denetimini kapatmayın. İki alternatif XPI’den yalnız birini kurun:

- `native-newtab-unsigned.xpi`: mevcut Firefox yeni sekmesini korur; oyun popup düğmesinden açılır (önerilen başlangıç).
- `unsigned.xpi`: yeni sekmeyi Aion araması ve koşu oyunuyla değiştirir.

Kurulum: masaüstü Firefox → `about:debugging#/runtime/this-firefox` → **Geçici Eklenti Yükle** → XPI’yi seç. Firefox kapanınca geçici kurulum kaldırılır.

**Qwen 2.5 1.5B deneysel:** çalışma motoru pakettedir; yaklaşık 1,59 GB CPU model verisi açık seçimle ayrıca indirilir veya yerelden içe aktarılır. SHA-256 doğrulanır; çıkarım çevrimdışıdır. CPU Türkçe çeviri doğruluk testi **başarısızdır**; güvenilir çeviri tamamlanmış değildir. Donanım WebGPU yolu doğrulanmadı. Altyazı erişimi siteye bağlıdır; konuşma tanıma/evrensel Netflix-YouTube desteği veya DRM kalite garantisi yoktur.

Doğrulama: 25 birim testi, 40 gerçek Linux Firefox ana akış kontrolü ve alternatif yeni sekme paketinde 2 kontrol geçti. web-ext: 0 hata/11 incelenmiş uyarı; npm audit: 0 açık. Bu testler AMO onayı, kapsamlı güvenlik denetimi veya Windows/macOS/Android uyumluluk kanıtı değildir. Gerçek Qwen teknik çalıştırma ve başarısız kalite raporu ayrıca sunulur.

[Gerçek Firefox görüntüleri ve sonuçlar](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/VALIDATION.md) · [Özellik sınırları](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/PARITY.md) · [Gizlilik](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/PRIVACY.md)

Ücretsiz ve açık kaynaklı bağımsız dağıtım; Mozilla/uBlock Origin/Dark Reader resmî ürünü değildir. GPL-3.0-or-later ve korunmuş MPL/MIT/Apache/OFL bildirimleri. Aynı commit’in kaynak ZIP’i, uBO tam ilgili kaynak arşivi ve Eigen MPL kaynakları aşağıdadır. GitHub otomatik kaynak arşivleri de entegrasyon kaynağını içerir. Ayrıntılar THIRD_PARTY_NOTICES.md içindedir. SHA256SUMS dosyasını indirilen dosyalarla kontrol edin.
