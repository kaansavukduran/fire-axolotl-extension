# Fire Axolotl Extension · devir kaydı

Hedef: `https://github.com/kaansavukduran/fire-axolotl-extension`, `main`.
Donör: `https://github.com/kaansavukduran/fire-axolotl` @ `2b739252a5ff66bfd870dfbe6a7e8f2b0ae106a2`; bu çalışma donörü değiştirmez.

Kullanıcı tek Firefox eklentisini ve AMO hesabı olmadığı için imzasız geliştirici önizlemesini seçti. Pasted prompt kapsamı [gereksinim tablosunda](docs/REQUIREMENTS.md), eklenti/native sınırları [karşılık tablosunda](docs/PARITY.md) izlenir. İki XPI aynı ürün kimliğinin alternatifleridir; yalnız biri kurulur.

Birleşik uBO motoru, konteynerler, video/ses/erişilebilir iframe kontrolü, çift altyazı, yerel AI çalışma motoru, kelime defteri, dört karakter, Aion Koşusu, sekme yan paneli, isteğe bağlı Dark Reader/QR, görünüm/araç sırası/site tercihleri ve manuel tercih Sync akışı vardır. Donör paftaları değiştirilmeden ve kaynak kayıtlarıyla alınmıştır.

Doğrulama sonuçları ve gerçek Firefox görüntüleri [VALIDATION.md](docs/VALIDATION.md) içindedir. AI model yükleme/çevrimdışı çıkarımı ile çeviri kalitesi ayrı değerlendirilir: CPU Türkçe çeviri kalite kapısı başarısızdır. M2M100 418M ayrıca eklendi; sınırlı İngilizce/Türkçe metin ve çift altyazı testleri geçti. Bu, her dilde veya her video hizmetinde eJOY eşdeğerliği değildir. Model ağırlıkları XPI’ye gömülü değildir; çalışma motoru gömülüdür ve ağırlıklar açık seçimle indirilir/içe aktarılır.

Sonraki işler: M2M100 kalite/değerlendirme kapsamını ve model dağıtımı lisans kaydını genişletmek, gerçek WebGPU/Windows/macOS/Android deneyi, kullanıcı hesabıyla cihazlar arası Sync, ek UI dilleri, hizmete özel altyazı adaptörleri. 0.1.0’dan 0.2.0’a geçici geliştirici yükseltmesi ve veri koruması gerçek Firefox’ta geçti. AMO hesabı ve ayrı Mozilla imzasından sonra normal kalıcı kurulum ve imzalı iki sürümlü güncelleme ayrıca test edilmelidir. Firefox güvenlik bayrakları veya imza denetimi kapatılmaz. Native sekme çubuğu, tarayıcı fontu, telemetri ilkeleri ve DRM garantileri standart WebExtension yetkisi değildir.

Kaynak yedeği `scripts/backup.py` ile temiz commit’ten ZIP, tam ulaşılabilir Git bundle ve SHA-256 makbuzu olarak üretilir; kullanıcı profili, model önbelleği ve anahtarlar alınmaz. Özel Drive hedefi genel kaynakta yayımlanmaz. Yükleme/doğrulama makbuzu ve GitHub sürüm varlıkları teslimde ayrıca doğrulanır; bu dosya tek başına yükleme kanıtı değildir.

Lisanslar ve tam ilgili kaynak dağıtımı: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [INTEGRATION.md](docs/INTEGRATION.md). Ücretsiz dağıtım, üçüncü taraf lisans koşullarını kaldırmaz; hukuki/marka uygunluğu garantisi verilmez.

0.3.0: ±10 saniye altyazı oynatma ayarı eklendi; DOM ve yerel tam ekran izleri aynı kaydırmayı kullanır, dışa aktarma özgün zamanları korur. Aynı tür model yeniden yüklenince eski dil algılama sonucunun veya eski worker olayının yeni oturuma karışması engellendi. Model çeviri kalite sınırları değişmedi.

0.4.0: modelden bağımsız TextTrack altyazı gezinmesi, satır tekrarı ve açık eylemle kelime/cümle kaydı eklendi. Kaynak değişince çalışma metni temizlenir. Dosya altyazıları ve erişilemeyen özel oynatıcılar bu gezinme akışına dâhil değildir.
