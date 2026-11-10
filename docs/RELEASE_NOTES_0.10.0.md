# Fire Axolotl Extension 0.10.0 · kelime defteri

Popup, AI ekranı ve Ayarlar’dan açılan kelime defteri: Türkçe/English arama, 50 kayıtlık sayfalama, tek metni silme ve son silmeyi geri alma. Başka sayfada eklenen kelimeler korunur. Mevcut kayıt biçimi değişmez.

Yalnız kelimeleri içeren gerçek JSON dosyasını dışa aktar; yeniden içe alırken önce önizle, sonra mevcut kayıtlarla birleştir. Tekrarlar atlanır; geçersiz dosya veya sınır aşımı hiçbir kaydı değiştirmez. Çeviri kapalıyken veri yönetimi kullanılabilir; AI veya bulut çağrısı yapılmaz, yeni izin istenmez.

5.000 kayıt sınırındaki yeni kelimeler ve 300 karakteri aşan metinler artık sessizce kırpılıp başarı göstermez. Hata durumunda taslak/önizleme korunur. Video kartındaki dolu-defter hatası da anlaşılır gösterilir.

**İmzasız geliştirici önizlemesi.** İki XPI’den yalnız birini seç: `native-newtab` Firefox’un mevcut yeni sekmesini korur. `about:debugging#/runtime/this-firefox` → Geçici Eklenti Yükle. Kalıcı kurulum ve otomatik güncelleme Mozilla imzasını bekliyor.

[Doğrulama](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/VALIDATION.md) · [Kullanım](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/LOCAL_AI.md) · [Gizlilik](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/PRIVACY.md)

EN↔TR Bergamot pakettedir. Qwen/M2M100 ağırlıkları ayrıca alınır; Qwen Türkçe ve deyim hataları sürer. Native Firefox/DRM/platform sınırları değişmez. Kaynak ZIP’i, Bergamot/model/uBO/Eigen ilgili kaynak arşivleri, makbuzlar ve SHA256SUMS birlikte sunulur; önceki sürümler korunur.
