# Cihazda yapay zekâ ve çeviri

Eklentinin ortak çalışma motoru iki ayrı yerel modeli destekler:

- **M2M100 418M:** çeviri için varsayılan seçenek. CPU/WASM sürümü ilk kullanımda yaklaşık **640 MB** model verisi indirir veya kullanıcının seçtiği yerel dosyalardan içe aktarılır. Modelin kapsadığı 100 dil seçeneği vardır; kalite dile ve metne göre değişir.
- **Qwen 2.5 1.5B Instruct:** genel metin görevleri ve deneysel çeviri. CPU yaklaşık **1,59 GB**, WebGPU yaklaşık **1,23 GB** model verisi ister. Qwen’in Türkçe çeviri kalite testi başarısızdır; Türkçe çeviride M2M100’ü dene.

Çalışma kodu ve WASM XPI içindedir; **model ağırlıkları XPI’ye gömülü değildir**. İndirme kullanıcı düğmesine basınca başlar. Her dosyanın sabit revizyonu, boyutu ve SHA-256 özeti doğrulanır; tamamlanan dosyalar modelin ayrı yerel önbelleğinde saklanır. Çıkarım sırasında metin bir AI sunucusuna gönderilmez; otomatik uzak çıkarım alternatifi yoktur. `ai/model.json` ve `ai/translation-model.json` kaynakları sabitler.

## Kullanım

1. Eklenti menüsünden **Yerel yapay zekâ ve altyazı** sayfasını aç.
2. M2M100 veya Qwen’i seç; **Modeli indir ve cihazda yükle** düğmesine bas. Kayıtlı model için **İndirmeden yerel modeli yükle** yeterlidir. İndirmenin çalışmadığı ortamlarda doğrulanmış model dosyalarını **Çevrimdışı model dosyaları** altında seçebilirsin.
3. Kaynak ve hedef dili seç, metni gir ve **Yerel modelle çevir** düğmesine bas. M2M100 otomatik kaynak seçiminde önce video altyazısının dil bilgisini, diğer metinlerde Firefox’un dil algılamasını kullanır. Firefox yeterince emin değilse kaynak dili elle seçmeni ister.
4. Video için sekmeyi seç, videonun altyazısını aç ve **Video altyazı çevirisini aç** anahtarını kullan. Yazı boyutu, font, renk, arka plan, konum ve iki satırın görünürlüğü ayarlanabilir. Yerel VTT/SRT çevirip VTT olarak indirme de vardır.
5. Genel soru için Qwen’i seç ve yükle. M2M100 bir çeviri modelidir; genel soru düğmesi Qwen’de kullanılabilir. Bellekten çıkar önbelleği korur, sil yalnız seçili modelin önbelleğini kaldırır.

Video modu standart HTML TextTrack altyazılarını okur. Bazı YouTube, Netflix veya özel oynatıcılar altyazılarını bu yolla sunmaz. Sesin otomatik yazıya dökülmesi yoktur; gerçek zamanlı çeviri cihaz hızına bağlıdır. Netflix çözünürlüğü veya her hizmette altyazı desteği garanti edilmez. Firefox arayüzü ve kendi dil paketleri ayrı yönetilir; 100 çeviri dili, eklenti arayüzünün 100 dilde çevrildiği anlamına gelmez.

M2M100 CPU, Qwen CPU/WebGPU destekler. Qwen WebGPU yolu Firefox/platform desteği ve `shader-f16` gerektirir; bu yol henüz donanımda doğrulanmadı. Büyük modeller için kullanılabilir bellek ve disk alanı gerekir. Firefox güvenlik ve imza kontrolleri kapatılmaz.

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

Yeni özellikler, yalnızca izin verilen eklenti sayfalarından ortak `localAI` servisini kullanır. Model ve revizyon, web sayfasından gelen rastgele yola göre seçilmez; bir seferde bir iş çalışır, iptal worker’ı sonlandırır. Genel soru modunun sekme, ağ veya dosya araçları yoktur.

M2M100 temel modelinin kartı MIT bildirir; ONNX dönüşüm deposunun ayrı lisans bildirmediği kaynak kaydında belirtilir. Qwen Apache-2.0’dır. [Üçüncü taraf bildirimleri](../THIRD_PARTY_NOTICES.md) ve [gerçek Firefox sonuçları](VALIDATION.md) ayrıntıları içerir.

## English

M2M100 418M is a local CPU translation model with 100 language choices; Qwen 2.5 1.5B remains available for general prompts. Model weights are separately downloaded or imported, hash checked and cached. Inference is offline. Qwen failed the Turkish translation check; M2M100 passed the small English/Turkish examples documented in the validation report. Caption availability and translation quality vary. Firefox language detection may ask for a manual source language when uncertain.

## Altyazıyla öğrenme · 0.4.0

AI sayfasında videoyu seçip **Altyazıyla öğren** kontrollerini model yüklemeden kullanabilirsin. Önceki/sonraki satır ve tekrar oynatma, videonun okunabilir yerel TextTrack altyazısını ve seçili gecikmeyi kullanır. **O anki satırı al** metni düzenleme alanına getirir; kaydetmeden önce kelimeye kısaltabilir veya cümleyi düzeltebilirsin. En fazla 300 karakter açık kaydetme eylemiyle yerel kelime defterine eklenir. Bu akış metni çeviri sunucusuna göndermez. Dosyadan eklenen çift altyazı gezinme kaynağı değildir. Oynatıcı otomatik oynatmayı engellerse zaman seçilir ve videodan oynatmayı başlatman istenir.
