/* Vücut Savunması — koridor tabanlı bağışıklık savunması. Saf HTML5 Canvas + Vanilla JS (ES modülleri), dış motor yok.
   5 koridor × 9 sütun; solda Bağışıklık Merkezi bariyeri (3 can), sağdan düşman akışı.
   Girdi: Pointer Events (dokunma + fare + kalem) — panelden birim seç → hücreye dokun; ATP kürelerine dokun veya
   imleci/parmağı üzerinden geçir. Klavye: 1–5 birim, R geri dönüştür, Esc iptal, P duraklat, F hız. */
import { ROWS, COLS, START_ATP, LIVES, UNITS, UNIT_ORDER, ENEMIES, wavePlan, pickEnemy } from "./vucut/veri.js";
import { createAudio } from "./vucut/ses.js";

const $ = (id) => document.getElementById(id);
const BEST_KEY = "vo_vucut_best_wave", MUTE_KEY = "vo_vucut_muted";
const BASE_W = 0.8, SPAWN_W = 0.9, TOTAL_W = BASE_W + COLS + SPAWN_W; // hücre biriminde genişlik
const canvas = $("vsCanvas"), ctx = canvas.getContext("2d"), wrap = $("vsBoard");
const sfx = createAudio(MUTE_KEY);
const rand = Math.random;

/* ---------------- Durum ---------------- */
let G;
function fresh() {
  return {
    mode: "ready", speed: 1, t: 0, atp: START_ATP, lives: LIVES, wave: 0, kills: 0, waveKills: 0,
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    enemies: [], shots: [], orbs: [], parts: [], rings: [], floats: [],
    selected: null, recharge: {}, hover: null,
    phase: "break", phaseT: 4, plan: null, streamLeft: 0, spawnT: 0, streamTimer: 0, burstLeft: 0, warnT: 0,
    skyT: 4, shake: 0, baseFlash: 0, hold: false
  };
}
G = fresh();
const bestWave = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) { return 0; } };

/* ---------------- Yerleşim (5x9 oranı korunur, dpr ile keskin) ---------------- */
const L = { cell: 40, W: 0, H: 0, dpr: 1 };
let bg = null;
function layout() {
  const aw = wrap.clientWidth, ah = wrap.clientHeight;
  if (!aw || !ah) return;
  const cell = Math.max(24, Math.floor(Math.min(aw / TOTAL_W, ah / ROWS, 100)));
  L.dpr = Math.min(window.devicePixelRatio || 1, 3);
  if (cell === L.cell && L.W && bg && L.dpr === L.bgDpr) return;
  L.cell = cell; L.W = Math.round(cell * TOTAL_W); L.H = cell * ROWS;
  canvas.style.width = L.W + "px"; canvas.style.height = L.H + "px";
  canvas.width = Math.round(L.W * L.dpr); canvas.height = Math.round(L.H * L.dpr);
  buildBg(); L.bgDpr = L.dpr;
  const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 700;
  $("vsRotate").hidden = !portrait;
}
new ResizeObserver(layout).observe(wrap);
window.addEventListener("resize", layout);
const PX = (x) => (BASE_W + x) * L.cell;   // ızgara x (hücre) → piksel
const PY = (r) => (r + 0.5) * L.cell;       // koridor → piksel (merkez)

function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function buildBg() {
  const cv = document.createElement("canvas"); cv.width = canvas.width; cv.height = canvas.height;
  const b = cv.getContext("2d"); b.scale(L.dpr, L.dpr);
  const s = L.cell;
  const g = b.createLinearGradient(0, 0, L.W, L.H); g.addColorStop(0, "#0f172a"); g.addColorStop(1, "#064e3b");
  b.fillStyle = g; b.fillRect(0, 0, L.W, L.H);
  // Biyolojik doku: koridorlar ve hücreler
  for (let r = 0; r < ROWS; r++) {
    b.fillStyle = r % 2 ? "rgba(13,148,136,.07)" : "rgba(45,212,191,.04)"; b.fillRect(PX(0), r * s, COLS * s, s);
    for (let c = 0; c < COLS; c++) {
      const m = s * 0.06; rr(b, PX(c) + m, r * s + m, s - 2 * m, s - 2 * m, s * 0.22);
      b.fillStyle = (r + c) % 2 ? "rgba(13,148,136,.13)" : "rgba(13,148,136,.07)"; b.fill();
      b.lineWidth = 1; b.strokeStyle = "rgba(45,212,191,.2)"; b.stroke();
      // hücre çekirdeği izi
      b.fillStyle = "rgba(94,234,212,.06)"; b.beginPath(); b.arc(PX(c) + s * 0.68, r * s + s * 0.34, s * 0.09, 0, Math.PI * 2); b.fill();
    }
  }
  // Doğuş bölgesi (sağ)
  const sg = b.createLinearGradient(PX(COLS), 0, L.W, 0); sg.addColorStop(0, "rgba(127,29,29,0)"); sg.addColorStop(1, "rgba(127,29,29,.45)");
  b.fillStyle = sg; b.fillRect(PX(COLS), 0, SPAWN_W * s, L.H);
  // Bağışıklık Merkezi (sol)
  const bgr = b.createLinearGradient(0, 0, BASE_W * s, 0); bgr.addColorStop(0, "rgba(13,148,136,.55)"); bgr.addColorStop(1, "rgba(13,148,136,.12)");
  b.fillStyle = bgr; b.fillRect(0, 0, BASE_W * s, L.H);
  bg = cv;
}

/* ---------------- Çizim yardımcıları (birim ikonları panelde de kullanılır) ---------------- */
export function drawUnit(c, type, cx, cy, s, t, hpRatio = 1, flash = 0) {
  const U = UNITS[type];
  c.save(); c.translate(cx, cy);
  c.shadowColor = U.glow; c.shadowBlur = s * 0.18;
  if (type === "d3") {
    c.save(); c.rotate(t * 0.8); c.fillStyle = U.glow;
    for (let i = 0; i < 10; i++) { c.rotate(Math.PI / 5); c.beginPath(); c.moveTo(s * 0.26, -s * 0.05); c.lineTo(s * 0.4, 0); c.lineTo(s * 0.26, s * 0.05); c.fill(); }
    c.restore();
    const gr = c.createRadialGradient(-s * 0.08, -s * 0.08, s * 0.03, 0, 0, s * 0.27); gr.addColorStop(0, "#fef9c3"); gr.addColorStop(1, U.color);
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, s * 0.26 * (1 + Math.sin(t * 3) * 0.03), 0, Math.PI * 2); c.fill();
  } else if (type === "c") {
    c.fillStyle = "#c2410c"; rr(c, s * 0.05, -s * 0.08, s * 0.34, s * 0.16, s * 0.06); c.fill();
    const gr = c.createRadialGradient(-s * 0.07, -s * 0.07, s * 0.03, 0, 0, s * 0.28); gr.addColorStop(0, "#fed7aa"); gr.addColorStop(1, U.color);
    c.fillStyle = gr; c.beginPath(); c.arc(-s * 0.04, 0, s * 0.27, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0; c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = Math.max(1, s * 0.025);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(-s * 0.04, 0); c.lineTo(-s * 0.04 + Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22); c.stroke(); }
  } else if (type === "mg") {
    const gr = c.createLinearGradient(0, -s * 0.4, 0, s * 0.4); gr.addColorStop(0, "#e9d5ff"); gr.addColorStop(1, U.color);
    c.fillStyle = gr; rr(c, -s * 0.3, -s * 0.4, s * 0.6, s * 0.8, s * 0.2); c.fill();
    c.shadowBlur = 0; c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = Math.max(1, s * 0.03); rr(c, -s * 0.24, -s * 0.34, s * 0.48, s * 0.68, s * 0.16); c.stroke();
    // Hasar aldıkça çatlaklar
    c.strokeStyle = "rgba(30,10,50,.75)"; c.lineWidth = Math.max(1, s * 0.035);
    if (hpRatio < 0.7) { c.beginPath(); c.moveTo(-s * 0.18, -s * 0.3); c.lineTo(-s * 0.04, -s * 0.08); c.lineTo(-s * 0.16, s * 0.1); c.stroke(); }
    if (hpRatio < 0.4) { c.beginPath(); c.moveTo(s * 0.2, -s * 0.2); c.lineTo(s * 0.05, s * 0.02); c.lineTo(s * 0.18, s * 0.3); c.moveTo(s * 0.05, s * 0.02); c.lineTo(-s * 0.1, s * 0.3); c.stroke(); c.globalAlpha = 0.85; }
  } else if (type === "zn") {
    c.fillStyle = "#0369a1"; rr(c, s * 0.05, -s * 0.07, s * 0.33, s * 0.14, s * 0.06); c.fill();
    const gr = c.createLinearGradient(0, -s * 0.3, 0, s * 0.3); gr.addColorStop(0, "#e0f2fe"); gr.addColorStop(1, U.color);
    c.fillStyle = gr; c.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.lineTo(-s * 0.04 + Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28); }
    c.closePath(); c.fill();
    c.shadowBlur = 0; c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = Math.max(1, s * 0.02);
    c.beginPath(); c.moveTo(-s * 0.04, -s * 0.18); c.lineTo(-s * 0.04, s * 0.18); c.moveTo(-s * 0.2, -s * 0.09); c.lineTo(s * 0.12, s * 0.09); c.moveTo(-s * 0.2, s * 0.09); c.lineTo(s * 0.12, -s * 0.09); c.stroke();
  } else if (type === "b12") {
    const gr = c.createRadialGradient(0, -s * 0.1, s * 0.04, 0, 0, s * 0.34); gr.addColorStop(0, "#fecdd3"); gr.addColorStop(1, U.color);
    c.fillStyle = gr; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; c.lineTo(Math.cos(a) * s * 0.32, Math.sin(a) * s * 0.32); }
    c.closePath(); c.fill();
    c.shadowBlur = 0; c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = Math.max(1, s * 0.03);
    c.beginPath(); c.arc(0, 0, s * (0.16 + (Math.sin(t * 4) + 1) * 0.03), 0, Math.PI * 2); c.stroke();
  }
  // Sembol
  c.shadowBlur = 0; c.fillStyle = type === "d3" ? "#713f12" : "#fff";
  c.font = `900 ${Math.round(s * (U.short.length > 2 ? 0.17 : 0.21))}px system-ui,-apple-system,'Segoe UI',sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(U.short, type === "c" || type === "zn" ? -s * 0.04 : 0, type === "mg" ? s * 0.14 : 0);
  if (flash > 0) { c.globalAlpha = Math.min(0.6, flash * 6); c.fillStyle = "#fff"; c.beginPath(); c.arc(0, 0, s * 0.34, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
function drawEnemy(e, s) {
  const E = ENEMIES[e.type], x = PX(e.x), y = PY(e.row) + e.dy * s, R = E.size * s, wob = Math.sin(e.anim * 6) * 0.06;
  ctx.save(); ctx.translate(x, y);
  if (e.slowT > 0) { ctx.strokeStyle = "rgba(125,211,252,.85)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R * 1.25, 0, Math.PI * 2); ctx.stroke(); }
  if (e.type === "virus" || e.type === "tank") {
    const spikes = e.type === "tank" ? 12 : 9;
    ctx.strokeStyle = e.type === "tank" ? "#1f0505" : "#475569"; ctx.lineWidth = Math.max(1.5, s * 0.04);
    for (let i = 0; i < spikes; i++) { const a = i / spikes * Math.PI * 2 + e.anim * 0.6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8); ctx.lineTo(Math.cos(a) * R * 1.3, Math.sin(a) * R * 1.3); ctx.stroke(); ctx.fillStyle = e.type === "tank" ? "#f87171" : "#cbd5e1"; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 1.32, Math.sin(a) * R * 1.32, Math.max(1.5, s * 0.03), 0, Math.PI * 2); ctx.fill(); }
    const gr = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R); gr.addColorStop(0, e.type === "tank" ? "#ef4444" : "#bef264"); gr.addColorStop(1, E.color);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, R * (1 + wob), R * (1 - wob), 0, 0, Math.PI * 2); ctx.fill();
    if (e.type === "tank") { ctx.fillStyle = "rgba(69,10,10,.55)"; [[-0.35, -0.2], [0.25, 0.25], [0.1, -0.4], [-0.2, 0.4]].forEach(p => { ctx.beginPath(); ctx.arc(p[0] * R, p[1] * R, R * 0.22, 0, Math.PI * 2); ctx.fill(); }); }
    ctx.fillStyle = E.dark; ctx.beginPath(); ctx.arc(-R * 0.35, -R * 0.12, R * 0.13, 0, Math.PI * 2); ctx.arc(-R * 0.05, -R * 0.12, R * 0.13, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === "stress") {
    const gr = ctx.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R * 1.3); gr.addColorStop(0, "#a78bfa"); gr.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(-R * 0.5, R * 0.1, R * 0.6, 0, Math.PI * 2); ctx.arc(R * 0.1, -R * 0.25, R * 0.75, 0, Math.PI * 2); ctx.arc(R * 0.6, R * 0.15, R * 0.55, 0, Math.PI * 2); ctx.fill();
    if (Math.sin(e.anim * 9) > 0.2) { ctx.strokeStyle = "#fde047"; ctx.lineWidth = Math.max(1.5, s * 0.035); ctx.beginPath(); ctx.moveTo(0, R * 0.2); ctx.lineTo(-R * 0.25, R * 0.75); ctx.lineTo(R * 0.05, R * 0.7); ctx.lineTo(-R * 0.15, R * 1.2); ctx.stroke(); }
  } else if (e.type === "swarm") {
    const gr = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 0, 0, 0, R); gr.addColorStop(0, "#fecdd3"); gr.addColorStop(1, E.color);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R * (1 + wob), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(159,18,57,.8)"; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + e.anim; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a) * R * 1.5, Math.sin(a) * R * 1.5); ctx.stroke(); }
  }
  if (e.flash > 0) { ctx.globalAlpha = Math.min(0.85, e.flash * 8); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, R * 1.05, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  if (e.hp < e.maxHp && e.type !== "swarm") { const w = R * 1.8; ctx.fillStyle = "rgba(2,6,23,.7)"; ctx.fillRect(-w / 2, -R * 1.55, w, 4); ctx.fillStyle = e.hp / e.maxHp > 0.4 ? "#4ade80" : "#f87171"; ctx.fillRect(-w / 2, -R * 1.55, w * Math.max(0, e.hp / e.maxHp), 4); }
  ctx.restore();
}
function drawOrb(o, s) {
  const x = PX(o.x), y = o.y * s, R = s * 0.22 * (o.pop ? 1 + o.pop : 1);
  const a = o.landed && o.life < 3 ? Math.max(0.2, o.life / 3) * (0.7 + 0.3 * Math.sin(G.t * 12)) : 1;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y + Math.sin(G.t * 3 + o.seed) * s * 0.03);
  ctx.shadowColor = o.gold ? "#fde047" : "#22d3ee"; ctx.shadowBlur = s * 0.35;
  const gr = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R * 1.1);
  gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.45, o.gold ? "#fde047" : "#67e8f9"); gr.addColorStop(1, o.gold ? "#ca8a04" : "#0891b2");
  ctx.fillStyle = gr; ctx.beginPath();
  if (o.gold) ctx.arc(0, 0, R, 0, Math.PI * 2);
  else { ctx.moveTo(0, -R * 1.35); ctx.bezierCurveTo(R * 0.9, -R * 0.3, R * 1.05, R * 0.4, 0, R); ctx.bezierCurveTo(-R * 1.05, R * 0.4, -R * 0.9, -R * 0.3, 0, -R * 1.35); }
  ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = o.gold ? "#713f12" : "#083344"; ctx.font = `900 ${Math.round(s * 0.13)}px system-ui,sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("ATP", 0, R * 0.12);
  ctx.restore();
}

/* ---------------- Oyun mantığı ---------------- */
function toast(text, tone) {
  const box = $("vsToasts"), d = document.createElement("div");
  d.className = "vs-toast" + (tone ? " vs-toast--" + tone : ""); d.textContent = text;
  box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 2300);
}
function burst(x, y, color, n = 12, power = 1) {
  for (let i = 0; i < n && G.parts.length < 400; i++) {
    const a = rand() * Math.PI * 2, sp = (0.6 + rand() * 2.2) * power;
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + rand() * 0.5, max: 0.9, color, size: 0.03 + rand() * 0.05 });
  }
}
function floatText(text, x, y, color) { G.floats.push({ text, x, y, life: 1, color }); }
function spawnOrb(x, y, gold) { G.orbs.push({ x, y: gold ? y : -0.4, ty: y, gold, landed: !!gold, life: 14, seed: rand() * 6, value: 25, pop: gold ? 0.6 : 0 }); }

function spawnEnemy(type, row = Math.floor(rand() * ROWS), x = COLS + 0.55) {
  const E = ENEMIES[type], mul = G.plan ? G.plan.hpMul : 1;
  const make = (dx, dy) => G.enemies.push({ type, row, x: x + dx, dy, hp: E.hp * mul, maxHp: E.hp * mul, slowT: 0, flash: 0, anim: rand() * 6, eatT: 0 });
  if (type === "swarm") { const n = 4 + Math.floor(rand() * 3); for (let i = 0; i < n; i++) make(i * 0.28, (rand() - 0.5) * 0.4); }
  else make(0, 0);
}
function startWave() {
  G.wave += 1; G.plan = wavePlan(G.wave); G.waveKills = 0;
  G.streamLeft = G.plan.stream; G.spawnT = 1.5; G.streamTimer = G.plan.stream * G.plan.interval + 6; G.phase = "stream";
  if (G.wave > bestWave()) try { localStorage.setItem(BEST_KEY, String(G.wave)); localStorage.setItem("vo_best_vucut", "Dalga " + G.wave); } catch (_) {}
  sfx.waveStart(); toast(`Dalga ${G.wave} başladı`, "wave");
}
function triggerBurst() {
  G.phase = "warn"; G.warnT = 3;
  sfx.warning(); toast("Büyük Saldırı Dalgası Yaklaşıyor!", "warn");
}
function place(type, r, c, free) {
  const U = UNITS[type];
  if (!U || r < 0 || c < 0 || r >= ROWS || c >= COLS || G.grid[r][c]) return false;
  if (!free && (G.atp < U.cost || (G.recharge[type] || 0) > 0)) return false;
  if (!free) { G.atp -= U.cost; G.recharge[type] = U.recharge; }
  G.grid[r][c] = { type, r, c, hp: U.hp, maxHp: U.hp, cd: U.shoot ? 0.4 : U.pulse ? 0.6 : 0, prodT: 0, flash: 0, born: G.t };
  burst(c + 0.5, r + 0.5, U.glow, 14, 0.7); sfx.place();
  return true;
}
function recycle(r, c) {
  const u = G.grid[r] && G.grid[r][c]; if (!u) return false;
  const refund = Math.floor(UNITS[u.type].cost * 0.5);
  G.atp += refund; G.grid[r][c] = null;
  burst(c + 0.5, r + 0.5, "#5eead4", 16, 0.8); floatText("+" + refund + " ATP", c + 0.5, r + 0.3, "#5eead4"); sfx.recycle();
  return true;
}
function collectOrb(o) {
  if (o.taken) return; o.taken = true;
  G.atp += o.value; sfx.collect();
  burst(o.x, o.y, o.gold ? "#fde047" : "#67e8f9", 10, 0.8); floatText("+" + o.value, o.x, o.y - 0.3, o.gold ? "#fde047" : "#67e8f9");
}
function enemyKilled(e) {
  G.kills++; G.waveKills++;
  const E = ENEMIES[e.type];
  burst(e.x, e.row + 0.5 + e.dy, E.color, e.type === "tank" ? 30 : e.type === "swarm" ? 6 : 16, e.type === "tank" ? 1.4 : 1);
  G.rings.push({ x: e.x, y: e.row + 0.5 + e.dy, r: 0, max: E.size * 2.2, life: 0.35, color: E.color });
  sfx.pop();
}
function damage(e, dmg, slow) {
  e.hp -= dmg; e.flash = 0.12;
  if (slow) e.slowT = Math.max(e.slowT, slow);
}

function update(dt) {
  G.t += dt;
  for (const k in G.recharge) G.recharge[k] = Math.max(0, G.recharge[k] - dt);
  // Gökyüzünden su damlası / ATP küresi
  G.skyT -= dt;
  if (G.skyT <= 0) { spawnOrb(0.4 + rand() * (COLS - 0.8), 0.5 + rand() * (ROWS - 1), false); G.skyT = 7 + rand() * 4; }
  for (let i = G.orbs.length - 1; i >= 0; i--) {
    const o = G.orbs[i];
    if (o.taken) { G.orbs.splice(i, 1); continue; }
    if (o.pop) o.pop = Math.max(0, o.pop - dt * 2);
    if (!o.landed) { o.y += dt * 1.1; if (o.y >= o.ty) { o.y = o.ty; o.landed = true; } }
    else { o.life -= dt; if (o.life <= 0) G.orbs.splice(i, 1); }
  }
  // Dalga akışı
  if (!G.hold) {
    if (G.phase === "break") { G.phaseT -= dt; if (G.phaseT <= 0) startWave(); }
    else if (G.phase === "stream") {
      G.spawnT -= dt; G.streamTimer -= dt;
      if (G.spawnT <= 0 && G.streamLeft > 0) { spawnEnemy(pickEnemy(G.plan, rand)); G.streamLeft--; G.spawnT = G.plan.interval * (0.7 + rand() * 0.6); }
      if (G.waveKills >= 10 || G.streamTimer <= 0 || (G.streamLeft === 0 && !G.enemies.length)) triggerBurst();
    } else if (G.phase === "warn") {
      G.warnT -= dt;
      if (G.warnT <= 0) { G.phase = "burst"; G.burstLeft = G.plan.burst + G.streamLeft; G.streamLeft = 0; G.spawnT = 0; }
    } else if (G.phase === "burst") {
      G.spawnT -= dt;
      if (G.spawnT <= 0 && G.burstLeft > 0) { spawnEnemy(pickEnemy(G.plan, rand)); G.burstLeft--; G.spawnT = 0.35 + rand() * 0.35; }
      if (G.burstLeft === 0 && !G.enemies.length) {
        G.atp += G.plan.bonus; sfx.waveDone();
        toast(`Dalga ${G.wave} temizlendi! +${G.plan.bonus} ATP`, "done");
        floatText("+" + G.plan.bonus + " ATP", COLS / 2, ROWS / 2, "#fde047");
        G.phase = "break"; G.phaseT = 7;
      }
    }
  }
  // Birimler
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const u = G.grid[r][c]; if (!u) continue;
    const U = UNITS[u.type];
    u.flash = Math.max(0, u.flash - dt);
    if (U.produce) { u.prodT += dt; if (u.prodT >= U.produce.every) { u.prodT = 0; spawnOrb(c + 0.5, r + 0.3, true); sfx.produce(); } }
    if (U.shoot) {
      u.cd = Math.max(0, u.cd - dt);
      const target = G.enemies.some(e => e.row === r && e.x > c + 0.3 && e.x < COLS + 0.4);
      if (target && u.cd <= 0) {
        G.shots.push({ x: c + 0.85, row: r, dmg: U.shoot.dmg, speed: U.shoot.speed, kind: U.shoot.kind, slow: U.shoot.slow || 0 });
        u.cd = U.shoot.every; u.recoil = 0.12;
        U.shoot.kind === "zn" ? sfx.ice() : sfx.shoot();
      }
      if (u.recoil) u.recoil = Math.max(0, u.recoil - dt);
    }
    if (U.pulse) {
      u.cd = Math.max(0, u.cd - dt);
      if (u.cd <= 0) {
        const near = G.enemies.filter(e => Math.hypot(e.x - (c + 0.5), (e.row + e.dy) - r) <= U.pulse.radius);
        if (near.length) {
          near.forEach(e => damage(e, U.pulse.dmg));
          G.rings.push({ x: c + 0.5, y: r + 0.5, r: 0, max: U.pulse.radius, life: 0.45, color: U.color, wave: true });
          u.cd = U.pulse.every; sfx.pulse();
        }
      }
    }
  }
  // Mermiler
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i]; s.x += s.speed * dt;
    const hit = G.enemies.find(e => e.row === s.row && e.hp > 0 && Math.abs(e.x - s.x) < ENEMIES[e.type].size + 0.12);
    if (hit) {
      damage(hit, s.dmg, s.slow);
      burst(s.x, s.row + 0.5, s.kind === "zn" ? "#bae6fd" : "#fdba74", 6, 0.6); sfx.hit();
      G.shots.splice(i, 1); continue;
    }
    if (s.x > COLS + 0.9) G.shots.splice(i, 1);
  }
  // Düşmanlar
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i], E = ENEMIES[e.type];
    if (e.hp <= 0) { enemyKilled(e); G.enemies.splice(i, 1); continue; }
    e.flash = Math.max(0, e.flash - dt); e.slowT = Math.max(0, e.slowT - dt);
    const f = e.slowT > 0 ? 0.5 : 1;
    e.anim += dt * f;
    // Engelleyen birim: aynı koridorda, düşmanın önündeki en sağdaki birim
    let block = null;
    for (let c = Math.min(COLS - 1, Math.floor(e.x)); c >= 0; c--) {
      const u = G.grid[e.row][c];
      if (u && e.x - E.size <= c + 0.92 && e.x >= c + 0.2) { block = u; break; }
      if (u) break;
    }
    if (block) {
      block.hp -= E.dps * f * dt; block.flash = 0.08; e.eatT -= dt;
      if (e.eatT <= 0) { sfx.eat(); e.eatT = 0.5; }
      if (block.hp <= 0) { G.grid[block.r][block.c] = null; burst(block.c + 0.5, block.r + 0.5, UNITS[block.type].color, 18, 1); sfx.pop(); }
    } else e.x -= E.speed * f * dt;
    if (e.x - E.size < -0.05) {
      G.enemies.splice(i, 1);
      G.lives -= 1; G.baseFlash = 0.8; G.shake = 0.4; sfx.baseHit();
      if (navigator.vibrate) try { navigator.vibrate(120); } catch (_) {}
      if (G.lives <= 0) { gameOver(); return; }
      toast(`Bariyer hasar aldı! ${G.lives} can kaldı`, "warn");
    }
  }
  // Efektler
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; if (p.life <= 0) G.parts.splice(i, 1); }
  for (let i = G.rings.length - 1; i >= 0; i--) { const g = G.rings[i]; g.life -= dt; g.r = g.max * (1 - Math.max(0, g.life) / (g.wave ? 0.45 : 0.35)); if (g.life <= 0) G.rings.splice(i, 1); }
  for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.life -= dt; f.y -= dt * 0.6; if (f.life <= 0) G.floats.splice(i, 1); }
  G.shake = Math.max(0, G.shake - dt); G.baseFlash = Math.max(0, G.baseFlash - dt);
}

function render() {
  const s = L.cell;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.clearRect(0, 0, L.W, L.H);
  ctx.save();
  if (G.shake > 0) ctx.translate((rand() - 0.5) * G.shake * s * 0.4, (rand() - 0.5) * G.shake * s * 0.4);
  if (bg) ctx.drawImage(bg, 0, 0, L.W, L.H);
  // Bağışıklık Merkezi + turkuaz enerji bariyeri (nabız; hasarda kırmızı parlama)
  const bx = BASE_W * s - 3, pulse = 0.55 + Math.sin(G.t * 3) * 0.2;
  ctx.save(); ctx.shadowColor = G.baseFlash > 0 ? "#f43f5e" : "#2dd4bf"; ctx.shadowBlur = s * 0.5;
  ctx.strokeStyle = G.baseFlash > 0 ? `rgba(244,63,94,${0.6 + G.baseFlash * 0.5})` : `rgba(45,212,191,${pulse + 0.25})`; ctx.lineWidth = Math.max(3, s * 0.08);
  ctx.beginPath(); for (let y = 0; y <= L.H; y += 6) { const xx = bx + Math.sin(y * 0.05 + G.t * 4) * s * 0.04; y === 0 ? ctx.moveTo(xx, y) : ctx.lineTo(xx, y); } ctx.stroke(); ctx.restore();
  for (let r = 0; r < ROWS; r++) { // her koridorun girişinde organ simgesi
    ctx.globalAlpha = 0.85; ctx.font = `${Math.round(s * 0.34)}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(["🫀", "🫁", "🧠", "🫁", "🫀"][r], BASE_W * s / 2 - 2, PY(r)); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#fff"; ctx.font = `900 ${Math.round(s * 0.2)}px system-ui,sans-serif`; ctx.textAlign = "center";
  ctx.fillText("❤".repeat(Math.max(0, G.lives)), BASE_W * s / 2, s * 0.18);
  // Seçili birim önizlemesi (fare üzerinde) ve geçerli hücreler
  if (G.hover && G.selected && G.mode === "run") {
    const { r, c } = G.hover, empty = !G.grid[r][c];
    if (G.selected === "recycle") { if (!empty) { ctx.strokeStyle = "#5eead4"; ctx.lineWidth = 3; rr(ctx, PX(c) + 3, r * s + 3, s - 6, s - 6, s * 0.2); ctx.stroke(); } }
    else {
      const ok = empty && G.atp >= UNITS[G.selected].cost && !(G.recharge[G.selected] > 0);
      ctx.fillStyle = ok ? "rgba(94,234,212,.18)" : "rgba(244,63,94,.18)"; rr(ctx, PX(c) + 3, r * s + 3, s - 6, s - 6, s * 0.2); ctx.fill();
      if (empty) { ctx.globalAlpha = 0.5; drawUnit(ctx, G.selected, PX(c + 0.5), PY(r), s, G.t); ctx.globalAlpha = 1; }
    }
  }
  // Birimler
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const u = G.grid[r][c]; if (!u) continue;
    const grow = Math.min(1, (G.t - u.born) * 5);
    drawUnit(ctx, u.type, PX(c + 0.5) - (u.recoil || 0) * s * 0.6, PY(r), s * (0.6 + 0.4 * grow), G.t + r, u.hp / u.maxHp, u.flash);
    if (u.hp < u.maxHp && u.type !== "mg") { const w = s * 0.6; ctx.fillStyle = "rgba(2,6,23,.7)"; ctx.fillRect(PX(c + 0.2), r * s + s * 0.88, w, 3); ctx.fillStyle = "#4ade80"; ctx.fillRect(PX(c + 0.2), r * s + s * 0.88, w * u.hp / u.maxHp, 3); }
  }
  // Mermiler
  G.shots.forEach(sh => {
    ctx.save(); ctx.shadowColor = sh.kind === "zn" ? "#7dd3fc" : "#fb923c"; ctx.shadowBlur = s * 0.25;
    ctx.fillStyle = sh.kind === "zn" ? "#e0f2fe" : "#fed7aa"; ctx.beginPath(); ctx.arc(PX(sh.x), PY(sh.row), s * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sh.kind === "zn" ? "#38bdf8" : "#f97316"; ctx.beginPath(); ctx.arc(PX(sh.x), PY(sh.row), s * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  // Düşmanlar
  G.enemies.slice().sort((a, b) => a.row - b.row).forEach(e => drawEnemy(e, s));
  // Halkalar (B12 şok dalgası ve patlamalar)
  G.rings.forEach(g => { ctx.save(); ctx.globalAlpha = Math.max(0, g.life * 2.2); ctx.strokeStyle = g.color; ctx.lineWidth = g.wave ? Math.max(3, s * 0.07) : 2; ctx.shadowColor = g.color; ctx.shadowBlur = s * 0.3; ctx.beginPath(); ctx.arc(PX(g.x), g.y * s, Math.max(1, g.r * s), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); });
  // Parçacıklar
  G.parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; const z = p.size * s; ctx.fillRect(PX(p.x) - z / 2, p.y * s - z / 2, z, z); });
  ctx.globalAlpha = 1;
  // ATP küreleri (en üstte, kolay dokunulsun)
  G.orbs.forEach(o => drawOrb(o, s));
  // Uçan yazılar
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  G.floats.forEach(f => { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.font = `900 ${Math.round(s * 0.24)}px system-ui,sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(2,6,23,.8)"; ctx.strokeText(f.text, PX(f.x), f.y * s); ctx.fillStyle = f.color; ctx.fillText(f.text, PX(f.x), f.y * s); });
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ---------------- HUD ve panel ---------------- */
let lastHud = "";
function renderHud() {
  const key = [Math.floor(G.atp), G.wave, G.lives, G.speed, G.selected, G.phase, ...UNIT_ORDER.map(k => Math.ceil(G.recharge[k] || 0))].join("|");
  if (key === lastHud) return; lastHud = key;
  $("vsAtp").textContent = String(Math.floor(G.atp));
  $("vsWave").textContent = G.wave ? String(G.wave) : "—";
  $("vsBest").textContent = String(Math.max(bestWave(), G.wave));
  $("vsLives").textContent = "❤️ " + G.lives;
  $("vsSpeed").textContent = G.speed + "x"; $("vsSpeed").setAttribute("aria-pressed", G.speed === 2 ? "true" : "false");
  document.querySelectorAll(".vs-card[data-unit]").forEach(btn => {
    const k = btn.dataset.unit, U = UNITS[k], rc = G.recharge[k] || 0;
    btn.classList.toggle("is-sel", G.selected === k);
    btn.classList.toggle("is-poor", G.atp < U.cost);
    btn.classList.toggle("is-cool", rc > 0);
    btn.querySelector(".vs-cool").style.height = (rc > 0 ? (rc / U.recharge) * 100 : 0) + "%";
    btn.setAttribute("aria-pressed", G.selected === k ? "true" : "false");
  });
  const rb = $("vsRecycle"); rb.classList.toggle("is-sel", G.selected === "recycle"); rb.setAttribute("aria-pressed", G.selected === "recycle" ? "true" : "false");
  canvas.classList.toggle("is-placing", !!G.selected);
}
function buildPanel() {
  const panel = $("vsUnits");
  panel.innerHTML = UNIT_ORDER.map((k, i) => {
    const U = UNITS[k];
    return `<button type="button" class="vs-card" data-unit="${k}" aria-pressed="false" title="${U.name}: ${U.desc} (${U.cost} ATP) · Kısayol ${i + 1}" aria-label="${U.name}, ${U.cost} ATP. ${U.desc}">
      <canvas class="vs-ico" width="64" height="64" aria-hidden="true"></canvas><span class="vs-cost">${U.cost}</span><span class="vs-name">${U.short === "D3" ? "D3 Güneş" : U.short === "C" ? "C Topçu" : U.short === "Mg" ? "Mg Kalkan" : U.short === "Zn" ? "Zn Buz" : "B12 Şok"}</span><span class="vs-cool" aria-hidden="true"></span></button>`;
  }).join("");
  panel.querySelectorAll(".vs-card").forEach(btn => {
    const cv = btn.querySelector("canvas"), c = cv.getContext("2d"), d = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = 48 * d; cv.height = 48 * d; c.scale(d, d);
    drawUnit(c, btn.dataset.unit, 24, 24, 44, 0.6);
  });
}
function select(k) {
  if (G.mode !== "run") return;
  if (k !== "recycle" && k) {
    const U = UNITS[k];
    if (G.atp < U.cost) { sfx.deny(); toast(`${U.short} için ${U.cost} ATP gerekli`, "deny"); return; }
    if ((G.recharge[k] || 0) > 0) { sfx.deny(); toast(`${U.short} hazırlanıyor… ${Math.ceil(G.recharge[k])} sn`, "deny"); return; }
  }
  G.selected = G.selected === k ? null : k;
  renderHud();
}

/* ---------------- Girdi ---------------- */
function cellAt(ev) {
  const b = canvas.getBoundingClientRect(), x = (ev.clientX - b.left) / L.cell - BASE_W, y = (ev.clientY - b.top) / L.cell;
  return { x, y, c: Math.floor(x), r: Math.floor(y), inGrid: x >= 0 && x < COLS && y >= 0 && y < ROWS };
}
function orbNear(p, radius) { return G.orbs.find(o => !o.taken && Math.hypot(o.x - p.x, o.y - p.y) < radius); }
canvas.addEventListener("pointerdown", (ev) => {
  sfx.unlock();
  if (G.mode !== "run") return;
  ev.preventDefault();
  const p = cellAt(ev);
  const o = orbNear(p, 0.6);
  if (o) { collectOrb(o); return; }                 // önce enerji toplama
  if (!p.inGrid) return;
  if (G.selected === "recycle") { if (recycle(p.r, p.c)) { G.selected = null; renderHud(); } else sfx.deny(); return; }
  if (G.selected) {
    const k = G.selected;
    if (G.grid[p.r][p.c]) { sfx.deny(); return; }
    if (place(k, p.r, p.c)) { G.selected = null; renderHud(); } else sfx.deny();
  }
});
canvas.addEventListener("pointermove", (ev) => {
  if (G.mode !== "run") return;
  const p = cellAt(ev);
  G.hover = p.inGrid && ev.pointerType === "mouse" ? { r: p.r, c: p.c } : null;
  // Üzerinden geçerek / kaydırarak toplama (farede her zaman, dokunmada parmak basılıyken)
  if (ev.pointerType === "mouse" || ev.buttons || ev.pressure > 0) { const o = orbNear(p, 0.5); if (o) collectOrb(o); }
});
canvas.addEventListener("pointerleave", () => { G.hover = null; });
canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); G.selected = null; renderHud(); });
$("vsUnits").addEventListener("click", (e) => { const b = e.target.closest(".vs-card"); if (b) { sfx.unlock(); select(b.dataset.unit); } });
$("vsRecycle").addEventListener("click", () => { sfx.unlock(); select("recycle"); });
$("vsSpeed").addEventListener("click", () => { G.speed = G.speed === 1 ? 2 : 1; renderHud(); });
$("vsPauseBtn").addEventListener("click", () => setPaused(G.mode === "run"));
$("vsResume").addEventListener("click", () => setPaused(false));
$("vsStartBtn").addEventListener("click", start);
$("vsAgain").addEventListener("click", start);
const soundBtn = $("vsSound");
function syncSound() { soundBtn.textContent = sfx.muted ? "🔇" : "🔊"; soundBtn.setAttribute("aria-pressed", sfx.muted ? "false" : "true"); soundBtn.setAttribute("aria-label", sfx.muted ? "Sesi aç" : "Sesi kapat"); }
soundBtn.addEventListener("click", () => { sfx.setMuted(!sfx.muted); syncSound(); if (!sfx.muted) sfx.collect(); });
window.addEventListener("keydown", (e) => {
  if (G.mode === "ready" || G.mode === "over") { if (e.key === "Enter") start(); return; }
  if (e.key === "p" || e.key === "P") { setPaused(G.mode === "run"); return; }
  if (G.mode !== "run") return;
  const i = "12345".indexOf(e.key);
  if (i >= 0) select(UNIT_ORDER[i]);
  else if (e.key === "r" || e.key === "R") select("recycle");
  else if (e.key === "Escape") { G.selected = null; renderHud(); }
  else if (e.key === "f" || e.key === "F") { G.speed = G.speed === 1 ? 2 : 1; renderHud(); }
});
document.addEventListener("visibilitychange", () => { if (document.hidden && G.mode === "run") setPaused(true); });

function start() {
  sfx.unlock();
  G = fresh(); G.mode = "run";
  $("vsStart").hidden = true; $("vsOver").hidden = true; $("vsPause").hidden = true; $("vsPauseBtn").disabled = false;
  lastHud = ""; renderHud();
  toast("İlk dalga birazdan: önce D3 Güneş Jeneratörü kurun", "wave");
}
function setPaused(p) {
  if (G.mode !== "run" && G.mode !== "paused") return;
  G.mode = p ? "paused" : "run";
  $("vsPause").hidden = !p; $("vsPauseBtn").textContent = p ? "▶" : "⏸"; $("vsPauseBtn").setAttribute("aria-label", p ? "Devam et" : "Duraklat");
}
function gameOver() {
  G.mode = "over"; sfx.over();
  const best = Math.max(bestWave(), G.wave);
  $("vsOverWave").textContent = String(G.wave);
  $("vsOverKills").textContent = String(G.kills);
  $("vsOverBest").textContent = String(best);
  $("vsOverNote").textContent = G.wave >= best && G.wave > 0 ? "🎉 Rekor dalga!" : `Rekor: Dalga ${best}`;
  $("vsOver").hidden = false; $("vsPauseBtn").disabled = true; $("vsAgain").focus();
  renderHud();
}

/* ---------------- Döngü ---------------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.mode === "run") { update(dt * G.speed); renderHud(); }
  render();
}
buildPanel(); syncSound(); layout(); renderHud();
requestAnimationFrame(frame);

/* Test ve hata ayıklama */
window.VucutSavunmasi = {
  state: () => ({ mode: G.mode, atp: G.atp, lives: G.lives, wave: G.wave, phase: G.phase, kills: G.kills, waveKills: G.waveKills, speed: G.speed, selected: G.selected, enemies: G.enemies.map(e => ({ type: e.type, row: e.row, x: +e.x.toFixed(2), hp: Math.round(e.hp), slow: e.slowT > 0 })), units: G.grid.flat().filter(Boolean).map(u => ({ type: u.type, r: u.r, c: u.c, hp: Math.round(u.hp) })), orbs: G.orbs.map(o => ({ x: o.x, y: o.y, gold: o.gold, landed: o.landed })), recharge: { ...G.recharge } }),
  start,
  cellToClient: (r, c) => { const b = canvas.getBoundingClientRect(); return { x: b.left + PX(c + 0.5), y: b.top + PY(r) }; },
  pointToClient: (x, y) => { const b = canvas.getBoundingClientRect(); return { x: b.left + PX(x), y: b.top + y * L.cell }; },
  debug: {
    set: (patch) => Object.assign(G, patch),
    hold: (v) => { G.hold = !!v; },
    spawn: (type, row, x) => spawnEnemy(type, row, x),
    place: (type, r, c) => place(type, r, c, true),
    orb: (x, y, gold) => spawnOrb(x, y, !!gold),
    clear: () => { G.enemies = []; G.shots = []; G.orbs = []; }
  }
};
