# Özellik karşılıkları / Parity

Donör: `fire-axolotl` main, `2b739252a5ff66bfd870dfbe6a7e8f2b0ae106a2`. Donördeki `docs/FEATURES.md` ve `docs/ROADMAP.md` esas alınır. İstenen tüm araçların marka adıyla anılması, bunların tüm özelliklerinin donörde mevcut olduğu anlamına gelmez.

| İstek / Requirement | Bu tek eklentide / In this single extension |
| --- | --- |
| uBlock Origin | 1.76.0 motoru aynı pakette; filtreler ve gelişmiş panel. Resmî ayrı eklentinin imzası/kimliği kullanılmaz. / Integrated engine and dashboard, independent identity/signature. |
| Kalıcı/geçici konteynerler / Containers | Oluştur, mevcut sayfayı aç, son sekmede geçiciyi temizle. Siteye otomatik konteyner atama henüz yok. / Create, reopen and cleanup; automatic site rules pending. |
| Global Speed / YouTube | Ana belge ve erişilebilen iframe’lerde video/ses 0.25–4×; site hız tercihi, atanabilir hız kısayolları, gerçek çözünürlük ve deneysel YouTube kalite isteği. / Accessible-frame video/audio, saved speed rules, assignable shortcuts and experimental YouTube quality. |
| Çift altyazı / Dual subtitles | Yerel VTT/SRT, video tam ekranı, özgün dosya/oynatıcı satırında gezinme ve satır döngüsü; erişilebilir TextTrack üzerinden deneysel yerel Qwen hattı. Qwen CPU Türkçe testi başarısız; M2M100 ile kısıtlı İngilizce/Türkçe testleri geçti. Konuşma tanıma yok. / Local files, native fullscreen and experimental Qwen TextTrack pipeline; Qwen CPU Turkish accuracy failed; M2M100 passed limited English/Turkish checks. No transcription. |
| DeepL / çeviri | Önizlenen ana belge/web diyaloğu metnini yerel modelle çevirip geri alma (40 parça / 12.000 karakter); ayrıca kullanıcının seçtiği LibreTranslate uyumlu HTTPS hizmetine açık gönderim. Firefox'un kendi sayfa çevirisi kullanılabilir. DeepL hesabı/API, her videoda canlı çeviri yok. / Explicit endpoint flow, no DeepL account/API or universal live translation. |
| Bitwarden | Firefox'un yerleşik parola yöneticisi kullanılabilir; Bitwarden kasası/hesap eşitlemesi eklenmedi. / Native Firefox passwords remain; Bitwarden integration pending. |
| DuckDuckGo | Firefox araması ve ETP korunur; birleşik engelleyici ek koruma sağlar. DuckDuckGo ürününün tüm özelliklerinin kopyası değil. / Native search/ETP plus blocker, no complete DDG product clone. |
| Netflix 1080p | DRM/servis/abonelik tarafından sınırlandırılan kalite eklentiyle garanti edilemez; Netflix bağdaştırıcısı yok. / No adapter or guaranteed DRM playback quality. |
| Görselle arama / Image search | Google Lens, Bing, TinEye, Yandex; açık sağ tık eylemiyle görsel URL'si gönderilir. Dosya yükleme yok. / Explicit provider choice, URL only. |
| Dark Reader | MIT lisanslı 4.9.135 sayfa motoru aynı pakette, açık eylemle seçili ana belgeye uygulanır. İsteğe bağlı site renk/font tercihleri ve geri alma var; site görünümünde iframe dönüşümü eklenmedi. / Explicit page styling, saved origin rules and undo; frame styling excluded. |
| QR | Metin/adres cihazda üretilir, indirilebilir, Türkçe UTF-8 desteklenir. / Local generation/download including UTF-8. |
| Aion ve karakterler / Companions | Dört yerel karakter, animasyon, özel PNG, yedek, durdurma ve hareket azaltma. / Four companions, import/export and reduced motion. |
| Aion Koşusu / Aion Run | Eklentinin yeni sekmesinde arama ve çevrimdışı oyun. Native `about:newtab` içine kart yerleştirmek mümkün değil; Firefox yeni sekme denetimini kullanıcıya bildirir. / Own new-tab page; cannot inject a card into protected native new tab. |
| Üst/sol/sağ sekmeler / Tab position | Yan panelde sekme listesi; panelin tarafı Firefox ayarından seçilir. Native üst sekme çubuğunu gizleme/taşıma veya araç çubuğu sürükleme düzenleyicisini değiştirme yetkisi yok. / Sidebar alternative; native tab strip/chrome cannot be relocated. |
| Tema/font/ölçek / Appearance | Aion yüzeylerinde dil/font/ölçek, isteğe bağlı Firefox renk teması ve sayfa metni fontu. Native Firefox font ve ölçek ayarları değiştirilemez. / Aion surface controls and browser color theme; native font/scale excluded. |
| Diller/Sync / Languages/Sync | Aion TR/EN; diğer diller için merkezi altyapı. İsteğe bağlı ve düğmeyle başlatılan storage.sync ayar aktarımı var; gerçek hesapla cihazlar arası test bekliyor. / TR/EN with explicit preference sync; real account cross-device validation pending. |
| Telemetri/sponsor ilkeleri / Native privacy policies | Eklenti tarayıcı tercihlerini ve enterprise policy dosyalarını keyfî değiştiremez. Donör native ilke dosyaları kurulmaz. / Extension cannot apply the donor's native policy/pref overlay. |
| Firefox güncellemesi / Browser updates | Firefox tarafından yönetilir. Eklenti sürümü ayrı; kalıcı kurulum/güncelleme Mozilla imzası ve dağıtımı bekler. / Native browser updates unchanged; extension signing/distribution pending. |
| Beş platform / Platforms | Desktop Firefox WebExtension; Linux x86_64 test edilir. Windows/macOS/Android testleri bekliyor. Firefox iOS bu paketi desteklemez. / No fabricated native installers or iOS compatibility claim. |

Tek eklentiyle motor, yerel arayüz ve servis yetkilerini değiştirerek forkla birebir eşitlik sağlamak Firefox WebExtensions modeliyle mümkün değildir. Bu tablo yapılabilen karşılıkları, geliştirme açıklarını ve platform sınırlarını ayrı kaydeder. / Exact native-fork parity cannot be achieved through standard WebExtensions alone; implementation gaps and platform restrictions are recorded separately above.

Qwen 2.5 1.5B yerel metin/altyazı motoru ve kullanım sınırları: [LOCAL_AI.md](LOCAL_AI.md). Kapsamın kronolojik takibi: [REQUIREMENTS.md](REQUIREMENTS.md).
