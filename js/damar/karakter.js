/* Koşucu karakter: kostümler (renk/biçim), aksesuarlar (vizör, pelerin, jet kanatları), Nano-Kaykay,
   D3 Jet-Pack, Magnezyum botları, tökezleme ve kalkan küresi. Eklemli kollar/bacaklar koşu ritmiyle sallanır;
   zıplamada takla, kaymada yere paralel uzanma. Tüm modeller Three.js geometrileriyle (dış model dosyası yok). */
export const SKINS = {
  nano: { main: 0xf1f5f9, accent: 0x0d9488, visor: 0x2dd4bf, joint: 0x1e293b, bulk: 1, slim: 1, aura: null },
  lokosit: { main: 0xfafafa, accent: 0xd4a017, visor: 0xfde047, joint: 0x78350f, bulk: 1.14, slim: 1, aura: null, pads: 1.45 },
  oksijen: { main: 0xb91c1c, accent: 0x2dd4bf, visor: 0x67e8f9, joint: 0x450a0a, bulk: 0.96, slim: 0.9, aura: null, fins: true },
  kokhucre: { main: 0x7c3aed, accent: 0x10b981, visor: 0x34d399, joint: 0x2e1065, bulk: 1, slim: 1, aura: 0xa855f7 },
  efsane: { main: 0xfacc15, accent: 0x0f172a, visor: 0xef4444, joint: 0x0f172a, bulk: 1.08, slim: 1, aura: 0xfde047, halo: true, pads: 1.3 }
};

export function createRunner(THREE) {
  const main = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.25 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.3, metalness: 0.45, emissive: 0x0d9488, emissiveIntensity: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.3 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x0f766e, emissive: 0x2dd4bf, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xccfbf1, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 });
  const water = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 1.4, transparent: true, opacity: 0.95 });

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  const torso = add(new THREE.CapsuleGeometry(0.3, 0.42, 6, 14), main, 0, 1.24, 0);
  add(new THREE.BoxGeometry(0.5, 0.36, 0.14), accent, 0, 1.34, -0.24);
  add(new THREE.TorusGeometry(0.3, 0.05, 8, 20), accent, 0, 0.98, 0).rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.25, 18, 14), main, 0, 1.86, 0);
  const vz = add(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), visor, 0, 1.88, -0.07); vz.rotation.x = -Math.PI / 2;
  add(new THREE.ConeGeometry(0.05, 0.22, 8), accent, 0, 2.15, 0.02);
  const tube = new THREE.Group(); tube.position.set(0, 1.26, 0.3); body.add(tube);
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.62, 16, 1, true), glass, 0, 0, 0, tube);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), accent, 0, 0.33, 0, tube);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), accent, 0, -0.33, 0, tube);
  const fill = add(new THREE.CylinderGeometry(0.12, 0.12, 0.58, 14), water, 0, 0, 0, tube);
  function limb(x, y, upLen, lowLen, r, matUp, matLow, endGeo, endMat) {
    const top = new THREE.Group(); top.position.set(x, y, 0); body.add(top);
    add(new THREE.CapsuleGeometry(r, upLen, 4, 10), matUp, 0, -upLen / 2 - r * 0.2, 0, top);
    const joint = new THREE.Group(); joint.position.set(0, -upLen - r * 0.6, 0); top.add(joint);
    add(new THREE.SphereGeometry(r * 1.05, 10, 8), dark, 0, 0, 0, joint);
    add(new THREE.CapsuleGeometry(r * 0.92, lowLen, 4, 10), matLow, 0, -lowLen / 2 - r * 0.2, 0, joint);
    const end = add(endGeo, endMat, 0, -lowLen - r * 0.7, 0, joint);
    return { top, joint, end };
  }
  const armL = limb(-0.42, 1.55, 0.3, 0.26, 0.085, main, accent, new THREE.SphereGeometry(0.1, 10, 8), accent);
  const armR = limb(0.42, 1.55, 0.3, 0.26, 0.085, main, accent, new THREE.SphereGeometry(0.1, 10, 8), accent);
  const bootMat = accent.clone();
  const legL = limb(-0.16, 0.95, 0.34, 0.32, 0.1, main, main, new THREE.BoxGeometry(0.2, 0.12, 0.32), bootMat);
  const legR = limb(0.16, 0.95, 0.34, 0.32, 0.1, main, main, new THREE.BoxGeometry(0.2, 0.12, 0.32), bootMat);
  legL.end.position.z -= 0.06; legR.end.position.z -= 0.06;
  const padGeo = new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const padL = add(padGeo, accent, -0.42, 1.56, 0), padR = add(padGeo, accent, 0.42, 1.56, 0);
  // Oksijen Kuryesi: sırtta hız kanatçıkları
  const finMat = accent;
  const finL = add(new THREE.BoxGeometry(0.05, 0.38, 0.22), finMat, -0.22, 1.42, 0.3), finR = add(new THREE.BoxGeometry(0.05, 0.38, 0.22), finMat, 0.22, 1.42, 0.3);
  finL.rotation.z = 0.35; finR.rotation.z = -0.35;
  // Efsanevi: altın hale
  const halo = add(new THREE.TorusGeometry(0.28, 0.035, 8, 28), new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 1.4 }), 0, 2.32, 0);
  halo.rotation.x = Math.PI / 2;
  // Enerji aurası (Kök Hücre Ustası / Efsanevi)
  const auraMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.16, wireframe: true, depthWrite: false });
  const aura = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), auraMat); aura.position.y = 1.15; root.add(aura);

  /* ---- Aksesuarlar ---- */
  // D3 Güneş Vizörü: altın çerçeve + turkuaz cam, başı saran bant (arkadan da görünür)
  const accVisor = new THREE.Group(); body.add(accVisor);
  const goldM = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.2 });
  const cyanGlass = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.1, transparent: true, opacity: 0.85 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.035, 8, 28), goldM); band.position.set(0, 1.9, 0); band.rotation.x = Math.PI / 2; accVisor.add(band);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.11, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76), cyanGlass); lens.position.set(0, 1.9, 0); accVisor.add(lens);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.22), goldM); fin.position.set(0.27, 1.93, 0.06); accVisor.add(fin);
  const fin2 = fin.clone(); fin2.position.x = -0.27; accVisor.add(fin2);
  // Plazma Enerji Pelerini: dalgalanan yarı saydam neon turkuaz
  const capeGeo = new THREE.PlaneGeometry(0.78, 1.15, 6, 12);
  const capeBase = capeGeo.attributes.position.array.slice();
  const cape = new THREE.Mesh(capeGeo, new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x14b8a6, emissiveIntensity: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  cape.position.set(0, 1.08, 0.36); body.add(cape);
  // Oksijen Jet Kanatları: tüpün yanlarında parlayan enerji kanatları
  const accWings = new THREE.Group(); tube.add(accWings);
  const ewMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.3, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
  const ws = new THREE.Shape(); ws.moveTo(0, 0); ws.lineTo(0.62, 0.32); ws.lineTo(0.5, 0.06); ws.lineTo(0.72, -0.06); ws.lineTo(0.42, -0.14); ws.lineTo(0, -0.08);
  const ewL = new THREE.Mesh(new THREE.ShapeGeometry(ws), ewMat), ewR = new THREE.Mesh(new THREE.ShapeGeometry(ws), ewMat);
  ewL.position.set(-0.14, 0.05, 0.02); ewL.scale.x = -1; ewR.position.set(0.14, 0.05, 0.02); accWings.add(ewL); accWings.add(ewR);

  /* ---- Nano-Kaykay ---- */
  const board = new THREE.Group(); root.add(board);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, emissive: 0x2dd4bf, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.5 });
  const deck = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 12), boardMat); deck.rotation.x = Math.PI / 2; deck.scale.set(1, 1, 0.22); deck.position.y = 0.12; board.add(deck);
  const boardGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9), new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.35, depthWrite: false }));
  boardGlow.rotation.x = -Math.PI / 2; boardGlow.position.y = 0.02; board.add(boardGlow);
  const springs = new THREE.Group(); board.add(springs);
  const springMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
  [-0.4, 0.4].forEach(z => { const s = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 6, 14), springMat); s.rotation.x = Math.PI / 2; s.position.set(0, 0.0, z); springs.add(s); });
  board.visible = false;

  /* ---- D3 Jet-Pack ---- */
  const jet = new THREE.Group(); jet.position.set(0, 1.2, 0.42); body.add(jet);
  const jetMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.25 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.85 });
  const flames = [];
  [-0.16, 0.16].forEach(x => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 12), jetMat); c.position.set(x, 0, 0); jet.add(c);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 10), flameMat); f.rotation.x = Math.PI; f.position.set(x, -0.5, 0); jet.add(f); flames.push(f);
  });
  jet.visible = false;
  // C kalkanı (tökezleme sonrası kısa koruma görseli olarak da kullanılır)
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 18), new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.2, depthWrite: false }));
  shield.position.y = 1.0; shield.visible = false; root.add(shield);
  // Turbo izi
  const trail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  trail.rotation.x = -Math.PI / 2; trail.position.set(0, 1.1, 2.0); trail.visible = false; root.add(trail);
  // Kaykay neon izi (ayakların altından geriye uzanan parlak şerit)
  const boardTrailMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const boardTrail = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 4.2), boardTrailMat);
  boardTrail.rotation.x = -Math.PI / 2; boardTrail.position.set(0, 0.06, 2.3); boardTrail.visible = false; root.add(boardTrail);
  // Sersemleme yıldızları (başın üstünde dönen sarı yıldızlar)
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.055 : 0.13, a = i / 10 * Math.PI * 2 - Math.PI / 2; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.04, bevelEnabled: false }); starGeo.center();
  const starMat = new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 1.3, metalness: 0.3, roughness: 0.3 });
  const stars = new THREE.Group(); stars.position.set(0, 2.42, 0); stars.visible = false; body.add(stars);
  for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(starGeo, starMat); const a = i / 5 * Math.PI * 2; st.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42); stars.add(st); }

  let skin = SKINS.nano, acc = { visor: false, cape: false, wings: false }, boardType = "plazma";
  function setSkin(id) {
    skin = SKINS[id] || SKINS.nano;
    main.color.setHex(skin.main); accent.color.setHex(skin.accent); accent.emissive.setHex(skin.accent); bootMat.color.setHex(skin.accent); bootMat.emissive.setHex(skin.accent);
    visor.emissive.setHex(skin.visor); dark.color.setHex(skin.joint);
    torso.scale.set(skin.bulk * skin.slim, 1, skin.bulk);
    const pad = skin.pads || 1; padL.scale.setScalar(pad); padR.scale.setScalar(pad);
    finL.visible = finR.visible = !!skin.fins;
    halo.visible = !!skin.halo;
    aura.visible = !!skin.aura; if (skin.aura) auraMat.color.setHex(skin.aura);
    main.metalness = id === "lokosit" || id === "efsane" ? 0.55 : 0.25;
    main.emissive.setHex(id === "kokhucre" ? 0x4c1d95 : id === "efsane" ? 0x854d0e : 0x000000); main.emissiveIntensity = id === "kokhucre" || id === "efsane" ? 0.35 : 0;
  }
  function setAccessories(a) { acc = Object.assign({ visor: false, cape: false, wings: false }, a || {}); accVisor.visible = acc.visor; cape.visible = acc.cape; accWings.visible = acc.wings; }
  function setBoardType(t) {
    boardType = t === "magnezyum" ? "magnezyum" : "plazma";
    boardMat.color.setHex(boardType === "magnezyum" ? 0x6d28d9 : 0x0f766e); boardMat.emissive.setHex(boardType === "magnezyum" ? 0xa855f7 : 0x2dd4bf);
    boardGlow.material.color.setHex(boardType === "magnezyum" ? 0xc084fc : 0x5eead4); springs.visible = boardType === "magnezyum";
  }
  setSkin("nano"); setAccessories(acc); setBoardType("plazma");

  let phase = 0, t = 0;
  return {
    group: root, setSkin, setAccessories, setBoardType,
    /* s: { running, speed, airborne, airT, airDur, slideK, flying(jet), hydration, shield, turbo, crashed, board, boots, stumble } */
    update(dt, s) {
      t += dt;
      const run = s.running && !s.crashed, onBoard = !!s.board;
      phase += dt * (run ? 6 + s.speed * 0.22 : 0);
      const sw = Math.sin(phase), sw2 = Math.sin(phase + Math.PI), air = s.airborne || s.flying;
      // Kaykayda: dizler bükük, kollar dengede (koşu salınımı yok)
      const legAmp = onBoard ? 0.08 : air ? 0.25 : 0.95, armAmp = onBoard ? 0.15 : air ? 0.4 : 0.85;
      legL.top.rotation.x = (onBoard ? -0.35 : 0) + sw * legAmp; legR.top.rotation.x = (onBoard ? -0.35 : 0) + sw2 * legAmp;
      legL.joint.rotation.x = onBoard ? 0.7 : Math.max(0, -sw) * 1.3 + (air ? 0.9 : 0); legR.joint.rotation.x = onBoard ? 0.7 : Math.max(0, -sw2) * 1.3 + (air ? 0.9 : 0);
      armL.top.rotation.x = sw2 * armAmp; armR.top.rotation.x = sw * armAmp;
      armL.joint.rotation.x = -0.7 - Math.max(0, sw2) * 0.5; armR.joint.rotation.x = -0.7 - Math.max(0, sw) * 0.5;
      armL.top.rotation.z = s.flying ? 0.5 : onBoard ? 0.9 : 0.08; armR.top.rotation.z = s.flying ? -0.5 : onBoard ? -0.9 : -0.08;
      body.position.y = (onBoard ? 0.22 : 0) + (run && !air && !s.slideK && !onBoard ? Math.abs(Math.sin(phase)) * 0.07 : 0);
      if (s.airborne && !s.flying) body.rotation.x = -Math.PI * 2 * Math.min(1, s.airT / s.airDur);
      else body.rotation.x = s.slideK * 1.32;
      body.position.z = s.slideK * 0.25;
      if (s.flying) { body.rotation.x = -0.45; body.rotation.z = Math.sin(t * 2) * 0.08; }
      else if (s.stumble > 0) { body.rotation.z = Math.sin(s.stumble * 30) * 0.25 * Math.min(1, s.stumble * 3); body.rotation.x += 0.25 * Math.min(1, s.stumble * 3); }
      else body.rotation.z = onBoard ? Math.sin(t * 3) * 0.06 : 0;
      const h = Math.max(0.02, Math.min(1, s.hydration / 100));
      fill.scale.y = h; fill.position.y = -0.29 + 0.29 * h;
      water.emissiveIntensity = 1.1 + (s.hydration >= 100 || s.turbo ? Math.sin(t * 18) * 0.6 + 0.6 : 0);
      shield.visible = !!s.shield; if (s.shield) shield.scale.setScalar(1 + Math.sin(t * 5) * 0.04);
      trail.visible = !!s.turbo; if (s.turbo) trail.material.opacity = 0.18 + Math.random() * 0.15;
      boardTrail.visible = onBoard && !s.crashed;
      if (boardTrail.visible) { boardTrailMat.color.setHex(boardType === "magnezyum" ? 0xc084fc : 0x2dd4bf); boardTrailMat.opacity = 0.35 + Math.sin(t * 14) * 0.12; }
      stars.visible = s.stunned > 0;
      if (stars.visible) { stars.rotation.y += dt * 4.5; stars.scale.setScalar(Math.min(1, s.stunned)); stars.children.forEach((c, i) => { c.rotation.y += dt * 7; c.position.y = Math.sin(t * 6 + i * 1.3) * 0.05; }); }
      accent.emissiveIntensity = s.turbo ? 0.9 + Math.sin(t * 20) * 0.3 : 0.15;
      // Kaykay
      board.visible = onBoard; if (onBoard) { boardGlow.material.opacity = 0.25 + Math.sin(t * 8) * 0.12; board.position.y = 0.02 + Math.sin(t * 6) * 0.03; }
      // Jet-Pack
      jet.visible = !!s.flying; if (s.flying) flames.forEach(f => { f.scale.set(1, 0.8 + Math.random() * 0.6, 1); });
      // Botlar
      bootMat.emissiveIntensity = s.boots ? 1.2 + Math.sin(t * 12) * 0.4 : 0.15; if (s.boots) bootMat.emissive.setHex(0xa855f7); else bootMat.emissive.setHex(skin.accent);
      // Aura
      if (aura.visible) { aura.rotation.y += dt * 0.8; aura.rotation.x += dt * 0.4; auraMat.opacity = 0.12 + Math.sin(t * 4) * 0.06; }
      if (halo.visible) halo.rotation.z += dt * 1.5;
      // Pelerin dalgası (hızla artar)
      if (cape.visible) {
        const p = capeGeo.attributes.position, amp = 0.05 + Math.min(0.2, s.speed * 0.006);
        for (let i = 0; i < p.count; i++) {
          const bx = capeBase[i * 3], by = capeBase[i * 3 + 1], k = (0.575 - by) / 1.15; // üst kenar sabit
          p.setXYZ(i, bx, by, Math.sin(t * 9 + by * 5 + bx * 2) * amp * k + k * k * 0.35);
        }
        p.needsUpdate = true; capeGeo.computeVertexNormals();
      }
      if (accWings.visible) { const f = Math.sin(t * 7) * 0.25; ewL.rotation.y = -f; ewR.rotation.y = f; }
    },
    reset() { phase = 0; body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); }
  };
}
