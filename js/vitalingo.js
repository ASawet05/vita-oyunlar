/* VitaLingo — tek kişilik Türkçe kelime tahmin oyunu. Saf HTML/CSS/JS (ES modülleri), dış kütüphane yok.
   Cevaplar: data/turkce-sozluk.json (4/5/6 harf) · Tahmin kabulü: data/lingo-kabul.json ∪ cevap havuzu.
   İlk harf verilir (yeşil, kilitli); 5 hak; harfler sırayla dönerek açılır: yeşil = doğru yer, sarı = kelimede var
   (tekrar eden harf sayısı gözetilir), gri = yok. Puan: kalan hak + hız + seri çarpanı. İpucu / Pas puanla kullanılır.
   Çözülen/geçilen kelimeler localStorage'da tutulur ve tekrar sorulmaz. */
import { createAudio } from "./lingo/ses.js";

const $ = (id) => document.getElementById(id);
const KEY = "vo_lingo_v1", MUTE_KEY = "vo_lingo_muted", ROWS = 5, HINT_COST = 30, PASS_COST = 60;
const ALPHA = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ";
const up = (s) => String(s).toLocaleUpperCase("tr-TR");
const chars = (w) => Array.from(w);
const sfx = createAudio(MUTE_KEY);

/* ---------------- Kayıt ---------------- */
function load() {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
  const d = { len: 5, score: 0, streak: 0, best: 0, solved: 0, played: 0, used: { 4: [], 5: [], 6: [] }, cur: null };
  s = Object.assign(d, s && typeof s === "object" ? s : {});
  s.used = Object.assign({ 4: [], 5: [], 6: [] }, s.used || {});
  if (![4, 5, 6].includes(s.len)) s.len = 5;
  return s;
}
let P = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); localStorage.setItem("vo_best_lingo", "Seri " + P.best); } catch (_) {} }

/* ---------------- Sözlük ---------------- */
let ANS = null, OK = null, HEALTH = new Set();
async function init() {
  try {
    const [a, b] = await Promise.all([fetch("data/turkce-sozluk.json").then(r => { if (!r.ok) throw 0; return r.json(); }), fetch("data/lingo-kabul.json").then(r => r.ok ? r.json() : { kelimeler: {} }).catch(() => ({ kelimeler: {} }))]);
    ANS = {}; OK = {};
    for (const n of [4, 5, 6]) {
      ANS[n] = (a.kelimeler[n] || []).filter(w => chars(w).every(c => ALPHA.includes(c)));
      OK[n] = new Set([...ANS[n], ...((b.kelimeler || {})[n] || [])]);
    }
    HEALTH = new Set(a.saglik || []);
  } catch (_) { $("vlLoading").hidden = true; $("vlError").hidden = false; return; }
  $("vlLoading").hidden = true;
  buildKeyboard();
  if (P.cur && P.cur.len === P.len && P.cur.status === "play" && OK[P.len].has(P.cur.answer)) restore(); else newWord();
}

/* ---------------- Kelime seçimi (tekrar yok) ---------------- */
function pickAnswer(n) {
  let used = new Set(P.used[n]);
  let pool = ANS[n].filter(w => !used.has(w));
  if (!pool.length) { P.used[n] = P.used[n].slice(-40); used = new Set(P.used[n]); pool = ANS[n].filter(w => !used.has(w)); toast("Tüm kelimeler oynandı — liste yenilendi 🎉", "info"); }
  return pool[Math.floor(Math.random() * pool.length)];
}
function newWord() {
  clearTimeout(autoT); clearInterval(cdT);
  const n = P.len, answer = pickAnswer(n);
  P.used[n].push(answer);
  P.cur = { len: n, answer, rows: [], known: [0], hinted: [], status: "play", start: Date.now() };
  typed = []; P.played++; save();
  $("vlReveal").hidden = true;
  buildBoard(); renderKeys(); renderHud(); renderRow();
}
function restore() { P.cur.start = Date.now(); typed = []; buildBoard(); P.cur.rows.forEach((g, r) => paintRow(r, g, evaluate(g, P.cur.answer), false)); renderKeys(); renderHud(); renderRow(); }

/* ---------------- Değerlendirme (tekrar eden harfler) ---------------- */
export function evaluate(guess, answer) {
  const g = chars(guess), a = chars(answer), res = Array(g.length).fill("miss"), left = {};
  a.forEach((ch, i) => { if (g[i] === ch) res[i] = "hit"; else left[ch] = (left[ch] || 0) + 1; });
  g.forEach((ch, i) => { if (res[i] !== "hit" && left[ch] > 0) { res[i] = "near"; left[ch]--; } });
  return res;
}

/* ---------------- Izgara ---------------- */
let typed = [];   // mevcut satırda yazılan harfler (0. konum = verilen ilk harf)
function buildBoard() {
  const b = $("vlBoard"), n = P.cur.len; b.style.setProperty("--n", n); b.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement("div"); row.className = "vl-row"; row.dataset.r = r;
    for (let i = 0; i < n; i++) { const t = document.createElement("div"); t.className = "vl-tile"; t.innerHTML = `<span class="vl-face"></span>`; row.appendChild(t); }
    b.appendChild(row);
  }
  fit();
}
function rowEl(r) { return $("vlBoard").children[r]; }
function renderRow() {
  const C = P.cur; if (!C || C.status !== "play") return;
  const r = C.rows.length, row = rowEl(r); if (!row) return;
  const ans = chars(C.answer);
  [...row.children].forEach((t, i) => {
    const face = t.firstChild, ch = i === 0 ? ans[0] : typed[i - 1];
    t.className = "vl-tile is-cur" + (i === 0 ? " is-given" : "");
    if (ch) { face.textContent = ch; t.classList.add("is-filled"); }
    else if (C.known.includes(i)) { face.textContent = ans[i]; t.classList.add("is-ghost"); if (C.hinted.includes(i)) t.classList.add("is-ghost-hint"); }
    else face.textContent = "";
  });
  [...$("vlBoard").children].forEach((rw, k) => rw.classList.toggle("is-active", k === r));
}
function paintRow(r, guess, res, anim) {
  const row = rowEl(r), g = chars(guess);
  [...row.children].forEach((t, i) => {
    const face = t.firstChild; face.textContent = g[i];
    const apply = () => { t.className = "vl-tile is-done is-" + res[i]; };
    if (anim) { t.style.animationDelay = "0ms"; setTimeout(() => { t.className = "vl-tile is-filled is-flip-out"; }, i * 190); setTimeout(() => { apply(); t.classList.add("is-flip"); sfx.flip(res[i], i); }, i * 190 + 150); }
    else apply();
  });
}
function fit() {
  const b = $("vlBoard"), wrap = $("vlBoardWrap"), n = P.cur ? P.cur.len : 5;
  const gap = 6, w = wrap.clientWidth - 8, h = wrap.clientHeight - 8;
  const ts = Math.max(30, Math.min(66, Math.floor((w - gap * (n - 1)) / n), Math.floor((h - gap * (ROWS - 1)) / ROWS)));
  b.style.setProperty("--ts", ts + "px");
}
new ResizeObserver(fit).observe(document.body);

/* ---------------- Girdi ---------------- */
function typeLetter(ch) {
  const C = P.cur; if (!C || C.status !== "play" || busy) return;
  ch = up(ch); if (!ALPHA.includes(ch) || chars(ch).length !== 1) return;
  if (typed.length >= C.len - 1) return;
  typed.push(ch); sfx.key(); renderRow();
}
function backspace() { if (!P.cur || P.cur.status !== "play" || busy || !typed.length) return; typed.pop(); sfx.del(); renderRow(); }
let busy = false;
function enter() {
  const C = P.cur; if (!C || C.status !== "play" || busy) return "none";
  const guess = chars(C.answer)[0] + typed.join("");
  if (chars(guess).length < C.len) { shakeRow("Harf eksik"); return "short"; }
  if (!OK[C.len].has(guess)) { shakeRow("Kelime sözlükte yok"); return "unknown"; }
  const res = evaluate(guess, C.answer), r = C.rows.length;
  C.rows.push(guess); typed = [];
  res.forEach((s, i) => { if (s === "hit" && !C.known.includes(i)) C.known.push(i); });
  busy = true; paintRow(r, guess, res, true);
  const dur = C.len * 190 + 380;
  const win = res.every(s => s === "hit");
  setTimeout(() => {
    busy = false; renderKeys();
    if (win) solved(r);
    else if (C.rows.length >= ROWS) failed();
    else renderRow();
    save();
  }, dur);
  save();
  return win ? "win" : "guess";
}
function shakeRow(msg) {
  const row = rowEl(P.cur.rows.length); sfx.bad();
  row.classList.remove("is-shake"); void row.offsetWidth; row.classList.add("is-shake");
  toast(msg, "bad");
}

/* ---------------- Sonuç ---------------- */
let autoT = null, cdT = null;
function solved(r) {
  const C = P.cur, secs = Math.round((Date.now() - C.start) / 1000);
  const speed = Math.max(0, 30 - secs) * 3, base = 100 + (ROWS - 1 - r) * 50 + speed;
  P.streak++; P.best = Math.max(P.best, P.streak); P.solved++;
  const mult = 1 + Math.min(P.streak - 1, 10) * 0.1, pts = Math.round(base * mult * (C.len / 5));
  P.score += pts; C.status = "won"; save();
  sfx.win(); celebrate(r);
  scorePop(`+${pts}`, `${ROWS - 1 - r} hak kaldı · ${secs} sn${P.streak > 1 ? ` · Seri ×${mult.toFixed(1)}` : ""}`);
  if (HEALTH.has(C.answer)) toast(`🩺 Sağlık terimi: ${C.answer}`, "info");
  renderHud(true);
  autoT = setTimeout(newWord, 1900);
}
function failed() {
  const C = P.cur; C.status = "lost"; const had = P.streak; P.streak = 0; save();
  sfx.lose();
  $("vlRevealWord").textContent = C.answer;
  $("vlRevealNote").textContent = had > 1 ? `Seri sıfırlandı (${had})` : "Bir dahaki kelimede!";
  $("vlRevealHealth").hidden = !HEALTH.has(C.answer);
  $("vlReveal").hidden = false; renderHud(true);
  let n = 4; $("vlCountdown").textContent = n;
  cdT = setInterval(() => { n--; $("vlCountdown").textContent = Math.max(0, n); if (n <= 0) { clearInterval(cdT); newWord(); } }, 1000);
}
function celebrate(r) {
  const row = rowEl(r); [...row.children].forEach((t, i) => { t.style.animationDelay = i * 70 + "ms"; t.classList.remove("is-flip"); t.classList.add("is-jump"); });
  const box = $("vlConfetti"); box.innerHTML = "";
  const cols = ["#22c55e", "#fde047", "#5eead4", "#f472b6", "#a78bfa"];
  for (let i = 0; i < 28; i++) { const s = document.createElement("i"); s.style.left = 20 + Math.random() * 60 + "%"; s.style.background = cols[i % cols.length]; s.style.animationDelay = Math.random() * 0.25 + "s"; s.style.setProperty("--dx", (Math.random() - 0.5) * 220 + "px"); box.appendChild(s); }
  setTimeout(() => { box.innerHTML = ""; }, 1800);
}

/* ---------------- Yardımcılar (puanla) ---------------- */
function useHint() {
  const C = P.cur; if (!C || C.status !== "play" || busy) return false;
  if (P.score < HINT_COST) { sfx.bad(); toast(`İpucu için ${HINT_COST} puan gerekli`, "bad"); return false; }
  const hidden = chars(C.answer).map((_, i) => i).filter(i => !C.known.includes(i));
  if (hidden.length <= 1) { toast("Son harfi kendin bul!", "info"); return false; }
  const i = hidden[Math.floor(Math.random() * hidden.length)];
  C.known.push(i); C.hinted.push(i); P.score -= HINT_COST; save();
  sfx.hint(); toast(`💡 ${i + 1}. harf açıldı (−${HINT_COST})`, "info"); renderRow(); renderHud(true);
  return true;
}
function pass() {
  const C = P.cur; if (!C || C.status !== "play" || busy) return false;
  if (P.score < PASS_COST) { sfx.bad(); toast(`Pas için ${PASS_COST} puan gerekli`, "bad"); return false; }
  P.score -= PASS_COST; C.status = "pass"; save();
  sfx.pass(); toast(`Pas geçildi: ${C.answer} (−${PASS_COST}, seri korundu)`, "info"); renderHud(true);
  autoT = setTimeout(newWord, 1100);
  return true;
}
function setLen(n) {
  if (n === P.len || busy) return;
  const C = P.cur;
  if (C && C.status === "play" && C.rows.length && P.streak) { P.streak = 0; toast("Kelime değişti — seri sıfırlandı", "bad"); }
  P.len = n; save(); newWord();
}

/* ---------------- Klavye (Türkçe Q) ---------------- */
const LAYOUT = [["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "Ğ", "Ü"], ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "İ"], ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "Ö", "Ç", "DEL"]];
function buildKeyboard() {
  const kb = $("vlKeys");
  kb.innerHTML = LAYOUT.map(row => `<div class="vl-krow">${row.map(k => {
    if (k === "ENTER") return `<button type="button" class="vl-key vl-key--wide vl-key--enter" data-k="ENTER" aria-label="Onayla">✓</button>`;
    if (k === "DEL") return `<button type="button" class="vl-key vl-key--wide" data-k="DEL" aria-label="Sil">⌫</button>`;
    const off = !ALPHA.includes(k);
    return `<button type="button" class="vl-key${off ? " is-off" : ""}" data-k="${k}"${off ? ' disabled aria-disabled="true"' : ""}>${k}</button>`;
  }).join("")}</div>`).join("");
}
function renderKeys() {
  const C = P.cur; if (!C) return;
  const st = {}; const rank = { hit: 3, near: 2, miss: 1 };
  C.rows.forEach(g => evaluate(g, C.answer).forEach((s, i) => { const ch = chars(g)[i]; if (!st[ch] || rank[s] > rank[st[ch]]) st[ch] = s; }));
  document.querySelectorAll(".vl-key[data-k]").forEach(b => { const k = b.dataset.k; b.classList.remove("is-hit", "is-near", "is-miss"); if (st[k]) b.classList.add("is-" + st[k]); });
}
/* Dokunmatikte anında tepki: pointerdown ile tetikle */
$("vlKeys").addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".vl-key"); if (!b || b.disabled) return;
  e.preventDefault(); sfx.unlock();
  const k = b.dataset.k; b.classList.add("is-press"); setTimeout(() => b.classList.remove("is-press"), 120);
  if (k === "ENTER") enter(); else if (k === "DEL") backspace(); else typeLetter(k);
});
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!$("vlReveal").hidden && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); newWord(); return; }
  if (e.key === "Enter") { e.preventDefault(); sfx.unlock(); enter(); return; }
  if (e.key === "Backspace") { e.preventDefault(); backspace(); return; }
  if (e.key.length === 1) { sfx.unlock(); typeLetter(e.key); }
});

/* ---------------- HUD ---------------- */
let prevHud = {};
function bump(id, v) { const el = $(id); if (prevHud[id] !== undefined && prevHud[id] !== v) { const box = el.closest(".vl-stat"); box.classList.remove("is-up", "is-down"); void box.offsetWidth; box.classList.add(v > prevHud[id] ? "is-up" : "is-down"); } prevHud[id] = v; }
function renderHud() {
  $("vlScore").textContent = String(P.score); bump("vlScore", P.score);
  $("vlStreak").textContent = String(P.streak); bump("vlStreak", P.streak);
  $("vlBest").textContent = String(P.best);
  $("vlHint").disabled = P.score < HINT_COST; $("vlPass").disabled = P.score < PASS_COST;
  document.querySelectorAll("[data-len]").forEach(b => b.setAttribute("aria-pressed", Number(b.dataset.len) === P.len ? "true" : "false"));
  $("vlStreak").closest(".vl-stat").classList.toggle("is-hot", P.streak >= 3);
}
function scorePop(big, small) { const d = $("vlPop"); d.innerHTML = `<b>${big}</b><small>${small}</small>`; d.classList.remove("is-on"); void d.offsetWidth; d.classList.add("is-on"); }
function toast(text, tone) {
  const box = $("vlToasts"), d = document.createElement("div");
  d.className = "vl-toast" + (tone ? " vl-toast--" + tone : ""); d.textContent = text;
  box.appendChild(d); while (box.children.length > 2) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 1900);
}
setInterval(() => { const C = P.cur; $("vlTimer").textContent = C && C.status === "play" ? Math.min(999, Math.round((Date.now() - C.start) / 1000)) + " sn" : "—"; }, 500);

$("vlHint").addEventListener("click", () => { sfx.unlock(); useHint(); });
$("vlPass").addEventListener("click", () => { sfx.unlock(); pass(); });
$("vlNext").addEventListener("click", () => newWord());
$("vlRetry").addEventListener("click", () => location.reload());
document.querySelectorAll("[data-len]").forEach(b => b.addEventListener("click", () => setLen(Number(b.dataset.len))));
const soundBtn = $("vlSound");
function syncSound() { soundBtn.textContent = sfx.muted ? "🔇" : "🔊"; soundBtn.setAttribute("aria-pressed", sfx.muted ? "false" : "true"); soundBtn.setAttribute("aria-label", sfx.muted ? "Sesi aç" : "Sesi kapat"); }
soundBtn.addEventListener("click", () => { sfx.setMuted(!sfx.muted); syncSound(); if (!sfx.muted) sfx.key(); });
syncSound(); renderHud();
init();

/* Test ve hata ayıklama */
window.VitaLingo = {
  state: () => ({ ready: !!ANS, len: P.len, score: P.score, streak: P.streak, best: P.best, solved: P.solved, status: P.cur && P.cur.status, rows: P.cur ? P.cur.rows.slice() : [], known: P.cur ? P.cur.known.slice() : [], typed: typed.join(""), first: P.cur && chars(P.cur.answer)[0], used: { 4: P.used[4].length, 5: P.used[5].length, 6: P.used[6].length }, busy, sizes: ANS && { 4: ANS[4].length, 5: ANS[5].length, 6: ANS[6].length, ok5: OK[5].size } }),
  evaluate, type: (s) => chars(up(s)).forEach(typeLetter), enter, backspace, useHint, pass, setLen, newWord,
  debug: { answer: () => P.cur && P.cur.answer, setAnswer: (w) => { clearTimeout(autoT); clearInterval(cdT); $("vlReveal").hidden = true; P.cur.answer = up(w); P.cur.len = chars(P.cur.answer).length; P.cur.status = "play"; P.cur.start = Date.now(); P.cur.hinted = []; typed = []; P.cur.known = [0]; P.cur.rows = []; buildBoard(); renderKeys(); renderRow(); }, set: (patch) => { Object.assign(P, patch); save(); renderHud(); }, valid: (w) => !!OK && OK[chars(up(w)).length] && OK[chars(up(w)).length].has(up(w)) }
};
