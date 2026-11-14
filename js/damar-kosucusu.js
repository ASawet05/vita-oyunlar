/* Damar Yolu Koşucusu — ana modül (oyun döngüsü, girdi, HUD, güçlendiriciler).
   Three.js resmi CDN'den (sürümü sabit) yüklenir; dünya, karakter, nesneler ve ses ayrı modüllerdedir. */
import { createAudio } from "./damar/ses.js";
import { createWorld, LANES } from "./damar/dunya.js";
import { createRunner } from "./damar/karakter.js";
import { createObjects, makeRowPattern, OB } from "./damar/nesneler.js";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const $ = (id) => document.getElementById(id);
const BEST_KEY = "vo_damar_best", MUTE_KEY = "vo_damar_muted";

function fatal(msg) {
  const f = $("dkFatal"); if (f) { f.hidden = false; f.querySelector("p").textContent = msg; }
  const s = $("dkStart"); if (s) s.hidden = true;
}

let THREE;
try { THREE = await import(THREE_URL); }
catch (e) { fatal("3D motoru (Three.js) yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin."); throw e; }

/* ---------------- Sahne ---------------- */
const canvas = $("dkCanvas"), stage = $("dkStage");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: "high-performance" });
} catch (e) { fatal("Bu tarayıcı/cihaz 3D grafik (WebGL) desteklemiyor."); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 220);
const world = createWorld(THREE, scene);
const runner = createRunner(THREE); scene.add(runner.group);
const objs = createObjects(THREE, scene);
const sfx = createAudio(MUTE_KEY);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.75 ? 74 : 64; // dikey telefonda biraz geniş açı
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
window.addEventListener("resize", resize);
resize();

/* ---------------- Durum ---------------- */
const G = 26, JUMP_V = 10.6, SPAWN_Z = -118;
let S;
function fresh() {
  return {
    mode: "ready", t: 0, speed: 0, dist: 0, drops: 0, bonus: 0, level: 1,
    lane: 1, x: 0, y: 0, vy: 0, airborne: false, airT: 0, airDur: 2 * JUMP_V / G, fastFall: false,
    slideT: 0, slideK: 0, queuedSlide: false,
    hydration: 0, turboT: 0, shield: false, magnetT: 0, flyT: 0, invulnT: 0,
    untilRow: 30, prevFree: null, nextPowerAt: 160 + Math.random() * 120, crashT: 0, shake: 0
  };
}
S = fresh();
const best = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) { return 0; } };
const score = () => Math.floor(S.dist) + S.drops * 10 + S.bonus;

/* ---------------- HUD ---------------- */
const hud = { score: $("dkScore"), dist: $("dkDist"), drops: $("dkDrops"), best: $("dkBest"), hyd: $("dkHydFill"), hydWrap: $("dkHyd"), chips: $("dkChips") };
let lastHud = "";
function renderHud() {
  const sc = score(), key = sc + "|" + Math.floor(S.dist) + "|" + S.drops + "|" + Math.round(S.hydration) + "|" + Math.ceil(S.turboT) + Math.ceil(S.magnetT) + Math.ceil(S.flyT) + S.shield;
  if (key === lastHud) return; lastHud = key;
  hud.score.textContent = String(sc);
  hud.dist.textContent = Math.floor(S.dist) + " m";
  hud.drops.textContent = String(S.drops);
  hud.best.textContent = String(Math.max(best(), sc));
  hud.hyd.style.width = Math.min(100, S.hydration) + "%";
  hud.hydWrap.classList.toggle("is-turbo", S.turboT > 0);
  hud.hydWrap.setAttribute("aria-valuenow", String(Math.round(S.hydration)));
  const chips = [];
  if (S.turboT > 0) chips.push(`<span class="dk-chip dk-chip--turbo">⚡ Turbo ${Math.ceil(S.turboT)} sn</span>`);
  if (S.shield) chips.push(`<span class="dk-chip dk-chip--shield">🛡️ C Kalkanı</span>`);
  if (S.magnetT > 0) chips.push(`<span class="dk-chip dk-chip--magnet">🧲 Fe ${Math.ceil(S.magnetT)} sn</span>`);
  if (S.flyT > 0) chips.push(`<span class="dk-chip dk-chip--sun">☀️ D3 ${Math.ceil(S.flyT)} sn</span>`);
  hud.chips.innerHTML = chips.join("");
}
function toast(text, tone) {
  const box = $("dkToasts"), d = document.createElement("div");
  d.className = "dk-toast" + (tone ? " dk-toast--" + tone : ""); d.textContent = text;
  box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 1900);
}

/* ---------------- Oyun akışı ---------------- */
function start() {
  sfx.unlock();
  objs.clear();
  S = fresh(); S.mode = "run";
  runner.reset();
  $("dkStart").hidden = true; $("dkOver").hidden = true; $("dkPause").hidden = true;
  $("dkPauseBtn").disabled = false;
  lastHud = ""; renderHud();
  // İlk birkaç sıra: başlangıçta yol boş görünmesin
  for (let z = -46; z > SPAWN_Z; z -= 18) spawnRow(z);
}
function setPaused(p) {
  if (S.mode !== "run" && S.mode !== "paused") return;
  S.mode = p ? "paused" : "run";
  $("dkPause").hidden = !p;
  $("dkPauseBtn").textContent = p ? "▶" : "⏸";
  $("dkPauseBtn").setAttribute("aria-label", p ? "Devam et" : "Duraklat");
}
function crash() {
  S.mode = "crashing"; S.crashT = 0; S.shake = 0.6;
  sfx.crash();
  objs.burst(S.x, S.y + 1, 0, 0xef4444, 40, 1.4);
  if (navigator.vibrate) try { navigator.vibrate([60, 40, 90]); } catch (_) {}
}
function gameOver() {
  S.mode = "over";
  const sc = score(), prev = best(), record = sc > prev;
  if (record) try { localStorage.setItem(BEST_KEY, String(sc)); } catch (_) {}
  try { localStorage.setItem("vo_best_damar", Math.max(prev, sc) + " puan"); } catch (_) {}
  $("dkOverDist").textContent = Math.floor(S.dist) + " m";
  $("dkOverDrops").textContent = String(S.drops);
  $("dkOverScore").textContent = String(sc);
  $("dkOverBest").textContent = String(Math.max(prev, sc));
  $("dkOverNote").textContent = record ? "🎉 Yeni rekor!" : (prev ? `Rekora ${prev - sc} puan kaldı.` : "");
  $("dkOver").hidden = false; $("dkPauseBtn").disabled = true;
  $("dkAgain").focus();
  renderHud();
}

/* ---------------- Sıra üretimi ---------------- */
function spawnRow(z) {
  const pat = makeRowPattern(S.level, Math.random, S.prevFree);
  S.prevFree = pat.free;
  pat.lanes.forEach((type, l) => {
    if (!type) return;
    if (pat.moving && l === pat.moving.from) objs.spawn("virus", l, z, 0, { moving: { from: pat.moving.from, to: pat.moving.to, w: 1.3 + S.level * 0.12 } });
    else objs.spawn(type, l, z);
  });
  const lane = pat.free[Math.floor(Math.random() * pat.free.length)];
  if (S.flyT > 0) {
    for (let i = 0; i < 6; i++) objs.spawn("drop", Math.floor(Math.random() * 3) === 1 ? 1 : lane, z + 2 + i * 2.4, 3.35);
  } else if (Math.random() < 0.78) {
    for (let i = 0; i < 5; i++) objs.spawn("drop", lane, z + 3 + i * 2, 0.55);
  }
  // Kolesterol plağının üstünde zıplama yayı şeklinde damlalar
  pat.lanes.forEach((type, l) => {
    if (type !== "plaque" || Math.random() > 0.55 || S.flyT > 0) return;
    for (let i = -2; i <= 2; i++) objs.spawn("drop", l, z + i * 1.15, 0.6 + 1.55 * (1 - (i / 2.6) ** 2));
  });
  // Güçlendirici
  if (S.dist >= S.nextPowerAt) {
    const opts = ["shield", "magnet", "sun"].filter(k => !(k === "shield" && S.shield) && !(k === "magnet" && S.magnetT > 0) && !(k === "sun" && S.flyT > 0));
    if (opts.length) objs.spawn(opts[Math.floor(Math.random() * opts.length)], lane, z + 8, 1.0);
    S.nextPowerAt = S.dist + 260 + Math.random() * 220;
  }
}

/* ---------------- Girdi ---------------- */
function move(dir) {
  if (S.mode !== "run") return;
  const nl = Math.max(0, Math.min(2, S.lane + dir));
  if (nl !== S.lane) { S.lane = nl; sfx.lane(); }
}
function jump() {
  if (S.mode !== "run" || S.flyT > 0) return;
  if (!S.airborne) { S.airborne = true; S.vy = JUMP_V; S.airT = 0; S.airDur = 2 * JUMP_V / G; S.slideT = 0; S.fastFall = false; sfx.jump(); }
}
function slide() {
  if (S.mode !== "run" || S.flyT > 0) return;
  if (S.airborne) { S.vy = Math.min(S.vy, -17); S.fastFall = true; S.queuedSlide = true; return; } // havadayken hızlı iniş + kayma
  S.slideT = 0.78; sfx.slide();
}
window.addEventListener("keydown", (e) => {
  const k = e.key;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(k)) e.preventDefault();
  if ((k === "Enter" || k === " ") && (S.mode === "ready" || S.mode === "over")) { start(); return; }
  if (k === "p" || k === "P" || k === "Escape") { setPaused(S.mode === "run"); return; }
  if (S.mode === "paused" && (k === " " || k === "Enter")) { setPaused(false); return; }
  if (e.repeat) return;
  if (k === "ArrowLeft" || k === "a" || k === "A") move(-1);
  else if (k === "ArrowRight" || k === "d" || k === "D") move(1);
  else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") jump();
  else if (k === "ArrowDown" || k === "s" || k === "S") slide();
});
/* Kaydırma (swipe): 20 px eşik, hareket sırasında anında tetiklenir (parmağı kaldırmayı beklemez) */
let sw = null;
stage.addEventListener("touchstart", (e) => { if (e.touches.length !== 1) return; const t = e.touches[0]; sw = { x: t.clientX, y: t.clientY, done: false }; sfx.unlock(); }, { passive: true });
stage.addEventListener("touchmove", (e) => {
  if (!sw || sw.done) return;
  const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  sw.done = true;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else slide();
}, { passive: true });
stage.addEventListener("touchend", () => { sw = null; }, { passive: true });
stage.addEventListener("touchcancel", () => { sw = null; }, { passive: true });
document.addEventListener("visibilitychange", () => { if (document.hidden && S.mode === "run") setPaused(true); });

$("dkPlay").addEventListener("click", start);
$("dkAgain").addEventListener("click", start);
$("dkResume").addEventListener("click", () => setPaused(false));
$("dkPauseBtn").addEventListener("click", () => setPaused(S.mode === "run"));
const soundBtn = $("dkSound");
function syncSound() { soundBtn.textContent = sfx.muted ? "🔇" : "🔊"; soundBtn.setAttribute("aria-pressed", sfx.muted ? "false" : "true"); soundBtn.setAttribute("aria-label", sfx.muted ? "Sesi aç" : "Sesi kapat"); }
soundBtn.addEventListener("click", () => { sfx.setMuted(!sfx.muted); syncSound(); if (!sfx.muted) sfx.lane(); });
syncSound();

/* ---------------- Güncelleme ---------------- */
function collect(o) {
  if (o.type === "drop") {
    S.drops += 1; sfx.drop();
    objs.burst(o.x, o.y, o.z, 0x22d3ee, 6, 0.5);
    if (S.turboT <= 0) {
      S.hydration = Math.min(100, S.hydration + 4);
      if (S.hydration >= 100) { S.turboT = 5; sfx.turbo(); toast("Hız Patlaması! 5 sn dokunulmazlık", "turbo"); }
    }
  } else if (o.type === "shield") { S.shield = true; sfx.shield(); toast("C Vitamini Kalkanı! Bir çarpmayı emer", "shield"); }
  else if (o.type === "magnet") { S.magnetT = 8; sfx.magnet(); toast("Demir (Fe) Mıknatısı: 8 sn", "magnet"); }
  else if (o.type === "sun") { S.flyT = 7; S.airborne = false; S.vy = 0; S.slideT = 0; sfx.sun(); toast("D3 Güneş Işını: 7 sn uçuş!", "sun"); }
  if (o.type !== "drop") objs.burst(o.x, o.y + 0.2, o.z, o.type === "shield" ? 0xfb923c : o.type === "magnet" ? 0xef4444 : 0xfacc15, 22, 0.9);
  objs.remove(o);
}
function hitObstacle(o) {
  if (S.flyT > 0 || S.invulnT > 0) return;
  if (S.turboT > 0) { // turbo: engeli parçala
    S.bonus += 50; sfx.smash(); S.shake = Math.max(S.shake, 0.18);
    objs.burst(o.x, 1, o.z, o.type === "plaque" ? 0xf59e0b : o.type === "gate" ? 0xa855f7 : 0xdc2626, 26, 1.2);
    objs.remove(o); return;
  }
  if (S.shield) {
    S.shield = false; S.invulnT = 1.0; sfx.shieldBreak(); S.shake = 0.3;
    objs.burst(S.x, 1, 0, 0xfb923c, 30, 1.1); objs.remove(o);
    toast("Kalkan kırıldı! Koşu devam ediyor", "shield");
    return;
  }
  crash();
}
function update(dt) {
  S.t += dt;
  // Seviye ve hız (mesafe arttıkça kademeli)
  const lvl = 1 + Math.floor(S.dist / 350);
  if (lvl > S.level) { S.level = lvl; sfx.level(); toast(`Nabız Hızlanıyor: Seviye ${lvl}`, "level"); }
  const base = Math.min(40, 16 + (S.level - 1) * 3 + ((S.dist % 350) / 350) * 1.5);
  const target = base * (S.turboT > 0 ? 1.6 : 1);
  S.speed += (target - S.speed) * Math.min(1, dt * 3);
  S.dist += S.speed * dt;

  // Zamanlayıcılar
  if (S.turboT > 0) { S.turboT -= dt; S.hydration = Math.max(0, 100 * S.turboT / 5); if (S.turboT <= 0) { S.turboT = 0; S.hydration = 0; S.invulnT = 0.8; } }
  if (S.magnetT > 0) S.magnetT = Math.max(0, S.magnetT - dt);
  if (S.invulnT > 0) S.invulnT = Math.max(0, S.invulnT - dt);
  if (S.flyT > 0) {
    S.flyT -= dt;
    S.y += (3.2 - S.y) * Math.min(1, dt * 4);
    if (S.flyT <= 0) { S.flyT = 0; S.airborne = true; S.vy = 0; S.airT = S.airDur * 0.5; S.invulnT = 1.2; }
  }

  // Şerit geçişi (yumuşak)
  S.x += (LANES[S.lane] - S.x) * Math.min(1, dt * 14);
  // Zıplama / düşme
  if (S.airborne) {
    S.vy -= G * dt; S.y += S.vy * dt; S.airT += dt;
    if (S.y <= 0) { S.y = 0; S.vy = 0; S.airborne = false; if (S.queuedSlide) { S.queuedSlide = false; S.slideT = 0.7; sfx.slide(); } }
  }
  // Kayma
  if (S.slideT > 0) S.slideT = Math.max(0, S.slideT - dt);
  const slideTarget = S.slideT > 0 ? 1 : 0;
  S.slideK += (slideTarget - S.slideK) * Math.min(1, dt * 16);

  // Sıralar
  S.untilRow -= S.speed * dt;
  if (S.untilRow <= 0) { spawnRow(SPAWN_Z); S.untilRow = Math.max(11.5, 21 - S.level * 1.3) + Math.random() * 4; }

  // Nesneler
  const ph = S.slideK > 0.5 ? 0.7 : 1.75;  // oyuncu yüksekliği
  const list = objs.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (!o.alive) { list.splice(i, 1); continue; }
    o.z += S.speed * dt; o.t += dt;
    if (o.moving) o.x = LANES[o.moving.from] + (LANES[o.moving.to] - LANES[o.moving.from]) * (Math.sin(o.t * o.moving.w) + 1) / 2;
    let bob = 0;
    if (o.type === "drop") {
      o.mesh.rotation.y += dt * 3;
      if (S.magnetT > 0 && o.z > -30 && o.z < 1.5) { // Fe mıknatısı: tüm şeritlerdeki damlaları çek
        const k = Math.min(1, dt * 7); o.x += (S.x - o.x) * k; o.y += (S.y + 0.9 - o.y) * k; o.z += (0 - o.z) * k * 0.6;
      }
      bob = Math.sin(o.t * 4) * 0.08;
    } else if (o.type === "virus") { o.mesh.children[0].rotation.x += dt * 1.6; o.mesh.children[0].rotation.y += dt * 2.1; }
    else if (o.type === "shield" || o.type === "magnet" || o.type === "sun") { o.mesh.rotation.y += dt * 2.4; bob = Math.sin(o.t * 3) * 0.15; }
    o.mesh.position.set(o.x, o.y + bob, o.z);

    if (S.mode === "run") {
      if (o.type === "drop" || o.type === "shield" || o.type === "magnet" || o.type === "sun") {
        if (Math.abs(o.x - S.x) < 0.85 && Math.abs(o.z) < 0.9 && o.y > S.y - 0.4 && o.y < S.y + ph + 0.4) { collect(o); list.splice(i, 1); continue; }
      } else {
        const b = OB[o.type];
        if (Math.abs(o.z) < b.hz + 0.35 && Math.abs(o.x - S.x) < b.hx + 0.32 && S.y < b.y1 && S.y + ph > b.y0) {
          hitObstacle(o);
          if (!o.alive) { list.splice(i, 1); continue; }
          if (S.mode !== "run") break;
        }
      }
    }
    if (o.z > 9) { objs.remove(o); list.splice(i, 1); }
  }
}

/* ---------------- Döngü ---------------- */
let last = performance.now();
const camPos = new THREE.Vector3(0, 3.5, 6.4), camLook = new THREE.Vector3(0, 1.2, -9);
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.mode === "run") update(dt);
  else if (S.mode === "crashing") { S.crashT += dt; S.speed *= Math.pow(0.02, dt); if (S.crashT > 0.75) gameOver(); }
  const flowSpeed = S.mode === "run" || S.mode === "crashing" ? S.speed : S.mode === "ready" ? 6 : 0;
  const bpm = 72 + (S.level - 1) * 14 + (S.turboT > 0 ? 30 : 0);
  world.update(S.mode === "paused" ? 0 : dt, flowSpeed, S.mode === "paused" ? 0.001 : bpm);
  objs.updateParticles(S.mode === "paused" ? 0 : dt, flowSpeed);
  runner.group.position.set(S.x, S.y, 0);
  runner.update(S.mode === "paused" ? 0 : dt, {
    running: S.mode === "run" || S.mode === "ready", speed: flowSpeed, airborne: S.airborne, airT: S.airT, airDur: S.airDur,
    sliding: S.slideK > 0.5, slideK: S.slideK, flying: S.flyT > 0, hydration: S.hydration, shield: S.shield, turbo: S.turboT > 0, crashed: S.mode === "crashing" || S.mode === "over"
  });
  runner.group.visible = !(S.invulnT > 0 && Math.floor(S.t * 14) % 2 === 0);
  world.glow.position.set(S.x, S.y + 2.4, 1.6);
  // Kamera: üçüncü şahıs, şeridi yumuşak izler; turboda görüş açısı genişler; çarpışmada sarsılır
  camPos.set(S.x * 0.55, 3.5 + S.y * 0.4, 6.4); camLook.set(S.x * 0.55, 1.2 + S.y * 0.35, -9);
  camera.position.lerp(camPos, Math.min(1, dt * 8));
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt); const k = S.shake * 0.9; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; }
  camera.lookAt(camLook);
  const fovT = (stage.clientWidth / stage.clientHeight < 0.75 ? 74 : 64) + (S.turboT > 0 ? 8 : 0);
  if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  renderer.render(scene, camera);
  if (S.mode === "run" || S.mode === "crashing") renderHud();
}
renderHud();
requestAnimationFrame(frame);
$("dkLoading").hidden = true;
$("dkPlay").disabled = false;

/* Test ve hata ayıklama için küçük arayüz */
window.DamarKosucusu = {
  state: () => ({ mode: S.mode, lane: S.lane, x: +S.x.toFixed(2), y: +S.y.toFixed(2), airborne: S.airborne, sliding: S.slideK > 0.5, speed: +S.speed.toFixed(1), dist: Math.floor(S.dist), drops: S.drops, score: score(), level: S.level, hydration: S.hydration, turbo: S.turboT, shield: S.shield, magnet: S.magnetT, fly: S.flyT, invuln: S.invulnT, objects: objs.list.length }),
  start,
  makeRowPattern,
  debug: {
    clear: () => objs.clear(),
    spawn: (type, lane, z, y) => { objs.spawn(type, lane, z, y !== undefined ? y : (type === "drop" ? 0.55 : type === "virus" || type === "plaque" || type === "gate" ? 0 : 1.0)); },
    set: (patch) => Object.assign(S, patch),
    holdRows: (v) => { S.untilRow = v ? 1e9 : 10; }
  }
};
