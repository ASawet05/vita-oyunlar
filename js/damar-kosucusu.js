/* Damar Yolu Koşucusu — Three.js 3D sonsuz koşu: oyun mantığı, sahne yönetimi, kamera, arayüz.
   Dünya: js/damar/dunya.js · Karakter: karakter.js · Nesneler: nesneler.js · Efekt: efekt.js
   Ses: ses.js (Web Audio sentezi) · Kayıt: kayit.js · Veri/denge: ayar.js · Dokular: dokular.js */
import * as THREE from "./vendor/three-paket.js";
import { LANES, WAGON_H, CAR_L, CAR_GAP, RAMP_L, LOW_H, GRAV, JUMP_V, ROLL_T, BUFFER_T, CHASE_T, FRENZY_T, FRENZY_N, JET_H,
  SPEED0, SPEED_MAX, SPEED_PER_M, ZONE_LEN, ZONES, VITAMINS, VIT_KEYS, POWERS, POWER_COST, LEVEL_MULT, CHAR_COST, CHARS, LEVEL_GEAR,
  CAP_DUR, CAP_COST, CAPS, STOCK_PRICE, STOCK_MAX, MISSIONS, MISSION_BONUS, piggyCap, piggyGain } from "./damar/ayar.js";
import { createWorld } from "./damar/dunya.js";
import { Runner, Board } from "./damar/karakter.js";
import { Things } from "./damar/nesneler.js";
import { Particles, Shockwave } from "./damar/efekt.js";
import { blobTexture } from "./damar/dokular.js";
import { Ses } from "./damar/ses.js";
import { loadProfile, saveProfile } from "./damar/kayit.js";

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const fmt = n => Math.floor(n).toLocaleString("tr-TR");
const fmtX = m => (Math.round(m * 10) / 10).toLocaleString("tr-TR");
const INTRO_T = 1.35, ACT_Z = 75, WLEN = cars => cars * CAR_L + (cars - 1) * CAR_GAP;

/* ================= Sahne ================= */
const canvas = $("dkCanvas");
let W;
try { W = createWorld(canvas); }
catch (err) { $("dkFatal").hidden = false; $("dkMenu").hidden = true; throw err; }
const camera = W.camera;
const runner = new Runner(); W.scene.add(runner.root);
const board = new Board(); W.scene.add(board.root);
const things = new Things(W.scene, W.glows);
const parts = new Particles(900, W.glowTex); W.scene.add(parts.obj); W.addLayer(parts.layer);
const shock = new Shockwave(); W.scene.add(shock.obj);
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -4 }));
blob.renderOrder = 3; W.scene.add(blob);

let profile = loadProfile();
Ses.setOn(profile.sound);
let preview = null;          // mağaza önizlemesi { char, charLv, cap, capLv, surf }
function applyLook() {
  const ck = preview?.char ?? profile.char, cl = preview?.charLv ?? profile.chars[ck];
  const pk = preview?.cap ?? profile.cap, plv = preview?.capLv ?? profile.caps[pk];
  runner.setLook(ck, Math.max(1, cl || 1));
  board.setLook(pk, Math.max(1, plv || 1));
}

/* ================= Durum ================= */
const newPlayer = () => ({ lane: 1, prevLane: 1, x: 0, y: 0, vy: 0, ground: true, surf: 0, below: 0, rollT: 0, tilt: 0, phase: 0, land: 0,
  stumbleT: 0, invT: 0, bufJump: 0, bufRoll: 0, laneT: 9, glide: false, dead: false, onRoof: false, roofLane: -1, leftRoofT: -9, leftRoofLane: -1, onRamp: false, dustT: 0 });
const G = {
  mode: "menu", t: 0, real: 0, dist: 0, speed: 0, ramp: 0, tex: 0, ents: [], player: newPlayer(), threat: 0, chaseT: 0, stumbled: false,
  shieldT: 0, shieldMax: 10, frenzyT: 0, powers: { jet: 0, magnet: 0, x2: 0 }, powMax: { jet: 1, magnet: 1, x2: 1 }, streak: 0, lastGot: -9, lastLine: -1,
  score: 0, vp: 0, vitN: 0, vits: {}, genD: 0, lastPow: 0, lastPat: "", calmFrom: -1, calmTo: -1, mission: null, missionNext: 0, missionsDone: 0, zone: 0,
  char: profile.char, cap: profile.cap, charLv: 1, heartT: 0, continues: 0, contT: 0, crashT: 0, introT: 0, lunge: 0, growled: false,
  shake: 0, flash: 0, flashC: "#fff", deathReason: "", piggyNotified: false, shop: 0, introFrom: null
};
let lineId = 0;

/* ================= Parkur üretimi (adil, ritmik dalgalar) ================= */
const add = e => { G.ents.push(e); return e; };
const others = l => [0, 1, 2].filter(x => x !== l);
const adjacent = l => l === 1 ? [0, 2] : [1];
const react = () => Math.max(13, G.speed * 0.95);
const tail = () => Math.max(11, G.speed * 0.75);
function coins(lane, d0, n, { y = 0.95, step = 2.4, kind = pick(VIT_KEYS), rare = false } = {}) { const line = ++lineId; for (let i = 0; i < n; i++) add({ t: "vit", lane, x: LANES[lane], y, d: d0 + i * step, kind, rare, line }); }
function arc(lane, d0, span, peak, n, opt = {}) { const kind = opt.kind || pick(VIT_KEYS), line = ++lineId; for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; add({ t: "vit", lane, x: LANES[lane], y: (opt.base ?? 0.95) + 4 * peak * u * (1 - u), d: d0 + span * u, kind, rare: !!opt.rare, line }); } }
function wagon(lane, d, cars, o = {}) { return add({ t: "wagon", lane, d, cars, len: WLEN(cars), ramp: !!o.ramp, v: o.v || 0, act: !o.v, color: rint(0, 5) }); }
function roofCoins(lane, d0, len) { coins(lane, d0 + 2.5, Math.max(2, Math.floor((len - 4) / 2.6)), { y: WAGON_H + 0.95, step: 2.6, rare: true }); }
function rampCoins(lane, front) { const line = ++lineId, kind = pick(VIT_KEYS); for (let i = 0; i < 3; i++) { const u = (i + 0.6) / 3; add({ t: "vit", lane, x: LANES[lane], y: 0.95 + WAGON_H * u, d: front - RAMP_L + RAMP_L * u, kind, rare: false, line }); } }

const PAT = {
  coins(d) { coins(rint(0, 2), d + 2, 7); return 20; },
  low1(d) { const l = rint(0, 2); add({ t: "low", lane: l, d: d + 8 }); arc(l, d + 8 - G.speed * 0.3, G.speed * 0.6, 1.1, 5); coins(pick(others(l)), d + 2, 5); return 18; },
  lowRow(d) { for (const l of [0, 1, 2]) add({ t: "low", lane: l, d: d + 8 }); arc(rint(0, 2), d + 8 - G.speed * 0.3, G.speed * 0.6, 1.1, 5); return 18; },
  archRow(d) { for (const l of [0, 1, 2]) add({ t: "arch", lane: l, d: d + 8 }); coins(rint(0, 2), d + 3, 5, { y: 0.5 }); return 18; },
  mixRow(d) {
    const ty = shuffle(["low", "arch", "car"]);
    ty.forEach((t, l) => { if (t === "car") wagon(l, d + 8, 1); else add({ t, lane: l, d: d + 8 }); });
    const l = ty.indexOf("low"); arc(l, d + 8 - G.speed * 0.3, G.speed * 0.6, 1.1, 4);
    return 8 + CAR_L + tail();
  },
  two(d) { const open = rint(0, 2); let m = 0; for (const l of others(open)) { const c = rint(1, 2); m = Math.max(m, WLEN(c)); wagon(l, d + 9, c); } coins(open, d + 2, 8); return 9 + m + tail(); },
  zig(d) {
    const a = rint(0, 2), b = pick(others(a)), gap = react() + 3, d2 = d + 8 + CAR_L + gap;
    for (const l of others(a)) wagon(l, d + 8, 1); for (const l of others(b)) wagon(l, d2, 1);
    coins(a, d + 3, 4); coins(b, d + 8 + CAR_L + gap * 0.3, 4);
    return d2 + CAR_L - d + tail();
  },
  slalom(d) { const order = shuffle([0, 1, 2]), gap = react() * 0.8; order.forEach((l, i) => add({ t: i % 2 ? "arch" : "low", lane: l, d: d + 8 + i * gap })); coins(order[2], d + 3, 5); return 14 + gap * 2 + 6; },
  rampTrain(d) {
    const l = rint(0, 2), cars = rint(2, 3), len = WLEN(cars), front = d + 8 + RAMP_L;
    wagon(l, front, cars, { ramp: true }); rampCoins(l, front); roofCoins(l, front, len);
    const o = shuffle(others(l));
    if (Math.random() < 0.6) wagon(o[0], front + rint(3, 9), rint(1, 2)); else add({ t: "arch", lane: o[0], d: front + 4 });
    add({ t: "low", lane: o[1], d: front + len * 0.5 });
    return 8 + RAMP_L + len + tail();
  },
  yard(d) {   // önü rampalı vagon → yandaki uzun vagonun çatısına atla; zemin şeridinde zıpla/yuvarlan
    const a = rint(0, 2), b = pick(adjacent(a)), c = 3 - a - b;
    const fa = d + 8 + RAMP_L, la = WLEN(2), fb = fa + la - 7, lb = WLEN(3);
    wagon(a, fa, 2, { ramp: true }); rampCoins(a, fa); roofCoins(a, fa, la - 4);
    wagon(b, fb, 3); roofCoins(b, fa + la + 1, fb + lb - (fa + la) - 3);
    add({ t: "low", lane: c, d: fa + 2 }); add({ t: "arch", lane: c, d: fa + 2 + react() });
    return fb + lb - d + tail();
  },
  mover(d) {
    const l = rint(0, 2), o = others(l), v = rnd(8, 12) * (G.genD > ZONE_LEN * 2 ? 1.15 : 1), cars = rint(1, 2), meet = d + 14;
    const p0 = meet + ACT_Z * v / (G.speed + v); wagon(l, p0, cars, { v });
    coins(o[0], d + 4, 8); if (Math.random() < 0.5) add({ t: "low", lane: o[1], d: d + 22 });
    return Math.max(32, p0 + WLEN(cars) - d + 4);
  },
  moverPair(d) {
    const m = rint(0, 2), free = pick(adjacent(m)), st = 3 - m - free, v = rnd(9, 12), meet = d + 16;
    const p0 = meet + ACT_Z * v / (G.speed + v); wagon(m, p0, 1, { v }); wagon(st, d + 12, 2);
    coins(free, d + 4, 9);
    return Math.max(36, p0 + CAR_L - d + 4, 12 + WLEN(2) + tail());
  },
  power(d) { const l = rint(0, 2), k = pick(["jet", "jet", "magnet", "magnet", "x2", "x2", "cap"]); add({ t: "pow", lane: l, x: LANES[l], y: 1.1, d: d + 10, kind: k }); coins(l, d + 2, 3); return 20; }
};
const WEIGHTS = [
  { coins: 2, low1: 4, lowRow: 2, archRow: 2, two: 3, mixRow: 1.2, rampTrain: 2, yard: 0.8, zig: 0.8, slalom: 0.6 },
  { coins: 1, low1: 2, lowRow: 1.5, archRow: 1.5, two: 2.2, mixRow: 2, rampTrain: 2.6, yard: 2.2, zig: 1.2, slalom: 1, mover: 1.6 },
  { coins: 0.6, low1: 1.4, lowRow: 2, archRow: 2, two: 2, mixRow: 2.4, rampTrain: 2, yard: 2.2, zig: 2.4, slalom: 1.6, mover: 2.6, moverPair: 1.6 }
];
function generate() {
  while (G.genD < G.dist + 190) {
    let name;
    if (G.genD < 70) name = "coins";
    else if (G.genD >= G.calmFrom && G.genD < G.calmTo) name = "coins";
    else if (G.genD - G.lastPow > 240 && Math.random() < 0.55) { name = "power"; G.lastPow = G.genD; }
    else {
      const w = WEIGHTS[Math.min(2, Math.floor(G.genD / ZONE_LEN))], keys = Object.keys(w).filter(k => k !== G.lastPat);
      let r = Math.random() * keys.reduce((s, k) => s + w[k], 0); name = keys[keys.length - 1];
      for (const k of keys) { r -= w[k]; if (r <= 0) { name = k; break; } }
    }
    G.lastPat = name; const n0 = G.ents.length;
    G.genD += PAT[name](G.genD) + Math.max(8, G.speed * 0.55);
    for (let i = n0; i < G.ents.length; i++) G.ents[i].pat = name;
  }
}

/* ================= Efektler / arayüz yardımcıları ================= */
const zoneCol = () => W.cur.line;
function flash(c, a = 1) { G.flashC = c; G.flash = a; }
let toastTimer = 0;
function toast(txt, color = "#fff") { const el = $("dkToast"); el.hidden = true; void el.offsetWidth; el.textContent = txt; el.style.setProperty("--tc", color); el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 1700); }
let bannerTimer = 0;
function banner(title, sub) { const el = $("dkZone"); el.hidden = true; void el.offsetWidth; $("dkZoneName").textContent = title; $("dkZoneSub").textContent = sub; el.hidden = false; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { el.hidden = true; }, 2600); }
const vib = ms => { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (_) {} };

/* ================= Görevler ================= */
function newMission() {
  const tier = Math.min(2, G.missionsDone), pool = MISSIONS.filter(m => !G.mission || m.id !== G.mission.id), def = pick(pool);
  const m = { id: def.id, n: def.n[tier], prog: 0, tier, kind: def.id === "kind" ? pick(VIT_KEYS) : null, done: false };
  m.text = m.kind ? `${VITAMINS[m.kind].label} ${def.text}` : def.text;
  G.mission = m; missionUi(true);
}
function missionAdd(id, n = 1, kind = null) {
  const m = G.mission; if (!m || m.done || m.id !== id || (m.kind && m.kind !== kind)) return;
  m.prog = Math.min(m.n, m.prog + n); missionUi();
  if (m.prog >= m.n) {
    m.done = true; const b = MISSION_BONUS[m.tier]; G.vp += b; G.missionsDone++; G.missionNext = 1.6;
    Ses.mission(); toast(`Görev tamam! +${b} Vita-Puan · çarpan +1`, "#5eead4"); hud(true); missionUi(true);
  }
}
let mUiProg = -1;
function missionUi(force) {
  const m = G.mission; if (!m) return;
  const p = Math.floor(m.prog); if (!force && p === mUiProg) return; mUiProg = p;
  $("dkMText").textContent = m.done ? "Görev tamamlandı!" : m.text;
  $("dkMCount").textContent = m.id === "dist" ? `${fmt(p)} / ${fmt(m.n)} m` : `${p} / ${m.n}`;
  $("dkMFill").style.transform = `scaleX(${clamp(m.prog / m.n)})`;
  $("dkMission").classList.toggle("is-done", m.done);
}

/* ================= Çarpan / kumbara ================= */
const mult = () => (LEVEL_MULT[G.charLv - 1] + Math.min(5, Math.floor(G.dist / ZONE_LEN)) + G.missionsDone) * (G.powers.x2 > 0 ? 2 : 1) * (G.frenzyT > 0 ? 3 : 1);
const piggyNow = () => { const cap = piggyCap(profile.piggy.opened); return { cap, fill: Math.min(cap, profile.piggy.fill + (G.mode === "menu" ? 0 : piggyGain(G.dist, G.vitN))) }; };
function piggyUi() {
  const { cap, fill } = piggyNow(), k = clamp(fill / cap);
  $("dkPiggyMiniArc").style.strokeDashoffset = (75.4 * (1 - k)).toFixed(1);
  if (!G.piggyNotified && k >= 1 && G.mode === "run") { G.piggyNotified = true; Ses.piggy(); toast("Biyo-Kumbara doldu! Menüde aç", "#fde68a"); }
}
function menuInfo() {
  $("dkBank").textContent = fmt(profile.vp);
  $("dkBestLine").textContent = profile.best ? `En yüksek skor: ${fmt(profile.best)}` : "Damar boyunca koş, vitaminleri topla!";
  const cap = piggyCap(profile.piggy.opened), k = clamp(profile.piggy.fill / cap), full = profile.piggy.fill >= cap;
  $("dkPiggyArc").style.strokeDashoffset = (113.1 * (1 - k)).toFixed(1);
  $("dkPiggyBtn").classList.toggle("is-full", full); $("dkPiggyPct").textContent = full ? "AÇ" : `%${Math.floor(k * 100)}`;
}

/* ================= Oyun akışı ================= */
function resetRun() {
  const charLv = Math.max(1, profile.chars[profile.char] || 1);
  Object.assign(G, { dist: 0, speed: 0, ramp: 0, tex: G.tex % 64, ents: [], player: newPlayer(), threat: 0, chaseT: 0, stumbled: false, shieldT: 0, frenzyT: 0,
    powers: { jet: 0, magnet: 0, x2: 0 }, streak: 0, lastGot: -9, lastLine: -1, score: 0, vp: 0, vitN: 0, vits: {}, genD: 40, lastPow: 80, lastPat: "",
    calmFrom: -1, calmTo: -1, mission: null, missionNext: 0, missionsDone: 0, zone: 0, char: profile.char, cap: profile.cap, charLv, heartT: 0,
    continues: 0, contT: 0, crashT: 0, introT: 0, lunge: 0, growled: false, flash: 0, shake: 0, deathReason: "", piggyNotified: false });
  lineId = 0; parts.clear(); preview = null; applyLook();
}
function start() {
  Ses.unlock(); Ses.start();
  const fromMenu = G.mode === "menu";
  const go = () => {
    G.introFrom = fromMenu ? camState() : null;
    resetRun();
    G.mode = "intro"; G.chaseT = CHASE_T; G.shop = 0;
    if (G.char === "demir") G.powers.magnet = G.powMax.magnet = 4;
    newMission(); generate();
    for (const id of ["dkMenu", "dkOver", "dkPause", "dkShop", "dkHelp", "dkCont", "dkPiggy"]) $(id).hidden = true;
    $("dkHud").hidden = false; $("dkToast").hidden = true; $("dkZone").hidden = true;
    hud(true); piggyUi();
    setTimeout(() => { if (G.mode === "intro" || G.mode === "run") banner(ZONES[0].name, "Koşu başladı · 0 m"); }, 500);
  };
  if (fromMenu) go(); else fade(go);
}
function fade(fn) { const f = $("dkFade"); f.classList.add("is-on"); setTimeout(() => { fn(); requestAnimationFrame(() => f.classList.remove("is-on")); }, 260); }
function crash(reason) {
  if (G.mode !== "run" && G.mode !== "intro") return;
  const pl = G.player;
  G.mode = "crash"; G.crashT = 0; G.deathReason = reason; G.shake = 1; G.lunge = 0; G.growled = false; G.threat = 1;
  pl.dead = true; pl.vy = 5; pl.ground = false; pl.rollT = 0; pl.glide = false; G.powers.jet = 0;
  flash("#ff5a5a", 0.9); Ses.crash(); Ses.jet(false); vib(140);
  parts.burst(pl.x, pl.y + 1, 0, "#ffd6d6", 26, 8, { flow: 0 });
  $("dkHud").classList.add("is-dim");
}
function openContinue() {
  G.mode = "cont"; G.contT = 3; const cost = G.continues + 1, can = profile.stock >= cost;
  $("dkContTitle").textContent = G.deathReason === "caught" ? "Toksin Muhafızı Yakaladı!" : "Engele Çarptın!";
  $("dkContCost").textContent = `×${cost}`; $("dkContStock").textContent = profile.stock;
  $("dkContBtn").disabled = !can; $("dkContNote").hidden = can;
  $("dkCont").hidden = false; contTick = 3; Ses.tick(false); updateContRing();
  setTimeout(() => (can ? $("dkContBtn") : $("dkContSkip")).focus(), 30);
}
let contTick = 3;
function updateContRing() { const k = clamp(G.contT / 3); $("dkContArc").style.strokeDashoffset = (276.5 * (1 - k)).toFixed(1); $("dkContNum").textContent = Math.max(1, Math.ceil(G.contT)); }
function doContinue() {
  if (G.mode !== "cont") return;
  const cost = G.continues + 1;
  if (profile.stock < cost) { Ses.deny(); return; }
  profile.stock -= cost; saveProfile(profile); G.continues++;
  $("dkCont").hidden = true; $("dkHud").classList.remove("is-dim");
  // enerji patlaması: yakındaki engelleri temizle
  const pl = G.player;
  for (const e of G.ents) {
    if (e.t === "vit" || e.t === "pow") continue;
    const back = e.d + (e.len || 0), frontD = e.d - (e.ramp ? RAMP_L : 0);
    if ((back > G.dist - 6 && frontD < G.dist + 70) || (e.v > 0 && e.d < G.dist + 200)) { e.smashed = true; parts.burst(LANES[e.lane], 1.2, -(e.d - G.dist), "#7df9ff", 10, 7); }
  }
  shock.fire(pl.x, 0.6, 0, "#7df9ff", 36, 0.9); Ses.burst(); flash("#a5f3fc", 0.9); G.shake = 0.6;
  Object.assign(pl, { dead: false, y: 0, vy: 0, ground: true, surf: 0, rollT: 0, stumbleT: 0, invT: 2.6, glide: false, onRoof: false });
  G.threat = 0; G.chaseT = 0; G.stumbled = false; G.lunge = 0; G.ramp = 0.35; G.mode = "run";
  toast("Kaldığın yerden devam!", "#7df9ff"); hud(true);
}
function finish() {
  if (G.mode === "over") return;
  G.mode = "over"; $("dkCont").hidden = true; Ses.jet(false); Ses.flow(0);
  const score = Math.floor(G.score), record = score > profile.best;
  const cap = piggyCap(profile.piggy.opened), before = profile.piggy.fill, gain = piggyGain(G.dist, G.vitN);
  profile.piggy.fill = Math.min(cap, before + gain);
  profile.vp += G.vp; profile.runs++; if (record) profile.best = score; saveProfile(profile);
  $("dkHud").hidden = true; $("dkHud").classList.remove("is-dim");
  $("dkOverTitle").textContent = G.deathReason === "caught" ? "Toksin Muhafızı Yakaladı!" : "Damar Tıkandı!";
  $("dkRecord").hidden = !record;
  $("dkOverScore").textContent = fmt(score); $("dkOverBest").textContent = fmt(profile.best); $("dkOverVp").textContent = "+" + fmt(G.vp);
  $("dkOverDist").textContent = fmt(G.dist) + " m"; $("dkOverMis").textContent = G.missionsDone;
  $("dkOverPiggyFill").style.transform = `scaleX(${clamp(profile.piggy.fill / cap)})`;
  $("dkOverPiggyTxt").textContent = profile.piggy.fill >= cap ? "Biyo-Kumbara doldu! Ana menüden aç." : `Biyo-Kumbara: +${gain} · ${fmt(profile.piggy.fill)} / ${fmt(cap)}`;
  const top = Object.keys(G.vits).sort((a, b) => G.vits[b] - G.vits[a])[0] || pick(VIT_KEYS);
  $("dkFact").textContent = (G.vits[top] ? `Bu tur en çok ${VITAMINS[top].name} topladın. ` : "") + pick(VITAMINS[top].facts);
  $("dkOver").hidden = false; setTimeout(() => $("dkAgain").focus(), 60);
  if (record) Ses.mission(); else Ses.over();
}
function toMenu() {
  fade(() => {
    G.mode = "menu"; resetRun(); G.speed = 0; G.shop = 0;
    for (const id of ["dkOver", "dkPause", "dkHud", "dkShop", "dkHelp", "dkCont", "dkPiggy"]) $(id).hidden = true;
    $("dkMenu").classList.remove("is-shop"); $("dkMenu").hidden = false; $("dkHud").classList.remove("is-dim"); menuInfo(); Ses.jet(false); Ses.flow(0);
  });
}
function pause(on) {
  if (on && (G.mode === "run" || G.mode === "intro")) { G.pausedFrom = G.mode; G.mode = "pause"; $("dkPause").hidden = false; $("dkResume").focus(); Ses.jet(false); Ses.flow(0); }
  else if (!on && G.mode === "pause") { G.mode = G.pausedFrom || "run"; $("dkPause").hidden = true; last = performance.now(); if (G.powers.jet > 0) Ses.jet(true); }
}

/* ================= Oyuncu komutları ================= */
const canAct = () => (G.mode === "run" || G.mode === "intro") && !G.player.dead;
function moveLane(dir) {
  if (!canAct()) return; const pl = G.player, n = clamp(pl.lane + dir, 0, 2);
  if (n === pl.lane) return; pl.prevLane = pl.lane; pl.lane = n; pl.laneT = 0; Ses.lane();
}
function doJump() {
  const pl = G.player; pl.ground = false; pl.rollT = 0; pl.bufJump = 0; pl.onRamp = false;
  pl.vy = JUMP_V * (G.char === "d3" ? Math.sqrt(1.15) : 1); Ses.jump();
  parts.burst(pl.x, pl.y + 0.05, 0.1, "#ffffff", 6, 2.5, { grav: 2, size: 0.18, life: 0.3 });
}
function doRoll() { const pl = G.player; pl.rollT = ROLL_T; pl.bufRoll = 0; Ses.roll(); }
function jump() { if (!canAct()) return; const pl = G.player; if (G.powers.jet > 0 || pl.glide) return; if (pl.ground) doJump(); else pl.bufJump = BUFFER_T; }
function down() {
  if (!canAct()) return; const pl = G.player; if (G.powers.jet > 0 || pl.glide) return;
  if (pl.ground) doRoll(); else { pl.vy = Math.min(pl.vy, -25); pl.bufRoll = 0.4; Ses.fastFall(); }
}
function useCapsule() {
  if (!canAct()) return;
  if (G.shieldT > 0) return;
  if (profile.stock <= 0) { Ses.deny(); toast("Kapsül stoğun bitti · Biyo-Mağaza", "#fca5a5"); return; }
  profile.stock--; saveProfile(profile);
  G.shieldT = G.shieldMax = CAP_DUR[Math.max(1, profile.caps[G.cap] || 1) - 1];
  Ses.shield(); flash(CAPS[G.cap].c1, 0.55); toast(CAPS[G.cap].name + " · Biyo-Sörf!", CAPS[G.cap].c1); hud(true);
  parts.burst(G.player.x, G.player.y + 0.3, 0, CAPS[G.cap].c1, 18, 5, { flow: 0.4 });
}

/* ================= Toplama / çarpışma ================= */
function smash(e) {
  e.smashed = true; const z = -(e.d - G.dist), lx = LANES[e.lane];
  if (e.t === "wagon") { for (let i = 0; i < Math.min(3, e.cars); i++) parts.burst(lx, 1.4, z - i * 3, i % 2 ? "#ffe8a3" : "#a5f3fc", 16, 9, { size: 0.24 }); shock.fire(lx, 1.2, Math.max(z, -1), "#ffe8a3", 9, 0.5); }
  else parts.burst(lx, 0.9, z, e.t === "low" ? "#ffcf33" : "#ff6b81", 22, 8);
  Ses.smash(); G.shake = Math.max(G.shake, 0.55); vib(40);
  const b = Math.round(50 * mult()); G.score += b;
}
function stumble(e) {
  const pl = G.player; e.hit = true;
  if (G.chaseT > 0 && G.stumbled) return crash("caught");
  G.stumbled = true; G.chaseT = G.char === "b12" ? 4 : CHASE_T; pl.stumbleT = 0.55; pl.invT = 0.9; G.shake = 0.5; G.streak = 0;
  Ses.stumble(); flash("#ff7878", 0.45); toast("Tökezledin! Toksin Muhafızı peşinde", "#fca5a5"); vib(60);
}
function hitObstacle(e, side) {
  const pl = G.player;
  if (G.frenzyT > 0) return smash(e);
  if (G.shieldT > 0) { smash(e); G.shieldT = 0; pl.invT = 1; flash(CAPS[G.cap].c1, 0.8); Ses.shieldBreak(); toast("Kapsül engeli parçaladı!", CAPS[G.cap].c1); hud(true); return; }
  if (pl.invT > 0) { e.hit = true; return; }
  if (side) { pl.lane = pl.prevLane; pl.laneT = 9; return stumble(e); }
  e.hit = true; crash("crash");
}
function collect(e) {
  const pl = G.player; e.got = true; const z = -(e.d - G.dist);
  if (e.t === "pow") {
    missionAdd("pow"); Ses.power(); flash("#ffffff", 0.35);
    if (e.kind === "cap") { profile.stock = Math.min(STOCK_MAX, profile.stock + 1); saveProfile(profile); toast("+1 Biyo-Sörf Kapsülü", "#5eead4"); parts.burst(e.x, e.y, z, "#5eead4", 16, 5); hud(true); return; }
    const lv = Math.max(1, profile.pw[e.kind] || 1);
    let dur = POWERS[e.kind].dur[lv - 1]; if (e.kind === "jet" && G.char === "d3") dur += 2;
    G.powers[e.kind] = G.powMax[e.kind] = dur;
    toast(POWERS[e.kind].name, POWERS[e.kind].color); parts.burst(e.x, e.y, z, POWERS[e.kind].color, 18, 6);
    if (e.kind === "jet") startJet(dur);
    hud(true); return;
  }
  const golden = G.shieldT > 0 && G.cap === "altin";
  const val = (e.rare ? 3 : 1) * (golden ? 2 : 1); G.vp += val; G.vitN++; G.vits[e.kind] = (G.vits[e.kind] || 0) + 1; G.streak++; G.lastGot = G.t; G.lastLine = e.line;
  G.score += 10 * val * mult(); Ses.collect(G.streak, e.rare);
  parts.burst(e.x, e.y, z, VITAMINS[e.kind].c1, e.rare ? 9 : 6, 3.5, { grav: 2, size: 0.16, life: 0.35 });
  missionAdd("vit"); missionAdd("kind", 1, e.kind); piggyUi();
  if (G.streak >= FRENZY_N && G.frenzyT <= 0) {
    G.frenzyT = FRENZY_T + (G.char === "vita" ? 1 : 0); G.streak = 0;
    Ses.frenzy(); toast("BİYO-FRENZY! x3 · engelleri ez", "#fde047"); flash("#fde047", 0.8); hud(true);
  }
}
function startJet(dur) {
  const pl = G.player; pl.rollT = 0; pl.glide = false; Ses.jet(true);
  // gökyüzü vitamin dizisi (şerit değiştiren uzun hat)
  const end = G.dist + G.speed * dur - 10, kind = pick(VIT_KEYS); let lane = pl.lane, d = G.dist + G.speed * 1.25 + 6, line = ++lineId;
  while (d < end) { const seg = rint(6, 10); for (let i = 0; i < seg && d < end; i++, d += 2.5) add({ t: "vit", lane, x: LANES[lane], y: JET_H + 0.95, d, kind, rare: false, line, sky: true }); lane = pick(adjacent(lane)); d += 3.5; }
  // güvenli iniş penceresi: engel üretme / uzaktakileri kaldır
  const L0 = G.dist + G.speed * dur - 20, L1 = G.dist + G.speed * (dur + 2.4) + 24;
  for (const e of G.ents) { if (e.t === "vit" || e.t === "pow") continue; const a = e.d - (e.ramp ? RAMP_L : 0), b = e.d + (e.len || 0); if ((b > L0 && a < L1) || (e.v > 0 && !e.act)) e.smashed = true; }
  G.calmFrom = L0; G.calmTo = L1;
}

/* Oyuncunun bastığı yüzey: zemin (0), rampa ya da vagon çatısı */
function surfaceAt(pl, any = false) {
  let h = 0;
  for (const e of G.ents) {
    if (e.t !== "wagon" || e.smashed) continue;
    const z = e.d - G.dist;
    if (z - (e.ramp ? RAMP_L : 0) > 0.4 || z + e.len < -0.4) continue;
    if (Math.abs(LANES[e.lane] - pl.x) > 1.02) continue;
    if (z <= 0.35 && z + e.len >= -0.35) { if (any || pl.y >= WAGON_H - 0.55) h = Math.max(h, WAGON_H); }
    else if (e.ramp && z > 0) { const sh = clamp(1 - z / RAMP_L) * WAGON_H; if (any || pl.y >= sh - 1.0) h = Math.max(h, sh); }
  }
  return h;
}
function collide(dt) {
  const pl = G.player, moving = pl.laneT < 0.22, flying = G.powers.jet > 0 || pl.glide && pl.y > 3;
  const magnet = G.powers.magnet > 0 || (G.shieldT > 0 && G.cap === "plazma");
  for (const e of G.ents) {
    if (e.hit || e.got || e.smashed) continue;
    const z = e.d - G.dist, t = e.t;
    if (t === "vit" || t === "pow") {
      if (t === "vit" && magnet && !e.sky && z < 22 && z > -1) {
        e.pull = Math.min(1, (e.pull || 0) + dt * 3.2); const k = e.pull * e.pull;
        e.x = lerp(e.x, pl.x, k * 0.3); e.y = lerp(e.y, pl.y + 0.95, k * 0.25) + Math.sin(e.pull * Math.PI) * dt * 7; e.d -= dt * e.pull * 18;
      }
      const cy = pl.y + (pl.rollT > 0 ? 0.5 : 0.95);
      if (Math.abs(z) < 1.0 && Math.abs(e.x - pl.x) < 1.0 && Math.abs(e.y - cy) < 1.2) collect(e);
      else if (z < -1.3 && !e.missed) {
        e.missed = true;
        if (t === "vit" && ((e.lane === pl.lane && Math.abs(e.y - cy) < 2.5 && !e.sky) || (e.line === G.lastLine && G.t - G.lastGot < 1.2))) G.streak = 0;
      }
      continue;
    }
    if (flying) continue;
    const dx = Math.abs(LANES[e.lane] - pl.x), leaving = moving && e.lane === pl.prevLane && e.lane !== pl.lane;
    if (t === "wagon") {
      const back = z + e.len, reach = 0.45 + (G.speed + (e.act ? e.v : 0)) * dt;
      if (dx > (leaving ? 0.75 : 1.3)) continue;
      if (e.ramp && z > 0.3 && z - RAMP_L < 0.3) {   // rampa: yandan girişte yükseklik farkı büyükse sürtme
        const sh = clamp(1 - z / RAMP_L) * WAGON_H;
        if (pl.y < sh - 1.0) hitObstacle(e, true);
        if (G.mode !== "run" && G.mode !== "intro") return; continue;
      }
      if (z > reach || back < -0.45) continue;
      if (pl.y >= WAGON_H - 0.5) continue;
      hitObstacle(e, moving && e.lane === pl.lane && z < 0.2);
      if (G.mode !== "run" && G.mode !== "intro") return;
      continue;
    }
    const reach = 0.45 + G.speed * dt;
    if (z > reach || z < -0.45) {
      if (z < -0.45 && !e.passed) { e.passed = true; if (!e.hit && e.lane === pl.lane) { if (t === "low" && !pl.ground) missionAdd("jump"); if (t === "arch" && pl.rollT > 0) missionAdd("roll"); } }
      continue;
    }
    if (dx > (leaving ? 0.75 : 1.25)) continue;
    const side = moving && e.lane === pl.lane;
    if (t === "low") {
      if (pl.y > LOW_H - 0.07) continue;
      if (pl.y > 0.42 && !side) { if (G.frenzyT > 0 || G.shieldT > 0) hitObstacle(e, false); else if (pl.invT <= 0) stumble(e); else e.hit = true; continue; }
    } else if (t === "arch") { if (pl.rollT > 0 && pl.y < 0.4) continue; if (pl.y > 2.2) continue; }
    hitObstacle(e, side);
    if (G.mode !== "run" && G.mode !== "intro") return;
  }
}
function land(surf) {
  const pl = G.player, hard = pl.vy < -16;
  pl.y = surf; pl.ground = true; pl.land = 0.16; pl.vy = 0; Ses.land(hard);
  parts.burst(pl.x, surf + 0.05, 0.1, "#ffffff", hard ? 10 : 5, hard ? 4 : 2.5, { grav: 1, size: 0.22, life: 0.32, alpha: 0.7 });
  if (pl.bufJump > 0) doJump(); else if (pl.bufRoll > 0) doRoll();
}

/* ================= Güncelleme ================= */
function update(dt) {
  G.t += dt;
  switch (G.mode) {
    case "menu": G.tex += dt * 3.5; return;
    case "pause": case "over": return;
    case "cont": {
      const before = Math.ceil(G.contT); G.contT -= dt; updateContRing();
      if (Math.ceil(G.contT) !== before && G.contT > 0) Ses.tick(G.contT < 1);
      if (G.contT <= 0) finish(); return;
    }
    case "crash": {
      const pl = G.player; G.crashT += dt;
      G.speed = Math.max(0, G.speed - dt * 55); G.dist += G.speed * dt; G.tex += G.speed * dt;
      pl.vy -= GRAV * dt; pl.y = Math.max(pl.surf, pl.y + pl.vy * dt);
      G.lunge = clamp((G.crashT - 0.3) / 0.55);
      if (G.crashT > 0.3 && !G.growled) { G.growled = true; Ses.growl(); G.shake = 0.7; }
      if (G.crashT >= 1.2) openContinue();
      return;
    }
  }
  if (G.mode === "intro") { G.introT += dt; if (G.introT >= INTRO_T) { G.mode = "run"; hud(true); } }
  runStep(dt);
}
function runStep(dt) {
  const pl = G.player;
  G.ramp = Math.min(1, G.ramp + dt / (G.mode === "intro" ? INTRO_T : 0.8));
  const base = Math.min(SPEED_MAX, SPEED0 + G.dist * SPEED_PER_M + (G.dist > ZONE_LEN * 2 ? 1 : 0));
  G.speed = base * easeOut(G.ramp) * (pl.stumbleT > 0 ? 0.8 : 1);
  const step = G.speed * dt; G.dist += step; G.tex += step; G.score += step * mult() * 0.5; missionAdd("dist", step);
  const zi = Math.floor(G.dist / ZONE_LEN);
  if (zi !== G.zone) { G.zone = zi; const Z = ZONES[zi % ZONES.length]; banner(Z.name, `${fmt(zi * ZONE_LEN)} m · çarpan +1`); Ses.zone(); flash("#ffffff", 0.35); hud(true); }
  // karşıdan gelen kapsüller
  for (const e of G.ents) if (e.t === "wagon" && e.v > 0 && !e.smashed) { if (!e.act && e.d - G.dist < ACT_Z) e.act = true; if (e.act) e.d -= e.v * dt; }

  // yatay: yumuşak şerit geçişi + yatma
  const tx = LANES[pl.lane], dxl = tx - pl.x; pl.x += dxl * clamp(dt * 14); if (Math.abs(dxl) < 0.01) pl.x = tx;
  pl.tilt = lerp(pl.tilt, clamp(dxl * 0.38, -0.55, 0.55), clamp(dt * 14));
  // dikey
  pl.below = surfaceAt(pl, true);
  if (G.powers.jet > 0) {
    pl.y = lerp(pl.y, JET_H, clamp(dt * 2.6)); pl.vy = 0; pl.ground = false; pl.rollT = 0; pl.surf = pl.below;
  } else if (pl.glide) {
    pl.vy = Math.max(pl.vy - GRAV * 0.22 * dt, -6); pl.y += pl.vy * dt;
    const s = surfaceAt(pl); pl.surf = s;
    if (pl.y <= s) { pl.glide = false; pl.invT = Math.max(pl.invT, 1.0); land(s); }
  } else {
    const surf = surfaceAt(pl); pl.surf = surf;
    if (pl.ground) {
      if (surf < pl.y - 0.35) { pl.ground = false; pl.vy = 0; }
      else { const was = pl.y; pl.y = surf; const ramp = surf > 0.05 && surf < WAGON_H - 0.05; if (ramp && !pl.onRamp && surf > was) Ses.ramp(); pl.onRamp = ramp; }
    }
    if (!pl.ground) {
      pl.vy -= GRAV * dt; pl.y += pl.vy * dt;
      if (pl.bufJump > 0) pl.bufJump -= dt; if (pl.bufRoll > 0) pl.bufRoll -= dt;
      if (pl.y <= surf && pl.vy <= 0) land(surf);
    }
  }
  // çatı takibi (görevler: çatıya çık, çatıdan çatıya atla)
  const onRoof = pl.ground && pl.y >= WAGON_H - 0.01;
  if (onRoof && !pl.onRoof) { missionAdd("roof"); if (G.t - pl.leftRoofT < 1.6 && pl.leftRoofLane >= 0 && pl.leftRoofLane !== pl.lane) { missionAdd("hop"); toast("Çatıdan çatıya!", "#a5f3fc"); } }
  if (!onRoof && pl.onRoof) { pl.leftRoofT = G.t; pl.leftRoofLane = pl.roofLane; }
  if (onRoof) pl.roofLane = pl.lane;
  pl.onRoof = onRoof;
  if (pl.rollT > 0) pl.rollT -= dt;
  if (pl.land > 0) pl.land -= dt;
  pl.phase += dt * (5.5 + G.speed * 0.45);
  if (pl.stumbleT > 0) pl.stumbleT -= dt; if (pl.invT > 0) pl.invT -= dt; pl.laneT += dt;

  // zamanlayıcılar
  for (const k in G.powers) if (G.powers[k] > 0) {
    G.powers[k] -= dt;
    if (G.powers[k] <= 0) { G.powers[k] = 0; hud(true); if (k === "jet") { pl.glide = true; pl.vy = 0; Ses.jet(false); toast("Güvenli iniş", "#ffd8a8"); } }
  }
  if (G.shieldT > 0) { G.shieldT -= dt; if (G.shieldT <= 0) { G.shieldT = 0; hud(true); } }
  if (G.frenzyT > 0) { G.frenzyT -= dt; if (G.frenzyT <= 0) { G.frenzyT = 0; hud(true); } }
  if (G.missionNext > 0) { G.missionNext -= dt; if (G.missionNext <= 0) newMission(); }
  if (G.chaseT > 0) {
    G.chaseT -= dt; G.threat = clamp(G.threat + dt * 2.5);
    G.heartT -= dt; if (G.heartT <= 0) { const near = G.stumbled ? 1 : 0.35; Ses.heart(near); G.heartT = lerp(0.9, 0.38, near * clamp(1 - G.chaseT / CHASE_T + 0.4)); }
    if (G.chaseT <= 0) { G.chaseT = 0; if (G.stumbled) toast("Toksin Muhafızı geride kaldı", "#bbf7d0"); G.stumbled = false; }
  } else G.threat = Math.max(0, G.threat - dt * 1.2);

  collide(dt);
  if (G.mode !== "run" && G.mode !== "intro") return;
  G.ents = G.ents.filter(e => !e.got && !e.smashed && (e.d + (e.len || 0)) - G.dist > -14);
  generate(); hud(false);
}

/* ================= HUD ================= */
const RINGS = [["shield", () => G.shieldT / G.shieldMax, () => CAPS[G.cap].c1, "S"], ["frenzy", () => G.frenzyT / (FRENZY_T + (G.char === "vita" ? 1 : 0)), () => "#fde047", "★"],
  ["jet", () => G.powers.jet / G.powMax.jet, () => POWERS.jet.color, "J"], ["magnet", () => G.powers.magnet / G.powMax.magnet, () => POWERS.magnet.color, "U"], ["x2", () => G.powers.x2 / G.powMax.x2, () => POWERS.x2.color, "2x"]];
const ringEls = {};
(function buildRings() {
  const host = $("dkRings");
  for (const [id, , , label] of RINGS) {
    const d = document.createElement("div"); d.className = "dk-ring"; d.hidden = true;
    d.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><circle cx="20" cy="20" r="17" stroke-dasharray="106.8" stroke-dashoffset="0"/></svg><span>${label}</span>`;
    host.appendChild(d); ringEls[id] = { el: d, arc: d.querySelectorAll("circle")[1] };
  }
})();
let hudScore = -1, hudVp = -1, hudMult = -1, hudTick = 0;
function hud(force) {
  const s = Math.floor(G.score), m = mult();
  if (s !== hudScore) { hudScore = s; $("dkScore").textContent = fmt(s); }
  if (G.vp !== hudVp) { hudVp = G.vp; $("dkVp").textContent = fmt(G.vp); }
  if (m !== hudMult || force) { hudMult = m; const el = $("dkMult"); el.textContent = "x" + fmtX(m); el.classList.toggle("is-hot", G.frenzyT > 0 || G.powers.x2 > 0); }
  if (!force && ++hudTick % 3) return;
  for (const [id, frac, color] of RINGS) {
    const f = frac(), r = ringEls[id];
    if (f > 0) { if (r.el.hidden) { r.el.hidden = false; r.el.style.setProperty("--c", color()); } r.arc.setAttribute("stroke-dashoffset", (106.8 * (1 - clamp(f))).toFixed(1)); }
    else if (!r.el.hidden) r.el.hidden = true;
  }
  if (force) {
    $("dkCapN").textContent = profile.stock; const b = $("dkCapBtn");
    b.classList.toggle("is-on", G.shieldT > 0); b.classList.toggle("is-empty", profile.stock <= 0 && G.shieldT <= 0); b.style.setProperty("--capc", CAPS[G.cap].c1);
  }
}
const SND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
function soundUi() { for (const b of document.querySelectorAll("[data-sound]")) { b.innerHTML = profile.sound ? SND_ON : SND_OFF; b.setAttribute("aria-pressed", String(profile.sound)); b.setAttribute("aria-label", profile.sound ? "Sesi kapat" : "Sesi aç"); } }

/* ================= Biyo-Mağaza ================= */
let shopTab = "chars";
const coin = '<i class="dk-coin" aria-hidden="true"></i>';
const pips = lv => `<span class="dk-pips" aria-label="Seviye ${lv}/5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= lv ? "on" : ""}"></i>`).join("")}</span>`;
function charSvg(c, lv) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="g${c.acc.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.body}"/><stop offset="1" stop-color="${c.suit}"/></linearGradient></defs>
  <rect x="17" y="34" width="30" height="24" rx="9" fill="url(#g${c.acc.slice(1)})"/><rect x="40" y="36" width="10" height="16" rx="3" fill="${c.suit}"/><rect x="43" y="39" width="4" height="10" rx="2" fill="${c.glow}"/>
  <circle cx="32" cy="24" r="14" fill="${c.body}"/><path d="M18 23a14 14 0 0 1 28 0z" fill="${lv >= 5 ? "#ffd43b" : c.acc}"/><rect x="20" y="22" width="24" height="7" rx="3.5" fill="${c.visor}"/>
  ${lv >= 2 ? `<circle cx="18" cy="38" r="5" fill="${c.acc}"/><circle cx="46" cy="38" r="5" fill="${c.acc}"/>` : ""}${lv >= 3 ? `<path d="M38 11l4-7" stroke="${c.suit}" stroke-width="2"/><circle cx="42" cy="4" r="2.5" fill="${c.glow}"/>` : ""}${lv >= 5 ? `<ellipse cx="32" cy="8" rx="10" ry="2.6" fill="none" stroke="#ffd43b" stroke-width="2"/>` : ""}</svg>`;
}
const capSvg = c => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="22" width="48" height="20" rx="10" fill="${c.c1}"/><rect x="8" y="22" width="24" height="20" rx="10" fill="${c.c2}"/><rect x="14" y="27" width="36" height="3" rx="1.5" fill="#fff" opacity=".6"/><path d="M14 48q18 8 36 0" stroke="${c.c1}" stroke-width="3" fill="none" opacity=".7"/></svg>`;
const POW_ICON = {
  jet: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="20" y="12" width="24" height="30" rx="6" fill="#343a4a"/><rect x="20" y="16" width="24" height="5" fill="#ffa94d"/><path d="M24 44l3 12 3-12zM34 44l3 12 3-12z" fill="#ffa94d"/></svg>',
  magnet: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 14v18a14 14 0 0 0 28 0V14h-9v18a5 5 0 0 1-10 0V14z" fill="#ff6b6b"/><rect x="18" y="12" width="9" height="7" fill="#f1f3f5"/><rect x="37" y="12" width="9" height="7" fill="#f1f3f5"/></svg>',
  x2: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="#7b2cbf"/><circle cx="32" cy="32" r="19" fill="none" stroke="#fff" stroke-width="3"/><text x="32" y="40" text-anchor="middle" font-size="22" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">2x</text></svg>'
};
function renderShop() {
  $("dkShopBank").textContent = fmt(profile.vp);
  document.querySelectorAll("#dkShop [data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === shopTab)));
  const body = $("dkShopBody"); body.innerHTML = "";
  const card = ({ kind, key, name, lv, owned, sel, icon, lines, price, cost }) => {
    const d = document.createElement("div"); d.className = "dk-item" + (sel ? " is-sel" : "") + (owned ? "" : " is-locked"); d.dataset.kind = kind; d.dataset.key = key;
    let acts = "";
    if (!owned) acts = `<button type="button" class="dk-buy" data-act="buy" ${profile.vp < price ? "disabled" : ""}>${coin}${fmt(price)}</button>`;
    else {
      if (kind !== "pw") acts += sel ? `<button type="button" class="dk-sel" disabled>Seçili</button>` : `<button type="button" class="dk-sel" data-act="sel">Seç</button>`;
      acts += lv >= 5 ? `<span class="dk-max">MAKS</span>` : `<button type="button" class="dk-up" data-act="up" ${profile.vp < cost ? "disabled" : ""}>Yükselt ${coin}${fmt(cost)}</button>`;
    }
    d.innerHTML = `<div class="dk-item-ico">${icon}</div><div class="dk-item-main"><b>${name}</b>${owned ? pips(lv) : '<span class="dk-lock">Kilitli</span>'}${lines.map(l => `<small>${l}</small>`).join("")}</div><div class="dk-item-act">${acts}</div>`;
    body.appendChild(d);
  };
  if (shopTab === "chars") for (const k in CHARS) {
    const c = CHARS[k], lv = profile.chars[k], owned = lv > 0, nx = Math.min(5, Math.max(1, lv) + 1);
    card({ kind: "char", key: k, name: c.name, lv, owned, sel: profile.char === k, icon: charSvg(c, Math.max(1, lv)), price: c.price, cost: CHAR_COST[lv] || 0,
      lines: [c.perk, `Kalıcı çarpan <b>x${fmtX(LEVEL_MULT[Math.max(1, lv) - 1])}</b>${owned && lv < 5 ? ` → x${fmtX(LEVEL_MULT[nx - 1])}` : ""}`, `Ekipman: ${LEVEL_GEAR[Math.max(1, lv) - 1]}`] });
  }
  else if (shopTab === "caps") for (const k in CAPS) {
    const c = CAPS[k], lv = profile.caps[k], owned = lv > 0;
    card({ kind: "cap", key: k, name: c.name, lv, owned, sel: profile.cap === k, icon: capSvg(c), price: c.price, cost: CAP_COST[lv] || 0,
      lines: [c.perk, `Sörf süresi <b>${CAP_DUR[Math.max(1, lv) - 1]} sn</b>${owned && lv < 5 ? ` → ${CAP_DUR[lv]} sn` : ""}`] });
  }
  else if (shopTab === "pw") for (const k in POWERS) {
    const p = POWERS[k], lv = profile.pw[k];
    card({ kind: "pw", key: k, name: p.name, lv, owned: true, sel: false, icon: POW_ICON[k], price: 0, cost: POWER_COST[lv] || 0,
      lines: [p.desc, `Süre <b>${p.dur[lv - 1]} sn</b>${lv < 5 ? ` → ${p.dur[lv]} sn` : ""}`] });
  }
  else {
    const d = document.createElement("div"); d.className = "dk-stock"; const full = profile.stock >= STOCK_MAX;
    d.innerHTML = `<div class="dk-item-ico">${capSvg(CAPS[profile.cap])}</div><p><b>Kapsül stoğu: ${profile.stock} / ${STOCK_MAX}</b>Biyo-Sörf (çift dokun / Boşluk) ve çarpışma sonrası <b>Devam Et</b> için kullanılır.</p><button type="button" class="dk-buy" data-act="stock" ${full || profile.vp < STOCK_PRICE ? "disabled" : ""}>${full ? "Dolu" : coin + STOCK_PRICE}</button>`;
    body.appendChild(d);
  }
}
$("dkShopBody").addEventListener("click", ev => {
  const b = ev.target.closest("button[data-act]"), item = ev.target.closest(".dk-item");
  if (!b) { if (item) previewItem(item.dataset.kind, item.dataset.key); return; }
  if (b.disabled) return;
  const act = b.dataset.act;
  if (act === "stock") { if (profile.vp < STOCK_PRICE || profile.stock >= STOCK_MAX) return Ses.deny(); profile.vp -= STOCK_PRICE; profile.stock++; Ses.buy(); }
  else {
    const { kind, key } = item.dataset, levels = kind === "char" ? profile.chars : kind === "cap" ? profile.caps : profile.pw;
    const defs = kind === "char" ? CHARS : kind === "cap" ? CAPS : POWERS, costs = kind === "char" ? CHAR_COST : kind === "cap" ? CAP_COST : POWER_COST;
    if (act === "buy") { const pr = defs[key].price; if (profile.vp < pr) return Ses.deny(); profile.vp -= pr; levels[key] = 1; Ses.buy(); select(kind, key); }
    else if (act === "sel") { Ses.click(); select(kind, key); }
    else if (act === "up") { const c = costs[levels[key]]; if (!c || profile.vp < c || levels[key] >= 5) return Ses.deny(); profile.vp -= c; levels[key]++; Ses.upgrade(); flash("#ffffff", 0.25); parts.burst(0, 1.1, 0, "#fde68a", 20, 4, { flow: 0, grav: 1 }); }
    previewItem(kind, key);
  }
  saveProfile(profile); renderShop(); menuInfo();
});
function select(kind, key) { if (kind === "char") profile.char = key; else if (kind === "cap") profile.cap = key; G.char = profile.char; G.cap = profile.cap; }
function previewItem(kind, key) {
  if (kind === "char") preview = { char: key, charLv: Math.max(1, profile.chars[key]) };
  else if (kind === "cap") preview = { cap: key, capLv: Math.max(1, profile.caps[key]), surf: true };
  else preview = null;
  applyLook();
}
document.querySelectorAll("#dkShop [data-tab]").forEach(b => b.addEventListener("click", () => { shopTab = b.dataset.tab; Ses.click(); preview = shopTab === "caps" ? { surf: true } : null; applyLook(); renderShop(); }));
function openShop() { Ses.unlock(); Ses.click(); $("dkMenu").classList.add("is-shop"); if (G.mode === "over") { $("dkOver").hidden = true; G.backToOver = true; } renderShop(); $("dkShop").hidden = false; preview = shopTab === "caps" ? { surf: true } : null; applyLook(); }
function closeSheet(el) { el.hidden = true; if (el.id === "dkShop") { $("dkMenu").classList.remove("is-shop"); preview = null; applyLook(); if (G.backToOver && G.mode === "over") { G.backToOver = false; $("dkOver").hidden = false; } } }
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => { Ses.click(); closeSheet(b.closest(".dk-over")); }));
for (const id of ["dkShop", "dkHelp", "dkPiggy"]) $(id).addEventListener("pointerdown", ev => { if (ev.target === ev.currentTarget) closeSheet(ev.currentTarget); });

/* ================= Biyo-Kumbara ================= */
function openPiggy() {
  Ses.unlock(); const cap = piggyCap(profile.piggy.opened), full = profile.piggy.fill >= cap;
  if (full) {
    const reward = Math.round(cap * 0.6); profile.vp += reward; const extra = profile.stock < STOCK_MAX; if (extra) profile.stock++;
    profile.piggy.opened++; profile.piggy.fill = 0; saveProfile(profile); Ses.piggy(); flash("#fde68a", 0.6);
    $("dkPiggyTitle").textContent = "Biyo-Kumbara açıldı!";
    $("dkPiggyInfo").innerHTML = `<b class="dk-big">+${fmt(reward)}</b> Vita-Puan${extra ? " · +1 Biyo-Sörf Kapsülü" : ""}<br><small>Yeni kumbara kapasitesi: ${fmt(piggyCap(profile.piggy.opened))}</small>`;
    parts.burst(0, 1.4, 0, "#fde68a", 40, 6, { flow: 0, grav: 4 });
  } else {
    Ses.click(); $("dkPiggyTitle").textContent = "Biyo-Kumbara";
    $("dkPiggyInfo").innerHTML = `<b class="dk-big">${fmt(profile.piggy.fill)} / ${fmt(cap)}</b><br><small>Her koşu kumbarayı doldurur (her 8 m = 1, her vitamin = 1). Dolunca buradan aç: Vita-Puan + Biyo-Sörf Kapsülü.</small>`;
  }
  menuInfo(); $("dkPiggy").hidden = false;
}

/* ================= Düğmeler ================= */
$("dkPlay").addEventListener("click", start);
$("dkAgain").addEventListener("click", start);
$("dkShopBtn").addEventListener("click", openShop);
$("dkOverShop").addEventListener("click", openShop);
$("dkPiggyBtn").addEventListener("click", openPiggy);
$("dkHelpBtn").addEventListener("click", () => { Ses.unlock(); Ses.click(); $("dkHelp").hidden = false; });
$("dkOverMenu").addEventListener("click", toMenu);
$("dkQuit").addEventListener("click", () => {   // turu bırak: toplananlar kaybolmaz
  if (G.mode !== "pause") return;
  const cap = piggyCap(profile.piggy.opened); profile.piggy.fill = Math.min(cap, profile.piggy.fill + piggyGain(G.dist, G.vitN));
  profile.vp += G.vp; profile.runs++; const s = Math.floor(G.score); if (s > profile.best) profile.best = s; saveProfile(profile);
  G.mode = "over"; Ses.jet(false); toMenu();
});
$("dkResume").addEventListener("click", () => pause(false));
$("dkPauseBtn").addEventListener("click", () => pause(true));
$("dkCapBtn").addEventListener("click", useCapsule);
$("dkContBtn").addEventListener("click", doContinue);
$("dkContSkip").addEventListener("click", finish);
for (const b of document.querySelectorAll("[data-sound]")) b.addEventListener("click", () => { profile.sound = !profile.sound; Ses.setOn(profile.sound); saveProfile(profile); soundUi(); if (profile.sound) { Ses.unlock(); Ses.click(); } });

/* ================= Klavye ================= */
addEventListener("keydown", ev => {
  const k = ev.key, c = ev.code;
  if (k === "Escape") {
    const open = ["dkShop", "dkHelp", "dkPiggy"].map($).find(x => !x.hidden);
    if (open) closeSheet(open); else if (G.mode === "run" || G.mode === "intro") pause(true); else if (G.mode === "pause") pause(false); else if (G.mode === "cont") finish();
    ev.preventDefault(); return;
  }
  if (G.mode === "cont") { if ((k === "Enter" || c === "Space") && !ev.repeat) { ev.preventDefault(); doContinue(); } return; }
  if (G.mode === "menu" || G.mode === "over") {
    const sheetOpen = !$("dkShop").hidden || !$("dkHelp").hidden || !$("dkPiggy").hidden, onBtn = document.activeElement && document.activeElement.tagName === "BUTTON";
    if ((k === "Enter" || c === "Space") && !sheetOpen && !ev.repeat && !onBtn) { ev.preventDefault(); start(); }
    return;
  }
  if (!canAct()) return;
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
const TH = () => Math.max(14, Math.min(28, innerWidth * 0.045));
const stage = $("dkStage");
stage.addEventListener("pointerdown", ev => {
  if (ev.target.closest("button, a, .dk-over")) return;
  Ses.unlock(); ptr.id = ev.pointerId; ptr.x = ev.clientX; ptr.y = ev.clientY; ptr.t = performance.now(); ptr.fired = false; ptr.moved = 0;
  try { stage.setPointerCapture(ev.pointerId); } catch (_) {}
});
stage.addEventListener("pointermove", ev => {
  if (ev.pointerId !== ptr.id) return;
  const dx = ev.clientX - ptr.x, dy = ev.clientY - ptr.y, th = TH(); ptr.moved = Math.max(ptr.moved, Math.abs(dx), Math.abs(dy));
  if (Math.abs(dx) < th && Math.abs(dy) < th) return;
  if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else down();
  ptr.fired = true; ptr.x = ev.clientX; ptr.y = ev.clientY;      // parmak kalkmadan zincirleme kaydırma
});
const ptrEnd = ev => {
  if (ev.pointerId !== ptr.id) return; ptr.id = null;
  const now = performance.now();
  if (!ptr.fired && ptr.moved < 12 && now - ptr.t < 260 && ev.type === "pointerup" && canAct()) { if (now - lastTap < 320) { lastTap = 0; useCapsule(); } else lastTap = now; }
};
stage.addEventListener("pointerup", ptrEnd); stage.addEventListener("pointercancel", ptrEnd);
for (const t of ["gesturestart", "dblclick", "contextmenu"]) document.addEventListener(t, ev => ev.preventDefault(), { passive: false });
document.addEventListener("touchmove", ev => { if (!ev.target.closest(".dk-scroll")) ev.preventDefault(); }, { passive: false });

/* ================= Kamera ================= */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(0, 1.1, 0), tPos = new THREE.Vector3(), tLook = new THREE.Vector3(), tmpV = new THREE.Vector3();
let camY = 0, camFov = 55, viewOff = 0, camInit = false;
function portraitK() { return clamp((1.05 - camera.aspect) / 0.6); }
function menuPose(out, look) {
  const por = portraitK(), shopK = G.shop, sway = Math.sin(G.real * 0.22) * 0.16;
  const a = lerp(-0.42 + sway, -0.28, shopK), r = lerp(lerp(4.6, 4.3, por), lerp(3.4, 4.2, por), shopK), h = lerp(1.5 + por * 0.05, 1.32, shopK);
  out.set(Math.sin(a) * r, h, -Math.cos(a) * r); look.set(0, lerp(1.12 - por * 0.12, 1.0, shopK), 0);
  return { a, r, h, fov: lerp(lerp(50, 60, por), lerp(46, 56, por), shopK) };
}
function runPose(out, look, pl) {
  const por = portraitK(), flying = G.powers.jet > 0 || pl.glide;
  const back = lerp(6.4, 8.0, por) - (flying ? 1.1 : 0), up = lerp(2.9, 3.7, por) - (flying ? 0.3 : 0);
  out.set(pl.x * 0.6, up + camY * 0.95, back + Math.max(0, G.speed - SPEED0) * 0.035);
  look.set(pl.x * 0.85, 1.25 + camY, -8);
  return { back, up, fov: lerp(58, 72, por) + Math.max(0, G.speed - SPEED0) * 0.28 + (G.frenzyT > 0 ? 4 : 0) + (flying ? 3 : 0) };
}
function camState() { const p = menuPose(tPos, tLook); return { a: p.a, r: p.r, h: p.h, fov: camFov, look: camLook.clone() }; }
function updateCamera(dt) {
  const pl = G.player, flying = G.powers.jet > 0 || pl.glide;
  const followY = flying ? Math.max(0, pl.y - 0.6) : pl.surf + Math.max(0, pl.y - pl.surf) * 0.3;
  camY = lerp(camY, followY, clamp(dt * (flying ? 2.4 : 6)));
  let fov, rate = 8;
  if (G.mode === "menu") { fov = menuPose(tPos, tLook).fov; rate = 3.2; }
  else if (G.mode === "intro" && G.introFrom) {
    const e = easeIO(clamp(G.introT / INTRO_T)), f = G.introFrom, rp = runPose(tPos, tLook, pl);
    const a = lerp(f.a, Math.PI, e), r = lerp(f.r, rp.back, e), h = lerp(f.h, rp.up + camY * 0.95, e);
    tmpV.copy(tLook); tPos.set(Math.sin(a) * r + pl.x * 0.6 * e, h, -Math.cos(a) * r); tLook.copy(f.look).lerp(tmpV, e);
    fov = lerp(f.fov, rp.fov, e); rate = 0;
  } else { fov = runPose(tPos, tLook, pl).fov; rate = G.mode === "crash" ? 4 : 9; }
  if (!camInit || rate === 0) { camPos.copy(tPos); camLook.copy(tLook); camInit = true; }
  else { const k = clamp(dt * rate); camPos.lerp(tPos, k); camLook.lerp(tLook, k); }
  camFov = lerp(camFov, fov, clamp(dt * (rate === 0 ? 30 : 4)));
  camera.position.copy(camPos);
  if (G.shake > 0) { const s = G.shake * G.shake * 0.35; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; }
  camera.lookAt(camLook);
  if (Math.abs(camera.fov - camFov) > 0.01) { camera.fov = camFov; camera.updateProjectionMatrix(); }
  // mağaza açıkken karakteri boş alana kaydır (görüntü ofseti)
  const want = !$("dkShop").hidden && G.mode === "menu" ? 1 : 0; G.shop = lerp(G.shop, want, clamp(dt * 5));
  const w = canvas.clientWidth, h = canvas.clientHeight, off = G.shop;
  if (off > 0.002) { const wide = w > 760; camera.setViewOffset(w, h, wide ? Math.min(240, w * 0.2) * off : 0, wide ? 0 : h * 0.24 * off, w, h); viewOff = 1; }
  else if (viewOff) { camera.clearViewOffset(); viewOff = 0; }
}

/* ================= Çizim ================= */
const cTmp = new THREE.Color();
let moteT = 0, flowT = 0;
function poseState() {
  const pl = G.player, faceY = G.mode === "menu" && G.shop > 0.05 ? Math.sin(G.real * 0.5) * 1.1 * G.shop : 0;
  if (G.mode === "menu") return (preview && preview.surf) ? { mode: "surf", faceY } : { mode: "idle", faceY };
  if (G.mode === "intro" && G.introT < 0.28) return { mode: "idle" };
  if (pl.dead) return { mode: "dead" };
  if (pl.stumbleT > 0) return { mode: "stumble", phase: pl.phase };
  if (G.powers.jet > 0 || pl.glide) return { mode: "jet", tilt: pl.tilt };
  if (pl.rollT > 0) return { mode: "roll", rollK: 1 - pl.rollT / ROLL_T, tilt: pl.tilt };
  if (G.shieldT > 0 && pl.ground) return { mode: "surf", tilt: pl.tilt };
  if (!pl.ground) return { mode: pl.vy > -7 ? "jump" : "fall", vy: pl.vy, tilt: pl.tilt };
  return { mode: "run", phase: pl.phase, speed: G.speed, tilt: pl.tilt };
}
function present(dt) {
  const pl = G.player, live = G.mode !== "pause", adt = live ? dt : 0, running = G.mode === "run" || G.mode === "intro";
  const heart = G.chaseT > 0 ? (G.stumbled ? 1 : 0.45) : 0;
  W.update(adt, { dist: G.dist, tex: G.tex, t: G.t, speed: G.speed, px: pl.x, heart, menu: G.mode === "menu" });
  things.update(adt, G);
  const md = G.mode === "pause" ? G.pausedFrom : G.mode, crashLike = md === "crash" || ((md === "cont" || md === "over") && !!G.deathReason);
  things.updateThreat(adt, pl.x, pl.y, crashLike ? 1 : G.threat * (G.stumbled ? 1 : 0.8), md === "crash" ? G.lunge : crashLike ? 1 : 0, G.t, camera);

  // karakter + sörf kapsülü
  const surfing = (G.shieldT > 0 && running && !pl.dead) || (G.mode === "menu" && preview && preview.surf);
  const lift = surfing ? 0.32 + Math.sin(G.t * 4) * 0.04 : 0;
  runner.root.position.set(G.mode === "menu" ? 0 : pl.x, (G.mode === "menu" ? 0 : pl.y) + lift, 0);
  const ps = poseState(); runner.update(adt, ps);
  board.root.visible = !!surfing;
  if (surfing) { board.root.position.set(runner.root.position.x, runner.root.position.y - 0.16, -0.05); board.root.rotation.set(0, (ps.faceY || 0) + Math.PI / 2 * (G.mode === "menu" ? 0.15 : 0), -(pl.tilt || 0) * 0.6); board.aura.scale.setScalar(1 + Math.sin(G.t * 6) * 0.05); }
  const invBlink = running && pl.invT > 0 && !pl.dead && Math.sin(G.t * 40) > 0.2;
  runner.root.visible = !invBlink;
  // yumuşak gölge lekesi
  const surf = G.mode === "menu" ? 0 : pl.below, hgt = Math.max(0, runner.root.position.y - surf);
  blob.position.set(runner.root.position.x, surf + 0.03, 0.05); blob.scale.setScalar(1 - clamp(hgt / 5) * 0.5);
  blob.material.opacity = (W.tierIndex <= 1 ? 0.32 : 0.6) * (1 - clamp(hgt / 7) * 0.7);
  // sırt çantası parıltısı
  runner.pack.getWorldPosition(tmpV); W.glows.push(tmpV.x, tmpV.y, tmpV.z + 0.18, cTmp.set(CHARS[(preview && preview.char) || (G.mode === "menu" ? profile.char : G.char)].glow), 1.5, 0.5);
  if (surfing) W.glows.push(pl.x, runner.root.position.y + 0.9, 0, cTmp.set(CAPS[(preview && preview.cap) || G.cap].c1), 3.6, 0.22);
  if (live) {
    // jetpack alevleri
    if ((G.powers.jet > 0 || pl.glide) && running) for (let i = 0; i < 2; i++) { runner.nozzleWorld(i, tmpV); for (let j = 0; j < 2; j++) parts.spawn({ x: tmpV.x + rnd(-0.05, 0.05), y: tmpV.y - 0.05, z: tmpV.z + 0.05, vx: rnd(-0.6, 0.6), vy: rnd(-7, -4), vz: rnd(1, 3), life: rnd(0.22, 0.4), size: rnd(0.22, 0.38), color: Math.random() < 0.5 ? "#ffb347" : "#ffe08a", drag: 2, grow: -0.4, flow: 0.6 }); }
    // koşu tozu / yuvarlanma izi / frenzy kıvılcımları
    if (running && pl.ground && !pl.dead) { pl.dustT -= dt; if (pl.dustT <= 0) { pl.dustT = pl.rollT > 0 ? 0.03 : 0.08; parts.spawn({ x: pl.x + rnd(-0.25, 0.25), y: pl.y + 0.06, z: 0.25, vx: rnd(-1, 1), vy: rnd(0.4, 1.4), life: 0.4, size: pl.rollT > 0 ? 0.3 : 0.2, color: pl.rollT > 0 ? CHARS[G.char].glow : W.cur.line, alpha: 0.5, drag: 1 }); } }
    if (G.frenzyT > 0 && running && Math.random() < 0.8) parts.spawn({ x: pl.x + rnd(-0.6, 0.6), y: pl.y + rnd(0.2, 1.8), z: rnd(-0.3, 0.3), vy: rnd(1, 3), life: 0.5, size: 0.14, color: "#fde047", flow: 0.5 });
    if (G.powers.magnet > 0 && running && Math.random() < 0.35) { const a = rnd(0, TAU); parts.spawn({ x: pl.x + Math.cos(a) * 1.4, y: pl.y + 1 + Math.sin(a) * 0.9, z: 0, vx: -Math.cos(a) * 2.5, vy: -Math.sin(a) * 1.6, life: 0.5, size: 0.12, color: "#ff8787", flow: 0 }); }
    // akan plazma zerrecikleri (hız hissi)
    moteT -= dt; const rate = running ? 0.015 + 0.25 / Math.max(6, G.speed) : 0.09;
    while (moteT <= 0) { moteT += rate; parts.spawn({ x: rnd(-5, 5), y: rnd(0.4, 7), z: rnd(-80, -25), life: 2.6, size: rnd(0.07, 0.17), color: Math.random() < 0.5 ? W.cur.orb : W.cur.line, flow: running ? 1.7 : 1, alpha: 0.75, vz: running ? 0 : 3 }); }
  }
  parts.update(adt, running || G.mode === "crash" ? G.speed : 0);
  shock.update(adt);
  if (!G.freeCam && G.mode !== "pause") updateCamera(dt);
  W.glows.end();
  W.render();
  // ekran parlaması + tehdit/frenzy vinyeti
  if (G.flash > 0) { G.flash = Math.max(0, G.flash - dt * 2.6); }
  flashEl.style.opacity = G.flash.toFixed(3); if (G.flash > 0) flashEl.style.background = G.flashC;
  const vig = G.mode === "run" || G.mode === "intro" ? Math.max(G.chaseT > 0 ? G.threat * (G.stumbled ? 0.85 : 0.45) : 0, 0) : G.mode === "crash" ? 0.9 : 0;
  vigEl.style.opacity = vig.toFixed(3); goldEl.style.opacity = (G.frenzyT > 0 ? 0.85 : 0).toString();
  if (live && running) { flowT -= dt; if (flowT <= 0) { flowT = 0.25; Ses.flow(clamp(G.speed / SPEED_MAX)); piggyUi(); } }
}
const flashEl = $("dkFlash"), vigEl = $("dkVig"), goldEl = $("dkGold");

/* ================= Döngü ================= */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000)); last = now; G.real += dt;
  if (G.mode !== "pause") { let rem = dt; while (rem > 1e-4) { const s = Math.min(rem, 1 / 120); update(s); rem -= s; } }
  present(dt);
  W.perf(dt, G.mode === "run");
  requestAnimationFrame(frame);
}
addEventListener("resize", () => W.resize()); addEventListener("orientationchange", () => setTimeout(() => W.resize(), 150));
if (window.visualViewport) visualViewport.addEventListener("resize", () => W.resize());
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });
addEventListener("blur", () => pause(true));

applyLook(); soundUi(); menuInfo(); saveProfile(profile); W.resize();
requestAnimationFrame(frame);
document.documentElement.classList.add("dk-ready");
// Gölgelendirici ön ısıtma: ilk karşılaşmada (muhafız, güçlendirici, sörf kapsülü) takılma olmasın
(async () => {
  try {
    things.threat.root.visible = true; board.root.visible = true; for (const k of ["jet", "magnet", "x2", "cap"]) things.pickupMesh(k).root.position.set(0, -50, 0);
    const p = W.renderer.compileAsync ? W.renderer.compileAsync(W.scene, camera) : (W.renderer.compile(W.scene, camera), null);
    things.threat.root.visible = false; board.root.visible = false; if (p) await p;
  } catch (_) {}
})();

/* Test / hata ayıklama kancası */
window.DamarKosucusu = { G, start, toMenu, pause, finish, cont: doContinue, input: { left: () => moveLane(-1), right: () => moveLane(1), jump, down, capsule: useCapsule }, profile: () => profile,
  world: W, camera, debug: { add, clear() { G.ents = []; G.genD = 1e9; }, resume() { G.genD = G.dist + 30; }, setProfile(p) { Object.assign(profile, p); saveProfile(profile); G.char = profile.char; G.cap = profile.cap; applyLook(); menuInfo(); hud(true); },
    step: update, present, PAT, mult, surfaceAt: () => surfaceAt(G.player), wagon, startJet, openPiggy } };
