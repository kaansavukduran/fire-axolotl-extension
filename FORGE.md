# Fire Axolotl Extension · devir kaydı

Hedef: `https://github.com/kaansavukduran/fire-axolotl-extension`, `main`.
Donör: `https://github.com/kaansavukduran/fire-axolotl` @ `2b739252a5ff66bfd870dfbe6a7e8f2b0ae106a2`; bu çalışma donörü değiştirmez.

Kullanıcı tek Firefox eklentisini ve AMO hesabı olmadığı için imzasız geliştirici önizlemesini seçti. Pasted prompt kapsamı [gereksinim tablosunda](docs/REQUIREMENTS.md), eklenti/native sınırları [karşılık tablosunda](docs/PARITY.md) izlenir. İki XPI aynı ürün kimliğinin alternatifleridir; yalnız biri kurulur.

Birleşik uBO motoru, konteynerler, video/ses/erişilebilir iframe kontrolü, çift altyazı, yerel AI çalışma motoru, kelime defteri, dört karakter, Aion Koşusu, sekme yan paneli, isteğe bağlı Dark Reader/QR, görünüm/araç sırası/site tercihleri ve manuel tercih Sync akışı vardır. Donör paftaları değiştirilmeden ve kaynak kayıtlarıyla alınmıştır.

Doğrulama sonuçları ve gerçek Firefox görüntüleri [VALIDATION.md](docs/VALIDATION.md) içindedir. AI model yükleme/çevrimdışı çıkarımı ile çeviri kalitesi ayrı değerlendirilir: Qwen’in CPU Türkçe çeviri kalite kapısı başarısızdır. M2M100 418M ayrıca eklendi; sınırlı İngilizce/Türkçe metin ve çift altyazı testleri geçti. Bu, her dilde veya her video hizmetinde eJOY eşdeğerliği değildir. Bergamot EN↔TR motoru ve ağırlıkları 0.8.0’dan beri XPI’ye gömülüdür. Qwen/M2M100 ağırlıkları açık seçimle indirilir/içe aktarılır.

Sonraki işler: M2M100 kalite/değerlendirme kapsamını ve model dağıtımı lisans kaydını genişletmek, gerçek WebGPU/Windows/macOS/Android deneyi, kullanıcı hesabıyla cihazlar arası Sync, ek UI dilleri, hizmete özel altyazı adaptörleri. 0.1.0’dan 0.2.0’a geçici geliştirici yükseltmesi ve veri koruması gerçek Firefox’ta geçti. AMO hesabı ve ayrı Mozilla imzasından sonra normal kalıcı kurulum ve imzalı iki sürümlü güncelleme ayrıca test edilmelidir. Firefox güvenlik bayrakları veya imza denetimi kapatılmaz. Native sekme çubuğu, tarayıcı fontu, telemetri ilkeleri ve DRM garantileri standart WebExtension yetkisi değildir.

Kaynak yedeği `scripts/backup.py` ile temiz commit’ten ZIP, tam ulaşılabilir Git bundle ve SHA-256 makbuzu olarak üretilir; kullanıcı profili, model önbelleği ve anahtarlar alınmaz. Özel Drive hedefi genel kaynakta yayımlanmaz. Yükleme/doğrulama makbuzu ve GitHub sürüm varlıkları teslimde ayrıca doğrulanır; bu dosya tek başına yükleme kanıtı değildir.

Lisanslar ve tam ilgili kaynak dağıtımı: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [INTEGRATION.md](docs/INTEGRATION.md). Ücretsiz dağıtım, üçüncü taraf lisans koşullarını kaldırmaz; hukuki/marka uygunluğu garantisi verilmez.

0.3.0: ±10 saniye altyazı oynatma ayarı eklendi; DOM ve yerel tam ekran izleri aynı kaydırmayı kullanır, dışa aktarma özgün zamanları korur. Aynı tür model yeniden yüklenince eski dil algılama sonucunun veya eski worker olayının yeni oturuma karışması engellendi. Model çeviri kalite sınırları değişmedi.

0.4.0: modelden bağımsız TextTrack altyazı gezinmesi, satır tekrarı ve açık eylemle kelime/cümle kaydı eklendi. Kaynak değişince çalışma metni temizlenir. Dosya altyazıları ve erişilemeyen özel oynatıcılar bu gezinme akışına dâhil değildir.

0.5.0: yan panelde geçici çoklu sekme seçimi ve onay/iptal destekli toplu kapatma; isteğe bağlı `sessions` izniyle geri açma ve izin kaldırma. Model çeviri kalitesi ve önceki dağıtım/platform açıkları değişmedi.

0.6.0: ana belge/açık web diyaloğu için önizle → yerel model → metin düğümü uygula → geri al akışı. Form/kod/gizli metin/iframe atlanır; tarama token’ı ve değer karşılaştırması site güncellemelerini korur. `tests/page_translation_e2e.py` DOM sınırlarını sabit metinlerle, `tests/m2m_e2e.py` gerçek modelle ağ kapalı uygulamayı ayrı doğrular.

0.7.0: yerel oynatıcı/özgün VTT-SRT için kaynak seçimi, öğrenme ve satır döngüsü. Sekme başına medya kuyruğu, hata sonrası cleanup, hızlı başlat/durdur, son satır/video bitişi ve panel kapanışı denetlenir. Qwen prompt/native uint8/q4 tanı deneyleri Türkçe hatasını çözmedi; q4 ürüne eklenmez. `docs/evidence/qwen-diagnostics-0.7.json` karşılaştırmanın farklı sistem promptlarını ve dolayısıyla kök nedeni tek başına yalıtmadığını belirtir.

0.7.0 CI hazırlık düzeltmesi: placeholder görünmesi popup hazır demek değildi; ilk CI konteyner adımında durdu. Popup inert/busy başlangıç ve data-ready testi eklendi. Yerel ana 42 akış ve 0.1→0.7 veri korumalı yükseltme yeniden geçti; son commit için CI kapısı beklenir.

0.8.0: varsayılan paket içi Bergamot EN↔TR (6 model dosyası, 43.815.825 bayt) + mevcut ayrı M2M100/Qwen. İlk kullanım çevrimdışı: ana eklenti bağlamında yalnız kendi dosyalarını oku → transferable bytes → worker SHA-256 → C++/WASM. Classic worker’dan `fetch` Firefox offline modunda hata verirken ana bağlamda geçtiği gerçek testle görüldü; kaynak aktarımıyla giderildi, güvenlik tercihleri değiştirilmedi. Paket ~51 MiB; model verisi/sources arşivi artık Bergamot için ayrıca yayımlanır. Beş sınırlı örnek ve altı gerçek UI akışı geçer; `give up` deyimi Bergamot’ta da yanlış kalır. Qwen Türkçe kalite kapısı düzelmiş sayılmaz. AMO/yerel Firefox/servis API sınırları sürer.

0.9.0: video üzerinde kelime kartı, gerçek kullanıcı eylemiyle duraklat/seç/yerel çeviri/kaydet/devam. Katman kaynaklarına bağlı rastgele token + sekme/frame/URL yetkisi dışında content script’lere genel arka plan erişimi verilmez. Canlı eklemelerde kart/odak korunur. Native video tam ekranında kart yoktur; kapsayıcı tam ekranı desteklenir. Yeni izin, uzak çeviri, model indirme veya genel AI yetkisi eklenmez. Qwen ve deyim kalite açıkları sürer.

0.10.0: popup/AI/ayarlar girişli ayrı kelime defteri, Türkçe/English arama, 50 satırlık sayfalama, silme/son silmeyi geri alma ve kelimeye özel JSON önizle/birleştir/yedekle akışı. Tek arka plan sırası güncel kayıt üzerinde çalışır; başka sayfadaki kelimeler ezilmez. Eski string dizisi veri biçimi korunur. Dolu deftere yeni kayıt veya 300 karakteri aşan metin kaydı başarısız olur; sessiz kırpma/başarı yoktur. Yeni izin, AI çağrısı veya bulut aktarımı eklenmez. Deyim/Qwen/AMO/platform açıkları değişmez.

0.10.0 yerel doğrulama: 45 Node testi, kelime defterinde 6 gerçek UI akışı, video kartında 5 (dolu-defter dahil), ana akışta 42 ve 0.1→0.10 geliştirici yükseltmesinde eski kelimeler dahil 2 kontrol geçti. web-ext 0 hata/11 mevcut uyarı. Kod/sürüm bağı `v0.10.0-preview.1` etiketi ve sürüm makbuzuyla korunur; nihai uzak CI/yayın/yedek makbuzları ayrıca doğrulanır. Sonraki öncelikler Qwen/çeviri kalite açığı, ek UI dilleri, servis altyazı adaptörleri ve erişilebilen gerçek platform denemeleridir; AMO/hesap gerektiren işler bekler.

0.10.0 CI düzeltmesi: ilk `b846659` koşusu eski gezinme testinde, oynatma sürerken gecikmiş currentTime örneği dar aralıktan çıktığı için durdu. İki hedef artık gerçek seeking olaylarıyla doğrulanır; uygulama/XPI değişmez. İlk commit ve yedeği korunur; düzeltilmiş kaynak için yeni commit/CI/yedek gerekir.

Seeking olayı düzeltmesi sonrası yerel ana 42 akış yeniden geçti; iki gerçek zaman hedefi denetimi korunur.

0.11.0: kullanıcı popup/AI/konteyner akışlarını bulamadığını bildirdi. Gerçek browserAction popup’ı görev bazlı/tek modüllü geniş yüzey oldu; kaynak sekmeyi taşıyan tam sayfa panel, görünen kaynak/hedef diller ve varsayılan cihaz çevirisi eklendi. AI ekranı adımlı başlangıç, paket motoru için bir başlat düğmesi, model/metin/video/sayfa/genel soru bağlantıları içerir; Qwen bağlantısı indirmeden model kurulumunu açar. Sayfa/link/sekme sağ tık konteyner menüleri aynı pakettedir; mevcut sekme korunur, geçici açma ortak temizleme yordamını kullanır. Kendi menü ağacını günceller, uBO/görsel menülerini silmez. Kaynak tabId yalnız HTTP(S) hedeflerle doğrulanır; kendi UI fragment’leri yeni yetki vermez. Yeni izin/model/veri aktarımı yoktur.

0.12.0: kullanıcı araç çubuğunda uBO simgesini ve YouTube’da altyazı eksikliğini bildirdi. Paketleyici runtime setIcon çağrılarını Aion manifest yollarına yönlendirir; uBO sayaçları/lisansı korunur. YouTube CC DOM okuyucusu, doğrulanmış mevcut dil kodu, açık CC açışı, paket motoru cold start ve aynı video bölümünde kaynak/hedef + iki görünürlük anahtarı eklendi. Kaynak ID/seek/pageKey ile eski sonuç atılır; tek bekleyen iş ve bellekte 100 çeviri sınırı vardır. Video/CC/sekme kapanışı temizleme ve kendi native çizimini geri getirme içerir. Disabled TextTrack.cues null olduğu için önce hidden modda temizlenerek canlı yenilemede native cue birikmesi önlenir. Paylaşılan gerçek YouTube videosuna bu ortamda 403 döndü; yerel HTTPS/gerçek Firefox/gerçek model testi canlı hizmet doğrulaması diye sunulmaz. Geliştirici indirmesi için deterministik ZIP + TR/EN kurulum metni eklendi; imza/TLS/sandbox denetimleri kapatılmaz.

0.12.0 kapanış doğrulaması: uBO onPortConnect sender bilgisini kendi kaydından sonra siliyordu; Aion portu sonradan doğrulanamadığı için arka plan fallback çalışmıyordu. Paketleyici aion-ai-video kanalını motor handler’ından ayırır, Aion’un kimlik/URL doğrulaması korunur. Test kendi pagehide callback’ini engelleyip gerçek arka planın kapatmayı tamamladığını sınar. UI kapatma sırası eski hedefi temizlemeyi bekler ve başarısız cleanup’ta port hedefini erken unutmaz.

0.12.0 ilk CI (42888624394), eski caption_learning testinin ilk döngü başlamadan 1,1 saniyeye seek etmesi yüzünden durdu. Test gerçek captionLooping/ilk satır yanıtını bekler; dışarı seek ve 1,45 saniyeyi geçme şartı korunur. Yerelde altı akış yeniden geçti; XPI/uygulama kodu değişmedi. İlk commit ve özel yedeği korunur, test düzeltmesi yeni commit ve CI ile izlenir.

0.13.0: popup’ta tek otomatik çift altyazı anahtarı; arka plan sahipliği, otomatik video keşfi, sonraki video/SPA takibi ve inline durum. Gelişmiş elle hedefli panel korunur. Yeni mod varsayılan kapalıdır; ilk açık seçimden sonra tercih kalır.
