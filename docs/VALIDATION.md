# Gerçek Firefox doğrulaması · 2026-11-10

Linux x86_64 üzerinde SHA sabitli, değiştirilmemiş Firefox ESR 153.6.0 ve geckodriver 0.37.1 kullanıldı. Tek geçici eklenti kuruldu; ayrıca uBO veya yardımcı native uygulama kurulmadı. Kişisel profil kullanılmadı. TLS doğrulaması, Firefox sandbox ve imza denetimi kapatılmadı. Geçici kurulum Firefox’un desteklenen geliştirici arayüzüyledir. Selenium dosya seçimi için yalnız ilgili dosya oluşturma otomasyon tercihi kullanılır.

| Denetim | Sonuç |
| --- | --- |
| Node birim/izin/veri doğrulama | 27 geçti |
| Gerçek Firefox ana akış | 40 geçti; [ayrıntı](evidence/firefox-results.json) |
| Firefox yeni sekmesini koruyan alternatif | 2 geçti; [ayrıntı](evidence/native-newtab-results.json) |
| 0.1.0 → 0.2.0 geliştirici yükseltmesi | 2 geçti: ayarlar, taslak, site kuralı, önbellek ve engelleyici filtresi korundu; [ayrıntı](evidence/upgrade-results.json). |
| JS/HTML/yerelleştirme/manifest/vendor hash | Geçti; aynı kilitli girdilerden ikinci XPI üretimi bayt bayt aynı |
| Fontlar ÇçĞğIıİiÖöŞşÜü | Üç yerel fontta geçti |
| web-ext 10.8.0 | 0 hata, 11 uyarı; [rapor](evidence/web-ext-lint.json) |
| npm audit | 0 açık; [rapor](evidence/npm-audit.json); kapsamlı güvenlik garantisi değildir |
| Gerçek M2M100 418M CPU | 7 teknik akış ve 3 sınırlı İngilizce/Türkçe kalite kontrolü geçti; [rapor](evidence/m2m-results.json). Ayrı indirme deneyi de geçti; [rapor](evidence/m2m-download-results.json). |
| Gerçek Qwen 2.5 1.5B CPU · 0.2.0 | 6 teknik kontrol geçti (dosya SHA, yükleme, sayfayı yeniden açma, çevrimdışı genel soru/çeviri çıktısı ve altyazı aktarımı, bellekten çıkarma); [rapor](evidence/qwen-results.json); **Türkçe çeviri kalite kapısı başarısız** |
| WebGPU, Windows/macOS/Android, gerçek hesapla cihazlar arası Sync | Doğrulanmadı |

Ana akışta gerçek engellenen script, konteyner, video/ses/çapraz origin iframe, yerel çift altyazı ve native tam ekran, QR çözme, site rengi/fontu, dört karakter/PNG yedeği, sekme paneli, oyun klavyesi/yerel rekor, ayar yedeği ve blocker resetinden veri koruma doğrulanır. storage.sync deneyi aynı profil alanında bir gidiş/dönüştür; iki cihaz arasında hesap deneyi değildir. Hizmet örnekleri kontrollü yerel fikstürdür; Netflix/YouTube’nun tüm sürümlerinde test anlamına gelmez.

Oyun testinde element.send_keys odak/scroll zamanlaması kararsızdı; odaklı tuvale gerçek ActionChains klavye olayıyla ve güvenli atlayış aralığında daraltılmış bir beklemeyle test düzeltildi. CI’nin önceki denemesinde geniş aralık erken zıplamaya neden olabildi; başarısız koşular Actions geçmişinde korunur. Ayar sayfası işlemleri, arayüz dinleyicilerinin hazır işaretini bekler; HTML’nin görünmesi tek başına etkileşim hazırlığı sayılmaz. Modelin yerel çalışması çeviri kalitesine eşit sayılmaz. “The cat is sleeping.” cümlesinin uint8 Türkçe çıktısı “Ateş.” oldu. Önceki q8 denemesi de başarısızdı. Güvenilir çeviri açık geliştirme işidir; bu önizlemenin tamamlanmış özelliği olarak sayılmaz.

Uyarılar: uBO/Dark Reader’ın korumalı shadow-root API tespiti; uBO’nun no-eval ikame scriptleri; ONNX Emscripten globalThis eski ortam geri dönüşü ve sabit paket yollarından dinamik import; Android veri-izin alanının minimum sürüm farkı. CSP yalnız yerel script/WASM’a izin verir, unsafe-eval açılmaz. Model yolu sayfa mesajından alınmaz. Uyarılar bastırılmadı; bu rapor Mozilla imzası veya AMO onayı değildir.

## Gerçek görüntüler

Aşağıdaki görüntüler Selenium ile gerçek Firefox’tan alındı; tasarım maketi değildir. Yerel altyazı örneğindeki “Merhaba Aion” kullanıcı tarafından sağlanan test VTT metnidir; Qwen’in doğru çevirdiğine kanıt olarak kullanılmaz.

![Aion ve karakter kontrolleri](evidence/character-owl-reading-tr.png)

![Görünüm ve modül ayarları](evidence/settings-en-dark.png)

![Çift yerel altyazı](evidence/video-dual-captions.png)

![Video native tam ekranında iki altyazı](evidence/video-native-fullscreen-captions.png)

![Sekme yan paneli](evidence/tab-sidebar.png)

![Aion Koşusu ve yerel rekor](evidence/offline-runner.png)

Dar ekran/200% örnekleri: [Türkçe ayarlar](evidence/settings-tr-200-narrow.png), [İngilizce karakterler](evidence/characters-en-200-narrow.png). [Yerel QR](evidence/local-qr.png) testte gerçek UTF-8 metne çözüldü.

## Deneysel modelin başarısız kalite örneği

Aşağıdaki gerçek görüntülerde modelin yanlış “Ateş.” çıktısı görülür. Bunlar kaliteli çeviri örnekleri değildir; aynı yerel çıkarımın arayüze ve zaman damgalı katmana ulaştığını gösterir.

![Gerçek model ve başarısız Türkçe çeviri](evidence/qwen-offline-translation.png)

![Yanlış model çıktısının videodaki katmanı](evidence/qwen-live-dual-captions.png)

İsteğe bağlı `Real local AI quality gate` Actions iş akışı gerçek model dosyalarını indirir ve kalite yanlışsa başarısız çıkar; sıradan CI bu büyük indirmeyi yapmaz.

## 0.2.0: M2M100 yerel çeviri

Gerçek 640 MB model önce kullanıcı dosya seçicisiyle, ayrıca eklentinin indirme düğmesiyle yüklendi ve SHA-256 ile doğrulandı. İndirme testi bu yönetilen ortamdaki proxy ve sağlanan CA’yı geçici Firefox profiline kullandı; TLS doğrulaması açık kaldı. Model yüklendikten sonra Firefox ağı kapatıldı. `The cat is sleeping.` → `Kedi uyuyor.`, aynı cümlede otomatik kaynak seçimi ve `Merhaba, nasılsın?` → `Hello, how are you?` geçti. Video örneğinde iki altyazının zamanları eşleşti ve durdurunca eski altyazı geri geldi. Yerel VTT dosyası çevrilip orijinal zamanlarıyla dışa aktarıldı.

**Bilinen kalite hatası:** Kullanıcının örneği `I was about to give up.` → `Ben vazgeçmeye hazırım.` çıktı. Bu sonuç geçmişteki niyet/zaman anlamını korumuyor. Bu yüzden bu örnek güvenilir çeviri sayılmaz. Üç basit kontrol modelin bütün cümlelerde veya 100 dilin tamamında doğru olduğunu göstermez; insan incelemesi gerekir.

![Firefox’ta yerel modelle çift altyazı](evidence/m2m-live-dual-captions.png)

Ağ açılmadan yerel dosyadan içe aktarma ve açık indirme eylemi ayrı denendi. Otomatik kaynak dil tespiti, Firefox güvenilir bulmazsa kaynak dilin kullanıcı tarafından seçilmesini ister. Qwen 0.2.0’da genel soru için de çevrimdışı çıktı üretti; yanıtın kalitesi bu testte derecelendirilmedi. Türkçe kalite kontrolü yine başarısızdı.

Yükseltme deneyi aynı eklenti kimliğiyle doğrulanmış 0.1.0 XPI’sinden 0.2.0 geçici kurulumuna yapılmıştır. Bu, imzalı AMO güncellemesi veya Firefox yeniden başlatılınca kalıcı kurulum testi değildir. Önbellek kontrolünde küçük bir CacheStorage örneği kullanıldı; büyük model dosyasının kendisiyle ayrı yükseltme testi yapılmadı. Test sırasında diğer normal sekme açık tutulmuştur; Firefox eski eklenti sayfasını yükseltirken kapatır.
