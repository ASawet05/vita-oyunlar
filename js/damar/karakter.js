/* "Nano-Koruyucu" bağışıklık ajanı: beyaz + zümrüt (#0d9488) zırh, sırtında hidrasyonla dolan turkuaz su tüpü.
   Eklemli kollar/bacaklar koşu ritmine göre sallanır; zıplamada takla atar, kaymada yere paralel uzanır.
   Kalkan küresi (C vitamini), altın kanatlar (D3) ve turbo ışıltısı görsel durumlardır. */
export function createRunner(THREE) {
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.25 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.3, metalness: 0.45, emissive: 0x0d9488, emissiveIntensity: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.3 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x0f766e, emissive: 0x2dd4bf, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xccfbf1, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 });
  const water = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 1.4, transparent: true, opacity: 0.95 });

  const root = new THREE.Group();          // dünya konumu (şerit x, yükseklik y)
  const body = new THREE.Group();          // takla / kayma dönüşü (ayak hizasından)
  root.add(body);
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // Gövde
  add(new THREE.CapsuleGeometry(0.3, 0.42, 6, 14), white, 0, 1.24, 0);
  add(new THREE.BoxGeometry(0.5, 0.36, 0.14), teal, 0, 1.34, -0.24);            // göğüs plakası (öne, -z)
  add(new THREE.TorusGeometry(0.3, 0.05, 8, 20), teal, 0, 0.98, 0).rotation.x = Math.PI / 2; // kemer
  // Kafa + vizör
  add(new THREE.SphereGeometry(0.25, 18, 14), white, 0, 1.86, 0);
  const vz = add(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), visor, 0, 1.88, -0.07);
  vz.rotation.x = -Math.PI / 2;
  add(new THREE.ConeGeometry(0.05, 0.22, 8), teal, 0, 2.15, 0.02);               // anten
  // Sırttaki su tüpü (kameraya bakan +z tarafı)
  const tube = new THREE.Group(); tube.position.set(0, 1.26, 0.3); body.add(tube);
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.62, 16, 1, true), glass, 0, 0, 0, tube);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), teal, 0, 0.33, 0, tube);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), teal, 0, -0.33, 0, tube);
  const fill = add(new THREE.CylinderGeometry(0.12, 0.12, 0.58, 14), water, 0, 0, 0, tube);
  // Kollar ve bacaklar (omuz/kalça ve dirsek/diz eklemleri)
  function limb(x, y, upLen, lowLen, r, matUp, matLow, endGeo, endMat) {
    const top = new THREE.Group(); top.position.set(x, y, 0); body.add(top);
    add(new THREE.CapsuleGeometry(r, upLen, 4, 10), matUp, 0, -upLen / 2 - r * 0.2, 0, top);
    const joint = new THREE.Group(); joint.position.set(0, -upLen - r * 0.6, 0); top.add(joint);
    add(new THREE.SphereGeometry(r * 1.05, 10, 8), dark, 0, 0, 0, joint);
    add(new THREE.CapsuleGeometry(r * 0.92, lowLen, 4, 10), matLow, 0, -lowLen / 2 - r * 0.2, 0, joint);
    const end = add(endGeo, endMat, 0, -lowLen - r * 0.7, 0, joint);
    return { top, joint, end };
  }
  const armL = limb(-0.42, 1.55, 0.3, 0.26, 0.085, white, teal, new THREE.SphereGeometry(0.1, 10, 8), teal);
  const armR = limb(0.42, 1.55, 0.3, 0.26, 0.085, white, teal, new THREE.SphereGeometry(0.1, 10, 8), teal);
  const legL = limb(-0.16, 0.95, 0.34, 0.32, 0.1, white, white, new THREE.BoxGeometry(0.2, 0.12, 0.32), teal);
  const legR = limb(0.16, 0.95, 0.34, 0.32, 0.1, white, white, new THREE.BoxGeometry(0.2, 0.12, 0.32), teal);
  legL.end.position.z -= 0.06; legR.end.position.z -= 0.06;
  // Omuz zırhları
  add(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), teal, -0.42, 1.56, 0);
  add(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), teal, 0.42, 1.56, 0);

  // C vitamini kalkanı (şeffaf turuncu/turkuaz küre)
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 18), new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.22, depthWrite: false }));
  const shieldRim = new THREE.Mesh(new THREE.SphereGeometry(1.28, 24, 18), new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.18, wireframe: true, depthWrite: false }));
  shield.position.y = shieldRim.position.y = 1.0; shield.visible = shieldRim.visible = false;
  root.add(shield); root.add(shieldRim);
  // D3 altın kanatlar
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.quadraticCurveTo(0.6, 0.5, 1.2, 0.25); wingShape.quadraticCurveTo(0.8, 0.05, 1.05, -0.2); wingShape.quadraticCurveTo(0.5, -0.1, 0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const wingL = new THREE.Mesh(wingGeo, wingMat), wingR = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(-0.15, 1.45, 0.3); wingR.position.set(0.15, 1.45, 0.3); wingL.scale.x = -1;
  wingL.visible = wingR.visible = false; body.add(wingL); body.add(wingR);
  // Turbo izi
  const trail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  trail.rotation.x = -Math.PI / 2; trail.position.set(0, 1.1, 2.0); trail.visible = false; root.add(trail);

  let phase = 0, t = 0;
  return {
    group: root,
    /* s: { running, speed, airborne, airT, airDur, sliding, slideK (0..1), flying, flapT, hydration, shield, turbo, crashed } */
    update(dt, s) {
      t += dt;
      const run = s.running && !s.crashed;
      phase += dt * (run ? 6 + s.speed * 0.22 : 0);
      const sw = Math.sin(phase), sw2 = Math.sin(phase + Math.PI);
      const air = s.airborne || s.flying;
      // Kollar/bacaklar
      const legAmp = air ? 0.25 : 0.95, armAmp = air ? 0.4 : 0.85;
      legL.top.rotation.x = sw * legAmp; legR.top.rotation.x = sw2 * legAmp;
      legL.joint.rotation.x = Math.max(0, -sw) * 1.3 + (air ? 0.9 : 0); legR.joint.rotation.x = Math.max(0, -sw2) * 1.3 + (air ? 0.9 : 0);
      armL.top.rotation.x = sw2 * armAmp; armR.top.rotation.x = sw * armAmp;
      armL.joint.rotation.x = -0.7 - Math.max(0, sw2) * 0.5; armR.joint.rotation.x = -0.7 - Math.max(0, sw) * 0.5;
      armL.top.rotation.z = s.flying ? 1.2 : 0.08; armR.top.rotation.z = s.flying ? -1.2 : -0.08;
      // Gövde: koşu salınımı, takla (zıplamada), kayma (yere paralel uzanma)
      body.position.y = run && !air && !s.sliding ? Math.abs(Math.sin(phase)) * 0.07 : 0;
      if (s.airborne && !s.flying) body.rotation.x = -Math.PI * 2 * Math.min(1, s.airT / s.airDur); // öne takla
      else body.rotation.x = s.slideK * 1.32;                                                        // kayma: sırt üstü, ayaklar önde
      body.position.z = s.slideK * 0.25;
      if (s.flying) { body.rotation.x = -0.35; body.rotation.z = Math.sin(t * 2) * 0.08; } else body.rotation.z = 0;
      // Su tüpü doluluğu
      const h = Math.max(0.02, Math.min(1, s.hydration / 100));
      fill.scale.y = h; fill.position.y = -0.29 + 0.29 * h;
      water.emissiveIntensity = 1.1 + (s.hydration >= 100 || s.turbo ? Math.sin(t * 18) * 0.6 + 0.6 : 0);
      // Kalkan
      shield.visible = shieldRim.visible = !!s.shield;
      if (s.shield) { const k = 1 + Math.sin(t * 5) * 0.04; shield.scale.setScalar(k); shieldRim.rotation.y += dt * 1.2; shieldRim.rotation.x += dt * 0.6; }
      // D3 kanatları
      wingL.visible = wingR.visible = !!s.flying;
      if (s.flying) { const f = Math.sin(t * 12) * 0.5; wingL.rotation.y = -0.5 + f; wingR.rotation.y = 0.5 - f; }
      // Turbo
      trail.visible = !!s.turbo;
      teal.emissiveIntensity = s.turbo ? 0.9 + Math.sin(t * 20) * 0.3 : 0.15;
      if (s.turbo) trail.material.opacity = 0.18 + Math.random() * 0.15;
    },
    reset() { phase = 0; body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); }
  };
}
