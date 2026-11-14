/* Damar Yolu Koşucusu — ana modül.
   Kurallar: su damlaları yalnızca para birimi; turkuaz enerji kapsülleri sağ üstteki kaykay şarjını doldurur (10 = %100);
   kaykay (çift dokunuş / çift tık / Boşluk / E) önden çarpmada engeli parçalayıp tükenir; başlangıçta Toksin Hücresi
   kısa süre kovalar; yan sürtme = sersemleme yıldızları + Toksin enseden takip, 6 sn içinde ikinci hata = yakalanma;
   kafa kafaya çarpma = anında son. Sabit/rampalı ve karşıdan gelen hareketli Biyo-Kapsül trenleri, çatı koşusu,
   havada aşağı kaydırma = hızlı iniş + şok dalgası, her 150 m'de hızlanma, VitaMağaza ve güçlendirici yükseltmeleri.
   Three.js resmi CDN'den (sabit sürüm) yüklenir; dünya, karakter, nesneler, ses, kayıt ve mağaza ayrı modüllerdedir. */
import { createAudio } from "./damar/ses.js";
import { createWorld, LANES } from "./damar/dunya.js";
import { createRunner } from "./damar/karakter.js";
import { createObjects, makeRowPattern, OB, CAPSULE } from "./damar/nesneler.js";
import { loadProfile, saveProfile, bumpMission, upgDuration } from "./damar/kayit.js";
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

// Dev Toksin Hücresi (kovalayan) + "!" uyarı işareti
const chaser = new THREE.Group();
const warnSprite = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  x.fillStyle = "#facc15"; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
  x.lineWidth = 8; x.strokeStyle = "#7f1d1d"; x.stroke();
  x.fillStyle = "#b91c1c"; x.font = "900 96px system-ui,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("!", 64, 70);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  sp.scale.set(1.1, 1.1, 1); sp.position.set(0, 2.7, 0); sp.renderOrder = 10; return sp;
})();
{
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 2), new THREE.MeshStandardMaterial({ color: 0x365314, emissive: 0x4d7c0f, emissiveIntensity: 0.5, roughness: 0.6, flatShading: true }));
  chaser.add(core);
  const spikeM = new THREE.MeshStandardMaterial({ color: 0x581c87, emissive: 0x7e22ce, emissiveIntensity: 0.7 });
  for (let i = 0; i < 26; i++) { const p = new THREE.Vector3().randomDirection(); const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 6), spikeM); s.position.copy(p).multiplyScalar(1.45); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p); core.add(s); }
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  [-0.45, 0.45].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), eyeM); e.position.set(x, 0.35, -1.25); chaser.add(e); });
  chaser.add(warnSprite);
  chaser.scale.setScalar(0.72); chaser.position.set(0, 0.5, 16); chaser.visible = false; scene.add(chaser);
}
// Hızlı iniş şok dalgası halkası
const shock = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 40), new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
shock.rotation.x = -Math.PI / 2; shock.visible = false; scene.add(shock);
let shockT = 0;

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
const G = 26, JUMP_V = 10.6, SUPER = 1.42, SPAWN_Z = -118, LEVEL_M = 150, CHARGE_MAX = 10, BOARD_T = 15, STUN_T = 6, INTRO_T = 2;
let S;
function fresh() {
  return {
    mode: "ready", t: 0, speed: 0, dist: 0, pts: 0, drops: 0, level: 1,
    lane: 1, x: 0, y: 0, vy: 0, airborne: false, airT: 0, airDur: 2 * JUMP_V / G, noFlip: false, slideT: 0, slideK: 0, queuedSlide: false, slam: false,
    charge: 0, magnetT: 0, jetT: 0, bootsT: 0, x2T: 0, boardT: 0, invulnT: 0, chaseT: 0, introT: 0, stumble: 0, chaserZ: 16,
    untilRow: 30, prevPass: null, occ: [0, 0, 0], rowLog: [],
    nextPowerAt: 140 + Math.random() * 100, nextLetterAt: 90 + Math.random() * 80, nextBoxAt: 450 + Math.random() * 300, nextChargeAt: 20 + Math.random() * 15,
    letterOut: false, crashT: 0, shake: 0, roofDist: 0, crashReason: "", final: null,
    runStats: { jumps: 0, board: 0, power: 0, letters: 0 }
  };
}
S = fresh();
const best = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) { return 0; } };
// Skor = mesafe puanı (2x çarpan aktifken iki kat) × kalıcı görev çarpanı. Damlalar skora değil bankaya gider.
const score = () => S.final != null ? S.final : Math.floor(S.pts * profile.multiplier);
const boardReady = () => S.mode === "run" && S.boardT <= 0 && (S.charge >= CHARGE_MAX || profile.boards > 0);

/* ---------------- HUD ---------------- */
let lastHud = "";
function renderHud(force) {
  const sc = score(), key = [sc, Math.floor(S.dist), S.drops, S.charge, Math.ceil(S.magnetT), Math.ceil(S.jetT), Math.ceil(S.bootsT), Math.ceil(S.x2T), Math.ceil(S.boardT), Math.ceil(S.chaseT), profile.boards, profile.multiplier, profile.word.got, S.mode].join("|");
  if (!force && key === lastHud) return; lastHud = key;
  $("dkScore").textContent = String(sc);
  $("dkDist").textContent = Math.floor(S.dist) + " m";
  $("dkDrops").textContent = String(S.drops);
  $("dkBest").textContent = String(Math.max(best(), sc));
  const chips = [`<span class="dk-chip dk-chip--mult">✖ ${profile.multiplier}</span>`];
  if (S.x2T > 0) chips.push(`<span class="dk-chip dk-chip--x2">2x Skor ${Math.ceil(S.x2T)} sn</span>`);
  if (S.chaseT > 0) chips.push(`<span class="dk-chip dk-chip--chase">💫 Sersem · Toksin peşinde ${Math.ceil(S.chaseT)} sn</span>`);
  if (S.boardT > 0) chips.push(`<span class="dk-chip dk-chip--board">🛹 ${Math.ceil(S.boardT)} sn</span>`);
  if (S.jetT > 0) chips.push(`<span class="dk-chip dk-chip--sun">🚀 D3 Jet ${Math.ceil(S.jetT)} sn</span>`);
  if (S.bootsT > 0) chips.push(`<span class="dk-chip dk-chip--boots">🥾 Mg Bot ${Math.ceil(S.bootsT)} sn</span>`);
  if (S.magnetT > 0) chips.push(`<span class="dk-chip dk-chip--magnet">🧲 Fe ${Math.ceil(S.magnetT)} sn</span>`);
  $("dkChips").innerHTML = chips.join("");
  // Sağ üst: kaykay silüeti şarj barı (aşağıdan yukarı dolar)
  const bb = $("dkBoardBtn"), pct = Math.round(S.charge / CHARGE_MAX * 100);
  bb.style.setProperty("--fill", String(pct / 100));
  bb.querySelector("b").textContent = String(profile.boards);
  bb.querySelector("em").textContent = S.boardT > 0 ? Math.ceil(S.boardT) + " sn" : pct + "%";
  bb.classList.toggle("is-ready", boardReady()); bb.classList.toggle("is-full", S.charge >= CHARGE_MAX); bb.classList.toggle("is-on", S.boardT > 0);
  bb.disabled = !boardReady();
  bb.setAttribute("aria-label", `Nano-Kaykay şarjı %${pct}, stok ${profile.boards}${boardReady() ? " — kullanmak için dokun (veya çift dokun / Boşluk / E)" : ""}`);
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
  S = fresh(); S.mode = "run"; S.introT = INTRO_T; S.chaserZ = 1.6; runner.reset();
  ["dkStart", "dkOver", "dkPause"].forEach(id => { $(id).hidden = true; }); menu.closeStore();
  $("dkPauseBtn").disabled = false; lastHud = ""; renderHud(true);
  for (let z = -46; z > SPAWN_Z; z -= 18) spawnRow(z, true);
  sfx.chaser();
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
const rowZ = (r) => SPAWN_Z + (S.dist - r.at);
/* Karşıdan gelen tren (ön yüzü z0'da, göreli hız vz), oyuncuya ulaşmadan önce yetiştiği sıraların
   o şeridini kapatır. Yalnızca bu sıraların her birinde başka bir geçilebilir şerit varsa
   ve önde aynı şeritte sabit tren yoksa üretilir (adil). */
function canMoveTrain(lane, z0, vz) {
  if (objs.list.some(o => o.alive && o.type === "capsule" && o.lane === lane && o.z - o.len / 2 < 2)) return false;
  const sp = Math.max(10, S.speed);
  return S.rowLog.every(r => {
    const zr = rowZ(r);
    if (zr > 1 || zr <= z0) return true;                       // geçilmiş ya da trenin arkasında
    const tCatch = (zr - z0) / vz, tReach = -zr / sp;           // tren sıraya yetişir / sıra oyuncuya ulaşır
    return tCatch > tReach + 0.4 || r.pass.some(l => l !== lane);
  });
}
function spawnRow(z, warmup) {
  const pat = makeRowPattern(S.level, Math.random, S.prevPass, S.occ.map(v => v > 0));
  S.prevPass = pat.pass;
  S.rowLog = S.rowLog.filter(r => rowZ(r) < 4); S.rowLog.push({ at: S.dist - (z - SPAWN_Z), pass: pat.pass.slice() });
  pat.lanes.forEach((type, l) => {
    if (!type) return;
    if (pat.moving && l === pat.moving.from) objs.spawn("virus", l, z, 0, { moving: { from: pat.moving.from, to: pat.moving.to, w: 1.3 + S.level * 0.12 } });
    else objs.spawn(type, l, z);
  });
  const roofs = [];
  pat.capsules.forEach(c => {
    // Rampasız trenlerin bir kısmı karşıdan hızla gelir (seviye arttıkça daha sık)
    const vzTry = Math.min(20, 8 + S.level * 1.2);
    const moving = !warmup && !c.ramp && S.level >= 2 && Math.random() < Math.min(0.6, 0.2 + S.level * 0.08) && canMoveTrain(c.lane, z, vzTry);
    const vz = moving ? vzTry : 0;
    const o = objs.spawn("capsule", c.lane, z - c.len / 2, 0, { len: c.len, ramp: c.ramp, color: Math.floor(Math.random() * 4), vz });
    S.occ[c.lane] = c.len + 6;
    if (!moving) roofs.push(o);
    // Çatı: yoğun su damlası dizisi (hareketli trende trenle birlikte gelir)
    for (let d = c.len / 2 - 1.5; d > -c.len / 2 + 1; d -= 1.6) objs.spawn("drop", c.lane, o.z + d, CAPSULE.top + 0.6, moving ? { vz, ride: o } : {});
  });
  const lane = (pat.free.length ? pat.free : pat.pass)[Math.floor(Math.random() * (pat.free.length || pat.pass.length))];
  if (S.jetT > 0) for (let i = 0; i < 6; i++) objs.spawn("drop", Math.random() < 0.3 ? 1 : lane, z + 2 + i * 2.4, 5.4);
  else if (!pat.capsules.length && Math.random() < 0.75) for (let i = 0; i < 5; i++) objs.spawn("drop", lane, z + 3 + i * 2, 0.55);
  pat.lanes.forEach((type, l) => { if (type === "plaque" && Math.random() < 0.5 && S.jetT <= 0) for (let i = -2; i <= 2; i++) objs.spawn("drop", l, z + i * 1.15, 0.6 + 1.55 * (1 - (i / 2.6) ** 2)); });
  if (warmup) return;
  const place = (type, extra, roofBias = 0.6) => {
    if (roofs.length && Math.random() < roofBias) { const r = roofs[Math.floor(Math.random() * roofs.length)]; return objs.spawn(type, r.lane, r.z + (Math.random() - 0.5) * r.len * 0.4, CAPSULE.top + 1.1, extra); }
    const pl = pat.lanes.findIndex(t => t === "plaque");
    if (type === "letter" && pl >= 0) return objs.spawn(type, pl, z, 2.25, extra); // zıplama noktası
    return objs.spawn(type, lane, z + 8, 1.1, extra);
  };
  // Turkuaz Enerji Kapsülü (kaykay şarjı)
  if (S.dist >= S.nextChargeAt) { place("charge", {}, 0.35); S.nextChargeAt = S.dist + 28 + Math.random() * 30; }
  // Güçlendirici (Jet, Bot, Mıknatıs, 2x)
  if (S.dist >= S.nextPowerAt) {
    const opts = ["magnet", "jet", "boots", "x2"].filter(k => !(k === "magnet" && S.magnetT > 0) && !(k === "jet" && S.jetT > 0) && !(k === "boots" && S.bootsT > 0) && !(k === "x2" && S.x2T > 0));
    if (opts.length) place(opts[Math.floor(Math.random() * opts.length)]);
    S.nextPowerAt = S.dist + 200 + Math.random() * 180;
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
/* Yan sürtme: ilk hata = sersemleme yıldızları + Toksin enseden takip (6 sn). Yıldızlar sönmeden ikinci hata = yakalanma. */
function graze() {
  S.stumble = 0.45; S.shake = Math.max(S.shake, 0.22); sfx.graze();
  objs.burst(S.x, S.y + 1, 0, 0xfbbf24, 10, 0.6);
  if (S.boardT > 0) { breakBoard(null); return; }
  if (S.chaseT > 0) { crash("chaser"); return; }
  S.chaseT = STUN_T; sfx.chaser(); toast("Sersemledin! Toksin ensende — 6 sn hatasız koş", "level");
}
function move(dir) {
  if (S.mode !== "run") return;
  const nl = Math.max(0, Math.min(2, S.lane + dir));
  if (nl === S.lane) return;
  if (S.jetT <= 0 && S.invulnT <= 0 && laneBlocked(nl)) { graze(); return; }  // trenin / engelin yan yüzüne sürtme
  S.lane = nl; sfx.lane();
}
function jump() {
  if (S.mode !== "run" || S.jetT > 0 || S.airborne) return;
  const sup = S.bootsT > 0 || (S.boardT > 0 && profile.sel.board === "magnezyum");
  const v = JUMP_V * (sup ? SUPER : 1);
  S.airborne = true; S.vy = v; S.airT = 0; S.airDur = 2 * v / G; S.noFlip = false; S.slideT = 0; sfx.jump();
  S.runStats.jumps++; mission("jump", 1);
}
/* Aşağı: yerdeyse kayma; havadaysa (zıplama ya da çatıdan düşüş) hızlı iniş + şok dalgası, ardından kayma */
function slide() {
  if (S.mode !== "run" || S.jetT > 0) return;
  if (S.airborne) { S.vy = Math.min(S.vy, -38); S.slam = true; S.queuedSlide = true; sfx.slide(); return; }
  S.slideT = 0.78; sfx.slide();
}
function useBoard() {
  if (S.mode !== "run" || S.boardT > 0) return false;
  let src;
  if (S.charge >= CHARGE_MAX) { S.charge = 0; src = "charge"; }
  else if (profile.boards > 0) { profile.boards -= 1; saveProfile(profile); src = "stock"; }
  else { toast(`Kaykay şarjı %${Math.round(S.charge / CHARGE_MAX * 100)} — turkuaz enerji kapsülü topla`, "level"); return false; }
  S.boardT = BOARD_T;
  sfx.board(); toast(`Plazma Kaykay aktif! ${BOARD_T} sn${profile.sel.board === "magnezyum" ? " · süper zıplama" : ""}`, "turbo");
  objs.burst(S.x, S.y + 0.2, 0, 0x5eead4, 24, 0.8);
  S.runStats.board++; mission("board", 1); renderHud(true);
  return src;
}
function removeCapsule(o) { objs.list.forEach(q => { if (q.ride === o) objs.remove(q); }); objs.remove(o); }
/* Kaykay: engeli büyük parçacık/duman patlamasıyla parçalar ve tükenir; koşu sürer */
function breakBoard(target) {
  const zx = target ? target.x : S.x;
  S.boardT = 0; S.invulnT = 1.0; sfx.boardBreak(); sfx.smash(); S.shake = 0.4;
  objs.burst(zx, 1.0, -0.6, 0x94a3b8, 70, 1.5);   // duman
  objs.burst(zx, 1.2, -0.6, 0xe2e8f0, 40, 1.1);
  objs.burst(S.x, S.y + 0.3, 0, profile.sel.board === "magnezyum" ? 0xc084fc : 0x5eead4, 50, 1.6);
  if (target) target.type === "capsule" ? removeCapsule(target) : objs.remove(target);
  toast("Kaykay parçalandı — koşu devam ediyor!", "turbo");
}
function shockwave(x, y) {
  shockT = 0.45; shock.visible = true; shock.position.set(x, y + 0.05, 0); shock.scale.setScalar(0.3);
  objs.burst(x, y + 0.1, 0, 0x5eead4, 26, 0.9); sfx.smash(); S.shake = Math.max(S.shake, 0.18);
}

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
  else if (k === "ArrowUp" || k === "w" || k === "W") jump();
  else if (k === "ArrowDown" || k === "s" || k === "S") slide();
  else if (k === " " || k === "e" || k === "E") useBoard();
});
/* Dokunma: 20 px'te anında kaydırma; kaydırmasız iki dokunuş (≤ 320 ms) = kaykay */
let sw = null, lastTap = 0, lastTouchAt = 0, lastClick = 0;
stage.addEventListener("touchstart", (e) => { lastTouchAt = performance.now(); if (e.touches.length !== 1) return; const t = e.touches[0]; sw = { x: t.clientX, y: t.clientY, done: false }; sfx.unlock(); }, { passive: true });
stage.addEventListener("touchmove", (e) => {
  if (!sw || sw.done) return;
  const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  sw.done = true; lastTap = 0;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else slide();
}, { passive: true });
stage.addEventListener("touchend", (e) => {
  if (sw && !sw.done && !(e.target.closest && e.target.closest("button,a,.dk-overlay,.dk-store,.dk-boxopen"))) {
    const now = performance.now();
    if (now - lastTap < 320) { useBoard(); lastTap = 0; } else lastTap = now;
  }
  sw = null;
}, { passive: true });
stage.addEventListener("touchcancel", () => { sw = null; }, { passive: true });
/* Fare: çift tık (iki tık ≤ 320 ms). Dokunmadan doğan sentetik tıklamalar yok sayılır. */
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
    // Su damlası: yalnızca para birimi (anlık güç vermez)
    S.drops += 1; sfx.drop(); mission("drops", 1);
    objs.burst(o.x, o.y, o.z, 0x22d3ee, 6, 0.5);
  } else if (o.type === "charge") {
    sfx.power();
    if (S.charge < CHARGE_MAX) {
      S.charge += 1;
      if (S.charge >= CHARGE_MAX) toast(S.boardT > 0 ? "Kaykay şarjı dolu!" : "Kaykay şarjı %100! Çift dokun / Boşluk", "turbo");
    } else S.pts += 50;
    objs.burst(o.x, o.y, o.z, 0x2dd4bf, 14, 0.7);
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
    const d = upgDuration(profile, o.type);
    if (o.type === "magnet") { S.magnetT = d; sfx.magnet(); toast(`Fe Mıknatısı: ${d} sn`, "magnet"); }
    else if (o.type === "jet") { S.jetT = d; S.airborne = false; S.vy = 0; S.slideT = 0; S.slam = false; sfx.sun(); toast(`D3 Jet-Pack: ${d} sn uçuş!`, "sun"); }
    else if (o.type === "boots") { S.bootsT = d; toast(`Mg Zıplama Botları: ${d} sn 2× zıplama`, "magnet"); }
    else if (o.type === "x2") { S.x2T = d; toast(`2x Skor Çarpanı: ${d} sn`, "turbo"); }
    objs.burst(o.x, o.y + 0.2, o.z, o.type === "magnet" ? 0xef4444 : o.type === "jet" ? 0xfacc15 : 0xa855f7, 22, 0.9);
  }
  objs.remove(o);
}
function celebrate() { const c = $("dkCelebrate"); c.hidden = false; c.classList.remove("is-on"); void c.offsetWidth; c.classList.add("is-on"); setTimeout(() => { c.hidden = true; }, 2200); for (let i = 0; i < 4; i++) objs.burst(S.x + (Math.random() - 0.5) * 4, 2 + Math.random() * 2, -4 - Math.random() * 6, [0xfacc15, 0x2dd4bf, 0xf472b6, 0xa855f7][i], 40, 1.4); }
/* Kafa kafaya çarpma: kaykay varsa engeli parçalar, yoksa anında oyun sonu (sersemleme yok) */
function hitObstacle(o) {
  if (S.jetT > 0 || S.invulnT > 0) return false;
  if (S.boardT > 0) { breakBoard(o); return false; }
  crash("front"); return true;
}

/* ---------------- Güncelleme ---------------- */
function update(dt) {
  S.t += dt;
  const lvl = 1 + Math.floor(S.dist / LEVEL_M);                   // her 150 m'de belirgin hızlanma
  if (lvl > S.level) { S.level = lvl; sfx.level(); toast(`Nabız Hızlanıyor: Seviye ${lvl}`, "level"); }
  const base = Math.min(48, 16.5 + (S.level - 1) * 2.8 + ((S.dist % LEVEL_M) / LEVEL_M) * 1.2);
  const target = base * (S.stumble > 0 ? 0.8 : 1);
  S.speed += (target - S.speed) * Math.min(1, dt * 3);
  S.dist += S.speed * dt;
  S.pts += S.speed * dt * (S.x2T > 0 ? 2 : 1);
  for (let l = 0; l < 3; l++) S.occ[l] = Math.max(0, S.occ[l] - S.speed * dt);

  // Zamanlayıcılar
  S.magnetT = Math.max(0, S.magnetT - dt); S.bootsT = Math.max(0, S.bootsT - dt); S.x2T = Math.max(0, S.x2T - dt);
  S.invulnT = Math.max(0, S.invulnT - dt); S.stumble = Math.max(0, S.stumble - dt); S.introT = Math.max(0, S.introT - dt);
  if (S.boardT > 0) { S.boardT -= dt; if (S.boardT <= 0) { S.boardT = 0; toast("Kaykay süresi doldu", "level"); } }
  if (S.chaseT > 0) { S.chaseT -= dt; if (S.chaseT <= 0) { S.chaseT = 0; toast("Yıldızlar söndü — Toksin geri çekildi", "level"); } }

  // Şerit geçişi
  S.x += (LANES[S.lane] - S.x) * Math.min(1, dt * 14);
  // Dikey: jet / zemin (tren çatısı, rampa) / zıplama
  const ground = objs.groundAt(LANES[S.lane]);
  if (S.jetT > 0) {
    S.jetT -= dt; S.y += (5.4 - S.y) * Math.min(1, dt * 3); S.airborne = false;
    if (S.jetT <= 0) { S.jetT = 0; S.airborne = true; S.vy = 0; S.noFlip = true; S.airT = 0; S.invulnT = 1.2; }
  } else if (S.airborne) {
    S.vy -= G * dt; S.y += S.vy * dt; S.airT += dt;
    if (S.y <= ground.h && S.vy <= 0) {
      S.y = ground.h; S.vy = 0; S.airborne = false;
      if (S.slam) { S.slam = false; shockwave(S.x, S.y); }
      if (S.queuedSlide) { S.queuedSlide = false; S.slideT = 0.7; }
    }
  } else {
    if (ground.h > S.y + 0.02) { if (ground.onRamp || ground.h - S.y < 0.7 || S.invulnT > 0) S.y = ground.h; }  // rampadan yürüyerek çıkış
    else if (ground.h < S.y - 0.05) { S.airborne = true; S.vy = 0; S.airT = 0; S.noFlip = true; }                // çatıdan boşluğa
    else S.y = ground.h;
  }
  if (!S.airborne && S.jetT <= 0 && S.y > CAPSULE.top - 0.2) S.roofDist += S.speed * dt;
  if (S.slideT > 0) S.slideT = Math.max(0, S.slideT - dt);
  S.slideK += ((S.slideT > 0 ? 1 : 0) - S.slideK) * Math.min(1, dt * 16);
  // Kaykay neon izi parçacıkları
  if (S.boardT > 0 && Math.random() < 0.7) objs.burst(S.x + (Math.random() - 0.5) * 0.4, S.y + 0.08, 0.5, profile.sel.board === "magnezyum" ? 0xc084fc : 0x2dd4bf, 1, 0.15);

  // Sıralar
  S.untilRow -= S.speed * dt;
  if (S.untilRow <= 0) { spawnRow(SPAWN_Z); S.untilRow = Math.max(9.5, 21 - S.level * 1.3) + Math.random() * 4; }

  // Nesneler
  const ph = S.slideK > 0.5 ? 0.7 : 1.75, list = objs.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (!o.alive) { list.splice(i, 1); continue; }
    const dz = (S.speed + (o.vz || 0)) * dt;
    o.z += dz; o.t += dt;
    if (o.moving) o.x = LANES[o.moving.from] + (LANES[o.moving.to] - LANES[o.moving.from]) * (Math.sin(o.t * o.moving.w) + 1) / 2;
    let bob = 0;
    if (o.type === "drop") {
      o.mesh.rotation.y += dt * 3;
      if (S.magnetT > 0 && o.z > -30 && o.z < 1.5) { const k = Math.min(1, dt * 7); o.x += (S.x - o.x) * k; o.y += (S.y + 0.9 - o.y) * k; o.z += (0 - o.z) * k * 0.6; o.ride = null; o.vz = 0; } // zemin + çatı
      bob = Math.sin(o.t * 4) * 0.08;
    } else if (o.type === "virus") { o.mesh.children[0].rotation.x += dt * 1.6; o.mesh.children[0].rotation.y += dt * 2.1; }
    else if (o.type !== "capsule" && !OB[o.type]) { o.mesh.rotation.y += dt * 2.6; bob = Math.sin(o.t * 3) * 0.15; }
    o.mesh.position.set(o.x, o.y + bob, o.z);

    if (S.mode === "run") {
      if (o.type === "capsule") {
        const front = o.z + o.len / 2, prevFront = front - dz;
        // Ön yüze kafa kafaya: bu karede ön yüz oyuncunun hizasından geçti ve oyuncu çatı seviyesinin altında
        if (Math.abs(o.x - S.x) < 1.0 && prevFront <= 0.55 && front >= -0.25 && S.y < CAPSULE.top - 0.45) {
          if (hitObstacle(o)) break;
          if (!o.alive) { list.splice(i, 1); continue; }
        }
      } else if (OB[o.type]) {
        const b = OB[o.type], r = b.hz + 0.35;
        if (o.z >= -r && o.z - dz <= r && Math.abs(o.x - S.x) < b.hx + 0.32 && S.y < b.y1 && S.y + ph > b.y0) {
          if (hitObstacle(o)) break;
          if (!o.alive) { list.splice(i, 1); continue; }
        }
      } else if (Math.abs(o.x - S.x) < 0.85 && o.z > -0.9 && o.z - dz < 0.9 && o.y > S.y - 0.4 && o.y < S.y + ph + 0.4) { collect(o); list.splice(i, 1); continue; }
    }
    const tail = o.type === "capsule" ? o.z - o.len / 2 : o.z;
    if (tail > 9) { if (o.type === "letter") S.letterOut = false; objs.remove(o); list.splice(i, 1); }
  }
  // Karşıdan gelen tren, şeridindeki eşyaları önüne katar (iç içe geçme olmaz)
  for (const tr of list) {
    if (tr.type !== "capsule" || !tr.vz || !tr.alive) continue;
    const front = tr.z + tr.len / 2 + 0.6, back = tr.z - tr.len / 2;
    for (const q of list) {
      if (q === tr || !q.alive || q.ride === tr || q.type === "capsule" || Math.abs(q.x - tr.x) > 1.1 || q.z > front || q.z < back) continue;
      if (q.type === "letter") S.letterOut = false;
      objs.remove(q);
    }
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
  const bpm = 72 + (S.level - 1) * 10 + (S.chaseT > 0 ? 30 : 0);
  world.update(paused ? 0 : dt, flow, paused ? 0.001 : bpm);
  objs.updateParticles(paused ? 0 : dt, flow);
  runner.group.position.set(S.x, S.y, 0);
  runner.update(paused ? 0 : dt, {
    running: S.mode === "run" || S.mode === "ready", speed: flow, airborne: S.airborne && !S.noFlip && !S.slam, airT: S.airT, airDur: S.airDur,
    slideK: S.slideK, flying: S.jetT > 0, hydration: S.charge / CHARGE_MAX * 100, shield: false, turbo: false, crashed: S.mode === "crashing" || S.mode === "over",
    board: S.boardT > 0, boots: S.bootsT > 0, stumble: S.stumble, stunned: S.mode === "run" || S.mode === "paused" ? S.chaseT : 0
  });
  runner.group.visible = !(S.invulnT > 0 && Math.floor(S.t * 14) % 2 === 0);
  // Kovalayan Toksin: başlangıçta 2 sn ve sersemlemede enseden takip; sonra ekranın altına doğru geride kalır
  const chasing = S.chaseT > 0 || S.introT > 0;
  if (S.mode !== "crashing" && !paused) S.chaserZ += ((chasing ? 2.0 : 16) - S.chaserZ) * Math.min(1, dt * 3);
  const lurk = S.mode === "crashing" ? 0 : 1.3 * Math.tanh(3 * Math.sin(performance.now() / 1100));  // ekran kenarları arasında süzülür, oyuncuyu kapatmaz
  chaser.visible = S.chaserZ < 13; chaser.position.set(S.x * 0.55 + lurk, 0.5 + Math.sin(performance.now() / 180) * 0.1, S.chaserZ);
  warnSprite.visible = chasing && S.mode === "run";
  if (warnSprite.visible) warnSprite.scale.setScalar(1.1 + Math.sin(performance.now() / 90) * 0.12);
  if (chaser.visible && !paused) { chaser.children[0].rotation.y += dt * 1.5; chaser.children[0].rotation.x += dt * 0.7; }
  // Şok dalgası
  if (shockT > 0 && !paused) { shockT -= dt; const k = 1 - shockT / 0.45; shock.scale.setScalar(0.3 + k * 3.2); shock.material.opacity = 0.85 * (1 - k); if (shockT <= 0) shock.visible = false; }
  world.glow.position.set(S.x, S.y + 2.4, 1.6);
  camPos.set(S.x * 0.55, 3.5 + S.y * 0.55, 6.4); camLook.set(S.x * 0.55, 1.2 + S.y * 0.5, -9);
  camera.position.lerp(camPos, Math.min(1, dt * 8));
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt); const k = S.shake * 0.9; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; }
  camera.lookAt(camLook);
  const fovT = (stage.clientWidth / stage.clientHeight < 0.75 ? 74 : 64) + Math.min(8, (S.level - 1) * 1.2) * (S.mode === "run" ? 1 : 0);
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
  state: () => ({ mode: S.mode, lane: S.lane, x: +S.x.toFixed(2), y: +S.y.toFixed(2), airborne: S.airborne, sliding: S.slideK > 0.5, slam: S.slam, speed: +S.speed.toFixed(1), dist: Math.floor(S.dist), drops: S.drops, score: score(), level: S.level, charge: S.charge, magnet: S.magnetT, jet: S.jetT, boots: S.bootsT, x2: S.x2T, board: S.boardT, chase: S.chaseT, intro: S.introT, chaserZ: +S.chaserZ.toFixed(2), stumble: S.stumble, invuln: S.invulnT, roof: Math.floor(S.roofDist), crashReason: S.crashReason, objects: objs.list.length, capsules: objs.list.filter(o => o.type === "capsule").length, movingTrains: objs.list.filter(o => o.type === "capsule" && o.vz).length, shock: shockT > 0 }),
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
