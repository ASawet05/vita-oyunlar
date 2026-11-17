/* Damar Yolu Koşucusu — prosedürel dokular (Canvas 2D → THREE.CanvasTexture). Dış görsel dosyası yok:
   yol/ray yatağı, organik damar duvarı, bölgeye özel canlı duvar resimleri atlası, vitamin etiketleri,
   bariyer şeritleri, fibrin ağı, rampa okları, parıltı ve yumuşak gölge. */
import * as THREE from "../vendor/three-paket.js";

const TAU = Math.PI * 2;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function tex(c, { repeat = false, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso; t.needsUpdate = true; return t;
}
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/* ---------- Yol: 3 ray yatağı + traversler + akış okları (renk: gri tonlu, malzeme rengiyle boyanır) ---------- */
export function roadTextures(wallX, lanes) {
  const W = 512, H = 512, [c, g] = cv(W, H), [e, ge] = cv(W, H), r = rng(7);
  const ux = x => (x + wallX) / (wallX * 2) * W;
  g.fillStyle = "#6b6b6b"; g.fillRect(0, 0, W, H);
  // organik zemin benekleri
  for (let i = 0; i < 900; i++) { const v = 90 + r() * 60 | 0; g.fillStyle = `rgba(${v},${v},${v},${0.12 + r() * 0.2})`; g.beginPath(); g.arc(r() * W, r() * H, 1 + r() * 7, 0, TAU); g.fill(); }
  ge.fillStyle = "#000"; ge.fillRect(0, 0, W, H);
  const bedW = 2.05 / (wallX * 2) * W;
  for (const lx of lanes) {
    const x0 = ux(lx) - bedW / 2;
    const gr = g.createLinearGradient(x0, 0, x0 + bedW, 0); gr.addColorStop(0, "#3a3a3a"); gr.addColorStop(0.5, "#2a2a2a"); gr.addColorStop(1, "#3a3a3a");
    g.fillStyle = gr; g.fillRect(x0, 0, bedW, H);
    // traversler (8 adet / doku = 1 m aralık)
    for (let k = 0; k < 8; k++) { const y = k * H / 8 + 6; g.fillStyle = "#565656"; g.fillRect(x0 + 6, y, bedW - 12, H / 8 * 0.32); g.fillStyle = "rgba(255,255,255,.10)"; g.fillRect(x0 + 6, y, bedW - 12, 3); }
    // yatak içi akış okları (emisif, hafif)
    for (let k = 0; k < 2; k++) {
      const cy = k * H / 2 + H / 4, cx = ux(lx);
      ge.strokeStyle = "rgba(255,255,255,.35)"; ge.lineWidth = 7; ge.lineCap = "round"; ge.lineJoin = "round";
      ge.beginPath(); ge.moveTo(cx - bedW * 0.22, cy + 14); ge.lineTo(cx, cy - 12); ge.lineTo(cx + bedW * 0.22, cy + 14); ge.stroke();
    }
  }
  // şerit ayırıcı parlayan çizgiler
  for (const sx of [(lanes[0] + lanes[1]) / 2, (lanes[1] + lanes[2]) / 2]) {
    const x = ux(sx);
    g.fillStyle = "#9a9a9a"; g.fillRect(x - 5, 0, 10, H);
    for (let k = 0; k < 4; k++) { ge.fillStyle = "#fff"; ge.fillRect(x - 3, k * H / 4 + 10, 6, H / 4 - 34); ge.fillStyle = "rgba(255,255,255,.25)"; ge.fillRect(x - 8, k * H / 4 + 10, 16, H / 4 - 34); }
  }
  // kenar bantları (duvar dibine doğru koyulaşan)
  for (const side of [0, 1]) {
    const x0 = side ? ux(lanes[2] + 1.25) : 0, x1 = side ? W : ux(lanes[0] - 1.25);
    const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(side ? 0 : 1, "rgba(0,0,0,0)"); gr.addColorStop(side ? 1 : 0, "rgba(0,0,0,.55)");
    g.fillStyle = gr; g.fillRect(x0, 0, x1 - x0, H);
    for (let k = 0; k < 6; k++) { ge.fillStyle = "rgba(255,255,255,.6)"; const x = side ? ux(lanes[2] + 1.5) : ux(lanes[0] - 1.5); ge.beginPath(); ge.arc(x, k * H / 6 + 20, 4, 0, TAU); ge.fill(); }
  }
  return { map: tex(c, { repeat: true, aniso: 8 }), emissive: tex(e, { repeat: true, aniso: 8 }) };
}

/* ---------- Damar duvarı: hücre zarı deseni + kaburgalar (renk) ve dallanan damarcıklar (emisif) ---------- */
export function wallTextures() {
  const W = 512, H = 512, [c, g] = cv(W, H), [e, ge] = cv(W, H), r = rng(11);
  g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, W, H);
  ge.fillStyle = "#000"; ge.fillRect(0, 0, W, H);
  // döşenebilir hücre benekleri (kenarlarda sarmalanır)
  const blob = (ctx, x, y, rad, fill) => { for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x + ox, y + oy, rad, rad * (0.7 + r() * 0.3), r() * TAU, 0, TAU); ctx.fill(); } };
  for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * H, rad = 14 + r() * 34, v = 150 + r() * 70 | 0; blob(g, x, y, rad, `rgba(${v},${v},${v},.55)`); blob(g, x - rad * 0.2, y - rad * 0.2, rad * 0.55, `rgba(255,255,255,.18)`); blob(g, x + rad * 0.3, y + rad * 0.25, rad * 0.18, `rgba(40,40,40,.35)`); }
  // yatay kaburgalar (duvar boyunca halka izleri)
  for (let k = 0; k < 4; k++) { const x = k * W / 4 + 20; const gr = g.createLinearGradient(x - 18, 0, x + 18, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(0,0,0,.35)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - 18, 0, 36, H); }
  // dallanan damarcıklar
  ge.lineCap = "round";
  const vein = (x, y, ang, len, w, depth) => {
    if (depth > 4 || len < 8) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
      ge.strokeStyle = `rgba(255,255,255,${0.75 - depth * 0.12})`; ge.lineWidth = w; ge.beginPath(); ge.moveTo(x + ox, y + oy); ge.quadraticCurveTo(x + ox + (r() - 0.5) * 20, y + oy + (r() - 0.5) * 20, x2 + ox, y2 + oy); ge.stroke();
    }
    vein(x2, y2, ang + (r() - 0.5) * 0.9, len * 0.78, w * 0.72, depth + 1);
    if (r() < 0.6) vein(x2, y2, ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * 0.6, w * 0.6, depth + 1);
  };
  for (let i = 0; i < 6; i++) vein(r() * W, r() * H, r() * TAU, 50 + r() * 40, 5, 0);
  for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H; const gr = ge.createRadialGradient(x, y, 0, x, y, 9); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); ge.fillStyle = gr; ge.fillRect(x - 9, y - 9, 18, 18); }
  return { map: tex(c, { repeat: true }), emissive: tex(e, { repeat: true }) };
}

/* ---------- Duvar resimleri atlası (2 sütun × 4 satır, her biri 2:1) ---------- */
const MURAL_PAL = [
  { bg1: "#2b0610", bg2: "#5c0f22", a: "#ff4d6d", b: "#ffd166", c: "#5ef2ff", t: "#fff4f0" },
  { bg1: "#3a0a2a", bg2: "#7a1d4a", a: "#ff8fab", b: "#ffd43b", c: "#63e6be", t: "#fffaf0" },
  { bg1: "#030a26", bg2: "#0b2a6b", a: "#38bdf8", b: "#c084fc", c: "#a3e635", t: "#f0f9ff" }
];
export const MURAL_COUNT = 8;
export function muralAtlas(zone) {
  const CW = 512, CH = 256, [c, g] = cv(CW * 2, CH * 4), p = MURAL_PAL[zone % 3], r = rng(100 + zone * 17);
  const glowStroke = (fn, color, w, blur = 18) => { g.save(); g.shadowColor = color; g.shadowBlur = blur; g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; fn(); g.stroke(); g.restore(); };
  const glowFill = (fn, color, blur = 22) => { g.save(); g.shadowColor = color; g.shadowBlur = blur; g.fillStyle = color; fn(); g.fill(); g.restore(); };
  const label = (txt, x, y, size, color = p.t, align = "left") => { g.save(); g.font = `900 ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = "middle"; g.shadowColor = color; g.shadowBlur = 14; g.fillStyle = color; g.fillText(txt, x, y); g.restore(); };
  const heart = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.55, y - s * 1.05, x, y - s * 0.45); g.bezierCurveTo(x + s * 0.55, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35); g.closePath(); };
  const rbc = (x, y, s, col) => { g.save(); g.translate(x, y); g.rotate(r() * TAU); const gr = g.createRadialGradient(0, 0, s * 0.15, 0, 0, s); gr.addColorStop(0, p.bg2); gr.addColorStop(0.45, col); gr.addColorStop(1, col); g.fillStyle = gr; g.shadowColor = col; g.shadowBlur = 16; g.beginPath(); g.ellipse(0, 0, s, s * 0.82, 0, 0, TAU); g.fill(); g.restore(); };
  const draws = [
    (w, h) => { // Kalp + EKG
      glowFill(() => heart(w * 0.2, h * 0.64, 66), p.a, 30);
      glowStroke(() => { g.beginPath(); g.moveTo(190, h * 0.66); for (const [x, y] of [[262, 0.66], [286, 0.66], [302, 0.5], [320, 0.88], [340, 0.36], [358, 0.76], [376, 0.66], [w - 18, 0.66]]) g.lineTo(x, h * y); }, p.c, 6);
      label("NABIZ", w - 26, h * 0.2, 44, p.t, "right"); label("72 / dk", 28, h * 0.17, 28, p.b);
    },
    (w, h) => { // DNA sarmalı
      for (let i = 0; i <= 26; i++) { const x = 30 + i * 17, a = i * 0.48, y1 = h / 2 + Math.sin(a) * 70, y2 = h / 2 - Math.sin(a) * 70; g.strokeStyle = i % 2 ? p.b : p.c; g.globalAlpha = 0.6 + 0.4 * Math.abs(Math.cos(a)); g.lineWidth = 5; g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y2); g.stroke(); g.globalAlpha = 1; }
      glowStroke(() => { g.beginPath(); for (let x = 30; x <= 472; x += 4) g.lineTo(x, h / 2 + Math.sin((x - 30) / 17 * 0.48) * 70); }, p.a, 9);
      glowStroke(() => { g.beginPath(); for (let x = 30; x <= 472; x += 4) g.lineTo(x, h / 2 - Math.sin((x - 30) / 17 * 0.48) * 70); }, p.t, 9);
      label("DNA", w - 24, 34, 40, p.t, "right");
    },
    (w, h) => { // Alyuvar + O2
      rbc(110, 140, 66, p.a); rbc(210, 90, 44, p.a); rbc(200, 196, 36, p.a);
      for (let i = 0; i < 9; i++) { const x = 270 + r() * 200, y = 40 + r() * 180, s = 10 + r() * 18; glowStroke(() => { g.beginPath(); g.arc(x, y, s, 0, TAU); }, p.c, 3, 12); }
      label("O₂", w * 0.72, h * 0.5, 96, p.c, "center");
    },
    (w, h) => { // Nöron + sinyal
      const cx = 150, cy = 128;
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.3; glowStroke(() => { g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a) * 60 + 20, cy + Math.sin(a) * 60, cx + Math.cos(a) * 110, cy + Math.sin(a) * 95); }, p.c, 5, 10); }
      glowStroke(() => { g.beginPath(); g.moveTo(cx, cy); g.bezierCurveTo(260, 80, 330, 200, w - 30, 120); }, p.b, 8);
      for (let i = 0; i < 5; i++) glowFill(() => { g.beginPath(); g.arc(300 + i * 36, 136 + Math.sin(i) * 26, 7, 0, TAU); }, p.t, 18);
      glowFill(() => { g.beginPath(); g.arc(cx, cy, 34, 0, TAU); }, p.a, 30);
      label("SİNYAL", w - 24, 36, 34, p.t, "right");
    },
    (w, h) => { // Vitamin kapsülü
      g.save(); g.translate(170, 128); g.rotate(-0.45);
      glowFill(() => { g.beginPath(); g.roundRect(-120, -46, 120, 92, [46, 0, 0, 46]); }, p.a, 26);
      glowFill(() => { g.beginPath(); g.roundRect(0, -46, 120, 92, [0, 46, 46, 0]); }, p.b, 26);
      g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.roundRect(-100, -34, 200, 16, 8); g.fill(); g.restore();
      for (let i = 0; i < 14; i++) { const x = 300 + r() * 190, y = 20 + r() * 216; glowFill(() => { g.beginPath(); g.arc(x, y, 3 + r() * 4, 0, TAU); }, i % 2 ? p.c : p.b, 12); }
      label("VİTA", w * 0.78, h * 0.5, 64, p.t, "center");
    },
    (w, h) => { // Molekül altıgenleri
      const hex = (x, y, s) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } g.closePath(); };
      const pts = [[90, 128], [158, 89], [226, 128], [294, 89], [158, 167]];
      pts.forEach(([x, y], i) => glowStroke(() => hex(x, y, 38), i % 2 ? p.b : p.c, 7));
      for (const [x, y] of pts) glowFill(() => { g.beginPath(); g.arc(x, y - 38, 8, 0, TAU); }, p.t, 14);
      label(zone === 2 ? "B12" : zone === 1 ? "C" : "D3", w - 40, h * 0.55, 92, p.a, "right");
    },
    (w, h) => { // Antikor kalkanı
      const Y = (x, y, s, col) => glowStroke(() => { g.beginPath(); g.moveTo(x, y + s); g.lineTo(x, y); g.lineTo(x - s * 0.75, y - s * 0.75); g.moveTo(x, y); g.lineTo(x + s * 0.75, y - s * 0.75); }, col, 11);
      Y(110, 150, 70, p.c); Y(230, 120, 46, p.b); Y(330, 170, 34, p.a);
      glowStroke(() => { g.beginPath(); g.moveTo(400, 40); g.lineTo(480, 70); g.lineTo(470, 160); g.lineTo(400, 216); g.lineTo(330, 160); g.lineTo(320, 70); g.closePath(); }, p.t, 6);
      label("+", 400, 128, 90, p.t, "center"); label("BAĞIŞIKLIK", 24, 32, 30, p.t);
    },
    (w, h) => { // Mineral kristali
      const crystal = (x, y, s, col) => { glowFill(() => { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.55, y - s * 0.2); g.lineTo(x + s * 0.4, y + s * 0.8); g.lineTo(x - s * 0.4, y + s * 0.8); g.lineTo(x - s * 0.55, y - s * 0.2); g.closePath(); }, col, 22); g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x, y + s * 0.8); g.moveTo(x - s * 0.55, y - s * 0.2); g.lineTo(x + s * 0.55, y - s * 0.2); g.stroke(); };
      crystal(110, 140, 90, p.c); crystal(220, 160, 60, p.b); crystal(300, 170, 44, p.a);
      label("Fe · Mg", w - 30, h * 0.5, 54, p.t, "right");
    }
  ];
  for (let i = 0; i < MURAL_COUNT; i++) {
    const ox = (i % 2) * CW, oy = Math.floor(i / 2) * CH;
    g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, CW, CH); g.clip();
    const bg = g.createLinearGradient(0, 0, CW, CH); bg.addColorStop(0, p.bg1); bg.addColorStop(1, p.bg2); g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
    g.globalAlpha = 0.12; for (let k = 0; k < CW; k += 16) { g.fillStyle = "#fff"; g.fillRect(k, 0, 1, CH); } for (let k = 0; k < CH; k += 16) g.fillRect(0, k, CW, 1); g.globalAlpha = 1;
    draws[i](CW, CH);
    // neon çerçeve + köşe braketleri
    g.save(); g.shadowColor = p.c; g.shadowBlur = 16; g.strokeStyle = p.c; g.lineWidth = 6; g.strokeRect(8, 8, CW - 16, CH - 16);
    g.strokeStyle = p.t; g.lineWidth = 9; for (const [x, y, sx, sy] of [[8, 8, 1, 1], [CW - 8, 8, -1, 1], [8, CH - 8, 1, -1], [CW - 8, CH - 8, -1, -1]]) { g.beginPath(); g.moveTo(x, y + sy * 34); g.lineTo(x, y); g.lineTo(x + sx * 34, y); g.stroke(); }
    g.restore(); g.restore();
  }
  const t = tex(c, { aniso: 8 }); return t;
}

/* ---------- Vitamin etiketi (disk yüzü) ---------- */
export function vitaminLabel(v) {
  const S = 128, [c, g] = cv(S, S);
  const gr = g.createRadialGradient(S * 0.4, S * 0.35, 4, S / 2, S / 2, S / 2); gr.addColorStop(0, v.rim); gr.addColorStop(0.45, v.c1); gr.addColorStop(1, v.c2);
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 6; g.beginPath(); g.arc(S / 2, S / 2, S * 0.41, 0, TAU); g.stroke();
  g.font = `900 ${v.label.length > 2 ? 40 : 50}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "rgba(0,0,0,.28)"; g.fillText(v.label, S / 2 + 2, S / 2 + 4); g.fillStyle = "#fff"; g.fillText(v.label, S / 2, S / 2 + 2);
  return tex(c);
}

/* ---------- Alçak bariyer: uyarı şeritleri ---------- */
export function hazardTexture() {
  const [c, g] = cv(256, 64);
  g.fillStyle = "#1b1b1f"; g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#ffcf33"; for (let x = -64; x < 300; x += 40) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 20, 64); g.lineTo(x + 52, 0); g.lineTo(x + 32, 0); g.closePath(); g.fill(); }
  g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(0, 4, 256, 5);
  return tex(c, { repeat: true });
}
/* ---------- Kemer zarı: fibrin ağı (emisif) ---------- */
export function membraneTexture() {
  const [c, g] = cv(256, 128), r = rng(5);
  g.fillStyle = "#000"; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#fff"; g.lineCap = "round";
  for (let i = 0; i < 26; i++) { g.globalAlpha = 0.35 + r() * 0.6; g.lineWidth = 1.5 + r() * 3.5; g.beginPath(); g.moveTo(r() * 256, r() * 128); g.bezierCurveTo(r() * 256, r() * 128, r() * 256, r() * 128, r() * 256, r() * 128); g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = "rgba(255,255,255,.9)"; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(r() * 256, r() * 128, 3 + r() * 4, 0, TAU); g.fill(); }
  return tex(c, { srgb: false });
}
/* ---------- Rampa: parlayan yukarı oklar ---------- */
export function rampTexture() {
  const [c, g] = cv(128, 256);
  g.fillStyle = "#000"; g.fillRect(0, 0, 128, 256);
  for (let k = 0; k < 4; k++) { const y = 30 + k * 60; g.strokeStyle = "#fff"; g.globalAlpha = 0.45 + k * 0.17; g.lineWidth = 14; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(22, y + 30); g.lineTo(64, y); g.lineTo(106, y + 30); g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(0, 0, 6, 256); g.fillRect(122, 0, 6, 256);
  return tex(c, { srgb: false });
}
/* ---------- Parıltı (yumuşak radyal) ---------- */
export function glowTexture() {
  const S = 128, [c, g] = cv(S, S), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(255,255,255,.75)"); gr.addColorStop(0.45, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S); return tex(c, { srgb: false });
}
/* ---------- Yumuşak gölge lekesi ---------- */
export function blobTexture() {
  const S = 128, [c, g] = cv(S, S), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(0,0,0,.85)"); gr.addColorStop(0.5, "rgba(0,0,0,.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S); return tex(c, { srgb: false });
}
/* ---------- Bölge geçiş kapısı yazısı ---------- */
export function gateTexture(name, color) {
  const [c, g] = cv(1024, 160);
  g.clearRect(0, 0, 1024, 160);
  g.font = `900 78px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = color; g.shadowBlur = 30; g.fillStyle = "#fff"; g.fillText(name.toLocaleUpperCase("tr-TR"), 512, 84);
  g.shadowBlur = 0; g.fillStyle = color; g.fillRect(140, 140, 744, 6);
  return tex(c);
}
/* ---------- Kapsül pencere paneli (emisif şerit) ---------- */
export function windowTexture() {
  const [c, g] = cv(256, 64);
  g.fillStyle = "#000"; g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 4; i++) { const x = 8 + i * 62; const gr = g.createLinearGradient(0, 8, 0, 56); gr.addColorStop(0, "#fff"); gr.addColorStop(1, "#9a9a9a"); g.fillStyle = gr; g.beginPath(); g.roundRect(x, 10, 50, 44, 12); g.fill(); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x + 8, 18, 6, 30); }
  return tex(c);
}
