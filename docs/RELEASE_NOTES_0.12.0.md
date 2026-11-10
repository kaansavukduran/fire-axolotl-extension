# Fire Axolotl Extension 0.12.0 · Aion simgesi ve YouTube çift altyazı

**[Firefox için kurulum ZIP’ini indir](https://github.com/kaansavukduran/fire-axolotl-extension/releases/download/v0.12.0-preview.1/fire-axolotl-extension-0.12.0-firefox-preview.zip)**. ZIP’i çıkar → Firefox’ta `about:debugging#/runtime/this-firefox` → **Geçici Eklenti Yükle** → içindeki XPI’yi seç. Eski önizlemeyi önce silme. Bu paket mevcut Firefox yeni sekmesini korur. Doğrudan XPI’ye tıklayınca oluşan imzasız kurulum engeline karşı normal dosya indirme yolu sağlar; imza denetimi kapatılmaz.

uBO motorunun çalışma sırasında araç çubuğu simgesini değiştirmesi düzeltildi. Aion simgesi ve Fire Axolotl adı korunur; engelleme motoru, sayaç ve kaynak/lisans bildirimleri aynı pakette kalır.

**YouTube:** videoyu aç → Aion → Video kumandası → **YouTube / çift altyazıyı aç**. Kaynak/hedef dili seç → **Videoda AI çift altyazıyı aç / kapat**. İngilizce↔Türkçe için paket motoru ilk kullanımda başlar. Özgün satır ve çeviri ayrı anahtarlarla gösterilir/gizlenir. Kontrol sekmesini açık tut; video sekmesine dönüp izle. Durdur veya videodaki × ile kapat. Eski kontrol sekmesini kapatmak da çeviriyi durdurur.

Yeni okuyucu YouTube’un görünen CC metnini alır. Native TextTrack gerektirmez; CC uygunsa kullanıcı açışında etkinleştirir. Kaynak dil, oynatıcının mevcut altyazı bilgisinden alınabilir veya elle seçilebilir. Aion iki satırı gösterirken YouTube’un özgün çizimi örtülür; durdurunca geri gelir. Boş/değişmiş satır, geç sonuç, seek, kapatma ve SPA video değişimi eski satırla karışmaz. Firefox’un disabled izlerde `cues=null` davranışı nedeniyle oluşabilecek tekrar birikmesi de önlendi.

**Sınırlar:** altyazı gerekir; ses yazıya dökülmez. DOM kaynağı o anda görünen metindir, tam transkript/VTT veya önceden bütün videonun çevirisi değildir. Gecikme ve kalite cihaz/metne bağlıdır. YouTube’un değişen oynatıcısının bütün sürümleri garanti edilmez. Paylaşılan YouTube videosuna bu geliştirme ortamının proxy’si HTTP 403 verdi. Gerçek Firefox/gerçek paket modeliyle yerel HTTPS YouTube oynatıcı fikstürü sınandı; bu, o canlı videonun geçtiği anlamına gelmez.

Qwen/M2M100 ağırlıkları hâlâ ayrıca indirilir; Qwen Türkçe kalite hatası çözülmüş sayılmaz. Yeni izin, uzak transkript servisi, ses yakalama veya bulut çıkarımı eklenmez.

**İmzasız geliştirici önizlemesi:** Firefox yeniden başlayınca tekrar geçici yükleme gerekir. Kalıcı kurulum ve otomatik kurulum Mozilla imzasını bekler. Önceki Release/etiketler korunur. Aynı sürümde eşleşen kaynak ZIP’i, uBO/Bergamot/model/Eigen ilgili kaynakları, test kanıtları ve SHA256SUMS bulunur.

[Kullanım](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/LOCAL_AI.md) · [Gerçek doğrulama](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/VALIDATION.md) · [Gizlilik](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/PRIVACY.md)
