0.7.0 altyazıyla öğrenmeyi genişletir: oynatıcının altyazısı veya yüklenmiş özgün VTT/SRT seçilebilir; önceki/sonraki satır, tekrar, kelime kaydı ve **satır döngüsü** model yüklemeden çalışır. AI dosya çevirisinde özgün satır ekranda gizlense de öğrenme kaynağı korunur.

Döngü video duraklatılınca bekler; açık durdurma, başka zamana elle gitme, kaynak değiştirme veya AI panelini kapatma ile sonlanır. Son satır video bitişinde de döner ve önceki tam-video döngü tercihi geri yüklenir. Medya komutları sekme başına sıraya alınır; hızlı başlat/durdur ve başarısız işlem sonrası temizleme korunur. Zamanlama native medya olaylarıyla çalışır; ses kesimi örnek hassasiyetinde değildir.

Popup da başlatma tamamlanana kadar etkileşime kapalı tutulur; erken konteyner formu gönderiminin dinleyici bağlanmadan çalışması önlendi.

Qwen için alternatif komutlar ve doğrulanmış q4 biçimi araştırıldı; Türkçe kalite hatası çözülmedi. Bunlar çalışan bir düzeltme gibi pakete alınmadı. M2M100 anlam/zaman hatası da devam eder. Konuşma tanıma ve her video hizmetinde özel altyazı erişimi eklenmedi.

**İmzasız geliştirici önizlemesi.** İki alternatif XPI’den yalnız birini kur. `native-newtab` mevcut Firefox yeni sekmesini korur. `about:debugging#/runtime/this-firefox` → Geçici Eklenti Yükle. Kalıcı kurulum ve imzalı otomatik güncelleme Mozilla imzasını bekliyor. Model çalışma kodu/WASM pakettedir; ağırlıklar ayrıca indirilir veya yerelden içe aktarılır.

[Doğrulama ve görüntüler](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/VALIDATION.md) · [Kullanım](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/docs/LOCAL_AI.md) · [Gizlilik](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/PRIVACY.md) · [Lisanslar](https://github.com/kaansavukduran/fire-axolotl-extension/blob/main/THIRD_PARTY_NOTICES.md)

Kaynak ZIP’i, ilgili üçüncü taraf kaynak arşivleri ve SHA256SUMS birlikte sunulur. Önceki sürümler korunur. Bütün isteklerin tamamlandığı iddia edilmez.
