/* Damar Yolu Koşucusu — sabitler ve içerik verisi (denge, bölgeler, mağaza, vitamin bilgileri). */
export const LW = 2.2;                 // şerit genişliği (m)
export const LANES = [-LW, 0, LW];
export const PLAT_H = 2.3;             // üst köprü yüksekliği (m)
export const PLAYER_H = 1.7;
export const GRAV = 30;
export const JUMP_V = 10.2;            // ≈1,73 m
export const SUPER_V = 14.2;           // ≈3,36 m → doğrudan üst köprüye
export const TRAMP_V = 14.6;
export const SLIDE_T = 0.72;
export const BUFFER_T = 0.12;          // giriş tamponu (sn)
export const CHASE_T = 6;
export const SHIELD_T = 10;
export const FRENZY_T = 5;
export const FRENZY_N = 25;
export const POWER_T = 8;
export const SPEED0 = 12.5, SPEED_MAX = 30, SPEED_PER_M = 0.0075;
export const ZONE_LEN = 500;

const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/* Her bölge: gökyüzü (tünel) üst/alt, ufuk çekirdeği, halka, yol, şerit çizgisi, parçacık */
export const ZONES = [
  { name: "Ana Atardamar", top: "#22050d", bot: "#5a0f1e", core: "#ff7a59", ring: "#fb7185", road: "#3a0912", road2: "#4a0d19", line: "#fda4af", cell: "#ef4444", accent: "#fdba74" },
  { name: "Kılcal Ağ Geçidi", top: "#4a1027", bot: "#a8324a", core: "#ffd0b0", ring: "#fecdd3", road: "#5a1529", road2: "#6d1c34", line: "#ffe4e6", cell: "#fb7185", accent: "#fef08a" },
  { name: "Nöro-İletim Hattı", top: "#030717", bot: "#0b1f52", core: "#38bdf8", ring: "#60a5fa", road: "#081233", road2: "#0c1a45", line: "#7dd3fc", cell: "#818cf8", accent: "#a5f3fc" }
].map(z => { const o = { name: z.name }; for (const k in z) if (k !== "name") o[k] = rgb(z[k]); return o; });

export const VITAMINS = {
  d3: { label: "D3", name: "D3 vitamini", c1: "#fde047", c2: "#f59e0b", rim: "#fffbeb",
    facts: ["D vitamini aslında bir hormon öncüsüdür; cildin güneş ışığıyla onu kendisi üretebilir.", "D vitamini, bağırsaktan kalsiyum emilimine yardım eder; kemikler bunu sever."] },
  b12: { label: "B12", name: "B12 vitamini", c1: "#fb7185", c2: "#e11d48", rim: "#ffe4e6",
    facts: ["B12 vitamini yapısında kobalt taşır; adındaki \"kobalamin\" buradan gelir.", "Karaciğer B12'yi yıllarca yetecek kadar depolayabilir."] },
  fe: { label: "Fe", name: "demir", c1: "#fdba74", c2: "#ea580c", rim: "#ffedd5",
    facts: ["Vücuttaki demirin büyük kısmı, oksijen taşıyan hemoglobinin içindedir.", "C vitamini, bitkisel kaynaklı demirin emilimini kolaylaştırır."] },
  mg: { label: "Mg", name: "magnezyum", c1: "#86efac", c2: "#16a34a", rim: "#dcfce7",
    facts: ["Magnezyum, vücutta 300'den fazla enzim tepkimesinde görev alır.", "Vücuttaki magnezyumun yarıdan fazlası kemiklerde bulunur."] }
};
export const VIT_KEYS = Object.keys(VITAMINS);

export const POWERS = {
  magnet: { name: "Vitamin Mıknatısı", color: "#f87171", icon: "🧲" },
  spring: { name: "Enzim Yayları", color: "#4ade80", icon: "🌀" },
  x2: { name: "2x Biyo-Yararlanım", color: "#c084fc", icon: "✖2" }
};

export const CHARS = {
  vita: { name: "Vita-Koşucu", price: 0, perk: "Dengeli başlangıç", body: "#f1f5f9", acc: "#14b8a6", visor: "#5eead4" },
  demir: { name: "Demir Şövalye", price: 500, perk: "+3 sn başlangıç mıknatısı", body: "#cbd5e1", acc: "#ea580c", visor: "#fdba74" },
  d3: { name: "D3 Güneş Muhafızı", price: 750, perk: "+%15 zıplama", body: "#fef3c7", acc: "#f59e0b", visor: "#fde047" },
  b12: { name: "B12 Nöro-Hızcı", price: 1000, perk: "+1 başlangıç çarpanı", body: "#e0e7ff", acc: "#e11d48", visor: "#f0abfc" }
};
export const CAPS = {
  nano: { name: "Nano Kapsül", price: 0, c1: "#2dd4bf", c2: "#0f766e" },
  plazma: { name: "Plazma Kapsül", price: 400, c1: "#c084fc", c2: "#6d28d9" },
  altin: { name: "Altın Kapsül", price: 800, c1: "#fde047", c2: "#d97706" }
};
export const STOCK_PRICE = 40;
export const STOCK_MAX = 9;

/* Mini görevler: tek tur, tamamlanınca bonus Vita-Puan */
export const MISSIONS = [
  { id: "vit", n: 20, text: n => `Hedef: ${n} Vitamin Topla` },
  { id: "slide", n: 3, text: n => `Hedef: ${n} Engelin Altından Kay` },
  { id: "jump", n: 5, text: n => `Hedef: ${n} Engelin Üzerinden Zıpla` },
  { id: "bridge", n: 1, text: () => "Hedef: Bir Üst Köprüye Çık" },
  { id: "dist", n: 400, text: n => `Hedef: ${n} Metre Koş` },
  { id: "tramp", n: 2, text: n => `Hedef: ${n} Trambolin Kullan` }
];
export const MISSION_BONUS = 25;
