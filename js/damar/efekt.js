/* Damar Yolu Koşucusu — nokta tabanlı efekt katmanları (tek çizim çağrısı):
   PointLayer: dünya biriminde boyutlu, toplamsal karışımlı parıltılar (vitamin haleleri, farlar, küreler)
   Particles: ömürlü parçacıklar (toplama kıvılcımı, enkaz, jetpack alevi, toz, frenzy aurası)
   Shockwave: genişleyen enerji halkası (kapsül patlaması / devam et) */
import * as THREE from "../vendor/three-paket.js";

const VERT = `
attribute vec3 color; attribute float size; attribute float alpha;
uniform float uScale; varying vec3 vC; varying float vA;
void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = alpha * smoothstep(0.6, 4.5, -mv.z);
  gl_PointSize = clamp(size * uScale / max(0.1, -mv.z), 0.0, 900.0); gl_Position = projectionMatrix * mv; }`;
const FRAG = `
uniform sampler2D uMap; varying vec3 vC; varying float vA;
void main(){ vec4 t = texture2D(uMap, gl_PointCoord); float a = t.a * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC * a, a); }`;

export class PointLayer {
  constructor(max, map, { additive = true } = {}) {
    this.max = max; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    const attr = (name, arr, k) => { const a = new THREE.BufferAttribute(arr, k); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.aPos = attr("position", this.pos, 3); this.aCol = attr("color", this.col, 3); this.aSize = attr("size", this.size, 1); this.aAlpha = attr("alpha", this.alpha, 1);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: map }, uScale: { value: 500 } }, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: additive ? THREE.CustomBlending : THREE.NormalBlending,
      blendSrc: THREE.OneFactor, blendDst: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor });
    this.obj = new THREE.Points(g, this.mat); this.obj.frustumCulled = false; this.obj.renderOrder = 5;
    this.geo = g;
  }
  begin() { this.n = 0; }
  push(x, y, z, color, size, alpha = 1) {
    if (this.n >= this.max) return; const i = this.n++, j = i * 3;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z; this.col[j] = color.r; this.col[j + 1] = color.g; this.col[j + 2] = color.b; this.size[i] = size; this.alpha[i] = alpha;
  }
  end() {
    this.geo.setDrawRange(0, this.n);
    for (const a of [this.aPos, this.aCol, this.aSize, this.aAlpha]) { a.clearUpdateRanges(); a.addUpdateRange(0, this.n * a.itemSize); a.needsUpdate = true; }
  }
  setScale(s) { this.mat.uniforms.uScale.value = s; }
}

const tmpC = new THREE.Color();
export class Particles {
  constructor(max, map) {
    this.layer = new PointLayer(max, map); this.max = max; this.list = [];
    this.obj = this.layer.obj;
  }
  /* o: { x,y,z, vx,vy,vz, life, size, color, grav, drag, grow, world } — z dünyaya göre (akışla birlikte geri kayar) */
  spawn(o) {
    if (this.list.length >= this.max) this.list.shift();
    const c = o.color instanceof THREE.Color ? o.color : new THREE.Color(o.color);
    this.list.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life, max: o.life, size: o.size || 0.2, c, grav: o.grav ?? 0, drag: o.drag ?? 0, grow: o.grow ?? 0, flow: o.flow ?? 1, alpha: o.alpha ?? 1 });
  }
  burst(x, y, z, color, n = 14, pw = 6, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, s = pw * (0.4 + Math.random() * 0.6), h = Math.sqrt(1 - e * e);
      this.spawn(Object.assign({ x, y, z, vx: Math.cos(a) * h * s, vy: Math.abs(e) * s * 0.9 + 1, vz: Math.sin(a) * h * s, life: 0.4 + Math.random() * 0.45, size: 0.12 + Math.random() * 0.22, color, grav: 9, drag: 1.5 }, o));
    }
  }
  update(dt, flowSpeed) {
    const L = this.list; let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.life -= dt; if (p.life <= 0) continue;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy = p.vy * d - p.grav * dt; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz + flowSpeed * p.flow) * dt; p.size += p.grow * dt;
      L[w++] = p;
    }
    L.length = w;
    const ly = this.layer; ly.begin();
    for (const p of L) { const k = p.life / p.max; ly.push(p.x, p.y, p.z, tmpC.copy(p.c), Math.max(0.01, p.size), Math.min(1, k * 1.6) * p.alpha); }
    ly.end();
  }
  clear() { this.list.length = 0; }
}

export class Shockwave {
  constructor() {
    this.mat = new THREE.MeshBasicMaterial({ color: "#7df9ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.obj = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 48), this.mat);
    this.obj.rotation.x = Math.PI / 2; this.obj.visible = false; this.t = 0; this.dur = 0.8; this.r = 30;
  }
  fire(x, y, z, color, radius = 30, dur = 0.8) { this.obj.position.set(x, y, z); this.mat.color.set(color); this.t = 0; this.dur = dur; this.r = radius; this.obj.visible = true; }
  update(dt) {
    if (!this.obj.visible) return; this.t += dt; const k = this.t / this.dur;
    if (k >= 1) { this.obj.visible = false; return; }
    const e = 1 - Math.pow(1 - k, 3), s = 0.5 + e * this.r; this.obj.scale.set(s, s, 1 + e * 8); this.mat.opacity = (1 - k) * 0.9;
  }
}
