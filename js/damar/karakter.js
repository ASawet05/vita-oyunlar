/* Koşucu karakter — prosedürel, katmanlı zırhlı Nano-Koruyucu.
   Neon vizörlü kask + kulaklıklar, göğüs çekirdeği, karın plakaları, omuz zırhları, dirsek/diz eklem kapakları,
   sırtta borulu ve parlayan enerji/oksijen tüpü (kaykay şarjını gösterir), omurgada neon oklar.
   Eklemler (omuz, dirsek, kalça, diz) koşu döngüsünde akıcı hareket eder; gövde öne eğilir ve hafifçe döner.
   Kostümler (renk/biçim), aksesuarlar (vizör, pelerin, jet kanatları), Nano-Kaykay, D3 Jet-Pack, Mg botları,
   sersemleme yıldızları ve koşu enerji izi. Tüm modeller Three.js geometrileriyle (dış model dosyası yok). */
import { mergeChildren } from "./birlestir.js";
export const SKINS = {
  nano: { main: 0xe2e8f0, accent: 0x059669, visor: 0x22d3ee, joint: 0x134e4a, bulk: 1, slim: 1, aura: null },
  lokosit: { main: 0xfafafa, accent: 0xd4a017, visor: 0xfde047, joint: 0x422006, bulk: 1.14, slim: 1, aura: null, pads: 1.35 },
  oksijen: { main: 0xb91c1c, accent: 0x0f766e, visor: 0x67e8f9, joint: 0x450a0a, bulk: 0.96, slim: 0.9, aura: null, fins: true },
  kokhucre: { main: 0x7c3aed, accent: 0x10b981, visor: 0x34d399, joint: 0x2e1065, bulk: 1, slim: 1, aura: 0xa855f7 },
  efsane: { main: 0xfacc15, accent: 0x0f172a, visor: 0xef4444, joint: 0x0f172a, bulk: 1.08, slim: 1, aura: 0xfde047, halo: true, pads: 1.25 }
};

export function createRunner(THREE) {
  const main = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.28, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.3, metalness: 0.45, emissive: 0x059669, emissiveIntensity: 0.12 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x134e4a, roughness: 0.55, metalness: 0.35 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3, metalness: 0.85 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x0e7490, emissive: 0x22d3ee, emissiveIntensity: 1.5, roughness: 0.08, metalness: 0.6 });
  const neon = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 2.2, roughness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xccfbf1, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const water = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 1.6, transparent: true, opacity: 0.95 });

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const upper = new THREE.Group(); body.add(upper);     // gövde üstü: koşarken hafifçe döner
  const add = (geo, mat, x, y, z, parent = upper) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  // Kavisli zırh kabuğu: elipsoidin ön (front) ya da arka yarısı
  const shell = (rx, ry, rz, front, t0 = 0, t1 = Math.PI) => { const g = new THREE.SphereGeometry(1, 22, 12, front ? Math.PI : 0, Math.PI, t0, t1 - t0); g.scale(rx, ry, rz); return g; };

  /* ---- Gövde ---- */
  const torso = new THREE.Group(); upper.add(torso);
  add(new THREE.CapsuleGeometry(0.25, 0.4, 6, 16), dark, 0, 1.3, 0, torso).scale.set(1.08, 1, 0.8);
  add(shell(0.31, 0.21, 0.23, true, 0.1, Math.PI * 0.62), main, 0, 1.45, -0.01, torso);          // göğüs plakası
  add(shell(0.3, 0.26, 0.22, false, 0.08, Math.PI * 0.7), accent, 0, 1.42, 0.0, torso);           // sırt plakası
  const core = add(new THREE.CircleGeometry(0.055, 20), neon, 0, 1.45, -0.236, torso); core.rotation.y = Math.PI;
  add(new THREE.TorusGeometry(0.068, 0.016, 8, 24), metal, 0, 1.45, -0.232, torso);
  [-1, 1].forEach(sd => {
    const ln = add(new THREE.BoxGeometry(0.012, 0.15, 0.012), neon, sd * 0.1, 1.38, -0.215, torso); ln.rotation.z = sd * 0.55;
    add(new THREE.CircleGeometry(0.03, 14), neon, sd * 0.23, 1.29, -0.17, torso).rotation.y = Math.PI + sd * 0.6;
  });
  for (let r = 0; r < 3; r++) for (let c = -1; c <= 1; c += 2) add(new THREE.BoxGeometry(0.1, 0.06, 0.05), accent, c * 0.058, 1.21 - r * 0.075, -0.19 + r * 0.008, torso);
  add(new THREE.TorusGeometry(0.11, 0.04, 8, 20), main, 0, 1.63, 0, torso).rotation.x = Math.PI / 2;  // yaka
  const belt = add(new THREE.TorusGeometry(0.255, 0.045, 8, 26), main, 0, 1.0, 0, torso); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.82, 1);
  add(shell(0.24, 0.13, 0.19, true, Math.PI * 0.5, Math.PI * 0.95), accent, 0, 0.98, 0, body);   // kalça plakası
  add(new THREE.CapsuleGeometry(0.2, 0.08, 4, 12), dark, 0, 0.93, 0, body).scale.set(1.2, 1, 0.85);

  /* ---- Kask ---- */
  const head = new THREE.Group(); head.position.set(0, 1.87, 0); upper.add(head);
  add(new THREE.CylinderGeometry(0.075, 0.09, 0.12, 12), dark, 0, -0.2, 0, head);
  add(new THREE.SphereGeometry(0.225, 24, 18), main, 0, 0, 0, head).scale.set(0.95, 1.05, 1.06);
  const crest = add(new THREE.TorusGeometry(0.232, 0.05, 8, 24, Math.PI), accent, 0, 0, 0, head); crest.rotation.y = Math.PI / 2; crest.scale.set(1, 1.05, 1.06);
  const vz = add(shell(0.228, 0.15, 0.245, true, Math.PI * 0.4, Math.PI * 0.66), visor, 0, -0.01, 0, head);
  add(shell(0.17, 0.08, 0.22, true, Math.PI * 0.62, Math.PI * 0.95), main, 0, -0.07, -0.01, head);   // çene
  [-1, 1].forEach(sd => {
    const ear = add(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 16), metal, sd * 0.215, -0.01, 0.01, head); ear.rotation.z = Math.PI / 2;
    const dot = add(new THREE.CircleGeometry(0.035, 14), neon, sd * 0.248, -0.01, 0.01, head); dot.rotation.y = sd * Math.PI / 2;
  });
  add(new THREE.BoxGeometry(0.14, 0.025, 0.02), neon, 0, 0.02, 0.236, head);                     // ense neon yarığı

  /* ---- Sırt ünitesi: parlayan enerji/oksijen tüpü (kaykay şarjı) ---- */
  const tube = new THREE.Group(); tube.position.set(0, 1.36, 0.29); upper.add(tube);
  add(new THREE.BoxGeometry(0.4, 0.5, 0.1), metal, 0, 0, -0.02, tube);
  add(new THREE.BoxGeometry(0.3, 0.08, 0.14), metal, 0, 0.27, 0.01, tube); add(new THREE.BoxGeometry(0.3, 0.08, 0.14), metal, 0, -0.27, 0.01, tube);
  add(new THREE.BoxGeometry(0.3, 0.42, 0.07), glass, 0, 0, 0.065, tube);
  const fill = add(new THREE.BoxGeometry(0.26, 0.4, 0.05), water, 0, 0, 0.065, tube);
  const tubeGlow = add(new THREE.PlaneGeometry(0.62, 0.8), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0, 0.11, tube);
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
    const p = add(new THREE.TorusGeometry(0.075, 0.02, 6, 16, Math.PI), neon, sx * 0.19, sy * 0.25, 0.03, tube);
    p.rotation.z = sy > 0 ? (sx > 0 ? -0.3 : 0.3) : Math.PI + (sx > 0 ? 0.3 : -0.3);
  });
  for (let i = 0; i < 3; i++) [-1, 1].forEach(sd => {           // omurga okları
    const c = add(new THREE.BoxGeometry(0.1, 0.022, 0.02), neon, sd * 0.04, 1.06 - i * 0.065, 0.205, upper); c.rotation.z = sd * -0.55;
  });

  /* ---- Uzuvlar (zırh plakalı) ---- */
  function limb(x, y, upLen, lowLen, r, kind) {
    const top = new THREE.Group(); top.position.set(x, y, 0); (kind === "arm" ? upper : body).add(top);
    add(new THREE.CapsuleGeometry(r, upLen, 4, 10), dark, 0, -upLen / 2 - r * 0.2, 0, top);
    add(new THREE.CapsuleGeometry(r * 1.16, upLen * 0.5, 4, 12), kind === "arm" ? accent : main, 0, -upLen * 0.5, kind === "arm" ? 0 : -0.012, top);
    const joint = new THREE.Group(); joint.position.set(0, -upLen - r * 0.6, 0); top.add(joint);
    add(new THREE.SphereGeometry(r * 1.08, 12, 10), metal, 0, 0, 0, joint);
    if (kind === "leg") {
      add(shell(r * 1.35, r * 1.25, r * 1.1, true), main, 0, 0.01, -0.03, joint);                   // diz kapağı
      [-1, 1].forEach(sd => { const d = add(new THREE.CircleGeometry(0.022, 12), neon, sd * r * 1.12, 0, 0, joint); d.rotation.y = sd * Math.PI / 2; });
    }
    add(new THREE.CapsuleGeometry(r * 0.94, lowLen, 4, 10), kind === "arm" ? main : accent, 0, -lowLen / 2 - r * 0.2, 0, joint);
    add(new THREE.CylinderGeometry(r * 1.12, r * 1.02, lowLen * 0.32, 14), kind === "arm" ? accent : main, 0, -lowLen * (kind === "arm" ? 0.78 : 0.62), kind === "arm" ? 0 : -0.01, joint);
    let end;
    if (kind === "arm") end = add(new THREE.SphereGeometry(r * 1.05, 10, 8), dark, 0, -lowLen - r * 0.7, 0, joint);
    else {
      end = new THREE.Group(); end.position.set(0, -lowLen - r * 0.85, -0.05); joint.add(end);
      add(new THREE.BoxGeometry(0.19, 0.11, 0.3), main, 0, 0.01, 0, end);
      add(new THREE.BoxGeometry(0.2, 0.045, 0.32), bootMat, 0, -0.055, -0.005, end);
      add(new THREE.CircleGeometry(0.02, 10), neon, 0.096, 0.02, 0.04, end).rotation.y = Math.PI / 2;
    }
    if (kind === "arm") add(shell(r * 1.2, r * 1.2, r * 1.1, true, 0, Math.PI * 0.5), main, 0, -lowLen * 0.35, -0.01, joint); // dirsek plakası
    return { top, joint, end };
  }
  const bootMat = accent.clone();
  const armL = limb(-0.4, 1.53, 0.26, 0.24, 0.075, "arm"), armR = limb(0.4, 1.53, 0.26, 0.24, 0.075, "arm");
  const legL = limb(-0.15, 0.95, 0.34, 0.33, 0.095, "leg"), legR = limb(0.15, 0.95, 0.34, 0.33, 0.095, "leg");
  // Omuz zırhları + neon halkalar
  const padGeo = new THREE.SphereGeometry(0.145, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const padL = add(padGeo, accent, -0.4, 1.56, 0), padR = add(padGeo, accent, 0.4, 1.56, 0);
  padL.scale.set(1.05, 0.9, 1.1); padR.scale.set(1.05, 0.9, 1.1);
  [-1, 1].forEach(sd => { const d = add(new THREE.CircleGeometry(0.04, 16), neon, sd * 0.505, 1.6, 0, upper); d.rotation.y = sd * Math.PI / 2; add(new THREE.TorusGeometry(0.05, 0.012, 6, 18), metal, sd * 0.503, 1.6, 0, upper).rotation.y = Math.PI / 2; });
  // Oksijen Kuryesi: sırtta hız kanatçıkları
  const finL = add(new THREE.BoxGeometry(0.05, 0.38, 0.22), accent, -0.25, 1.42, 0.32), finR = add(new THREE.BoxGeometry(0.05, 0.38, 0.22), accent, 0.25, 1.42, 0.32);
  finL.rotation.z = 0.35; finR.rotation.z = -0.35;
  // Efsanevi: altın hale
  const halo = add(new THREE.TorusGeometry(0.28, 0.035, 8, 28), new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 1.4 }), 0, 2.32, 0);
  halo.rotation.x = Math.PI / 2;
  // Enerji aurası (Kök Hücre Ustası / Efsanevi)
  const auraMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.16, wireframe: true, depthWrite: false });
  const aura = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), auraMat); aura.position.y = 1.15; root.add(aura);

  /* ---- Aksesuarlar ---- */
  const accVisor = new THREE.Group(); head.add(accVisor);
  const goldM = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.2 });
  const cyanGlass = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.1, transparent: true, opacity: 0.85 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.032, 8, 28), goldM); band.position.set(0, 0.04, 0); band.rotation.x = Math.PI / 2; accVisor.add(band);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.1, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76), cyanGlass); lens.position.set(0, 0.04, 0); accVisor.add(lens);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.22), goldM); fin.position.set(0.262, 0.07, 0.06); accVisor.add(fin);
  const fin2 = fin.clone(); fin2.position.x = -0.262; accVisor.add(fin2);
  const capeGeo = new THREE.PlaneGeometry(0.78, 1.15, 6, 12);
  const capeBase = capeGeo.attributes.position.array.slice();
  const cape = new THREE.Mesh(capeGeo, new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x14b8a6, emissiveIntensity: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  cape.position.set(0, 1.05, 0.42); upper.add(cape);
  const accWings = new THREE.Group(); tube.add(accWings);
  const ewMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.3, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
  const ws = new THREE.Shape(); ws.moveTo(0, 0); ws.lineTo(0.62, 0.32); ws.lineTo(0.5, 0.06); ws.lineTo(0.72, -0.06); ws.lineTo(0.42, -0.14); ws.lineTo(0, -0.08);
  const ewL = new THREE.Mesh(new THREE.ShapeGeometry(ws), ewMat), ewR = new THREE.Mesh(new THREE.ShapeGeometry(ws), ewMat);
  ewL.position.set(-0.18, 0.05, 0.05); ewL.scale.x = -1; ewR.position.set(0.18, 0.05, 0.05); accWings.add(ewL); accWings.add(ewR);

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
  const jet = new THREE.Group(); jet.position.set(0, 1.25, 0.46); upper.add(jet);
  const jetMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.25 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.85 });
  const flames = [];
  [-0.2, 0.2].forEach(x => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 12), jetMat); c.position.set(x, 0, 0); jet.add(c);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 10), flameMat); f.rotation.x = Math.PI; f.position.set(x, -0.5, 0); jet.add(f); flames.push(f);
  });
  jet.visible = false;
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 18), new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.2, depthWrite: false }));
  shield.position.y = 1.0; shield.visible = false; root.add(shield);
  const trail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  trail.rotation.x = -Math.PI / 2; trail.position.set(0, 1.1, 2.0); trail.visible = false; root.add(trail);
  // Koşu enerji izi: sırt ünitesinden geriye uzanan, uca doğru sönen iki ince neon şerit
  const trailTex = (() => { const c = document.createElement("canvas"); c.width = 8; c.height = 128; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 8, 128); return new THREE.CanvasTexture(c); })();
  const energyMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, map: trailTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const energyTrail = new THREE.Group(); root.add(energyTrail);
  [-0.17, 0.17].forEach(x => { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 2.4), energyMat); r.rotation.x = -Math.PI / 2; r.position.set(x, 1.3, 1.6); energyTrail.add(r); });
  const boardTrailMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const boardTrail = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 4.2), boardTrailMat);
  boardTrail.rotation.x = -Math.PI / 2; boardTrail.position.set(0, 0.06, 2.3); boardTrail.visible = false; root.add(boardTrail);
  // Sersemleme yıldızları
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
    visor.emissive.setHex(skin.visor); neon.emissive.setHex(skin.visor); neon.color.setHex(skin.visor); dark.color.setHex(skin.joint);
    water.color.setHex(skin.visor); water.emissive.setHex(skin.visor); tubeGlow.material.color.setHex(skin.visor); energyMat.color.setHex(skin.visor);
    torso.scale.set(skin.bulk * skin.slim, 1, skin.bulk);
    const pad = skin.pads || 1; padL.scale.set(1.05 * pad, 0.9 * pad, 1.1 * pad); padR.scale.set(1.05 * pad, 0.9 * pad, 1.1 * pad);
    finL.visible = finR.visible = !!skin.fins;
    halo.visible = !!skin.halo;
    aura.visible = !!skin.aura; if (skin.aura) auraMat.color.setHex(skin.aura);
    main.metalness = id === "lokosit" || id === "efsane" ? 0.6 : 0.35;
    main.emissive.setHex(id === "kokhucre" ? 0x4c1d95 : id === "efsane" ? 0x854d0e : 0x000000); main.emissiveIntensity = id === "kokhucre" || id === "efsane" ? 0.35 : 0;
  }
  function setAccessories(a) { acc = Object.assign({ visor: false, cape: false, wings: false }, a || {}); accVisor.visible = acc.visor; cape.visible = acc.cape; accWings.visible = acc.wings; }
  function setBoardType(t) {
    boardType = t === "magnezyum" ? "magnezyum" : "plazma";
    boardMat.color.setHex(boardType === "magnezyum" ? 0x6d28d9 : 0x0f766e); boardMat.emissive.setHex(boardType === "magnezyum" ? 0xa855f7 : 0x2dd4bf);
    boardGlow.material.color.setHex(boardType === "magnezyum" ? 0xc084fc : 0x5eead4); springs.visible = boardType === "magnezyum";
  }
  // Çizim çağrılarını azalt: statik parçaları birleştir (referansla güncellenen parçalar korunur)
  const keep = new Set([fill, tubeGlow, padL, padR, finL, finR, halo, cape]);
  [torso, head, tube, upper, body, ...[armL, armR, legL, legR].flatMap(l => [l.top, l.joint, l.end])].forEach(gr => { if (gr && gr.isGroup) mergeChildren(THREE, gr, keep); });
  setSkin("nano"); setAccessories(acc); setBoardType("plazma");

  let phase = 0, t = 0;
  const ease = (cur, to, k) => cur + (to - cur) * k;
  return {
    group: root, setSkin, setAccessories, setBoardType,
    /* s: { running, speed, airborne, airT, airDur, slideK, flying(jet), hydration(=şarj %), shield, turbo, crashed, board, boots, stumble, stunned } */
    update(dt, s) {
      t += dt;
      const run = s.running && !s.crashed, onBoard = !!s.board, air = s.airborne || s.flying, k = Math.min(1, dt * 14);
      phase += dt * (run ? 6 + s.speed * 0.22 : 0);
      const sw = Math.sin(phase), sw2 = Math.sin(phase + Math.PI);
      // Bacaklar: kalça salınımı + diz bükülmesi (geri savrulan bacakta derin); havada toplanır, kaykayda çömelir
      const legAmp = onBoard ? 0.06 : air ? 0.2 : 0.9;
      const hipL = onBoard ? -0.4 : air ? -0.7 + sw * legAmp : sw * legAmp, hipR = onBoard ? -0.4 : air ? -0.2 + sw2 * legAmp : sw2 * legAmp;
      const kneeL = onBoard ? 0.8 : air ? 1.4 : 0.15 + Math.max(0, -sw) * 1.45 + Math.max(0, sw) * 0.25;
      const kneeR = onBoard ? 0.8 : air ? 0.6 : 0.15 + Math.max(0, -sw2) * 1.45 + Math.max(0, sw2) * 0.25;
      legL.top.rotation.x = ease(legL.top.rotation.x, hipL, k); legR.top.rotation.x = ease(legR.top.rotation.x, hipR, k);
      legL.joint.rotation.x = ease(legL.joint.rotation.x, kneeL, k); legR.joint.rotation.x = ease(legR.joint.rotation.x, kneeR, k);
      legL.end.rotation.x = Math.max(0, -sw) * -0.4; legR.end.rotation.x = Math.max(0, -sw2) * -0.4;
      // Kollar: omuz karşı salınım, dirsek koşucu açısında (≈ 90°)
      const armAmp = onBoard ? 0.12 : air ? 0.35 : 0.8;
      armL.top.rotation.x = ease(armL.top.rotation.x, (s.flying ? -0.3 : 0) + sw2 * armAmp, k); armR.top.rotation.x = ease(armR.top.rotation.x, (s.flying ? -0.3 : 0) + sw * armAmp, k);
      armL.joint.rotation.x = ease(armL.joint.rotation.x, s.flying ? -0.3 : -1.15 - Math.max(0, sw2) * 0.35, k); armR.joint.rotation.x = ease(armR.joint.rotation.x, s.flying ? -0.3 : -1.15 - Math.max(0, sw) * 0.35, k);
      armL.top.rotation.z = s.flying ? 1.1 : onBoard ? 0.9 : air ? 0.45 : 0.12; armR.top.rotation.z = s.flying ? -1.1 : onBoard ? -0.9 : air ? -0.45 : -0.12;
      // Gövde: öne eğim, omuz dönüşü, adım sekmesi
      upper.rotation.y = run && !air && !onBoard ? sw * 0.13 : 0;
      head.rotation.y = -upper.rotation.y * 0.7;
      body.position.y = (onBoard ? 0.22 : 0) + (run && !air && !s.slideK && !onBoard ? Math.abs(Math.sin(phase)) * 0.08 - 0.03 : 0);
      if (s.airborne && !s.flying) body.rotation.x = -Math.PI * 2 * Math.min(1, s.airT / s.airDur);
      else body.rotation.x = s.slideK * 1.32 + (run && !onBoard ? -0.14 * (1 - s.slideK) : 0);
      body.position.z = s.slideK * 0.25;
      if (s.flying) { body.rotation.x = -0.45; body.rotation.z = Math.sin(t * 2) * 0.08; }
      else if (s.stumble > 0) { body.rotation.z = Math.sin(s.stumble * 30) * 0.25 * Math.min(1, s.stumble * 3); body.rotation.x += 0.25 * Math.min(1, s.stumble * 3); }
      else body.rotation.z = onBoard ? Math.sin(t * 3) * 0.06 : 0;
      // Sırt tüpü = kaykay şarjı; dolunca nabız gibi parlar
      const h = Math.max(0.03, Math.min(1, s.hydration / 100));
      fill.scale.y = h; fill.position.y = -0.2 + 0.2 * h;
      const pulse = s.hydration >= 100 ? Math.sin(t * 10) * 0.5 + 0.5 : 0;
      water.emissiveIntensity = 1.2 + pulse * 1.2; tubeGlow.material.opacity = 0.14 + h * 0.14 + pulse * 0.2;
      neon.emissiveIntensity = 2.0 + Math.sin(t * 4) * 0.35;
      // Enerji izi: hızla belirginleşir
      energyTrail.visible = run && !s.slideK && !onBoard;
      if (energyTrail.visible) { energyMat.opacity = Math.min(0.55, 0.12 + s.speed * 0.012) * (0.85 + Math.random() * 0.15); energyTrail.position.y = body.position.y; }
      shield.visible = !!s.shield; if (s.shield) shield.scale.setScalar(1 + Math.sin(t * 5) * 0.04);
      trail.visible = !!s.turbo; if (s.turbo) trail.material.opacity = 0.18 + Math.random() * 0.15;
      boardTrail.visible = onBoard && !s.crashed;
      if (boardTrail.visible) { boardTrailMat.color.setHex(boardType === "magnezyum" ? 0xc084fc : 0x2dd4bf); boardTrailMat.opacity = 0.35 + Math.sin(t * 14) * 0.12; }
      stars.visible = s.stunned > 0;
      if (stars.visible) { stars.rotation.y += dt * 4.5; stars.scale.setScalar(Math.min(1, s.stunned)); stars.children.forEach((c, i) => { c.rotation.y += dt * 7; c.position.y = Math.sin(t * 6 + i * 1.3) * 0.05; }); }
      accent.emissiveIntensity = s.turbo ? 0.9 + Math.sin(t * 20) * 0.3 : 0.12;
      board.visible = onBoard; if (onBoard) { boardGlow.material.opacity = 0.25 + Math.sin(t * 8) * 0.12; board.position.y = 0.02 + Math.sin(t * 6) * 0.03; }
      jet.visible = !!s.flying; if (s.flying) flames.forEach(f => { f.scale.set(1, 0.8 + Math.random() * 0.6, 1); });
      bootMat.emissiveIntensity = s.boots ? 1.2 + Math.sin(t * 12) * 0.4 : 0.12; if (s.boots) bootMat.emissive.setHex(0xa855f7); else bootMat.emissive.setHex(skin.accent);
      if (aura.visible) { aura.rotation.y += dt * 0.8; aura.rotation.x += dt * 0.4; auraMat.opacity = 0.12 + Math.sin(t * 4) * 0.06; }
      if (halo.visible) halo.rotation.z += dt * 1.5;
      if (cape.visible) {
        const p = capeGeo.attributes.position, amp = 0.05 + Math.min(0.2, s.speed * 0.006);
        for (let i = 0; i < p.count; i++) {
          const bx = capeBase[i * 3], by = capeBase[i * 3 + 1], kk = (0.575 - by) / 1.15;
          p.setXYZ(i, bx, by, Math.sin(t * 9 + by * 5 + bx * 2) * amp * kk + kk * kk * 0.35);
        }
        p.needsUpdate = true; capeGeo.computeVertexNormals();
      }
      if (accWings.visible) { const f = Math.sin(t * 7) * 0.25; ewL.rotation.y = -f; ewR.rotation.y = f; }
    },
    reset() { phase = 0; body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); upper.rotation.set(0, 0, 0); }
  };
}
