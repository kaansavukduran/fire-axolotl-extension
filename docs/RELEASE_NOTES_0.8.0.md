0.8.0, **İngilizce↔Türkçe çeviri motorunu ve yaklaşık 44 MB model verisini XPI’nin içine ekler**. Bergamot ilk yerel popup çevirisinde ayrıca indirme/dosya seçimi/hesap gerektirmeden başlayabilir. Aynı motor önizlenen sayfa ve web diyaloglarında, okunabilir çift video altyazısında ve VTT/SRT çevirisinde kullanılır.

İlk kullanımda Firefox ağı baştan kapalıyken tek birleşik eklentiyle popup, iki dil yönü/otomatik kaynak, sayfa-diyalog, canlı ve native tam ekran çift altyazı, gerçek VTT ve bellekten çıkarma doğrulanır. Diğer diller için M2M100, genel sorular için Qwen ayrıca seçilebilir; **bu iki modelin ağırlıkları XPI’de değildir**, açık indirme veya yerel içe aktarma gerekir. Bir seferde bir motor bellekte tutulur; yeni hesap/telemetri/izin eklenmez.

**Kalite sınırı sürüyor:** Bergamot `I was about to give up.` cümlesindeki deyimi yanlış çeviriyor. Qwen Türkçe kalite hatası ve M2M100 zaman/anlam hatası da çözülmedi. Deyimler ve önemli metinler kontrol edilmelidir. Her video hizmetinin altyazısına veya DRM kalitesine erişim garantisi verilmez.

**İmzasız geliştirici önizlemesi.** İki alternatif XPI’den yalnız birini kur. `native-newtab` Firefox’un mevcut yeni sekmesini korur. `about:debugging#/runtime/this-firefox` → Geçici Eklenti Yükle. Kalıcı kurulum/otomatik güncelleme Mozilla imzasını bekliyor.

[Doğrulama ve görüntüler](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/VALIDATION.md) · [Kullanım](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/LOCAL_AI.md) · [Gizlilik](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/PRIVACY.md) · [Lisans ve kaynaklar](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/THIRD_PARTY_NOTICES.md)

Kaynak ZIP’i, tam Bergamot/Mozilla model verisi-kaynak arşivi, uBO/Eigen kaynak arşivleri, makbuzlar ve SHA256SUMS birlikte sunulur. Önceki sürümler korunur. Firefox WebExtension sınırları nedeniyle bütün fork özelliklerinin tamamlandığı iddia edilmez.
