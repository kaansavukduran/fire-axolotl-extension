# Fire Axolotl Extension 0.13.0 · Tek kutuyla otomatik çift altyazı

**[Firefox kurulum ZIP’ini indir](https://github.com/kaansavukduran/fire-axolotl-extension/releases/download/v0.13.0-preview.1/fire-axolotl-extension-0.13.0-firefox-preview.zip)**. ZIP’i çıkar → `about:debugging#/runtime/this-firefox` → **Geçici Eklenti Yükle** → içindeki XPI. Eski önizlemeyi önce silme; güncelleme sonrası açık video sayfasını yenile.

**Aion simgesi → “Videoları otomatik çift altyazıyla izle” kutusunu işaretle. Bitti; popup’ı kapatıp izle.**

Sekme seçmek, AI kontrol sekmesi açmak veya İngilizce↔Türkçe modelini ayrıca yüklemek gerekmez. Video otomatik bulunur; YouTube CC varsa açılır ve iki satır birlikte gösterilir. Video henüz yoksa kutu açık kalır ve video bekler. Sonraki videolar ve YouTube içi gezinme otomatik izlenir. Hedef dil ve iki satırın ayrı görünürlük anahtarları aynı kartın isteğe bağlı bölümündedir. Kutuyu kaldırmak veya video üzerindeki × durdurup özgün altyazıyı geri getirir.

Popup’ın ilk açılışta bazen 288 px’e daralması da düzeltildi; genişlik tarayıcı penceresine göre belirlenir.

Çeviri eklentinin arka planında cihazda çalışır. İlk açık seçimden sonra tercih korunur; popup kapanınca çalışmaya devam eder. Gelişmiş dosya/elle hedef seçimi araçları korunur. Eski kontrol panelindeki elle başlatılan oturum, kendi sekmesine bağlı kalır.

**Kapsam:** paketli motor İngilizce↔Türkçe içindir. Okunabilir video altyazısı gerekir; sesten yazı üretmez. Her site/oynatıcı desteği veya kusursuz eşzamanlı çeviri garantisi yoktur. YouTube’un görünür CC arayüzü değişirse destek etkilenebilir. Kamu YouTube erişimi bu ortamda 403 ile engellidir; gerçek Firefox, gerçek model, gerçek toolbar popup ve yerel HTTPS oynatıcıyla doğrulanmıştır. Qwen/M2M100 ağırlıkları ayrıca indirilir; bu sürüm Qwen’in Türkçe kalite sorununu çözdüğünü iddia etmez.

**İmzasız geliştirici önizlemesi:** Firefox yeniden başlayınca tekrar geçici yükleme gerekir. Normal kalıcı kurulum Mozilla imzasını bekler. Güvenlik denetimlerini kapatma. Önceki sürümler korunur; ilgili kaynaklar, lisanslar, test kanıtları ve SHA256SUMS aynı Release içindedir.

[Kullanım](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/LOCAL_AI.md) · [Doğrulama](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/VALIDATION.md)
