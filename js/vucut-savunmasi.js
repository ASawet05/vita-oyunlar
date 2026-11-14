/* Vücut Savunması — koridor tabanlı bağışıklık savunması. Saf HTML5 Canvas + Vanilla JS (ES modülleri), dış motor yok.
   5 koridor × 9 sütun; solda Bağışıklık Merkezi bariyeri (3 can), sağdan mikrop akışı.
   Hücreler: Yardımcı T-Hücresi (ATP), Nötrofil (hızlı atış), Makrofaj (duvar), B-Hücresi (Y-antikor, yavaşlatır), NK (alan hasarı).
   Girdi: Pointer Events (dokunma + fare + kalem) — panelden hücre seç → koridora dokun; yerleşik hücreye dokun → yükselt/sat kartı;
   ATP kürelerine dokun veya üzerinden geçir. Klavye: 1–5 hücre, R geri dönüştür, U yükselt, X sat, Esc iptal, P duraklat, F hız. */
import { ROWS, COLS, START_ATP, LIVES, UNITS, UNIT_ORDER, ENEMIES, MAX_LEVEL, CRIT, upgradeCost, unitStats, wavePlan, pickEnemy } from "./vucut/veri.js";
import { drawUnit, drawEnemy, drawShot } from "./vucut/cizim.js";
import { createAudio } from "./vucut/ses.js";

const $ = (id) => document.getElementById(id);
const BEST_KEY = "vo_vucut_best_wave", MUTE_KEY = "vo_vucut_muted";
const BASE_W = 0.8, SPAWN_W = 0.9, TOTAL_W = BASE_W + COLS + SPAWN_W;
const canvas = $("vsCanvas"), ctx = canvas.getContext("2d"), wrap = $("vsBoard");
const sfx = createAudio(MUTE_KEY);
const rand = Math.random;
const TAU = Math.PI * 2;

/* ---------------- Durum ---------------- */
let G;
function fresh() {
  return {
    mode: "ready", speed: 1, t: 0, atp: START_ATP, lives: LIVES, wave: 0, kills: 0, waveKills: 0, score: 0,
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    enemies: [], shots: [], orbs: [], parts: [], rings: [], floats: [], ghosts: [],
    selected: null, recharge: {}, hover: null, inspect: null,
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
  if (G.inspect) positionPop();
}
new ResizeObserver(layout).observe(wrap);
window.addEventListener("resize", layout);
const PX = (x) => (BASE_W + x) * L.cell;
const PY = (r) => (r + 0.5) * L.cell;

function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
/* Arka plan: organik doku + iç gölgeli damar koridorları + yerleşim hücreleri */
function buildBg() {
  const cv = document.createElement("canvas"); cv.width = canvas.width; cv.height = canvas.height;
  const b = cv.getContext("2d"); b.scale(L.dpr, L.dpr);
  const s = L.cell;
  const g = b.createLinearGradient(0, 0, L.W, L.H); g.addColorStop(0, "#0b1324"); g.addColorStop(0.55, "#0c2733"); g.addColorStop(1, "#06382e");
  b.fillStyle = g; b.fillRect(0, 0, L.W, L.H);
  // Organik doku: yumuşak hücre kabarcıkları
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * L.W, y = rnd() * L.H, r = s * (0.15 + rnd() * 0.5);
    const cg = b.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    cg.addColorStop(0, "rgba(94,234,212,.07)"); cg.addColorStop(0.7, "rgba(13,148,136,.04)"); cg.addColorStop(1, "rgba(13,148,136,0)");
    b.fillStyle = cg; b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
  }
  // Damar koridorları: iç gölge + parlak duvar çizgileri
  for (let r = 0; r < ROWS; r++) {
    const y0 = r * s + s * 0.04, h = s * 0.92;
    const vg = b.createLinearGradient(0, y0, 0, y0 + h);
    vg.addColorStop(0, "rgba(0,0,0,.42)"); vg.addColorStop(0.18, "rgba(15,118,110,.12)"); vg.addColorStop(0.5, "rgba(20,184,166,.10)"); vg.addColorStop(0.82, "rgba(15,118,110,.12)"); vg.addColorStop(1, "rgba(0,0,0,.42)");
    rr(b, PX(0) - s * 0.05, y0, (COLS + SPAWN_W) * s + s * 0.05, h, s * 0.4); b.fillStyle = vg; b.fill();
    b.strokeStyle = "rgba(45,212,191,.28)"; b.lineWidth = 1.2; b.stroke();
    for (let c = 0; c < COLS; c++) {
      const m = s * 0.1; rr(b, PX(c) + m, r * s + m, s - 2 * m, s - 2 * m, s * 0.24);
      b.fillStyle = (r + c) % 2 ? "rgba(94,234,212,.045)" : "rgba(94,234,212,.025)"; b.fill();
      b.setLineDash([3, 4]); b.lineWidth = 1; b.strokeStyle = "rgba(94,234,212,.12)"; b.stroke(); b.setLineDash([]);
    }
  }
  const sg = b.createLinearGradient(PX(COLS), 0, L.W, 0); sg.addColorStop(0, "rgba(127,29,29,0)"); sg.addColorStop(1, "rgba(159,18,57,.5)");
  b.fillStyle = sg; b.fillRect(PX(COLS), 0, SPAWN_W * s, L.H);
  const bgr = b.createLinearGradient(0, 0, BASE_W * s, 0); bgr.addColorStop(0, "rgba(13,148,136,.6)"); bgr.addColorStop(1, "rgba(13,148,136,.1)");
  b.fillStyle = bgr; b.fillRect(0, 0, BASE_W * s, L.H);
  bg = cv;
}

/* ---------------- Oyun mantığı ---------------- */
function toast(text, tone) {
  const box = $("vsToasts"), d = document.createElement("div");
  d.className = "vs-toast" + (tone ? " vs-toast--" + tone : ""); d.textContent = text;
  box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 2300);
}
function burst(x, y, color, n = 12, power = 1) {
  for (let i = 0; i < n && G.parts.length < 420; i++) {
    const a = rand() * TAU, sp = (0.6 + rand() * 2.2) * power;
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + rand() * 0.5, max: 0.9, color, size: 0.025 + rand() * 0.04 });
  }
}
function floatText(text, x, y, color, size = 1, pop = 0) { if (G.floats.length > 44) G.floats.shift(); G.floats.push({ text, x, y, life: 1, color, size, pop }); }
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
function triggerBurst() { G.phase = "warn"; G.warnT = 3; sfx.warning(); toast("Büyük Saldırı Dalgası Yaklaşıyor!", "warn"); }
function place(type, r, c, free) {
  const U = UNITS[type];
  if (!U || r < 0 || c < 0 || r >= ROWS || c >= COLS || G.grid[r][c]) return false;
  if (!free && (G.atp < U.cost || (G.recharge[type] || 0) > 0)) return false;
  if (!free) { G.atp -= U.cost; G.recharge[type] = U.recharge; }
  G.grid[r][c] = { type, r, c, lvl: 1, invested: U.cost, hp: U.hp, maxHp: U.hp, cd: U.shoot ? 0.4 : U.pulse ? 0.6 : 0, prodT: 0, flash: 0, born: G.t, aim: 0, recoil: 0 };
  burst(c + 0.5, r + 0.5, U.glow, 14, 0.7); G.rings.push({ x: c + 0.5, y: r + 0.5, r: 0, max: 0.55, life: 0.35, color: U.glow }); sfx.place();
  return true;
}
function sellValue(u) { return Math.floor(u.invested * 0.5); }
function recycle(r, c) {
  const u = G.grid[r] && G.grid[r][c]; if (!u) return false;
  const refund = sellValue(u);
  G.atp += refund; G.grid[r][c] = null;
  if (G.inspect && G.inspect.r === r && G.inspect.c === c) closePop();
  burst(c + 0.5, r + 0.5, "#5eead4", 16, 0.8); floatText("+" + refund + " ATP", c + 0.5, r + 0.3, "#5eead4"); sfx.recycle();
  return true;
}
function upgrade(r, c) {
  const u = G.grid[r] && G.grid[r][c]; if (!u) return false;
  const cost = upgradeCost(u.type, u.lvl);
  if (cost == null) { sfx.deny(); return false; }
  if (G.atp < cost) { sfx.deny(); toast(`Yükseltme için ${cost} ATP gerekli`, "deny"); return false; }
  G.atp -= cost; u.invested += cost; u.lvl += 1;
  const st = unitStats(u.type, u.lvl), ratio = u.hp / u.maxHp; u.maxHp = st.hp; u.hp = Math.max(u.hp, st.hp * ratio);
  burst(c + 0.5, r + 0.5, "#fde047", 22, 0.9); G.rings.push({ x: c + 0.5, y: r + 0.5, r: 0, max: 0.8, life: 0.45, color: "#fde047", wave: true });
  floatText(`Seviye ${u.lvl}!`, c + 0.5, r + 0.15, "#fde047", 1.1, 0.5); sfx.place(); sfx.collect();
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
  G.score += E.points;
  burst(e.x, e.row + 0.5 + e.dy, E.color, e.type === "tank" ? 30 : e.type === "swarm" ? 6 : 16, e.type === "tank" ? 1.4 : 1);
  G.rings.push({ x: e.x, y: e.row + 0.5 + e.dy, r: 0, max: E.size * 2.2, life: 0.35, color: E.color });
  G.ghosts.push({ type: e.type, x: e.x, row: e.row, dy: e.dy, anim: e.anim, life: 0.5 });   // çözülme efekti
  sfx.pop();
}
function damage(e, dmg, slow, crit, show = true) {
  e.hp -= dmg; e.flash = 0.12;
  if (slow) e.slowT = Math.max(e.slowT, slow);
  if (show) {
    const y = e.row + 0.5 + e.dy - ENEMIES[e.type].size - 0.12;
    if (crit) floatText(`Kritik! -${Math.round(dmg)}`, e.x, y - 0.1, "#fde047", 1.15, 0.6);
    else floatText(`-${Math.round(dmg)}`, e.x + (rand() - 0.5) * 0.2, y, "#f8fafc", 0.72);
  }
}

function update(dt) {
  G.t += dt;
  for (const k in G.recharge) G.recharge[k] = Math.max(0, G.recharge[k] - dt);
  G.skyT -= dt;
  if (G.skyT <= 0) { spawnOrb(0.4 + rand() * (COLS - 0.8), 0.5 + rand() * (ROWS - 1), false); G.skyT = 7 + rand() * 4; }
  for (let i = G.orbs.length - 1; i >= 0; i--) {
    const o = G.orbs[i];
    if (o.taken) { G.orbs.splice(i, 1); continue; }
    if (o.pop) o.pop = Math.max(0, o.pop - dt * 2);
    if (!o.landed) { o.y += dt * 1.1; if (o.y >= o.ty) { o.y = o.ty; o.landed = true; } }
    else { o.life -= dt; if (o.life <= 0) G.orbs.splice(i, 1); }
  }
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
        G.atp += G.plan.bonus; G.score += 50 * G.wave; sfx.waveDone();
        toast(`Dalga ${G.wave} temizlendi! +${G.plan.bonus} ATP`, "done");
        floatText("+" + G.plan.bonus + " ATP", COLS / 2, ROWS / 2, "#fde047", 1.3, 0.5);
        G.phase = "break"; G.phaseT = 7;
      }
    }
  }
  // Hücreler
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const u = G.grid[r][c]; if (!u) continue;
    const U = UNITS[u.type], st = unitStats(u.type, u.lvl);
    u.flash = Math.max(0, u.flash - dt); u.recoil = Math.max(0, u.recoil - dt * 5);
    if (U.produce) { u.prodT += dt; if (u.prodT >= st.every) { u.prodT = 0; spawnOrb(c + 0.5, r + 0.3, true); sfx.produce(); } }
    if (U.shoot) {
      u.cd = Math.max(0, u.cd - dt);
      let tgt = null; for (const e of G.enemies) if (e.row === r && e.x > c + 0.3 && e.x < COLS + 0.4 && (!tgt || e.x < tgt.x)) tgt = e;
      const want = tgt ? Math.atan2(tgt.dy, tgt.x - (c + 0.5)) : 0;      // hedefe kilitlenme dönüşü
      u.aim += (want - u.aim) * Math.min(1, dt * 10);
      if (tgt && u.cd <= 0) {
        const crit = rand() < CRIT.chance;
        G.shots.push({ x: c + 0.85, row: r, dmg: st.dmg * (crit ? CRIT.mult : 1), speed: U.shoot.speed, kind: U.shoot.kind, slow: U.shoot.slow || 0, crit });
        u.cd = st.every; u.recoil = 1;
        U.shoot.kind === "zn" ? sfx.ice() : sfx.shoot();
      }
    }
    if (U.pulse) {
      u.cd = Math.max(0, u.cd - dt);
      if (u.cd <= 0) {
        const near = G.enemies.filter(e => Math.hypot(e.x - (c + 0.5), (e.row + e.dy) - r) <= st.radius);
        if (near.length) {
          near.forEach(e => damage(e, st.dmg, 0, false, near.length <= 6));
          G.rings.push({ x: c + 0.5, y: r + 0.5, r: 0, max: st.radius, life: 0.45, color: U.glow, wave: true });
          u.cd = st.every; u.recoil = 1; sfx.pulse();
        }
      }
    }
  }
  // Mermiler
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i]; s.x += s.speed * dt;
    const hit = G.enemies.find(e => e.row === s.row && e.hp > 0 && Math.abs(e.x - s.x) < ENEMIES[e.type].size + 0.12);
    if (hit) {
      damage(hit, s.dmg, s.slow, s.crit);
      burst(s.x, s.row + 0.5, s.crit ? "#fde047" : s.kind === "zn" ? "#a5f3fc" : "#f9a8d4", s.crit ? 14 : 7, s.crit ? 1 : 0.6); sfx.hit();
      if (s.crit) G.rings.push({ x: s.x, y: s.row + 0.5 + hit.dy, r: 0, max: 0.45, life: 0.25, color: "#fde047" });
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
    let block = null;
    for (let c = Math.min(COLS - 1, Math.floor(e.x)); c >= 0; c--) {
      const u = G.grid[e.row][c];
      if (u && e.x - E.size <= c + 0.92 && e.x >= c + 0.2) { block = u; break; }
      if (u) break;
    }
    e.blocked = !!block;
    if (block) {
      block.hp -= E.dps * f * dt; block.flash = 0.08; e.eatT -= dt;
      if (e.eatT <= 0) { sfx.eat(); e.eatT = 0.5; }
      if (block.hp <= 0) { G.grid[block.r][block.c] = null; if (G.inspect && G.inspect.r === block.r && G.inspect.c === block.c) closePop(); burst(block.c + 0.5, block.r + 0.5, UNITS[block.type].color, 18, 1); sfx.pop(); }
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
  for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.life -= dt * (f.size < 1 ? 1.4 : 1); f.y -= dt * 0.6; if (f.pop) f.pop = Math.max(0, f.pop - dt * 3); if (f.life <= 0) G.floats.splice(i, 1); }
  for (let i = G.ghosts.length - 1; i >= 0; i--) { const g = G.ghosts[i]; g.life -= dt; g.anim += dt * 3; if (g.life <= 0) G.ghosts.splice(i, 1); else if (rand() < 0.5) G.parts.push({ x: g.x + (rand() - 0.5) * 0.4, y: g.row + 0.5 + g.dy + (rand() - 0.5) * 0.4, vx: (rand() - 0.5) * 0.4, vy: -0.4 - rand() * 0.6, life: 0.5, max: 0.6, color: ENEMIES[g.type].color, size: 0.02 + rand() * 0.025 }); }
  G.shake = Math.max(0, G.shake - dt); G.baseFlash = Math.max(0, G.baseFlash - dt);
}

/* ---------------- Çizim ---------------- */
function drawOrb(o, s) {
  const x = PX(o.x), y = o.y * s, R = s * 0.22 * (o.pop ? 1 + o.pop : 1);
  const a = o.landed && o.life < 3 ? Math.max(0.2, o.life / 3) * (0.7 + 0.3 * Math.sin(G.t * 12)) : 1;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y + Math.sin(G.t * 3 + o.seed) * s * 0.03);
  ctx.shadowColor = o.gold ? "#fde047" : "#22d3ee"; ctx.shadowBlur = s * 0.35;
  const gr = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R * 1.1);
  gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.45, o.gold ? "#fde047" : "#67e8f9"); gr.addColorStop(1, o.gold ? "#ca8a04" : "#0891b2");
  ctx.fillStyle = gr; ctx.beginPath();
  if (o.gold) ctx.arc(0, 0, R, 0, TAU);
  else { ctx.moveTo(0, -R * 1.35); ctx.bezierCurveTo(R * 0.9, -R * 0.3, R * 1.05, R * 0.4, 0, R); ctx.bezierCurveTo(-R * 1.05, R * 0.4, -R * 0.9, -R * 0.3, 0, -R * 1.35); }
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, R * (1.25 + Math.sin(G.t * 4 + o.seed) * 0.08), 0, TAU); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = o.gold ? "#713f12" : "#083344"; ctx.font = `900 ${Math.round(s * 0.13)}px system-ui,sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("ATP", 0, R * 0.12);
  ctx.restore();
}
/* Kesikli radar menzil göstergesi (inceleme kartı açık ya da imleç hücre üzerindeyken) */
function drawRange(u, s) {
  const U = UNITS[u.type], st = unitStats(u.type, u.lvl), cx = PX(u.c + 0.5), cy = PY(u.r);
  ctx.save(); ctx.strokeStyle = U.glow; ctx.lineWidth = Math.max(1.5, s * 0.025); ctx.setLineDash([s * 0.12, s * 0.08]); ctx.lineDashOffset = -G.t * s * 0.6;
  ctx.shadowColor = U.glow; ctx.shadowBlur = s * 0.15;
  if (U.pulse || u.type === "mg" || U.produce) {
    const R = (U.pulse ? st.radius : u.type === "mg" ? 0.75 : 0.62) * s;
    ctx.fillStyle = "rgba(255,255,255,.03)"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.stroke();
    if (U.pulse) {   // dönen radar taraması
      const a = G.t * 2.4; const g = ctx.createConicGradient ? ctx.createConicGradient(a, cx, cy) : null;
      if (g) { g.addColorStop(0, "rgba(253,224,71,.28)"); g.addColorStop(0.12, "rgba(253,224,71,0)"); g.addColorStop(1, "rgba(253,224,71,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a, a + TAU * 0.12); ctx.closePath(); ctx.fill(); }
    }
  } else if (U.shoot) {                       // koridor boyunca atış hattı
    const x0 = PX(u.c + 0.85), x1 = PX(COLS + 0.4), h = s * 0.62;
    rr(ctx, x0, cy - h / 2, x1 - x0, h, h / 2); ctx.fillStyle = "rgba(255,255,255,.025)"; ctx.fill(); ctx.stroke();
    const sx = x0 + ((G.t * 0.6) % 1) * (x1 - x0); ctx.setLineDash([]); ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(sx, cy - h / 2 + 3); ctx.lineTo(sx, cy + h / 2 - 3); ctx.stroke();
  }
  ctx.restore();
}
function render() {
  const s = L.cell;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.clearRect(0, 0, L.W, L.H);
  ctx.save();
  if (G.shake > 0) ctx.translate((rand() - 0.5) * G.shake * s * 0.4, (rand() - 0.5) * G.shake * s * 0.4);
  if (bg) ctx.drawImage(bg, 0, 0, L.W, L.H);
  // Plazma dalgalanmaları: akış yönü (sağdan sola)
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let r = 0; r < ROWS; r++) {
    for (let k = 0; k < 2; k++) {
      const yc = PY(r) + (k ? s * 0.22 : -s * 0.24);
      ctx.strokeStyle = `rgba(45,212,191,${k ? 0.06 : 0.08})`; ctx.lineWidth = s * 0.05; ctx.beginPath();
      for (let x = PX(0); x <= L.W; x += s * 0.25) { const yy = yc + Math.sin(x / s * 2.2 + G.t * 2.4 + r + k * 2) * s * 0.05; x === PX(0) ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
    }
    for (let k = 0; k < 4; k++) {           // akan plazma tanecikleri
      const ph = ((G.t * 0.35 + k * 0.25 + r * 0.13) % 1), x = L.W - ph * (L.W - PX(0)), y = PY(r) + Math.sin(ph * 12 + r) * s * 0.3;
      ctx.fillStyle = "rgba(251,113,133,.16)"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.07, s * 0.04, 0, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  // Bağışıklık Merkezi bariyeri
  const bx = BASE_W * s - 3, pulse = 0.55 + Math.sin(G.t * 3) * 0.2;
  ctx.save(); ctx.shadowColor = G.baseFlash > 0 ? "#f43f5e" : "#2dd4bf"; ctx.shadowBlur = s * 0.5;
  ctx.strokeStyle = G.baseFlash > 0 ? `rgba(244,63,94,${0.6 + G.baseFlash * 0.5})` : `rgba(45,212,191,${pulse + 0.25})`; ctx.lineWidth = Math.max(3, s * 0.08);
  ctx.beginPath(); for (let y = 0; y <= L.H; y += 6) { const xx = bx + Math.sin(y * 0.05 + G.t * 4) * s * 0.04; y === 0 ? ctx.moveTo(xx, y) : ctx.lineTo(xx, y); } ctx.stroke(); ctx.restore();
  for (let r = 0; r < ROWS; r++) {
    ctx.globalAlpha = 0.85; ctx.font = `${Math.round(s * 0.34)}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff"; ctx.fillText(["🫀", "🫁", "🧠", "🫁", "🫀"][r], BASE_W * s / 2 - 2, PY(r)); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#fff"; ctx.font = `900 ${Math.round(s * 0.2)}px system-ui,sans-serif`; ctx.textAlign = "center";
  ctx.fillText("❤".repeat(Math.max(0, G.lives)), BASE_W * s / 2, s * 0.18);
  // Yerleştirme önizlemesi
  if (G.hover && G.selected && G.mode === "run") {
    const { r, c } = G.hover, empty = !G.grid[r][c];
    if (G.selected === "recycle") { if (!empty) { ctx.strokeStyle = "#5eead4"; ctx.lineWidth = 3; rr(ctx, PX(c) + 3, r * s + 3, s - 6, s - 6, s * 0.2); ctx.stroke(); } }
    else {
      const ok = empty && G.atp >= UNITS[G.selected].cost && !(G.recharge[G.selected] > 0);
      ctx.fillStyle = ok ? "rgba(94,234,212,.18)" : "rgba(244,63,94,.18)"; rr(ctx, PX(c) + 3, r * s + 3, s - 6, s - 6, s * 0.2); ctx.fill();
      if (empty) { ctx.globalAlpha = 0.5; drawUnit(ctx, G.selected, PX(c + 0.5), PY(r), s, G.t); ctx.globalAlpha = 1; drawRange({ type: G.selected, r, c, lvl: 1 }, s); }
    }
  }
  // Menzil (incelenen ya da imleç altındaki hücre)
  const ins = G.inspect && G.grid[G.inspect.r][G.inspect.c];
  if (ins) drawRange(ins, s);
  else if (G.hover && !G.selected && G.grid[G.hover.r][G.hover.c]) drawRange(G.grid[G.hover.r][G.hover.c], s);
  // Hücreler
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const u = G.grid[r][c]; if (!u) continue;
    const U = UNITS[u.type], grow = Math.min(1, (G.t - u.born) * 5);
    let reach = null;
    if (u.type === "mg") {                    // Makrofaj: yaklaşan mikroba yalancı ayak uzatır
      let best = null; for (const e of G.enemies) if (e.row === r && e.x > c + 0.2 && e.x - (c + 0.5) < 1.5 && (!best || e.x < best.x)) best = e;
      if (best) { const d = best.x - (c + 0.5); reach = { a: Math.atan2(best.dy, d), k: best.blocked ? 0.5 + Math.sin(G.t * 8) * 0.12 : Math.max(0, (1.5 - d) / 1.5) * 0.45 }; }
    }
    if (ins === u) { ctx.save(); ctx.strokeStyle = "rgba(253,224,71,.8)"; ctx.lineWidth = 2; rr(ctx, PX(c) + 2, r * s + 2, s - 4, s - 4, s * 0.22); ctx.stroke(); ctx.restore(); }
    drawUnit(ctx, u.type, PX(c + 0.5), PY(r), s * (0.6 + 0.4 * grow), G.t + r * 0.7 + c * 0.3, { hp: u.hp / u.maxHp, flash: u.flash, aim: u.aim, recoil: u.recoil, lvl: u.lvl, reach, prod: U.produce ? u.prodT / unitStats(u.type, u.lvl).every : 0 });
    if (u.hp < u.maxHp && u.type !== "mg") { const w = s * 0.6, x0 = PX(c + 0.2), y0 = r * s + s * 0.9; ctx.fillStyle = "rgba(2,6,23,.75)"; rr(ctx, x0 - 1, y0 - 1, w + 2, 5, 3); ctx.fill(); ctx.fillStyle = "#4ade80"; rr(ctx, x0, y0, w * u.hp / u.maxHp, 3, 2); ctx.fill(); }
  }
  // Mermiler
  G.shots.forEach(sh => drawShot(ctx, sh, PX(sh.x), PY(sh.row), s, G.t));
  // Düşmanlar + çözülenler
  G.enemies.slice().sort((a, b) => a.row - b.row).forEach(e => drawEnemy(ctx, e, PX(e.x), PY(e.row) + e.dy * s, s));
  G.ghosts.forEach(g => { const k = g.life / 0.5; drawEnemy(ctx, { type: g.type, anim: g.anim, flash: 0, slowT: 0, hp: 1, maxHp: 1 }, PX(g.x), PY(g.row) + g.dy * s - (1 - k) * s * 0.15, s, { alpha: k * 0.8, scale: 1 + (1 - k) * 0.5 }); });
  // Halkalar
  G.rings.forEach(g => { ctx.save(); ctx.globalAlpha = Math.max(0, g.life * 2.2); ctx.strokeStyle = g.color; ctx.lineWidth = g.wave ? Math.max(3, s * 0.07) : 2; ctx.shadowColor = g.color; ctx.shadowBlur = s * 0.3; ctx.beginPath(); ctx.arc(PX(g.x), g.y * s, Math.max(1, g.r * s), 0, TAU); ctx.stroke(); ctx.restore(); });
  // Parçacıklar (parlak, yuvarlak)
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  G.parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(PX(p.x), p.y * s, Math.max(1, p.size * s * 0.6), 0, TAU); ctx.fill(); });
  ctx.restore(); ctx.globalAlpha = 1;
  G.orbs.forEach(o => drawOrb(o, s));
  // Uçan yazılar (hasar sayıları, kritikler, ödüller)
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  G.floats.forEach(f => {
    const sc = (f.size || 1) * (1 + (f.pop || 0));
    ctx.globalAlpha = Math.min(1, f.life * 2); ctx.font = `900 ${Math.round(s * 0.24 * sc)}px system-ui,sans-serif`;
    ctx.lineWidth = Math.max(2, 3 * sc); ctx.strokeStyle = "rgba(2,6,23,.85)"; ctx.strokeText(f.text, PX(f.x), f.y * s);
    ctx.fillStyle = f.color; ctx.fillText(f.text, PX(f.x), f.y * s);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ---------------- HUD ve panel ---------------- */
const prevHud = {};
function bump(id, val) {
  const el = $(id), p = prevHud[id];
  if (p !== undefined && p !== val) {
    const box = el.closest(".vs-stat") || el; const up = val > p;
    box.classList.remove("is-up", "is-down"); void box.offsetWidth; box.classList.add(up ? "is-up" : "is-down");
    clearTimeout(box._t); box._t = setTimeout(() => box.classList.remove("is-up", "is-down"), 480);
  }
  prevHud[id] = val;
}
let lastHud = "";
function renderHud() {
  const atp = Math.floor(G.atp);
  const key = [atp, G.wave, G.lives, G.score, G.speed, G.mode, G.selected, G.phase, ...UNIT_ORDER.map(k => Math.ceil(G.recharge[k] || 0))].join("|");
  if (key === lastHud) return; lastHud = key;
  $("vsAtp").textContent = String(atp); bump("vsAtp", atp);
  $("vsWave").textContent = G.wave ? String(G.wave) : "—";
  $("vsBest").textContent = String(Math.max(bestWave(), G.wave));
  $("vsLives").textContent = String(G.lives); bump("vsLives", G.lives);
  $("vsScore").textContent = String(G.score); bump("vsScore", G.score);
  [["vsSpeed1", 1], ["vsSpeed2", 2]].forEach(([id, v]) => $(id).setAttribute("aria-pressed", G.speed === v && G.mode !== "paused" ? "true" : "false"));
  $("vsPauseBtn").setAttribute("aria-pressed", G.mode === "paused" ? "true" : "false");
  document.querySelectorAll(".vs-card[data-unit]").forEach(btn => {
    const k = btn.dataset.unit, U = UNITS[k], rc = G.recharge[k] || 0;
    btn.classList.toggle("is-sel", G.selected === k);
    btn.classList.toggle("is-poor", G.atp < U.cost);
    btn.classList.toggle("is-cool", rc > 0);
    btn.querySelector(".vs-cool").style.height = (rc > 0 ? (rc / U.recharge) * 100 : 0) + "%";
    btn.querySelector(".vs-need").textContent = G.atp < U.cost ? `−${U.cost - atp}` : rc > 0 ? `${Math.ceil(rc)} sn` : "";
    btn.setAttribute("aria-pressed", G.selected === k ? "true" : "false");
  });
  const rb = $("vsRecycle"); rb.classList.toggle("is-sel", G.selected === "recycle"); rb.setAttribute("aria-pressed", G.selected === "recycle" ? "true" : "false");
  canvas.classList.toggle("is-placing", !!G.selected);
  if (G.inspect) fillPop();
}
const statLine = (k) => {
  const U = UNITS[k], st = unitStats(k, 1);
  if (U.produce) return `<i title="Üretim">⚡${st.atp}</i><i title="Süre">⏱${st.every}s</i>`;
  if (U.pulse) return `<i title="Alan hasarı">⚔${st.dmg}</i><i title="Menzil">◎${st.radius}</i>`;
  if (U.shoot) return `<i title="Hasar">⚔${st.dmg}</i><i title="${U.shoot.slow ? "Yavaşlatma" : "Atış hızı"}">${U.shoot.slow ? "❄50%" : "⏱" + st.every + "s"}</i>`;
  return `<i title="Can">❤${st.hp}</i>`;
};
function buildPanel() {
  const panel = $("vsUnits");
  panel.innerHTML = UNIT_ORDER.map((k, i) => {
    const U = UNITS[k];
    return `<button type="button" class="vs-card" data-unit="${k}" aria-pressed="false" title="${U.name}: ${U.desc} (${U.cost} ATP) · Kısayol ${i + 1}" aria-label="${U.name}, ${U.cost} ATP. ${U.desc}">
      <canvas class="vs-ico" width="64" height="64" aria-hidden="true"></canvas><span class="vs-cost">${U.cost}</span><span class="vs-name">${U.label}</span><span class="vs-stats-mini" aria-hidden="true">${statLine(k)}</span><span class="vs-need" aria-hidden="true"></span><span class="vs-cool" aria-hidden="true"></span></button>`;
  }).join("");
  panel.querySelectorAll(".vs-card").forEach(btn => {
    const cv = btn.querySelector("canvas"), c = cv.getContext("2d"), d = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = 48 * d; cv.height = 48 * d; c.scale(d, d);
    drawUnit(c, btn.dataset.unit, 24, 24, 50, 0.6);
  });
}
function shake(el) { el.classList.remove("is-shake"); void el.offsetWidth; el.classList.add("is-shake"); setTimeout(() => el.classList.remove("is-shake"), 420); }
function select(k) {
  if (G.mode !== "run") return;
  if (k !== "recycle" && k) {
    const U = UNITS[k], btn = document.querySelector(`.vs-card[data-unit="${k}"]`);
    if (G.atp < U.cost) { sfx.deny(); if (btn) shake(btn); toast(`${U.label} için ${U.cost} ATP gerekli`, "deny"); return; }
    if ((G.recharge[k] || 0) > 0) { sfx.deny(); if (btn) shake(btn); toast(`${U.label} hazırlanıyor… ${Math.ceil(G.recharge[k])} sn`, "deny"); return; }
  }
  closePop();
  G.selected = G.selected === k ? null : k;
  renderHud();
}

/* ---------------- Yükselt / Sat kartı ---------------- */
const pop = $("vsPop"), popIco = $("vsPopIco");
function openPop(r, c) { G.inspect = { r, c }; G.selected = null; pop.hidden = false; fillPop(); positionPop(); renderHud(); }
function closePop() { if (!G.inspect) return; G.inspect = null; pop.hidden = true; }
function fillPop() {
  const u = G.inspect && G.grid[G.inspect.r][G.inspect.c];
  if (!u) { closePop(); return; }
  const U = UNITS[u.type], st = unitStats(u.type, u.lvl), nx = u.lvl < MAX_LEVEL ? unitStats(u.type, u.lvl + 1) : null, cost = upgradeCost(u.type, u.lvl);
  const key = [u.type, u.lvl, Math.floor(G.atp) >= (cost || 0), Math.round(u.hp)].join("|");
  if (pop._key === key) return; pop._key = key;
  $("vsPopName").textContent = U.name;
  $("vsPopLvl").innerHTML = Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < u.lvl ? "on" : ""}"></i>`).join("") + `<span>Seviye ${u.lvl}/${MAX_LEVEL}</span>`;
  const row = (ico, label, a, b) => `<div class="vs-pop-row"><span class="vs-pop-ico">${ico}</span><span>${label}</span><b>${a}${b != null && b !== a ? ` <em>→ ${b}</em>` : ""}</b></div>`;
  let html = row("❤", "Can", `${Math.round(u.hp)}/${st.hp}`, nx ? nx.hp : null);
  if (U.produce) html += row("⚡", "Üretim", `${st.atp} ATP / ${st.every} sn`, nx ? `${nx.every} sn` : null);
  if (U.shoot) html += row("⚔", "Hasar", st.dmg, nx ? nx.dmg : null) + row("⏱", "Atış", `${st.every} sn`, nx ? `${nx.every} sn` : null) + row("🎯", "Menzil", "Koridor", null) + (U.shoot.slow ? row("❄", "Yavaşlatma", "%50 · 3 sn", null) : "") + row("✦", "Kritik", `%${Math.round(CRIT.chance * 100)} · 2×`, null);
  if (U.pulse) html += row("⚔", "Alan hasarı", st.dmg, nx ? nx.dmg : null) + row("◎", "Menzil", st.radius, nx ? nx.radius : null) + row("⏱", "Dalga", `${st.every} sn`, nx ? `${nx.every} sn` : null);
  $("vsPopStats").innerHTML = html;
  const up = $("vsPopUp"), sell = $("vsPopSell");
  if (cost == null) { up.disabled = true; up.innerHTML = "★ En üst seviye"; up.classList.remove("is-poor"); }
  else { const poor = G.atp < cost; up.disabled = false; up.classList.toggle("is-poor", poor); up.innerHTML = `⬆ Yükselt <b>${cost} ATP</b>${poor ? `<small>−${cost - Math.floor(G.atp)} ATP</small>` : ""}`; }
  sell.innerHTML = `♻ Sat <b>+${sellValue(u)} ATP</b>`;
  const c = popIco.getContext("2d"), d = Math.min(window.devicePixelRatio || 1, 3);
  if (popIco.width !== 44 * d) { popIco.width = popIco.height = 44 * d; }
  c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, 44, 44); drawUnit(c, u.type, 22, 22, 46, 0.6, { lvl: u.lvl });
}
function positionPop() {
  if (!G.inspect) return;
  const b = wrap.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
  const cx = cr.left - b.left + PX(G.inspect.c + 0.5), cy = cr.top - b.top + PY(G.inspect.r);
  const w = pop.offsetWidth || 230, h = pop.offsetHeight || 180, s = L.cell;
  let x = cx - w / 2, y = cy - s * 0.6 - h;
  if (y < 4) y = cy + s * 0.6;
  if (y + h > b.height - 4) y = Math.max(4, b.height - h - 4);
  x = Math.max(6, Math.min(b.width - w - 6, x));
  pop.style.left = x + "px"; pop.style.top = y + "px";
  pop.classList.toggle("is-below", y > cy);
}
$("vsPopClose").addEventListener("click", () => { closePop(); renderHud(); });
$("vsPopUp").addEventListener("click", () => { if (!G.inspect) return; const btn = $("vsPopUp"); if (!upgrade(G.inspect.r, G.inspect.c)) shake(btn); pop._key = ""; renderHud(); fillPop(); positionPop(); });
$("vsPopSell").addEventListener("click", () => { if (!G.inspect) return; recycle(G.inspect.r, G.inspect.c); closePop(); renderHud(); });

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
  if (o) { collectOrb(o); return; }
  if (!p.inGrid) { closePop(); return; }
  if (G.selected === "recycle") { if (recycle(p.r, p.c)) { G.selected = null; renderHud(); } else sfx.deny(); return; }
  if (G.selected) {
    const k = G.selected;
    if (G.grid[p.r][p.c]) { sfx.deny(); return; }
    if (place(k, p.r, p.c)) { G.selected = null; renderHud(); } else sfx.deny();
    return;
  }
  // Yerleşik hücreye dokun → yükselt/sat kartı
  if (G.grid[p.r][p.c]) { if (G.inspect && G.inspect.r === p.r && G.inspect.c === p.c) closePop(); else openPop(p.r, p.c); }
  else closePop();
  renderHud();
});
canvas.addEventListener("pointermove", (ev) => {
  if (G.mode !== "run") return;
  const p = cellAt(ev);
  G.hover = p.inGrid && ev.pointerType === "mouse" ? { r: p.r, c: p.c } : null;
  if (ev.pointerType === "mouse" || ev.buttons || ev.pressure > 0) { const o = orbNear(p, 0.5); if (o) collectOrb(o); }
});
canvas.addEventListener("pointerleave", () => { G.hover = null; });
canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); G.selected = null; closePop(); renderHud(); });
$("vsUnits").addEventListener("click", (e) => { const b = e.target.closest(".vs-card"); if (b) { sfx.unlock(); select(b.dataset.unit); } });
$("vsRecycle").addEventListener("click", () => { sfx.unlock(); select("recycle"); });
function setSpeed(v) { if (G.mode === "paused") setPaused(false); G.speed = v; renderHud(); }
$("vsSpeed1").addEventListener("click", () => setSpeed(1));
$("vsSpeed2").addEventListener("click", () => setSpeed(2));
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
  else if ((e.key === "u" || e.key === "U") && G.inspect) $("vsPopUp").click();
  else if ((e.key === "x" || e.key === "X" || e.key === "Delete") && G.inspect) $("vsPopSell").click();
  else if (e.key === "Escape") { G.selected = null; closePop(); renderHud(); }
  else if (e.key === "f" || e.key === "F") { G.speed = G.speed === 1 ? 2 : 1; renderHud(); }
});
document.addEventListener("visibilitychange", () => { if (document.hidden && G.mode === "run") setPaused(true); });

function start() {
  sfx.unlock();
  G = fresh(); G.mode = "run"; pop.hidden = true;
  $("vsStart").hidden = true; $("vsOver").hidden = true; $("vsPause").hidden = true; $("vsPauseBtn").disabled = false;
  lastHud = ""; Object.keys(prevHud).forEach(k => delete prevHud[k]); renderHud();
  toast("İlk dalga birazdan: önce Yardımcı T-Hücresi kurun", "wave");
}
function setPaused(p) {
  if (G.mode !== "run" && G.mode !== "paused") return;
  G.mode = p ? "paused" : "run";
  $("vsPause").hidden = !p; $("vsPauseBtn").textContent = p ? "▶" : "⏸"; $("vsPauseBtn").setAttribute("aria-label", p ? "Devam et" : "Duraklat");
  lastHud = ""; renderHud();
}
function gameOver() {
  G.mode = "over"; sfx.over(); closePop();
  const best = Math.max(bestWave(), G.wave);
  $("vsOverWave").textContent = String(G.wave);
  $("vsOverKills").textContent = String(G.kills);
  $("vsOverBest").textContent = String(best);
  $("vsOverScore").textContent = String(G.score);
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
  state: () => ({ mode: G.mode, atp: G.atp, lives: G.lives, wave: G.wave, phase: G.phase, kills: G.kills, waveKills: G.waveKills, score: G.score, speed: G.speed, selected: G.selected, inspect: G.inspect, enemies: G.enemies.map(e => ({ type: e.type, row: e.row, x: +e.x.toFixed(2), hp: Math.round(e.hp), slow: e.slowT > 0 })), units: G.grid.flat().filter(Boolean).map(u => ({ type: u.type, r: u.r, c: u.c, hp: Math.round(u.hp), maxHp: u.maxHp, lvl: u.lvl, invested: u.invested })), orbs: G.orbs.map(o => ({ x: o.x, y: o.y, gold: o.gold, landed: o.landed })), recharge: { ...G.recharge }, floats: G.floats.map(f => f.text), ghosts: G.ghosts.length }),
  start,
  cellToClient: (r, c) => { const b = canvas.getBoundingClientRect(); return { x: b.left + PX(c + 0.5), y: b.top + PY(r) }; },
  pointToClient: (x, y) => { const b = canvas.getBoundingClientRect(); return { x: b.left + PX(x), y: b.top + y * L.cell }; },
  debug: {
    set: (patch) => Object.assign(G, patch),
    hold: (v) => { G.hold = !!v; },
    spawn: (type, row, x) => spawnEnemy(type, row, x),
    place: (type, r, c) => place(type, r, c, true),
    orb: (x, y, gold) => spawnOrb(x, y, !!gold),
    clear: () => { G.enemies = []; G.shots = []; G.orbs = []; },
    crit: (v) => { CRIT.chance = v; }
  }
};
