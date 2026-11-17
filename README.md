# Vita Oyunlar

[VitaTakip](https://vitatakip.com.tr) için sağlık ve beslenme temalı mini oyunlar. Saf HTML/CSS/JS (yalnız Damar Yolu Koşucusu depoya gömülü Three.js kullanır); sunucu veya izleme yok.
Skorlar yalnızca tarayıcıda (`localStorage`) saklanır.

## Yapı

```
index.html        Lobi (oyun seçim menüsü) + "← VitaTakip'e Dön"
css/ortak.css     Ortak tasarım (VitaTakip renkleri, üst bar, kartlar, pencereler)
oyun1.html        Vitamin Hafıza Eşleştirme   → css/oyun1.css, js/oyun1.js
oyun2.html        Sağlıklı Sepet (refleks)     → css/oyun2.css, js/oyun2.js
vitablock.html    VitaBlock (8x8 blok bulmaca) → css/vitablock.css, js/vitablock.js
damar-kosucusu.html  Damar Yolu Koşucusu (3D) → css/damar-kosucusu.css, js/damar-kosucusu.js + js/damar/{ayar,dunya,karakter,nesneler,efekt,dokular,ses,kayit}.js + js/vendor/three-paket.js
vucut-savunmasi.html Vücut Savunması (strateji) → css/vucut-savunmasi.css, js/vucut-savunmasi.js + js/vucut/*.js (ES modülleri)
```

Damar Yolu Koşucusu dışındaki oyunlar dış kütüphane kullanmaz. Tüm oyunlar çevrimdışı da çalışır (CDN yok).

### Damar Yolu Koşucusu (Three.js 3D)

Gerçek zamanlı WebGL sonsuz koşu: low-poly eklemli karakter, rampalı dev kapsül vagonları ve çatıları, karşıdan gelen farlı kapsüller,
Biyo-Jetpack, Toksin Muhafızı kovalaması + "Kapsül Kullan ve Devam Et", Biyo-Sörf, Biyo-Frenzy, her 500 metrede bölge değişimi.

- **Three.js r186** (MIT) depoya gömülüdür: `js/vendor/three-paket.js` yalnız kullanılan sınıfları + `EffectComposer`, `RenderPass`,
  `UnrealBloomPass`, `OutputPass`, `mergeGeometries` içerir (esbuild ile küçültüldü; lisans `js/vendor/THREE-LISANS.txt`).
  Yeni bir `THREE.X` kullanılırsa paket bu sınıfla yeniden üretilmelidir.
- Tüm modeller ve dokular prosedüreldir (Three.js geometrisi + Canvas 2D); dışarıdan görsel/model/ses dosyası yoktur. Sesler Web Audio ile sentezlenir.
- Kalite kademeleri (yüksek / orta / düşük / en düşük: piksel oranı, gölge, bloom) kare hızına göre otomatik düşer ve `vo_damar_q` ile hatırlanır;
  test için `?q=0..3` ile zorlanabilir.
- İlerleme yalnızca bu cihazda: `vo_damar_v3` (Vita-Puan, rekor, karakter/kapsül/güçlendirici seviyeleri, stok, Biyo-Kumbara, ses).
  Eski `vo_damar_v2` ve `vo_damar_profile_v1` kayıtları ilk açılışta taşınır, silinmez. Test kancası: `window.DamarKosucusu`.

## Yeni oyun eklemek

1. `oyunN.html` + `css/oyunN.css` + `js/oyunN.js` oluşturun; üst barı ve `css/ortak.css` bağlantısını diğer oyunlardan kopyalayın.
2. `index.html` lobisine bir `<a class="vo-card" href="oyunN.html">` kartı ekleyin.
3. En iyi skoru lobide göstermek için oyunda `localStorage.setItem("vo_best_<ad>", "…")` yazın ve karta `data-best="vo_best_<ad>"` ekleyin.

Oyunlar eğlence ve genel bilgi amaçlıdır; tıbbi tavsiye yerine geçmez.

VitaKelime (vitakelime.html → css/vitakelime.css, js/vitakelime.js + js/kelime/{motor,ses}.js): kelime çarkı + kesişen bulmaca.
Sözlük data/turkce-sozluk.json (3.000+ büyük harfli Türkçe kelime, tr-TR dönüşümü; sağlık/vitamin terimleri "saglik" listesinde).
Bölümler js/kelime/motor.js ile prosedürel üretilir; oynanan kökler localStorage'da (vo_kelime_v1) tutulur ve tekrar edilmez.

VitaLingo (vitalingo.html → css/vitalingo.css, js/vitalingo.js + js/lingo/ses.js): ilk harfi verilen kelimeyi 5 tahminde bulma; 4/5/6 harf.
Cevaplar data/turkce-sozluk.json içinden seçilir; tahmin kabulü için ek liste data/lingo-kabul.json. Kayıt localStorage vo_lingo_v1 (kullanılan kelimeler tekrar sorulmaz).
