0.4.0, eklentinin AI/altyazı sayfasına model yüklemeden kullanılabilen **Altyazıyla öğren** kontrolleri ekler: önceki satır, satırı tekrar oynatma, sonraki satır, o anki satırı alma ve düzenlenen kelime/cümleyi yerel deftere kaydetme. Gezinme seçili altyazı gecikmesini dikkate alır. Kaynak video veya altyazı izi değişince çalışma metni temizlenir.

Bu akış videonun erişilebilir TextTrack altyazısına dayanır. Dosyadan eklenen çift altyazı gezinme kaynağı değildir. Her YouTube/Netflix oynatıcısına erişim veya altyazısız sesin yazıya dökülmesi eklenmemiştir. Oynatıcı otomatik oynatmayı engellerse seçilen zamandan oynatmayı kullanıcı başlatır. Çeviri modellerinin bilinen anlam hataları devam eder.

**İmzasız geliştirici önizlemesi.** İki alternatif XPI’den yalnız birini kur. `native-newtab` Firefox’un mevcut yeni sekmesini korur. Kurulum: `about:debugging#/runtime/this-firefox` → Geçici Eklenti Yükle. Kalıcı kurulum ve imzalı otomatik güncelleme Mozilla imzasını bekliyor.

[Gerçek Firefox testleri ve görüntüler](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/VALIDATION.md) · [Lisanslar](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/THIRD_PARTY_NOTICES.md) · [Gizlilik](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/PRIVACY.md)

Model verisi XPI içinde değildir; kullanıcı seçimiyle ayrı indirilir/içe aktarılır. Çalışma motoru pakettedir. Kaynak ZIP’i, ilgili kaynak arşivleri ve SHA256SUMS birlikte sunulur. Önceki sürümler korunur.
