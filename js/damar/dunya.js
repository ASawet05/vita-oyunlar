/* Damar içi dünya: organik dokulu yakut tünel (kabartma haritası ile derinlik) + nabızla parlayan turkuaz damar hatları,
   neon tüp ışıklı halka kemerler, koyu plazma yolu (3 şerit, turkuaz kesik çizgiler), alyuvar biçimli kan hücreleri,
   damar içinde süzülen mikro plazma tanecikleri, sis + kenar (rim) ışığı. Dokular tuvalde üretilir (dış dosya yok). */
export const LANES = [-2.2, 0, 2.2];
const TUNNEL_LEN = 220, TUNNEL_R = 7.2, ROAD_W = 7.4;

function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* Damar duvarı: renk + ışıma (neon hatlar) + yükseklik (kabartma) dokuları */
function veinTextures(THREE) {
  const S = 512, base = document.createElement("canvas"), glow = document.createElement("canvas"), bump = document.createElement("canvas");
  base.width = base.height = glow.width = glow.height = bump.width = bump.height = S;
  const b = base.getContext("2d"), g = glow.getContext("2d"), h = bump.getContext("2d"), r = rnd(7);
  const grd = b.createLinearGradient(0, 0, S, S);
  grd.addColorStop(0, "#4a0d1c"); grd.addColorStop(0.5, "#6b1024"); grd.addColorStop(1, "#3a0914");
  b.fillStyle = grd; b.fillRect(0, 0, S, S);
  h.fillStyle = "#555"; h.fillRect(0, 0, S, S);
  // Organik doku: iç içe yumuşak hücre kabarcıkları (renkte açık merkez, kabartmada tepe)
  const wrapDraw = (fn, x, y, rad) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) if (x + dx > -rad && x + dx < S + rad && y + dy > -rad && y + dy < S + rad) fn(x + dx, y + dy); };
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, rad = 6 + r() * 30, sx = 0.7 + r() * 0.7, rot = r() * Math.PI;
    wrapDraw((cx, cy) => {
      const cg = b.createRadialGradient(cx - rad * 0.25, cy - rad * 0.25, 1, cx, cy, rad);
      cg.addColorStop(0, `rgba(${170 + r() * 50},${40 + r() * 30},${60 + r() * 20},.55)`); cg.addColorStop(0.7, "rgba(110,16,36,.25)"); cg.addColorStop(1, "rgba(40,4,12,.0)");
      b.save(); b.translate(cx, cy); b.rotate(rot); b.scale(sx, 1); b.translate(-cx, -cy); b.fillStyle = cg; b.beginPath(); b.arc(cx, cy, rad, 0, Math.PI * 2); b.fill();
      b.strokeStyle = "rgba(30,3,10,.35)"; b.lineWidth = 1.5; b.stroke(); b.restore();
      const hg = h.createRadialGradient(cx, cy, 0, cx, cy, rad);
      hg.addColorStop(0, "rgba(255,255,255,.55)"); hg.addColorStop(1, "rgba(255,255,255,0)");
      h.save(); h.translate(cx, cy); h.rotate(rot); h.scale(sx, 1); h.translate(-cx, -cy); h.fillStyle = hg; h.beginPath(); h.arc(cx, cy, rad, 0, Math.PI * 2); h.fill(); h.restore();
    }, x, y, rad);
  }
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
  const branch = (x, y, ang, len, w, depth) => {
    for (const ctx of [b, g, h]) {
      ctx.save(); ctx.lineCap = "round";
      ctx.strokeStyle = ctx === g ? `rgba(45,212,191,${0.55 + depth * 0.12})` : ctx === h ? "rgba(255,255,255,.8)" : "rgba(20,4,10,.55)";
      ctx.lineWidth = ctx === h ? w * 1.8 : w; ctx.beginPath(); ctx.moveTo(x, y);
      let cx = x, cy = y; const rr = rnd(Math.floor(x * 31 + y * 17 + depth));
      for (let s = 0; s < 6; s++) { const a2 = ang + (rr() - 0.5) * 0.8; cx += Math.cos(a2) * len / 6; cy += Math.sin(a2) * len / 6; ctx.lineTo(cx, cy); }
      ctx.stroke(); ctx.restore();
    }
    if (depth > 0) for (let k = 0; k < 2; k++) branch(x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5, ang + (r() - 0.5) * 1.6, len * 0.6, w * 0.6, depth - 1);
  };
  for (let i = 0; i < 7; i++) branch(r() * S, r() * S, r() * Math.PI * 2, 140 + r() * 120, 5, 2);
  const mk = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  return { map: mk(base), emissive: mk(glow), bump: mk(bump) };
}
/* Yol: koyu plazma zemini (hafif hücre izleri), turkuaz kesik şerit çizgileri ve kenar şeritleri */
function roadTextures(THREE) {
  const W = 256, H = 256, base = document.createElement("canvas"), glow = document.createElement("canvas");
  base.width = glow.width = W; base.height = glow.height = H;
  const b = base.getContext("2d"), g = glow.getContext("2d"), r = rnd(3);
  const bg = b.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, "#10141c"); bg.addColorStop(0.5, "#161c27"); bg.addColorStop(1, "#10141c");
  b.fillStyle = bg; b.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { b.fillStyle = `rgba(${60 + r() * 40},${70 + r() * 30},${95 + r() * 40},${0.12 + r() * 0.16})`; b.beginPath(); b.ellipse(r() * W, r() * H, 6 + r() * 16, 3 + r() * 7, r() * 3, 0, Math.PI * 2); b.fill(); }
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  const lane = W / 3;
  [lane, lane * 2].forEach(x => {
    for (let y = 0; y < H; y += 64) { g.fillStyle = "#2dd4bf"; g.fillRect(x - 3, y + 8, 6, 36); b.fillStyle = "rgba(94,234,212,.75)"; b.fillRect(x - 3, y + 8, 6, 36); }
  });
  [5, W - 5].forEach(x => { g.fillStyle = "#14b8a6"; g.fillRect(x - 4, 0, 8, H); b.fillStyle = "rgba(45,212,191,.7)"; b.fillRect(x - 4, 0, 8, H); });
  const mk = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  return { map: mk(base), emissive: mk(glow) };
}
function dotTexture(THREE) {
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

export function createWorld(THREE, scene) {
  scene.background = new THREE.Color(0x12040a);
  scene.fog = new THREE.Fog(0x12040a, 24, 118);

  // Tünel (silindir; içten görünür) — organik doku + kabartma
  const vt = veinTextures(THREE);
  [vt.map, vt.emissive, vt.bump].forEach(t => t.repeat.set(5, 18));
  const tunnelMat = new THREE.MeshLambertMaterial({ map: vt.map, emissiveMap: vt.emissive, bumpMap: vt.bump, bumpScale: 2.2, emissive: new THREE.Color(0x2dd4bf), emissiveIntensity: 0.7, side: THREE.BackSide });
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(TUNNEL_R, TUNNEL_R, TUNNEL_LEN, 40, 1, true), tunnelMat);
  tunnel.rotation.x = Math.PI / 2; tunnel.position.set(0, 3.2, -TUNNEL_LEN / 2 + 12);
  scene.add(tunnel);

  // Yol (3 şerit)
  const rt = roadTextures(THREE);
  rt.map.repeat.set(1, 30); rt.emissive.repeat.set(1, 30);
  const roadMat = new THREE.MeshLambertMaterial({ map: rt.map, emissiveMap: rt.emissive, emissive: new THREE.Color(0x2dd4bf), emissiveIntensity: 1.0 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, TUNNEL_LEN), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -TUNNEL_LEN / 2 + 12);
  scene.add(road);
  // Yol kenarı neon bariyer çizgileri (yoldan hafif yüksek)
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf });
  [-ROAD_W / 2, ROAD_W / 2].forEach(x => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, TUNNEL_LEN), edgeMat); e.position.set(x, 0.03, -TUNNEL_LEN / 2 + 12); scene.add(e); });

  // Neon tüp ışıklı halka kemerler (InstancedMesh: metal halka + parlak tüp parçaları)
  const RINGS = 7, RING_GAP = 26;
  const ringGeo = new THREE.TorusGeometry(TUNNEL_R - 0.35, 0.22, 6, 48), ringMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });
  const tubeGeo = new THREE.TorusGeometry(TUNNEL_R - 0.62, 0.07, 6, 10, 0.55), tubeMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  const TUBES_PER = 4, tubeAng = [0.35, 1.0, Math.PI - 1.55, Math.PI - 0.9];
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, RINGS), tubes = new THREE.InstancedMesh(tubeGeo, tubeMat, RINGS * TUBES_PER);
  const ringZ = Array.from({ length: RINGS }, (_, i) => -12 - i * RING_GAP);
  scene.add(rings); scene.add(tubes);

  // Akan kan hücreleri: alyuvar biçimi (iki yanı çukur disk; LatheGeometry)
  const rbcPts = [];
  for (let i = 0; i <= 7; i++) { const t = i / 7, x = 0.04 + t * 0.5, y = 0.07 + 0.11 * Math.sin(t * Math.PI) ** 0.6 * (0.55 + 0.45 * t); rbcPts.push(new THREE.Vector2(x, y)); }
  for (let i = 6; i >= 0; i--) { const p = rbcPts[i]; rbcPts.push(new THREE.Vector2(p.x, -p.y)); }
  const CELLS = 38, cellGeo = new THREE.LatheGeometry(rbcPts, 14);
  const cellMat = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.38, metalness: 0.05, emissive: 0x4a0710, emissiveIntensity: 0.7 });
  const cells = new THREE.InstancedMesh(cellGeo, cellMat, CELLS);
  const cellData = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const placeCell = (d, z) => {
    const a = Math.PI * (0.05 + Math.random() * 0.9) * (Math.random() < 0.5 ? 1 : -1) + Math.PI / 2;
    const rad = 4.4 + Math.random() * 2.0;
    d.x = Math.cos(a) * rad; d.y = 3.2 + Math.sin(a) * rad * 0.9; if (d.y < 0.6) d.y = 0.6 + Math.random();
    if (Math.abs(d.x) < 4.2 && d.y < 4.4) d.x = Math.sign(d.x || 1) * (4.4 + Math.random());
    d.z = z; d.rx = Math.random() * 3; d.ry = Math.random() * 3; d.spin = (Math.random() - 0.5) * 2; d.s = 1.0 + Math.random() * 0.7; d.drift = 0.8 + Math.random() * 0.35;
  };
  for (let i = 0; i < CELLS; i++) { const d = {}; placeCell(d, -Math.random() * 150 + 8); cellData.push(d); }
  scene.add(cells);

  // Mikro plazma tanecikleri (tek Points; additive)
  const DOTS = 260, dPos = new Float32Array(DOTS * 3), dSpd = new Float32Array(DOTS);
  const placeDot = (i, z) => { const a = Math.random() * Math.PI * 2, rr = 1.2 + Math.random() * 5.2; dPos[i * 3] = Math.cos(a) * rr; dPos[i * 3 + 1] = Math.max(0.3, 3.2 + Math.sin(a) * rr * 0.85); dPos[i * 3 + 2] = z; dSpd[i] = 0.5 + Math.random() * 0.6; };
  for (let i = 0; i < DOTS; i++) placeDot(i, -Math.random() * 110 + 6);
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  const dots = new THREE.Points(dGeo, new THREE.PointsMaterial({ map: dotTexture(THREE), color: 0xfda4af, size: 0.22, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
  dots.frustumCulled = false; scene.add(dots);

  // Işıklar: sıcak ortam + üst ana ışık + karakteri arkadan çizen turkuaz kenar ışığı + karakter üstü nokta ışık
  scene.add(new THREE.HemisphereLight(0xffd6dc, 0x2a0510, 0.95));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0); dir.position.set(2, 8, 6); scene.add(dir);
  const rim = new THREE.DirectionalLight(0x67e8f9, 1.2); rim.position.set(0, 4, -14); scene.add(rim);
  const glow = new THREE.PointLight(0x2dd4bf, 7, 10, 2); glow.position.set(0, 2.5, 1.5); scene.add(glow);

  let pulseT = 0;
  const writeRings = () => {
    for (let i = 0; i < RINGS; i++) {
      v.set(0, 3.2, ringZ[i]); q.identity(); sc.set(1, 1, 1); m4.compose(v, q, sc); rings.setMatrixAt(i, m4);
      for (let k = 0; k < TUBES_PER; k++) { e.set(0, 0, tubeAng[k]); q.setFromEuler(e); m4.compose(v, q, sc); tubes.setMatrixAt(i * TUBES_PER + k, m4); }
    }
    rings.instanceMatrix.needsUpdate = true; tubes.instanceMatrix.needsUpdate = true;
  };
  writeRings();
  return {
    glow,
    /* speed: dünya akış hızı (birim/sn); bpm: kalp hızı (seviyeyle artar) */
    update(dt, speed, bpm) {
      vt.map.offset.y -= speed * dt / (TUNNEL_LEN / 18); vt.emissive.offset.y = vt.bump.offset.y = vt.map.offset.y;
      rt.map.offset.y += speed * dt / (TUNNEL_LEN / 30); rt.emissive.offset.y = rt.map.offset.y;
      pulseT += dt * bpm / 60;
      const ph = pulseT % 1, beat = Math.exp(-ph * 7) + 0.5 * Math.exp(-Math.max(0, ph - 0.22) * 9) * (ph > 0.22 ? 1 : 0);
      const strength = Math.min(1, 0.35 + (bpm - 70) / 120);
      tunnelMat.emissiveIntensity = 0.45 + beat * 0.9 * strength;
      tunnel.scale.set(1 + beat * 0.012 * strength, 1, 1 + beat * 0.012 * strength);
      tubeMat.color.setRGB(0.4 + beat * 0.25 * strength, 0.9, 0.98);
      // Halka kemerler akışla gelir, kameranın arkasına geçince ileri alınır
      if (speed) { for (let i = 0; i < RINGS; i++) { ringZ[i] += speed * dt; if (ringZ[i] > 10) ringZ[i] -= RINGS * RING_GAP; } writeRings(); }
      for (let i = 0; i < CELLS; i++) {
        const d = cellData[i];
        d.z += speed * dt * d.drift; d.rx += d.spin * dt; d.ry += d.spin * 0.7 * dt;
        if (d.z > 10) placeCell(d, -140 - Math.random() * 20);
        e.set(d.rx, d.ry, 0); q.setFromEuler(e); v.set(d.x, d.y, d.z); sc.setScalar(d.s);
        m4.compose(v, q, sc); cells.setMatrixAt(i, m4);
      }
      cells.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < DOTS; i++) {
        dPos[i * 3 + 2] += (speed * dSpd[i] + 1.5) * dt; dPos[i * 3 + 1] += Math.sin(pulseT * 2 + i) * dt * 0.08;
        if (dPos[i * 3 + 2] > 8) placeDot(i, -100 - Math.random() * 10);
      }
      dGeo.attributes.position.needsUpdate = true;
      return beat;
    }
  };
}
