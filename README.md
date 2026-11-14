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
```

## Yeni oyun eklemek

1. `oyunN.html` + `css/oyunN.css` + `js/oyunN.js` oluşturun; üst barı ve `css/ortak.css` bağlantısını diğer oyunlardan kopyalayın.
2. `index.html` lobisine bir `<a class="vo-card" href="oyunN.html">` kartı ekleyin.
3. En iyi skoru lobide göstermek için oyunda `localStorage.setItem("vo_best_<ad>", "…")` yazın ve karta `data-best="vo_best_<ad>"` ekleyin.

Oyunlar eğlence ve genel bilgi amaçlıdır; tıbbi tavsiye yerine geçmez.
