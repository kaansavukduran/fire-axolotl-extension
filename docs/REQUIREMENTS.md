# Gereksinim takibi

Yetkili hedef `kaansavukduran/fire-axolotl-extension`; donör, sabit `2b739252a5ff66bfd870dfbe6a7e8f2b0ae106a2` commit’indeki Fire Axolotl’dur. Donörün native tarayıcı dalı bu çalışma tarafından değiştirilmez. Kullanıcının 2026-11-10 metni [requirements/user-2026-11-10.txt](requirements/user-2026-11-10.txt) altında, özel Drive adresi çıkarılarak korunur. Sonradan eklenen Qwen/video çeviri isteği de kapsamda kalır.

“Tamamlandı”, burada tarif edilen eklenti yüzeyinin doğrulanmasıdır; örnek alınan markalı ürünün tüm özelliklerinin kopyalandığı anlamına gelmez. Ayrıntılı karşılıklar [PARITY.md](PARITY.md) içindedir.

| Sıra | Durum | Uygulama ve sınır |
| --- | --- | --- |
| 1 · Amaç/güvenlik | Tamamlandı, inceleme sürer | Tek ürün kimliği/manifest; izin ve veri akışları belgeli. Aion telemetrisi yok. uBO filtre güncellemeleri, açık arama/çeviri, isteğe bağlı Sync ve model indirmeleri ayrı açıklanır. |
| 2 · Araçlar/çeviri | Kısmen tamamlandı | Konteyner, video/ses, çift yerel altyazı, seçili metin ve açık HTTPS hizmeti var. 0.8.0’da EN↔TR Bergamot motoru ve ağırlıkları XPI’ye gömüldü, ilk kullanım çevrimdışı test edildi. Qwen ve M2M100 ayrıca seçilebilir; M2M100 İngilizce/Türkçe örnekleri geçti, geniş dil ve hizmet kalite sınırları açık. 0.6.0’da ana belge/açık web diyaloğu için önizlemeli, geri alınabilir yerel çeviri var (40 parça / 12.000 karakter). Arka planda otomatik tüm DOM çevirisi, iframe/form çevirisi ve özel Firefox ekranlarına müdahale yok. |
| 3 · Aion/marka | Tamamlandı, marka incelemesi açık | Donörün özgün Aion logosu, karakter paftaları ve kaynak kayıtları kullanılır. Firefox resmî ürünü iddiası yok; üretim marka benzerliği incelemesi hukuki garanti yerine geçmez. |
| 4 · Sekme konumu | Eklenti kapsamı tamamlandı | Mevcut üst sekmeler/tercihler değiştirilmez. İsteğe bağlı aramalı/sıralamalı yan panel var; panel tarafı/native sekme düzeni Firefox ayarıdır. Native çubuğu taşıma iddiası yok. |
| 5 · Ayarlar/güncelleme | Kısmen tamamlandı | Araç kapatma, sıra, klavyeli taşıma, kısayol atama, temalar, fontlar, ölçek. İki gerçek sürüm arasında geçici geliştirici yükseltmesi veri korumasıyla test edildi; imzalı güncelleme AMO hesabı/imzalama bekliyor. Kullanıcı geliştirici önizlemesini seçti. |
| 6 · Lisans/ücretsiz | Kaydedildi | GPL/MPL/MIT/Apache/OFL ve filtre/listelerin bildirimleri korunur. uBO tam ilgili kaynak ve Eigen MPL kaynak arşivleri oluşturulur. Ücretsiz dağıtım, lisans koşullarını kaldırmaz. |
| 7 · Örnek eklentiler | Kısmen tamamlandı | uBO motoru aynı pakette, diğer araçlar yerel modüller. Güvenlik incelemesiz parola kasası yapılmaz; mevcut Firefox parola yöneticisi korunur. Öneri ürünleri ek kapsam sayılmaz. |
| 8 · Video | Kısmen tamamlandı | Hız, ses, erişilebilen iframe, site hız kuralı, atanabilir hız kısayolları, gerçek çözünürlük, deneysel YouTube kalite isteği; 0.7.0’da dosya/oynatıcı satırı öğrenme ve tekrar döngüsü; 0.9.0’da video üzerinde kelime kartı, yerel çeviri ve kaynak kelime kaydı. Netflix/DRM aşma veya her sitede kalite garantisi yok. |
| 9 · Arayüz | Tamamlandı | Popup, yan panel, ayarlar, araçlar ve AI ekranı. İki alternatif XPI: Firefox yeni sekmesini koruyan veya açıkça override eden paket. Aynı eklentinin alternatif kurulumlarıdır. |
| 10 · Tema/font | Tamamlandı | Aion varsayılan koyu; native Firefox renk teması ayrı ve isteğe bağlı. Siteler varsayılan korunur. Site renk/font tercihleri açık seçimle kaydedilir ve geri alınır; OpenDyslexic lisanslı/yereldir. |
| 11 · Diller/Sync | Kısmen tamamlandı | TR/EN tamam; merkezi kaynaklar diğer dillere hazır. storage.sync, açık onay ve düğmeyle yalnızca tercih aktarır. Gerçek hesapla cihazlar arası doğrulama ve diğer çeviriler bekliyor. |
| 12 · Karakterler | Tamamlandı | Dört tam gövde paftası, katalog koordinatları, PNG içe aktarma, duraklatma, gizleme, silme, karakter yedeği ve azaltılmış hareket. Dot varlıkları kullanılmaz. |
| 13 · Yanlış proje | Kapsam dışında tutuldu | RPG, spor, beslenme, sağlık ve görev uygulaması ekranları eklenmez. |
| 14 · Çalışma/teslim | Sürüm kaydında takip edilir | Gerçek Firefox testleri, kaynak paketleme, ekran görüntüleri, kurulabilir imzasız önizleme. Kalıcı normal kurulum için Mozilla imzası gerekir. |
| 15 · Aion Koşusu | Tamamlandı | Kullanıcı başlatır; Boşluk/dokunma, buz/ateş/kül kareleri, rekor, duraklatma, gizleme, sekme arka planında durma. Google kodu/varlığı kopyalanmaz. |
| 16 · Sistem araçları | Kapsam dışında tutuldu | Driver Booster, WinOptimizer, Steam ve işletim sistemi tarama/onarımı yok. |
| 17 · Yedekleme | Commit/sürüm makbuzuyla takip edilir | Kaynak ZIP, tam ulaşılabilir Git geçmişi ve makbuz ayrı `fire-axolotl-extension` özel Drive klasörüne konur. Kullanıcı profilleri, model önbelleği ve anahtarlar dahil edilmez. |
| 18 · Varlık/kod yeniden kullanımı | Tamamlandı | Sabit commit’teki aynı varlıklar doğrudan kaynak alınır. Bu mesajda ayrıca bir görsel ZIP’i dosyası bulunmadığı için ZIP açıldığı iddia edilmez. Runner 1254×1254, 6×8; karakterler katalog koordinatlarıyla çizilir. |
| 19 · Başlangıç/izleme | Tamamlandı | Kaynaklar incelendi; bu tablo ve devir notu, gerçek sonuçlar ve kalan API/dağıtım engelleriyle sürdürülür. |
| Ek · Qwen 2.5 1.5B | Deneysel | Aynı yerel model için ortak servis, doğrulanmış dosya indirme/içe aktarma, iptal/bellekten çıkarma, metin ve altyazı modları. Çeviri kalite kapısı ile GPU/platform doğrulaması ayrı kaydedilir; model yüklenmesi tek başına çeviri doğruluğu sayılmaz. |

## Dağıtım engelleri

Mozilla geliştirici hesabı/AMO imzası henüz sağlanmadı; bu sürüm geçici yüklenen bir geliştirici önizlemesidir. İmza denetimini kapatma, özel Firefox derleme, native messaging veya sahte otomatik güncelleme akışı eklenmez. Windows/macOS/Android donanım doğrulaması, iOS uyarlaması, gerçek hesap Sync deneyi ve geniş hizmet kalite/altyazı adaptörleri tamamlandı sayılmaz.

Ek yerel çeviri modeli M2M100 418M, Firefox içinde çevrimdışı metin ve TextTrack örneklerinde kullanıldı. Test edilen örnekler [VALIDATION.md](VALIDATION.md) içindedir; tüm diller için kalite garantisi değildir.
