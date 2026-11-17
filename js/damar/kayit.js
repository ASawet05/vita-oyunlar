/* Damar Yolu Koşucusu — kalıcı kayıt (yalnızca bu cihazda, localStorage).
   v3: Vita-Puan, rekor, karakter/kapsül/güçlendirici SEVİYELERİ (0 = sahip değil, 1..5), seçimler,
   kapsül stoğu, Biyo-Kumbara ve ses tercihi. v2 (vo_damar_v2) ve v1 (vo_damar_profile_v1) ilk açılışta
   bir kez taşınır; eski kayıtlar silinmez. */
import { CHARS, CAPS, POWERS, STOCK_MAX, piggyCap } from "./ayar.js";
const KEY = "vo_damar_v3", V2 = "vo_damar_v2", V1 = "vo_damar_profile_v1", OLD_BEST = "vo_damar_best";

const int = (v, d = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 ? n : d; };
const lvl = v => Math.max(0, Math.min(5, int(v)));
const fresh = () => ({
  v: 3, vp: 0, best: 0, runs: 0, sound: true, stock: 2,
  chars: { vita: 1, demir: 0, d3: 0, b12: 0 }, char: "vita",
  caps: { nano: 1, plazma: 0, altin: 0 }, cap: "nano",
  pw: { jet: 1, magnet: 1, x2: 1 },
  piggy: { fill: 0, opened: 0 }, tips: 0
});

function migrate() {
  const p = fresh();
  try {
    const v2 = JSON.parse(localStorage.getItem(V2) || "null");
    if (v2 && typeof v2 === "object") {
      p.vp = int(v2.vp); p.best = int(v2.best); p.runs = int(v2.runs); p.sound = v2.sound !== false; p.stock = int(v2.stock, 2);
      if (Array.isArray(v2.chars)) for (const k of v2.chars) if (CHARS[k]) p.chars[k] = Math.max(1, p.chars[k]);
      if (Array.isArray(v2.caps)) for (const k of v2.caps) if (CAPS[k]) p.caps[k] = Math.max(1, p.caps[k]);
      if (CHARS[v2.char]) p.char = v2.char; if (CAPS[v2.cap]) p.cap = v2.cap;
      return p;
    }
    const v1 = JSON.parse(localStorage.getItem(V1) || "null");
    if (v1 && typeof v1 === "object") { p.vp = int(v1.bank); p.stock = Math.max(2, int(v1.boards)); }
    p.best = int(localStorage.getItem(OLD_BEST));
  } catch (_) {}
  return p;
}

export function loadProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { p = null; }
  if (!p || typeof p !== "object") p = migrate();
  const f = fresh();
  p.v = 3; p.vp = int(p.vp); p.best = int(p.best); p.runs = int(p.runs); p.tips = int(p.tips);
  p.stock = Math.min(STOCK_MAX, int(p.stock, f.stock)); p.sound = p.sound !== false;
  for (const [key, defs, base] of [["chars", CHARS, "vita"], ["caps", CAPS, "nano"], ["pw", POWERS, null]]) {
    const src = p[key] && typeof p[key] === "object" && !Array.isArray(p[key]) ? p[key] : f[key], out = {};
    for (const k in defs) out[k] = lvl(src[k] ?? f[key][k]);
    if (base) out[base] = Math.max(1, out[base]); else for (const k in out) out[k] = Math.max(1, out[k]);
    p[key] = out;
  }
  if (!p.chars[p.char]) p.char = "vita";
  if (!p.caps[p.cap]) p.cap = "nano";
  const pg = p.piggy && typeof p.piggy === "object" ? p.piggy : f.piggy;
  p.piggy = { opened: int(pg.opened), fill: 0 }; p.piggy.fill = Math.min(piggyCap(p.piggy.opened), int(pg.fill));
  return p;
}
export function saveProfile(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    localStorage.setItem("vo_best_damar", p.best ? p.best.toLocaleString("tr-TR") + " puan" : "—"); // lobi kartı
    return true;
  } catch (_) { return false; }
}
