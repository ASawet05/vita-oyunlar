/* Damar Yolu Koşucusu — kalıcı oyuncu kaydı (yalnızca bu cihazda, localStorage).
   Damla bankası, Nano-Kaykay stoğu, sahip olunan karakter/kaykay/aksesuarlar, seçimler, skor çarpanı,
   3'lü görev seti, Gizemli Kapsül envanteri, Altın DNA parçaları ve günlük Biyo-Kelime ilerlemesi. */
const KEY = "vo_damar_profile_v1";

export const CHARACTERS = {
  nano: { name: "Nano-Koruyucu", price: 0, desc: "Beyaz + zümrüt zırhlı bağışıklık ajanı", swatch: ["#f1f5f9", "#0d9488"] },
  lokosit: { name: "Lökosit Şövalyesi", price: 250, desc: "Beyaz/altın ağır zırh", swatch: ["#fafafa", "#d4a017"] },
  oksijen: { name: "Oksijen Kuryesi", price: 500, desc: "Yakut/turkuaz hız zırhı", swatch: ["#b91c1c", "#2dd4bf"] },
  kokhucre: { name: "Kök Hücre Ustası", price: 1000, desc: "Neon mor/zümrüt enerji kostümü", swatch: ["#7c3aed", "#10b981"] },
  efsane: { name: "Efsanevi Biyo-Muhafız", price: null, tokens: 3, desc: "Yalnızca 3 Altın DNA Sarmalı ile açılır", swatch: ["#facc15", "#0f172a"] }
};
export const BOARDS = {
  plazma: { name: "Standart Plazma Tahtası", price: 0, desc: "Çarpmada seni bir kez kurtarır" },
  magnezyum: { name: "Magnezyum Yaylı Tahta", price: 400, desc: "Aktifken süper zıplama" }
};
export const ACCESSORIES = {
  visor: { name: "D3 Güneş Vizörü", price: 300, desc: "Altın/turkuaz fütüristik vizör" },
  cape: { name: "Plazma Enerji Pelerini", price: 450, desc: "Koşarken dalgalanan neon pelerin" },
  wings: { name: "Oksijen Jet Kanatları", price: 600, desc: "Sırt tüpünün yanında enerji kanatları" }
};
export const PRICES = { board: 30, box: 100 };
export const WORDS = ["VİTAMİN", "SAĞLIK", "OKSİJEN", "ENERJİ", "BAĞIŞIKLIK", "MAGNEZYUM", "DEMİR"];

/* Görev şablonları: kademe (tier) arttıkça hedefler büyür. scope "run" = tek koşuda */
const MISSIONS = [
  { id: "drops", text: n => `${n} Damla Topla`, n: [50, 150, 300] },
  { id: "board", text: n => `${n} Kez Kaykay Kullan`, n: [2, 4, 6] },
  { id: "dist", text: n => `Tek koşuda ${n} m koş`, n: [500, 1000, 1800], scope: "run" },
  { id: "jump", text: n => `${n} Kez Zıpla`, n: [25, 60, 120] },
  { id: "roof", text: n => `Kapsül çatısında ${n} m koş`, n: [80, 250, 500] },
  { id: "power", text: n => `${n} Güçlendirici Topla`, n: [3, 7, 12] },
  { id: "letter", text: n => `${n} Harf Topla`, n: [3, 7, 12] }
];

export function today(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dayIndex(d = new Date()) { return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000); }
export function wordOfDay(d = new Date()) { return WORDS[((dayIndex(d) % WORDS.length) + WORDS.length) % WORDS.length]; }

function missionSet(setNo, rand = Math.random) {
  const tier = Math.min(2, Math.floor(setNo / 2));
  let ids;
  if (setNo === 0) ids = ["drops", "board", "dist"];         // ilk set: "50 Damla Topla", "2 Kez Kaykay Kullan" …
  else { const pool = MISSIONS.map(m => m.id).sort(() => rand() - 0.5); ids = pool.slice(0, 3); }
  return ids.map(id => { const t = MISSIONS.find(m => m.id === id); return { id, target: t.n[tier], progress: 0, done: false, scope: t.scope || "total" }; });
}
export function missionText(m) { const t = MISSIONS.find(x => x.id === m.id); return t ? t.text(m.target) : m.id; }

function defaults() {
  return {
    v: 1, bank: 0, boards: 2, boxes: 0, dna: 0, multiplier: 1, setNo: 0,
    owned: { chars: ["nano"], boards: ["plazma"], acc: [] },
    sel: { char: "nano", board: "plazma", acc: { visor: false, cape: false, wings: false } },
    missions: missionSet(0), word: { day: today(), word: wordOfDay(), got: 0, done: false },
    stats: { runs: 0, bestDist: 0 }
  };
}
export function loadProfile() {
  let p;
  try { p = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { p = null; }
  const d = defaults();
  if (!p || typeof p !== "object") p = d;
  // Eksik alanları tamamla (ileriye dönük uyumluluk)
  p = Object.assign({}, d, p);
  p.owned = Object.assign({}, d.owned, p.owned || {});
  p.sel = Object.assign({}, d.sel, p.sel || {}); p.sel.acc = Object.assign({}, d.sel.acc, (p.sel && p.sel.acc) || {});
  if (!Array.isArray(p.missions) || p.missions.length !== 3) p.missions = missionSet(p.setNo || 0);
  ["bank", "boards", "boxes", "dna", "multiplier", "setNo"].forEach(k => { p[k] = Math.max(k === "multiplier" ? 1 : 0, Math.floor(Number(p[k]) || 0)); });
  if (!CHARACTERS[p.sel.char] || !p.owned.chars.includes(p.sel.char)) p.sel.char = "nano";
  if (!BOARDS[p.sel.board] || !p.owned.boards.includes(p.sel.board)) p.sel.board = "plazma";
  Object.keys(p.sel.acc).forEach(k => { if (!p.owned.acc.includes(k)) p.sel.acc[k] = false; });
  // Günlük kelime: yeni günde sıfırlanır
  if (!p.word || p.word.day !== today()) p.word = { day: today(), word: wordOfDay(), got: 0, done: false };
  return p;
}
export function saveProfile(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch (_) { return false; } }

/* Görev ilerlemesi: tüm görevler bitince çarpan +1 ve yeni (daha zor) set. Dönüş: tamamlanan görevler + set bitti mi */
export function bumpMission(p, id, amount, runValue) {
  const done = [];
  p.missions.forEach(m => {
    if (m.id !== id || m.done) return;
    if (m.scope === "run") m.progress = Math.max(m.progress, Math.floor(runValue || 0));
    else m.progress += amount;
    if (m.progress >= m.target) { m.progress = m.target; m.done = true; done.push(m); }
  });
  let setDone = false;
  if (p.missions.every(m => m.done)) { p.multiplier += 1; p.setNo += 1; p.missions = missionSet(p.setNo); setDone = true; }
  return { done, setDone };
}

/* Gizemli Kapsül ödülü: Sıradan %70 · Nadir %25 · Efsanevi %5 */
export function rollBox(p, rand = Math.random) {
  const r = rand();
  if (r < 0.70) {
    if (rand() < 0.5) { p.bank += 60; return { rarity: "common", label: "+60 Su Damlası", icon: "💧" }; }
    p.boards += 2; return { rarity: "common", label: "+2 Nano-Kaykay", icon: "🛹" };
  }
  if (r < 0.95) {
    if (rand() < 0.6) { p.bank += 250; return { rarity: "rare", label: "+250 Su Damlası", icon: "💧" }; }
    p.multiplier += 1; return { rarity: "rare", label: "Kalıcı Skor Çarpanı +1x", icon: "✖️" };
  }
  // Efsanevi: sahip olunmayan aksesuar ya da Altın DNA Sarmalı
  const missing = Object.keys(ACCESSORIES).filter(k => !p.owned.acc.includes(k));
  if (missing.length && (rand() < 0.5 || p.dna >= 3)) {
    const k = missing[Math.floor(rand() * missing.length)]; p.owned.acc.push(k);
    return { rarity: "legendary", label: ACCESSORIES[k].name, icon: k === "visor" ? "🥽" : k === "cape" ? "🧣" : "🪽" };
  }
  if (p.dna < 3) {
    p.dna += 1;
    if (p.dna >= 3 && !p.owned.chars.includes("efsane")) p.owned.chars.push("efsane");
    return { rarity: "legendary", label: `Altın DNA Sarmalı (${p.dna}/3)`, icon: "🧬", dna: true };
  }
  p.bank += 500; return { rarity: "legendary", label: "+500 Su Damlası", icon: "💎" };
}
