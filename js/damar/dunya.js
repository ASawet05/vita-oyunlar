/* Damar Yolu Koşucusu — 3D dünya: renderer + bloom + kalite kademeleri, gökyüzü kubbesi, akan yol ve raylar,
   kıvrımlı damar duvarları ve duvar resimleri, duvar ötesindeki low-poly hücreler, oksijen küreleri,
   yolun üstünden geçen damar kemerleri, bölge geçiş kapıları ve bölge paletleri arasında sinematik renk geçişi.
   Tekdüze (z boyunca değişmeyen) parçalar sabit durur, yalnızca dokuları akar; diğer süsler geri dönüşümlüdür. */
import * as THREE from "../vendor/three-paket.js";
import { EffectComposer, RenderPass, UnrealBloomPass, OutputPass, mergeGeometries } from "../vendor/three-paket.js";
import { ZONES, ZONE_LEN, LANES, WALL_X, zoneIndex } from "./ayar.js";
import { roadTextures, wallTextures, muralAtlas, MURAL_COUNT, glowTexture, gateTexture } from "./dokular.js";
import { PointLayer } from "./efekt.js";

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const smooth = t => t * t * (3 - 2 * t);
const rnd = (a, b) => a + Math.random() * (b - a);
const ROAD_LEN = 440, ROAD_Z0 = 150;           // sabit şeritler: z = +150 … −290 (menü kamerası geriye bakar)
const WALL_H = 5.6, WALL_BULGE = 1.0;
export const wallXAt = y => WALL_X + WALL_BULGE * Math.pow(clamp(y / WALL_H), 2);
const BEHIND = 60, AHEAD = 280;                // süs geri dönüşüm penceresi

/* Kalite kademeleri (otomatik düşürülür, cihazda hatırlanır) */
const TIERS = [
  { name: "yüksek", dpr: 2, shadow: 2048, bloom: true, msaa: 4, decor: 1 },
  { name: "orta", dpr: 1.5, shadow: 1024, bloom: true, msaa: 0, decor: 0.85 },
  { name: "düşük", dpr: 1.25, shadow: 0, bloom: false, msaa: 0, decor: 0.7 },
  { name: "en düşük", dpr: 1, shadow: 0, bloom: false, msaa: 0, decor: 0.55 }
];
const QKEY = "vo_damar_q";

/* Bölge paletlerini THREE.Color'a çevir */
const PAL = ZONES.map(z => { const o = {}; for (const k in z) if (typeof z[k] === "string" && z[k][0] === "#") o[k] = new THREE.Color(z[k]); o.cells = z.cells.map(c => new THREE.Color(c)); return o; });
const PAL_KEYS = Object.keys(PAL[0]).filter(k => k !== "cells");

export function createWorld(canvas) {
  const coarse = matchMedia("(pointer: coarse)").matches;
  let tierIdx = (() => { const q = new URLSearchParams(location.search).get("q"); if (q !== null && TIERS[+q]) return +q; try { const s = localStorage.getItem(QKEY); if (s !== null && TIERS[+s]) return +s; } catch (_) {} return coarse ? 1 : 0; })();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAL[0].fog.clone(), 26, 230);
  scene.background = PAL[0].fog.clone();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);

  /* ---------- Işıklar ---------- */
  const hemi = new THREE.HemisphereLight(PAL[0].hemiSky, PAL[0].hemiGround, 0.85); scene.add(hemi);
  const key = new THREE.DirectionalLight(PAL[0].key, 2.9);
  key.castShadow = true; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 34, bottom: -34, near: 1, far: 70 });
  scene.add(key, key.target);

  /* ---------- Gökyüzü kubbesi (damar lümeni) ---------- */
  const skyU = { top: { value: PAL[0].skyTop.clone() }, hor: { value: PAL[0].skyHor.clone() }, sun: { value: PAL[0].sun.clone() }, time: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sun; uniform float time; varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){ float y = vD.y; vec3 c = mix(hor, top, smoothstep(-0.05, 0.55, y)); c = mix(c, hor * 0.55, smoothstep(0.0, -0.4, y));
        float f = max(0.0, dot(vD, normalize(vec3(0.0, 0.06, -1.0)))); c += sun * (pow(f, 70.0) * 0.55 + pow(f, 8.0) * 0.16);
        float pulse = 0.5 + 0.5 * sin(time * 2.4); c += hor * 0.08 * pulse * smoothstep(0.4, 0.0, abs(y));
        c += (h(gl_FragCoord.xy + time) - 0.5) / 255.0; gl_FragColor = vec4(c, 1.0); }`
  }));
  sky.renderOrder = -10; scene.add(sky);

  /* ---------- Yol + ray yatakları (sabit; dokusu akar) ---------- */
  const rt = roadTextures(WALL_X, LANES);
  for (const t of [rt.map, rt.emissive]) { t.repeat.set(1, ROAD_LEN / 8); t.anisotropy = Math.min(8, maxAniso); }
  const roadMat = new THREE.MeshStandardMaterial({ map: rt.map, emissiveMap: rt.emissive, color: PAL[0].road.clone(), emissive: PAL[0].line.clone(), emissiveIntensity: 0.55, roughness: 0.68, metalness: 0.08 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X * 2 + 0.2, ROAD_LEN), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, ROAD_Z0 - ROAD_LEN / 2); road.receiveShadow = true; scene.add(road);
  const railGeo = [], railTop = [];
  for (const lx of LANES) for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.1, 0.12, ROAD_LEN); g.translate(lx + s * 0.6, 0.06, ROAD_Z0 - ROAD_LEN / 2); railGeo.push(g);
    const t = new THREE.BoxGeometry(0.05, 0.02, ROAD_LEN); t.translate(lx + s * 0.6, 0.125, ROAD_Z0 - ROAD_LEN / 2); railTop.push(t);
  }
  const railMat = new THREE.MeshStandardMaterial({ color: "#8d8f99", roughness: 0.3, metalness: 0.85 });
  const railLight = new THREE.MeshStandardMaterial({ color: PAL[0].rail.clone(), emissive: PAL[0].rail.clone(), emissiveIntensity: 0.28 });
  const rails = new THREE.Mesh(mergeGeometries(railGeo), railMat); rails.receiveShadow = true; scene.add(rails);
  scene.add(new THREE.Mesh(mergeGeometries(railTop), railLight));

  /* ---------- Damar duvarları (kıvrımlı profil, çift taraflı) ---------- */
  const wt = wallTextures();
  for (const t of [wt.map, wt.emissive]) { t.repeat.set(ROAD_LEN / 11, 1); t.anisotropy = Math.min(4, maxAniso); }
  const wallMat = new THREE.MeshStandardMaterial({ map: wt.map, emissiveMap: wt.emissive, color: PAL[0].wall.clone(), emissive: PAL[0].wallEm.clone(), emissiveIntensity: 0.55, roughness: 0.78, metalness: 0.05, side: THREE.DoubleSide });
  const lipMat = new THREE.MeshStandardMaterial({ color: PAL[0].wallEm.clone(), emissive: PAL[0].wallEm.clone(), emissiveIntensity: 1.8, roughness: 0.4 });
  const curbMat = new THREE.MeshStandardMaterial({ color: "#1a0a10", roughness: 0.6, metalness: 0.3 });
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(ROAD_LEN, WALL_H, 1, 10), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const zLocal = p.getX(i), y = p.getY(i) + WALL_H / 2; p.setXYZ(i, s * wallXAt(y), y, ROAD_Z0 - ROAD_LEN / 2 - zLocal * s); }
    if (s < 0) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }   // iki duvarda da doku ileri doğru aksın
    g.computeVertexNormals();
    const w = new THREE.Mesh(g, wallMat); w.receiveShadow = true; scene.add(w);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, ROAD_LEN, 8, 1), lipMat); lip.rotation.x = Math.PI / 2; lip.position.set(s * (wallXAt(WALL_H) + 0.05), WALL_H, ROAD_Z0 - ROAD_LEN / 2); scene.add(lip);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, ROAD_LEN), curbMat); curb.position.set(s * (WALL_X - 0.1), 0.17, ROAD_Z0 - ROAD_LEN / 2); scene.add(curb);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, ROAD_LEN), lipMat); strip.position.set(s * (WALL_X - 0.36), 0.36, ROAD_Z0 - ROAD_LEN / 2); scene.add(strip);
  }

  /* ---------- Damarın dışı: organik doku zemini + paralel uzanan komşu damarlar (çatı/jetpack görüşü) ---------- */
  const outMap = wt.map.clone(), outEm = wt.emissive.clone();
  for (const t of [outMap, outEm]) { t.repeat.set(30, ROAD_LEN / 14); t.needsUpdate = true; }
  const outMat = new THREE.MeshStandardMaterial({ map: outMap, emissiveMap: outEm, color: PAL[0].wall.clone().multiplyScalar(0.4), emissive: PAL[0].wallEm.clone(), emissiveIntensity: 0.22, roughness: 0.92 });
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(420, ROAD_LEN), outMat); outside.rotation.x = -Math.PI / 2; outside.position.set(0, -0.3, ROAD_Z0 - ROAD_LEN / 2); scene.add(outside);
  const tubeMap = wt.map.clone(), tubeEm = wt.emissive.clone();
  for (const t of [tubeMap, tubeEm]) { t.repeat.set(3, ROAD_LEN / 12); t.needsUpdate = true; }
  const tubeMat = new THREE.MeshStandardMaterial({ map: tubeMap, emissiveMap: tubeEm, color: PAL[0].wall.clone(), emissive: PAL[0].wallEm.clone(), emissiveIntensity: 0.5, roughness: 0.6, flatShading: true });
  for (const [x, y, r] of [[-15.5, 1.6, 3.2], [-26, 4.2, 2.4], [-40, 2.2, 4.4], [16.5, 2.2, 3.6], [29, 5.4, 2.6], [44, 2.8, 4.6], [-21, 11, 1.4], [23, 13, 1.6]]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, ROAD_LEN, 12, 1, true), tubeMat); tube.rotation.x = -Math.PI / 2; tube.position.set(x, y, ROAD_Z0 - ROAD_LEN / 2); scene.add(tube);
  }

  /* ---------- Geri dönüşümlü süsler ---------- */
  const glowTex = glowTexture();
  const glows = new PointLayer(420, glowTex); scene.add(glows.obj);
  const decor = [];          // { kind, d, x, y, s, rot, spin, zone, ... }
  const inst = {};           // tür → InstancedMesh
  const dummy = new THREE.Object3D();
  function instanced(kind, geo, mat, max, { shadow = false } = {}) {
    const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.frustumCulled = false; m.castShadow = shadow;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); inst[kind] = m; return m;
  }
  // Alyuvar: içbükey disk (lathe)
  const rbcPts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, r = 0.05 + t * 0.95; rbcPts.push(new THREE.Vector2(r, 0.18 + 0.22 * Math.sin(t * Math.PI) - 0.25 * (1 - t) * (1 - t))); }
  rbcPts.push(new THREE.Vector2(1.0, 0)); for (let i = 10; i >= 0; i--) { const p = rbcPts[i]; rbcPts.push(new THREE.Vector2(p.x, -p.y)); }
  const rbcGeo = new THREE.LatheGeometry(rbcPts, 14);
  const cellMat = new THREE.MeshStandardMaterial({ color: "#fff", flatShading: true, roughness: 0.55, metalness: 0.05, emissive: "#3a0010", emissiveIntensity: 0.4 });
  instanced("rbc", rbcGeo, cellMat, 60);
  // Akyuvar / mikrop benzeri dikenli küre
  const spk = [new THREE.IcosahedronGeometry(1, 1)];
  const ico = new THREE.IcosahedronGeometry(1, 0), ip = ico.attributes.position, seen = new Set();
  for (let i = 0; i < ip.count; i++) { const v = new THREE.Vector3(ip.getX(i), ip.getY(i), ip.getZ(i)).normalize(), k = v.toArray().map(n => n.toFixed(2)).join(); if (seen.has(k)) continue; seen.add(k); const c = new THREE.ConeGeometry(0.16, 0.6, 5); c.translate(0, 1.15, 0); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v)); spk.push(c); }
  const spikeGeo = mergeGeometries(spk.map(g => g.index ? g.toNonIndexed() : g));
  instanced("wbc", spikeGeo, new THREE.MeshStandardMaterial({ color: "#f1f3f5", flatShading: true, roughness: 0.5, emissive: "#ffffff", emissiveIntensity: 0.08 }), 14);
  // Nöron: gövde + dendritler (emisif)
  const nParts = [new THREE.IcosahedronGeometry(0.8, 0)];
  for (let i = 0; i < 6; i++) { const c = new THREE.CylinderGeometry(0.06, 0.18, 2.6, 4); c.translate(0, 1.6, 0); c.rotateZ(rnd(-1.2, 1.2) + (i % 2) * Math.PI); c.rotateY(i * 1.1); nParts.push(c); }
  const neuronMat = new THREE.MeshStandardMaterial({ color: "#c7d2fe", flatShading: true, emissive: "#38bdf8", emissiveIntensity: 1.3, roughness: 0.4 });
  instanced("neuron", mergeGeometries(nParts.map(g => g.index ? g.toNonIndexed() : g)), neuronMat, 18);
  // Oksijen küresi
  const orbMat = new THREE.MeshStandardMaterial({ color: "#e6fbff", emissive: "#c7f9ff", emissiveIntensity: 2.2, roughness: 0.2 });
  instanced("orb", new THREE.IcosahedronGeometry(1, 1), orbMat, 40);
  // Damar kemeri / köprüsü (yarım torus) + iç ışık halkası
  const archMat = new THREE.MeshStandardMaterial({ color: PAL[0].wall.clone(), flatShading: true, roughness: 0.6, emissive: PAL[0].wallEm.clone(), emissiveIntensity: 0.25 });
  const archGlow = new THREE.MeshStandardMaterial({ color: PAL[0].wallEm.clone(), emissive: PAL[0].wallEm.clone(), emissiveIntensity: 2.2 });
  instanced("arch", new THREE.TorusGeometry(7.4, 0.55, 7, 28, Math.PI), archMat, 8);
  instanced("archRing", new THREE.TorusGeometry(7.4, 0.12, 4, 40, Math.PI), archGlow, 16);
  // Duvar kaburgaları (duvar profili boyunca halka izleri)
  const ribPts = []; for (let i = 0; i <= 8; i++) { const y = i / 8 * WALL_H; ribPts.push([wallXAt(y) - 0.12, y]); }
  const ribShape = new THREE.BufferGeometry(); { const pos = []; for (let i = 0; i < 8; i++) { const [x0, y0] = ribPts[i], [x1, y1] = ribPts[i + 1]; const w = 0.35; pos.push(x0, y0, -w, x1, y1, -w, x0 - 0.22, y0, 0, x1, y1, -w, x1 - 0.22, y1, 0, x0 - 0.22, y0, 0, x0 - 0.22, y0, 0, x1 - 0.22, y1, 0, x0, y0, w, x1 - 0.22, y1, 0, x1, y1, w, x0, y0, w); } ribShape.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); ribShape.computeVertexNormals(); }
  const ribMat = new THREE.MeshStandardMaterial({ color: PAL[0].wall.clone(), flatShading: true, roughness: 0.7, side: THREE.DoubleSide, emissive: PAL[0].wallEm.clone(), emissiveIntensity: 0.18 });
  instanced("rib", ribShape, ribMat, 80);

  // Duvar resimleri: bölge başına bir atlas; her pano kendi UV'leriyle tek çizim
  const murals = [0, 1, 2].map(z => { const t = muralAtlas(z); t.anisotropy = Math.min(8, maxAniso); return new THREE.MeshBasicMaterial({ map: t, color: "#ffffff" }); });
  const panelGeo = () => new THREE.PlaneGeometry(6, 3);
  const panels = [];
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(panelGeo(), murals[0]); scene.add(m); panels.push({ m, d: 0, side: 1 }); }
  function setPanelUV(m, idx) {
    const col = idx % 2, row = Math.floor(idx / 2), uv = m.geometry.attributes.uv;
    const u0 = col * 0.5, u1 = u0 + 0.5, v1 = 1 - row * 0.25, v0 = v1 - 0.25;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); uv.needsUpdate = true;
  }
  const panelY = 2.55, panelX = wallXAt(panelY) - 0.08, panelTilt = Math.atan2(WALL_BULGE * 2 * panelY / (WALL_H * WALL_H), 1);
  function placePanel(p, d) {
    p.d = d; p.side = Math.random() < 0.5 ? -1 : 1; const z = zoneIndex(d);
    p.m.material = murals[z]; setPanelUV(p.m, Math.floor(Math.random() * MURAL_COUNT));
    p.m.rotation.set(0, -p.side * Math.PI / 2, 0); p.m.rotateX(-panelTilt);
  }

  // Bölge kapısı (her 500 m) — halka + başlık
  const gate = new THREE.Group();
  const gateMat = new THREE.MeshStandardMaterial({ color: "#fff", emissive: "#fff", emissiveIntensity: 2.4 });
  const gateRing = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.28, 6, 48), gateMat); gateRing.position.y = 2.2; gate.add(gateRing);
  const gateRing2 = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.07, 4, 48), gateMat); gateRing2.position.y = 2.2; gate.add(gateRing2);
  const gateTexs = ZONES.map(z => gateTexture(z.name, z.line));
  const gateLabel = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.56), new THREE.MeshBasicMaterial({ map: gateTexs[0], transparent: true, depthWrite: false, fog: false }));
  gateLabel.position.y = 8.4; gate.add(gateLabel); scene.add(gate);
  let gateD = -14, gateZone = 0;

  /* Süs yerleşimi: kind'e göre yeni konum */
  function spawn(o, d) {
    o.d = d; const z = zoneIndex(d), pal = PAL[z];
    switch (o.kind) {
      case "rbc": case "wbc": case "neuron": {
        if (o.kind === "neuron" && z !== 2) { o.hide = true; return; }
        if (o.kind === "wbc" && z === 2) { o.hide = true; return; }
        o.hide = false; const side = Math.random() < 0.5 ? -1 : 1, far = Math.random();
        o.x = side * (WALL_X + 2.5 + far * far * 26); o.y = rnd(-1, 4) + far * 14; o.s = o.kind === "rbc" ? rnd(1.1, 2.6) : o.kind === "wbc" ? rnd(0.9, 1.8) : rnd(0.8, 1.6);
        o.rx = rnd(0, TAU); o.ry = rnd(0, TAU); o.spin = rnd(-0.6, 0.6); o.bob = rnd(0, TAU); o.color = pal.cells[Math.floor(Math.random() * 3)].clone(); break;
      }
      case "orb": { const inside = Math.random() < 0.2; o.x = inside ? rnd(-4, 4) : (Math.random() < 0.5 ? -1 : 1) * rnd(WALL_X + 1.5, 24); o.y = inside ? rnd(12.5, 16) : rnd(3, 16); o.s = rnd(0.18, 0.42); o.bob = rnd(0, TAU); o.hide = false; break; }
      case "arch": o.hide = false; o.tilt = rnd(-0.08, 0.08); break;
      case "rib": o.side = o.side || 1; o.hide = false; break;
    }
  }
  // her süs pencere içinde sabit bir "yuva" (slot) taşır: mesafe sıçradığında (yeni tur) aynı düzende yeniden yerleşir
  const WIN = BEHIND + AHEAD;
  function seedDecor(kind, n, jitter = 0) {
    for (let i = 0; i < n; i++) { const o = { kind, side: i % 2 ? 1 : -1, slot: i * WIN / n + rnd(0, jitter) }; spawn(o, -BEHIND + o.slot); decor.push(o); }
  }
  seedDecor("rbc", 56, 6); seedDecor("wbc", 12, 10); seedDecor("neuron", 16, 8); seedDecor("orb", 34, 6); seedDecor("arch", 7, 0);
  for (let i = 0; i < 40; i++) for (const side of [-1, 1]) { const o = { kind: "rib", side, slot: i * WIN / 40 }; spawn(o, -BEHIND + o.slot); decor.push(o); }
  panels.forEach((p, i) => { p.slot = i * WIN / panels.length + rnd(0, 4); placePanel(p, -BEHIND + p.slot); });
  let lastDist = 0;
  function reseed(dist) { for (const o of decor) spawn(o, dist - BEHIND + o.slot); for (const p of panels) placePanel(p, dist - BEHIND + p.slot); }

  /* ---------- Bölge paleti geçişi ---------- */
  const cur = {}; for (const k of PAL_KEYS) cur[k] = PAL[0][k].clone();
  let zoneMix = { a: 0, b: 0, t: 0 };
  function paletteAt(dist) {
    const zi = Math.floor(Math.max(0, dist) / ZONE_LEN), into = Math.max(0, dist) - zi * ZONE_LEN, T = 34;
    if (zi > 0 && into < T) return { a: (zi - 1) % 3, b: zi % 3, t: smooth(into / T) };
    return { a: zi % 3, b: zi % 3, t: 0 };
  }
  function applyPalette(dist) {
    const m = paletteAt(dist); zoneMix = m;
    for (const k of PAL_KEYS) cur[k].copy(PAL[m.a][k]).lerp(PAL[m.b][k], m.t);
    scene.fog.color.copy(cur.fog); scene.background.copy(cur.fog);
    skyU.top.value.copy(cur.skyTop); skyU.hor.value.copy(cur.skyHor); skyU.sun.value.copy(cur.sun);
    hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround); key.color.copy(cur.key);
    roadMat.color.copy(cur.road); roadMat.emissive.copy(cur.line); railLight.color.copy(cur.rail); railLight.emissive.copy(cur.rail);
    wallMat.color.copy(cur.wall); wallMat.emissive.copy(cur.wallEm); lipMat.color.copy(cur.wallEm); lipMat.emissive.copy(cur.wallEm);
    ribMat.color.copy(cur.wall).multiplyScalar(0.8); ribMat.emissive.copy(cur.wallEm);
    archMat.color.copy(cur.wall); archMat.emissive.copy(cur.wallEm); archGlow.color.copy(cur.wallEm); archGlow.emissive.copy(cur.wallEm);
    orbMat.emissive.copy(cur.orb); cellMat.emissive.copy(cur.wallEm).multiplyScalar(0.25);
    outMat.color.copy(cur.wall).multiplyScalar(0.4); outMat.emissive.copy(cur.wallEm); tubeMat.color.copy(cur.wall); tubeMat.emissive.copy(cur.wallEm);
  }

  /* ---------- Kalite ---------- */
  let composer = null, bloom = null, size = { w: 1, h: 1 };
  function buildComposer() {
    if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); composer = null; }
    const T = TIERS[tierIdx];
    if (!T.bloom) return;
    const rtc = new THREE.WebGLRenderTarget(size.w, size.h, { type: THREE.HalfFloatType, samples: renderer.getPixelRatio() > 1.3 ? 0 : T.msaa });
    composer = new EffectComposer(renderer, rtc);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(size.w, size.h), 0.55, 0.45, 0.9);
    composer.addPass(bloom); composer.addPass(new OutputPass());
  }
  function applyTier() {
    const T = TIERS[tierIdx];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, T.dpr));
    renderer.shadowMap.enabled = T.shadow > 0; key.castShadow = T.shadow > 0;
    if (T.shadow > 0) { key.shadow.mapSize.set(T.shadow, T.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } });
    buildComposer(); resize();
  }
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    size = { w, h }; renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const ps = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    glows.setScale(ps); for (const l of extraLayers) l.setScale(ps);
  }
  const extraLayers = [];
  /* FPS izleme: koşu sırasında 3 sn ortalaması kötüyse bir kademe düş */
  let acc = 0, frames = 0, lastDrop = 0, clock = 0;
  function perf(dt, running) {
    clock += dt; if (!running) { acc = 0; frames = 0; return; }
    acc += dt; frames++;
    if (acc >= 3) {
      const fps = frames / acc; acc = 0; frames = 0;
      if (fps < 44 && tierIdx < TIERS.length - 1 && clock - lastDrop > 5) { tierIdx++; lastDrop = clock; try { localStorage.setItem(QKEY, String(tierIdx)); } catch (_) {} applyTier(); return TIERS[tierIdx].name; }
    }
    return null;
  }

  /* ---------- Kare güncellemesi ---------- */
  const tmpCol = new THREE.Color();
  let pulse = 0, menuK = 1;
  function update(dt, s) {
    // s: { dist, t, speed, px, py, heart (0..1 tehdit), camFov }
    const dist = s.dist;
    applyPalette(dist);
    skyU.time.value = s.t;
    const fk = clamp(dt * 1.5); scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, s.menu ? 12 : 26, fk); scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, s.menu ? 120 : 230, fk);
    const ro = ((s.tex ?? dist) / 8) % 1; rt.map.offset.y = ro; rt.emissive.offset.y = ro;
    const wo = (dist / 11) % 1; wt.map.offset.x = wo; wt.emissive.offset.x = wo;
    const oo = (dist / 14) % 1; outMap.offset.y = oo; outEm.offset.y = oo; const to = (dist / 12) % 1; tubeMap.offset.y = to; tubeEm.offset.y = to;
    if (Math.abs(dist - lastDist) > 60) reseed(dist);
    lastDist = dist;
    // kalp atışı ile nabız atan duvar ışıkları (hızlandıkça ve tehditte hızlanır)
    const bpm = 64 + s.speed * 1.6 + s.heart * 50; pulse += dt * bpm / 60;
    const ph = pulse % 1, beat = Math.exp(-ph * 9) + 0.6 * Math.exp(-Math.max(0, ph - 0.16) * 11) * (ph > 0.16 ? 1 : 0);
    wallMat.emissiveIntensity = 0.38 + beat * 0.42; tubeMat.emissiveIntensity = 0.3 + beat * 0.4; lipMat.emissiveIntensity = 0.85 + beat * 0.9; archGlow.emissiveIntensity = 1.1 + beat * 0.9;
    // ışık + gölge kamerası oyuncuyu izler
    menuK += ((s.menu ? 1 : 0) - menuK) * clamp(dt * 2); key.intensity = THREE.MathUtils.lerp(2.9, 2.3, menuK);
    key.position.set(THREE.MathUtils.lerp(s.px + 4, 3.5, menuK), THREE.MathUtils.lerp(18, 12, menuK), THREE.MathUtils.lerp(-10, -13, menuK));
    key.target.position.set(THREE.MathUtils.lerp(s.px * 0.5, 0, menuK), THREE.MathUtils.lerp(0, 0.6, menuK), THREE.MathUtils.lerp(-16, 0, menuK));

    // süsler
    const counts = {}; for (const k in inst) counts[k] = 0;
    const T = TIERS[tierIdx];
    glows.begin();
    for (const o of decor) {
      if (o.d < dist - BEHIND) spawn(o, o.d + BEHIND + AHEAD);
      if (o.hide) continue;
      const z = -(o.d - dist);
      if (o.kind === "rib") {
        dummy.position.set(0, 0, z); dummy.rotation.set(0, o.side < 0 ? Math.PI : 0, 0); dummy.scale.set(1, 1, 1);
        if (o.side < 0) dummy.position.x = 0; dummy.updateMatrix(); inst.rib.setMatrixAt(counts.rib++, dummy.matrix); continue;
      }
      if (o.kind === "arch") {
        dummy.position.set(0, 4.6, z); dummy.rotation.set(0, 0, o.tilt); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        inst.arch.setMatrixAt(counts.arch++, dummy.matrix);
        for (const dz of [-0.62, 0.62]) { dummy.position.z = z + dz; dummy.updateMatrix(); inst.archRing.setMatrixAt(counts.archRing++, dummy.matrix); }
        if (z < 30) glows.push(0, 12.2, z, cur.wallEm, 4.5, 0.35);
        continue;
      }
      if (T.decor < 1 && (o.d * 7.13) % 1 > T.decor) continue;   // düşük kalitede seyrelt
      const by = Math.sin(s.t * 0.8 + o.bob) * 0.4;
      if (o.kind === "orb") {
        const sc = o.s * (1 + 0.15 * Math.sin(s.t * 3 + o.bob));
        dummy.position.set(o.x, o.y + by, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(sc); dummy.updateMatrix(); inst.orb.setMatrixAt(counts.orb++, dummy.matrix);
        glows.push(o.x, o.y + by, z, cur.orb, sc * 7, 0.55);
        continue;
      }
      o.rx += o.spin * dt; o.ry += o.spin * 0.7 * dt;
      dummy.position.set(o.x, o.y + by, z); dummy.rotation.set(o.rx, o.ry, 0); dummy.scale.setScalar(o.s); dummy.updateMatrix();
      const m = inst[o.kind], i = counts[o.kind]++; m.setMatrixAt(i, dummy.matrix);
      if (o.kind === "rbc") m.setColorAt(i, o.color);
      if (o.kind === "neuron") glows.push(o.x, o.y + by, z, cur.wallEm, o.s * 4, 0.5);
    }
    for (const k in inst) { const m = inst[k]; m.count = counts[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // duvar resimleri
    for (const p of panels) {
      if (p.d < dist - BEHIND) placePanel(p, p.d + BEHIND + AHEAD);
      const z = -(p.d - dist); p.m.position.set(p.side * panelX, panelY, z);
    }
    // bölge kapısı: bir sonraki 500 m sınırı (menüde başlangıç kapısı arkada)
    const gd = s.menu || dist < 30 ? -14 : Math.ceil((dist - 30) / ZONE_LEN) * ZONE_LEN;
    if (gd !== gateD) { gateD = gd; gateZone = gd <= 0 ? 0 : zoneIndex(gd); gateLabel.material.map = gateTexs[gateZone]; gateLabel.material.needsUpdate = true; }
    gate.position.z = -(gateD - dist); gate.visible = gate.position.z < 40 && gate.position.z > -AHEAD;
    tmpCol.copy(PAL[gateZone].line); gateMat.color.copy(tmpCol); gateMat.emissive.copy(tmpCol); gateMat.emissiveIntensity = 1.1 + beat * 0.8;
    gateRing.rotation.z = s.t * 0.3; gateRing2.rotation.z = -s.t * 0.5;
  }
  function render() { if (composer) composer.render(); else renderer.render(scene, camera); }

  applyTier();
  return {
    renderer, scene, camera, key, glowTex, glows, addLayer(l) { extraLayers.push(l); resize(); },
    update, render, resize, perf, applyPalette, cur,
    get tier() { return TIERS[tierIdx].name; }, get tierIndex() { return tierIdx; }, setTier(i) { tierIdx = clamp(i, 0, TIERS.length - 1) | 0; applyTier(); },
    get zoneMix() { return zoneMix; }
  };
}
