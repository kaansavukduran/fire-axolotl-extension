0.6.0, seçili sayfanın veya açık web diyaloğunun metnini **önce önizleyip sonra yerel modelle çevirerek uygulamayı** ekler. Kaynak/hedef dil seçimi, durdurma ve özgün metne geri dönme aynı AI ekranındadır. Aynı metin bir taramada bir kez çevrilir.

Her tarama en fazla 40 parça / 12.000 karakter, parça başına 1.000 karakterdir. Form alanları, düzenlenebilir alanlar, kod, gizli metin ve iframe’ler atlanır. Site tarafından değiştirilen metinler uygulama ve geri alma sırasında ezilmez. Metinler yalnız bellekte ve seçili yerel modelde işlenir; çeviri sunucusuna veya Sync’e gönderilmez. Firefox sistem popup’ları kapsam dışıdır. Model ve çıktı sınırları, eksiksiz veya hatasız çeviri garantisi vermez.

Güncelleme kontrolü de düzeltildi: GitHub `latest` uç noktasının dışladığı yayımlanmış önizlemeler artık gösterilir; taslaklar gösterilmez. Kontrol kullanıcı düğmeye basınca yapılır ve sürüm bağlantısını açar; otomatik kurulum değildir.

**İmzasız geliştirici önizlemesi.** İki alternatif XPI’den yalnız birini kur. `native-newtab` mevcut Firefox yeni sekmesini korur. `about:debugging#/runtime/this-firefox` → Geçici Eklenti Yükle. Kalıcı kurulum ve imzalı otomatik güncelleme Mozilla imzasını bekliyor.

Model çalışma kodu/WASM pakettedir; model ağırlıkları ayrıca açık indirme eylemiyle alınır veya yerelden içe aktarılır. Qwen Türkçe kalite hatası ve M2M100 anlam/zaman hatası devam ediyor. Bütün Fire Axolotl isteklerinin bittiği iddia edilmez.

[Doğrulama ve ekran görüntüleri](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/VALIDATION.md) · [Gizlilik](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/PRIVACY.md) · [Lisanslar](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/THIRD_PARTY_NOTICES.md)

Kaynak ZIP’i, ilgili üçüncü taraf kaynak arşivleri ve SHA256SUMS pakete eşlik eder. Önceki sürümler korunur.
