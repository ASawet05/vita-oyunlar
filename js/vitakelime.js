/* VitaKelime — kelime çarkı + kesişen bulmaca. Saf HTML/CSS/JS (ES modülleri), dış kütüphane yok.
   Sözlük: data/turkce-sozluk.json · Bulmaca üretimi: js/kelime/motor.js (her bölüm prosedürel, kökler tekrar etmez).
   Girdi: dokunma/fare ile çarkta harfleri sürükle (geri giderek harf bırak); klavye: harfleri yaz, Enter gönder,
   Backspace sil, Boşluk karıştır, H ipucu. Tüm ilerleme localStorage'da (yalnızca bu cihazda). */
import { createEngine, trUpper, letters, difficulty } from "./kelime/motor.js";
import { createAudio } from "./kelime/ses.js";

const $ = (id) => document.getElementById(id);
const KEY = "vo_kelime_v1", MUTE_KEY = "vo_kelime_muted", PIGGY_CAP = 5, START_HINTS = 3;
const sfx = createAudio(MUTE_KEY);

/* ---------------- Kayıt ---------------- */
function load() {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
  const d = { level: 1, hints: START_HINTS, piggy: 0, played: [], recent: [], cur: null, stats: { words: 0, extras: 0, levels: 0 } };
  s = Object.assign(d, s && typeof s === "object" ? s : {});
  s.stats = Object.assign({ words: 0, extras: 0, levels: 0 }, s.stats || {});
  if (!Array.isArray(s.played)) s.played = []; if (!Array.isArray(s.recent)) s.recent = [];
  return s;
}
let P = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(P)); localStorage.setItem("vo_best_kelime", "Bölüm " + P.level); } catch (_) {}
}

/* ---------------- Motor ---------------- */
let E = null;
async function init() {
  try {
    const res = await fetch("data/turkce-sozluk.json", { cache: "force-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    E = createEngine(await res.json());
  } catch (e) {
    $("vkLoading").hidden = true; $("vkError").hidden = false; return;
  }
  $("vkLoading").hidden = true;
  if (!P.cur || P.cur.level !== P.level || !P.cur.data) newLevel(); else restore();
}
function newLevel() {
  const seed = (Date.now() ^ (P.level * 2654435761)) >>> 0;
  const recent = new Set(P.recent.slice(-150));
  // 1) Kademe şartlarını tam sağlayan, hiç oynanmamış kök  2) yoksa en eski oynanmış kökler yeniden kullanılabilir (son 150 hariç)
  //    — ileri seviyede bulmacalar kolaylaşmaz  3) son çare: şartlar gevşetilir
  let data = E.generate(P.level, { played: new Set(P.played), recent, seed, strict: true })
    || E.generate(P.level, { played: new Set(P.played.slice(-150)), recent, seed, strict: true })
    || E.generate(P.level, { played: new Set(P.played.slice(-60)), recent, seed });
  if (P.played.length > 1500) P.played = P.played.slice(-600);
  P.cur = { level: P.level, seed, data, open: [], hintOpen: [], found: [], extras: [], order: data.letters.map((_, i) => i), done: false };
  P.played.push(data.root); P.recent.push(...data.words.map(w => w.w)); if (P.recent.length > 400) P.recent = P.recent.slice(-300);
  // Kademe yükseldiyse "Seviye Atladın!" rozeti
  const T = difficulty(P.level), seen = P.tierSeen || 1;
  const up = T.tier > seen; P.tierSeen = Math.max(seen, T.tier);
  save(); build(true);
  if (up) tierBadge(T); else $("vkTierUp").hidden = true;
}
let tierUps = 0;
function tierBadge(T) {
  const lens = T.lens.length > 1 ? Math.min(...T.lens) + "-" + Math.max(...T.lens) : T.lens[0];
  $("vkTierName").textContent = T.name;
  $("vkTierText").textContent = `Artık ${lens} Harfli Bulmacalar`;
  $("vkTierSub").textContent = `Izgarada ${T.min}-${T.max} kelime${T.sparse ? " · daha az ortak harf" : ""}`;
  const b = $("vkTierUp"); b.hidden = false; b.classList.remove("is-on"); void b.offsetWidth; b.classList.add("is-on");
  sfx.piggy(); tierUps++;
  clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, 2800);
}
function restore() { build(false); }

/* ---------------- Izgara ---------------- */
const cellKey = (x, y) => x + "," + y;
function wordCells(p) { return letters(p.w).map((ch, k) => ({ x: p.x + (p.dir === "H" ? k : 0), y: p.y + (p.dir === "V" ? k : 0), ch })); }
let cellEls = new Map();
function build(fresh) {
  const C = P.cur, D = C.data, grid = $("vkGrid");
  $("vkLevel").textContent = String(C.level);
  { const T = difficulty(C.level), n = letters(D.root).length; $("vkTier").textContent = `${T.name} · ${n} harf`; $("vkTier").dataset.tier = T.tier; }
  $("vkHealth").hidden = !D.health;
  grid.style.setProperty("--cols", D.w); grid.style.setProperty("--rows", D.h);
  grid.innerHTML = ""; cellEls = new Map();
  const map = new Map();
  D.words.forEach(p => wordCells(p).forEach(c => map.set(cellKey(c.x, c.y), c.ch)));
  for (let y = 0; y < D.h; y++) for (let x = 0; x < D.w; x++) {
    const k = cellKey(x, y), ch = map.get(k), el = document.createElement("div");
    if (ch) {
      el.className = "vk-cell"; el.dataset.k = k; el.innerHTML = `<span>${ch}</span>`;
      if (C.open.includes(k)) el.classList.add("is-open");
      if (C.hintOpen.includes(k)) el.classList.add("is-hint");
      cellEls.set(k, el);
    } else el.className = "vk-void";
    grid.appendChild(el);
  }
  grid.setAttribute("aria-label", `Bulmaca: ${D.words.length} kelime, ${C.found.length} bulundu`);
  buildWheel(); renderHud(); fit(); requestAnimationFrame(() => requestAnimationFrame(fit));   // başlık/HUD yerleştikten sonra yeniden ölç
  $("vkDone").hidden = !C.done;
  if (fresh) toast(D.health ? `🩺 Sağlık Bölümü ${C.level}` : `Bölüm ${C.level}`, "level");
}
function fit() {
  const C = P.cur; if (!C) return;
  const board = $("vkBoard"), grid = $("vkGrid"), D = C.data;
  // Duyarlı hücre boyutu: hücre + aralık birlikte küçülür; çok sıkışırsa ızgara bütün olarak ölçeklenir (taşma yok)
  const w = board.clientWidth - 8, h = board.clientHeight - 8;
  let cs = Math.min(56, w / (D.w * 1.08), h / (D.h * 1.08));
  let gap = Math.max(2, Math.round(cs * 0.08));
  cs = Math.floor(Math.min(56, (w - gap * (D.w - 1)) / D.w, (h - gap * (D.h - 1)) / D.h));
  let scale = 1;
  if (cs < 16) { scale = cs / 16; cs = 16; gap = 2; }
  grid.style.setProperty("--cs", cs + "px"); grid.style.setProperty("--gap", gap + "px");
  grid.style.transform = scale < 1 ? `scale(${scale.toFixed(3)})` : "";
  layoutWheel();
}
{ const ro = new ResizeObserver(() => fit()); ro.observe(document.body); ro.observe($("vkBoard")); }

/* ---------------- Harf çarkı ---------------- */
const wheel = $("vkWheel"), svg = $("vkLines");
let btns = [], path = [], pointerXY = null, dragging = false;
function buildWheel() {
  wheel.querySelectorAll(".vk-letter").forEach(b => b.remove());
  const C = P.cur;
  btns = C.order.map((li) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "vk-letter"; b.textContent = C.data.letters[li]; b.dataset.li = li; b.tabIndex = -1;
    b.setAttribute("aria-label", "Harf " + C.data.letters[li]);
    wheel.appendChild(b); return b;
  });
  layoutWheel(); drawPath();
}
let geom = { cx: 0, cy: 0, R: 0, r: 0 };
function layoutWheel() {
  const s = wheel.clientWidth; if (!s || !btns.length) return;
  const n = btns.length, r = Math.max(22, Math.min(s * (n > 6 ? 0.12 : 0.135), 42)), R = s / 2 - r - 6;
  geom = { cx: s / 2, cy: s / 2, R, r };
  btns.forEach((b, i) => {
    const a = -Math.PI / 2 + i / n * Math.PI * 2, x = s / 2 + Math.cos(a) * R, y = s / 2 + Math.sin(a) * R;
    b.style.width = b.style.height = r * 2 + "px"; b.style.left = x - r + "px"; b.style.top = y - r + "px"; b.style.fontSize = Math.round(r * 0.95) + "px";
    b._x = x; b._y = y;
  });
  svg.setAttribute("viewBox", `0 0 ${s} ${s}`);
  drawPath();
}
function local(ev) { const b = wheel.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; }
function hitBtn(p, k = 1) { return btns.findIndex(b => Math.hypot(b._x - p.x, b._y - p.y) <= geom.r * k); }
function currentWord() { return path.map(i => btns[i].textContent).join(""); }
function drawPath() {
  const pts = path.map(i => `${btns[i]._x},${btns[i]._y}`);
  if (dragging && pointerXY && path.length) pts.push(`${pointerXY.x},${pointerXY.y}`);
  svg.innerHTML = pts.length > 1 ? `<polyline points="${pts.join(" ")}" class="vk-line-glow"/><polyline points="${pts.join(" ")}" class="vk-line"/>` : "";
  btns.forEach((b, i) => b.classList.toggle("is-on", path.includes(i)));
  const w = currentWord(), pv = $("vkPreview");
  pv.textContent = w; pv.classList.toggle("is-empty", !w); pv.classList.remove("is-good", "is-bad", "is-extra", "is-dup");
}
function addLetter(i) { if (path.includes(i)) return; path.push(i); sfx.tap(path.length - 1); if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {} drawPath(); }
wheel.addEventListener("pointerdown", (ev) => {
  if (!P.cur || P.cur.done || ev.target.closest("#vkShuffle")) return;
  sfx.unlock();
  const p = local(ev), i = hitBtn(p, 1.15); if (i < 0) return;
  ev.preventDefault(); dragging = true; path = []; pointerXY = p; wheel.setPointerCapture(ev.pointerId);
  addLetter(i);
});
wheel.addEventListener("pointermove", (ev) => {
  if (!dragging) return;
  const p = local(ev); pointerXY = p;
  const i = hitBtn(p, 0.82);
  if (i >= 0) {
    if (path.length > 1 && path[path.length - 2] === i) { path.pop(); sfx.tap(path.length - 1); }   // geri giderek bırak
    else addLetter(i);
  }
  drawPath();
});
function endDrag() { if (!dragging) return; dragging = false; pointerXY = null; const w = currentWord(); path = []; drawPath(); if (letters(w).length) submit(w); }
wheel.addEventListener("pointerup", endDrag);
wheel.addEventListener("pointercancel", endDrag);
wheel.addEventListener("lostpointercapture", endDrag);      // yakalama kaybolursa sürükleme takılı kalmasın
window.addEventListener("pointerup", endDrag);

/* ---------------- Kelime değerlendirme ---------------- */
function flashPreview(w, cls) { const pv = $("vkPreview"); pv.textContent = w; pv.classList.remove("is-empty", "is-good", "is-bad", "is-extra", "is-dup"); void pv.offsetWidth; pv.classList.add(cls); clearTimeout(pv._t); pv._t = setTimeout(() => { if (!dragging) { pv.classList.add("is-empty"); pv.textContent = ""; } }, 900); }
function submit(raw) {
  const C = P.cur; if (!C || C.done) return "none";
  const w = trUpper(raw);
  if (letters(w).length < 3) { flashPreview(w, "is-bad"); return "short"; }
  const pl = C.data.words.find(p => p.w === w);
  if (pl) {
    if (C.found.includes(w)) { flashPreview(w, "is-dup"); sfx.already(); pulseWord(pl, "is-dup"); return "dup"; }
    revealWord(pl, true); flashPreview(w, "is-good"); sfx.good(); P.stats.words++;
    checkDone(); save(); return "grid";
  }
  if (C.data.extras.includes(w)) {
    if (C.extras.includes(w)) { flashPreview(w, "is-dup"); sfx.already(); toast("Bu ekstra kelimeyi zaten buldun", "dup"); return "dup"; }
    C.extras.push(w); P.piggy++; P.stats.extras++; flashPreview(w, "is-extra"); sfx.extra();
    flyToPiggy();
    if (P.piggy >= PIGGY_CAP) { P.piggy -= PIGGY_CAP; P.hints++; sfx.piggy(); toast("🐷 Kumbara doldu! +1 İpucu", "gold"); $("vkPiggy").classList.add("is-pop"); setTimeout(() => $("vkPiggy").classList.remove("is-pop"), 600); }
    else toast(`Ekstra kelime: ${w}`, "extra");
    save(); renderHud(); return "extra";
  }
  flashPreview(w, "is-bad"); sfx.bad(); $("vkPreview").classList.add("is-shake"); setTimeout(() => $("vkPreview").classList.remove("is-shake"), 400);
  return "bad";
}
function revealWord(pl, anim) {
  const C = P.cur;
  wordCells(pl).forEach((c, i) => {
    const k = cellKey(c.x, c.y);
    if (!C.open.includes(k)) C.open.push(k);
    const el = cellEls.get(k);
    if (el) { el.classList.add("is-open"); if (anim) { el.style.animationDelay = i * 60 + "ms"; el.classList.remove("is-pop"); void el.offsetWidth; el.classList.add("is-pop"); } }
  });
  if (!C.found.includes(pl.w)) C.found.push(pl.w);
  renderHud();
}
function pulseWord(pl, cls) { wordCells(pl).forEach(c => { const el = cellEls.get(cellKey(c.x, c.y)); if (el) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 600); } }); }
/* Bir kelimenin tüm hücreleri açıldıysa (ipucuyla da) bulunmuş sayılır */
function syncFound() { const C = P.cur; C.data.words.forEach(p => { if (!C.found.includes(p.w) && wordCells(p).every(c => C.open.includes(cellKey(c.x, c.y)))) { C.found.push(p.w); pulseWord(p, "is-pop"); } }); }
function checkDone() {
  const C = P.cur; syncFound();
  if (C.found.length < C.data.words.length || C.done) return;
  C.done = true; P.stats.levels++;
  const bonus = C.level % 3 === 0 ? 1 : 0; P.hints += bonus;
  sfx.win(); save();
  setTimeout(() => {
    $("vkDoneTitle").textContent = C.data.health ? "Sağlık Bölümü Tamam!" : "Harika!";
    $("vkDoneLevel").textContent = String(C.level);
    $("vkDoneWords").textContent = String(C.data.words.length);
    $("vkDoneExtras").textContent = `${C.extras.length}/${C.data.extras.length}`;
    $("vkDoneRoot").textContent = C.data.root;
    $("vkDoneBonus").hidden = !bonus;
    $("vkDone").hidden = false; $("vkNext").focus();
    confetti();
  }, 650);
}
function next() { if (!P.cur || !P.cur.done) return; P.level++; $("vkDone").hidden = true; newLevel(); }

/* ---------------- İpucu, karıştır, kumbara ---------------- */
function useHint() {
  const C = P.cur; if (!C || C.done) return false;
  if (P.hints <= 0) { sfx.bad(); toast("İpucu kalmadı — ekstra kelime bulup kumbarayı doldur", "dup"); $("vkHint").classList.add("is-shake"); setTimeout(() => $("vkHint").classList.remove("is-shake"), 400); return false; }
  // Bulunmamış kelimelerdeki kapalı hücrelerden biri (önce kısa kelimelerin ilk harfleri)
  const targets = C.data.words.filter(p => !C.found.includes(p.w)).sort((a, b) => letters(a.w).length - letters(b.w).length);
  let pick = null;
  for (const p of targets) { const cells = wordCells(p).filter(c => !C.open.includes(cellKey(c.x, c.y))); if (cells.length) { pick = cells[0]; break; } }
  if (!pick) return false;
  const k = cellKey(pick.x, pick.y);
  P.hints--; C.open.push(k); C.hintOpen.push(k);
  const el = cellEls.get(k); if (el) { el.classList.add("is-open", "is-hint", "is-pop"); }
  sfx.hint(); checkDone(); save(); renderHud(); return true;
}
function shuffleWheel() {
  const C = P.cur; if (!C) return;
  if (dragging) { dragging = false; path = []; pointerXY = null; }
  const o = C.order.slice(); let k = 0;
  do { for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } } while (o.join() === C.order.join() && k++ < 5);
  C.order = o; save(); sfx.shuffle();
  wheel.classList.remove("is-spin"); void wheel.offsetWidth; wheel.classList.add("is-spin");
  buildWheel();
}
function flyToPiggy() {
  const pv = $("vkPreview").getBoundingClientRect(), pg = $("vkPiggy").getBoundingClientRect(), d = document.createElement("div");
  d.className = "vk-fly"; d.textContent = "✦"; d.style.left = pv.left + pv.width / 2 + "px"; d.style.top = pv.top + "px"; document.body.appendChild(d);
  requestAnimationFrame(() => { d.style.transform = `translate(${pg.left + pg.width / 2 - (pv.left + pv.width / 2)}px, ${pg.top + pg.height / 2 - pv.top}px) scale(.4)`; d.style.opacity = "0.2"; });
  setTimeout(() => d.remove(), 650);
}
function showExtras() {
  const C = P.cur; if (!C) return;
  $("vkExtrasList").innerHTML = C.extras.length ? C.extras.map(w => `<span class="vk-xw">${w}</span>`).join("") : `<p class="vk-muted">Henüz ekstra kelime yok. Izgarada olmayan geçerli kelimeleri bul!</p>`;
  $("vkExtrasInfo").textContent = `Bu bölümde ${C.extras.length}/${C.data.extras.length} ekstra kelime · Kumbara ${P.piggy}/${PIGGY_CAP}`;
  $("vkExtras").hidden = false; $("vkExtrasClose").focus();
}

/* ---------------- HUD ---------------- */
function renderHud() {
  const C = P.cur;
  $("vkHintN").textContent = String(P.hints);
  $("vkHint").classList.toggle("is-empty", P.hints <= 0);
  $("vkPiggyFill").style.height = (P.piggy / PIGGY_CAP * 100) + "%";
  $("vkPiggyN").textContent = `${P.piggy}/${PIGGY_CAP}`;
  if (C) $("vkProgress").textContent = `${C.found.length}/${C.data.words.length}`;
}
function toast(text, tone) {
  const box = $("vkToasts"), d = document.createElement("div");
  d.className = "vk-toast" + (tone ? " vk-toast--" + tone : ""); d.textContent = text;
  box.appendChild(d); while (box.children.length > 2) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 1800);
}
function confetti() {
  const box = $("vkConfetti"); box.innerHTML = "";
  const cols = ["#5eead4", "#fde047", "#f472b6", "#a78bfa", "#38bdf8"];
  for (let i = 0; i < 40; i++) { const s = document.createElement("i"); s.style.left = Math.random() * 100 + "%"; s.style.background = cols[i % cols.length]; s.style.animationDelay = Math.random() * 0.4 + "s"; s.style.transform = `rotate(${Math.random() * 360}deg)`; box.appendChild(s); }
  setTimeout(() => { box.innerHTML = ""; }, 2600);
}

/* ---------------- Düğmeler ve klavye ---------------- */
/* Dokunmatikte anında tepki: pointerup ile tetikle (kaydırmadan hemen sonra tarayıcının tıklamayı yutmasına karşı); klavye için click yedek */
function onTap(el, fn) {
  let down = false, last = 0;
  el.addEventListener("pointerdown", (e) => { down = true; e.stopPropagation(); });
  el.addEventListener("pointerup", (e) => { if (!down) return; down = false; last = performance.now(); sfx.unlock(); fn(); e.stopPropagation(); });
  el.addEventListener("pointercancel", () => { down = false; });
  el.addEventListener("click", () => { if (performance.now() - last < 600) return; sfx.unlock(); fn(); });
}
onTap($("vkShuffle"), shuffleWheel);
onTap($("vkHint"), useHint);
onTap($("vkPiggy"), showExtras);
$("vkExtrasClose").addEventListener("click", () => { $("vkExtras").hidden = true; });
$("vkNext").addEventListener("click", next);
$("vkRetry").addEventListener("click", () => location.reload());
const soundBtn = $("vkSound");
function syncSound() { soundBtn.textContent = sfx.muted ? "🔇" : "🔊"; soundBtn.setAttribute("aria-pressed", sfx.muted ? "false" : "true"); soundBtn.setAttribute("aria-label", sfx.muted ? "Sesi aç" : "Sesi kapat"); }
soundBtn.addEventListener("click", () => { sfx.setMuted(!sfx.muted); syncSound(); if (!sfx.muted) sfx.tap(2); });
syncSound();
window.addEventListener("keydown", (e) => {
  if (!P.cur || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!$("vkExtras").hidden) { if (e.key === "Escape") $("vkExtras").hidden = true; return; }
  if (P.cur.done) { if (e.key === "Enter") next(); return; }
  if (e.key === "Enter") { const w = currentWord(); path = []; drawPath(); if (w) submit(w); e.preventDefault(); return; }
  if (e.key === "Backspace") { path.pop(); drawPath(); e.preventDefault(); return; }
  if (e.key === " ") { shuffleWheel(); e.preventDefault(); return; }
  if (e.key === "Escape") { path = []; drawPath(); return; }
  if (e.key.length === 1) {
    const ch = trUpper(e.key);
    if ((ch === "H") && !btns.some((b, i) => b.textContent === "H" && !path.includes(i))) { useHint(); return; }
    const i = btns.findIndex((b, idx) => b.textContent === ch && !path.includes(idx));
    if (i >= 0) { sfx.unlock(); addLetter(i); }
  }
});

init();

/* Test ve hata ayıklama */
window.VitaKelime = {
  state: () => ({ tierUps, tier: difficulty(P.level).tier, tierSeen: P.tierSeen || 1, badge: !$("vkTierUp").hidden, gridFits: (() => { const g = $("vkGrid").getBoundingClientRect(), b = $("vkBoard").getBoundingClientRect(); return g.left >= b.left - 1 && g.right <= b.right + 1 && g.top >= b.top - 1 && g.bottom <= b.bottom + 1; })(), level: P.level, hints: P.hints, piggy: P.piggy, played: P.played.length, root: P.cur && P.cur.data.root, words: P.cur && P.cur.data.words.map(p => p.w), found: P.cur ? P.cur.found.slice() : [], extras: P.cur ? P.cur.data.extras.slice() : [], extrasFound: P.cur ? P.cur.extras.slice() : [], open: P.cur ? P.cur.open.length : 0, done: !!(P.cur && P.cur.done), wheel: btns.map(b => b.textContent), ready: !!E, stats: { ...P.stats } }),
  letterCenter: (ch, nth = 0) => { const r = wheel.getBoundingClientRect(); const list = btns.filter(b => b.textContent === ch); const b = list[nth]; return b ? { x: r.left + b._x, y: r.top + b._y } : null; },
  btnCenter: (i) => { const r = wheel.getBoundingClientRect(), b = btns[i]; return b ? { x: r.left + b._x, y: r.top + b._y } : null; },
  set: (patch) => { Object.assign(P, patch); save(); renderHud(); },
  submit, useHint, shuffle: shuffleWheel, next,
  engine: () => E
};
