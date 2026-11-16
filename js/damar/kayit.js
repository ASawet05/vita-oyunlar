/* Damar Yolu Koşucusu — kalıcı kayıt (yalnızca bu cihazda, localStorage).
   v2: Vita-Puan bakiyesi, rekor, sahip olunan/seçili karakter ve kapsül tasarımı, kapsül stoğu, ses tercihi.
   Eski sürümün (vo_damar_profile_v1) damla bankası ve kaykay stoğu ilk açılışta bir kez taşınır; eski kayıt silinmez. */
import { CHARS, CAPS, STOCK_MAX } from "./ayar.js";
const KEY = "vo_damar_v2", OLD_KEY = "vo_damar_profile_v1", OLD_BEST = "vo_damar_best";

const fresh = () => ({ v: 2, vp: 0, best: 0, chars: ["vita"], char: "vita", caps: ["nano"], cap: "nano", stock: 2, sound: true, runs: 0 });
const int = (v, d = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 ? n : d; };

export function loadProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { p = null; }
  if (!p || typeof p !== "object") {
    p = fresh();
    try {
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
      if (old && typeof old === "object") { p.vp = int(old.bank); p.stock = Math.min(STOCK_MAX, Math.max(2, int(old.boards))); }
      p.best = int(localStorage.getItem(OLD_BEST));
    } catch (_) {}
  }
  const f = fresh();
  p.vp = int(p.vp); p.best = int(p.best); p.runs = int(p.runs);
  p.stock = Math.min(STOCK_MAX, int(p.stock, f.stock));
  p.chars = Array.isArray(p.chars) ? p.chars.filter(k => CHARS[k]) : f.chars; if (!p.chars.includes("vita")) p.chars.unshift("vita");
  p.caps = Array.isArray(p.caps) ? p.caps.filter(k => CAPS[k]) : f.caps; if (!p.caps.includes("nano")) p.caps.unshift("nano");
  if (!p.chars.includes(p.char)) p.char = "vita";
  if (!p.caps.includes(p.cap)) p.cap = "nano";
  p.sound = p.sound !== false;
  return p;
}
export function saveProfile(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    localStorage.setItem("vo_best_damar", p.best ? p.best + " puan" : "—"); // lobi kartı
    return true;
  } catch (_) { return false; }
}
