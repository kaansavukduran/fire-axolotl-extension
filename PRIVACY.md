# Gizlilik / Privacy

Bu eklenti hesap, telemetri veya kendi analiz hizmetini eklemez. Firefox'un kendi ağ hizmetleri ve tercihleri Firefox tarafından yönetilir. / No added account, telemetry or analytics service; native Firefox services remain under Firefox control.

- Aion ayarları, kelimeler, çeviri taslağı, oyun rekoru ve karakterler yereldir. Otomatik bulut aktarımı yoktur. Açıkça etkinleştirilen storage.sync düğmeleri yalnızca izin verilen tercih alanlarını Firefox Sync’e aktarır; kelime ve taslaklar bu aktarımın dışındadır. / Aion settings, words, draft, scores and characters are local, without automatic cloud sync.
- uBO filtre listesini günceller; upstream filtre barındırıcılarına ağ bağlantıları yapar. Gelişmiş panelden listeler ve güncelleme ayarları yönetilir. / uBO fetches filter updates from upstream hosts; control these in its dashboard.
- Yerel Qwen için çalışma kodu ve WASM dosyaları pakettedir. Model verisi açık indirme eyleminde sabitlenmiş Hugging Face sürümünden/CDN’den alınır veya kullanıcı yerel dosya seçer. SHA-256 doğrulanır. Çıkarım ağ isteği yapamaz; metin ve komut modele bu cihazda verilir. Model önbelleğini silmek diğer Aion verilerini silmez. / Model data downloads only on explicit action; inference is local and network access is blocked.
- Çeviri, ayarlarda kendin kaydettiğin LibreTranslate uyumlu HTTPS hizmetine yalnızca **Çevir** eylemiyle metin gönderir. API anahtarı gerektiren hizmetler desteklenmez. Yönlendirmeler reddedilir; 20 saniyede zaman aşımı olur. / Translation sends text only on explicit action to your chosen endpoint, without credentials or redirects.
- Görselle arama, seçtiğin sağlayıcıyı görselin URL'siyle yeni sekmede açar. O sağlayıcı görüntü URL'sini ve web bağlantısına ait olağan bilgileri alır. / Image search shares the URL with the explicitly selected provider.
- Yeni sekme araması Firefox'un seçili motoruna sorguyu gönderir. QR ve oyun yereldir. / New-tab search uses the selected Firefox search engine; QR and gameplay are local.
- İsteğe bağlı sayfa koyulaştırma, seçili ana belgeye yerel Dark Reader kodu yükler. Haricî görsel analizi için fetch kapalıdır; normal sayfanın kendi ağ trafiği devam eder. / Optional page darkening uses bundled code with remote analysis fetching disabled; ordinary page traffic continues.
- **Güncellemeleri kontrol et** yalnızca basıldığında bu deponun GitHub Release API'sine bağlanır. / Manual update checks contact this repository's GitHub Releases API.

## İzinler / Permissions

uBO'nun gerçek ağ/kozmetik filtrelemesi `<all_urls>`, `webRequest`, `webRequestBlocking`, `webNavigation`, `dns`, `privacy`, `publicSuffix`, `alarms`, `unlimitedStorage`, `tabs` ve `storage` gerektirir. Konteynerler için `contextualIdentities` ve `cookies`, sağ tık için `menus`, renk teması için `theme`, Firefox varsayılan araması için `search` kullanılır. `activeTab` donör akışlarıyla birlikte korunur.

The manifest declares website content, website activity and search terms because the explicitly invoked translation, image-search and search tools can send those types to a selected service. This does not enable background collection or telemetry.

All-site access is required at installation by the integrated blocker. Choosing a translation endpoint is consent in the extension's own UI, **not a separate host-permission boundary**. Page content cannot invoke privileged Aion commands: the background checks both sender extension ID and the exact allowed packaged page URL. No native-messaging host or local executable is required. Firefox-protected pages remain protected.

Yedek JSON'ları kelimeler ve hizmet adresini içerebilir. Özel karakter yedeği görüntüyü içerir. İçe aktarma ağ izni veya yeni bir güvenilir çeviri adresi vermez. Geçici konteyner temizliği Firefox geçmişini/indirmelerini silmez. / Backups may contain private data; imports retain the currently trusted endpoint. Container cleanup does not erase history/downloads.

Site renk/font ve hız kuralları, yalnızca kullanıcı Hatırla seçtiğinde en fazla 200 origin olarak bu cihazda saklanır; ziyaret geçmişi veya zaman çizelgesi kaydedilmez. Açık sekme başlık/adresleri araçların çalışması için geçici olarak okunur. Yerel JSON yedeği site kurallarını ve taslağı da içerebilir; model ve karakter PNG’leri ayrı tutulur.
