# Cihazda yapay zekâ ve çeviri

Eklentinin ortak servisi, aynı anda birini bellekte tutarak üç yerel motor/model seçeneği sunar:

- **Bergamot EN ↔ TR:** varsayılan hızlı İngilizce/Türkçe çeviri. Motor ve yaklaşık **43,8 MB model verisi XPI’nin içindedir**; ilk kullanımda indirme, dosya seçimi veya hesap gerekmez. Deyimlerde ve başka metinlerde hata yapabilir.
- **M2M100 418M:** diğer diller için seçilebilen çeviri modeli. CPU/WASM sürümü ilk kullanımda yaklaşık **640 MB** model verisi indirir veya kullanıcının seçtiği yerel dosyalardan içe aktarılır. Modelin kapsadığı 100 dil seçeneği vardır; kalite dile ve metne göre değişir.
- **Qwen 2.5 1.5B Instruct:** genel metin görevleri ve deneysel çeviri. CPU yaklaşık **1,59 GB**, WebGPU yaklaşık **1,23 GB** model verisi ister. Qwen’in Türkçe çeviri kalite testi başarısızdır; Çeviri için Bergamot veya M2M100 denenebilir; ikisi de hatasız değildir.

Bergamot’un çalışma kodu, WASM’ı ve EN↔TR model ağırlıkları XPI’ye gömülüdür. **Qwen/M2M100 ağırlıkları ayrıca alınır**. İndirme kullanıcı düğmesine basınca başlar. Her dosyanın sabit revizyonu, boyutu ve SHA-256 özeti doğrulanır; tamamlanan dosyalar modelin ayrı yerel önbelleğinde saklanır. Çıkarım sırasında metin bir AI sunucusuna gönderilmez; otomatik uzak çıkarım alternatifi yoktur. `ai/bergamot-model.json`, `ai/model.json` ve `ai/translation-model.json` kaynakları sabitler.

## Kullanım

1. Hızlı metin çevirisi için Aion düğmesi → **Çeviri** → **Cihazda çevir**. Ayrıntılı ekran için **Yapay zekâ** → **Hazır çeviriyi aç**; **Buradan başla** kılavuzundaki **Çeviriyi başlat** düğmesi paket motorunu yükler. Video / sayfa çeviri düğmeleri ilgili bölüme yönlendirir.
2. İngilizce/Türkçe için Bergamot ve **Paket içindeki modeli çalıştır** seçeneğini kullan. İlk yerel popup çevirisi de paket motorunu kendisi başlatabilir. Diğer motorlar için M2M100 veya Qwen’i seç; **Modeli indir ve cihazda yükle** düğmesine bas. Kayıtlı model için **İndirmeden yerel modeli yükle** yeterlidir. İndirmenin çalışmadığı ortamlarda doğrulanmış model dosyalarını **Çevrimdışı model dosyaları** altında seçebilirsin.
3. Kaynak ve hedef dili seç, metni gir ve **Yerel modelle çevir** düğmesine bas. Bergamot/M2M100 otomatik kaynak seçiminde önce video altyazısının dil bilgisini, diğer metinlerde Firefox’un dil algılamasını kullanır. Firefox yeterince emin değilse kaynak dili elle seçmeni ister.
4. Video için sekmeyi seç, videonun altyazısını aç ve **Video altyazı çevirisini aç** anahtarını kullan. Yazı boyutu, font, renk, arka plan, konum ve iki satırın görünürlüğü ayarlanabilir. Yerel VTT/SRT çevirip VTT olarak indirme de vardır.
5. Genel soru için Qwen’i seç ve yükle. Bergamot ve M2M100 çeviri motorlarıdır; genel soru düğmesi Qwen’de kullanılabilir. Bellekten çıkar önbelleği korur, sil yalnız seçili indirilen modelin önbelleğini kaldırır. Paket içindeki modeller ayrı silinmez; devre dışı bırakma/bellekten çıkarma çalışma kaynaklarını bırakır.

Video modu standart HTML TextTrack altyazılarını okur. Bazı YouTube, Netflix veya özel oynatıcılar altyazılarını bu yolla sunmaz. Sesin otomatik yazıya dökülmesi yoktur; gerçek zamanlı çeviri cihaz hızına bağlıdır. Netflix çözünürlüğü veya her hizmette altyazı desteği garanti edilmez. Firefox arayüzü ve kendi dil paketleri ayrı yönetilir; 100 çeviri dili, eklenti arayüzünün 100 dilde çevrildiği anlamına gelmez.

Bergamot ve M2M100 CPU, Qwen CPU/WebGPU destekler. Qwen WebGPU yolu Firefox/platform desteği ve `shader-f16` gerektirir; bu yol henüz donanımda doğrulanmadı. Büyük modeller için kullanılabilir bellek ve disk alanı gerekir. Firefox güvenlik ve imza kontrolleri kapatılmaz.

## Altyazı zamanını düzeltme

Yapay zekâ ve altyazı ekranındaki **Altyazı zaman ayarı** iki satırı birlikte −10 ile +10 saniye arasında kaydırır. Artı değer geciktirir, eksi değer erkene alır. **Altyazı zamanını sıfırla** sıfıra döndürür. Ayar hem sayfa katmanı hem video tam ekranında uygulanır; dosyadan gelen veya çeviriyle indirilen VTT zamanları değiştirilmez. Tercih genel eklenti ayarıdır; farklı videoda gerekirse sıfırla.

## Kalite sınırı ve alternatif deneme

`I was about to give up.` örneğinde M2M100 `Ben vazgeçmeye hazırım.` üretti; bu çıktı geçmiş zaman anlamını doğru korumaz. Bu cümlede sonuç hatalıdır. Üç basit testin geçmesi bütün dil yönleri veya cümleler için kalite güvencesi değildir. İkinci bir İngilizce→Türkçe seçenek olarak CC-BY-4.0 bildiren `onnx-community/opus-mt-tc-big-en-tr` (`ce128ea834a090aca240e4e113e7756e06cc78e0`) araştırıldı; mevcut Transformers.js ortamında tokenizer uyarısı ve anlamsız sonuç verdi. Bu model eklentiye eklenmedi.

## Geliştirme

```sh
npm ci --ignore-scripts
npm run build:ai
python3 scripts/fetch_model.py --model m2m --backend wasm
python3 scripts/fetch_test_runtime.py
python3 scripts/package_extension.py
AION_TRANSLATION_MODEL_DIR="$PWD/work/translation-model" \\
AION_FIREFOX_BINARY="$PWD/work/test-runtime/firefox/firefox/firefox" \\
AION_GECKODRIVER="$PWD/work/test-runtime/geckodriver/geckodriver" \\
.venv/bin/python tests/m2m_e2e.py
```

Test, gerçek model dosyalarını arayüzden alır, hash doğrular, Firefox ağını kapatır ve çeviriyi/video zaman damgalarını sınar. `AION_TEST_MODEL_DOWNLOAD=1` indir düğmesini ayrıca sınar. Bu görevdeki yönetilen ortamda Firefox’un dış ağı için sağlanan proxy ve CA’nın geçici test profiline eklenmesi gerekmiştir; `AION_USE_TEST_PROXY=1` yalnız bu test profilinde bunu yapar, TLS doğrulamasını kapatmaz. Üretim eklentisi kullanıcının Firefox ağ ayarlarını değiştirmez.

Genel AI işleri yalnızca izin verilen eklenti sayfalarından ortak `localAI` servisini kullanır. 0.9.0 altyazı kartı ayrıca, yalnız açık katmandaki kaynak kelimeler için belge/sekme/frame ve rastgele token ile sınırlandırılmış yerel çeviri/kayıt yetkisi kullanır. Model ve revizyon, web sayfasından gelen rastgele yola göre seçilmez; bir seferde bir iş çalışır, iptal worker’ı sonlandırır. Genel soru modunun sekme, ağ veya dosya araçları yoktur.

M2M100 temel modelinin kartı MIT bildirir; ONNX dönüşüm deposunun ayrı lisans bildirmediği kaynak kaydında belirtilir. Qwen Apache-2.0’dır. [Üçüncü taraf bildirimleri](../THIRD_PARTY_NOTICES.md) ve [gerçek Firefox sonuçları](VALIDATION.md) ayrıntıları içerir.

## English

Bergamot EN↔TR CPU engine and weights are packaged for offline first use without a download. M2M100 418M is a separately downloaded local CPU model with 100 language choices; Qwen 2.5 1.5B remains available for general prompts. Qwen/M2M weights are separately downloaded/imported, hash checked and cached. Inference is offline. Qwen failed the Turkish translation check; M2M100 passed the small English/Turkish examples documented in the validation report. Caption availability and translation quality vary. Firefox language detection may ask for a manual source language when uncertain.

## Altyazıyla öğrenme · 0.4.0

AI sayfasında videoyu seçip **Altyazıyla öğren** kontrollerini model yüklemeden kullanabilirsin. Önceki/sonraki satır ve tekrar oynatma, videonun okunabilir yerel TextTrack altyazısını ve seçili gecikmeyi kullanır. **O anki satırı al** metni düzenleme alanına getirir; kaydetmeden önce kelimeye kısaltabilir veya cümleyi düzeltebilirsin. En fazla 300 karakter açık kaydetme eylemiyle yerel kelime defterine eklenir. Bu akış metni çeviri sunucusuna göndermez. 0.7.0’dan itibaren dosyadan eklenen özgün altyazı da kaynak listesinden seçilerek gezinme için kullanılabilir. Oynatıcı otomatik oynatmayı engellerse zaman seçilir ve videodan oynatmayı başlatman istenir.


## Sayfa ve web popup metni · 0.6.0

Yerel AI ekranında kaynak/hedef dili ve hedef sekmeyi seç. **Ana belgedeki görüntülenebilir metin** veya **Yalnız açık web diyalogları** alanını seçip **Metni oku ve önizle** düğmesine bas. Önizleme model yüklemeden çalışır; **Önizlenen metni yerelde çevir ve uygula** yüklü ortak modeli kullanır. Kısa metinlerde otomatik dil tespiti kararsızsa kaynak dili elle seç. Aynı taramadaki birebir aynı metin yalnız bir kez modele verilir.

En çok 40 metin parçası / 12.000 karakter ve parça başına 1.000 karakter işlenir. Çok uzun parçalar atlanır; bu tam sayfa ve her sitede eksiksiz çeviri garantisi değildir. Modelin çıktı sınırı ve dil doğruluğu uzun çevirileri sınırlayabilir. Formlar, düzenlenebilir alanlar, kod, görünmeyen metin ve iframe’ler kapsam dışıdır. Web popup kapsamı açık HTML `dialog`, `role=dialog` ve `role=alertdialog` öğeleridir; ayrı pencere olarak açılmış bir web sayfası kendi sekmesi seçilerek çevrilebilir. Firefox’un sistem popup’larına erişilmez.

**Özgün metne geri dön** yalnız eklentinin değiştirdiği ve o zamandan beri site tarafından değiştirilmemiş metni geri yükler. Yeniden tarama önce önceki uygulamayı geri alır. Site değişiklikleri ezilmez; dinamik siteler kendi yeniden çiziminde çeviriyi kaldırabilir. Durdur düğmesi ortak modeli bellekten çıkarır; önbellek ağırlıklarını silmez. Çeviri panelini kapatmak yeni uygulamaları durdurur; uygulanmış metni geri almak için paneli yeniden açıp sekmeyi seçebilirsin veya sayfayı yenileyebilirsin.


## Satır döngüsü ve dosya altyazısıyla öğrenme · 0.7.0

Videoyu seçip **Altyazı kaynaklarını yenile** düğmesine bas. Yerel oynatıcı altyazısını veya popup’tan uygulanmış özgün VTT/SRT için **Aion · yüklenmiş özgün altyazı** kaynağını seç. Oku, önceki/sonraki, tekrar ve kelime kaydet kontrolleri model yüklemeden çalışır. AI ile dosya çevirisinde özgün altyazı ekranda gizlense bile öğrenme kaynağı korunur. Kaynak yalnız ilgili belgededir; kalıcı bir dosya geçmişi oluşturulmaz.

**Bu satırı döngüye al** o anki satırı (satırlar arasındaysa önceki satırı) tekrarlar. Video duraklatılabilir ve kaldığı yerden devam edebilir. **Satır döngüsünü durdur**, satır dışına elle gitmek, kaynak/video değiştirmek veya paneli kapatmak döngüyü sonlandırır. Gecikme ayarı değişince eski zaman aralığındaki döngü durur; yeniden başlatmak yeni gecikmeyi kullanır. Döngü, videonun kendi tamamını tekrarlama tercihini geçici bırakır ve durunca geri yükler. Son satırın bitişi video süresine kırpılır. Native `timeupdate`/`ended` olayları kullanıldığından sınırlar örnek hassasiyetinde ses kesimi değildir.

Dosya kaynağı seçiliyken canlı oynatıcı çevirisi başlamaz; dosya çevirisi kullanılmalıdır. Hatalı seçim mevcut dosya katmanını silmez. Konuşma tanıma, kapalı servis altyazı API’leri veya korumalı Firefox ekranları bu özellik değildir.


## Paket içi çeviri · 0.8.0

Bergamot, Firefox’un ayrıcalıklı native çeviri API’sini kullanmaz; bu tek eklentideki WASM motorudur. Mozilla’nın dağıttığı tiny İngilizce/Türkçe model dosyaları ve lisansları aynen kullanılır. Dosyalar ana eklenti bağlamından okunup worker’a aktarılır; WASM ve her modelin SHA-256’sı doğrulanır. Worker’ın metin işleme aşamasında ağ isteği yapacak yolu yoktur. Bu düzen, Firefox’un çevrimdışı modunda classic worker’dan yapılan paket `fetch` isteğinin başarısız olması sorununu da giderir.

İki dil yönü dışında açık hata verilir; gizlice başka modele veya uzak servise geçilmez. Genel sorular için Qwen seçilip ayrıca yüklenir. Bir modeli durdurma, henüz paket verisi hazırlanırken bile işlemi iptal eder. Yerel metin en fazla 4.000 karakterdir; sınır aşımı modeli başlatmadan açıklanır.

Gerçek çevrimdışı testte `The cat is sleeping.` → `Kedi uyuyor.`, `Please close the door.` → `Lütfen kapıyı kapat.`, `We visited the museum yesterday.` → `Dün müzeyi ziyaret ettik.`, `Merhaba, nasılsın?` → `Hi, how are you?` geçti. **Bilinen hata:** `I was about to give up.` → `- Vermek için çok ilgiliydim.`; deyimin anlamını korumaz. Bu yanlış sonuç kalite geçişi sayılmaz; önemli metinleri kontrol et.

Bergamot için model indirme ortam değişkeni gerekmeden `python3 tests/bergamot_e2e.py` çalıştırılabilir; Firefox/geckodriver yolları önceki örnekteki gibidir. Test ilk model açılmadan önce Firefox ağını kapatır ve gerçek popup/sayfa/video/VTT akışlarını sınar.


## Video üzerinde kelime kartı · 0.9.0

Çift altyazı çevirisi veya popup’tan özgün VTT/SRT katmanı açıkken **Bu satırdan öğren** düğmesine bas. Kart videoyu ve varsa satır döngüsünü durdurur. Kelime düğmelerinden birini ya da **Cümlenin tamamı** seçeneğini seç; kaynak/hedef dili ayarla, **Yerelde çevir** veya **Kelime defterine kaydet** düğmesini kullan. Kartı açmak ya da kelimeyi seçmek tek başına modeli başlatmaz. Bergamot ilk açık çeviride paket içinden çevrimdışı başlar; daha önce yüklenmiş diğer yerel motor da kullanılabilir. Kısa kelimeler için kaynak dili elle seçmek gerekebilir. Bir seferde 300 karaktere kadar çeviri/kayıt yapılır; uzun satırlardaki tek tek kelimeler yine seçilebilir.

Karttaki dil seçimi o karta aittir; AI sayfasındaki kalıcı tercihi değiştirmez. Menü EN/TR ve AI ayarlarında seçilmiş ek kaynak/hedef dili sunar; başka dilleri önce AI ekranından seçebilirsin. Ortak motor başka bir iş yapıyorsa kart meşgul hatası verir; otomatik uzak hizmet/model indirme alternatifi yoktur. Kelime defteri kaynak kelimeyi/cümleyi saklar, model yanıtını otomatik kaydetmez.

**Escape** kartı kapatır ve videoyu duraklatılmış bırakır. **Kapat ve devam et** açıkça oynatmayı başlatır. Altyazıdaki × tüm Aion altyazısını kapatır. AI panelinden durdurma, panel bağlantısının kapanması veya sayfadan ayrılma katmanı temizler; kapanan kartın gecikmiş sonucu yeni karta yazılmaz. Canlı altyazıya yeni satırlar eklenirken açık kart ve odak korunur.

Kart erişilebilir iframe içinde de çalışır. Oynatıcı kapsayıcısının HTML tam ekranında görünür; video öğesinin kendi native tam ekranında Firefox yalnız altyazıyı çizer, etkileşimli kart gösterilemez. Kart için native tam ekrandan çık. Konuşma tanıma veya her hizmette altyazıya erişim bu sürüme eklenmez.


## Kelime defterini yönetme · 0.10.0

Popup’ın çeviri bölümündeki, AI ekranındaki öğrenme bölümündeki veya Ayarlar → Veri bölümündeki **Kelime defteri** düğmesini aç. Kaydedilmiş kelimeler en yeni kayıt önde, sayfa başına 50 metinle gösterilir. Arama mevcut arayüz dilinin büyük/küçük harf kurallarını kullanır. Kelime veya cümle eklemek AI çalıştırmaz. Kayıt en fazla 300 karakterdir; 5.000 kayıt sınırında yeni kayıt reddedilir, mevcut kelimeyi tekrar kaydetmek kopya oluşturmaz. Dolu defter ve uzun metin artık sessizce kırpılmaz veya kaydedilmiş gibi gösterilmez.

**Kaydı sil**, seçili metnin tüm birebir aynı eski tekrarlarını da siler. **Son silmeyi geri al**, başka bir sayfada eklenen kelimeleri koruyarak eski metni ve mümkün olan sırasını geri getirir. Daha sonra aynı metin yeniden eklenmişse kopya oluşturmaz. Geri alma, ekran açıkken son silme içindir; arka plan en son 20 işlemi bellekte tutar ve Firefox yeniden başlatılınca bırakır. Defter arada dolmuşsa geri alma yeni kayıtları silmez; yer açtıktan sonra yeniden deneyebilirsin. Kelime silmek keşif kilometre taşını geri almaz: o gösterge aracı denediğini belirtir, bilgi düzeyini ölçmez.

**Dışa aktar**, yalnız kelimeleri `fire-axolotl-vocabulary.json` dosyasına indirir. **Kelime yedeğini seç** gerçek dosyayı önizler; ilk 5 metin gösterilir. **Önizlenen kayıtları birleştir** mevcut kayıtları korur ve birebir aynı tekrarları atlar. Yanlış biçim/sürüm, geçersiz kayıt veya kapasite aşımında hiçbir kayıt yazılmaz. Dosya en fazla 12 MiB, 5.000 kayıt ve kayıt başına 300 karakter olabilir. Sınır, kaçışlı Unicode içeren geçerli tam yedeğin de tekrar alınabilmesi için ayrı tutulur. Bu dosya genel ayar yedeği değildir; tema, çeviri hizmeti ve taslak değiştirmez. Önizleme kapatılabilir.

Çeviri modülü kapalıyken yeni elle kelime kaydı kapalıdır; mevcut veriye arama, silme/geri alma ve yedekten birleştirme erişimi sürer. Türkçe/English, mevcut tema/font/ölçek ayarlarını kullanır. Dil veya görünüm değişimi açık aramayı ve ekleme taslağını temizlemez. Sayfa kapatılınca kaydedilmemiş form/arama ve son geri alma düğmesi kalıcı saklanmaz; kaydedilen kelimeler korunur.


## Popup, geniş panel ve model başlangıcı · 0.11.0

Aion araç çubuğu düğmesi doğrudan **Çeviri** göreviyle açılır. Model durumu ve kaynak/hedef diller görünürdür. Metni girip **Cihazda çevir** düğmesine basmak, varsayılan paket EN↔TR modelini ilk kez de çevrimdışı başlatır. Harici HTTPS hizmeti isteğe bağlı ayrı ayrıntıdır; varsayılan çevirinin sunucu kurulumuna ihtiyacı yoktur.

Firefox araç çubuğu popup’ı en fazla yaklaşık 800×600 CSS piksel olabilir; eklenti bu doğal sınırı aşmaz. Üstteki **Tam sayfa paneli aç** normal sekmede kalıcı, duyarlı çalışma alanını açar. Başlangıç hedefi uygunsa korunur; **Çalışılan site sekmesi** listesinden de seçilebilir. Seçili metni alma, video kontrolü ve konteynerde açma bu hedefe gider; panelin kendisini hedef almaz. Kapalı veya korumalı sekme yerine yanlış bir siteye sessizce geçilmez. Kaydedilmiş araç sırası ve kapatılmış modüller korunur.

**Yapay zekâ → Hazır çeviriyi aç** başlangıç kılavuzunu açar. **Çeviriyi başlat · indirme gerekmez** paket Bergamot’u yükler ve metin alanına (video/sayfa girişinden gelindiğinde o göreve) götürür. **Qwen 2.5’i aç** ise Qwen seçimini ve Genel soru bölümünü açar; ortak tek motor belleği gerektiğinde bırakılır ama indirme başlamaz. **Modeli indir ve cihazda yükle** ayrıca seçilir. CPU için yaklaşık 1,59 GB, WebGPU için yaklaşık 1,23 GB model verisi gerekir. Qwen’in Türkçe çeviri hatası bu sürümde çözülmez.

**Video altyazısını çevir** ve **Sayfa / popup yazılarını çevir** kaynak sekmeyi AI ekranına taşır. Erişilebilir TextTrack ve gözden geçirilmiş DOM çevirisi sınırları aynen sürer; her serviste altyazı erişimi veya native Firefox arayüzü çevirisi garantisi yoktur.
