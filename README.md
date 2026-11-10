# Fire Axolotl Extension

Normal Firefox'a kurulan **tek bir eklenti**. Ayrı bir tarayıcı veya ikinci bir reklam engelleme eklentisi gerekmez. Fire Axolotl donör olarak kullanılır; donör depo bu çalışma tarafından değiştirilmez.

**Durum: 0.2.0 imzasız geliştirici önizlemesi. Kalıcı kurulum için henüz Mozilla imzası yok. Bütün Fire Axolotl isteklerinin tamamlandığı veya Firefox motorunun değiştiği iddia edilmez.** [Özellik karşılıkları ve sınırlar](docs/PARITY.md). [Gerçek Firefox sonuçları ve ekran görüntüleri](docs/VALIDATION.md).

## Neler var?

- Aynı XPI içinde uBlock Origin 1.76.0 motoru: ağ ve kozmetik filtreler, filtre listeleri, site istisnaları, öğe seçici, günlük ve gelişmiş panel. İkinci bir eklenti kurulmaz.
- Kalıcı ve son sekmesi kapanınca temizlenen geçici konteynerler.
- Ana belge ve erişilebilen iframe’lerde video/ses hızı 0,25×–4×, site hız tercihi, atanabilir kısayollar, gerçek çözünürlük okuma, deneysel YouTube kalite isteği, yerel VTT/SRT çift altyazı ve video tam ekranında altyazı.
- Aynı pakette yerel yapay zekâ çalışma motoru: çeviri için M2M100 418M, genel metin için Qwen 2.5 1.5B; model verisi ayrıca indirilir veya yerelden içe aktarılır. M2M100 metin ve okunabilir video altyazısı çevirisinde 100 dil seçeneği sunar; kalite dile göre değişir. [Kullanım ve deneysel kalite sınırları](docs/LOCAL_AI.md).
- Açık eylemle HTTPS çeviri hizmeti, seçili metin/altyazı alma, kelime defteri. Çeviri taslağı açılır pencere kapandıktan sonra korunur.
- Sekme yan paneli: arama, etkinleştirme, sabitleme, kapatma, klavyeyle yukarı/aşağı taşıma. `Alt+Shift+A` paneli açar.
- Aion, kuzu, kurt, baykuş; yerel PNG kare dizisi içe aktarma ve karakter yedeği. Animasyon durdurma ve sistemin azaltılmış hareket tercihi.
- Firefox renk teması ve bağımsız Aion görünümü: Türkçe/English, dört tema, %80–%200 arayüz ölçeği, bağımsız yazı boyutu, OpenDyslexic/Lexend, ayar yedeği ve gerçek eylemlere dayalı isteğe bağlı ilerleme.
- Eklenti yeni sekmesi: seçili Firefox motoruyla arama ve çevrimdışı Aion Koşusu. Yerel rekor, başlat/duraklat, Boşluk/dokunma, gizleme.
- İsteğe bağlı, seçili sayfada Dark Reader ve cihazda Türkçe metin destekli QR üretimi. Siteye özel renk/font tercihi isteğe bağlı kaydedilir; geri alınabilir.

## Önizlemeyi Firefox'ta aç

İki alternatif paket vardır; **yalnızca birini** kur:

- `fire-axolotl-extension-0.2.0-native-newtab-unsigned.xpi`: Firefox’un mevcut yeni sekmesini korur. Oyunu eklenti düğmesinden açarsın.
- `fire-axolotl-extension-0.2.0-unsigned.xpi`: yeni sekmeyi Aion araması ve oyunuyla değiştirir. Başka yeni sekme eklentisi varsa etkin sayfayı Firefox yönetir. Oyun gizlenebilir; bu pakette yeni sekme override’ı ayrı bir çalışma anı anahtarıyla kaldırılamaz.

1. [Geliştirici sürümünü](https://github.com/kaansavukduran/fire-axolotl-extension/releases/tag/v0.2.0-preview.1) aç.
2. Mevcut yeni sekmeyi korumak için `fire-axolotl-extension-0.2.0-native-newtab-unsigned.xpi` dosyasını indir. Aion yeni sekmesi için diğer XPI’yi seç.
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

Local M2M100 translation and shared Qwen runtime/model pins are documented in the repository. Weights download separately and are not inside the XPI. Translation quality varies; streaming-site caption access is limited. Qwen failed its Turkish translation quality check.

The combined distribution is GPL-3.0-or-later with retained MPL, MIT, OFL and filter/library notices. Not affiliated with Mozilla, uBlock Origin or Dark Reader. Upstream components retain their own authorship. No guarantee of absolute protection or universal streaming quality is made.

Proje ücretsiz dağıtılır. GPL/MPL gibi açık kaynak lisansları, lisansın izin verdiği ticari yeniden kullanımı yasaklamaz. / Distribution is free; open-source licenses do not prohibit commercial reuse permitted by their terms.
