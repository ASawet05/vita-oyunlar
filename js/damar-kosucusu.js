/* Damar Yolu Koşucusu — oyun mantığı: 3 şeritli sonsuz koşu, çok katmanlı parkur, ritmik engel dalgaları,
   tökezleme + toksin dalgası, Biyo-Sörf Kapsülü, Biyo-Frenzy, güçlendiriciler, Biyo-Mağaza, klavye + dokunmatik.
   Çizim: js/damar/cizim.js · Ses: js/damar/ses.js · Kayıt: js/damar/kayit.js · Veri: js/damar/ayar.js */
import { LW, LANES, PLAT_H, PLAYER_H, GRAV, JUMP_V, SUPER_V, TRAMP_V, SLIDE_T, BUFFER_T, CHASE_T, SHIELD_T, FRENZY_T, FRENZY_N, POWER_T,
  SPEED0, SPEED_MAX, SPEED_PER_M, ZONE_LEN, VITAMINS, VIT_KEYS, POWERS, CHARS, CAPS, STOCK_PRICE, STOCK_MAX, MISSIONS, MISSION_BONUS } from "./damar/ayar.js";
import { createRenderer, drawCharIcon } from "./damar/cizim.js";
import { Ses } from "./damar/ses.js";
import { loadProfile, saveProfile } from "./damar/kayit.js";

const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

const canvas = $("dkCanvas"), R = createRenderer(canvas);
let profile = loadProfile();
Ses.setOn(profile.sound);

const newPlayer = () => ({ lane: 1, prevLane: 1, x: 0, y: 0, vy: 0, ground: true, surf: 0, slideT: 0, tilt: 0, phase: 0, sqx: 1, sqy: 1, land: 0, stumbleT: 0, invT: 0, bufJump: 0, bufSlide: 0, laneT: 9 });
const G = {
  mode: "menu", t: 0, dt: 0.016, dist: 0, speed: 7, ents: [], parts: [], pops: [], trail: [], player: newPlayer(),
  threat: 0, chaseT: 0, stumbled: false, shieldT: 0, frenzyT: 0, powers: { magnet: 0, spring: 0, x2: 0 }, streak: 0, lastGot: -9,
  flash: 0, flashC: "rgba(255,255,255,A)", shake: 0, score: 0, vp: 0, vits: {}, baseMult: 1, genD: 0, lastPow: 0, lastPat: "",
  mission: null, mProg: 0, mDone: false, zone: 0, char: profile.char, cap: profile.cap, deadT: 0, heartT: 0, seenBridge: false
};

/* ================= Parkur üretimi (adil, ritmik dalgalar) ================= */
const add = e => { G.ents.push(e); return e; };
const kindFor = () => pick(VIT_KEYS);
function coins(lane, d0, n, { y = 0.95, step = 2.3, kind = kindFor(), rare = false } = {}) { for (let i = 0; i < n; i++) add({ t: "vit", lane, x: LANES[lane], y, d: d0 + i * step, kind, rare }); }
function arc(lane, d0, span, peak, n, opt = {}) { const kind = opt.kind || kindFor(); for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; add({ t: "vit", lane, x: LANES[lane], y: (opt.base ?? 0.95) + 4 * peak * u * (1 - u), d: d0 + span * u, kind, rare: !!opt.rare }); } }
const others = l => [0, 1, 2].filter(x => x !== l);
const react = () => Math.max(13, G.speed * 0.95);        // iki engel sırası arası en az tepki mesafesi

const PAT = {
  coins(d) { const l = pick([0, 1, 2]); coins(l, d + 2, 7); return 20; },
  low1(d) { const l = pick([0, 1, 2]); add({ t: "low", lane: l, d: d + 8 }); arc(l, d + 8 - G.speed * 0.3, G.speed * 0.6, 1.1, 5); coins(pick(others(l)), d + 2, 5); return 18; },
  lowRow(d) { for (const l of [0, 1, 2]) add({ t: "low", lane: l, d: d + 8 }); const l = pick([0, 1, 2]); arc(l, d + 8 - G.speed * 0.3, G.speed * 0.6, 1.1, 5); return 18; },
  archRow(d) { for (const l of [0, 1, 2]) add({ t: "arch", lane: l, d: d + 8 }); coins(pick([0, 1, 2]), d + 3, 5, { y: 0.45 }); return 18; },
  mixRow(d) { const ty = shuffle(["low", "arch", "block"]); ty.forEach((t, l) => add({ t, lane: l, d: d + 8 })); const l = ty.indexOf("low"); arc(l, d + 8 - G.speed * 0.3, G.speed * 0.6, 1.1, 4); return 18; },
  two(d) { const open = pick([0, 1, 2]); for (const l of others(open)) add({ t: "block", lane: l, d: d + 9 }); coins(open, d + 2, 7); return 20; },
  zig(d) { const a = pick([0, 1, 2]), b = pick(others(a)), gap = react() + 3; for (const l of others(a)) add({ t: "block", lane: l, d: d + 8 }); for (const l of others(b)) add({ t: "block", lane: l, d: d + 8 + gap }); coins(a, d + 2, 4); coins(b, d + 8 + gap * 0.45, 4); return 16 + gap + 4; },
  slalom(d) { const order = shuffle([0, 1, 2]), gap = react(); order.forEach((l, i) => add({ t: i % 2 ? "low" : "block", lane: l, d: d + 8 + i * gap * 0.75 })); coins(order[2], d + 3, 5); return 14 + gap * 1.5 + 6; },
  mover(d) { const l = pick([0, 1, 2]), o = others(l); add({ t: "mover", lane: l, d: d + 70, v: 9 + Math.random() * 4 }); coins(o[0], d + 4, 8); add({ t: "low", lane: o[1], d: d + 26 }); return 46; },
  tramp(d) { // trambolin → fibrin köprüsü (üstte nadir vitaminler); zeminde diğer iki şeritte alçak engel
    const l = pick([0, 1, 2]), len = Math.max(30, G.speed * 2.6), ps = d + 8 + 6;
    add({ t: "tramp", lane: l, d: d + 8 }); arc(l, d + 9, 5, 0.9, 3, { base: 2.2 });
    add({ t: "plat", lane: l, d: ps, len }); coins(l, ps + 3, Math.floor((len - 6) / 2.6), { y: PLAT_H + 0.95, step: 2.6, rare: true });
    for (const o of others(l)) add({ t: "low", lane: o, d: ps + len * 0.5 }); coins(pick(others(l)), d + 6, 4);
    return 14 + len + 12;
  },
  ramp(d) { const l = pick([0, 1, 2]), len = Math.max(28, G.speed * 2.4), rs = d + 6, ps = rs + 7;
    add({ t: "ramp", lane: l, d: rs, len: 7 }); add({ t: "plat", lane: l, d: ps, len });
    coins(l, ps + 2, Math.floor((len - 5) / 2.6), { y: PLAT_H + 0.95, step: 2.6, rare: true });
    const o = others(l); add({ t: "arch", lane: o[0], d: ps + len * 0.4 }); add({ t: "low", lane: o[1], d: ps + len * 0.4 });
    return 13 + len + 12;
  },
  bridges(d) { // trambolin → köprü A → boşluk → köprü B (platformdan platforma atlama)
    const a = pick([0, 1, 2]), b = pick([a, ...others(a).filter(x => Math.abs(x - a) === 1)]), lenA = Math.max(24, G.speed * 2), lenB = Math.max(24, G.speed * 2), gap = clamp(G.speed * 0.3, 4, 7), ps = d + 14;
    add({ t: "tramp", lane: a, d: d + 8 }); add({ t: "plat", lane: a, d: ps, len: lenA }); coins(a, ps + 3, Math.floor((lenA - 7) / 2.6), { y: PLAT_H + 0.95, step: 2.6, rare: true });
    const pb = ps + lenA + gap; add({ t: "plat", lane: b, d: pb, len: lenB }); arc(b, ps + lenA - 1, gap + 2, 0.7, 3, { base: PLAT_H + 1.2, rare: true }); coins(b, pb + 4, Math.floor((lenB - 7) / 2.6), { y: PLAT_H + 0.95, step: 2.6, rare: true });
    const free = [0, 1, 2].filter(x => x !== a && x !== b); if (free.length) add({ t: "block", lane: free[0], d: ps + lenA * 0.6 });
    return 14 + lenA + gap + lenB + 12;
  },
  power(d) { const l = pick([0, 1, 2]), k = pick(Object.keys(POWERS)); add({ t: "pow", lane: l, x: LANES[l], y: 1.05, d: d + 10, kind: k }); coins(l, d + 2, 3); return 20; }
};
const WEIGHTS = [
  { coins: 2, low1: 4, lowRow: 2, archRow: 2, two: 3, mixRow: 1, tramp: 1.4, ramp: 1, zig: 0.8 },
  { coins: 1, low1: 2, lowRow: 1.5, archRow: 1.5, two: 2, mixRow: 2, tramp: 3.2, ramp: 2.6, bridges: 2.6, zig: 1, slalom: 1 },
  { coins: 0.6, low1: 1.5, lowRow: 2, archRow: 2, two: 2, mixRow: 2.5, zig: 2.6, slalom: 2.4, mover: 3, tramp: 1.2, bridges: 1.2, ramp: 0.8 }
];
function generate() {
  while (G.genD < G.dist + 135) {
    let name;
    if (G.genD < 26) name = "coins";
    else if (G.genD - G.lastPow > 230 && Math.random() < 0.6) { name = "power"; G.lastPow = G.genD; }
    else {
      const w = WEIGHTS[Math.min(2, Math.floor(G.genD / ZONE_LEN))], keys = Object.keys(w).filter(k => k !== G.lastPat);
      let r = Math.random() * keys.reduce((s, k) => s + w[k], 0); name = keys[keys.length - 1];
      for (const k of keys) { r -= w[k]; if (r <= 0) { name = k; break; } }
    }
    G.lastPat = name;
    const zoneK = G.genD >= ZONE_LEN * 2 ? 0.9 : 1;
    G.genD += PAT[name](G.genD) + Math.max(8, G.speed * 0.55) * zoneK;
  }
}

/* ================= Efektler ================= */
function burst(x, y, z, c, n = 14, pw = 7) { for (let i = 0; i < n && G.parts.length < 170; i++) G.parts.push({ x, y, z, vx: rnd(-pw, pw), vy: rnd(-1, pw), vz: rnd(-pw * 0.5, pw * 0.5), life: rnd(0.35, 0.7), max: 0.7, r: rnd(0.07, 0.18), c }); }
function pop(txt, c = "#fff", y = 2.2) { G.pops.push({ x: G.player.x, y: G.player.y + y, z: 0.2, txt, c, life: 1 }); if (G.pops.length > 8) G.pops.shift(); }
function flash(c, a = 1) { G.flashC = c; G.flash = a; }
let toastTimer = 0;
function toast(txt, color = "#fff") { const el = $("dkToast"); el.hidden = true; void el.offsetWidth; el.textContent = txt; el.style.color = color; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 1650); }
function strip(txt, done) { const el = $("dkMission"); el.hidden = true; void el.offsetWidth; el.textContent = txt; el.classList.toggle("is-done", !!done); el.hidden = false; setTimeout(() => { if (el.textContent === txt) el.hidden = true; }, 3050); }

/* ================= Oyun akışı ================= */
const mult = () => (G.baseMult + Math.min(5, Math.floor(G.dist / ZONE_LEN)) + (G.mDone ? 1 : 0)) * (G.powers.x2 > 0 ? 2 : 1) * (G.frenzyT > 0 ? 3 : 1);
function missionAdd(id, n = 1) {
  if (!G.mission || G.mDone || G.mission.id !== id) return;
  G.mProg += n;
  if (G.mProg >= G.mission.n) { G.mDone = true; G.vp += MISSION_BONUS; Ses.mission(); strip(`Görev tamam! +${MISSION_BONUS} Vita-Puan · çarpan +1`, true); }
}
function start() {
  Ses.unlock();
  Object.assign(G, { mode: "run", dist: 0, speed: SPEED0, ents: [], parts: [], pops: [], trail: [], player: newPlayer(), threat: 0, chaseT: CHASE_T, stumbled: false,
    shieldT: 0, frenzyT: 0, powers: { magnet: 0, spring: 0, x2: 0 }, streak: 0, lastGot: -9, flash: 0, shake: 0, score: 0, vp: 0, vits: {}, genD: 0, lastPow: 60, lastPat: "",
    mProg: 0, mDone: false, zone: 0, char: profile.char, cap: profile.cap, deadT: 0, heartT: 0, seenBridge: false });
  G.baseMult = 1 + (G.char === "b12" ? 1 : 0);
  if (G.char === "demir") G.powers.magnet = 3;
  G.mission = pick(MISSIONS);
  generate();
  for (const id of ["dkMenu", "dkOver", "dkPause", "dkShop", "dkHelp"]) $(id).hidden = true;
  $("dkHud").hidden = false; $("dkToast").hidden = true;
  strip(G.mission.text(G.mission.n)); hud(true);
}
function die(reason) {
  if (G.mode !== "run") return;
  G.mode = "dying"; G.deadT = 0.85; G.deathReason = reason; G.shake = 1; flash("rgba(255,80,80,A)", 1);
  Ses.over(); burst(G.player.x, G.player.y + 0.9, 0, "#fecaca", 26, 9);
  if (navigator.vibrate) try { navigator.vibrate(120); } catch (_) {}
}
function finish() {
  G.mode = "over";
  const score = Math.floor(G.score), record = score > profile.best;
  profile.vp += G.vp; profile.runs++; if (record) profile.best = score; saveProfile(profile);
  $("dkHud").hidden = true;
  $("dkOverTitle").textContent = G.deathReason === "caught" ? "Toksin Dalgası Yakaladı!" : "Damar Tıkandı!";
  $("dkRecord").hidden = !record;
  $("dkOverScore").textContent = score.toLocaleString("tr-TR"); $("dkOverBest").textContent = profile.best.toLocaleString("tr-TR"); $("dkOverVp").textContent = "+" + G.vp;
  const top = Object.keys(G.vits).sort((a, b) => G.vits[b] - G.vits[a])[0] || pick(VIT_KEYS);
  $("dkFact").textContent = (G.vits[top] ? `Bu tur en çok ${VITAMINS[top].name} topladın. ` : "") + pick(VITAMINS[top].facts);
  $("dkOver").hidden = false; setTimeout(() => $("dkAgain").focus(), 60);
}
function toMenu() {
  G.mode = "menu"; G.ents = []; G.parts = []; G.pops = []; G.threat = 0; G.chaseT = 0; G.shieldT = 0; G.frenzyT = 0; G.powers = { magnet: 0, spring: 0, x2: 0 }; G.player = newPlayer(); G.speed = 7;
  G.char = profile.char; G.cap = profile.cap;
  for (const id of ["dkOver", "dkPause", "dkHud", "dkShop", "dkHelp"]) $(id).hidden = true;
  $("dkMenu").hidden = false; menuInfo();
}
function menuInfo() { $("dkBank").textContent = profile.vp.toLocaleString("tr-TR"); $("dkBestLine").textContent = profile.best ? `En yüksek skor: ${profile.best.toLocaleString("tr-TR")}` : ""; }
function pause(on) {
  if (on && G.mode === "run") { G.mode = "pause"; $("dkPause").hidden = false; $("dkResume").focus(); }
  else if (!on && G.mode === "pause") { G.mode = "run"; $("dkPause").hidden = true; last = performance.now(); }
}

/* ================= Oyuncu komutları ================= */
function moveLane(dir) {
  if (G.mode !== "run") return; const pl = G.player, n = clamp(pl.lane + dir, 0, 2);
  if (n === pl.lane) return; pl.prevLane = pl.lane; pl.lane = n; pl.laneT = 0; Ses.lane();
}
function doJump() {
  const pl = G.player; pl.ground = false; pl.slideT = 0; pl.bufJump = 0;
  const sup = G.powers.spring > 0; pl.vy = (sup ? SUPER_V : JUMP_V) * (G.char === "d3" ? Math.sqrt(1.15) : 1);
  pl.sqx = 0.85; pl.sqy = 1.2; sup ? Ses.superJump() : Ses.jump();
}
function doSlide() { const pl = G.player; pl.slideT = SLIDE_T; pl.bufSlide = 0; Ses.slide(); }
function jump() { if (G.mode !== "run") return; const pl = G.player; if (pl.ground) doJump(); else pl.bufJump = BUFFER_T; }
function down() {
  if (G.mode !== "run") return; const pl = G.player;
  if (pl.ground) doSlide(); else { pl.vy = Math.min(pl.vy, -26); pl.bufSlide = 0.4; }   // havada: yere çakıl, inince kay
}
function useCapsule() {
  if (G.mode !== "run" || G.shieldT > 0 || profile.stock <= 0) { if (G.mode === "run" && G.shieldT <= 0) Ses.deny(); return; }
  profile.stock--; saveProfile(profile); G.shieldT = SHIELD_T; Ses.shield(); flash("rgba(94,234,212,A)", 0.6); toast("Biyo-Sörf Kapsülü", CAPS[G.cap].c1); hud(true);
}

/* ================= Çarpışma ================= */
function smash(e, z) { e.smashed = true; const c = e.t === "low" ? "#fbbf24" : e.t === "arch" ? "#d8b4fe" : e.t === "mover" ? "#fde047" : "#fca5a5"; burst(LANES[e.lane], 1, z, c, 22, 9); Ses.smash(); G.shake = 0.6; G.score += 50 * mult(); pop("+" + 50 * mult(), "#fde047"); }
function stumble(e) {
  const pl = G.player; e.hit = true;
  if (G.chaseT > 0 && G.stumbled) return die("caught");
  G.stumbled = true; G.chaseT = CHASE_T; pl.stumbleT = 1; pl.invT = 0.9; G.shake = 0.5; G.streak = 0; Ses.stumble(); flash("rgba(255,120,120,A)", 0.5); toast("Tökezledin!", "#fca5a5");
  if (navigator.vibrate) try { navigator.vibrate(60); } catch (_) {}
}
function hitObstacle(e, z, side) {
  const pl = G.player;
  if (G.frenzyT > 0) return smash(e, z);
  if (G.shieldT > 0) { smash(e, z); G.shieldT = 0; pl.invT = 1; flash("rgba(94,234,212,A)", 0.8); toast("Kapsül kırıldı!", "#99f6e4"); hud(true); return; }
  if (pl.invT > 0) { e.hit = true; return; }
  if (side) { pl.lane = pl.prevLane; pl.laneT = 9; return stumble(e); }
  e.hit = true; die("crash");
}
function collide(dt) {
  const pl = G.player, moving = pl.laneT < 0.24;   // şerit değişimi sürüyor: bu sırada girilen şeritteki engel "yandan sürtme"dir
  for (const e of G.ents) {
    if (e.hit || e.got || e.smashed) continue;
    const z = e.d - G.dist, t = e.t;
    if (t === "vit" || t === "pow") {
      if (t === "vit" && G.powers.magnet > 0 && z < 17 && z > -1) { e.pull = Math.min(1, (e.pull || 0) + dt * 3.5); const k = e.pull * e.pull; e.x = lerp(e.x, pl.x, k * 0.35); e.y = lerp(e.y, pl.y + 0.95, k * 0.35); e.d -= dt * e.pull * 16; }
      if (Math.abs(z) < 1.0 && Math.abs(e.x - pl.x) < 1.0 && Math.abs(e.y - (pl.y + (pl.slideT > 0 ? 0.45 : 0.95))) < 1.15) {
        e.got = true;
        if (t === "pow") { G.powers[e.kind] = POWER_T; Ses.power(); toast(POWERS[e.kind].name, POWERS[e.kind].color); flash("rgba(255,255,255,A)", 0.4); burst(e.x, e.y, 0, POWERS[e.kind].color, 16); hud(true); continue; }
        const val = e.rare ? 3 : 1; G.vp += val; G.vits[e.kind] = (G.vits[e.kind] || 0) + 1; G.streak++; G.lastGot = G.t;
        G.score += 10 * val * mult(); Ses.collect(G.streak); burst(e.x, e.y, 0.2, VITAMINS[e.kind].c1, 5, 4); missionAdd("vit");
        if (G.streak >= FRENZY_N && G.frenzyT <= 0) { G.frenzyT = FRENZY_T; G.streak = 0; Ses.frenzy(); toast("Biyo-Frenzy! x3", "#fde047"); flash("rgba(253,224,71,A)", 0.9); hud(true); }
      } else if (z < -1.3 && !e.missed) { e.missed = true; if (t === "vit" && G.t - G.lastGot > 0.75) G.streak = 0; }
      continue;
    }
    if (t === "plat" || t === "ramp") continue;
    if (t === "mover") e.d -= e.v * dt;
    const dx = Math.abs(LANES[e.lane] - pl.x), reach = (G.speed + (e.v || 0)) * dt + 0.75;
    if (t === "tramp") { if (pl.ground && pl.surf < 0.05 && dx < 0.95 && z < 0.9 && z > -0.9) { e.hit = true; pl.ground = false; pl.slideT = 0; pl.vy = TRAMP_V; pl.sqx = 0.8; pl.sqy = 1.3; Ses.tramp(); burst(pl.x, 0.2, 0, "#bef264", 12, 5); missionAdd("tramp"); } continue; }
    if (z > reach || z < -0.75) { if (z < -0.75 && !e.passed) { e.passed = true; if (!e.hit && e.lane === pl.lane) { if (t === "low" && !pl.ground) missionAdd("jump"); if (t === "arch" && pl.slideT > 0) missionAdd("slide"); } } continue; }
    const leaving = moving && e.lane === pl.prevLane && e.lane !== pl.lane;
    if (dx > (leaving ? 0.7 : 1.25)) continue;
    const side = moving && e.lane === pl.lane;
    if (t === "low") { if (pl.y > 0.88) continue; if (pl.y > 0.42 && !side) { if (G.frenzyT > 0 || G.shieldT > 0) hitObstacle(e, z, false); else if (pl.invT <= 0) stumble(e); else e.hit = true; continue; } }
    else if (t === "arch") { if (pl.slideT > 0 && pl.y < 0.3) continue; if (pl.y > 2.3) continue; }
    else if (pl.y > 2.05) continue;                    // duvar / serbest radikal: üstünden (köprüden) geçilebilir
    hitObstacle(e, z, side);
    if (G.mode !== "run") return;
  }
}

/* Oyuncunun bastığı yüzey: zemin (0), rampa ya da köprü */
function surfaceAt(pl) {
  let h = 0;
  for (const e of G.ents) {
    if (e.t !== "plat" && e.t !== "ramp") continue;
    const z = e.d - G.dist; if (z > 0.35 || z + e.len < -0.35) continue;
    if (Math.abs(LANES[e.lane] - pl.x) > 1.05) continue;
    const sh = e.t === "plat" ? PLAT_H : clamp(-z / e.len) * PLAT_H;
    if (pl.y >= sh - (e.t === "ramp" ? 0.75 : 0.3)) h = Math.max(h, sh);
    else if (e.t === "plat" && pl.vy > 0 && pl.y + PLAYER_H * 0.8 > PLAT_H - 0.3) pl.vy = 0;   // alttan kafa çarpması
  }
  return h;
}

/* ================= Güncelleme ================= */
function update(dt) {
  const pl = G.player; G.t += dt; G.dt = dt;
  G.flash = Math.max(0, G.flash - dt * 2.4); G.shake = Math.max(0, G.shake - dt * 2.2);
  for (const q of G.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += (q.vz - G.speed * 0.5) * dt; q.vy -= 14 * dt; }
  G.parts = G.parts.filter(q => q.life > 0);
  for (const q of G.pops) q.life -= dt * 1.3; G.pops = G.pops.filter(q => q.life > 0);

  if (G.mode === "menu") { G.dist += G.speed * dt; pl.phase += dt * 9; pl.x = lerp(pl.x, Math.sin(G.t * 0.5) * 1.6, dt * 2); G.trail.push({ x: pl.x, y: 0, t: G.t }); if (G.trail.length > 24) G.trail.shift(); return; }
  if (G.mode === "dying") { G.speed = lerp(G.speed, 0, dt * 6); G.dist += G.speed * dt; G.threat = clamp(G.threat + dt * (G.deathReason === "caught" ? 4 : 0)); G.deadT -= dt; if (G.deadT <= 0) finish(); return; }
  if (G.mode !== "run") return;

  G.speed = Math.min(SPEED_MAX, SPEED0 + G.dist * SPEED_PER_M + (G.dist > ZONE_LEN * 2 ? 1.5 : 0)) * (pl.stumbleT > 0 ? 0.82 : 1);
  const step = G.speed * dt; G.dist += step; G.score += step * mult(); missionAdd("dist", step);
  const zi = Math.floor(G.dist / ZONE_LEN);
  if (zi !== G.zone) { G.zone = zi; if (zi <= 2) { toast(R.zoneName(G.dist), "#fff"); Ses.zone(); flash("rgba(255,255,255,A)", 0.5); } pop("Çarpan +1", "#5eead4"); hud(true); }

  // yatay: yumuşak şerit geçişi + yana yatma
  const tx = LANES[pl.lane], dxl = tx - pl.x; pl.x += dxl * clamp(dt * 15); if (Math.abs(dxl) < 0.02) pl.x = tx;
  pl.tilt = lerp(pl.tilt, clamp(dxl * 0.32, -0.42, 0.42), clamp(dt * 16));
  // dikey
  const surf = surfaceAt(pl); pl.surf = surf;
  if (pl.ground) {
    if (surf < pl.y - 0.4) { pl.ground = false; pl.vy = 0; }                         // köprü bitti: düş
    else { pl.y = surf; if (surf >= PLAT_H - 0.01 && !G.seenBridge) { G.seenBridge = true; missionAdd("bridge"); } }
  }
  if (!pl.ground) {
    pl.vy -= GRAV * dt; pl.y += pl.vy * dt;
    if (pl.bufJump > 0) pl.bufJump -= dt; if (pl.bufSlide > 0) pl.bufSlide -= dt;
    if (pl.y <= surf && pl.vy <= 0) {
      pl.y = surf; pl.ground = true; pl.land = 0.16; Ses.land(); burst(pl.x, surf + 0.05, 0, "rgba(255,255,255,.7)", 5, 3);
      if (surf >= PLAT_H - 0.01 && !G.seenBridge) { G.seenBridge = true; missionAdd("bridge"); }
      if (pl.bufJump > 0) doJump(); else if (pl.bufSlide > 0) doSlide();
    }
  }
  if (pl.slideT > 0) { pl.slideT -= dt; if (Math.random() < 0.6) G.parts.push({ x: pl.x + rnd(-0.4, 0.4), y: pl.y + 0.05, z: -0.2, vx: rnd(-2, 2), vy: rnd(1, 3), vz: 0, life: 0.3, max: 0.3, r: 0.07, c: "#5eead4" }); }
  // esne-uza
  if (pl.land > 0) { pl.land -= dt; const k = pl.land / 0.16; pl.sqx = 1 + 0.22 * k; pl.sqy = 1 - 0.24 * k; }
  else if (!pl.ground) { const k = clamp(Math.abs(pl.vy) / 22); pl.sqx = lerp(pl.sqx, 1 - 0.1 * k, dt * 12); pl.sqy = lerp(pl.sqy, 1 + 0.16 * k, dt * 12); }
  else { pl.sqx = lerp(pl.sqx, 1, dt * 14); pl.sqy = lerp(pl.sqy, 1, dt * 14); }
  pl.phase += dt * (6 + G.speed * 0.42);
  if (pl.stumbleT > 0) pl.stumbleT -= dt; if (pl.invT > 0) pl.invT -= dt; pl.laneT += dt;
  G.trail.push({ x: pl.x, y: pl.y, t: G.t }); if (G.trail.length > 26) G.trail.shift();

  // zamanlayıcılar
  for (const k in G.powers) if (G.powers[k] > 0) { G.powers[k] -= dt; if (G.powers[k] <= 0) hud(true); }
  if (G.shieldT > 0) { G.shieldT -= dt; if (G.shieldT <= 0) hud(true); }
  if (G.frenzyT > 0) { G.frenzyT -= dt; if (Math.random() < 0.7) G.parts.push({ x: pl.x + rnd(-0.5, 0.5), y: pl.y + rnd(0.2, 1.7), z: -0.1, vx: rnd(-1, 1), vy: rnd(1, 4), vz: 0, life: 0.45, max: 0.45, r: 0.09, c: "#fde047" }); if (G.frenzyT <= 0) hud(true); }
  if (G.chaseT > 0) {
    G.chaseT -= dt; G.threat = clamp(G.threat + dt * 3);
    G.heartT -= dt; if (G.heartT <= 0) { const near = G.stumbled ? 1 : 0.4; Ses.heart(near); G.heartT = lerp(0.85, 0.36, near * clamp(1 - G.chaseT / CHASE_T + 0.4)); }
    if (G.chaseT <= 0) G.stumbled = false;
  } else G.threat = Math.max(0, G.threat - dt * 1.4);

  collide(dt);
  if (G.mode !== "run") return;
  G.ents = G.ents.filter(e => !e.got && !e.smashed && (e.d + (e.len || 0)) - G.dist > -9);
  generate(); hud(false);
}

/* ================= HUD ================= */
const RINGS = [["shield", "S", () => G.shieldT / SHIELD_T, () => CAPS[G.cap].c1], ["frenzy", "★", () => G.frenzyT / FRENZY_T, () => "#fde047"],
  ["magnet", "U", () => G.powers.magnet / POWER_T, () => POWERS.magnet.color], ["spring", "⇡", () => G.powers.spring / POWER_T, () => POWERS.spring.color], ["x2", "2x", () => G.powers.x2 / POWER_T, () => POWERS.x2.color]];
const ringEls = {};
(function buildRings() {
  const host = $("dkRings");
  for (const [id, label] of RINGS) {
    const d = document.createElement("div"); d.className = "dk-ring"; d.hidden = true;
    d.innerHTML = `<svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="20"/><circle cx="23" cy="23" r="20" stroke-dasharray="125.66" stroke-dashoffset="0"/></svg><span>${label}</span>`;
    host.appendChild(d); ringEls[id] = { el: d, arc: d.querySelectorAll("circle")[1] };
  }
})();
let hudScore = -1, hudVp = -1, hudMult = -1;
function hud(force) {
  const s = Math.floor(G.score), m = mult();
  if (s !== hudScore) { hudScore = s; $("dkScore").textContent = s.toLocaleString("tr-TR"); }
  if (G.vp !== hudVp) { hudVp = G.vp; $("dkVp").textContent = G.vp; }
  if (m !== hudMult || force) { hudMult = m; const el = $("dkMult"); el.textContent = "x" + m; el.classList.toggle("is-hot", G.frenzyT > 0 || G.powers.x2 > 0); }
  for (const [id, , frac, color] of RINGS) {
    const f = frac(), r = ringEls[id];
    if (f > 0) { if (r.el.hidden) { r.el.hidden = false; r.el.style.setProperty("--c", color()); } r.arc.setAttribute("stroke-dashoffset", (125.66 * (1 - clamp(f))).toFixed(1)); }
    else if (!r.el.hidden) r.el.hidden = true;
  }
  if (force) {
    const b = $("dkCapBtn"); $("dkCapN").textContent = profile.stock; b.disabled = profile.stock <= 0 && G.shieldT <= 0; b.classList.toggle("is-on", G.shieldT > 0); b.style.setProperty("--capc", CAPS[profile.cap].c1);
  }
}
const SND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
function soundUi() { const b = $("dkSound"); b.innerHTML = profile.sound ? SND_ON : SND_OFF; b.setAttribute("aria-pressed", String(profile.sound)); b.setAttribute("aria-label", profile.sound ? "Sesi kapat" : "Sesi aç"); }

/* ================= Biyo-Mağaza ================= */
let shopTab = "chars";
const coin = '<i class="dk-coin" aria-hidden="true"></i>';
function renderShop() {
  $("dkShopBank").textContent = profile.vp.toLocaleString("tr-TR");
  document.querySelectorAll("#dkShop [data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === shopTab)));
  const body = $("dkShopBody"); body.innerHTML = "";
  const item = (kind, key, def, owned, selected, preview, desc) => {
    const d = document.createElement("div"); d.className = "dk-item" + (selected ? " is-sel" : "");
    const st = selected ? "sel" : owned ? "own" : "buy";
    d.innerHTML = `${preview}<b>${def.name}</b><small>${desc}</small><button type="button" data-kind="${kind}" data-key="${key}" data-state="${st}" ${st === "sel" || (st === "buy" && profile.vp < def.price) ? "disabled" : ""}>${st === "sel" ? "Seçili" : st === "own" ? "Seç" : coin + def.price}</button>`;
    body.appendChild(d); return d;
  };
  if (shopTab === "chars") for (const k in CHARS) { const d = item("char", k, CHARS[k], profile.chars.includes(k), profile.char === k, "<canvas></canvas>", CHARS[k].perk); drawCharIcon(d.querySelector("canvas"), k); }
  else if (shopTab === "caps") for (const k in CAPS) item("cap", k, CAPS[k], profile.caps.includes(k), profile.cap === k, `<span class="dk-sw"><i style="--a:${CAPS[k].c1};--b:${CAPS[k].c2}"></i></span>`, "Biyo-Sörf Kapsülü tasarımı");
  else {
    const d = document.createElement("div"); d.className = "dk-stock"; const full = profile.stock >= STOCK_MAX;
    d.innerHTML = `<p><b>Kapsül stoğu: ${profile.stock} / ${STOCK_MAX}</b>Tek kullanımlık Biyo-Sörf Kapsülü: 10 sn korur, ilk çarpmada engeli parçalar.</p><button type="button" data-kind="stock" ${full || profile.vp < STOCK_PRICE ? "disabled" : ""}>${full ? "Dolu" : coin + STOCK_PRICE}</button>`;
    body.appendChild(d);
  }
}
$("dkShopBody").addEventListener("click", ev => {
  const b = ev.target.closest("button[data-kind]"); if (!b || b.disabled) return;
  const { kind, key, state } = b.dataset;
  if (kind === "stock") { if (profile.vp < STOCK_PRICE || profile.stock >= STOCK_MAX) return Ses.deny(); profile.vp -= STOCK_PRICE; profile.stock++; Ses.buy(); }
  else {
    const defs = kind === "char" ? CHARS : CAPS, list = kind === "char" ? profile.chars : profile.caps;
    if (state === "buy") { if (profile.vp < defs[key].price) return Ses.deny(); profile.vp -= defs[key].price; list.push(key); Ses.buy(); } else Ses.click();
    if (kind === "char") { profile.char = key; G.char = key; } else { profile.cap = key; G.cap = key; }
  }
  saveProfile(profile); renderShop(); menuInfo();
});
document.querySelectorAll("#dkShop [data-tab]").forEach(b => b.addEventListener("click", () => { shopTab = b.dataset.tab; Ses.click(); renderShop(); }));
const openShop = () => { Ses.unlock(); Ses.click(); renderShop(); $("dkShop").hidden = false; };
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => { Ses.click(); b.closest(".dk-over").hidden = true; }));
for (const id of ["dkShop", "dkHelp"]) $(id).addEventListener("pointerdown", ev => { if (ev.target === ev.currentTarget) ev.currentTarget.hidden = true; });

/* ================= Düğmeler ================= */
$("dkPlay").addEventListener("click", start);
$("dkAgain").addEventListener("click", start);
$("dkShopBtn").addEventListener("click", openShop);
$("dkOverShop").addEventListener("click", openShop);
$("dkHelpBtn").addEventListener("click", () => { Ses.unlock(); Ses.click(); $("dkHelp").hidden = false; });
$("dkOverMenu").addEventListener("click", toMenu);
$("dkQuit").addEventListener("click", toMenu);
$("dkResume").addEventListener("click", () => pause(false));
$("dkPauseBtn").addEventListener("click", () => pause(true));
$("dkCapBtn").addEventListener("click", useCapsule);
$("dkSound").addEventListener("click", () => { profile.sound = !profile.sound; Ses.setOn(profile.sound); saveProfile(profile); soundUi(); if (profile.sound) { Ses.unlock(); Ses.click(); } });

/* ================= Klavye ================= */
addEventListener("keydown", ev => {
  const k = ev.key, c = ev.code;
  if (k === "Escape") { const open = ["dkShop", "dkHelp"].map($).find(x => !x.hidden); if (open) open.hidden = true; else if (G.mode === "run") pause(true); else if (G.mode === "pause") pause(false); ev.preventDefault(); return; }
  if (G.mode === "menu" || G.mode === "over") { if ((k === "Enter" || c === "Space") && $("dkShop").hidden && $("dkHelp").hidden && !ev.repeat && !(document.activeElement && document.activeElement.tagName === "BUTTON" && k === "Enter")) { ev.preventDefault(); if (!(document.activeElement && document.activeElement.tagName === "BUTTON")) start(); } return; }
  if (G.mode !== "run") return;
  if (k === "ArrowLeft" || c === "KeyA") moveLane(-1);
  else if (k === "ArrowRight" || c === "KeyD") moveLane(1);
  else if (k === "ArrowUp" || c === "KeyW") { if (!ev.repeat) jump(); }
  else if (k === "ArrowDown" || c === "KeyS") { if (!ev.repeat) down(); }
  else if (c === "Space" || c === "KeyE") { if (!ev.repeat) useCapsule(); }
  else if (c === "KeyP") pause(true);
  else return;
  ev.preventDefault();
});

/* ================= Dokunmatik: eşik geçildiği anda tepki veren kaydırma + çift dokunma ================= */
const ptr = { id: null, x: 0, y: 0, t: 0, fired: false, moved: 0 }; let lastTap = 0;
const TH = () => Math.max(14, Math.min(26, R.view.W * 0.045));
canvas.addEventListener("pointerdown", ev => { Ses.unlock(); ptr.id = ev.pointerId; ptr.x = ev.clientX; ptr.y = ev.clientY; ptr.t = performance.now(); ptr.fired = false; ptr.moved = 0; try { canvas.setPointerCapture(ev.pointerId); } catch (_) {} ev.preventDefault(); });
canvas.addEventListener("pointermove", ev => {
  if (ev.pointerId !== ptr.id) return;
  const dx = ev.clientX - ptr.x, dy = ev.clientY - ptr.y, th = TH(); ptr.moved = Math.max(ptr.moved, Math.abs(dx), Math.abs(dy));
  if (Math.abs(dx) < th && Math.abs(dy) < th) return;
  if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else down();
  ptr.fired = true; ptr.x = ev.clientX; ptr.y = ev.clientY;       // parmak kalkmadan zincirleme kaydırma
});
const ptrEnd = ev => {
  if (ev.pointerId !== ptr.id) return; ptr.id = null;
  const now = performance.now();
  if (!ptr.fired && ptr.moved < 12 && now - ptr.t < 260 && ev.type === "pointerup") { if (now - lastTap < 330) { lastTap = 0; useCapsule(); } else lastTap = now; }
};
canvas.addEventListener("pointerup", ptrEnd); canvas.addEventListener("pointercancel", ptrEnd);
for (const t of ["touchmove", "gesturestart", "dblclick", "contextmenu"]) document.addEventListener(t, ev => ev.preventDefault(), { passive: false });

/* ================= Döngü ================= */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
  if (G.mode !== "pause") { let rem = dt; while (rem > 0.0001) { const s = Math.min(rem, 1 / 90); update(s); rem -= s; } G.dt = dt; }   // alt adımlar: yüksek hızda tünelleme olmaz
  else G.dt = 0;
  R.draw(G);
  requestAnimationFrame(frame);
}
function resize() { R.resize(); }
addEventListener("resize", resize); addEventListener("orientationchange", () => setTimeout(resize, 120));
if (window.visualViewport) visualViewport.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });
addEventListener("blur", () => pause(true));

resize(); soundUi(); menuInfo(); saveProfile(profile);
requestAnimationFrame(frame);

/* Test / hata ayıklama kancası */
window.DamarKosucusu = { G, start, toMenu, pause, input: { left: () => moveLane(-1), right: () => moveLane(1), jump, down, capsule: useCapsule }, profile: () => profile,
  debug: { add, clear() { G.ents = []; G.genD = 1e9; }, resume() { G.genD = G.dist + 30; }, setProfile(p) { Object.assign(profile, p); saveProfile(profile); menuInfo(); hud(true); }, step: update, PAT, mult } };
