/* Vücut Savunması — birim, düşman ve dalga verileri (oyun dengesi tek yerde). */
export const ROWS = 5, COLS = 9;
export const START_ATP = 150, LIVES = 3;

/* Savunma birimleri. recharge: yerleştirdikten sonra aynı birimin tekrar seçilebilmesi için bekleme (sn) */
export const UNITS = {
  d3: { name: "D3 Güneş Jeneratörü", short: "D3", cost: 50, hp: 300, recharge: 7, color: "#eab308", glow: "#fde047", produce: { every: 8, atp: 25 }, desc: "Her 8 sn'de +25 ATP üretir" },
  c: { name: "C Vitamini Topçusu", short: "C", cost: 100, hp: 300, recharge: 7, color: "#f97316", glow: "#fdba74", shoot: { every: 1.4, dmg: 20, speed: 6.5, kind: "c" }, desc: "Antioksidan küreleri fırlatır" },
  mg: { name: "Magnezyum Kalkanı", short: "Mg", cost: 50, hp: 1800, recharge: 18, color: "#a855f7", glow: "#d8b4fe", desc: "Yüksek canlı hücre duvarı" },
  zn: { name: "Çinko (Zn) Yavaşlatıcı", short: "Zn", cost: 150, hp: 300, recharge: 8, color: "#38bdf8", glow: "#bae6fd", shoot: { every: 1.6, dmg: 15, speed: 6, kind: "zn", slow: 3 }, desc: "Vurduğunu %50 yavaşlatır" },
  b12: { name: "B12 Şok Dalga Kulesi", short: "B12", cost: 200, hp: 400, recharge: 12, color: "#e11d48", glow: "#fda4af", pulse: { every: 2.2, dmg: 45, radius: 1.6 }, desc: "Yakındaki tüm düşmanlara alan hasarı" }
};
export const UNIT_ORDER = ["d3", "c", "mg", "zn", "b12"];

/* Düşmanlar. speed: hücre/sn · dps: birime saniyede verdiği hasar · size: çizim yarıçapı (hücre) */
export const ENEMIES = {
  virus: { name: "Yorgunluk Virüsü", hp: 120, speed: 0.26, dps: 25, size: 0.3, color: "#84cc16", dark: "#3f6212" },
  stress: { name: "Stres Bulutu", hp: 70, speed: 0.58, dps: 18, size: 0.3, color: "#7c3aed", dark: "#1e1b4b" },
  tank: { name: "Oksidatif Stres Devi", hp: 650, speed: 0.13, dps: 60, size: 0.42, color: "#991b1b", dark: "#450a0a" },
  swarm: { name: "Enflamasyon Sürüsü", hp: 28, speed: 0.46, dps: 8, size: 0.14, color: "#fb7185", dark: "#9f1239" }
};

/* Dalga planı: önce akış (stream), sonra "Büyük Saldırı Dalgası" (burst). Türler dalgayla açılır. */
export function wavePlan(n) {
  const pool = ["virus"];
  if (n >= 2) pool.push("stress");
  if (n >= 3) pool.push("swarm");
  if (n >= 4) pool.push("tank");
  const weights = { virus: 5, stress: n >= 2 ? 3 : 0, swarm: n >= 3 ? 2 : 0, tank: n >= 4 ? 1 + Math.floor(n / 4) : 0 };
  return {
    stream: 6 + n * 2,                         // akıştaki düşman sayısı
    interval: Math.max(1.6, 6.5 - n * 0.45),   // akışta iki düşman arası (sn)
    burst: 5 + n * 2,                          // büyük dalga
    hpMul: 1 + (n - 1) * 0.12,                 // dalgayla artan dayanıklılık
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
