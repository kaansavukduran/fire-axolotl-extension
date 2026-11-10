0.5.0 yan panelde çoklu sekme seçimi, iptal edilebilir toplu kapatma ve son kapanan sekmeyi geri açma ekler. Filtre değişince seçim temizlenir; yalnız seçilen mevcut pencere sekmeleri kapatılır. Seçim listesi kalıcı olarak saklanmaz.

Geri açma, Firefox’un **isteğe bağlı sessions iznini** yalnız kullanıcı düğmeye basınca ister. Kullanıcı reddedebilir veya daha sonra aynı panelden izni kaldırabilir. Kapanan sekmeler listesi eklenti depolamasına veya sunucuya yazılmaz. Firefox’un kendi oturum API’si kullanılır; silinmiş site verileri veya temizlenmiş geçici konteynerlerin geri geleceği garanti edilmez.

**İmzasız geliştirici önizlemesi.** İki alternatif XPI’den yalnız birini kur. `native-newtab` mevcut Firefox yeni sekmesini korur. `about:debugging#/runtime/this-firefox` → Geçici Eklenti Yükle. Kalıcı kurulum ve imzalı otomatik güncelleme Mozilla imzasını bekliyor.

Önceki AI, çift altyazı, video/ses ve diğer araçlar korunur. Çeviri doğruluğu, özel oynatıcı altyazı erişimi ve platform kapsamı bakımından önceki sınırlar devam eder; bütün isteklerin tamamlandığı iddia edilmez.

[Doğrulama](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/VALIDATION.md) · [Gizlilik](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/PRIVACY.md) · [Lisanslar](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/THIRD_PARTY_NOTICES.md)

Kaynak ZIP’i, ilgili kaynak arşivleri ve SHA256SUMS birlikte sunulur. Model ağırlıkları XPI’de değildir; çalışma kodu ve WASM pakettedir. Önceki sürümler korunur.
