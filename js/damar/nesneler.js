/* Engeller, iki katmanlı parkur (Dev Vitamin Kapsülleri + rampalar), toplanabilirler, güçlendiriciler, parçacıklar.
   Engeller:  plaque (kolesterol plağı → zıpla) · gate (toksin kapısı → kay) · virus (→ şerit değiştir; ileride gidip gelir)
   Kapsül:    capsule (üzerine rampadan ya da botlarla zıplayarak çıkılır; ön yüzüne çarpmak oyunu bitirir)
   Toplanabilir: drop (su damlası) · letter (Altın Harf Küresi) · box (Gizemli Biyo-Kapsül)
   Güçlendirici: magnet (Fe mıknatısı) · jet (D3 Jet-Pack) · boots (Magnezyum Zıplama Botları) */
import { LANES } from "./dunya.js";

export const OB = {
  plaque: { hx: 1.0, y0: 0, y1: 0.8, hz: 0.45 },
  gate: { hx: 1.0, y0: 1.3, y1: 2.35, hz: 0.25 },
  virus: { hx: 0.72, y0: 0.22, y1: 1.78, hz: 0.6 }
};
export const CAPSULE = { top: 2.4, r: 1.15, rampLen: 5 };

/* Adil sıra deseni (saf fonksiyon, test edilebilir).
   occupied: kapsüllerin hâlâ kapladığı şeritler (true/false ×3).
   Kurallar: 3 şerit asla birden aşılmaz biçimde kapanmaz; ardışık sıralarda geçilebilir şeritler en fazla 1 şerit uzaktadır;
   kapsül varken kalan şeritlere yalnızca zıplanabilir/kayılabilir engel konur (virüs konmaz). */
export function makeRowPattern(level, rand, prevPass, occupied = [false, false, false]) {
  const occ = occupied.map(Boolean), occN = occ.filter(Boolean).length;
  for (let attempt = 0; attempt < 24; attempt++) {
    const lanes = [null, null, null], capsules = [];
    let moving = null;
    if (!occN && rand() < Math.min(0.42, 0.22 + level * 0.04)) {
      // Kapsül sırası: 1 veya 2 şerit; en az bir şerit boş kalır
      const k = level >= 2 && rand() < 0.45 ? 2 : 1;
      const order = [0, 1, 2].sort(() => rand() - 0.5).slice(0, k);
      order.forEach((l, i) => capsules.push({ lane: l, len: 12 + Math.floor(rand() * 4) * 4, ramp: i === 0 ? rand() < 0.7 : rand() < 0.4 }));
    } else if (!occN && level >= 3 && rand() < Math.min(0.3, 0.1 + level * 0.04)) {
      const a = rand() < 0.5 ? 0 : 1; moving = { from: a, to: a + 1 }; lanes[a] = "virus";
    } else {
      const avail = [0, 1, 2].filter(l => !occ[l]);
      const maxN = Math.min(avail.length - (occN ? 0 : 1), 2);
      const n = maxN <= 0 ? 0 : rand() < (occN ? 0.45 : Math.min(0.62, 0.3 + level * 0.07)) ? (rand() < 0.5 && maxN === 2 ? 2 : 1) : (occN ? 0 : 1);
      avail.sort(() => rand() - 0.5).slice(0, n).forEach(l => {
        const r = rand(), vw = occN ? 0 : level < 2 ? 0.18 : 0.32;
        lanes[l] = r < vw ? "virus" : r < vw + (1 - vw) * 0.55 ? "plaque" : "gate";
      });
    }
    const capL = capsules.map(c => c.lane);
    const blocked = l => occ[l] || capL.includes(l) || lanes[l] === "virus" || (moving && (l === moving.from || l === moving.to));
    const pass = [0, 1, 2].filter(l => !blocked(l));               // eylemle (zıpla/kay) ya da serbest geçilen şeritler
    const free = [0, 1, 2].filter(l => !blocked(l) && !lanes[l]); // hiç engel olmayan şeritler
    if (!pass.length) continue;
    if (prevPass && prevPass.length && !pass.some(f => prevPass.some(q => Math.abs(q - f) <= 1))) continue;
    return { lanes, moving, capsules, pass, free };
  }
  const free = [0, 1, 2].filter(l => !occ[l]);
  return { lanes: [null, null, null], moving: null, capsules: [], pass: free.length ? free : [0, 1, 2], free: free.length ? free : [0, 1, 2] };
}

import { mergeGeos } from "./birlestir.js";
/* Yumuşak radyal parıltı dokusu (additive sprite için, tek sefer üretilir) */
let glowTex = null;
export function glowTexture(THREE) {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,.55)"); g.addColorStop(0.6, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); return glowTex;
}
/* Prosedürel mikrop/toksin organizması: yarı saydam zar, parlayan çekirdek, uçları topuzlu dikenler,
   kıvrımlı dokunaçlar ve toksik hale. Dönüş: { group, core } — core nabız gibi ölçeklenir. */
const micCache = {};
export function buildMicrobe(THREE, { r = 0.55, membrane = 0x65a30d, glow = 0x84cc16, nucleus = 0x7e22ce, tip = 0xd946ef, spikes = 22, tentacles = 5, eyes = false } = {}) {
  const key = [r, membrane, glow, nucleus, tip, spikes, tentacles].join("|");
  const C = micCache[key] || (micCache[key] = (() => {
    const fibDirs = []; const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < spikes; i++) { const y = 1 - (i / (spikes - 1)) * 2, rr = Math.sqrt(1 - y * y), th = ga * i; fibDirs.push(new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr)); }
    const tubes = [];
    for (let i = 0; i < tentacles; i++) {
      const a = (i / tentacles) * Math.PI * 2, pts = [];
      for (let k = 0; k <= 5; k++) { const d = k / 5; pts.push(new THREE.Vector3(Math.cos(a) * r * (0.55 + d * 0.5) + Math.sin(d * 5 + i) * r * 0.18, -r * 0.6 - d * r * 1.5, Math.sin(a) * r * (0.55 + d * 0.5) + Math.cos(d * 4 + i) * r * 0.18)); }
      tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, r * 0.06, 5, false));
    }
    return {
      fibDirs,
      ...(() => {
        const up = new THREE.Vector3(0, 1, 0), stalkGeo = new THREE.CylinderGeometry(r * 0.035, r * 0.06, r * 0.5, 6), tipGeo = new THREE.SphereGeometry(r * 0.1, 6, 4);
        const mS = [], mT = [];
        fibDirs.forEach(p => {
          const q = new THREE.Quaternion().setFromUnitVectors(up, p);
          mS.push({ geo: stalkGeo, matrix: new THREE.Matrix4().compose(p.clone().multiplyScalar(r * 1.18), q, new THREE.Vector3(1, 1, 1)) });
          mT.push({ geo: tipGeo, matrix: new THREE.Matrix4().makeTranslation(p.x * r * 1.45, p.y * r * 1.45, p.z * r * 1.45) });
        });
        return { stalksGeo: mergeGeos(THREE, mS), tipsGeo: mergeGeos(THREE, mT), tenGeo: mergeGeos(THREE, tubes.map(g => ({ geo: g }))) };
      })(),
      memGeo: new THREE.IcosahedronGeometry(r, 3), nucGeo: new THREE.IcosahedronGeometry(r * 0.52, 2),
      memMat: new THREE.MeshStandardMaterial({ color: membrane, emissive: glow, emissiveIntensity: 0.45, transparent: true, opacity: 0.55, roughness: 0.25, metalness: 0.1, depthWrite: false }),
      nucMat: new THREE.MeshStandardMaterial({ color: nucleus, emissive: nucleus, emissiveIntensity: 0.9, roughness: 0.4, flatShading: true }),
      stalkMat: new THREE.MeshStandardMaterial({ color: membrane, emissive: glow, emissiveIntensity: 0.35, roughness: 0.4 }),
      tipMat: new THREE.MeshStandardMaterial({ color: tip, emissive: tip, emissiveIntensity: 1.3, roughness: 0.3 }),
      tenMat: new THREE.MeshStandardMaterial({ color: membrane, emissive: glow, emissiveIntensity: 0.3, transparent: true, opacity: 0.8, roughness: 0.5 }),
      haloMat: new THREE.SpriteMaterial({ map: glowTexture(THREE), color: glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
    };
  })());
  const group = new THREE.Group(), core = new THREE.Group(); group.add(core);
  core.add(new THREE.Mesh(C.nucGeo, C.nucMat));
  core.add(new THREE.Mesh(C.memGeo, C.memMat));
  core.add(new THREE.Mesh(C.stalksGeo, C.stalkMat)); core.add(new THREE.Mesh(C.tipsGeo, C.tipMat));
  group.add(new THREE.Mesh(C.tenGeo, C.tenMat));
  const halo = new THREE.Sprite(C.haloMat); halo.scale.setScalar(r * 4.2); group.add(halo);
  if (eyes) {
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    [-0.32, 0.32].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(r * 0.14, 10, 8), eyeM); e.position.set(x * r, r * 0.2, -r * 0.92); group.add(e); });
  }
  return { group, core };
}

export function createObjects(THREE, scene) {
  const list = [];
  const M = (o) => new THREE.MeshStandardMaterial(o);
  const mats = {
    plaque: M({ color: 0xf59e0b, roughness: 0.7, emissive: 0x7c2d12, emissiveIntensity: 0.25 }),
    plaqueBump: M({ color: 0xfde047, roughness: 0.55, emissive: 0x854d0e, emissiveIntensity: 0.2 }),
    post: M({ color: 0x64748b, roughness: 0.4, metalness: 0.7 }),
    beam: M({ color: 0x7c3aed, roughness: 0.35, metalness: 0.5, emissive: 0x4c1d95, emissiveIntensity: 0.7 }),
    stripe: M({ color: 0x0f172a, roughness: 0.5 }),
    drip: M({ color: 0xa855f7, emissive: 0x7e22ce, emissiveIntensity: 0.8 }),
    virus: M({ color: 0xdc2626, roughness: 0.45, emissive: 0x7f1d1d, emissiveIntensity: 0.55 }),
    spike: M({ color: 0x111827, roughness: 0.4, metalness: 0.4 }),
    drop: M({ color: 0x67e8f9, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.92 }),
    red: M({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.3 }),
    silver: M({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 }),
    gold: M({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.5 }),
    purple: M({ color: 0xa855f7, emissive: 0x7e22ce, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.4 }),
    ramp: M({ color: 0x0f766e, emissive: 0x0d9488, emissiveIntensity: 0.45, roughness: 0.5, metalness: 0.3 }),
    rampLine: M({ color: 0x5eead4, emissive: 0x2dd4bf, emissiveIntensity: 1.2 }),
    capA: [M({ color: 0xf97316, roughness: 0.25, metalness: 0.15, emissive: 0x7c2d12, emissiveIntensity: 0.25 }), M({ color: 0xef4444, roughness: 0.25, metalness: 0.15, emissive: 0x7f1d1d, emissiveIntensity: 0.25 }), M({ color: 0xeab308, roughness: 0.25, metalness: 0.15, emissive: 0x713f12, emissiveIntensity: 0.25 }), M({ color: 0x10b981, roughness: 0.25, metalness: 0.15, emissive: 0x064e3b, emissiveIntensity: 0.25 })],
    capB: M({ color: 0xf8fafc, roughness: 0.25, metalness: 0.1 }),
    capBand: M({ color: 0x0f172a, roughness: 0.4 }),
    roofGlow: M({ color: 0x99f6e4, emissive: 0x2dd4bf, emissiveIntensity: 0.9, transparent: true, opacity: 0.55 }),
    box: M({ color: 0x7c3aed, emissive: 0x6d28d9, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.3 }),
    boxB: M({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.4 }),
    charge: M({ color: 0x5eead4, emissive: 0x14b8a6, emissiveIntensity: 1.4, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9 }),
    chargeCore: M({ color: 0xffffff, emissive: 0xccfbf1, emissiveIntensity: 1.6 }),
    head: new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
    curtain: M({ color: 0x84cc16, emissive: 0x65a30d, emissiveIntensity: 0.7, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
    gateHalo: new THREE.SpriteMaterial({ map: glowTexture(THREE), color: 0xa855f7, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }),
    warn: M({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.2 })
  };
  const G = {
    plaque: new THREE.BoxGeometry(1.95, 0.62, 0.9), bump: new THREE.SphereGeometry(0.28, 12, 8),
    post: new THREE.BoxGeometry(0.16, 2.4, 0.3), beam: new THREE.BoxGeometry(2.2, 1.0, 0.42), stripe: new THREE.BoxGeometry(0.22, 1.02, 0.44), drip: new THREE.ConeGeometry(0.08, 0.3, 8),
    virus: new THREE.IcosahedronGeometry(0.62, 1), spike: new THREE.ConeGeometry(0.09, 0.42, 6),
    drop: (() => { const pts = []; for (let i = 0; i <= 8; i++) { const th = -Math.PI / 2 + (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(0.2 * Math.cos(th), 0.2 * Math.sin(th))); } for (let i = 1; i <= 8; i++) { const k = i / 8; pts.push(new THREE.Vector2(Math.max(0.001, 0.2 * Math.pow(1 - k, 1.4)), k * 0.34)); } return new THREE.LatheGeometry(pts, 16); })(),
    magnet: new THREE.TorusGeometry(0.34, 0.12, 10, 20, Math.PI), tip: new THREE.CylinderGeometry(0.12, 0.12, 0.16, 12),
    jet: new THREE.CylinderGeometry(0.14, 0.17, 0.62, 14), flame: new THREE.ConeGeometry(0.12, 0.34, 10),
    boot: new THREE.BoxGeometry(0.26, 0.2, 0.46), spring: new THREE.TorusGeometry(0.1, 0.035, 6, 14),
    orb: new THREE.SphereGeometry(0.42, 22, 16), ring: new THREE.TorusGeometry(0.55, 0.045, 8, 32),
    box: new THREE.CapsuleGeometry(0.32, 0.42, 6, 14), boxRing: new THREE.TorusGeometry(0.36, 0.06, 8, 24),
    charge: new THREE.CapsuleGeometry(0.17, 0.34, 6, 12), chargeCore: new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), chargeRing: new THREE.TorusGeometry(0.32, 0.03, 6, 24),
    head: new THREE.CircleGeometry(0.26, 16), curtain: new THREE.PlaneGeometry(1.9, 0.75, 8, 3), auraRing: new THREE.TorusGeometry(0.62, 0.018, 6, 40), auraRing2: new THREE.TorusGeometry(0.5, 0.014, 6, 36), warn: new THREE.BoxGeometry(1.7, 0.16, 0.06)
  };
  const fib = (n) => { const out = []; const g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i; out.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r)); } return out; };
  const SPIKES = fib(18);
  const letterTex = {};
  function letterTexture(ch) {
    if (letterTex[ch]) return letterTex[ch];
    const big = ch.length > 1;
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(48, 44, 8, 64, 64, 64); if (big) { g.addColorStop(0, "#f5d0fe"); g.addColorStop(0.5, "#a855f7"); g.addColorStop(1, "#581c87"); } else { g.addColorStop(0, "#fff7cc"); g.addColorStop(0.5, "#facc15"); g.addColorStop(1, "#a16207"); }
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.font = (big ? "900 60px" : "900 78px") + " system-ui,-apple-system,'Segoe UI',sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.lineWidth = 8; x.strokeStyle = "#713f12"; x.strokeText(ch, 64, 70); x.fillStyle = "#ffffff"; x.fillText(ch, 64, 70);
    const t = new THREE.CanvasTexture(c); letterTex[ch] = t; return t;
  }

  function build(type, opts = {}) {
    const g = new THREE.Group();
    const m = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
    if (type === "plaque") {
      m(G.plaque, mats.plaque, 0, 0.31, 0);
      [-0.6, 0, 0.6].forEach((x, i) => m(G.bump, mats.plaqueBump, x, 0.62, (i - 1) * 0.12).scale.set(1.3, 0.75, 1.1));
    } else if (type === "gate") {
      m(G.post, mats.post, -1.02, 1.2, 0); m(G.post, mats.post, 1.02, 1.2, 0); m(G.beam, mats.beam, 0, 1.85, 0);
      [-0.66, 0, 0.66].forEach(x => m(G.stripe, mats.stripe, x, 1.85, 0).rotation.z = 0.5);
      [-0.7, -0.2, 0.35, 0.8].forEach((x, i) => { const d = m(G.drip, mats.drip, x, 1.22 - (i % 2) * 0.08, 0.05); d.rotation.x = Math.PI; });
      // Toksik zar perdesi (kirişin altından sarkan yarı saydam yeşil tabaka) + mor hale
      m(G.curtain, mats.curtain, 0, 1.5, 0.02);
      const hl = new THREE.Sprite(mats.gateHalo); hl.position.set(0, 1.85, 0.1); hl.scale.set(3.2, 1.6, 1); g.add(hl);
    } else if (type === "virus") {
      // Prosedürel mikrop: children[0] = gövde grubu (döner), userData.core nabız gibi ölçeklenir
      const mic = buildMicrobe(THREE, { r: 0.52 });
      mic.group.position.y = 1.0; g.add(mic.group); g.userData.core = mic.core;
    } else if (type === "capsule") {
      // Dev Vitamin Kapsülü: iki renkli yatık kapsül (+ isteğe bağlı rampa). Gövde z ekseninde, uzunluk = len
      const len = opts.len, body = len - 2 * CAPSULE.r, half = body / 2;
      const cm = mats.capA[opts.color % mats.capA.length];
      const front = m(new THREE.CylinderGeometry(CAPSULE.r, CAPSULE.r, half, 24, 1, true), cm, 0, CAPSULE.r + 0.1, half / 2); front.rotation.x = Math.PI / 2;
      const back = m(new THREE.CylinderGeometry(CAPSULE.r, CAPSULE.r, half, 24, 1, true), mats.capB, 0, CAPSULE.r + 0.1, -half / 2); back.rotation.x = Math.PI / 2;
      const capF = m(new THREE.SphereGeometry(CAPSULE.r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), cm, 0, CAPSULE.r + 0.1, half); capF.rotation.x = Math.PI / 2;
      const capR = m(new THREE.SphereGeometry(CAPSULE.r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.capB, 0, CAPSULE.r + 0.1, -half); capR.rotation.x = -Math.PI / 2;
      const band = m(new THREE.CylinderGeometry(CAPSULE.r + 0.03, CAPSULE.r + 0.03, 0.18, 24), mats.capBand, 0, CAPSULE.r + 0.1, 0); band.rotation.x = Math.PI / 2;
      m(new THREE.BoxGeometry(0.5, 0.04, body * 0.92), mats.roofGlow, 0, CAPSULE.top + 0.01, 0);   // çatı koşu şeridi
      if (opts.vz) {
        // Hareketli tren: ön farlar + kırmızı uyarı bandı (karşıdan hızla gelir)
        [-0.5, 0.5].forEach(x => m(G.head, mats.head, x, CAPSULE.r + 0.35, len / 2 + 0.02));
        m(G.warn, mats.warn, 0, CAPSULE.r - 0.35, len / 2 - 0.25);
      }
      if (opts.ramp) {
        const rl = CAPSULE.rampLen, ang = Math.atan2(CAPSULE.top, rl), hyp = Math.hypot(CAPSULE.top, rl);
        const ramp = m(new THREE.BoxGeometry(1.9, 0.14, hyp), mats.ramp, 0, CAPSULE.top / 2, len / 2 + rl / 2 - 0.2);
        ramp.rotation.x = ang;
        [-0.75, 0.75].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, hyp), mats.rampLine); l.position.set(x, 0.1, 0); ramp.add(l); });
      }
    } else if (type === "drop") {
      m(G.drop, mats.drop);
    } else if (type === "magnet") {
      const u = m(G.magnet, mats.red, 0, 0.05, 0); u.rotation.z = Math.PI;
      m(G.tip, mats.silver, -0.34, 0.12, 0); m(G.tip, mats.silver, 0.34, 0.12, 0);
    } else if (type === "jet") {
      m(G.jet, mats.gold, -0.18, 0, 0); m(G.jet, mats.gold, 0.18, 0, 0);
      const f1 = m(G.flame, mats.red, -0.18, -0.45, 0), f2 = m(G.flame, mats.red, 0.18, -0.45, 0); f1.rotation.x = f2.rotation.x = Math.PI;
      m(G.ring, mats.gold).rotation.x = Math.PI / 2;
    } else if (type === "boots") {
      m(G.boot, mats.purple, -0.18, 0.1, 0); m(G.boot, mats.purple, 0.18, 0.1, 0);
      m(G.spring, mats.silver, -0.18, -0.06, 0).rotation.x = Math.PI / 2; m(G.spring, mats.silver, 0.18, -0.06, 0).rotation.x = Math.PI / 2;
      m(G.ring, mats.purple).rotation.x = Math.PI / 2;
    } else if (type === "letter") {
      const mat = new THREE.MeshStandardMaterial({ map: letterTexture(opts.ch), emissive: 0xca8a04, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.35 });
      m(G.orb, mat); m(G.ring, mats.gold).rotation.x = Math.PI / 2;
    } else if (type === "charge") {
      m(G.charge, mats.charge); m(G.chargeCore, mats.chargeCore);
      m(G.chargeRing, mats.charge).rotation.x = Math.PI / 2;
    } else if (type === "x2") {
      const mat = new THREE.MeshStandardMaterial({ map: letterTexture("x2"), emissive: 0x7e22ce, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.35 });
      m(G.orb, mat); m(G.ring, mats.purple).rotation.x = Math.PI / 2;
    } else if (type === "box") {
      const b = m(G.box, mats.box); b.rotation.z = Math.PI / 2;
      m(G.boxRing, mats.boxB).rotation.y = Math.PI / 2;
      m(G.ring, mats.boxB).rotation.x = Math.PI / 2;
    }
    const AURA = { magnet: 0xef4444, jet: 0xfacc15, boots: 0xa855f7, letter: 0xfacc15, charge: 0x2dd4bf, x2: 0xc084fc, box: 0xa855f7 };
    if (AURA[type]) {
      const col = AURA[type], sm = type === "charge" ? 0.75 : 1;
      const halo = new THREE.Sprite(auraSprite(col)); halo.scale.setScalar(1.9 * sm); g.add(halo);
      const r1 = new THREE.Mesh(G.auraRing, auraRingMat(col)), r2 = new THREE.Mesh(G.auraRing2, auraRingMat(col));
      r1.scale.setScalar(sm); r2.scale.setScalar(sm); r1.rotation.x = 1.1; r2.rotation.y = 1.2; g.add(r1); g.add(r2);
      g.userData.rings = [r1, r2];
    }
    return g;
  }
  const auraSprites = {}, auraRings = {};
  function auraSprite(col) { return auraSprites[col] || (auraSprites[col] = new THREE.SpriteMaterial({ map: glowTexture(THREE), color: col, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); }
  function auraRingMat(col) { return auraRings[col] || (auraRings[col] = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); }
  // Havuz: kapsül/harf gibi parametreli nesneler havuzlanmaz
  const pool = {};
  const pooled = t => !["capsule", "letter"].includes(t);
  function take(type, opts) { if (!pooled(type)) return build(type, opts); const p = pool[type] || (pool[type] = []); return p.pop() || build(type, opts); }
  function give(o) {
    scene.remove(o.mesh);
    if (pooled(o.type)) (pool[o.type] || (pool[o.type] = [])).push(o.mesh);
    else o.mesh.traverse(n => { if (n.geometry && !n.isSprite && !Object.values(G).includes(n.geometry)) n.geometry.dispose(); });
  }
  function spawn(type, lane, z, y = 0, extra = {}) {
    const mesh = take(type, extra);
    const o = { type, lane, x: LANES[lane], y, z, mesh, alive: true, t: Math.random() * 6, ...extra };
    mesh.position.set(o.x, y, z); mesh.rotation.set(0, 0, 0); mesh.scale.setScalar(1);
    scene.add(mesh); list.push(o); return o;
  }
  function remove(o) { if (!o.alive) return; o.alive = false; give(o); }
  function clear() { list.splice(0).forEach(o => { if (o.alive) { o.alive = false; give(o); } }); }

  /* Parçacıklar (tek Points) */
  const PMAX = 520, pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), parts = [];
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: glowTexture(THREE), size: 0.3, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false; scene.add(points);
  const tmpC = new THREE.Color();
  function burst(x, y, z, color, n = 16, power = 1) {
    tmpC.set(color);
    for (let i = 0; i < n; i++) {
      if (parts.length >= PMAX) parts.shift();
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = (2 + Math.random() * 5) * power;
      parts.push({ x, y, z, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s + 2, vz: Math.sin(a) * Math.cos(b) * s, life: 0.5 + Math.random() * 0.5, r: tmpC.r, g: tmpC.g, b: tmpC.b });
    }
  }
  function updateParticles(dt, speed) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy -= 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz + speed * 0.6) * dt;
    }
    for (let i = 0; i < PMAX; i++) {
      const p = parts[i];
      if (p) { pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z; const f = Math.min(1, p.life * 2); pCol[i * 3] = p.r * f; pCol[i * 3 + 1] = p.g * f; pCol[i * 3 + 2] = p.b * f; }
      else pPos[i * 3 + 1] = -100;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  }

  /* Bir şeritteki kapsül zemin yüksekliği (oyuncu z=0'da): çatı, rampa eğimi ya da 0.
     Dönüş: { h, cap, onRamp } */
  function groundAt(x) {
    let best = { h: 0, cap: null, onRamp: false };
    for (const o of list) {
      if (o.type !== "capsule" || !o.alive || Math.abs(o.x - x) > 1.05) continue;
      const front = o.z + o.len / 2, back = o.z - o.len / 2;
      if (0 <= front && 0 >= back) { if (CAPSULE.top > best.h) best = { h: CAPSULE.top, cap: o, onRamp: false }; }
      else if (o.ramp && front < 0 && 0 <= front + CAPSULE.rampLen) {
        const h = CAPSULE.top * (front + CAPSULE.rampLen) / CAPSULE.rampLen;
        if (h > best.h) best = { h, cap: o, onRamp: true };
      }
    }
    return best;
  }
  /* Bir şeritte, oyuncu hizasında (z≈0) kapsül gövdesi var mı? (yan sürtme denetimi için) */
  function capsuleBeside(lane) {
    return list.find(o => o.type === "capsule" && o.alive && o.lane === lane && o.z - o.len / 2 <= 0.4 && o.z + o.len / 2 >= -0.4) || null;
  }

  return { list, spawn, remove, clear, burst, updateParticles, groundAt, capsuleBeside };
}
