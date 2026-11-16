/* Damar Yolu Koşucusu — Canvas 2D çizim motoru (sözde-3D perspektif, tamamı vektörel).
   Dünya birimi metredir: x = sağ, y = yukarı, z = oyuncudan ileri. Kamera oyuncunun arkasında ve yukarısındadır.
   Görünüm ekran oranına göre uyarlanır: dikey telefonda yol ekran genişliğini doldurur, geniş masaüstünde
   karakter boyu ekran yüksekliğine göre sınırlanır ve artan alan damar duvarlarına kalır. */
import { LW, LANES, PLAT_H, ZONES, ZONE_LEN, VITAMINS, POWERS, CHARS, CAPS } from "./ayar.js";

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const TR = 8.6, TY = 2.9;            // damar tüneli yarıçapı ve merkez yüksekliği
const HW = LW * 1.5 + 0.35;          // yol yarı genişliği
const FAR = 120;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* Karakter (arkadan görünüm, ayak tabanı orijinde, boy ≈1,7 m). pose: {phase, air, slide, gold} */
export function drawChar(ctx, key, pose = {}) {
  const ch = CHARS[key] || CHARS.vita, ph = pose.phase || 0, air = !!pose.air, slide = !!pose.slide;
  const body = pose.gold ? "#fef9c3" : ch.body, acc = pose.gold ? "#f59e0b" : ch.acc, visor = pose.gold ? "#fde047" : ch.visor;
  ctx.save();
  if (slide) { ctx.scale(1.18, 0.5); }
  const lift = s => air ? 0.22 : Math.max(0, Math.sin(s)) * 0.3;
  const swing = air ? 0.6 : Math.sin(ph);
  // bacaklar
  for (const [sx, l] of [[-0.17, lift(ph)], [0.17, lift(ph + Math.PI)]]) {
    ctx.fillStyle = "#64748b"; rr(ctx, sx - 0.1, -0.74, 0.2, 0.72 - l, 0.09); ctx.fill();
    ctx.fillStyle = acc; rr(ctx, sx - 0.12, -0.14 - l, 0.24, 0.14, 0.06); ctx.fill();
  }
  // kollar
  for (const [sx, sw] of [[-0.41, swing], [0.41, -swing]]) {
    ctx.fillStyle = body; rr(ctx, sx - 0.075, -1.27, 0.15, 0.5 + sw * 0.1, 0.07); ctx.fill();
    ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(sx, -0.76 + sw * 0.1, 0.085, 0, TAU); ctx.fill();
  }
  // gövde + kenar ışığı
  ctx.fillStyle = body; rr(ctx, -0.31, -1.34, 0.62, 0.68, 0.2); ctx.fill();
  ctx.lineWidth = 0.035; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.stroke();
  ctx.fillStyle = acc; rr(ctx, -0.31, -0.76, 0.62, 0.1, 0.05); ctx.fill();
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(-0.33, -1.24, 0.13, 0, TAU); ctx.arc(0.33, -1.24, 0.13, 0, TAU); ctx.fill();
  // sırt tüpü (parlayan)
  ctx.fillStyle = css([255, 255, 255], 0.0); ctx.globalAlpha *= 1;
  ctx.fillStyle = visor; ctx.globalAlpha *= 0.28; ctx.beginPath(); ctx.arc(0, -1.04, 0.3, 0, TAU); ctx.fill(); ctx.globalAlpha /= 0.28;
  ctx.fillStyle = acc; rr(ctx, -0.095, -1.27, 0.19, 0.46, 0.09); ctx.fill();
  ctx.fillStyle = visor; rr(ctx, -0.045, -1.22, 0.09, 0.36, 0.045); ctx.fill();
  // baş
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, -1.52, 0.21, 0, TAU); ctx.fill();
  ctx.lineWidth = 0.035; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.stroke();
  ctx.fillStyle = visor; rr(ctx, -0.21, -1.56, 0.42, 0.075, 0.035); ctx.fill();
  if (key === "demir") { ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(-0.05, -1.7); ctx.lineTo(0, -1.92); ctx.lineTo(0.05, -1.7); ctx.closePath(); ctx.fill(); }
  else if (key === "d3") { ctx.strokeStyle = visor; ctx.lineWidth = 0.045; ctx.lineCap = "round"; for (let i = 0; i < 5; i++) { const a = -Math.PI * (0.2 + i * 0.15); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.26, -1.52 + Math.sin(a) * 0.26); ctx.lineTo(Math.cos(a) * 0.36, -1.52 + Math.sin(a) * 0.36); ctx.stroke(); } }
  else if (key === "b12") { ctx.strokeStyle = visor; ctx.lineWidth = 0.05; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(0.02, -1.72); ctx.lineTo(-0.06, -1.84); ctx.lineTo(0.04, -1.84); ctx.lineTo(-0.03, -1.98); ctx.stroke(); }
  else { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(0, -1.74, 0.045, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export function drawCharIcon(canvas, key) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), n = 72;
  canvas.width = canvas.height = n * dpr;
  const c = canvas.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, n, n);
  c.translate(n / 2, n - 5); c.scale(33, 33); drawChar(c, key, { phase: 0.9 });
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const V = { W: 0, H: 0, dpr: 1, cx: 0, hy: 0, f: 1, sP: 1, camH: 4, camD: 7, camX: 0, lift: 0 };
  const cells = [], lines = [];
  for (let i = 0; i < 30; i++) cells.push({ a: hash(i) * TAU, rf: 0.6 + hash(i + 50) * 0.36, z: hash(i + 90) * 105, r: 0.35 + hash(i + 7) * 0.55, sp: 0.35 + hash(i + 31) * 0.9, bubble: i % 3 === 0, rot: hash(i + 3) * TAU });
  for (let i = 0; i < 30; i++) lines.push({ a: hash(i + 200) * TAU, p: hash(i + 240), len: 0.5 + hash(i + 260) });

  function resize() {
    const W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    V.W = W; V.H = H; V.dpr = dpr;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    V.cx = W / 2;
    V.sP = Math.min(0.92 * W / (HW * 2), 0.225 * H / 1.7);       // oyuncu derinliğinde piksel/metre
    V.f = V.sP * V.camD;
    const tall = W / H < 0.8, py = H * (tall ? 0.71 : 0.78);                  // oyuncunun ayak hizası
    V.camH = clamp((py - H * (tall ? 0.33 : 0.25)) / V.sP, 3.1, 7.4);
    V.hy = py - V.camH * V.sP;                                   // ufuk çizgisi
  }
  const P = (x, y, z) => { const dd = Math.max(0.5, z + V.camD), s = V.f / dd; return { x: V.cx + (x - V.camX) * s, y: V.hy + (V.camH + V.lift - y) * s, s }; };
  const NEAR = () => -V.camD + 0.55;
  function quad(x1, x2, z1, z2, y = 0) {
    const a = P(x1, y, z1), b = P(x2, y, z1), c = P(x2, y, z2), d = P(x1, y, z2);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
  }
  function at(x, y, z) { const p = P(x, y, z); ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.s, p.s); return p.s; }
  const fadeFar = z => clamp((FAR - 2 - z) / 22);
  const fade = z => clamp((FAR - 2 - z) / 22) * clamp((z + 1.6) / 1.1);   // uzakta belirir, kameranın yanından geçerken söner

  function palette(dist) {
    const zi = Math.min(ZONES.length - 1, Math.floor(dist / ZONE_LEN));
    if (zi >= ZONES.length - 1) return { ...ZONES[zi], neuro: 1 };
    const t = clamp((dist - (zi + 1) * ZONE_LEN + 70) / 70), k = t * t * (3 - 2 * t), A = ZONES[zi], B = ZONES[zi + 1], o = { neuro: zi + 1 === 2 ? k : 0 };
    for (const key in A) if (key !== "name") o[key] = mixc(A[key], B[key], k);
    return o;
  }

  function background(G, pal) {
    const { W, H } = V;
    let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, css(pal.top)); g.addColorStop(1, css(pal.bot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const R = Math.max(W, H) * 0.6;
    g = ctx.createRadialGradient(V.cx, V.hy, 0, V.cx, V.hy, R); g.addColorStop(0, css(pal.core, 0.62)); g.addColorStop(0.35, css(pal.core, 0.16)); g.addColorStop(1, css(pal.core, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // boyuna damar kıvrımları
    ctx.lineWidth = 1.5; ctx.strokeStyle = css(pal.ring, 0.1);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + 0.26, x = TR * Math.cos(a), y = TY + TR * Math.sin(a), p0 = P(x, y, FAR), p1 = P(x, y, NEAR() + 0.6);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    // nabızla genişleyen damar halkaları
    const sp = 14, off = sp - (G.dist % sp);
    for (let k = 8; k >= 0; k--) {
      const z = k * sp + off - sp * 0.4, p = P(0, TY, z);
      const beat = Math.exp(-(((G.t * 1.15 - z / 70) % 1 + 1) % 1) * 5);
      const r = TR * p.s * (1 + 0.035 * beat), al = clamp(1 - z / FAR) * (0.3 + 0.35 * beat);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.lineWidth = Math.max(1.5, 0.5 * p.s); ctx.strokeStyle = css(pal.ring, al * 0.35); ctx.stroke();
      ctx.lineWidth = Math.max(1, 0.12 * p.s); ctx.strokeStyle = css(pal.ring, al); ctx.stroke();
    }
    // bölge geçidi
    for (let b = ZONE_LEN; b <= ZONE_LEN * 2; b += ZONE_LEN) {
      const z = b - G.dist; if (z < 1 || z > FAR) continue;
      const p = P(0, TY, z); ctx.beginPath(); ctx.arc(p.x, p.y, TR * p.s * 0.98, 0, TAU);
      ctx.lineWidth = Math.max(2, 0.7 * p.s); ctx.strokeStyle = css(pal.accent, 0.75 * fade(z)); ctx.stroke();
      ctx.lineWidth = Math.max(4, 1.6 * p.s); ctx.strokeStyle = css(pal.accent, 0.18 * fade(z)); ctx.stroke();
    }
    // paralaks: alyuvar silüetleri ve oksijen kabarcıkları (farklı hızlarda)
    for (const c of cells) {
      c.z -= (G.speed * c.sp + 1.5) * G.dt; if (c.z < NEAR() + 0.8) { c.z += 105; c.a = Math.random() * TAU; }
      const x = c.rf * TR * Math.cos(c.a), y = TY + c.rf * TR * Math.sin(c.a) + (c.bubble ? Math.sin(G.t + c.rot) * 0.3 : 0);
      if (Math.abs(x) < HW + 1 && y < 4.4) continue;
      const p = P(x, y, c.z), al = fade(c.z) * clamp((c.z - NEAR()) / 3), r = c.r * p.s;
      if (r < 0.6) continue;
      if (c.bubble) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, TAU); ctx.lineWidth = Math.max(1, r * 0.09); ctx.strokeStyle = `rgba(255,255,255,${0.34 * al})`; ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x - r * 0.16, p.y - r * 0.16, r * 0.1, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${0.5 * al})`; ctx.fill();
      } else {
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.62, c.rot + G.t * 0.2 * c.sp, 0, TAU); ctx.fillStyle = css(pal.cell, 0.42 * al); ctx.fill();
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.5, r * 0.26, c.rot + G.t * 0.2 * c.sp, 0, TAU); ctx.fillStyle = css(pal.top, 0.35 * al); ctx.fill();
      }
    }
  }

  function road(G, pal) {
    const zN = NEAR();
    quad(-HW, HW, zN, FAR); ctx.fillStyle = css(pal.road); ctx.fill();
    const bp = 8, bo = bp - (G.dist % bp);
    ctx.fillStyle = css(pal.road2);
    for (let k = -1; k < 15; k++) { const z0 = Math.max(zN, k * bp + bo), z1 = k * bp + bo + 4; if (z1 <= zN) continue; quad(-HW, HW, z0, z1); ctx.fill(); }
    // uzak sis
    const pf = P(0, 0, FAR), pm = P(0, 0, 55), g = ctx.createLinearGradient(0, pf.y, 0, pm.y);
    g.addColorStop(0, css(pal.core, 0.5)); g.addColorStop(1, css(pal.core, 0));
    quad(-HW, HW, 55, FAR); ctx.fillStyle = g; ctx.fill();
    // şerit çizgileri
    const dp = 6, d0 = dp - (G.dist % dp);
    for (const x of [-LW / 2, LW / 2]) for (let k = -1; k < 19; k++) {
      const z0 = Math.max(zN, k * dp + d0), z1 = k * dp + d0 + 2.6; if (z1 <= zN) continue;
      quad(x - 0.055, x + 0.055, z0, z1); ctx.fillStyle = css(pal.line, 0.5 * fadeFar(z0)); ctx.fill();
    }
    // yol kenarı ışıkları
    for (const x of [-HW, HW]) {
      const a = P(x, 0, zN), b = P(x, 0, FAR);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 7; ctx.strokeStyle = css(pal.ring, 0.2); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.strokeStyle = css(pal.accent, 0.9); ctx.stroke();
    }
    // nöro bölgesi: sinaptik kıvılcımlar
    if (pal.neuro > 0.05) {
      const sp = 9, so = sp - (G.dist % sp), base = Math.floor(G.dist / sp);
      for (let k = 0; k < 12; k++) for (const x of [-HW, HW]) {
        const h = hash(base + k + (x > 0 ? 77 : 0) + Math.floor(G.t * 7) * 13); if (h < 0.72) continue;
        const p = P(x, 0.1, k * sp + so), r = Math.max(1.5, 0.16 * p.s);
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, TAU); ctx.fillStyle = `rgba(125,211,252,${0.22 * pal.neuro})`; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fillStyle = `rgba(240,249,255,${0.95 * pal.neuro})`; ctx.fill();
      }
    }
    // hareketli engel uyarısı: şerit üzerinde yanıp sönen bant
    for (const e of G.ents) {
      if (e.t !== "mover" || e.hit) continue;
      const z = e.d - G.dist; if (z < 3 || z > FAR) continue;
      const x = LANES[e.lane], bl = 0.5 + 0.5 * Math.sin(G.t * 14);
      quad(x - 0.98, x + 0.98, Math.max(1, z - 26), z); ctx.fillStyle = `rgba(250,204,21,${0.08 + 0.13 * bl})`; ctx.fill();
      const w = P(x, 0, Math.max(6, z - 26)), sz = Math.max(9, 0.5 * w.s);
      ctx.fillStyle = `rgba(253,224,71,${0.5 + 0.5 * bl})`; ctx.beginPath(); ctx.moveTo(w.x, w.y - sz * 1.5); ctx.lineTo(w.x + sz * 0.9, w.y); ctx.lineTo(w.x - sz * 0.9, w.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#422006"; ctx.fillRect(w.x - sz * 0.09, w.y - sz * 1.05, sz * 0.18, sz * 0.55); ctx.fillRect(w.x - sz * 0.09, w.y - sz * 0.38, sz * 0.18, sz * 0.18);
    }
  }

  /* ---- nesneler ---- */
  function blobs(list, rim, body, hi) {
    ctx.fillStyle = rim; for (const [x, y, r] of list) { ctx.beginPath(); ctx.arc(x, y, r + 0.055, 0, TAU); ctx.fill(); }
    ctx.fillStyle = body; for (const [x, y, r] of list) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = hi; for (const [x, y, r] of list) { ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.28, r * 0.42, 0, TAU); ctx.fill(); }
  }
  const D = {
    low(e, z, G) {
      at(LANES[e.lane], 0, z);
      const path = () => { ctx.beginPath(); ctx.moveTo(-1.02, 0); ctx.bezierCurveTo(-1.08, -0.72, -0.5, -0.98, -0.15, -0.8); ctx.bezierCurveTo(0.1, -1.02, 0.78, -0.92, 1.02, 0); ctx.closePath(); };
      path(); ctx.fillStyle = "#b45309"; ctx.fill(); ctx.lineWidth = 0.07; ctx.strokeStyle = "#fef08a"; ctx.lineJoin = "round"; ctx.stroke();
      ctx.save(); ctx.translate(0, -0.06); ctx.scale(0.8, 0.72); path(); ctx.fillStyle = "#f59e0b"; ctx.fill(); ctx.restore();
      ctx.fillStyle = "#fde68a"; for (const [x, y, r] of [[-0.45, -0.38, 0.17], [0.32, -0.46, 0.21], [-0.05, -0.22, 0.12]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
    arch(e, z, G) {
      at(LANES[e.lane], 0, z);
      ctx.fillStyle = "#3b0764"; ctx.fillRect(-1.04, -2.2, 0.24, 2.2); ctx.fillRect(0.8, -2.2, 0.24, 2.2);
      rr(ctx, -1.08, -2.25, 2.16, 1.18, 0.3); ctx.fillStyle = "#7e22ce"; ctx.fill(); ctx.lineWidth = 0.07; ctx.strokeStyle = "#f0abfc"; ctx.stroke();
      ctx.fillStyle = "#a855f7"; rr(ctx, -0.9, -2.12, 1.8, 0.4, 0.18); ctx.fill();
      ctx.fillStyle = "#7e22ce"; for (const x of [-0.55, 0.05, 0.6]) { ctx.beginPath(); ctx.moveTo(x - 0.16, -1.1); ctx.quadraticCurveTo(x, -0.72 - 0.08 * Math.sin(G.t * 3 + x * 9), x + 0.16, -1.1); ctx.fill(); }
      const bl = 0.45 + 0.55 * Math.abs(Math.sin(G.t * 5)); ctx.strokeStyle = `rgba(250,232,255,${bl})`; ctx.lineWidth = 0.08; ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const y of [-0.62, -0.36]) { ctx.beginPath(); ctx.moveTo(-0.26, y); ctx.lineTo(0, y + 0.2); ctx.lineTo(0.26, y); ctx.stroke(); }
      ctx.restore();
    },
    block(e, z, G) {
      at(LANES[e.lane], 0, z);
      blobs([[-0.56, -0.5, 0.48], [0.56, -0.5, 0.48], [0, -0.78, 0.76], [-0.48, -1.36, 0.52], [0.5, -1.42, 0.5], [0, -1.74, 0.42]], "#fecaca", "#7f1d1d", "#b91c1c");
      ctx.strokeStyle = "rgba(254,226,226,.55)"; ctx.lineWidth = 0.05; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-0.8, -0.3); ctx.quadraticCurveTo(0, -1.2, 0.75, -1.75); ctx.moveTo(0.82, -0.32); ctx.quadraticCurveTo(0.1, -1.0, -0.72, -1.7); ctx.stroke();
      ctx.restore();
    },
    mover(e, z, G) {
      at(LANES[e.lane], 1.05, z);
      ctx.fillStyle = "rgba(250,204,21,.16)"; ctx.beginPath(); ctx.arc(0, 0, 1.45, 0, TAU); ctx.fill();
      const star = (r1, r0) => { ctx.beginPath(); for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + G.t * 2.2, r = i % 2 ? r0 : r1; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); };
      star(1.04, 0.66); ctx.fillStyle = "#fef9c3"; ctx.fill(); star(0.95, 0.6); ctx.fillStyle = "#ca8a04"; ctx.fill();
      ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(0, 0, 0.52, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fffbeb"; ctx.beginPath(); ctx.arc(-0.12, -0.14, 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = "#a3e635"; for (let i = 0; i < 2; i++) { const a = G.t * 6 + i * Math.PI; ctx.beginPath(); ctx.arc(Math.cos(a) * 1.15, Math.sin(a) * 0.4, 0.1, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
    tramp(e, z, G) {
      at(LANES[e.lane], 0, z);
      const pu = 0.5 + 0.5 * Math.sin(G.t * 7);
      ctx.fillStyle = "rgba(94,234,212,.2)"; ctx.beginPath(); ctx.ellipse(0, -0.06, 1.2, 0.42, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#115e59"; ctx.beginPath(); ctx.ellipse(0, -0.06, 0.98, 0.32, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 0.08; ctx.strokeStyle = "#99f6e4"; ctx.stroke();
      ctx.fillStyle = `rgba(190,242,100,${0.7 + 0.3 * pu})`; ctx.beginPath(); ctx.ellipse(0, -0.09, 0.62, 0.19, 0, 0, TAU); ctx.fill();
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 0.09;
      for (let i = 0; i < 3; i++) { const y = -0.5 - i * 0.36 - pu * 0.12; ctx.strokeStyle = `rgba(217,249,157,${0.85 - i * 0.26})`; ctx.beginPath(); ctx.moveTo(-0.28, y); ctx.lineTo(0, y - 0.22); ctx.lineTo(0.28, y); ctx.stroke(); }
      ctx.restore();
    },
    vit(e, z, G) {
      const v = VITAMINS[e.kind], k = e.rare ? 1.35 : 1;
      const s = at(e.x, e.y + Math.sin(G.t * 3 + e.d) * 0.07, z);
      ctx.fillStyle = v.c1; ctx.globalAlpha *= 0.22; ctx.beginPath(); ctx.arc(0, 0, 0.6 * k, 0, TAU); ctx.fill(); ctx.globalAlpha /= 0.22;
      if (e.rare) { ctx.save(); ctx.rotate(G.t * 1.5); ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.05; ctx.setLineDash([0.22, 0.16]); ctx.beginPath(); ctx.arc(0, 0, 0.56, 0, TAU); ctx.stroke(); ctx.restore(); }
      const sx = 0.4 + 0.6 * Math.abs(Math.cos(G.t * 2.4 + e.d * 0.3)); ctx.scale(sx * k, k);
      ctx.fillStyle = v.rim; ctx.beginPath(); ctx.arc(0, 0, 0.41, 0, TAU); ctx.fill();
      ctx.fillStyle = v.c2; ctx.beginPath(); ctx.arc(0, 0, 0.345, 0, TAU); ctx.fill();
      ctx.fillStyle = v.c1; ctx.beginPath(); ctx.arc(-0.05, -0.05, 0.25, 0, TAU); ctx.fill();
      if (s * k > 30 && sx > 0.6) { ctx.scale(0.01, 0.01); ctx.font = "900 25px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "rgba(15,23,42,.85)"; ctx.fillText(v.label, 0, 2); }
      ctx.restore();
    },
    pow(e, z, G) {
      const pw = POWERS[e.kind];
      at(e.x, e.y + Math.sin(G.t * 2.5) * 0.1, z);
      ctx.fillStyle = pw.color; ctx.globalAlpha *= 0.2; ctx.beginPath(); ctx.arc(0, 0, 0.95, 0, TAU); ctx.fill(); ctx.globalAlpha /= 0.2;
      ctx.save(); ctx.rotate(G.t * 2); ctx.strokeStyle = pw.color; ctx.lineWidth = 0.07; ctx.setLineDash([0.4, 0.22]); ctx.beginPath(); ctx.arc(0, 0, 0.68, 0, TAU); ctx.stroke(); ctx.restore();
      ctx.fillStyle = "rgba(15,23,42,.82)"; ctx.beginPath(); ctx.arc(0, 0, 0.52, 0, TAU); ctx.fill(); ctx.lineWidth = 0.06; ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (e.kind === "magnet") {
        ctx.strokeStyle = pw.color; ctx.lineWidth = 0.17; ctx.beginPath(); ctx.moveTo(-0.2, -0.22); ctx.lineTo(-0.2, 0.04); ctx.arc(0, 0.04, 0.2, Math.PI, 0, true); ctx.lineTo(0.2, -0.22); ctx.stroke();
        ctx.strokeStyle = "#fff"; ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(-0.2, -0.3); ctx.lineTo(-0.2, -0.18); ctx.moveTo(0.2, -0.3); ctx.lineTo(0.2, -0.18); ctx.stroke();
      } else if (e.kind === "spring") {
        ctx.strokeStyle = pw.color; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(-0.22, 0.3); for (let i = 0; i < 5; i++) ctx.lineTo(i % 2 ? -0.22 : 0.22, 0.18 - i * 0.12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-0.16, -0.26); ctx.lineTo(0, -0.4); ctx.lineTo(0.16, -0.26); ctx.stroke();
      } else {
        ctx.scale(0.01, 0.01); ctx.font = "900 46px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = pw.color; ctx.fillText("2x", 0, 3);
      }
      ctx.restore();
    }
  };
  function platform(e, G) {
    const zN = NEAR() + 0.3, z0 = Math.max(zN, e.d - G.dist), z1 = Math.min(FAR, e.d + e.len - G.dist); if (z1 <= z0) return;
    const x = LANES[e.lane], a = fadeFar(z0);
    ctx.globalAlpha = a;
    // taşıyıcı fibrin lifleri
    ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(254,243,199,.32)";
    for (let d = Math.ceil(e.d / 7) * 7; d < e.d + e.len; d += 7) { const z = d - G.dist; if (z < z0 || z > z1) continue; for (const sx of [-0.92, 0.92]) { const t = P(x + sx, PLAT_H - 0.3, z), b = P(x + sx * 1.25, 0, z); ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    quad(x - 1.02, x + 1.02, z0, z1, PLAT_H); ctx.fillStyle = "#f6e3a8"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fffbeb"; ctx.stroke();
    ctx.strokeStyle = "rgba(180,83,9,.32)"; ctx.lineWidth = 1.5;
    for (let d = Math.ceil(e.d / 2.5) * 2.5; d < e.d + e.len; d += 2.5) { const z = d - G.dist; if (z < z0 || z > z1) continue; const l = P(x - 1.02, PLAT_H, z), r = P(x + 1.02, PLAT_H, z); ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.stroke(); }
    if (e.d - G.dist >= zN) { // ön yüz
      const l = P(x - 1.02, PLAT_H, z0), r = P(x + 1.02, PLAT_H, z0), h = 0.32 * l.s;
      ctx.fillStyle = "#c9973f"; ctx.fillRect(l.x, l.y, r.x - l.x, h); ctx.strokeStyle = "#fffbeb"; ctx.lineWidth = 1.5; ctx.strokeRect(l.x, l.y, r.x - l.x, h);
    }
    ctx.globalAlpha = 1;
  }
  function ramp(e, G) {
    const zN = NEAR() + 0.3, zs = e.d - G.dist, ze = zs + e.len; if (ze <= zN || zs > FAR) return;
    const x = LANES[e.lane], hAt = z => clamp((z - zs) / e.len) * PLAT_H, z0 = Math.max(zN, zs), z1 = Math.min(FAR, ze);
    const a = P(x - 0.98, hAt(z0), z0), b = P(x + 0.98, hAt(z0), z0), c = P(x + 0.98, hAt(z1), z1), d = P(x - 0.98, hAt(z1), z1);
    ctx.globalAlpha = fadeFar(z0);
    for (const sx of [-0.98, 0.98]) { const g0 = P(x + sx, 0, z0), g1 = P(x + sx, 0, z1), t0 = P(x + sx, hAt(z0), z0), t1 = P(x + sx, hAt(z1), z1); ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t0.x, t0.y); ctx.closePath(); ctx.fillStyle = "rgba(13,148,136,.3)"; ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    ctx.fillStyle = "rgba(45,212,191,.78)"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#ccfbf1"; ctx.stroke();
    ctx.strokeStyle = "rgba(240,253,250,.8)"; ctx.lineWidth = 2; ctx.lineJoin = "round";
    for (let k = 0.5; k < e.len; k += 1.5) { const z = zs + ((k + G.t * 3) % e.len); if (z < z0 || z > z1 - 0.4) continue; const l = P(x - 0.4, hAt(z), z), m = P(x, hAt(z + 0.45), z + 0.45), r = P(x + 0.4, hAt(z), z); ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(m.x, m.y); ctx.lineTo(r.x, r.y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  function player(G) {
    const pl = G.player, ch = CHARS[G.char] || CHARS.vita, gold = G.frenzyT > 0, cap = CAPS[G.cap] || CAPS.nano;
    // enerji izi
    const tr = G.trail;
    if (tr.length > 1) {
      ctx.lineCap = "round";
      for (let i = 1; i < tr.length; i++) {
        const a0 = G.t - tr[i - 1].t, a1 = G.t - tr[i].t; if (a0 > 0.36) continue;
        const p0 = P(tr[i - 1].x, tr[i - 1].y + 0.95, -a0 * 9), p1 = P(tr[i].x, tr[i].y + 0.95, -a1 * 9), al = (1 - a0 / 0.36) * (gold ? 0.6 : 0.38);
        ctx.strokeStyle = gold ? `rgba(253,224,71,${al})` : css([94, 234, 212], al); ctx.lineWidth = Math.max(2, 0.34 * p1.s * (1 - a0 / 0.5));
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
    }
    if (pl.stumbleT > 0 && Math.floor(G.t * 16) % 2) ctx.globalAlpha = 0.45;
    const s = at(pl.x, pl.y, 0);
    ctx.rotate(pl.tilt);
    if (gold) { ctx.fillStyle = "rgba(253,224,71,.2)"; ctx.beginPath(); ctx.arc(0, -0.9, 1.35 + 0.08 * Math.sin(G.t * 18), 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(254,240,138,.24)"; ctx.beginPath(); ctx.arc(0, -0.9, 1.0, 0, TAU); ctx.fill(); }
    if (G.shieldT > 0) { // biyo-sörf kapsülü
      ctx.fillStyle = cap.c1; ctx.globalAlpha *= 0.3; ctx.beginPath(); ctx.ellipse(0, 0.1, 1.05, 0.24, 0, 0, TAU); ctx.fill(); ctx.globalAlpha /= 0.3;
      rr(ctx, -0.82, -0.2, 1.64, 0.24, 0.12); ctx.fillStyle = cap.c2; ctx.fill();
      rr(ctx, -0.82, -0.24, 1.64, 0.2, 0.1); ctx.fillStyle = cap.c1; ctx.fill(); ctx.lineWidth = 0.035; ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.translate(0, -0.22);
    }
    ctx.save(); ctx.scale(pl.sqx, pl.sqy);
    drawChar(ctx, G.char, { phase: pl.phase, air: !pl.ground, slide: pl.slideT > 0, gold });
    ctx.restore();
    if (G.shieldT > 0 && (G.shieldT > 2 || Math.floor(G.t * 10) % 2)) {
      ctx.beginPath(); ctx.ellipse(0, -0.86, 0.92, pl.slideT > 0 ? 0.7 : 1.16, 0, 0, TAU);
      ctx.fillStyle = cap.c1; ctx.globalAlpha *= 0.1; ctx.fill(); ctx.globalAlpha /= 0.1; ctx.lineWidth = 0.05; ctx.strokeStyle = cap.c1; ctx.stroke();
    }
    if (G.powers.magnet > 0) { ctx.strokeStyle = "rgba(248,113,113,.7)"; ctx.lineWidth = 0.05; ctx.setLineDash([0.2, 0.18]); ctx.beginPath(); ctx.arc(0, -0.9, 1.25 + 0.1 * Math.sin(G.t * 9), 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (pl.stumbleT > 0) { ctx.fillStyle = "#fde047"; for (let i = 0; i < 3; i++) { const a = G.t * 7 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * 0.42, -1.95 + Math.sin(a) * 0.12, 0.07, 0, TAU); ctx.fill(); } }
    ctx.restore(); ctx.globalAlpha = 1;
    return s;
  }
  function shadow(G) {
    const pl = G.player, h = pl.y - pl.surf, k = clamp(1 - h / 4.2, 0.3, 1), p = P(pl.x, pl.surf, 0);
    ctx.fillStyle = `rgba(0,0,0,${0.42 * k})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.55 * p.s * k, 0.17 * p.s * k, 0, 0, TAU); ctx.fill();
  }

  function overlays(G, pal) {
    const { W, H } = V;
    for (const q of G.parts) { const p = P(q.x, q.y, q.z), al = clamp(q.life / q.max); ctx.globalAlpha = al; ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, q.r * p.s * (0.5 + 0.5 * al)), 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const q of G.pops) { const p = P(q.x, q.y + (1 - q.life) * 1.2, q.z), al = clamp(q.life * 2); ctx.globalAlpha = al; ctx.font = `900 ${Math.round(clamp(V.sP * 0.36, 13, 26))}px system-ui,sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(15,23,42,.7)"; ctx.strokeText(q.txt, p.x, p.y); ctx.fillStyle = q.c; ctx.fillText(q.txt, p.x, p.y); }
    ctx.globalAlpha = 1;
    // hız çizgileri
    const k = clamp(Math.max((G.speed - 16) / 12, G.frenzyT > 0 ? 1 : 0, G.shieldT > 0 ? 0.6 : 0));
    if (k > 0.02 && G.mode !== "menu") {
      const R = Math.hypot(W, H) / 2; ctx.lineCap = "round"; ctx.lineWidth = 1.6;
      for (const l of lines) {
        const pr = (G.t * (1.2 + k) + l.p) % 1, r0 = R * (0.5 + 0.55 * pr), r1 = r0 + R * 0.13 * l.len, c = Math.cos(l.a), s = Math.sin(l.a);
        ctx.strokeStyle = `rgba(255,255,255,${0.3 * k * (1 - pr)})`; ctx.beginPath(); ctx.moveTo(V.cx + c * r0, V.hy + s * r0); ctx.lineTo(V.cx + c * r1, V.hy + s * r1); ctx.stroke();
      }
    }
    // toksin / pıhtı dalgası (ekranın alt kenarı)
    if (G.threat > 0.01) {
      const h = H * 0.13 * G.threat, wave = (x, o, amp) => H - h * o - Math.sin(x * 0.021 + G.t * 3.1) * amp - Math.sin(x * 0.047 - G.t * 2.3) * amp * 0.6;
      const layer = (o, amp, fill) => { ctx.beginPath(); ctx.moveTo(0, H + 2); for (let x = 0; x <= W + 16; x += 16) ctx.lineTo(x, wave(x, o, amp)); ctx.lineTo(W, H + 2); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
      layer(1.25, 11, "rgba(190,24,93,.38)"); layer(1, 8, "rgba(46,6,54,.95)");
      ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(240,171,252,.85)"; ctx.beginPath(); for (let x = 0; x <= W + 16; x += 16) ctx.lineTo(x, wave(x, 1, 8)); ctx.stroke();
      for (let i = 0; i < 7; i++) { const x = (hash(i + 5) * W + G.t * 30 * (i % 2 ? 1 : -1) + W * 4) % W, y = H - h * (0.25 + 0.5 * hash(i + 11)), r = 3 + 6 * hash(i + 2); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = "rgba(232,121,249,.4)"; ctx.fill(); }
    }
    // kenar karartma (tehditte kızıl)
    const tc = G.threat > 0 ? [90 * G.threat * (0.6 + 0.4 * Math.sin(G.t * 8)), 0, 20] : [0, 0, 0];
    const g = ctx.createRadialGradient(V.cx, H * 0.5, Math.min(W, H) * 0.42, V.cx, H * 0.5, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, css(tc, 0)); g.addColorStop(1, css(tc, 0.5)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (G.flash > 0.01) { ctx.fillStyle = G.flashC.replace("A", String(clamp(G.flash) * 0.55)); ctx.fillRect(0, 0, W, H); }
  }

  function draw(G) {
    const pl = G.player;
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    V.camX = lerp(V.camX, pl.x * 0.55, clamp(G.dt * 8));
    V.lift = lerp(V.lift, pl.surf * 0.9 + Math.max(0, pl.y - pl.surf - 1.6) * 0.45, clamp(G.dt * 5));   // kamera köprüye çıkan oyuncuyu izler
    const pal = palette(G.dist);
    if (G.shake > 0.01) ctx.translate((Math.random() - 0.5) * G.shake * 14, (Math.random() - 0.5) * G.shake * 14);
    background(G, pal); road(G, pal);
    // boyama sırası: zemin nesneleri (uzaktan yakına) → rampalar/köprüler → üst kat
    const zN = NEAR() + 0.2, low = [], hi = [], surf = [];
    for (const e of G.ents) {
      if (e.got || e.smashed) continue;
      if (e.t === "plat" || e.t === "ramp") { surf.push(e); continue; }
      const z = e.d - G.dist; if (z < Math.max(zN, -1.6) || z > FAR) continue;
      ((e.y || 0) >= PLAT_H - 0.2 ? hi : low).push(e);
    }
    const byZ = (a, b) => b.d - a.d; low.sort(byZ); hi.sort(byZ); surf.sort(byZ);
    const plHigh = pl.surf > 0.05 || pl.y >= PLAT_H - 0.25;
    shadow(G);
    let drawn = false;
    const pass = (list, withPlayer) => {
      for (const e of list) {
        const z = e.d - G.dist;
        if (withPlayer && !drawn && z < 0) { player(G); drawn = true; }
        ctx.globalAlpha = fade(z); D[e.t](e, z, G); ctx.globalAlpha = 1;
      }
      if (withPlayer && !drawn) { player(G); drawn = true; }
    };
    pass(low, !plHigh);
    for (const e of surf) (e.t === "plat" ? platform : ramp)(e, G);
    if (plHigh) shadow(G);
    pass(hi, plHigh);
    overlays(G, pal);
  }

  return { resize, draw, view: V, zoneName: d => ZONES[Math.min(ZONES.length - 1, Math.floor(d / ZONE_LEN))].name };
}
