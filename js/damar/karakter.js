/* Damar Yolu Koşucusu — eklemli low-poly 3D karakter (kasklı baş, gövde, sırt enerji çantası, kollar, bacaklar)
   ve Biyo-Sörf kapsülü. Pozlar her karede hedef açılara yumuşakça (lerp) yaklaşır; yuvarlanma doğrudan sürülür.
   Seviye 1→5: omuz zırhı, diz koruyucu + anten, parlayan kanatçıklar, altın işlemeli efsane takım. */
import * as THREE from "../vendor/three-paket.js";
import { mergeGeometries } from "../vendor/three-paket.js";
import { CHARS, CAPS } from "./ayar.js";

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.62, metalness: 0.08 }, o));
const capsule = (r, len, seg = 6) => new THREE.CapsuleGeometry(r, len, 2, seg);
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; }
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

/* Eklem listesi: hedef pozlar bu anahtarlarla tanımlanır */
const JOINTS = ["hipY", "torX", "torY", "torZ", "headX", "headY", "shLX", "shLZ", "shRX", "shRZ", "elL", "elR", "thL", "thR", "knL", "knR", "thLZ", "thRZ"];

export class Runner {
  constructor() {
    this.root = new THREE.Group();          // dünyadaki konum (x, y) + yatma
    this.roll = pivot(this.root, 0, 0.5, 0); // takla ekseni (gövde merkezi)
    this.body = pivot(this.roll, 0, -0.5, 0);
    this.mat = { suit: std("#222"), armor: std("#eee", { roughness: 0.42, metalness: 0.25 }), acc: std("#14b8a6", { roughness: 0.4, metalness: 0.3 }),
      visor: std("#0d1b24", { emissive: new THREE.Color("#5eead4"), emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.6 }),
      glow: new THREE.MeshStandardMaterial({ color: "#2dd4bf", emissive: new THREE.Color("#2dd4bf"), emissiveIntensity: 2.4, roughness: 0.3 }),
      gold: std("#ffd43b", { roughness: 0.25, metalness: 0.85, emissive: new THREE.Color("#7a5200"), emissiveIntensity: 0.35 }),
      dark: std("#15161a", { roughness: 0.8 }) };
    const M = this.mat;
    this.gear = { 2: [], 3: [], 4: [], 5: [] }; this.crest = { vita: [], demir: [], d3: [], b12: [] };

    // Kalça + gövde
    this.hips = pivot(this.body, 0, 0.92, 0);
    this.hips.add(mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.16, 6), M.suit, 0, -0.02, 0));
    const hipRing = mesh(new THREE.TorusGeometry(0.165, 0.03, 4, 10), M.acc, 0, 0.05, 0); hipRing.rotation.x = Math.PI / 2; this.hips.add(hipRing);
    this.torso = pivot(this.hips, 0, 0.06, 0);
    const chest = mesh(new THREE.CylinderGeometry(0.215, 0.165, 0.46, 6), M.armor, 0, 0.24, 0); chest.scale.z = 0.72; this.torso.add(chest);
    this.torso.add(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.04), M.glow, 0, 0.3, -0.16));          // göğüs enerji çizgisi
    this.torso.add(mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), M.acc, 0, 0.42, -0.13));
    // Sırt enerji çantası
    this.pack = pivot(this.torso, 0, 0.25, 0.2);
    this.pack.add(mesh(new THREE.BoxGeometry(0.34, 0.4, 0.17), M.dark, 0, 0, 0.02));
    this.pack.add(mesh(new THREE.BoxGeometry(0.36, 0.08, 0.19), M.acc, 0, 0.17, 0.02));
    this.pack.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 8), M.glow, 0, -0.01, 0.12));
    this.nozzles = [-0.1, 0.1].map(x => { const n = mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.08, 7), M.dark, x, -0.24, 0.04); this.pack.add(n); return n; });
    // Baş + kask + vizör
    this.head = pivot(this.torso, 0, 0.53, 0);
    this.head.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 6), M.suit, 0, 0.02, 0));
    this.head.add(mesh(new THREE.IcosahedronGeometry(0.15, 1), M.suit, 0, 0.17, 0));
    const helm = mesh(new THREE.SphereGeometry(0.168, 9, 6, 0, TAU, 0, Math.PI * 0.56), M.acc, 0, 0.18, 0.005); this.head.add(helm);
    const visor = mesh(new THREE.CylinderGeometry(0.168, 0.16, 0.08, 14, 1, true, -1.3, 2.6), M.visor, 0, 0.165, 0); visor.rotation.y = Math.PI; this.head.add(visor);
    // Kollar
    const arm = (side) => {
      const sh = pivot(this.torso, side * 0.27, 0.4, 0);
      sh.add(mesh(new THREE.IcosahedronGeometry(0.075, 0), M.suit));
      const up = mesh(capsule(0.06, 0.2), M.suit, 0, -0.14, 0); sh.add(up);
      const el = pivot(sh, 0, -0.27, 0);
      el.add(mesh(capsule(0.055, 0.18), M.armor, 0, -0.11, 0));
      el.add(mesh(new THREE.IcosahedronGeometry(0.07, 0), M.acc, 0, -0.25, 0));
      const pad = mesh(new THREE.SphereGeometry(0.105, 7, 4, 0, TAU, 0, Math.PI / 2), M.acc, 0, 0.02, 0); pad.scale.set(1, 0.8, 1.1); sh.add(pad); this.gear[2].push(pad);
      const band = mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 7), M.glow, 0, -0.17, 0); el.add(band); this.gear[4].push(band);
      return { sh, el };
    };
    const L = arm(-1), R = arm(1); this.shL = L.sh; this.elL = L.el; this.shR = R.sh; this.elR = R.el;
    // Bacaklar
    const leg = (side) => {
      const th = pivot(this.hips, side * 0.11, -0.04, 0);
      th.add(mesh(capsule(0.08, 0.28), M.suit, 0, -0.2, 0));
      const kn = pivot(th, 0, -0.42, 0);
      kn.add(mesh(capsule(0.07, 0.27), M.armor, 0, -0.2, 0));
      kn.add(mesh(new THREE.BoxGeometry(0.15, 0.09, 0.27), M.dark, 0, -0.41, -0.05));
      kn.add(mesh(new THREE.BoxGeometry(0.155, 0.03, 0.2), M.acc, 0, -0.36, -0.03));
      const guard = mesh(new THREE.BoxGeometry(0.13, 0.13, 0.06), M.acc, 0, -0.02, -0.08); kn.add(guard); this.gear[3].push(guard);
      return { th, kn };
    };
    const LL = leg(-1), RL = leg(1); this.thL = LL.th; this.knL = LL.kn; this.thR = RL.th; this.knR = RL.kn;

    // Seviye ekipmanı: anten (3), kanatçıklar (4), altın taç halkası / işlemeler (5)
    const ant = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 4), M.dark, 0.1, 0.38, 0.05); this.head.add(ant); this.gear[3].push(ant);
    const tip = mesh(new THREE.IcosahedronGeometry(0.03, 0), M.glow, 0.1, 0.49, 0.05); this.head.add(tip); this.gear[3].push(tip);
    for (const s of [-1, 1]) { const fin = mesh(new THREE.BoxGeometry(0.04, 0.34, 0.2), M.glow, s * 0.21, 0.04, 0.05); fin.rotation.z = s * 0.25; this.pack.add(fin); this.gear[4].push(fin); }
    const halo = mesh(new THREE.TorusGeometry(0.17, 0.018, 4, 18), M.gold, 0, 0.42, 0); halo.rotation.x = Math.PI / 2; this.head.add(halo); this.gear[5].push(halo);
    for (const s of [-1, 1]) { const tr = mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), M.gold, s * 0.17, 0.24, -0.14); this.torso.add(tr); this.gear[5].push(tr); }
    const belt = mesh(new THREE.TorusGeometry(0.17, 0.022, 4, 12), M.gold, 0, 0.0, 0); belt.rotation.x = Math.PI / 2; this.hips.add(belt); this.gear[5].push(belt);

    // Karaktere özel tepelik (her seviyede görünür; kimlik)
    for (let i = 0; i < 5; i++) { const fin = mesh(new THREE.BoxGeometry(0.035, 0.09 + (i === 2 ? 0.05 : 0), 0.07), M.acc, 0, 0.34, -0.1 + i * 0.065); this.head.add(fin); this.crest.vita.push(fin); }
    const plume = mesh(new THREE.ConeGeometry(0.06, 0.38, 5), M.acc, 0, 0.42, 0.12); plume.rotation.x = 1.1; this.head.add(plume); this.crest.demir.push(plume);
    const guardF = mesh(new THREE.BoxGeometry(0.2, 0.03, 0.04), M.dark, 0, 0.12, -0.16); this.head.add(guardF); this.crest.demir.push(guardF);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI - Math.PI; const ray = mesh(new THREE.ConeGeometry(0.03, 0.15, 4), M.gold, Math.cos(a) * 0.23, 0.2 - Math.sin(a) * 0.23, 0.1); ray.rotation.z = -(a + Math.PI / 2); this.head.add(ray); this.crest.d3.push(ray); }
    for (const s of [-1, 1]) { const a = mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.26, 4), M.dark, s * 0.11, 0.38, 0.02); a.rotation.z = -s * 0.45; this.head.add(a); this.crest.b12.push(a); const t = mesh(new THREE.IcosahedronGeometry(0.038, 0), M.visor, s * 0.17, 0.49, 0.02); this.head.add(t); this.crest.b12.push(t); }

    this.pose = {}; for (const k of JOINTS) this.pose[k] = 0; this.pose.hipY = 0.92;
    this.t = 0; this.rollA = 0; this.key = ""; this.level = 0;
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  /* Görünüm: karakter + seviye */
  setLook(key, level) {
    const c = CHARS[key] || CHARS.vita, M = this.mat;
    M.suit.color.set(c.suit); M.armor.color.set(c.body); M.acc.color.set(level >= 5 ? "#ffd43b" : c.acc);
    M.acc.metalness = level >= 5 ? 0.8 : 0.3; M.acc.emissive.set(level >= 5 ? "#6b4500" : "#000"); M.acc.emissiveIntensity = level >= 5 ? 0.4 : 0;
    M.visor.emissive.set(c.visor); M.visor.emissiveIntensity = 0.55 + level * 0.12;
    M.glow.color.set(c.glow); M.glow.emissive.set(c.glow); M.glow.emissiveIntensity = 1.0 + level * 0.25;
    for (const lv of [2, 3, 4, 5]) for (const m of this.gear[lv]) m.userData.on = level >= lv;
    for (const k in this.crest) for (const m of this.crest[k]) m.userData.on = k === key;
    this.key = key; this.level = level; this.bake();
  }
  /* Çizim çağrısı azaltma: her eklemdeki görünür parçaları malzemeye göre tek ağa birleştir (kaynaklar gizli kalır) */
  bake() {
    if (!this.pivots) {
      this.pivots = [this.hips, this.torso, this.pack, this.head, this.shL, this.elL, this.shR, this.elR, this.thL, this.knL, this.thR, this.knR];
      this.sources = new Set(); for (const pv of this.pivots) for (const c of pv.children) if (c.isMesh) this.sources.add(c);
      this.baked = [];
    }
    for (const m of this.baked) { m.parent.remove(m); m.geometry.dispose(); }
    this.baked = [];
    for (const pv of this.pivots) {
      const byMat = new Map();
      for (const c of pv.children) {
        if (!this.sources.has(c)) continue;
        c.visible = false; if (c.userData.on === false) continue;
        c.updateMatrix(); const g = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()).applyMatrix4(c.matrix);
        for (const a of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(a)) g.deleteAttribute(a);
        if (!byMat.has(c.material)) byMat.set(c.material, []); byMat.get(c.material).push(g);
      }
      for (const [mat, geos] of byMat) { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = true; pv.add(m); this.baked.push(m); for (const g of geos) g.dispose(); }
    }
  }
  nozzleWorld(i, out) { return this.nozzles[i].getWorldPosition(out); }
  /* s: { mode, phase, speed, tilt, rollK (0..1), vy, t, look } */
  update(dt, s) {
    this.t += dt;
    const P = {}, ph = s.phase || 0, sn = Math.sin(ph), cs = Math.cos(ph);
    let rollTarget = 0, rate = 16, rollDirect = false;
    switch (s.mode) {
      case "run": {
        const k = clamp((s.speed - 6) / 20, 0.2, 1);
        Object.assign(P, { hipY: 0.9 + Math.abs(cs) * 0.07, torX: -0.16 - k * 0.12, torY: sn * 0.14, torZ: 0, headX: 0.12 + k * 0.08, headY: -sn * 0.08,
          thL: sn * (0.75 + k * 0.25), thR: -sn * (0.75 + k * 0.25), knL: -(0.2 + 1.35 * Math.max(0, cs)), knR: -(0.2 + 1.35 * Math.max(0, -cs)),
          shLX: -sn * (0.7 + k * 0.3), shRX: sn * (0.7 + k * 0.3), shLZ: -0.12, shRZ: 0.12, elL: 1.25 + Math.max(0, -sn) * 0.3, elR: 1.25 + Math.max(0, sn) * 0.3, thLZ: 0, thRZ: 0 });
        rate = 26; break;
      }
      case "jump": {
        const up = clamp(s.vy / 10, -1, 1);
        Object.assign(P, { hipY: 0.9, torX: -0.22 + up * 0.08, torY: 0, torZ: 0, headX: 0.1, headY: 0, thL: 0.95, thR: -0.25 - up * 0.2, knL: -1.5, knR: -0.7,
          shLX: 2.3 - (1 - up) * 0.5, shRX: 0.6, shLZ: -0.35, shRZ: 0.5, elL: 0.6, elR: 1.1, thLZ: 0, thRZ: 0 });
        rate = 14; break;
      }
      case "fall": {
        Object.assign(P, { hipY: 0.9, torX: -0.05, torY: 0, torZ: 0, headX: 0.25, headY: 0, thL: 0.3, thR: 0.1, knL: -0.5, knR: -0.3,
          shLX: 0.4, shRX: 0.4, shLZ: -1.25, shRZ: 1.25, elL: 0.5, elR: 0.5, thLZ: -0.12, thRZ: 0.12 });
        rate = 10; break;
      }
      case "roll": {
        const u = clamp(s.rollK);
        rollTarget = -TAU * (u < 0.85 ? u / 0.85 : 1); rollDirect = true;
        const curl = Math.sin(Math.min(1, u / 0.85) * Math.PI);
        Object.assign(P, { hipY: 0.9 - curl * 0.18, torX: -0.15 - curl * 0.75, torY: 0, torZ: 0, headX: 0.2 + curl * 0.5, headY: 0, thL: 0.4 + curl * 1.6, thR: 0.35 + curl * 1.6,
          knL: -0.5 - curl * 1.9, knR: -0.5 - curl * 1.9, shLX: 0.5 + curl * 0.9, shRX: 0.5 + curl * 0.9, shLZ: -0.3, shRZ: 0.3, elL: 1.4 + curl * 0.6, elR: 1.4 + curl * 0.6, thLZ: 0, thRZ: 0 });
        rate = 30; break;
      }
      case "jet": {
        const b = Math.sin(this.t * 6) * 0.05;
        Object.assign(P, { hipY: 0.92, torX: -0.15, torY: 0, torZ: 0, headX: 0.3, headY: 0, thL: -0.25 + b, thR: -0.1 - b, knL: -0.6, knR: -0.4,
          shLX: 0.5, shRX: 0.5, shLZ: -0.5, shRZ: 0.5, elL: 1.6, elR: 1.6, thLZ: -0.05, thRZ: 0.05 });
        rollTarget = -0.55; rate = 8; break;
      }
      case "surf": {
        const w = Math.sin(this.t * 3.2) * 0.06;
        Object.assign(P, { hipY: 0.78, torX: -0.12, torY: 0.5, torZ: w, headX: 0.15, headY: -0.45, thL: 0.55, thR: 0.1, knL: -1.0, knR: -0.75,
          shLX: 0.3, shRX: -0.2, shLZ: -1.05 + w, shRZ: 1.0 - w, elL: 0.4, elR: 0.5, thLZ: -0.2, thRZ: 0.2 });
        rate = 10; break;
      }
      case "stumble": {
        const f = Math.sin(this.t * 22);
        Object.assign(P, { hipY: 0.85, torX: 0.25, torY: f * 0.25, torZ: f * 0.15, headX: -0.25, headY: f * 0.3, thL: sn * 0.6, thR: -sn * 0.6, knL: -0.9, knR: -0.9,
          shLX: 2.4 + f * 0.4, shRX: 2.0 - f * 0.4, shLZ: -0.7, shRZ: 0.7, elL: 0.5, elR: 0.5, thLZ: 0, thRZ: 0 });
        rate = 20; break;
      }
      case "dead": {
        Object.assign(P, { hipY: 0.9, torX: 0.4, torY: 0, torZ: 0, headX: -0.4, headY: 0, thL: 0.6, thR: 0.2, knL: -0.4, knR: -0.2,
          shLX: 2.6, shRX: 2.2, shLZ: -1.0, shRZ: 1.0, elL: 0.3, elR: 0.3, thLZ: -0.1, thRZ: 0.1 });
        rollTarget = 1.25; rate = 9; break;
      }
      default: { // idle (menü): nefes alma, etrafa bakınma, hafif sekme
        const br = Math.sin(this.t * 2.1), look = s.look ?? Math.sin(this.t * 0.55) * 0.55;
        Object.assign(P, { hipY: 0.9 + br * 0.012, torX: 0.02 + br * 0.02, torY: look * 0.25, torZ: 0, headX: -0.05 + Math.sin(this.t * 0.9) * 0.05, headY: look * 0.6,
          thL: 0.05, thR: -0.05, knL: -0.12, knR: -0.12, shLX: 0.1 + br * 0.04, shRX: -0.05 - br * 0.04, shLZ: -0.2, shRZ: 0.2, elL: 0.45, elR: 0.35, thLZ: -0.06, thRZ: 0.06 });
        rate = 6;
      }
    }
    const k = clamp(dt * rate);
    for (const j of JOINTS) this.pose[j] = lerp(this.pose[j], P[j] ?? 0, k);
    if (rollDirect) this.rollA = rollTarget; else { if (Math.abs(this.rollA) > Math.PI) this.rollA = (this.rollA % TAU); this.rollA = lerp(this.rollA, rollTarget, clamp(dt * 10)); }
    const p = this.pose;
    this.roll.rotation.x = this.rollA;
    this.hips.position.y = p.hipY;
    this.torso.rotation.set(p.torX, p.torY, p.torZ);
    this.head.rotation.set(p.headX, p.headY, 0);
    this.shL.rotation.set(p.shLX, 0, p.shLZ); this.shR.rotation.set(p.shRX, 0, p.shRZ);
    this.elL.rotation.x = p.elL; this.elR.rotation.x = p.elR;
    this.thL.rotation.set(p.thL, 0, p.thLZ); this.thR.rotation.set(p.thR, 0, p.thRZ);
    this.knL.rotation.x = p.knL; this.knR.rotation.x = p.knR;
    // şerit geçişinde dönüş yönüne yatma (banking) + hafif yön çevirme
    const tilt = s.tilt || 0;
    this.root.rotation.z = lerp(this.root.rotation.z, -tilt * 0.55, clamp(dt * 12));
    this.body.rotation.y = lerp(this.body.rotation.y, -tilt * 0.35 + (s.faceY || 0), clamp(dt * (s.faceRate || 10)));
  }
}

/* Biyo-Sörf kapsülü (hover kapsül); seviye ile kanatçık, iticiler, halkalar, aura */
export class Board {
  constructor() {
    this.root = new THREE.Group();
    this.bodyMat = std("#2dd4bf", { roughness: 0.3, metalness: 0.45 });
    this.trimMat = std("#0f766e", { roughness: 0.4, metalness: 0.5 });
    this.glowMat = new THREE.MeshStandardMaterial({ color: "#2dd4bf", emissive: new THREE.Color("#2dd4bf"), emissiveIntensity: 2.6 });
    const body = mesh(new THREE.CapsuleGeometry(0.26, 1.2, 3, 10), this.bodyMat); body.rotation.x = Math.PI / 2; body.scale.set(1.25, 1, 0.42); this.root.add(body);
    const stripe = mesh(new THREE.BoxGeometry(0.1, 0.03, 1.5), this.glowMat, 0, 0.115, 0); this.root.add(stripe);
    const rim = mesh(new THREE.TorusGeometry(0.33, 0.035, 4, 16), this.trimMat, 0, 0, 0); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 2.6, 1); this.root.add(rim);
    this.gear = { 2: [], 3: [], 4: [], 5: [] };
    for (const s of [-1, 1]) { const f = mesh(new THREE.BoxGeometry(0.04, 0.24, 0.42), this.trimMat, s * 0.3, 0.06, 0.62); f.rotation.z = s * 0.5; this.root.add(f); this.gear[2].push(f); }
    for (const s of [-1, 1]) { const t = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.3, 8), this.glowMat, s * 0.36, -0.02, 0.5); t.rotation.x = Math.PI / 2; this.root.add(t); this.gear[3].push(t); }
    for (const z of [-0.45, 0.45]) { const r = mesh(new THREE.TorusGeometry(0.36, 0.02, 4, 18), this.glowMat, 0, 0, z); this.root.add(r); this.gear[4].push(r); }
    const aura = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 8), new THREE.MeshBasicMaterial({ color: "#2dd4bf", transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.scale.set(1, 0.35, 1.25); this.root.add(aura); this.gear[5].push(aura); this.aura = aura;
    this.root.visible = false;
  }
  setLook(key, level) {
    const c = CAPS[key] || CAPS.nano;
    this.bodyMat.color.set(c.c1); this.trimMat.color.set(c.c2); this.glowMat.color.set(c.c1); this.glowMat.emissive.set(c.c1); this.aura.material.color.set(c.c1);
    for (const lv of [2, 3, 4, 5]) for (const m of this.gear[lv]) m.visible = level >= lv;
  }
}
