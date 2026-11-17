/* Damar Yolu Koşucusu — sabitler ve içerik verisi (fizik, denge, bölgeler, mağaza seviyeleri, görevler).
   Birimler metre / saniye. Oyuncu z = 0'da durur; dünya ona doğru akar (nesne konumu: d − G.dist). */
export const LW = 2.4;                 // şerit aralığı
export const LANES = [-LW, 0, LW];
export const WAGON_H = 2.6;            // dev kapsül (vagon) çatı yüksekliği
export const WAGON_W = 2.1;
export const CAR_L = 9.5, CAR_GAP = 0.6;   // tek vagon gövdesi + bağlantı boşluğu
export const RAMP_L = 7;               // önü rampalı vagonun rampa uzunluğu
export const LOW_H = 0.95;             // alçak bariyer yüksekliği (üzerinden zıpla)
export const ARCH_Y = 1.15;            // yüksek kemerin alt kenarı (altından yuvarlan)
export const PLAYER_H = 1.75;
export const GRAV = 31;
export const JUMP_V = 10.4;            // ≈1,75 m tepe
export const ROLL_T = 0.68;            // yerde yuvarlanma süresi
export const BUFFER_T = 0.12;          // giriş tamponu
export const CHASE_T = 6;
export const FRENZY_T = 5, FRENZY_N = 25;
export const JET_H = 7.2;              // Biyo-Jetpack uçuş yüksekliği
export const SPEED0 = 13, SPEED_MAX = 30, SPEED_PER_M = 0.0072;
export const ZONE_LEN = 500;
export const WALL_X = 5.4;             // damar duvarlarının iç yüzü

/* Bölge paletleri: her 500 m'de sinematik geçişle değişir, 1500 m'den sonra döngü */
export const ZONES = [
  { name: "Ana Atardamar", fog: "#3b0913", skyTop: "#14030a", skyHor: "#9b1f33", sun: "#ff9a7a",
    hemiSky: "#ffc2b5", hemiGround: "#2a060e", key: "#fff0e2", wall: "#a8323f", wallEm: "#ff3b55", road: "#3a0d18",
    line: "#ff6b81", rail: "#ffb4a2", accent: "#ffd166", orb: "#c7f9ff", cells: ["#d7263d", "#b5172c", "#f25f5c"] },
  { name: "Kılcal Ağ Geçidi", fog: "#3f0d2b", skyTop: "#18051a", skyHor: "#b8406a", sun: "#ffb27a",
    hemiSky: "#f7a8c2", hemiGround: "#2c0a1e", key: "#ffe9d6", wall: "#b54a6c", wallEm: "#ff9f5a", road: "#3a1028",
    line: "#ffb86b", rail: "#ffc999", accent: "#fff1a8", orb: "#fffbe0", cells: ["#ff7aa2", "#e64980", "#ffa94d"] },
  { name: "Nöro-İletim Hattı", fog: "#060d2b", skyTop: "#01030c", skyHor: "#1e3a8a", sun: "#60a5fa",
    hemiSky: "#8fb0ef", hemiGround: "#070b22", key: "#d7e8ff", wall: "#2f4fa8", wallEm: "#38bdf8", road: "#0a1236",
    line: "#67e8f9", rail: "#bae6fd", accent: "#a5f3fc", orb: "#e0f2fe", cells: ["#818cf8", "#22d3ee", "#c084fc"] }
];
export const zoneIndex = d => Math.floor(Math.max(0, d) / ZONE_LEN) % ZONES.length;

export const VITAMINS = {
  d3: { label: "D3", name: "D3 vitamini", shape: "disc", c1: "#ffd23f", c2: "#f59e0b", rim: "#fff3b0",
    facts: ["D vitamini aslında bir hormon öncüsüdür; cildin güneş ışığıyla onu kendisi üretebilir.", "D vitamini bağırsaktan kalsiyum emilimine yardım eder; kemikler bunu sever."] },
  b12: { label: "B12", name: "B12 vitamini", shape: "crystal", c1: "#ff4d6d", c2: "#c9184a", rim: "#ffe3e8",
    facts: ["B12 vitamini yapısında kobalt taşır; \"kobalamin\" adı buradan gelir.", "Karaciğer B12'yi yıllarca yetecek kadar depolayabilir."] },
  fe: { label: "Fe", name: "demir", shape: "disc", c1: "#ff9f43", c2: "#d9480f", rim: "#ffe8cc",
    facts: ["Vücuttaki demirin büyük kısmı oksijen taşıyan hemoglobinin içindedir.", "C vitamini bitkisel kaynaklı demirin emilimini kolaylaştırır."] },
  mg: { label: "Mg", name: "magnezyum", shape: "crystal", c1: "#51cf66", c2: "#2b8a3e", rim: "#d3f9d8",
    facts: ["Magnezyum vücutta 300'den fazla enzim tepkimesinde görev alır.", "Vücuttaki magnezyumun yarıdan fazlası kemiklerde bulunur."] }
};
export const VIT_KEYS = Object.keys(VITAMINS);

/* Güçlendiriciler: süreler seviyeye göre (Biyo-Mağaza → Güçlendiriciler) */
export const POWERS = {
  jet: { name: "Biyo-Jetpack", color: "#ffa94d", desc: "Vagonların üstünde uçar, gökyüzü vitaminlerini toplarsın", dur: [7, 8.5, 10, 11.5, 13] },
  magnet: { name: "Vitamin Mıknatısı", color: "#ff6b6b", desc: "Yan şeritlerdeki vitaminleri kavisle çeker", dur: [8, 10, 12, 14, 16] },
  x2: { name: "2x Biyo-Yararlanım", color: "#cc5de8", desc: "Skor çarpanını ikiye katlar", dur: [8, 10, 12, 14, 16] }
};
export const POWER_COST = [0, 120, 300, 600, 1200];          // seviye 2..5'e çıkış bedeli (index = mevcut seviye)

/* Karakterler: seviye → kalıcı skor çarpanı x1 → x4,5; seviye arttıkça ekipman güçlenir */
export const LEVEL_MULT = [1, 1.5, 2.5, 3.5, 4.5];
export const CHAR_COST = [0, 250, 600, 1200, 2400];
export const CHARS = {
  vita: { name: "Vita-Koşucu", price: 0, perk: "Biyo-Frenzy +1 sn", body: "#eef2f6", suit: "#3a4656", acc: "#14b8a6", visor: "#5eead4", glow: "#2dd4bf" },
  demir: { name: "Demir Şövalye", price: 500, perk: "Tura 4 sn mıknatısla başlar", body: "#c3cbd6", suit: "#56443a", acc: "#e8590c", visor: "#ffc078", glow: "#ff922b" },
  d3: { name: "D3 Güneş Muhafızı", price: 750, perk: "+%15 zıplama, jetpack +2 sn", body: "#fff4d6", suit: "#7a5414", acc: "#f59f00", visor: "#ffe066", glow: "#ffd43b" },
  b12: { name: "B12 Nöro-Hızcı", price: 1000, perk: "Toksin kovalaması 4 sn sürer", body: "#e4e6ff", suit: "#3d2670", acc: "#e64980", visor: "#f783ac", glow: "#da77f2" }
};
export const LEVEL_GEAR = ["Temel takım", "Omuz zırhı", "Diz koruyucu + anten", "Parlayan enerji kanatçıkları", "Altın işlemeli efsane takım"];

/* Biyo-Sörf kapsülleri: seviye → süre; her tasarımın kendi yeteneği */
export const CAP_DUR = [10, 12, 14, 16, 18];
export const CAP_COST = [0, 150, 350, 700, 1400];
export const CAPS = {
  nano: { name: "Nano Kapsül", price: 0, perk: "Engeli parçalar", c1: "#2dd4bf", c2: "#0f766e" },
  plazma: { name: "Plazma Kapsül", price: 400, perk: "Sörfte vitamin mıknatısı", c1: "#c084fc", c2: "#6d28d9" },
  altin: { name: "Altın Kapsül", price: 800, perk: "Sörfte vitaminler 2 kat Vita-Puan", c1: "#fcc419", c2: "#d97706" }
};
export const STOCK_PRICE = 40, STOCK_MAX = 15;

/* Koşu içi görev zinciri: biri bitince sıradaki açılır (+Vita-Puan, +1 çarpan) */
export const MISSIONS = [
  { id: "vit", n: [20, 45, 80], text: "Vitamin topla" },
  { id: "jump", n: [3, 6, 10], text: "Bariyer üstünden zıpla" },
  { id: "roll", n: [2, 5, 8], text: "Kemer altından yuvarlan" },
  { id: "roof", n: [1, 3, 5], text: "Kapsül çatısına çık" },
  { id: "dist", n: [300, 700, 1200], text: "Metre koş" },
  { id: "kind", n: [8, 16, 25], text: "topla" },
  { id: "pow", n: [1, 2, 3], text: "Güçlendirici al" },
  { id: "hop", n: [1, 2, 4], text: "Çatıdan çatıya atla" }
];
export const MISSION_BONUS = [25, 45, 80];

/* Biyo-Kumbara: her koşu doldurur (mesafe + vitamin); dolunca menüde açılır */
export const PIGGY_BASE = 250, PIGGY_STEP = 125, PIGGY_MAX = 1000;
export const piggyCap = opened => Math.min(PIGGY_MAX, PIGGY_BASE + PIGGY_STEP * opened);
export const piggyGain = (dist, vits) => Math.floor(dist / 8) + vits;
