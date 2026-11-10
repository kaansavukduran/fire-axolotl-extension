# Fire Axolotl Extension 0.13.1 · Kur, videoyu aç, izle

**[Firefox kurulum ZIP’ini indir](https://github.com/kaansavukduran/fire-axolotl-extension/releases/download/v0.13.1-preview.1/fire-axolotl-extension-0.13.1-firefox-preview.zip)**. ZIP’i çıkar → `about:debugging#/runtime/this-firefox` → **Geçici Eklenti Yükle** → içindeki XPI. Eski önizlemeyi önce silme. Güncelleme sonrası açık video sayfasını yenile.

**Çift altyazı artık otomatik açık gelir. Videoyu açıp izle.** Popup açmak, kutu işaretlemek, sekme veya model seçmek gerekmez. YouTube CC varsa açılır; paketli İngilizce↔Türkçe motoru otomatik başlar. Sonraki videolar otomatik takip edilir; popup kapalıyken de çalışır.

Kapatma sırasında eski açık durumunun kısa süreli geri dönmesine neden olan ayar okuma yarışı da giderildi.

0.13.0’ın kaydedilmiş kapalı varsayılanı ilk geçişte bir kere açılır. Bundan sonra popup’tan kapatırsan seçimin saklanır; yeniden kurulumda veya ayar yedeğini geri yükleyince tekrar açılmaz. Dil, görünüm, kelimeler ve diğer tercihler korunur. Aynı karttan hedef dili ve iki satırın görünürlüğünü değiştirebilirsin.

Okunabilir altyazı gerekir; sesten yazı üretilmez. Her site/oynatıcı veya bütün diller için destek garantisi yoktur. Paket motoru EN↔TR içindir; Qwen/M2M100 ağırlıkları ayrıca seçilerek indirilir. Gerçek Firefox, paket modeli ve yerel HTTPS oynatıcıyla doğrulanır; bu ortamın engellediği kamu YouTube videosunda canlı doğrulama sayılmaz. Çeviri cihazda yapılır; yeni izin veya bulut çıkarımı eklenmez.

Bu paket imzasız geliştirici önizlemesidir. Firefox yeniden başlatılınca yeniden geçici yükleme gerekir; normal kalıcı kurulum Mozilla imzasını bekler. İmza, TLS veya sandbox denetimlerini kapatma. Önceki sürümler korunur; eşleşen kaynaklar, lisans bildirimleri, test kanıtları ve SHA256SUMS aynı Release içindedir.
