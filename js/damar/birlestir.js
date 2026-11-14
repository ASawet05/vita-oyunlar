/* Geometri birleştirme yardımcıları — çizim çağrısı sayısını düşürür (özellikle mobil cihazlarda).
   mergeGeos: [{ geo, matrix }] → tek BufferGeometry (position/normal/uv, indeksli).
   mergeChildren: bir grubun doğrudan alt Mesh'lerini malzemeye göre birleştirir (hariç tutulanlar korunur). */
export function mergeGeos(THREE, items) {
  let vc = 0, ic = 0;
  const prepared = items.map(({ geo, matrix }) => {
    const g = geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count; vc += n; ic += g.index ? g.index.count : n;
    return g;
  });
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  prepared.forEach(g => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
    else { for (let i = 0; i < n; i++) idx[io + i] = vo + i; io += n; }
    vo += n; g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

export function mergeChildren(THREE, group, keep = new Set()) {
  const byMat = new Map();
  group.children.slice().forEach(c => {
    if (!c.isMesh || c.isInstancedMesh || c.children.length || keep.has(c) || Array.isArray(c.material)) return;
    c.updateMatrix();
    if (!byMat.has(c.material)) byMat.set(c.material, []);
    byMat.get(c.material).push(c);
  });
  byMat.forEach((list, mat) => {
    if (list.length < 2) return;
    const geo = mergeGeos(THREE, list.map(m => ({ geo: m.geometry, matrix: m.matrix })));
    list.forEach(m => group.remove(m));
    group.add(new THREE.Mesh(geo, mat));
  });
}
