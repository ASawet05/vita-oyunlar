/* Vücut Savunması — birim, düşman ve dalga verileri (oyun dengesi tek yerde).
   Birimler bağışıklık hücreleridir; anahtarlar (d3, c, mg, zn, b12) ve temel değerler önceki sürümle birebir aynıdır. */
export const ROWS = 5, COLS = 9;
export const START_ATP = 150, LIVES = 3;

/* Savunma hücreleri. recharge: yerleştirdikten sonra aynı hücrenin tekrar seçilebilmesi için bekleme (sn) */
export const UNITS = {
  d3: { name: "Yardımcı T-Hücresi", label: "T-Hücresi", short: "T", cost: 50, hp: 300, recharge: 7, color: "#10b981", glow: "#6ee7b7", produce: { every: 8, atp: 25 }, desc: "Sitokin sinyaliyle her 8 sn'de +25 ATP üretir" },
  c: { name: "Nötrofil", label: "Nötrofil", short: "N", cost: 100, hp: 300, recharge: 7, color: "#ec4899", glow: "#f9a8d4", shoot: { every: 1.4, dmg: 20, speed: 6.5, kind: "c" }, desc: "Çok loblu hızlı savunucu: enzim mermileri atar" },
  mg: { name: "Makrofaj", label: "Makrofaj", short: "M", cost: 50, hp: 1800, recharge: 18, color: "#8b5cf6", glow: "#c4b5fd", desc: "Yalancı ayaklarıyla koridoru kapatan dev yutucu hücre" },
  zn: { name: "B-Hücresi", label: "B-Hücresi", short: "B", cost: 150, hp: 300, recharge: 8, color: "#0ea5e9", glow: "#7dd3fc", shoot: { every: 1.6, dmg: 15, speed: 6, kind: "zn", slow: 3 }, desc: "Y-antikor fırlatır, vurduğunu %50 yavaşlatır" },
  b12: { name: "NK Hücresi", label: "NK Hücresi", short: "NK", cost: 200, hp: 400, recharge: 12, color: "#f59e0b", glow: "#fde047", pulse: { every: 2.2, dmg: 45, radius: 1.6 }, desc: "Altın enerji halkasıyla yakındaki tüm düşmanlara hasar" }
};
export const UNIT_ORDER = ["d3", "c", "mg", "zn", "b12"];

/* Yükseltme seviyeleri (1 = yerleştirildiği hâl). Çarpanlar temel değerlere uygulanır. */
export const LEVELS = [
  { dmg: 1, hp: 1, rate: 1, prod: 1, rad: 0 },
  { dmg: 1.35, hp: 1.3, rate: 0.88, prod: 0.85, rad: 0.2 },
  { dmg: 1.75, hp: 1.6, rate: 0.78, prod: 0.72, rad: 0.4 }
];
export const MAX_LEVEL = LEVELS.length;
const r5 = (v) => Math.round(v / 5) * 5;
/* lvl seviyesinden bir üst seviyeye geçiş bedeli */
export function upgradeCost(type, lvl) { const U = UNITS[type]; return lvl >= MAX_LEVEL ? null : r5(U.cost * (lvl === 1 ? 0.75 : 1.25)); }
/* Seviyeye göre etkin değerler */
export function unitStats(type, lvl = 1) {
  const U = UNITS[type], L = LEVELS[Math.max(0, Math.min(MAX_LEVEL, lvl) - 1)];
  return {
    hp: Math.round(U.hp * L.hp),
    dmg: U.shoot ? Math.round(U.shoot.dmg * L.dmg) : U.pulse ? Math.round(U.pulse.dmg * L.dmg) : 0,
    every: U.shoot ? +(U.shoot.every * L.rate).toFixed(2) : U.pulse ? +(U.pulse.every * L.rate).toFixed(2) : U.produce ? +(U.produce.every * L.prod).toFixed(2) : 0,
    radius: U.pulse ? +(U.pulse.radius + L.rad).toFixed(2) : 0,
    atp: U.produce ? U.produce.atp : 0
  };
}
export const CRIT = { chance: 0.12, mult: 2 };   // mermi kritik vuruşu

/* Düşmanlar. speed: hücre/sn · dps: birime saniyede verdiği hasar · size: çizim yarıçapı (hücre) · points: skor */
export const ENEMIES = {
  virus: { name: "Yorgunluk Virüsü", hp: 120, speed: 0.26, dps: 25, size: 0.3, color: "#84cc16", dark: "#3f6212", points: 10 },
  stress: { name: "Stres Bulutu", hp: 70, speed: 0.58, dps: 18, size: 0.3, color: "#7c3aed", dark: "#1e1b4b", points: 15 },
  tank: { name: "Oksidatif Stres Devi", hp: 650, speed: 0.13, dps: 60, size: 0.42, color: "#991b1b", dark: "#450a0a", points: 60 },
  swarm: { name: "Enflamasyon Sürüsü", hp: 28, speed: 0.46, dps: 8, size: 0.14, color: "#fb7185", dark: "#9f1239", points: 4 }
};

/* Dalga planı: önce akış (stream), sonra "Büyük Saldırı Dalgası" (burst). Türler dalgayla açılır. */
export function wavePlan(n) {
  const pool = ["virus"];
  if (n >= 2) pool.push("stress");
  if (n >= 3) pool.push("swarm");
  if (n >= 4) pool.push("tank");
  const weights = { virus: 5, stress: n >= 2 ? 3 : 0, swarm: n >= 3 ? 2 : 0, tank: n >= 4 ? 1 + Math.floor(n / 4) : 0 };
  return {
    stream: 6 + n * 2,
    interval: Math.max(1.6, 6.5 - n * 0.45),
    burst: 5 + n * 2,
    hpMul: 1 + (n - 1) * 0.12,
    pool, weights,
    bonus: 50 + n * 25
  };
}
export function pickEnemy(plan, rand) {
  const total = plan.pool.reduce((s, k) => s + plan.weights[k], 0);
  let x = rand() * total;
  for (const k of plan.pool) { x -= plan.weights[k]; if (x <= 0) return k; }
  return plan.pool[0];
}
