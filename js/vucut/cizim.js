/* Vücut Savunması — Canvas 2D çizimleri (hücreler, mikroplar, mermiler). Saf fonksiyonlar; oyun durumuna dokunmaz.
   Hücreler: organik zar (dalgalanan kenar), çekirdek, yüzey reseptörleri, parıltı. Seviye noktaları, geri tepme, hedefe dönüş.
   Mikroplar: hareketli yüzey proteinleri, vuruş parlaması (beyaz → kırmızı), mini can barı. */
import { UNITS, ENEMIES } from "./veri.js";

const TAU = Math.PI * 2;
/* Dalgalanan organik kenar: R yarıçap, amp genlik, n lob sayısı. reach: {a, k} yönünde uzanan yalancı ayak */
export function blobPath(c, R, n, t, amp, phase = 0, reach = null) {
  const N = 28, pts = [];
  for (let i = 0; i < N; i++) {
    const th = i / N * TAU;
    let r = R * (1 + amp * Math.sin(n * th + t * 1.7 + phase) + amp * 0.5 * Math.sin((n + 2) * th - t * 1.3 + phase * 2));
    if (reach && reach.k > 0) { const d = Math.cos(th - reach.a); if (d > 0) r += R * reach.k * Math.pow(d, 6); }
    pts.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
  c.beginPath();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m0 = mid(pts[N - 1], pts[0]); c.moveTo(m0[0], m0[1]);
  for (let i = 0; i < N; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % N]); c.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
  c.closePath();
}
const hash = (i, k = 1) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
function radial(c, R, stops, ox = -0.3, oy = -0.35) {
  const g = c.createRadialGradient(R * ox, R * oy, R * 0.05, 0, 0, R * 1.05);
  stops.forEach(([o, col]) => g.addColorStop(o, col)); return g;
}

/* ---------------- Bağışıklık hücreleri ---------------- */
/* o: { hp(0-1), flash, aim(rad), recoil(0-1), lvl, reach:{a,k}, prod(0-1) } */
export function drawUnit(c, type, cx, cy, s, t, o = {}) {
  const U = UNITS[type], R = s * 0.3, hp = o.hp == null ? 1 : o.hp, aim = o.aim || 0, rec = o.recoil || 0;
  c.save(); c.translate(cx, cy);
  if (rec) { c.translate(-Math.cos(aim) * rec * s * 0.12, -Math.sin(aim) * rec * s * 0.12); c.scale(1 - rec * 0.08, 1 + rec * 0.06); }
  c.shadowColor = U.glow; c.shadowBlur = s * (0.22 + (o.lvl > 1 ? 0.08 * (o.lvl - 1) : 0));
  if (type === "d3") {                        // Yardımcı T-Hücresi
    blobPath(c, R, 5, t, 0.03, 1);
    c.fillStyle = radial(c, R, [[0, "#ecfdf5"], [0.45, "#34d399"], [1, "#065f46"]]); c.fill();
    c.shadowBlur = 0; c.strokeStyle = "rgba(209,250,229,.75)"; c.lineWidth = Math.max(1, s * 0.018); c.stroke();
    for (let i = 0; i < 14; i++) {         // TCR reseptörleri
      const a = i / 14 * TAU + t * 0.15, w = Math.sin(t * 3 + i) * 0.04;
      const x1 = Math.cos(a) * R * 0.98, y1 = Math.sin(a) * R * 0.98, x2 = Math.cos(a + w) * R * 1.22, y2 = Math.sin(a + w) * R * 1.22;
      c.strokeStyle = "#a7f3d0"; c.lineWidth = Math.max(1, s * 0.016); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.fillStyle = "#fef08a"; c.beginPath(); c.arc(x2, y2, Math.max(1, s * 0.018), 0, TAU); c.fill();
    }
    c.fillStyle = radial(c, R * 0.5, [[0, "#6ee7b7"], [0.6, "#047857"], [1, "#064e3b"]]);
    c.beginPath(); c.arc(-R * 0.08, -R * 0.04, R * 0.5, 0, TAU); c.fill();
    if (o.prod > 0) { c.strokeStyle = "#fde047"; c.shadowColor = "#fde047"; c.shadowBlur = s * 0.15; c.lineWidth = Math.max(2, s * 0.035); c.beginPath(); c.arc(0, 0, R * 1.38, -Math.PI / 2, -Math.PI / 2 + TAU * o.prod); c.stroke(); c.shadowBlur = 0; }
  } else if (type === "c") {                  // Nötrofil
    blobPath(c, R, 6, t * 1.3, 0.05, 2);
    c.fillStyle = radial(c, R, [[0, "#fdf2f8"], [0.5, "#f472b6"], [1, "#9d174d"]]); c.fill();
    c.shadowBlur = 0; c.strokeStyle = "rgba(252,231,243,.7)"; c.lineWidth = Math.max(1, s * 0.016); c.stroke();
    for (let i = 0; i < 16; i++) { const a = hash(i) * TAU, r = Math.sqrt(hash(i, 2)) * R * 0.85; c.fillStyle = i % 3 ? "rgba(253,242,248,.75)" : "rgba(250,204,21,.8)"; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, Math.max(0.8, s * 0.014), 0, TAU); c.fill(); }
    // Çok loblu çekirdek (birbirine bağlı 4 lob)
    const lobes = [[-0.35, -0.2], [-0.05, -0.32], [0.1, 0.02], [-0.2, 0.28]];
    c.strokeStyle = "#581c87"; c.lineWidth = R * 0.12; c.lineCap = "round"; c.beginPath(); lobes.forEach((p, i) => i ? c.lineTo(p[0] * R, p[1] * R) : c.moveTo(p[0] * R, p[1] * R)); c.stroke();
    lobes.forEach((p, i) => { c.fillStyle = radial(c, R * 0.2, [[0, "#d8b4fe"], [1, "#6b21a8"]]); c.beginPath(); c.arc(p[0] * R, p[1] * R, R * (0.2 + (i % 2) * 0.03), 0, TAU); c.fill(); });
    // Hedefe dönen atış ucu
    c.save(); c.rotate(aim); c.shadowColor = "#f9a8d4"; c.shadowBlur = s * 0.2;
    c.fillStyle = "#fbcfe8"; c.beginPath(); c.ellipse(R * 0.92, 0, R * 0.26, R * 0.16, 0, 0, TAU); c.fill();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(R * 1.08, 0, R * 0.08 + rec * R * 0.08, 0, TAU); c.fill(); c.restore();
  } else if (type === "mg") {                 // Makrofaj
    const RR = R * 1.12;
    blobPath(c, RR, 5, t * 0.9, 0.11, 0.5, o.reach);
    c.fillStyle = radial(c, RR, [[0, "#f5f3ff"], [0.45, "#a78bfa"], [1, "#4c1d95"]]); c.fill();
    c.shadowBlur = 0; c.strokeStyle = "rgba(237,233,254,.7)"; c.lineWidth = Math.max(1, s * 0.018); c.stroke();
    [[0.35, -0.3, 0.16], [-0.38, 0.32, 0.12], [0.3, 0.35, 0.1], [-0.1, -0.45, 0.08]].forEach(([x, y, r]) => { c.fillStyle = "rgba(237,233,254,.32)"; c.beginPath(); c.arc(x * RR, y * RR, r * RR, 0, TAU); c.fill(); c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1; c.stroke(); });
    c.fillStyle = radial(c, RR * 0.4, [[0, "#c4b5fd"], [1, "#3b0764"]]); c.beginPath(); c.ellipse(-RR * 0.12, 0, RR * 0.34, RR * 0.22, 0.5, 0, TAU); c.fill();
    if (hp < 0.7) { c.fillStyle = "rgba(30,10,50,.45)"; [[0.2, 0.1], [-0.3, -0.2], [0.05, 0.4]].slice(0, hp < 0.4 ? 3 : 1).forEach(([x, y]) => { c.beginPath(); c.arc(x * RR, y * RR, RR * 0.14, 0, TAU); c.fill(); }); }
    if (hp < 0.4) c.globalAlpha = 0.85;
  } else if (type === "zn") {                 // B-Hücresi
    blobPath(c, R, 4, t, 0.025, 3);
    c.fillStyle = radial(c, R, [[0, "#f0f9ff"], [0.5, "#38bdf8"], [1, "#075985"]]); c.fill();
    c.shadowBlur = 0; c.strokeStyle = "rgba(224,242,254,.8)"; c.lineWidth = Math.max(1, s * 0.016); c.stroke();
    c.strokeStyle = "#e0f2fe"; c.lineWidth = Math.max(1, s * 0.016); c.lineCap = "round";
    for (let i = 0; i < 10; i++) {           // Y-şekilli BCR reseptörleri
      const a = i / 10 * TAU - t * 0.1;
      c.save(); c.rotate(a); c.translate(R * 0.98, 0);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(R * 0.16, 0); c.moveTo(R * 0.16, 0); c.lineTo(R * 0.27, -R * 0.09); c.moveTo(R * 0.16, 0); c.lineTo(R * 0.27, R * 0.09); c.stroke(); c.restore();
    }
    c.fillStyle = radial(c, R * 0.55, [[0, "#7dd3fc"], [0.6, "#0369a1"], [1, "#0c4a6e"]]); c.beginPath(); c.arc(-R * 0.06, 0, R * 0.55, 0, TAU); c.fill();
    c.save(); c.rotate(aim); c.translate(R * 1.05 + rec * R * 0.2, 0); c.shadowColor = "#67e8f9"; c.shadowBlur = s * 0.2; drawY(c, R * 0.42, "#cffafe"); c.restore();
  } else if (type === "b12") {                // NK Hücresi
    c.save(); c.rotate(t * 1.4); c.shadowColor = "#fbbf24"; c.shadowBlur = s * 0.25;
    c.strokeStyle = "#fde047"; c.lineWidth = Math.max(2, s * 0.04); c.setLineDash([R * 0.5, R * 0.25]);
    c.beginPath(); c.arc(0, 0, R * 1.32, 0, TAU); c.stroke();
    c.rotate(-t * 2.6); c.strokeStyle = "#fb923c"; c.lineWidth = Math.max(1.5, s * 0.025); c.setLineDash([R * 0.2, R * 0.18]);
    c.beginPath(); c.arc(0, 0, R * 1.16, 0, TAU); c.stroke(); c.setLineDash([]); c.restore();
    blobPath(c, R, 6, t, 0.03, 4);
    c.fillStyle = radial(c, R, [[0, "#fffbeb"], [0.45, "#fbbf24"], [1, "#78350f"]]); c.fill();
    c.shadowBlur = 0; c.strokeStyle = "rgba(254,243,199,.8)"; c.lineWidth = Math.max(1, s * 0.016); c.stroke();
    for (let i = 0; i < 10; i++) { const a = hash(i, 3) * TAU, r = Math.sqrt(hash(i, 4)) * R * 0.8; c.fillStyle = "#fde047"; c.shadowColor = "#fde047"; c.shadowBlur = s * 0.06; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, Math.max(1, s * 0.02), 0, TAU); c.fill(); }
    c.shadowBlur = 0; c.fillStyle = radial(c, R * 0.42, [[0, "#fdba74"], [1, "#7c2d12"]]); c.beginPath(); c.arc(-R * 0.05, R * 0.05, R * 0.42, 0, TAU); c.fill();
  }
  // Kısa etiket (çekirdek üstünde)
  c.shadowBlur = 0; c.globalAlpha = Math.min(c.globalAlpha, 0.9); c.fillStyle = "#fff";
  c.font = `900 ${Math.round(s * (U.short.length > 1 ? 0.14 : 0.17))}px system-ui,-apple-system,'Segoe UI',sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(U.short, type === "mg" ? -R * 0.12 : -R * 0.05, type === "c" ? R * 0.02 : 0);
  c.globalAlpha = 1;
  // Seviye noktaları
  if (o.lvl > 1) for (let i = 0; i < o.lvl - 1; i++) { const x = R * 0.75 + i * s * 0.09, y = R * 1.1; c.fillStyle = "#fde047"; c.strokeStyle = "#78350f"; c.lineWidth = 1; star(c, x, y, s * 0.05); c.fill(); c.stroke(); }
  if (o.flash > 0) { c.globalAlpha = Math.min(0.6, o.flash * 6); c.fillStyle = "#fff"; c.beginPath(); c.arc(0, 0, R * 1.15, 0, TAU); c.fill(); c.globalAlpha = 1; }
  c.restore();
}
function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
/* Y-şekilli antikor */
export function drawY(c, size, color) {
  c.strokeStyle = color; c.lineWidth = Math.max(1.5, size * 0.22); c.lineCap = "round";
  c.beginPath(); c.moveTo(-size * 0.5, 0); c.lineTo(size * 0.05, 0); c.moveTo(size * 0.05, 0); c.lineTo(size * 0.5, -size * 0.38); c.moveTo(size * 0.05, 0); c.lineTo(size * 0.5, size * 0.38); c.stroke();
}

/* ---------------- Mikroplar ---------------- */
/* e: { type, anim, flash, slowT, hp, maxHp }, o: { alpha, scale } */
export function drawEnemy(c, e, x, y, s, o = {}) {
  const E = ENEMIES[e.type], R = E.size * s * (o.scale || 1), a = e.anim;
  c.save(); c.translate(x, y); if (o.alpha != null) c.globalAlpha = o.alpha;
  if (e.slowT > 0) { c.save(); c.strokeStyle = "rgba(125,211,252,.9)"; c.lineWidth = 2; c.setLineDash([4, 3]); c.lineDashOffset = -a * 20; c.beginPath(); c.arc(0, 0, R * 1.45, 0, TAU); c.stroke(); c.restore(); }
  if (e.type === "virus") {
    c.save(); c.rotate(a * 0.4);
    for (let i = 0; i < 10; i++) {           // hareketli yüzey proteinleri
      const an = i / 10 * TAU, len = R * (0.32 + 0.14 * Math.sin(a * 5 + i * 1.7));
      const x1 = Math.cos(an) * R * 0.85, y1 = Math.sin(an) * R * 0.85, x2 = Math.cos(an) * (R * 0.9 + len), y2 = Math.sin(an) * (R * 0.9 + len);
      c.strokeStyle = "#a3e635"; c.lineWidth = Math.max(1.2, s * 0.022); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.fillStyle = i % 2 ? "#f472b6" : "#facc15"; c.beginPath(); c.arc(x2, y2, Math.max(1.4, s * 0.03), 0, TAU); c.fill();
    }
    c.shadowColor = "#84cc16"; c.shadowBlur = s * 0.25;
    c.beginPath(); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; c.lineTo(Math.cos(an) * R, Math.sin(an) * R); } c.closePath();
    c.fillStyle = radial(c, R, [[0, "#ecfccb"], [0.5, "#84cc16"], [1, "#365314"]]); c.fill(); c.shadowBlur = 0;
    c.strokeStyle = "rgba(236,252,203,.6)"; c.lineWidth = 1; c.stroke();
    c.strokeStyle = "rgba(54,83,20,.75)"; c.lineWidth = Math.max(1, s * 0.02); c.beginPath();
    for (let i = 0; i <= 16; i++) { const tt = i / 16, rr = R * 0.5 * tt; c.lineTo(Math.cos(tt * 9 + a) * rr, Math.sin(tt * 9 + a) * rr); } c.stroke();
    c.restore();
  } else if (e.type === "stress") {
    c.shadowColor = "#a78bfa"; c.shadowBlur = s * 0.35;
    const blobs = [[-0.5, 0.1, 0.6], [0.1, -0.25, 0.75], [0.6, 0.15, 0.55], [0, 0.3, 0.55]];
    blobs.forEach(([bx, by, br], i) => { c.save(); c.translate(bx * R + Math.sin(a * 2 + i) * R * 0.05, by * R); blobPath(c, br * R, 4, a * 2, 0.08, i); c.fillStyle = radial(c, br * R, [[0, "#ddd6fe"], [0.5, "#7c3aed"], [1, "#1e1b4b"]]); c.fill(); c.restore(); });
    c.shadowBlur = 0;
    if (Math.sin(a * 9) > 0.2) { c.strokeStyle = "#fde047"; c.shadowColor = "#fde047"; c.shadowBlur = s * 0.2; c.lineWidth = Math.max(1.5, s * 0.03); c.beginPath(); c.moveTo(0, R * 0.2); c.lineTo(-R * 0.25, R * 0.75); c.lineTo(R * 0.05, R * 0.7); c.lineTo(-R * 0.15, R * 1.2); c.stroke(); c.shadowBlur = 0; }
  } else if (e.type === "tank") {
    c.strokeStyle = "rgba(252,165,165,.7)"; c.lineWidth = Math.max(1, s * 0.012);
    for (let i = 0; i < 18; i++) { const an = i / 18 * TAU; c.beginPath(); c.moveTo(Math.cos(an) * R * 0.95, Math.sin(an) * R * 0.95); c.quadraticCurveTo(Math.cos(an + 0.15) * R * 1.2, Math.sin(an + 0.15) * R * 1.2 + Math.sin(a * 6 + i) * R * 0.05, Math.cos(an) * R * 1.32, Math.sin(an) * R * 1.32); c.stroke(); }
    c.shadowColor = "#ef4444"; c.shadowBlur = s * 0.3;
    blobPath(c, R, 7, a * 1.5, 0.07, 0);
    c.fillStyle = radial(c, R, [[0, "#fecaca"], [0.35, "#dc2626"], [0.8, "#7f1d1d"], [1, "#450a0a"]]); c.fill(); c.shadowBlur = 0;
    c.fillStyle = "rgba(69,10,10,.6)"; [[-0.35, -0.2], [0.25, 0.25], [0.1, -0.4], [-0.2, 0.4]].forEach(p => { c.beginPath(); c.ellipse(p[0] * R, p[1] * R, R * 0.22, R * 0.15, p[0] * 3, 0, TAU); c.fill(); });
    c.fillStyle = "#fde047"; c.shadowColor = "#fde047"; c.shadowBlur = s * 0.12; [-0.3, 0.05].forEach(ex => { c.beginPath(); c.arc(ex * R, -R * 0.12, R * 0.1, 0, TAU); c.fill(); }); c.shadowBlur = 0;
  } else if (e.type === "swarm") {
    c.save(); c.rotate(Math.sin(a * 2) * 0.4);
    c.strokeStyle = "rgba(251,113,133,.8)"; c.lineWidth = Math.max(1, s * 0.012); c.beginPath();
    for (let i = 0; i <= 10; i++) { const xx = R * (1 + i * 0.22); c.lineTo(xx, Math.sin(a * 14 + i) * R * 0.3); } c.stroke();
    c.shadowColor = "#fb7185"; c.shadowBlur = s * 0.15;
    const w = R * 2.1, h = R * 1.15; c.beginPath(); if (c.roundRect) c.roundRect(-w / 2, -h / 2, w, h, h / 2); else c.rect(-w / 2, -h / 2, w, h);
    const g = c.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, "#ffe4e6"); g.addColorStop(0.5, "#fb7185"); g.addColorStop(1, "#9f1239"); c.fillStyle = g; c.fill(); c.shadowBlur = 0;
    c.fillStyle = "rgba(159,18,57,.6)"; c.beginPath(); c.arc(-w * 0.15, 0, h * 0.18, 0, TAU); c.arc(w * 0.15, 0, h * 0.14, 0, TAU); c.fill();
    c.restore();
  }
  // Vuruş parlaması: önce beyaz, sonra kırmızı
  if (e.flash > 0) {
    const k = Math.min(1, e.flash * 9), white = e.flash > 0.06;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.2);
    g.addColorStop(0, white ? `rgba(255,255,255,${0.85 * k})` : `rgba(248,113,113,${0.7 * k})`); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 1.2, 0, TAU); c.fill();
  }
  // Mini can barı
  if (e.hp < e.maxHp && o.alpha == null) {
    const w = Math.max(s * 0.34, R * 1.9), h = Math.max(3, s * 0.05), yb = -R * 1.6 - h, ratio = Math.max(0, e.hp / e.maxHp);
    c.fillStyle = "rgba(2,6,23,.75)"; c.beginPath(); if (c.roundRect) c.roundRect(-w / 2 - 1, yb - 1, w + 2, h + 2, h); else c.rect(-w / 2 - 1, yb - 1, w + 2, h + 2); c.fill();
    const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
    if (ratio > 0.5) { g.addColorStop(0, "#22c55e"); g.addColorStop(1, "#86efac"); } else if (ratio > 0.25) { g.addColorStop(0, "#f59e0b"); g.addColorStop(1, "#fde047"); } else { g.addColorStop(0, "#dc2626"); g.addColorStop(1, "#f87171"); }
    c.fillStyle = g; c.beginPath(); if (c.roundRect) c.roundRect(-w / 2, yb, w * ratio, h, h / 2); else c.rect(-w / 2, yb, w * ratio, h); c.fill();
  }
  c.restore();
}

/* ---------------- Mermiler ---------------- */
export function drawShot(c, sh, x, y, s, t) {
  c.save(); c.translate(x, y);
  if (sh.kind === "zn") {                     // Y-antikor
    c.rotate(t * 8 + sh.x); c.shadowColor = "#22d3ee"; c.shadowBlur = s * 0.3; drawY(c, s * 0.2, sh.crit ? "#fde047" : "#cffafe");
  } else {                                    // Nötrofil enzim mermisi + iz
    const g = c.createLinearGradient(-s * 0.4, 0, 0, 0); g.addColorStop(0, "rgba(244,114,182,0)"); g.addColorStop(1, "rgba(244,114,182,.7)");
    c.fillStyle = g; c.beginPath(); c.moveTo(-s * 0.4, 0); c.lineTo(0, -s * 0.05); c.lineTo(0, s * 0.05); c.closePath(); c.fill();
    c.shadowColor = sh.crit ? "#fde047" : "#f472b6"; c.shadowBlur = s * 0.28;
    const rg = c.createRadialGradient(-s * 0.02, -s * 0.02, 0, 0, 0, s * 0.09); rg.addColorStop(0, "#fff"); rg.addColorStop(0.5, sh.crit ? "#fde047" : "#fbcfe8"); rg.addColorStop(1, sh.crit ? "#f59e0b" : "#db2777");
    c.fillStyle = rg; c.beginPath(); c.arc(0, 0, s * (sh.crit ? 0.11 : 0.085), 0, TAU); c.fill();
  }
  c.restore();
}
