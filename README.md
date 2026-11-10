# Fire Axolotl Extension

Normal Firefox'a kurulan **tek bir eklenti**. Ayrı bir tarayıcı veya ikinci bir reklam engelleme eklentisi gerekmez. Fire Axolotl donör olarak kullanılır; donör depo bu çalışma tarafından değiştirilmez.

**Durum: 0.13.1 imzasız geliştirici önizlemesi. Kalıcı kurulum için henüz Mozilla imzası yok. Bütün Fire Axolotl isteklerinin tamamlandığı veya Firefox motorunun değiştiği iddia edilmez.** [Özellik karşılıkları ve sınırlar](docs/PARITY.md). [Gerçek Firefox sonuçları ve ekran görüntüleri](docs/VALIDATION.md).

## Hızlı başlangıç

- **Metin çevirisi:** Aion araç çubuğu düğmesi → Çeviri → kaynak/hedef dil → metni yaz → **Cihazda çevir**. İngilizce ↔ Türkçe motoru pakettedir; ilk tıklamada çevrimdışı da başlar.
- **Geniş ekran:** popup üstündeki **Tam sayfa paneli aç**. Site sekmesini seç; video, seçili metin ve konteyner işlemleri panel açıkken bu sekmede çalışır. Firefox popup sınırının dışındaki alan normal bir tarayıcı sekmesidir.
- **YouTube / video:** Eklentiyi kur, videoyu aç ve izle. Çift altyazı varsayılan açık; popup açmak, kutu işaretlemek, sekme veya model seçmek gerekmez. YouTube CC varsa otomatik açılır. İngilizce ↔ Türkçe motoru pakettedir ve cihazda çalışır. Aion popup’ından istersen kapatabilir, dil ve satır görünürlüğünü değiştirebilirsin. Okunabilir altyazı gerekir; ses yazıya dökülmez.
- **Qwen:** Yapay zekâ → **Qwen 2.5’i aç** → **Modeli indir ve cihazda yükle** → **Genel soru**. Qwen ağırlıkları ayrıca indirilir (CPU yaklaşık 1,59 GB); hazır çeviriyle aynı şey değildir. Türkçe çeviri kalite sorunu sürer.
- **Konteyner:** sayfa, bağlantı veya sekmeye sağ tık → **Aion · Konteynerde aç** → **İş / Kişisel / oluşturduğun ad**. Yeni sekme ayrı site oturumuyla açılır. **Yeni geçici konteyner** son sekmesi kapanınca temizlenir. Oluştur/yönet seçeneği açıklamalı paneli açar.

## Neler var?

- Aynı XPI içinde uBlock Origin 1.76.0 motoru: ağ ve kozmetik filtreler, filtre listeleri, site istisnaları, öğe seçici, günlük ve gelişmiş panel. İkinci bir eklenti kurulmaz.
- Aion araç çubuğu kimliği, uBO’nun çalışma sırasındaki simge güncellemelerinde de korunur; engelleyici sayaçları devam eder.
- Kalıcı ve son sekmesi kapanınca temizlenen geçici konteynerler.
- Ana belge ve erişilebilen iframe’lerde video/ses hızı 0,25×–4×, site hız tercihi, atanabilir kısayollar, gerçek çözünürlük okuma, deneysel YouTube kalite isteği, yerel VTT/SRT çift altyazı ve video tam ekranında altyazı.
- **İngilizce ↔ Türkçe için motor ve modeller paketin içinde:** Bergamot, ilk kullanımda bile indirme/hesap gerektirmeden cihazda çalışır. Popup, önizlenen sayfa/web diyaloğu, okunabilir çift video altyazısı ve VTT/SRT çevirisi aynı motoru kullanır. Deyimler dahil çeviri hataları olabilir.
- Diğer diller için M2M100 418M (100 dil), genel metin için Qwen 2.5 1.5B ayrıca seçilebilir; bu iki modelin verisi açık indirme eylemiyle alınır veya yerelden içe aktarılır. [Kullanım ve deneysel kalite sınırları](docs/LOCAL_AI.md).
- Yerel modelle ana belge veya açık web diyaloğu çevirisi: önce metin önizlemesi, ardından açık uygula eylemi ve özgün metne geri dönme. Her taramada en fazla 40 parça / 12.000 karakter; site değişiklikleri ezilmez.
- Açık eylemle HTTPS çeviri hizmeti, seçili metin/altyazı alma, kelime defteri. Çeviri taslağı açılır pencere kapandıktan sonra korunur.
- YouTube’un görünen CC metni için hizmet okuyucusu: iki satır, ayrı görünürlük anahtarları, geç sonuç temizliği ve otomatik modda sonraki videoyu takip etme. Her oynatıcı sürümünde veya altyazısız videoda çalışma garantisi değildir.
- Model yüklemeden okunabilir video veya yüklenmiş özgün VTT/SRT altyazısında önceki/sonraki satır, tekrar oynatma, satır döngüsü ve kelime/cümle kaydı. Kaynak seçimi, duraklatma, elle başka zamana atlayınca döngüden çıkma ve panel kapanınca temizleme.
- Video üzerindeki **Bu satırdan öğren** kartı: duraklat, kelime/cümle seç, kaynak/hedef dil seç, yerelde çevir ve kelime defterine kaydet. Escape duraklatılmış bırakır; açık devam düğmesi oynatır. Erişilebilen iframe ve oynatıcı kapsayıcısı tam ekranında çalışır; native video tam ekranı yalnız altyazıyı gösterir.
- **Kelime defteri:** arama, 50 kayıtlık sayfalar, tek metni silme ve son silmeyi geri alma; yalnız kelimeleri içeren JSON yedeğini önizleyip birleştirme. Çeviri kapalıyken veri yönetimi erişilebilir. Dolu defter veya 300 karakteri aşan metin artık kaydedilmiş gibi gösterilmez.
- Altyazı senkronu için −10 / +10 saniye oynatma ayarı; özgün ve çeviri birlikte kayar, VTT dışa aktarma zamanları korunur.
- Yan panelde görünür sekmeleri çoklu seçme, iptal edilebilir toplu kapatma ve isteğe bağlı Firefox oturum izniyle son kapanan sekmeyi geri açma. İzin sonradan kaldırılabilir.
- Sekme yan paneli: arama, etkinleştirme, sabitleme, kapatma, klavyeyle yukarı/aşağı taşıma. `Alt+Shift+A` paneli açar.
- Aion, kuzu, kurt, baykuş; yerel PNG kare dizisi içe aktarma ve karakter yedeği. Animasyon durdurma ve sistemin azaltılmış hareket tercihi.
- Firefox renk teması ve bağımsız Aion görünümü: Türkçe/English, dört tema, %80–%200 arayüz ölçeği, bağımsız yazı boyutu, OpenDyslexic/Lexend, ayar yedeği ve gerçek eylemlere dayalı isteğe bağlı ilerleme.
- Eklenti yeni sekmesi: seçili Firefox motoruyla arama ve çevrimdışı Aion Koşusu. Yerel rekor, başlat/duraklat, Boşluk/dokunma, gizleme.
- İsteğe bağlı, seçili sayfada Dark Reader ve cihazda Türkçe metin destekli QR üretimi. Siteye özel renk/font tercihi isteğe bağlı kaydedilir; geri alınabilir.

## Önizlemeyi Firefox'ta aç

İki alternatif paket vardır; **yalnızca birini** kur:

- `fire-axolotl-extension-0.13.1-native-newtab-unsigned.xpi`: Firefox’un mevcut yeni sekmesini korur. Oyunu eklenti düğmesinden açarsın.
- `fire-axolotl-extension-0.13.1-unsigned.xpi`: yeni sekmeyi Aion araması ve oyunuyla değiştirir. Başka yeni sekme eklentisi varsa etkin sayfayı Firefox yönetir. Oyun gizlenebilir; bu pakette yeni sekme override’ı ayrı bir çalışma anı anahtarıyla kaldırılamaz.

1. [Kurulum ZIP’ini](https://github.com/kaansavukduran/fire-axolotl-extension/releases/download/v0.13.1-preview.1/fire-axolotl-extension-0.13.1-firefox-preview.zip) indir ve bir klasöre çıkar. Bu ZIP mevcut Firefox yeni sekmesini koruyan XPI ve Türkçe/English kurulum metni içerir.
2. Klasördeki `fire-axolotl-extension-0.13.1-native-newtab-unsigned.xpi` dosyasını kullan. Diğer XPI ve kaynak dosyaları [sürüm sayfasındadır](https://github.com/kaansavukduran/fire-axolotl-extension/releases/tag/v0.13.1-preview.1).
3. Masaüstü Firefox'ta adres çubuğuna `about:debugging#/runtime/this-firefox` yaz.
4. **Geçici Eklenti Yükle / Load Temporary Add-on** düğmesine bas, bu XPI'yi seç.
5. Firefox'un eklenti menüsünden **Fire Axolotl Extension** düğmesini aç. Ayarlar, Sekmeler, Engelleme ve Araçlar buradadır. Aion yeni sekmeli pakette yeni sekme açınca oyun görünür; diğer pakette popup içinden açılır.

Geçici yükleme Firefox kapanınca kaldırılır. Normal Firefox imzasız XPI'yi kalıcı kurmaz. İmza denetimini kapatmayın. Mozilla Add-ons imzalama ve dağıtımı tamamlandıktan sonra kalıcı tek tık kurulum ve eklenti güncellemeleri sağlanabilir. Şu an AMO kaydı ve imzalı XPI yoktur. Linux masaüstünde gerçek Firefox ile test edilir; Windows/macOS ve Android ayrıca doğrulanmalıdır. iPhone Firefox masaüstü WebExtensions paketini desteklemez.

## Kaynaktan üret

Node.js 22+, Python 3.12+, Git gerekir. Testler için Linux x86_64 çalışma ortamı kullanılır.

```sh
git clone https://github.com/kaansavukduran/fire-axolotl-extension.git
cd fire-axolotl-extension
npm ci --ignore-scripts
npm run build:ai
npm test
npm run package
npm run check
```

Paketleme, sabit SHA-256 ile doğrulanan donör uBO paketini alır. Özgün Mozilla imzasını kaldırır, kendi kimliğimizle tek manifest ve tek arka plan sayfası üretir. Bu **resmî uBlock Origin eklentisi değildir**; değiştirilmiş bağımsız bir birleşik dağıtımdır. uBO'nun kaynak ve filtre lisansları korunur.

Dağıtımda tam ilgili kaynak arşivini de üret:

```sh
python3 scripts/package_extension.py --with-sources
python3 scripts/package_extension.py --native-newtab
python3 scripts/fetch_ai_support.py
```

XPI `dist/` altında, uBO tam ilgili kaynakları `work/components/*corresponding-source.tar.gz` altında oluşur. SHA-256 dosyası XPI'nin yanındadır. Dağıtım bu arşivi, bu deponun aynı commit'teki kaynaklarını ve bildirimleri birlikte sunmalıdır. Birleşim adımları [INTEGRATION.md](docs/INTEGRATION.md) içindedir.

Gerçek Firefox testleri:

```sh
python3 -m venv .venv
.venv/bin/pip install -r tests/requirements-gecko.txt
python3 scripts/fetch_test_runtime.py
export AION_FIREFOX_BINARY="$PWD/work/test-runtime/firefox/firefox/firefox"
export AION_GECKODRIVER="$PWD/work/test-runtime/geckodriver/geckodriver"
.venv/bin/python tests/gecko_e2e.py
```

Test profilleri kişisel Firefox verilerini kullanmaz. Raporlar `work/test-artifacts/` altındadır. [Gizlilik](PRIVACY.md), [lisanslar](THIRD_PARTY_NOTICES.md), [devir noktası](FORGE.md).

## English

A single independently identified Firefox extension reusing the pinned Fire Axolotl companion and offline game, with the uBlock Origin engine integrated into the same XPI. Includes containers, video/dual captions, explicit endpoint translation, companions, tab sidebar, Aion/Firefox color themes, local QR and optional per-page Dark Reader.

**Unsigned developer preview, not a signed permanent installation or complete parity with the native browser.** Use Firefox `about:debugging` → **Load Temporary Add-on** with the generated XPI. Temporary installation ends when Firefox exits. Permanent installation needs Mozilla signing; do not disable signature verification. Native tab-strip relocation, browser branding/fonts, engine changes, DRM capabilities and native telemetry policies cannot be supplied by a standard extension. See the bilingual [parity matrix](docs/PARITY.md).

Bergamot EN↔TR engine and model weights are inside the XPI. M2M100 and Qwen are separately selected, downloaded/imported models. Translation quality varies; streaming-site caption access is limited. Qwen failed its Turkish translation quality check.

The combined distribution is GPL-3.0-or-later with retained MPL, MIT, OFL and filter/library notices. Not affiliated with Mozilla, uBlock Origin or Dark Reader. Upstream components retain their own authorship. No guarantee of absolute protection or universal streaming quality is made.

Proje ücretsiz dağıtılır. GPL/MPL gibi açık kaynak lisansları, lisansın izin verdiği ticari yeniden kullanımı yasaklamaz. / Distribution is free; open-source licenses do not prohibit commercial reuse permitted by their terms.
