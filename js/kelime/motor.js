/* VitaKelime — prosedürel bulmaca motoru (saf ES modülü; tarayıcıda ve Node'da çalışır, DOM kullanmaz).
   1) Bölüm zorluğuna göre çark uzunluğu (4-7) ve hedef kelime sayısı (4-9) belirlenir.
   2) Sözlükten daha önce oynanmamış bir kök kelime seçilir; kökün harfleriyle (harf sayısı aşılmadan) yazılabilen
      tüm alt kelimeler bulunur.
   3) Bunlardan bir alt küme, ortak harflerde kesişen geçerli bir bulmaca ızgarasına yerleştirilir
      (yan yana bitişme yok, kazara yeni kelime oluşmaz). Izgaraya girmeyen tüm geçerli kelimeler "ekstra"dır. */
export const ALPHA = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ";
const IDX = new Map([...ALPHA].map((c, i) => [c, i]));
export const trUpper = (s) => String(s).toLocaleUpperCase("tr-TR");
export const letters = (w) => Array.from(w);

/* Tohumlu rastgele (mulberry32) — aynı tohum aynı bölümü üretir */
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* Kademeli zorluk eğrisi (seviye sistemi). extra: kökten çıkabilecek en az ekstra kelime; sparse: az ortak harfli kesişimler */
export const TIERS = [
  { tier: 1, from: 1, to: 3, name: "Başlangıç", lens: [4], min: 3, max: 4, extra: 1, maxSide: 7 },
  { tier: 2, from: 4, to: 7, name: "Kolay-Orta", lens: [5], min: 5, max: 6, extra: 2, maxSide: 8 },
  { tier: 3, from: 8, to: 12, name: "Orta", lens: [6], min: 6, max: 8, extra: 2, maxSide: 10 },
  { tier: 4, from: 13, to: 18, name: "Zor", lens: [7], min: 8, max: 10, extra: 2, maxSide: 11 },
  { tier: 5, from: 19, to: Infinity, name: "Usta", lens: [7, 8], min: 9, max: 12, extra: 3, maxSide: 12, sparse: true }
];
export function difficulty(level) { return TIERS.find(t => level >= t.from && level <= t.to) || TIERS[TIERS.length - 1]; }

export function createEngine(dict) {
  const all = [];
  for (const n of Object.keys(dict.kelimeler)) for (const w of dict.kelimeler[n]) all.push(w);
  const set = new Set(all);
  const health = new Set(dict.saglik || []);
  const vec = new Map();                         // kelime → harf sayım vektörü
  const cnt = (w) => { let v = vec.get(w); if (v) return v; v = new Uint8Array(ALPHA.length); for (const ch of w) v[IDX.get(ch)]++; vec.set(w, v); return v; };
  all.forEach(cnt);
  const lenOf = (w) => letters(w).length;
  const byLen = {}; all.forEach(w => { const n = lenOf(w); (byLen[n] = byLen[n] || []).push(w); });

  /* Kökün harfleriyle yazılabilen tüm sözlük kelimeleri (uzundan kısaya) */
  const subCache = new Map();
  function subwords(root) {
    if (subCache.has(root)) return subCache.get(root);
    const rv = cnt(root), n = lenOf(root), out = [];
    for (let L = 3; L <= n; L++) for (const w of byLen[L] || []) {
      const wv = vec.get(w); let ok = true;
      for (let i = 0; i < wv.length; i++) if (wv[i] > rv[i]) { ok = false; break; }
      if (ok) out.push(w);
    }
    out.sort((a, b) => lenOf(b) - lenOf(a) || a.localeCompare(b, "tr"));
    subCache.set(root, out); return out;
  }

  /* ---- Bulmaca ızgarası yerleşimi ---- */
  function layout(words, r, maxSide, sparse) {
    // words: yerleştirilecek adaylar (ilk eleman kök — her zaman yatay ilk sırada)
    let best = null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const grid = new Map(), owner = new Map(), placed = [];
      const key = (x, y) => x + "," + y;
      const put = (w, x, y, dir) => {
        const L = letters(w), dx = dir === "H" ? 1 : 0, dy = dir === "V" ? 1 : 0;
        L.forEach((ch, k) => { const kk = key(x + k * dx, y + k * dy); grid.set(kk, ch); owner.set(kk, (owner.get(kk) || "") + dir); });
        placed.push({ w, x, y, dir });
      };
      const can = (w, x, y, dir) => {
        const L = letters(w), dx = dir === "H" ? 1 : 0, dy = dir === "V" ? 1 : 0;
        if (grid.has(key(x - dx, y - dy)) || grid.has(key(x + L.length * dx, y + L.length * dy))) return -1;
        let cross = 0;
        for (let k = 0; k < L.length; k++) {
          const cx = x + k * dx, cy = y + k * dy, g = grid.get(key(cx, cy));
          if (g !== undefined) {
            if (g !== L[k] || (owner.get(key(cx, cy)) || "").includes(dir)) return -1;
            cross++;
          } else if (grid.has(key(cx + dy, cy + dx)) || grid.has(key(cx - dy, cy - dx))) return -1;  // yan komşu
        }
        return cross;
      };
      const bounds = (extra) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const add = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
        for (const k of grid.keys()) { const [x, y] = k.split(",").map(Number); add(x, y); }
        if (extra) { const L = letters(extra.w).length; add(extra.x, extra.y); add(extra.x + (extra.dir === "H" ? L - 1 : 0), extra.y + (extra.dir === "V" ? L - 1 : 0)); }
        return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      };
      put(words[0], 0, 0, attempt % 2 ? "V" : "H");
      const rest = shuffle(words.slice(1), r).sort((a, b) => (lenOf(b) - lenOf(a)) + (r() - 0.5) * 2.2);
      for (const w of rest) {
        const L = letters(w); let cands = [];
        for (const [k, ch] of grid) {
          const [gx, gy] = k.split(",").map(Number);
          L.forEach((c, i) => {
            if (c !== ch) return;
            for (const dir of ["H", "V"]) {
              const x = dir === "H" ? gx - i : gx, y = dir === "V" ? gy - i : gy, cr = can(w, x, y, dir);
              if (cr > 0) {
                const b = bounds({ w, x, y, dir });
                if (b.w > maxSide || b.h > maxSide) continue;
                cands.push({ x, y, dir, score: (sparse ? (cr === 1 ? 6 : 6 - (cr - 1) * 5) : cr * 6) - b.w * b.h * 0.08 - Math.abs(b.w - b.h) * 0.6 + r() * 2 });
              }
            }
          });
        }
        if (!cands.length) continue;
        cands.sort((a, b) => b.score - a.score);
        const c = cands[0]; put(w, c.x, c.y, c.dir);
      }
      const b = bounds();
      const score = placed.length * 100 - b.w * b.h - Math.abs(b.w - b.h) * 3;
      if (!best || score > best.score) best = { score, placed: placed.map(p => ({ ...p, x: p.x - b.x0, y: p.y - b.y0 })), w: b.w, h: b.h };
      if (best.placed.length === words.length && attempt >= 6) break;
    }
    return best;
  }

  /* Izgaradaki yatay/dikey tüm dizileri çıkarır (doğrulama: kazara kelime yok) */
  function runs(lay) {
    const g = new Map(); (lay.placed || lay.words).forEach(p => letters(p.w).forEach((ch, k) => g.set((p.x + (p.dir === "H" ? k : 0)) + "," + (p.y + (p.dir === "V" ? k : 0)), ch)));
    const out = [];
    for (const dir of ["H", "V"]) for (let a = 0; a < (dir === "H" ? lay.h : lay.w); a++) {
      let cur = "";
      for (let b = 0; b <= (dir === "H" ? lay.w : lay.h); b++) {
        const ch = g.get(dir === "H" ? b + "," + a : a + "," + b);
        if (ch) cur += ch; else { if (letters(cur).length > 1) out.push(cur); cur = ""; }
      }
    }
    return out;
  }

  const rootPool = {};   // uzunluk:gereken → yeterince zengin kökler (ızgara + ekstra kadar alt kelime)
  function poolFor(n, need) {
    const k = n + ":" + need;
    if (!rootPool[k]) rootPool[k] = (byLen[n] || []).filter(w => subwords(w).length >= need);
    return rootPool[k];
  }

  /* Bölüm üret. opts: { played:Set(kökler), recent:Set(son kelimeler), seed, strict } — strict: kademe şartları gevşetilmez (bulunamazsa null) */
  function generate(level, opts = {}) {
    const played = opts.played || new Set(), recent = opts.recent || new Set();
    const r = rng(opts.seed != null ? opts.seed : (level * 2654435761) >>> 0);
    const D = difficulty(level), healthLevel = level % 10 === 0;   // her 10. bölüm: Sağlık Bölümü
    for (let relax = 0; relax < (opts.strict ? 1 : 5); relax++) {
      const min = Math.max(3, D.min - relax), extraMin = Math.max(1, D.extra - (relax >= 2 ? 1 : 0)), maxW = D.max;
      const lens = shuffle(D.lens, r).concat(relax >= 3 ? D.lens.map(n => n - 1).filter(n => n >= 4) : []);
      for (const n of lens) {
        let pool = poolFor(n, min + extraMin).filter(w => !played.has(w));
        if (healthLevel && relax < 2) { const hp = pool.filter(w => health.has(w)); if (hp.length) pool = hp; }
        if (!pool.length) continue;
        for (const root of shuffle(pool, r).slice(0, 30)) {
          const all = subwords(root), subs = all.filter(w => w !== root);
          // Izgaraya en fazla (toplam − ekstraMin) kelime; hedef sayı kademe aralığında rastgele
          const target = Math.min(maxW, min + Math.floor(r() * (maxW - min + 1)), all.length - extraMin);
          if (target < min) continue;
          const scored = subs.map(w => ({ w, s: (recent.has(w) ? -5 : 0) + (health.has(w) ? 1.2 : 0) + lenOf(w) * 0.35 + r() * 1.5 }));
          scored.sort((a, b) => b.s - a.s);
          const cand = [root].concat(scored.slice(0, target + 4).map(o => o.w));
          const lay = layout(cand, r, D.maxSide, D.sparse);
          if (!lay) continue;
          let finalLay = lay;
          if (lay.placed.length > target) finalLay = layout(lay.placed.slice(0, target).map(p => p.w).sort((a, b) => (a === root ? -1 : b === root ? 1 : 0)), r, D.maxSide, D.sparse) || lay;
          if (finalLay.placed.length > target) continue;
          const count = finalLay.placed.length;
          if (count < min) continue;
          const gridWords = new Set(finalLay.placed.map(p => p.w));
          const extras = all.filter(w => !gridWords.has(w));
          if (extras.length < extraMin) continue;
          return {
            level, root, tier: D.tier, tierName: D.name, health: health.has(root),
            letters: (() => { let L = shuffle(letters(root), r), k = 0; while (L.join("") === root && k++ < 5) L = shuffle(L, r); return L; })(),
            w: finalLay.w, h: finalLay.h, words: finalLay.placed.sort((a, b) => a.y - b.y || a.x - b.x), extras
          };
        }
      }
    }
    return null;
  }

  return { all, set, health, byLen, subwords, generate, runs, layout, has: (w) => set.has(trUpper(w)), size: all.length };
}
