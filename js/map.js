// HARİTA: "Kale" — iki bomba alanı (A doğu, B batı), orta koridor, kemerli geçitler.
// Koordinatlar metre cinsinden. -Z = kuzey (savunma tarafı), +Z = güney (atak doğuşu).
import * as THREE from 'three';
import { colliders } from './physics.js';
import * as TX from './textures.js';

// Kutu yüzeylerine dünya ölçüsüne göre UV ver ki doku esnemesin, tekrar etsin.
function worldUV(geo, w, h, d, s) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * dims[f][0] / s, uv.getY(idx) * dims[f][1] / s);
    }
  }
  uv.needsUpdate = true;
}

export function buildMap(scene) {
  const meshes = []; // ateş edilebilecek (ışın çarpabilecek) yüzeyler

  const mat = {};
  const textures = {
    floor: TX.stoneFloor(), sand: TX.sandWall(), moss: TX.mossWall(), concrete: TX.concrete(),
    crate: TX.crate(), metal: TX.metal(), container: TX.container(),
  };
  for (const k in textures) {
    const shiny = k === 'metal' || k === 'container';
    mat[k] = new THREE.MeshStandardMaterial({
      map: textures[k], roughness: shiny ? 0.55 : 0.92, metalness: shiny ? 0.35 : 0,
    });
  }

  // x,z = merkez, y = taban yüksekliği
  function addBox(x, y, z, w, h, d, m, { uv = 4, collide = true, surface = 'stone' } = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (uv) worldUV(geo, w, h, d, uv);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.surface = surface;
    scene.add(mesh);
    meshes.push(mesh);
    if (collide) {
      colliders.push(new THREE.Box3(
        new THREE.Vector3(x - w / 2, y, z - d / 2),
        new THREE.Vector3(x + w / 2, y + h, z + d / 2),
      ));
    }
    return mesh;
  }
  const rect = (x1, z1, x2, z2, h, m, y = 0, opts) =>
    addBox((x1 + x2) / 2, y, (z1 + z2) / 2, x2 - x1, h, z2 - z1, m, opts);
  const crate = (x, z, s = 1.6, y = 0) =>
    addBox(x, y, z, s, s, s, mat.crate, { uv: 0, surface: 'wood' });
  const metalBox = (x, z, w, h, d, m = mat.metal) =>
    addBox(x, 0, z, w, h, d, m, { uv: 2, surface: 'metal' });

  // ---------- Zemin ----------
  const floorGeo = new THREE.PlaneGeometry(88, 88);
  const fuv = floorGeo.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 88 / 5, fuv.getY(i) * 88 / 5);
  const floor = new THREE.Mesh(floorGeo, mat.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.surface = 'stone';
  scene.add(floor);
  meshes.push(floor);

  // ---------- Dış duvarlar ----------
  rect(-44, -44, 44, -42, 9, mat.sand);
  rect(-44, 42, 44, 44, 9, mat.sand);
  rect(42, -42, 44, 42, 9, mat.sand);
  rect(-44, -42, -42, 42, 9, mat.sand);

  // ---------- Koridorları ayıran binalar ----------
  rect(6, -6, 22, 28, 7, mat.sand);
  rect(5.8, -6.2, 22.2, 28.2, 0.4, mat.concrete, 7);
  rect(-22, -6, -6, 28, 7, mat.sand);
  rect(-22.2, -6.2, -5.8, 28.2, 0.4, mat.concrete, 7);

  // Savunma doğuşunu sitelerden ayıran yosunlu duvarlar
  rect(10, -42, 12, -24, 7, mat.moss);
  rect(-12, -42, -10, -24, 7, mat.moss);

  // ---------- Kemerli geçitler ----------
  // A uzun kapısı (z = 0)
  rect(22, -0.5, 28, 0.5, 7, mat.moss);
  rect(34, -0.5, 42, 0.5, 7, mat.moss);
  rect(28, -0.5, 34, 0.5, 3, mat.moss, 4);
  // B uzun kapısı (z = 4)
  rect(-42, 3.5, -34, 4.5, 7, mat.moss);
  rect(-28, 3.5, -22, 4.5, 7, mat.moss);
  rect(-34, 3.5, -28, 4.5, 3, mat.moss, 4);
  // Orta kapı (z = 10)
  rect(-6, 9.5, -2.5, 10.5, 7, mat.sand);
  rect(2.5, 9.5, 6, 10.5, 7, mat.sand);
  rect(-2.5, 9.5, 2.5, 10.5, 2.6, mat.sand, 4.4);

  // ---------- Orta ----------
  rect(-3, -14, 3, -11, 1.1, mat.concrete);       // bel hizası siper
  crate(-3.5, 0);
  crate(4, 18);
  crate(-4, 24);
  crate(-4, 24, 1.1, 1.6);

  // ---------- A sitesi ----------
  rect(27, -31, 33, -25, 0.3, mat.concrete);       // bomba kurma platformu
  crate(24, -22, 2);
  crate(24, -22, 1.4, 2);
  metalBox(20, -34, 6, 2.8, 3, mat.container);
  metalBox(36, -18, 3, 1.3, 6);
  crate(39, -39, 2.2);
  crate(36.5, -39.4, 1.6);
  // A uzun siperleri
  crate(38, 14, 1.8);
  crate(25, 20, 1.6);

  // ---------- B sitesi ----------
  rect(-24, -38, -18, -32, 0.3, mat.concrete);     // bomba kurma platformu
  crate(-24, -20, 2);
  crate(-36, -18, 1.8);
  crate(-36, -18, 1.3, 1.8);
  metalBox(-30, -30, 6, 2.8, 3, mat.container);
  addBox(-20, 0, -27, 1.5, 7, 1.5, mat.moss);      // sütun
  // B uzun siperleri
  crate(-38, 16, 1.8);
  crate(-25, 26, 1.6);

  // ---------- Doğuş alanları ----------
  // Orta koridordan doğuş noktalarının görünmesini engelleyen duvarlar
  rect(-3, 30.5, 3, 31.5, 4, mat.moss);
  rect(-2.5, -28.5, 2.5, -27.5, 4, mat.moss);
  crate(-6, -38);
  crate(6, -38);
  crate(-15, 37, 1.8);
  crate(15, 37, 1.8);

  // ---------- Site işaretleri ----------
  const signMat = (t, c) => new THREE.MeshBasicMaterial({
    map: TX.letter(t, c), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  const addSign = (t, color, size, x, y, z, rx, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), signMat(t, color));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    scene.add(m);
  };
  addSign('A', 'rgba(255,214,90,0.8)', 4.5, 30, 0.31, -28, -Math.PI / 2, 0);
  addSign('B', 'rgba(255,214,90,0.8)', 4.5, -21, 0.31, -35, -Math.PI / 2, 0);
  addSign('A', 'rgba(255,255,255,0.85)', 4, 41.95, 4.5, -28, 0, -Math.PI / 2);
  addSign('B', 'rgba(255,255,255,0.85)', 4, -41.95, 4.5, -28, 0, Math.PI / 2);

  // ---------- Bot yol ağı (waypoint) ----------
  const P = (x, z) => new THREE.Vector3(x, 0, z);
  const nodes = [
    P(0, -36),   // 0  savunma doğuşu
    P(28, -26),  // 1  A site
    P(31, -9),   // 2  A giriş
    P(31, -4),   // 3  A kapı kuzey
    P(31, 5),    // 4  A kapı güney
    P(31, 22),   // 5  A uzun
    P(28, 35),   // 6  atak doğu
    P(0, 35),    // 7  atak doğuşu
    P(-28, 35),  // 8  atak batı
    P(-31, 22),  // 9  B uzun
    P(-31, 9),   // 10 B kapı güney
    P(-31, -1),  // 11 B kapı kuzey
    P(-30, -9),  // 12 B giriş
    P(-26, -26), // 13 B site
    P(0, 20),    // 14 orta güney
    P(0, 14),    // 15 orta kapı güney
    P(0, 6),     // 16 orta kapı kuzey
    P(0, -3),    // 17 orta kuzey
    P(9, -9),    // 18 orta → A
    P(-9, -9),   // 19 orta → B
    P(6, -20),   // 20 savunma → A
    P(-6, -20),  // 21 savunma → B
    P(36, -32),  // 22 A arka
    P(20, -28),  // 23 A savunma girişi
    P(31, -17),  // 24 A ön
    P(-37, -26), // 25 B arka
    P(-21, -35), // 26 B platform
    P(-16, -22), // 27 B savunma girişi
    P(0, -17),   // 28 orta savunma
    P(5, 32),    // 29 atak doğuşu → orta
  ];
  const links = [
    [0, 20], [0, 21], [20, 1], [20, 18], [21, 13], [21, 19], [1, 2], [2, 3], [3, 4], [4, 5],
    [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [7, 29], [29, 14], [14, 15],
    [15, 16], [16, 17], [17, 18], [17, 19], [18, 2], [19, 12],
    [1, 22], [1, 23], [20, 23], [2, 24], [24, 1], [13, 25], [12, 25], [13, 26], [21, 27], [27, 13],
    [28, 20], [28, 21],
  ];
  const edges = nodes.map(() => []);
  for (const [a, b] of links) { edges[a].push(b); edges[b].push(a); }

  return {
    meshes,
    nodes,
    edges,
    siteNodes: { A: [1, 22, 23, 24], B: [13, 25, 26, 27] },
    spawns: {
      atk: [P(0, 37), P(-2, 39.5), P(2, 39.5), P(-8, 36), P(8, 36)],
      def: [P(0, -35), P(-4, -37), P(4, -37), P(-7, -34), P(7, -34)],
    },
    plantZones: {
      A: { minX: 20, maxX: 41, minZ: -41, maxZ: -15 },
      B: { minX: -41, maxX: -17, minZ: -41, maxZ: -15 },
    },
    plantSpots: { A: P(30, -28), B: P(-21, -35) },
    siteCenters: { A: P(29, -27), B: P(-27, -27) },
    holds: {
      A: [{ p: P(36, -30), look: P(31, -4) }, { p: P(20, -28), look: P(9, -9) }],
      B: [{ p: P(-37, -27), look: P(-31, -1) }, { p: P(-17, -22), look: P(-9, -9) }],
      mid: [{ p: P(0, -16.5), look: P(0, 10) }],
    },
    staging: { A: [P(31, 12), P(30, 8), P(32, 16)], B: [P(-31, 14), P(-30, 10), P(-32, 18)] },
    smokePoints: { A: [P(13, -20), P(33, -33)], B: [P(-13, -20), P(-35, -33)] },
    orbs: [P(30, 13), P(-30, 15)],
    retake: {
      A: { atk: [P(28, -24), P(34, -27), P(24, -30)], def: [P(0, 0), P(31, 14), P(2, -36)] },
      B: { atk: [P(-26, -24), P(-34, -24), P(-22, -31)], def: [P(0, 0), P(-31, 14), P(-2, -36)] },
    },
    // Haritanın kuşbakışı çizimi için (minimap)
    bounds: { minX: -44, maxX: 44, minZ: -44, maxZ: 44 },
  };
}
