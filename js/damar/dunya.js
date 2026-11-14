/* Damar içi dünya: koyu yakut tünel + turkuaz neon damar hatları (nabızla parlayan), 3 şeritli plazma yolu,
   akan kırmızı kan hücreleri, ışıklar ve sis. Görüntü dokuları tuvalde üretilir (dış dosya yok). */
export const LANES = [-2.2, 0, 2.2];
const TUNNEL_LEN = 220, TUNNEL_R = 7.2, ROAD_W = 7.4;

function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* Damar duvarı: taban rengi + yalnızca neon hatları içeren ışıma dokusu */
function veinTextures(THREE) {
  const S = 512, base = document.createElement("canvas"), glow = document.createElement("canvas");
  base.width = base.height = glow.width = glow.height = S;
  const b = base.getContext("2d"), g = glow.getContext("2d"), r = rnd(7);
  const grd = b.createLinearGradient(0, 0, S, S);
  grd.addColorStop(0, "#4a0d1c"); grd.addColorStop(0.5, "#6b1024"); grd.addColorStop(1, "#3a0914");
  b.fillStyle = grd; b.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) { b.fillStyle = `rgba(${120 + r() * 60},${10 + r() * 20},${30 + r() * 20},${0.15 + r() * 0.2})`; b.beginPath(); b.arc(r() * S, r() * S, 4 + r() * 26, 0, Math.PI * 2); b.fill(); }
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
  const branch = (x, y, ang, len, w, depth) => {
    for (const ctx of [b, g]) {
      ctx.save(); ctx.lineCap = "round";
      ctx.strokeStyle = ctx === g ? `rgba(45,212,191,${0.55 + depth * 0.12})` : "rgba(20,4,10,.55)";
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y);
      let cx = x, cy = y;
      const pts = [];
      for (let s = 0; s < 6; s++) { ang += (r() - 0.5) * 0.8; cx += Math.cos(ang) * len / 6; cy += Math.sin(ang) * len / 6; pts.push([cx, cy]); }
      pts.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.stroke(); ctx.restore();
    }
    if (depth > 0) for (let k = 0; k < 2; k++) branch(x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5, ang + (r() - 0.5) * 1.6, len * 0.6, w * 0.6, depth - 1);
  };
  for (let i = 0; i < 7; i++) branch(r() * S, r() * S, r() * Math.PI * 2, 140 + r() * 120, 5, 2);
  // Dikişsiz tekrar için kenarlarda yumuşak geçiş: kopyalanan şerit
  [b, g].forEach(ctx => { ctx.globalAlpha = 0.5; ctx.drawImage(ctx.canvas, 0, 0, S, 24, 0, S - 24, S, 24); ctx.globalAlpha = 1; });
  const mk = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  return { map: mk(base), emissive: mk(glow) };
}
function roadTextures(THREE) {
  const W = 256, H = 256, base = document.createElement("canvas"), glow = document.createElement("canvas");
  base.width = glow.width = W; base.height = glow.height = H;
  const b = base.getContext("2d"), g = glow.getContext("2d"), r = rnd(3);
  b.fillStyle = "#2b0812"; b.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { b.fillStyle = `rgba(150,20,45,${0.15 + r() * 0.2})`; b.beginPath(); b.ellipse(r() * W, r() * H, 6 + r() * 14, 3 + r() * 6, r() * 3, 0, Math.PI * 2); b.fill(); }
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  // Şerit ayraçları (kesikli) ve kenar çizgileri
  const lane = W / 3;
  [lane, lane * 2].forEach(x => {
    for (let y = 0; y < H; y += 64) { g.fillStyle = "#2dd4bf"; g.fillRect(x - 3, y + 8, 6, 36); b.fillStyle = "rgba(45,212,191,.5)"; b.fillRect(x - 3, y + 8, 6, 36); }
  });
  [4, W - 4].forEach(x => { g.fillStyle = "#14b8a6"; g.fillRect(x - 3, 0, 6, H); b.fillStyle = "rgba(20,184,166,.6)"; b.fillRect(x - 3, 0, 6, H); });
  const mk = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  return { map: mk(base), emissive: mk(glow) };
}

export function createWorld(THREE, scene) {
  scene.background = new THREE.Color(0x14040a);
  scene.fog = new THREE.Fog(0x14040a, 28, 125);

  // Tünel (silindir; içten görünür)
  const vt = veinTextures(THREE);
  vt.map.repeat.set(5, 18); vt.emissive.repeat.set(5, 18);
  const tunnelMat = new THREE.MeshStandardMaterial({ map: vt.map, emissiveMap: vt.emissive, emissive: new THREE.Color(0x2dd4bf), emissiveIntensity: 0.7, roughness: 0.85, metalness: 0.05, side: THREE.BackSide });
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(TUNNEL_R, TUNNEL_R, TUNNEL_LEN, 28, 1, true), tunnelMat);
  tunnel.rotation.x = Math.PI / 2; tunnel.position.set(0, 3.2, -TUNNEL_LEN / 2 + 12);
  scene.add(tunnel);

  // Yol (3 şerit)
  const rt = roadTextures(THREE);
  rt.map.repeat.set(1, 30); rt.emissive.repeat.set(1, 30);
  const roadMat = new THREE.MeshStandardMaterial({ map: rt.map, emissiveMap: rt.emissive, emissive: new THREE.Color(0x2dd4bf), emissiveIntensity: 0.9, roughness: 0.6, metalness: 0.1 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, TUNNEL_LEN), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -TUNNEL_LEN / 2 + 12);
  scene.add(road);

  // Akan kan hücreleri (tek çizim çağrısı: InstancedMesh)
  const CELLS = 42, cellGeo = new THREE.TorusGeometry(0.36, 0.2, 8, 18), cellMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5, emissive: 0x3f0610, emissiveIntensity: 0.6 });
  const cells = new THREE.InstancedMesh(cellGeo, cellMat, CELLS);
  const cellData = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const placeCell = (d, z) => {
    const a = Math.PI * (0.05 + Math.random() * 0.9) * (Math.random() < 0.5 ? 1 : -1) + Math.PI / 2; // duvarlara yakın, yolun üstünü kapatmadan
    const rad = 4.6 + Math.random() * 1.8;
    d.x = Math.cos(a) * rad; d.y = 3.2 + Math.sin(a) * rad * 0.9; if (d.y < 0.6) d.y = 0.6 + Math.random();
    if (Math.abs(d.x) < 4.2 && d.y < 4.2) d.x = Math.sign(d.x || 1) * (4.4 + Math.random());
    d.z = z; d.rx = Math.random() * 3; d.ry = Math.random() * 3; d.spin = (Math.random() - 0.5) * 2; d.s = 0.7 + Math.random() * 0.6; d.drift = 0.85 + Math.random() * 0.3;
  };
  for (let i = 0; i < CELLS; i++) { const d = {}; placeCell(d, -Math.random() * 150 + 8); cellData.push(d); }
  scene.add(cells);

  // Işıklar
  scene.add(new THREE.HemisphereLight(0xffd6dc, 0x2a0510, 1.0));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1); dir.position.set(2, 8, 6); scene.add(dir);
  const glow = new THREE.PointLight(0x2dd4bf, 14, 14, 2); glow.position.set(0, 2.5, 1.5); scene.add(glow);

  let pulseT = 0;
  return {
    glow,
    /* speed: dünya akış hızı (birim/sn); bpm: kalp hızı (seviyeyle artar) */
    update(dt, speed, bpm) {
      vt.map.offset.y -= speed * dt / (TUNNEL_LEN / 18); vt.emissive.offset.y = vt.map.offset.y;
      rt.map.offset.y += speed * dt / (TUNNEL_LEN / 30); rt.emissive.offset.y = rt.map.offset.y;
      // Nabız: her vuruşta keskin parlama, sonra sönme (hızlandıkça daha sık ve güçlü)
      pulseT += dt * bpm / 60;
      const ph = pulseT % 1, beat = Math.exp(-ph * 7) + 0.5 * Math.exp(-Math.max(0, ph - 0.22) * 9) * (ph > 0.22 ? 1 : 0);
      const strength = Math.min(1, 0.35 + (bpm - 70) / 120);
      tunnelMat.emissiveIntensity = 0.45 + beat * 0.9 * strength;
      tunnel.scale.set(1 + beat * 0.012 * strength, 1, 1 + beat * 0.012 * strength);
      for (let i = 0; i < CELLS; i++) {
        const d = cellData[i];
        d.z += speed * dt * d.drift; d.rx += d.spin * dt; d.ry += d.spin * 0.7 * dt;
        if (d.z > 10) placeCell(d, -140 - Math.random() * 20);
        e.set(d.rx, d.ry, 0); q.setFromEuler(e); v.set(d.x, d.y, d.z); sc.setScalar(d.s);
        m4.compose(v, q, sc); cells.setMatrixAt(i, m4);
      }
      cells.instanceMatrix.needsUpdate = true;
      return beat;
    }
  };
}
