/* Engeller, toplanabilirler ve güçlendiriciler + adil sıra üretici + parçacıklar.
   Engeller:  plaque (kolesterol plağı, alçak → zıpla)  ·  gate (toksin kapısı, yüksek → kay)  ·  virus (serbest radikal küresi → şerit değiştir; ileri seviyede iki şerit arasında gidip gelir)
   Toplanabilir: drop (su damlası)  ·  Güçlendirici: shield (C vitamini), magnet (Fe mıknatısı), sun (D3 güneşi) */
import { LANES } from "./dunya.js";

export const OB = {
  plaque: { hx: 1.0, y0: 0, y1: 0.8, hz: 0.45 },
  gate: { hx: 1.0, y0: 1.3, y1: 2.35, hz: 0.25 },
  virus: { hx: 0.72, y0: 0.22, y1: 1.78, hz: 0.6 }
};

/* Adil sıra deseni: 3 şeridin üçü asla aynı anda kapanmaz; önceki sıranın boş şeridinden en fazla 1 şerit
   ötede yeni bir boş şerit bulunur (hızlıyken iki şerit birden atlamak gerekmesin). Hareketli virüs yalnızca
   iki komşu şerit arasında gidip gelir; üçüncü şerit her zaman boştur. Saf fonksiyon (test edilebilir). */
export function makeRowPattern(level, rand, prevFree) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const lanes = [null, null, null];
    let moving = null;
    if (level >= 3 && rand() < Math.min(0.32, 0.12 + level * 0.04)) {
      const a = rand() < 0.5 ? 0 : 1; // 0↔1 veya 1↔2
      moving = { from: a, to: a + 1 };
      lanes[a] = "virus";
    } else {
      const n = rand() < Math.min(0.62, 0.3 + level * 0.07) ? 2 : 1;
      const order = [0, 1, 2].sort(() => rand() - 0.5).slice(0, n);
      order.forEach(l => {
        const r = rand(), vw = level < 2 ? 0.18 : 0.32;
        lanes[l] = r < vw ? "virus" : r < vw + (1 - vw) * 0.55 ? "plaque" : "gate";
      });
    }
    const free = [0, 1, 2].filter(l => !lanes[l] && !(moving && (l === moving.from || l === moving.to)));
    if (!free.length) continue;
    if (prevFree && prevFree.length && !free.some(f => prevFree.some(p => Math.abs(p - f) <= 1))) continue;
    return { lanes, moving, free };
  }
  return { lanes: [null, null, null], moving: null, free: [0, 1, 2] };
}

export function createObjects(THREE, scene) {
  const list = [];
  const mats = {
    plaque: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7, emissive: 0x7c2d12, emissiveIntensity: 0.25 }),
    plaqueBump: new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.55, emissive: 0x854d0e, emissiveIntensity: 0.2 }),
    post: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.7 }),
    beam: new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.35, metalness: 0.5, emissive: 0x4c1d95, emissiveIntensity: 0.7 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }),
    drip: new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x7e22ce, emissiveIntensity: 0.8 }),
    virus: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45, emissive: 0x7f1d1d, emissiveIntensity: 0.55 }),
    spike: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.4 }),
    drop: new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.92 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xfb923c, emissive: 0xea580c, emissiveIntensity: 0.9, roughness: 0.25 }),
    tealRing: new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x0d9488, emissiveIntensity: 0.8 }),
    red: new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.3 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 1.1, roughness: 0.2, metalness: 0.4 })
  };
  // Paylaşılan geometriler
  const G = {
    plaque: new THREE.BoxGeometry(1.95, 0.62, 0.9),
    bump: new THREE.SphereGeometry(0.28, 12, 8),
    post: new THREE.BoxGeometry(0.16, 2.4, 0.3),
    beam: new THREE.BoxGeometry(2.2, 1.0, 0.42),
    stripe: new THREE.BoxGeometry(0.22, 1.02, 0.44),
    drip: new THREE.ConeGeometry(0.08, 0.3, 8),
    virus: new THREE.IcosahedronGeometry(0.62, 1),
    spike: new THREE.ConeGeometry(0.09, 0.42, 6),
    // Damla profili: yuvarlak alt yarım küre + sivrilen üst
    drop: (() => {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const th = -Math.PI / 2 + (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(0.2 * Math.cos(th), 0.2 * Math.sin(th))); }
      for (let i = 1; i <= 8; i++) { const k = i / 8; pts.push(new THREE.Vector2(Math.max(0.001, 0.2 * Math.pow(1 - k, 1.4)), k * 0.34)); }
      return new THREE.LatheGeometry(pts, 16);
    })(),
    orb: new THREE.SphereGeometry(0.4, 18, 14),
    ring: new THREE.TorusGeometry(0.55, 0.05, 8, 28),
    magnet: new THREE.TorusGeometry(0.34, 0.12, 10, 20, Math.PI),
    tip: new THREE.CylinderGeometry(0.12, 0.12, 0.16, 12),
    sun: new THREE.SphereGeometry(0.34, 18, 14),
    ray: new THREE.ConeGeometry(0.07, 0.26, 6)
  };
  const fib = (n) => { const out = []; const g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i; out.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r)); } return out; };
  const SPIKES = fib(18);

  function build(type) {
    const g = new THREE.Group();
    const m = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
    if (type === "plaque") {
      m(G.plaque, mats.plaque, 0, 0.31, 0);
      [-0.6, 0, 0.6].forEach((x, i) => m(G.bump, mats.plaqueBump, x, 0.62, (i - 1) * 0.12).scale.set(1.3, 0.75, 1.1));
    } else if (type === "gate") {
      m(G.post, mats.post, -1.02, 1.2, 0); m(G.post, mats.post, 1.02, 1.2, 0);
      m(G.beam, mats.beam, 0, 1.85, 0);
      [-0.66, 0, 0.66].forEach(x => m(G.stripe, mats.stripe, x, 1.85, 0).rotation.z = 0.5);
      [-0.7, -0.2, 0.35, 0.8].forEach((x, i) => { const d = m(G.drip, mats.drip, x, 1.22 - (i % 2) * 0.08, 0.05); d.rotation.x = Math.PI; });
    } else if (type === "virus") {
      const core = m(G.virus, mats.virus, 0, 1.0, 0);
      SPIKES.forEach(p => { const s = new THREE.Mesh(G.spike, mats.spike); s.position.copy(p).multiplyScalar(0.72); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p); core.add(s); });
    } else if (type === "drop") {
      m(G.drop, mats.drop, 0, 0, 0);
    } else if (type === "shield") {
      m(G.orb, mats.orange); const r = m(G.ring, mats.tealRing); r.rotation.x = Math.PI / 2.4;
    } else if (type === "magnet") {
      const u = m(G.magnet, mats.red, 0, 0.05, 0); u.rotation.z = Math.PI;
      m(G.tip, mats.silver, -0.34, 0.12, 0); m(G.tip, mats.silver, 0.34, 0.12, 0);
    } else if (type === "sun") {
      m(G.sun, mats.gold);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, rr = m(G.ray, mats.gold, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0); rr.rotation.z = a - Math.PI / 2; }
    }
    return g;
  }
  // Basit nesne havuzu (çöp toplayıcıyı yormamak için)
  const pool = {};
  function take(type) { const p = pool[type] || (pool[type] = []); const g = p.pop() || build(type); g.visible = true; scene.add(g); return g; }
  function give(type, g) { scene.remove(g); (pool[type] || (pool[type] = [])).push(g); }

  function spawn(type, lane, z, y = 0, extra = {}) {
    const mesh = take(type), o = { type, lane, x: LANES[lane], y, z, mesh, alive: true, t: Math.random() * 6, ...extra };
    mesh.position.set(o.x, y, z); mesh.rotation.set(0, 0, 0); mesh.scale.setScalar(1);
    list.push(o); return o;
  }
  function remove(o) { o.alive = false; give(o.type, o.mesh); }
  function clear() { list.splice(0).forEach(o => give(o.type, o.mesh)); }

  /* Parçacıklar: tek Points nesnesi */
  const PMAX = 260, pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), parts = [];
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
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
      else { pPos[i * 3 + 1] = -100; }
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  }

  return { list, spawn, remove, clear, burst, updateParticles };
}
