/* Damar Yolu Koşucusu — ana modül.
   İki katmanlı parkur (Dev Vitamin Kapsülleri + rampalar), Nano-Kaykay (çift dokunuş / çift tık / E),
   yan sürtme + kovalayan Devasa Toksin Hücresi, D3 Jet-Pack / Magnezyum Botları / Fe Mıknatısı,
   kalıcı damla bankası + VitaMağaza, 3'lü görevler ve skor çarpanı, günlük Biyo-Kelime avı, Gizemli Kapsül.
   Three.js resmi CDN'den (sabit sürüm) yüklenir; dünya, karakter, nesneler, ses, kayıt ve mağaza ayrı modüllerdedir. */
import { createAudio } from "./damar/ses.js";
import { createWorld, LANES } from "./damar/dunya.js";
import { createRunner } from "./damar/karakter.js";
import { createObjects, makeRowPattern, OB, CAPSULE } from "./damar/nesneler.js";
import { loadProfile, saveProfile, bumpMission } from "./damar/kayit.js";
import { createMenu } from "./damar/magaza.js";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const $ = (id) => document.getElementById(id);
const BEST_KEY = "vo_damar_best", MUTE_KEY = "vo_damar_muted";

function fatal(msg) { const f = $("dkFatal"); if (f) { f.hidden = false; f.querySelector("p").textContent = msg; } const s = $("dkStart"); if (s) s.hidden = true; }
let THREE;
try { THREE = await import(THREE_URL); } catch (e) { fatal("3D motoru (Three.js) yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin."); throw e; }

/* ---------------- Sahne ---------------- */
const canvas = $("dkCanvas"), stage = $("dkStage");
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: "high-performance" }); }
catch (e) { fatal("Bu tarayıcı/cihaz 3D grafik (WebGL) desteklemiyor."); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 220);
const world = createWorld(THREE, scene);
const runner = createRunner(THREE); scene.add(runner.group);
const objs = createObjects(THREE, scene);
const sfx = createAudio(MUTE_KEY);

// Devasa Toksin Hücresi (kovalayan): kameranın alt kısmında, karakterin hemen arkasında
const chaser = new THREE.Group();
{
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 2), new THREE.MeshStandardMaterial({ color: 0x365314, emissive: 0x4d7c0f, emissiveIntensity: 0.5, roughness: 0.6, flatShading: true }));
  chaser.add(core);
  const spikeM = new THREE.MeshStandardMaterial({ color: 0x581c87, emissive: 0x7e22ce, emissiveIntensity: 0.7 });
  for (let i = 0; i < 26; i++) { const p = new THREE.Vector3().randomDirection(); const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 6), spikeM); s.position.copy(p).multiplyScalar(1.45); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p); core.add(s); }
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  [-0.45, 0.45].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), eyeM); e.position.set(x, 0.35, -1.25); chaser.add(e); });
  chaser.scale.setScalar(0.72); chaser.position.set(0, 0.4, 16); chaser.visible = false; scene.add(chaser);
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.75 ? 74 : 64; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); window.addEventListener("resize", resize); resize();

/* ---------------- Kayıt + mağaza ---------------- */
let profile = loadProfile();
let applied = null;
function applyLook() { applied = { char: profile.sel.char, acc: Object.assign({}, profile.sel.acc), board: profile.sel.board }; runner.setSkin(profile.sel.char); runner.setAccessories(profile.sel.acc); runner.setBoardType(profile.sel.board); }
applyLook();
const menu = createMenu({ getProfile: () => profile, sfx, onChange: () => { applyLook(); renderHud(true); }, toast: (t, k) => toast(t, k) });
menu.renderHome();

/* ---------------- Durum ---------------- */
const G = 26, JUMP_V = 10.6, SUPER = 1.42, SPAWN_Z = -118;
let S;
function fresh() {
  return {
    mode: "ready", t: 0, speed: 0, dist: 0, drops: 0, bonus: 0, level: 1,
    lane: 1, x: 0, y: 0, vy: 0, airborne: false, airT: 0, airDur: 2 * JUMP_V / G, noFlip: false, slideT: 0, slideK: 0, queuedSlide: false,
    hydration: 0, turboT: 0, magnetT: 0, jetT: 0, bootsT: 0, boardT: 0, invulnT: 0, chaseT: 0, stumble: 0, chaserZ: 16,
    untilRow: 30, prevPass: null, occ: [0, 0, 0], nextPowerAt: 140 + Math.random() * 100, nextLetterAt: 90 + Math.random() * 80, nextBoxAt: 450 + Math.random() * 300,
    letterOut: false, crashT: 0, shake: 0, roofDist: 0, crashReason: "",
    runStats: { jumps: 0, board: 0, power: 0, letters: 0 }
  };
}
S = fresh();
const best = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) { return 0; } };
const score = () => S.final != null ? S.final : Math.floor((Math.floor(S.dist) + S.drops * 10 + S.bonus) * profile.multiplier);

/* ---------------- HUD ---------------- */
let lastHud = "";
function renderHud(force) {
  const sc = score(), key = [sc, Math.floor(S.dist), S.drops, Math.round(S.hydration), Math.ceil(S.turboT), Math.ceil(S.magnetT), Math.ceil(S.jetT), Math.ceil(S.bootsT), Math.ceil(S.boardT), Math.ceil(S.chaseT), profile.boards, profile.multiplier, profile.word.got].join("|");
  if (!force && key === lastHud) return; lastHud = key;
  $("dkScore").textContent = String(sc);
  $("dkDist").textContent = Math.floor(S.dist) + " m";
  $("dkDrops").textContent = String(S.drops);
  $("dkBest").textContent = String(Math.max(best(), sc));
  $("dkHydFill").style.width = Math.min(100, S.hydration) + "%";
  $("dkHyd").classList.toggle("is-turbo", S.turboT > 0); $("dkHyd").setAttribute("aria-valuenow", String(Math.round(S.hydration)));
  const chips = [`<span class="dk-chip dk-chip--mult">✖ ${profile.multiplier}</span>`];
  if (S.chaseT > 0) chips.push(`<span class="dk-chip dk-chip--chase">☣ Toksin peşinde ${Math.ceil(S.chaseT)} sn</span>`);
  if (S.boardT > 0) chips.push(`<span class="dk-chip dk-chip--board">🛹 ${Math.ceil(S.boardT)} sn</span>`);
  if (S.turboT > 0) chips.push(`<span class="dk-chip dk-chip--turbo">⚡ Turbo ${Math.ceil(S.turboT)} sn</span>`);
  if (S.jetT > 0) chips.push(`<span class="dk-chip dk-chip--sun">🚀 D3 Jet ${Math.ceil(S.jetT)} sn</span>`);
  if (S.bootsT > 0) chips.push(`<span class="dk-chip dk-chip--boots">🥾 Mg Bot ${Math.ceil(S.bootsT)} sn</span>`);
  if (S.magnetT > 0) chips.push(`<span class="dk-chip dk-chip--magnet">🧲 Fe ${Math.ceil(S.magnetT)} sn</span>`);
  $("dkChips").innerHTML = chips.join("");
  const bb = $("dkBoardBtn"); bb.querySelector("b").textContent = String(profile.boards); bb.disabled = !(S.mode === "run" && profile.boards > 0 && S.boardT <= 0); bb.classList.toggle("is-on", S.boardT > 0);
  menu.renderWord($("dkWord"), profile.word);
}
function toast(text, tone) {
  const box = $("dkToasts"), d = document.createElement("div");
  d.className = "dk-toast" + (tone ? " dk-toast--" + tone : ""); d.textContent = text;
  box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 1900);
}
function mission(id, amount, runValue) {
  const r = bumpMission(profile, id, amount, runValue);
  r.done.forEach(() => { sfx.mission(); });
  if (r.done.length) { toast("Görev tamamlandı! 🎯", "level"); saveProfile(profile); }
  if (r.setDone) { toast(`Tüm görevler tamam! Skor çarpanı x${profile.multiplier}`, "turbo"); saveProfile(profile); }
}

/* ---------------- Oyun akışı ---------------- */
function start() {
  sfx.unlock(); objs.clear();
  profile = loadProfile(); applyLook();
  S = fresh(); S.mode = "run"; runner.reset();
  ["dkStart", "dkOver", "dkPause"].forEach(id => { $(id).hidden = true; }); menu.closeStore();
  $("dkPauseBtn").disabled = false; lastHud = ""; renderHud(true);
  for (let z = -46; z > SPAWN_Z; z -= 18) spawnRow(z, true);
}
function goMenu() { S = fresh(); objs.clear(); profile = loadProfile(); applyLook(); menu.renderHome(); $("dkOver").hidden = true; $("dkStart").hidden = false; $("dkPauseBtn").disabled = true; renderHud(true); }
function setPaused(p) {
  if (S.mode !== "run" && S.mode !== "paused") return;
  S.mode = p ? "paused" : "run"; $("dkPause").hidden = !p;
  $("dkPauseBtn").textContent = p ? "▶" : "⏸"; $("dkPauseBtn").setAttribute("aria-label", p ? "Devam et" : "Duraklat");
}
function crash(reason) {
  S.mode = "crashing"; S.crashT = 0; S.shake = 0.6; S.crashReason = reason || "front";
  sfx.crash(); objs.burst(S.x, S.y + 1, 0, 0xef4444, 40, 1.4);
  if (navigator.vibrate) try { navigator.vibrate([60, 40, 90]); } catch (_) {}
}
function gameOver() {
  S.mode = "over";
  const sc = score(), prev = best(), record = sc > prev;
  S.final = sc;  // sonradan kazanılan çarpan bu koşunun skorunu değiştirmez
  if (record) try { localStorage.setItem(BEST_KEY, String(sc)); } catch (_) {}
  try { localStorage.setItem("vo_best_damar", Math.max(prev, sc) + " puan"); } catch (_) {}
  // Kalıcı ekonomi: toplanan damlalar bankaya; tek koşu görevleri
  profile.bank += S.drops; profile.stats.runs += 1; profile.stats.bestDist = Math.max(profile.stats.bestDist, Math.floor(S.dist));
  mission("dist", 0, S.dist); mission("roof", Math.floor(S.roofDist));
  saveProfile(profile); menu.renderHome();
  $("dkOverTitle").textContent = S.crashReason === "chaser" ? "Toksin Hücresi Yakaladı!" : "Damar Tıkandı!";
  $("dkOverDist").textContent = Math.floor(S.dist) + " m";
  $("dkOverDrops").textContent = "+" + S.drops;
  $("dkOverScore").textContent = String(sc);
  $("dkOverBest").textContent = String(Math.max(prev, sc));
  $("dkOverBank").textContent = String(profile.bank);
  $("dkOverNote").textContent = (record ? "🎉 Yeni rekor! " : "") + `Skor çarpanı x${profile.multiplier}`;
  $("dkOver").hidden = false; $("dkPauseBtn").disabled = true; $("dkAgain").focus();
  renderHud(true);
}

/* ---------------- Sıra üretimi ---------------- */
function spawnRow(z, warmup) {
  const pat = makeRowPattern(S.level, Math.random, S.prevPass, S.occ.map(v => v > 0));
  S.prevPass = pat.pass;
  pat.lanes.forEach((type, l) => {
    if (!type) return;
    if (pat.moving && l === pat.moving.from) objs.spawn("virus", l, z, 0, { moving: { from: pat.moving.from, to: pat.moving.to, w: 1.3 + S.level * 0.12 } });
    else objs.spawn(type, l, z);
  });
  const roofs = [];
  pat.capsules.forEach(c => {
    const o = objs.spawn("capsule", c.lane, z - c.len / 2, 0, { len: c.len, ramp: c.ramp, color: Math.floor(Math.random() * 4) });
    S.occ[c.lane] = c.len + 6;
    roofs.push(o);
    // Çatı: yoğun su damlası dizisi
    for (let d = c.len / 2 - 1.5; d > -c.len / 2 + 1; d -= 1.6) objs.spawn("drop", c.lane, o.z + d, CAPSULE.top + 0.6);
  });
  const lane = (pat.free.length ? pat.free : pat.pass)[Math.floor(Math.random() * (pat.free.length || pat.pass.length))];
  if (S.jetT > 0) for (let i = 0; i < 6; i++) objs.spawn("drop", Math.random() < 0.3 ? 1 : lane, z + 2 + i * 2.4, 5.4);
  else if (!pat.capsules.length && Math.random() < 0.75) for (let i = 0; i < 5; i++) objs.spawn("drop", lane, z + 3 + i * 2, 0.55);
  pat.lanes.forEach((type, l) => { if (type === "plaque" && Math.random() < 0.5 && S.jetT <= 0) for (let i = -2; i <= 2; i++) objs.spawn("drop", l, z + i * 1.15, 0.6 + 1.55 * (1 - (i / 2.6) ** 2)); });
  if (warmup) return;
  const place = (type, extra) => {
    if (roofs.length && Math.random() < 0.6) { const r = roofs[Math.floor(Math.random() * roofs.length)]; return objs.spawn(type, r.lane, r.z + (Math.random() - 0.5) * r.len * 0.4, CAPSULE.top + 1.1, extra); }
    const pl = pat.lanes.findIndex(t => t === "plaque");
    if (type === "letter" && pl >= 0) return objs.spawn(type, pl, z, 2.25, extra); // zıplama noktası
    return objs.spawn(type, lane, z + 8, 1.1, extra);
  };
  // Güçlendirici (Jet, Bot, Mıknatıs)
  if (S.dist >= S.nextPowerAt) {
    const opts = ["magnet", "jet", "boots"].filter(k => !(k === "magnet" && S.magnetT > 0) && !(k === "jet" && S.jetT > 0) && !(k === "boots" && S.bootsT > 0));
    if (opts.length) place(opts[Math.floor(Math.random() * opts.length)]);
    S.nextPowerAt = S.dist + 220 + Math.random() * 200;
  }
  // Günlük kelimenin sıradaki harfi
  if (!profile.word.done && !S.letterOut && S.dist >= S.nextLetterAt) {
    place("letter", { ch: [...profile.word.word][profile.word.got] }); S.letterOut = true;
    S.nextLetterAt = S.dist + 150 + Math.random() * 120;
  }
  // Gizemli Biyo-Kapsül (nadir)
  if (S.dist >= S.nextBoxAt) { place("box"); S.nextBoxAt = S.dist + 700 + Math.random() * 500; }
}

/* ---------------- Girdi ---------------- */
function laneBlocked(nl) {
  const top = CAPSULE.top - 0.45;
  if (S.y < top && objs.capsuleBeside(nl)) return true;
  const ph = S.slideK > 0.5 ? 0.7 : 1.75;
  return objs.list.some(o => o.alive && OB[o.type] && o.lane === nl && !o.moving && Math.abs(o.z) < OB[o.type].hz + 0.45 && S.y < OB[o.type].y1 && S.y + ph > OB[o.type].y0);
}
function graze() {
  S.stumble = 0.45; S.shake = Math.max(S.shake, 0.22); sfx.graze();
  objs.burst(S.x, S.y + 1, 0, 0xfbbf24, 10, 0.6);
  if (S.boardT > 0) { breakBoard(); return; }
  if (S.chaseT > 0) { crash("chaser"); return; }
  S.chaseT = 5; sfx.chaser(); toast("Toksin hücresi peşinde! 5 sn hatasız koş", "level");
}
function move(dir) {
  if (S.mode !== "run") return;
  const nl = Math.max(0, Math.min(2, S.lane + dir));
  if (nl === S.lane) return;
  if (S.jetT <= 0 && S.invulnT <= 0 && S.turboT <= 0 && laneBlocked(nl)) { graze(); return; }  // yan duvara sürtme
  S.lane = nl; sfx.lane();
}
function jump() {
  if (S.mode !== "run" || S.jetT > 0 || S.airborne) return;
  const sup = S.bootsT > 0 || (S.boardT > 0 && profile.sel.board === "magnezyum");
  const v = JUMP_V * (sup ? SUPER : 1);
  S.airborne = true; S.vy = v; S.airT = 0; S.airDur = 2 * v / G; S.noFlip = false; S.slideT = 0; sfx.jump();
  S.runStats.jumps++; mission("jump", 1);
}
function slide() {
  if (S.mode !== "run" || S.jetT > 0) return;
  if (S.airborne) { S.vy = Math.min(S.vy, -17); S.queuedSlide = true; return; }
  S.slideT = 0.78; sfx.slide();
}
function useBoard() {
  if (S.mode !== "run" || S.boardT > 0) return false;
  if (profile.boards <= 0) { toast("Nano-Kaykay stoğun yok — VitaMağaza'dan alabilirsin", "level"); return false; }
  profile.boards -= 1; S.boardT = 15; saveProfile(profile);
  sfx.board(); toast(`Nano-Kaykay aktif! 15 sn${profile.sel.board === "magnezyum" ? " · süper zıplama" : ""}`, "turbo");
  objs.burst(S.x, S.y + 0.2, 0, 0x5eead4, 20, 0.8);
  S.runStats.board++; mission("board", 1); renderHud(true);
  return true;
}
function breakBoard() { S.boardT = 0; S.invulnT = 1.0; sfx.boardBreak(); S.shake = 0.3; objs.burst(S.x, S.y + 0.3, 0, 0x5eead4, 36, 1.3); toast("Kaykay parçalandı — koşu devam ediyor!", "turbo"); }

window.addEventListener("keydown", (e) => {
  const k = e.key;
  if (menu.isOpen()) return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(k)) e.preventDefault();
  if ((k === "Enter" || k === " ") && (S.mode === "ready" || S.mode === "over")) { start(); return; }
  if (k === "p" || k === "P" || k === "Escape") { setPaused(S.mode === "run"); return; }
  if (S.mode === "paused" && (k === " " || k === "Enter")) { setPaused(false); return; }
  if (e.repeat) return;
  if (k === "ArrowLeft" || k === "a" || k === "A") move(-1);
  else if (k === "ArrowRight" || k === "d" || k === "D") move(1);
  else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") jump();
  else if (k === "ArrowDown" || k === "s" || k === "S") slide();
  else if (k === "e" || k === "E") useBoard();
});
/* Dokunma: 20 px'te anında kaydırma; kaydırmasız iki dokunuş (≤ 320 ms) = kaykay */
let sw = null, lastTap = 0;
stage.addEventListener("touchstart", (e) => { if (e.touches.length !== 1) return; const t = e.touches[0]; sw = { x: t.clientX, y: t.clientY, done: false }; sfx.unlock(); }, { passive: true });
stage.addEventListener("touchmove", (e) => {
  if (!sw || sw.done) return;
  const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  sw.done = true; lastTap = 0;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else slide();
}, { passive: true });
stage.addEventListener("touchend", (e) => {
  if (sw && !sw.done && !(e.target.closest && e.target.closest("button,a"))) {
    const now = performance.now();
    if (now - lastTap < 320) { useBoard(); lastTap = 0; } else lastTap = now;
  }
  sw = null;
}, { passive: true });
stage.addEventListener("touchcancel", () => { sw = null; }, { passive: true });
/* Fare: çift tık (iki tık ≤ 320 ms). Dokunmadan doğan sentetik tıklamalar yok sayılır (o yol yukarıda). */
let lastTouchAt = 0, lastClick = 0;
stage.addEventListener("touchstart", () => { lastTouchAt = performance.now(); }, { passive: true });
stage.addEventListener("click", (e) => {
  const now = performance.now();
  if (now - lastTouchAt < 900 || (e.target.closest && e.target.closest("button,a,.dk-overlay,.dk-store,.dk-boxopen"))) return;
  if (now - lastClick < 320) { useBoard(); lastClick = 0; } else lastClick = now;
});
document.addEventListener("visibilitychange", () => { if (document.hidden && S.mode === "run") setPaused(true); });

$("dkPlay").addEventListener("click", start);
$("dkAgain").addEventListener("click", start);
$("dkMenuBtn").addEventListener("click", goMenu);
$("dkResume").addEventListener("click", () => setPaused(false));
$("dkPauseBtn").addEventListener("click", () => setPaused(S.mode === "run"));
$("dkBoardBtn").addEventListener("click", (e) => { e.stopPropagation(); useBoard(); });
$("dkShopBtn").addEventListener("click", () => menu.openStore());
$("dkOverShop").addEventListener("click", () => menu.openStore());
const soundBtn = $("dkSound");
function syncSound() { soundBtn.textContent = sfx.muted ? "🔇" : "🔊"; soundBtn.setAttribute("aria-pressed", sfx.muted ? "false" : "true"); soundBtn.setAttribute("aria-label", sfx.muted ? "Sesi aç" : "Sesi kapat"); }
soundBtn.addEventListener("click", () => { sfx.setMuted(!sfx.muted); syncSound(); if (!sfx.muted) sfx.lane(); });
syncSound();

/* ---------------- Toplama ve çarpışma ---------------- */
function collect(o) {
  if (o.type === "drop") {
    S.drops += 1; sfx.drop(); mission("drops", 1);
    objs.burst(o.x, o.y, o.z, 0x22d3ee, 6, 0.5);
    if (S.turboT <= 0) { S.hydration = Math.min(100, S.hydration + 4); if (S.hydration >= 100) { S.turboT = 5; sfx.turbo(); toast("Hız Patlaması! 5 sn dokunulmazlık", "turbo"); } }
  } else if (o.type === "letter") {
    S.letterOut = false; sfx.letter(); S.runStats.letters++; mission("letter", 1);
    const w = profile.word, letters = [...w.word];
    if (!w.done && letters[w.got] === o.ch) {
      w.got += 1;
      if (w.got >= letters.length) {
        w.done = true; profile.bank += 150; profile.boxes += 1; sfx.word();
        toast(`🎉 "${w.word}" tamamlandı! +150 Damla + 1 Gizemli Kapsül`, "turbo");
        celebrate();
      } else toast(`Harf: ${o.ch} (${w.got}/${letters.length})`, "sun");
      saveProfile(profile);
    }
    objs.burst(o.x, o.y, o.z, 0xfacc15, 24, 0.9);
  } else if (o.type === "box") {
    profile.boxes += 1; saveProfile(profile); sfx.power();
    toast("Gizemli Biyo-Kapsül! VitaMağaza'da açabilirsin", "sun"); objs.burst(o.x, o.y, o.z, 0xa855f7, 26, 1);
  } else {
    S.runStats.power++; mission("power", 1); sfx.power();
    if (o.type === "magnet") { S.magnetT = 10; sfx.magnet(); toast("Fe Mıknatısı: 10 sn", "magnet"); }
    else if (o.type === "jet") { S.jetT = 10; S.airborne = false; S.vy = 0; S.slideT = 0; sfx.sun(); toast("D3 Jet-Pack: 10 sn uçuş!", "sun"); }
    else if (o.type === "boots") { S.bootsT = 10; toast("Magnezyum Zıplama Botları: 10 sn 2× zıplama", "magnet"); }
    objs.burst(o.x, o.y + 0.2, o.z, o.type === "magnet" ? 0xef4444 : o.type === "jet" ? 0xfacc15 : 0xa855f7, 22, 0.9);
  }
  objs.remove(o);
}
function celebrate() { const c = $("dkCelebrate"); c.hidden = false; c.classList.remove("is-on"); void c.offsetWidth; c.classList.add("is-on"); setTimeout(() => { c.hidden = true; }, 2200); for (let i = 0; i < 4; i++) objs.burst(S.x + (Math.random() - 0.5) * 4, 2 + Math.random() * 2, -4 - Math.random() * 6, [0xfacc15, 0x2dd4bf, 0xf472b6, 0xa855f7][i], 40, 1.4); }
function hitObstacle(o, isCapsule) {
  if (S.jetT > 0 || S.invulnT > 0) return false;
  const col = isCapsule ? 0xf97316 : o.type === "plaque" ? 0xf59e0b : o.type === "gate" ? 0xa855f7 : 0xdc2626;
  if (S.turboT > 0) { S.bonus += isCapsule ? 120 : 50; sfx.smash(); S.shake = Math.max(S.shake, 0.2); objs.burst(o.x, 1, isCapsule ? 0 : o.z, col, isCapsule ? 50 : 26, 1.3); objs.remove(o); return false; }
  if (S.boardT > 0) { objs.burst(o.x, 1, isCapsule ? 0 : o.z, col, 40, 1.4); objs.remove(o); breakBoard(); return false; }
  crash("front"); return true;
}

/* ---------------- Güncelleme ---------------- */
function update(dt) {
  S.t += dt;
  const lvl = 1 + Math.floor(S.dist / 200);                     // her 200 m'de hızlanma
  if (lvl > S.level) { S.level = lvl; sfx.level(); toast(`Nabız Hızlanıyor: Seviye ${lvl}`, "level"); }
  const base = Math.min(42, 16 + (S.level - 1) * 2.2 + ((S.dist % 200) / 200) * 1.2);
  const target = base * (S.turboT > 0 ? 1.6 : 1) * (S.stumble > 0 ? 0.8 : 1);
  S.speed += (target - S.speed) * Math.min(1, dt * 3);
  S.dist += S.speed * dt;
  for (let l = 0; l < 3; l++) S.occ[l] = Math.max(0, S.occ[l] - S.speed * dt);

  // Zamanlayıcılar
  if (S.turboT > 0) { S.turboT -= dt; S.hydration = Math.max(0, 100 * S.turboT / 5); if (S.turboT <= 0) { S.turboT = 0; S.hydration = 0; S.invulnT = 0.8; } }
  S.magnetT = Math.max(0, S.magnetT - dt); S.bootsT = Math.max(0, S.bootsT - dt); S.invulnT = Math.max(0, S.invulnT - dt); S.stumble = Math.max(0, S.stumble - dt);
  if (S.boardT > 0) { S.boardT -= dt; if (S.boardT <= 0) { S.boardT = 0; toast("Kaykay süresi doldu", "level"); } }
  if (S.chaseT > 0) { S.chaseT -= dt; if (S.chaseT <= 0) { S.chaseT = 0; toast("Toksin geri çekildi", "level"); } }

  // Şerit geçişi
  S.x += (LANES[S.lane] - S.x) * Math.min(1, dt * 14);
  // Dikey: jet / zemin (kapsül çatısı, rampa) / zıplama
  const ground = objs.groundAt(LANES[S.lane]);
  if (S.jetT > 0) {
    S.jetT -= dt; S.y += (5.4 - S.y) * Math.min(1, dt * 3); S.airborne = false;
    if (S.jetT <= 0) { S.jetT = 0; S.airborne = true; S.vy = 0; S.noFlip = true; S.airT = 0; S.invulnT = 1.2; }
  } else if (S.airborne) {
    S.vy -= G * dt; S.y += S.vy * dt; S.airT += dt;
    if (S.y <= ground.h && S.vy <= 0) { S.y = ground.h; S.vy = 0; S.airborne = false; if (S.queuedSlide) { S.queuedSlide = false; S.slideT = 0.7; sfx.slide(); } }
  } else {
    if (ground.h > S.y + 0.02) { if (ground.onRamp || ground.h - S.y < 0.7 || S.invulnT > 0 || S.turboT > 0) S.y = ground.h; }    // rampadan tırmanma
    else if (ground.h < S.y - 0.05) { S.airborne = true; S.vy = 0; S.airT = 0; S.noFlip = true; } // çatıdan düşüş
    else S.y = ground.h;
  }
  if (!S.airborne && S.jetT <= 0 && S.y > CAPSULE.top - 0.2) S.roofDist += S.speed * dt;
  if (S.slideT > 0) S.slideT = Math.max(0, S.slideT - dt);
  S.slideK += ((S.slideT > 0 ? 1 : 0) - S.slideK) * Math.min(1, dt * 16);

  // Sıralar
  S.untilRow -= S.speed * dt;
  if (S.untilRow <= 0) { spawnRow(SPAWN_Z); S.untilRow = Math.max(11.5, 21 - S.level * 1.0) + Math.random() * 4; }

  // Nesneler
  const ph = S.slideK > 0.5 ? 0.7 : 1.75, list = objs.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (!o.alive) { list.splice(i, 1); continue; }
    o.z += S.speed * dt; o.t += dt;
    if (o.moving) o.x = LANES[o.moving.from] + (LANES[o.moving.to] - LANES[o.moving.from]) * (Math.sin(o.t * o.moving.w) + 1) / 2;
    let bob = 0;
    if (o.type === "drop") {
      o.mesh.rotation.y += dt * 3;
      if (S.magnetT > 0 && o.z > -30 && o.z < 1.5) { const k = Math.min(1, dt * 7); o.x += (S.x - o.x) * k; o.y += (S.y + 0.9 - o.y) * k; o.z += (0 - o.z) * k * 0.6; } // zemin + çatı
      bob = Math.sin(o.t * 4) * 0.08;
    } else if (o.type === "virus") { o.mesh.children[0].rotation.x += dt * 1.6; o.mesh.children[0].rotation.y += dt * 2.1; }
    else if (o.type === "letter" || o.type === "box" || o.type === "magnet" || o.type === "jet" || o.type === "boots") { o.mesh.rotation.y += dt * 2.6; bob = Math.sin(o.t * 3) * 0.15; }
    o.mesh.position.set(o.x, o.y + bob, o.z);

    if (S.mode === "run") {
      if (o.type === "capsule") {
        const front = o.z + o.len / 2;
        // Ön yüze çarpma: oyuncu şeritte, çatı seviyesinin altında ve rampadan gelmiyor
        if (Math.abs(o.x - S.x) < 1.0 && front > -0.25 && front < 0.55 && S.y < CAPSULE.top - 0.45) {
          if (hitObstacle(o, true)) break;
          if (!o.alive) { list.splice(i, 1); continue; }
        }
      } else if (OB[o.type]) {
        const b = OB[o.type];
        if (Math.abs(o.z) < b.hz + 0.35 && Math.abs(o.x - S.x) < b.hx + 0.32 && S.y < b.y1 && S.y + ph > b.y0) {
          if (hitObstacle(o, false)) break;
          if (!o.alive) { list.splice(i, 1); continue; }
        }
      } else if (Math.abs(o.x - S.x) < 0.85 && Math.abs(o.z) < 0.9 && o.y > S.y - 0.4 && o.y < S.y + ph + 0.4) { collect(o); list.splice(i, 1); continue; }
    }
    const tail = o.type === "capsule" ? o.z - o.len / 2 : o.z;
    if (tail > 9) { if (o.type === "letter") S.letterOut = false; objs.remove(o); list.splice(i, 1); }
  }
}

/* ---------------- Döngü ---------------- */
let last = performance.now();
const camPos = new THREE.Vector3(0, 3.5, 6.4), camLook = new THREE.Vector3(0, 1.2, -9);
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.mode === "run") update(dt);
  else if (S.mode === "crashing") { S.crashT += dt; S.speed *= Math.pow(0.02, dt); if (S.crashReason === "chaser") S.chaserZ += (0.9 - S.chaserZ) * Math.min(1, dt * 6); if (S.crashT > 0.75) gameOver(); }
  const paused = S.mode === "paused";
  const flow = S.mode === "run" || S.mode === "crashing" ? S.speed : S.mode === "ready" ? 6 : 0;
  const bpm = 72 + (S.level - 1) * 10 + (S.turboT > 0 ? 30 : 0) + (S.chaseT > 0 ? 25 : 0);
  world.update(paused ? 0 : dt, flow, paused ? 0.001 : bpm);
  objs.updateParticles(paused ? 0 : dt, flow);
  runner.group.position.set(S.x, S.y, 0);
  runner.update(paused ? 0 : dt, {
    running: S.mode === "run" || S.mode === "ready", speed: flow, airborne: S.airborne && !S.noFlip, airT: S.airT, airDur: S.airDur,
    slideK: S.slideK, flying: S.jetT > 0, hydration: S.hydration, shield: false, turbo: S.turboT > 0, crashed: S.mode === "crashing" || S.mode === "over",
    board: S.boardT > 0, boots: S.bootsT > 0, stumble: S.stumble
  });
  runner.group.visible = !(S.invulnT > 0 && Math.floor(S.t * 14) % 2 === 0);
  // Kovalayan toksin: sürtmeden sonra kameranın altında belirir, 5 sn sonra geri çekilir
  if (S.mode !== "crashing") S.chaserZ += ((S.chaseT > 0 ? 2.0 : 16) - S.chaserZ) * Math.min(1, dt * 3);
  chaser.visible = S.chaserZ < 13; const lurk = S.mode === "crashing" ? 0 : 1.3 * Math.tanh(3 * Math.sin(performance.now() / 1100));  // ekranın bir kenarından diğerine süzülür, oyuncuyu kapatmaz
  chaser.position.set(S.x * 0.55 + lurk, 0.5 + Math.sin(performance.now() / 180) * 0.1, S.chaserZ);
  if (chaser.visible) { chaser.children[0].rotation.y += dt * 1.5; chaser.children[0].rotation.x += dt * 0.7; }
  world.glow.position.set(S.x, S.y + 2.4, 1.6);
  camPos.set(S.x * 0.55, 3.5 + S.y * 0.55, 6.4); camLook.set(S.x * 0.55, 1.2 + S.y * 0.5, -9);
  camera.position.lerp(camPos, Math.min(1, dt * 8));
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt); const k = S.shake * 0.9; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; }
  camera.lookAt(camLook);
  const fovT = (stage.clientWidth / stage.clientHeight < 0.75 ? 74 : 64) + (S.turboT > 0 ? 8 : 0);
  if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  renderer.render(scene, camera);
  if (S.mode === "run" || S.mode === "crashing") renderHud();
}
renderHud(true);
requestAnimationFrame(frame);
$("dkLoading").hidden = true;
$("dkPlay").disabled = false;

/* Test ve hata ayıklama arayüzü */
window.DamarKosucusu = {
  state: () => ({ mode: S.mode, lane: S.lane, x: +S.x.toFixed(2), y: +S.y.toFixed(2), airborne: S.airborne, sliding: S.slideK > 0.5, speed: +S.speed.toFixed(1), dist: Math.floor(S.dist), drops: S.drops, score: score(), level: S.level, hydration: S.hydration, turbo: S.turboT, magnet: S.magnetT, jet: S.jetT, boots: S.bootsT, board: S.boardT, chase: S.chaseT, stumble: S.stumble, invuln: S.invulnT, roof: Math.floor(S.roofDist), crashReason: S.crashReason, objects: objs.list.length, capsules: objs.list.filter(o => o.type === "capsule").length }),
  profile: () => JSON.parse(JSON.stringify(profile)),
  start, makeRowPattern, useBoard,
  debug: {
    clear: () => objs.clear(),
    spawn: (type, lane, z, y, extra) => { objs.spawn(type, lane, z, y !== undefined ? y : (type === "drop" ? 0.55 : OB[type] || type === "capsule" ? 0 : 1.1), extra || (type === "capsule" ? { len: 16, ramp: false, color: 0 } : type === "letter" ? { ch: [...profile.word.word][profile.word.got] } : {})); },
    set: (patch) => Object.assign(S, patch),
    holdRows: (v) => { S.untilRow = v ? 1e9 : 10; },
    setProfile: (patch) => { Object.assign(profile, patch); saveProfile(profile); applyLook(); menu.renderHome(); renderHud(true); },
    ground: () => objs.groundAt(LANES[S.lane]),
    look: () => applied
  }
};
