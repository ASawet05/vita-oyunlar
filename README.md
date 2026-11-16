# Vita Oyunlar

[VitaTakip](https://vitatakip.com.tr) için sağlık ve beslenme temalı mini oyunlar. Saf HTML/CSS/JS; dış kütüphane, sunucu veya izleme yok.
Skorlar yalnızca tarayıcıda (`localStorage`) saklanır.

## Yapı

```
index.html        Lobi (oyun seçim menüsü) + "← VitaTakip'e Dön"
css/ortak.css     Ortak tasarım (VitaTakip renkleri, üst bar, kartlar, pencereler)
oyun1.html        Vitamin Hafıza Eşleştirme   → css/oyun1.css, js/oyun1.js
oyun2.html        Sağlıklı Sepet (refleks)     → css/oyun2.css, js/oyun2.js
vitablock.html    VitaBlock (8x8 blok bulmaca) → css/vitablock.css, js/vitablock.js
damar-kosucusu.html  Damar Yolu Koşucusu  → css/damar-kosucusu.css, js/damar-kosucusu.js + js/damar/{ayar,cizim,ses,kayit}.js (ES modülleri, dış kütüphane yok)
vucut-savunmasi.html Vücut Savunması (strateji) → css/vucut-savunmasi.css, js/vucut-savunmasi.js + js/vucut/*.js (ES modülleri)
```

Tüm oyunlar dış kütüphane kullanmaz; çevrimdışı da çalışır.
Damar Yolu Koşucusu: Canvas 2D sözde-3D motor (tam ekran, DPR ölçekli; klavye + kaydırma/çift dokunma). İlerleme (Vita-Puan, rekor, karakterler, kapsül tasarımları, kapsül stoğu, ses) yalnızca bu cihazda localStorage'da `vo_damar_v2` anahtarıyla saklanır (js/damar/kayit.js); eski `vo_damar_profile_v1` damla bankası ilk açılışta Vita-Puan'a taşınır. Test kancası: `window.DamarKosucusu`.

```
```

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
