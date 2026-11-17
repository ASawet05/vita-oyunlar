/* Damar Yolu Koşucusu — oyun nesnelerinin 3D görünümü (mantık js/damar-kosucusu.js'de).
   Tüm engeller ve vitaminler InstancedMesh ile çizilir (sabit, az sayıda çizim çağrısı):
   trombosit vagonları (pencereli, enerji bantlı), burun + farlar (sabit / karşıdan gelen), rampalar,
   alçak plak bariyerleri, yüksek pıhtı kemerleri, dönen vitamin diskleri ve kristalleri.
   Ayrıca güçlendirici baloncukları, karşıdan gelen kapsül uyarısı ve Toksin Muhafızı. */
import * as THREE from "../vendor/three-paket.js";
import { mergeGeometries } from "../vendor/three-paket.js";
import { LANES, WAGON_H, WAGON_W, CAR_L, CAR_GAP, RAMP_L, VITAMINS, POWERS } from "./ayar.js";
import { vitaminLabel, hazardTexture, membraneTexture, rampTexture, windowTexture } from "./dokular.js";

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.15 }, o));
const NI = g => (g.index ? g.toNonIndexed() : g);
function merged(parts) { return mergeGeometries(parts.map(NI), true); }
function rrect(w, h, r, y0 = 0) {
  const s = new THREE.Shape(), x = -w / 2, y = y0;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 });
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/* Kenarları parlayan saydam baloncuk (fresnel) */
function fresnelMat(color, power = 2.2, strength = 1.2) {
  return new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, p: { value: power }, s: { value: strength } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 c; uniform float p; uniform float s; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), p) * s; gl_FragColor = vec4(c * f, f); }`
  });
}

export const CAR_COLORS = ["#f8ecd0", "#ffb3a7", "#a5f0d6", "#c7b8ff", "#a8d8ff", "#ffe08a"].map(c => new THREE.Color(c));
const MOVER_COLOR = new THREE.Color("#ff8f8f");

export class Things {
  constructor(scene, glows) {
    this.scene = scene; this.glows = glows; this.t = 0;
    const dummy = this.dummy = new THREE.Object3D();
    const im = (geo, mat, max, { cast = true, recv = false } = {}) => { const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.castShadow = cast; m.receiveShadow = recv; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; };

    /* --- Vagon gövdesi (yerel z: 0 = ön yüz, −CAR_L = arka) --- */
    const wt = windowTexture(); wt.wrapS = THREE.RepeatWrapping;
    const bodyMat = std("#ffffff", { roughness: 0.38, metalness: 0.25, flatShading: true });
    const winMat = new THREE.MeshStandardMaterial({ color: "#1c2333", emissive: "#ffe9b8", emissiveMap: wt, emissiveIntensity: 1.5, roughness: 0.2, metalness: 0.4, map: null });
    const trimMat = std("#1d1f27", { roughness: 0.7, metalness: 0.4 });
    this.carGlow = new THREE.MeshStandardMaterial({ color: "#5eead4", emissive: "#5eead4", emissiveIntensity: 2.2 });
    const body = extrude(rrect(WAGON_W, WAGON_H - 0.38, 0.5, 0.38), CAR_L).translate(0, 0, -CAR_L);
    const wins = [];
    for (const s of [-1, 1]) { const p = new THREE.PlaneGeometry(CAR_L - 1.8, 0.64); const uv = p.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 2); p.rotateY(s * Math.PI / 2).translate(s * (WAGON_W / 2 + 0.006), 1.62, -CAR_L / 2); wins.push(p); }
    const band = s => { const sh = rrect(WAGON_W + 0.12, WAGON_H - 0.32, 0.56, 0.33); sh.holes.push(rrect(WAGON_W - 0.02, WAGON_H - 0.42, 0.48, 0.37)); return extrude(sh, 0.16).translate(0, 0, s); };
    const trims = [box(1.5, 0.36, 2.1, 0, 0.2, -1.8), box(1.5, 0.36, 2.1, 0, 0.2, -CAR_L + 1.8), box(WAGON_W + 0.04, 0.1, CAR_L - 0.3, 0, 0.47, -CAR_L / 2), box(0.6, 0.5, CAR_GAP + 0.1, 0, 1.0, -CAR_L - CAR_GAP / 2),
      box(1.1, 0.03, CAR_L - 1.2, 0, WAGON_H + 0.012, -CAR_L / 2)];
    const glowParts = [band(-CAR_L * 0.33), band(-CAR_L * 0.66 - 0.16), box(0.05, 0.035, CAR_L - 1.2, -0.62, WAGON_H + 0.02, -CAR_L / 2), box(0.05, 0.035, CAR_L - 1.2, 0.62, WAGON_H + 0.02, -CAR_L / 2)];
    const carGeo = merged([body, mergeGeometries(wins.map(NI)), mergeGeometries(trims.map(NI)), mergeGeometries(glowParts.map(NI))]);
    this.cars = im(carGeo, [bodyMat, winMat, trimMat, this.carGlow], 64, { recv: true });

    /* --- Burun: sabit (sönük farlar) ve karşıdan gelen (parlak farlar + kırmızı fener) --- */
    const capBody = extrude(rrect(WAGON_W - 0.2, WAGON_H - 0.75, 0.42, 0.5), 0.42);
    const glass = new THREE.PlaneGeometry(1.36, 0.5).translate(0, 2.0, 0.425);
    const lights = mergeGeometries([-0.6, 0.6].map(x => NI(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12).rotateX(Math.PI / 2).translate(x, 0.98, 0.44))));
    const beacon = box(0.34, 0.14, 0.24, 0, WAGON_H + 0.07, -0.4);
    const noseGeo = merged([capBody, glass, lights, beacon]);
    const glassMat = new THREE.MeshStandardMaterial({ color: "#0b1220", emissive: "#3b82f6", emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.6 });
    this.noseS = im(noseGeo, [bodyMat, glassMat, new THREE.MeshStandardMaterial({ color: "#fff3c4", emissive: "#ffe8a3", emissiveIntensity: 1.1 }), std("#5c1a1a")], 24);
    this.beaconMat = new THREE.MeshStandardMaterial({ color: "#ff2d2d", emissive: "#ff2d2d", emissiveIntensity: 3 });
    this.noseM = im(noseGeo, [bodyMat, glassMat, new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff4dc", emissiveIntensity: 2.4 }), this.beaconMat], 12);
    // Far ışık konisi (yolda) — toplamsal düzlem
    const coneTex = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(0.3, "rgba(0,0,0,0)"); h.addColorStop(0.7, "rgba(0,0,0,0)"); h.addColorStop(1, "rgba(0,0,0,1)"); g.globalCompositeOperation = "destination-out"; g.fillStyle = h; g.fillRect(0, 0, 64, 256); return new THREE.CanvasTexture(c); })();
    this.beams = im(new THREE.PlaneGeometry(2.4, 12).rotateX(-Math.PI / 2).translate(0, 0.05, 6.4), new THREE.MeshBasicMaterial({ map: coneTex, color: "#fff4d6", transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }), 12, { cast: false });

    /* --- Rampa (yerel z: 0 = rampa başı, −RAMP_L = vagon önü) --- */
    const rg = new THREE.BufferGeometry(), W2 = WAGON_W / 2 - 0.04, H = WAGON_H, L = RAMP_L;
    const tri = [[-W2, 0, 0], [W2, 0, 0], [-W2, H, -L], [W2, 0, 0], [W2, H, -L], [-W2, H, -L], [-W2, 0, 0], [-W2, H, -L], [-W2, 0, -L], [W2, 0, 0], [W2, 0, -L], [W2, H, -L]];
    const uvs = [0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 1];
    rg.setAttribute("position", new THREE.Float32BufferAttribute(tri.flat(), 3)); rg.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); rg.computeVertexNormals();
    rg.addGroup(0, 6, 0); rg.addGroup(6, 6, 1);
    const rt = rampTexture(); rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(1, 2.5);
    this.rampGlow = new THREE.MeshStandardMaterial({ color: "#232838", emissive: "#5eead4", emissiveMap: rt, emissiveIntensity: 1.05, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide });
    this.ramps = im(rg, [this.rampGlow, std("#2b2f3d", { side: THREE.DoubleSide, flatShading: true })], 24, { recv: true });

    /* --- Alçak plak bariyeri (üzerinden zıpla) --- */
    const hz = hazardTexture();
    const lowGeo = merged([box(2.0, 0.5, 0.22, 0, 0.7, 0), mergeGeometries([box(0.14, 0.95, 0.2, -0.93, 0.475, 0), box(0.14, 0.95, 0.2, 0.93, 0.475, 0), box(0.42, 0.06, 0.6, -0.93, 0.03, 0), box(0.42, 0.06, 0.6, 0.93, 0.03, 0)].map(NI)), box(2.02, 0.06, 0.26, 0, 0.975, 0)]);
    this.lows = im(lowGeo, [std("#ffffff", { map: hz, roughness: 0.5 }), std("#2a2c35", { metalness: 0.6, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: "#ffb020", emissive: "#ffb020", emissiveIntensity: 2.6 })], 40);

    /* --- Yüksek pıhtı kemeri (altından yuvarlan) --- */
    const mt = membraneTexture();
    const archGeo = merged([mergeGeometries([box(0.24, 2.95, 0.34, -1.0, 1.475, 0), box(0.24, 2.95, 0.34, 1.0, 1.475, 0), box(2.36, 0.2, 0.38, 0, 2.95, 0)].map(NI)), box(1.78, 1.68, 0.12, 0, 2.04, 0), box(1.8, 0.07, 0.18, 0, 1.19, 0)]);
    this.arches = im(archGeo, [std("#5a1426", { flatShading: true, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: "#3a0612", emissive: "#ff3355", emissiveMap: mt, emissiveIntensity: 1.9, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: "#ff6b81", emissive: "#ff6b81", emissiveIntensity: 3.2 })], 40);

    /* --- Vitaminler: diskler (D3, Fe) ve kristaller (B12, Mg) + altın halkalar --- */
    this.vit = {};
    const gold = new THREE.MeshStandardMaterial({ color: "#ffd75e", emissive: "#ffb703", emissiveIntensity: 1.25, roughness: 0.22, metalness: 0.9 });
    const disc = new THREE.CylinderGeometry(0.44, 0.44, 0.13, 22).rotateX(Math.PI / 2);
    for (const k in VITAMINS) {
      const v = VITAMINS[k];
      if (v.shape === "disc") {
        const face = new THREE.MeshStandardMaterial({ map: vitaminLabel(v), emissive: v.c1, emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.3 });
        this.vit[k] = im(disc, [gold, face, face], 140, { cast: false });
      } else {
        const geo = k === "b12" ? new THREE.OctahedronGeometry(0.38, 0).scale(0.9, 1.35, 0.9) : new THREE.IcosahedronGeometry(0.36, 0).scale(1, 1.15, 1);
        this.vit[k] = im(geo, new THREE.MeshStandardMaterial({ color: v.c1, emissive: v.c2, emissiveIntensity: 1.0, roughness: 0.12, metalness: 0.35, flatShading: true }), 140, { cast: false });
      }
    }
    this.rings = im(new THREE.TorusGeometry(0.52, 0.04, 4, 26), gold, 280, { cast: false });
    this.vitCol = {}; for (const k in VITAMINS) this.vitCol[k] = new THREE.Color(VITAMINS[k].c1);

    /* --- Güçlendirici baloncukları --- */
    this.pickups = []; this.powCol = {};
    for (const k in POWERS) this.powCol[k] = new THREE.Color(POWERS[k].color);
    this.powCol.cap = new THREE.Color("#2dd4bf");
    this.bubbleGeo = new THREE.IcosahedronGeometry(0.62, 2);

    /* --- Toksin Muhafızı --- */
    this.threat = this.makeThreat(); scene.add(this.threat.root);
    this.tmpV = new THREE.Vector3(); this.tmpC = new THREE.Color();
  }

  pickupMesh(kind) {
    let p = this.pickups.find(q => !q.used && q.kind === kind);
    if (p) { p.used = true; p.root.visible = true; return p; }
    const root = new THREE.Group(), col = this.powCol[kind];
    const em = (c, i = 1.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3, metalness: 0.4 });
    const icon = new THREE.Group(); root.add(icon);
    if (kind === "jet") {
      icon.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.2), std("#2b2f3d", { metalness: 0.5 })));
      for (const x of [-0.12, 0.12]) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 8), em("#ffa94d", 2)); n.position.set(x, -0.32, 0); icon.add(n); }
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.22), em("#ffa94d", 1.2)); t.position.y = 0.2; icon.add(t);
    } else if (kind === "magnet") {
      const u = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.09, 6, 14, Math.PI), em("#ff6b6b", 1.2)); u.rotation.z = Math.PI; icon.add(u);
      for (const x of [-0.24, 0.24]) { const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 8), em("#f1f3f5", 0.8)); tip.position.set(x, 0.08, 0); icon.add(tip); }
    } else if (kind === "x2") {
      const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
      g.fillStyle = "#7b2cbf"; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke();
      g.fillStyle = "#fff"; g.font = "900 58px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("2x", 64, 68);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 20).rotateX(Math.PI / 2), [em("#cc5de8", 1.4), new THREE.MeshStandardMaterial({ map: tx, emissive: "#cc5de8", emissiveIntensity: 0.4 }), new THREE.MeshStandardMaterial({ map: tx, emissive: "#cc5de8", emissiveIntensity: 0.4 })]);
      icon.add(d);
    } else {
      const c1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.36, 3, 10), em("#2dd4bf", 1.2)); c1.rotation.z = Math.PI / 2.6; icon.add(c1);
      const c2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 4, 20), em("#fff", 1.5)); c2.rotation.x = Math.PI / 2; icon.add(c2);
    }
    const bubble = new THREE.Mesh(this.bubbleGeo, fresnelMat(col, 2.0, 1.4)); root.add(bubble);
    this.scene.add(root);
    p = { kind, root, icon, used: true }; this.pickups.push(p); return p;
  }

  makeThreat() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const ico = new THREE.IcosahedronGeometry(0.95, 1), pos = ico.attributes.position;
    for (let i = 0; i < pos.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pos, i); const n = 1 + 0.16 * Math.sin(v.x * 5.1) * Math.cos(v.y * 4.3 + v.z * 3.7); v.multiplyScalar(n); pos.setXYZ(i, v.x, v.y, v.z); }
    ico.computeVertexNormals();
    const skin = new THREE.MeshStandardMaterial({ color: "#3a0b52", emissive: "#5dff3a", emissiveIntensity: 0.18, flatShading: true, roughness: 0.6, metalness: 0.1 });
    const core = new THREE.Mesh(ico, skin); core.castShadow = true; body.add(core);
    const spikeMat = new THREE.MeshStandardMaterial({ color: "#a3ff5c", emissive: "#7cff3a", emissiveIntensity: 1.5, flatShading: true });
    const spikes = [];
    for (let i = 0; i < 16; i++) {
      const v = new THREE.Vector3().randomDirection(); if (v.z < -0.55) v.z = -v.z;   // ön yüz (yüz) boş kalsın
      const g = new THREE.ConeGeometry(0.13, 0.62, 5).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v)); g.translate(v.x * 0.98, v.y * 0.98, v.z * 0.98); spikes.push(NI(g));
    }
    const spikeMesh = new THREE.Mesh(mergeGeometries(spikes), spikeMat); spikeMesh.castShadow = true; body.add(spikeMesh);
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#f4ff4f", emissive: "#e9ff3a", emissiveIntensity: 4 });
    const eyes = [-0.3, 0.3].map(x => { const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), eyeMat); e.position.set(x, 0.25, -0.86); e.scale.set(1, 0.65, 0.6); body.add(e); return e; });
    // göz sapları: kamera arkadan baktığında da tehditkâr bakışlar görünsün
    const pupilMat = new THREE.MeshBasicMaterial({ color: "#14001c" });
    const stalks = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(s * 0.36, 0.72, -0.15); g.rotation.set(-0.25, 0, -s * 0.38); body.add(g);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.62, 5), skin); st.position.y = 0.3; g.add(st);
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), eyeMat); ball.position.y = 0.68; g.add(ball);
      const pupil = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), pupilMat); pupil.position.set(0, 0.7, 0.14); g.add(pupil);
      return g;
    });
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.12), new THREE.MeshStandardMaterial({ color: "#1a0526" })); brow.position.set(0, 0.42, -0.86); brow.rotation.x = 0.2; body.add(brow);
    const jaw = new THREE.Group(); jaw.position.set(0, -0.12, -0.7); body.add(jaw);
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 6, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#0c0212", emissive: "#5dff3a", emissiveIntensity: 0.35, side: THREE.DoubleSide })); mouth.scale.set(1, 0.6, 0.5); jaw.add(mouth);
    const toothMat = new THREE.MeshStandardMaterial({ color: "#f1f5e8", flatShading: true });
    jaw.add(new THREE.Mesh(mergeGeometries([0, 1, 2, 3, 4, 5].map(i => NI(new THREE.ConeGeometry(0.05, 0.16, 4).rotateX(Math.PI).translate(-0.3 + i * 0.12, -0.02, -0.12)))), toothMat));
    const arms = [-1, 1].map(s => {
      const a = new THREE.Group(); a.position.set(s * 0.82, -0.1, -0.3); body.add(a); let parent = a; const segs = [];
      for (let i = 0; i < 3; i++) { const seg = new THREE.Group(); seg.position.z = i ? -0.36 : 0; parent.add(seg); const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.11 - i * 0.025, 0.3, 2, 6), skin); m.rotation.x = Math.PI / 2; m.position.z = -0.18; seg.add(m); segs.push(seg); parent = seg; }
      for (const dx of [-0.07, 0.07]) { const cl = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 4), spikeMat); cl.rotation.x = -Math.PI / 2; cl.position.set(dx, 0, -0.5); parent.add(cl); }
      return segs;
    });
    root.visible = false;
    return { root, body, spikes, eyes, jaw, arms, skin, eyeMat, stalks };
  }

  /* Her kare: G'deki varlıklar → örnek matrisleri */
  update(dt, G, flowSpeed) {
    this.t += dt; const t = this.t, d = this.dummy, dist = G.dist, glows = this.glows, tc = this.tmpC;
    const n = { cars: 0, noseS: 0, noseM: 0, beams: 0, ramps: 0, lows: 0, arches: 0, rings: 0 }, nv = {}; for (const k in this.vit) nv[k] = 0;
    for (const p of this.pickups) p.seen = false;
    const pulse = 0.5 + 0.5 * Math.sin(t * 10);
    this.beaconMat.emissiveIntensity = 0.8 + 2.4 * (Math.sin(t * 14) > 0 ? 1 : 0.1);
    this.carGlow.emissiveIntensity = 1.6 + 0.8 * Math.sin(t * 3);
    for (const e of G.ents) {
      if (e.got || e.smashed) continue;
      const z = -(e.d - dist);
      if (z > 30 || z < -300) continue;
      const lx = e.x ?? LANES[e.lane];
      switch (e.t) {
        case "vit": {
          if (n.rings >= 280) break;
          const k = e.kind, v = VITAMINS[k], m = this.vit[k], sc = e.rare ? 1.28 : 1, spin = t * 3.2 + e.d * 0.37, bob = Math.sin(t * 4 + e.d) * 0.07;
          d.position.set(lx, e.y + bob, z); d.rotation.set(0, spin, 0); d.scale.setScalar(sc * (e.pop || 1)); d.updateMatrix(); m.setMatrixAt(nv[k]++, d.matrix);
          if (v.shape === "crystal") { d.rotation.set(Math.PI / 2 + 0.3 * Math.sin(spin), 0, spin * 0.5); d.updateMatrix(); this.rings.setMatrixAt(n.rings++, d.matrix); }
          if (z > -150) glows.push(lx, e.y + bob, z, this.vitCol[k], e.rare ? 1.9 : 1.35, 0.42);
          break;
        }
        case "pow": {
          let p = e._p; if (!p) p = e._p = this.pickupMesh(e.kind);
          p.seen = true; p.root.position.set(lx, e.y + Math.sin(t * 3 + e.d) * 0.12, z); p.icon.rotation.y = t * 2.2; p.root.scale.setScalar(1 + 0.05 * Math.sin(t * 6));
          glows.push(lx, p.root.position.y, z, this.powCol[e.kind], 2.6, 0.55);
          break;
        }
        case "low": d.position.set(lx, 0, z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); this.lows.setMatrixAt(n.lows++, d.matrix);
          if (z > -120) glows.push(lx, 1.0, z, tc.set("#ffb020"), 2.2, 0.28); break;
        case "arch": d.position.set(lx, 0, z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); this.arches.setMatrixAt(n.arches++, d.matrix);
          if (z > -120) glows.push(lx, 1.2, z, tc.set("#ff4d6d"), 2.4, 0.3); break;
        case "wagon": {
          const mover = e.v > 0;
          for (let i = 0; i < e.cars; i++) {
            const cz = z - i * (CAR_L + CAR_GAP); if (cz - CAR_L > 30) continue;
            d.position.set(lx, 0, cz); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix();
            const ci = n.cars++; this.cars.setMatrixAt(ci, d.matrix); this.cars.setColorAt(ci, mover ? MOVER_COLOR : CAR_COLORS[e.color % CAR_COLORS.length]);
          }
          if (e.ramp) { d.position.set(lx, 0, z + RAMP_L); d.updateMatrix(); this.ramps.setMatrixAt(n.ramps++, d.matrix); }
          else {
            d.position.set(lx, 0, z); d.updateMatrix();
            const nm = mover ? this.noseM : this.noseS, ni = mover ? n.noseM++ : n.noseS++;
            nm.setMatrixAt(ni, d.matrix); nm.setColorAt(ni, mover ? MOVER_COLOR : CAR_COLORS[e.color % CAR_COLORS.length]);
            if (mover) {
              this.beams.setMatrixAt(n.beams++, d.matrix);
              for (const s of [-0.6, 0.6]) glows.push(lx + s, 0.98, z + 0.5, tc.set("#fff6dd"), 1.3 + pulse * 0.3, 0.55);
              glows.push(lx, WAGON_H + 0.1, z - 0.4, tc.set("#ff2d2d"), 1.6, 0.5 + 0.5 * pulse);
              // uyarı: kapsül yaklaşırken şeritte kırmızı nabız
              if (z < -24 && z > -170) glows.push(lx, 0.12, -16, tc.set("#ff3045"), 3.6, 0.25 + 0.45 * pulse);
            } else for (const s of [-0.6, 0.6]) glows.push(lx + s, 0.98, z + 0.48, tc.set("#ffe8a3"), 1.2, 0.35);
          }
          break;
        }
      }
    }
    for (const p of this.pickups) if (p.used && !p.seen) { p.used = false; p.root.visible = false; }
    for (const e of G.ents) if (e._p && (e.got || e.smashed)) { e._p.used = false; e._p.root.visible = false; e._p = null; }
    const fin = (m, c) => { m.count = c; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
    fin(this.cars, n.cars); fin(this.noseS, n.noseS); fin(this.noseM, n.noseM); fin(this.beams, n.beams); fin(this.ramps, n.ramps); fin(this.lows, n.lows); fin(this.arches, n.arches); fin(this.rings, n.rings);
    for (const k in this.vit) fin(this.vit[k], nv[k]);
  }

  /* Toksin Muhafızı: k = görünürlük/yakınlık (0..1), lunge = yakalama hamlesi (0..1) */
  updateThreat(dt, px, py, k, lunge, time, cam) {
    const T = this.threat;
    T.root.visible = k > 0.02 || lunge > 0;
    if (!T.root.visible) return;
    // kameraya göre: ekranın alt kenarında yarı görünür; k arttıkça yükselir, yakalamada oyuncunun üstüne atılır
    cam.getWorldDirection(this.tmpV); const below = Math.asin(clamp(-this.tmpV.y, -1, 1)) + THREE.MathUtils.degToRad(cam.fov) * 0.5 * 0.8;
    const fwd = 3.6, bz = cam.position.z - fwd, by = cam.position.y - fwd * Math.tan(below), bx = lerp(cam.position.x, px, 0.5) + Math.sin(time * 1.7) * 0.6;
    const e = lunge * lunge * (3 - 2 * lunge), bob = Math.sin(time * 5) * 0.1;
    const x = lerp(bx, px, e), y = lerp(by - 2.4 * (1 - k), py + 1.1, e) + bob, z = lerp(bz, 0.7, e);
    T.root.scale.setScalar(lerp(0.5, 0.85, e));
    T.root.position.set(x, y, z);
    T.root.rotation.y = Math.sin(time * 1.3) * 0.25; T.body.rotation.z = Math.sin(time * 2.2) * 0.12;
    const s = 1 + 0.06 * Math.sin(time * 9); T.body.scale.set(s, 1 / s, s);
    T.jaw.rotation.x = 0.15 + (0.5 + 0.5 * Math.sin(time * 7)) * 0.45 + lunge * 0.4;
    T.eyeMat.emissiveIntensity = 3 + Math.sin(time * 23) * 1.2;
    T.stalks.forEach((g, i) => { const s = i ? 1 : -1; g.rotation.z = -s * 0.38 + Math.sin(time * 3.1 + i * 1.7) * 0.18; g.rotation.x = -0.25 + Math.sin(time * 2.3 + i) * 0.12; });
    T.arms.forEach((segs, i) => segs.forEach((g, j) => { g.rotation.x = -0.3 + Math.sin(time * 6 + j + i * 2) * 0.35 - lunge * 0.6; g.rotation.y = (i ? -1 : 1) * (0.2 + Math.sin(time * 4 + j) * 0.25); }));
    for (let i = 0; i < 3; i++) this.glows.push(T.root.position.x + Math.sin(time * 3 + i * 2) * 0.9, y + Math.cos(time * 2 + i) * 0.6, z + 0.2, this.tmpC.set(i % 2 ? "#7cff3a" : "#b43cff"), 1.6, 0.3 * Math.max(k, lunge));
  }
}
