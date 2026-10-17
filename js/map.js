// HARİTA KURUCU: maps.js'teki çizimden 3D harita, çarpışma kutuları, bot yol ağı ve
// botların kullandığı noktaları (bekleme yerleri, duman noktaları...) otomatik üretir.
import * as THREE from 'three';
import { colliders } from './physics.js';
import * as TX from './textures.js';

const CELL = 4;
const ORIGIN = -44;
const P = (x, z) => new THREE.Vector3(x, 0, z);

// Kutu yüzeylerine dünya ölçüsüne göre UV ver ki doku esnemesin, tekrar etsin.
export function worldUV(geo, w, h, d, s) {
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

// ---------------- Bot yol ağı (1 metrelik ızgara + A*) ----------------
class NavGrid {
  constructor(bounds) {
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.w = Math.round(bounds.maxX - bounds.minX);
    this.h = Math.round(bounds.maxZ - bounds.minZ);
    this.block = new Uint8Array(this.w * this.h);
    const r = 0.42;
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const x = this.minX + i + 0.5, z = this.minZ + j + 0.5;
        for (const c of colliders) {
          if (c.max.y <= 0.45 || c.min.y >= 1.8) continue;
          if (x > c.min.x - r && x < c.max.x + r && z > c.min.z - r && z < c.max.z + r) { this.block[j * this.w + i] = 1; break; }
        }
      }
    }
  }

  idx(x, z) {
    const i = Math.floor(x - this.minX), j = Math.floor(z - this.minZ);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }

  free(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.block[j * this.w + i]; }
  freeAt(x, z) { const k = this.idx(x, z); return k >= 0 && !this.block[k]; }
  center(k) { return P(this.minX + (k % this.w) + 0.5, this.minZ + Math.floor(k / this.w) + 0.5); }

  nearestFree(p) {
    const ci = Math.floor(p.x - this.minX), cj = Math.floor(p.z - this.minZ);
    for (let r = 0; r < 30; r++) {
      let best = -1, bd = Infinity;
      for (let j = cj - r; j <= cj + r; j++) {
        for (let i = ci - r; i <= ci + r; i++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || !this.free(i, j)) continue;
          const d = (i - ci) ** 2 + (j - cj) ** 2;
          if (d < bd) { bd = d; best = j * this.w + i; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // İki nokta arasında düz yürünebilir mi (ızgara üzerinde örnekleme)
  lineFree(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(d / 0.3);
    for (let s = 0; s <= n; s++) {
      const t = n ? s / n : 0;
      if (!this.freeAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  findPath(from, to) {
    const s = this.nearestFree(from), g = this.nearestFree(to);
    if (s < 0 || g < 0) return [to.clone()];
    if (s === g) return [to.clone()];
    const W = this.w;
    const gs = new Float32Array(this.w * this.h).fill(Infinity);
    const came = new Int32Array(this.w * this.h).fill(-1);
    const closed = new Uint8Array(this.w * this.h);
    const gx = g % W, gz = Math.floor(g / W);
    const hf = (k) => { const dx = Math.abs(k % W - gx), dz = Math.abs(Math.floor(k / W) - gz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    // ikili yığın (öncelik kuyruğu)
    const heap = [], fv = [];
    const push = (k, f) => {
      heap.push(k); fv.push(f);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (fv[p] <= fv[i]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]]; [fv[p], fv[i]] = [fv[i], fv[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const lk = heap.pop(), lf = fv.pop();
      if (heap.length) {
        heap[0] = lk; fv[0] = lf;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && fv[l] < fv[m]) m = l;
          if (r < heap.length && fv[r] < fv[m]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; [fv[m], fv[i]] = [fv[i], fv[m]];
          i = m;
        }
      }
      return top;
    };
    gs[s] = 0;
    push(s, hf(s));
    let found = false;
    while (heap.length) {
      const k = pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === g) { found = true; break; }
      const i = k % W, j = Math.floor(k / W);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di, nj = j + dj;
          if (!this.free(ni, nj)) continue;
          if (di && dj && (!this.free(i + di, j) || !this.free(i, j + dj))) continue;
          const nk = nj * W + ni;
          const ng = gs[k] + (di && dj ? 1.414 : 1);
          if (ng < gs[nk]) { gs[nk] = ng; came[nk] = k; push(nk, ng + hf(nk)); }
        }
      }
    }
    if (!found) return [to.clone()];
    const cells = [];
    for (let k = g; k !== -1; k = came[k]) cells.push(this.center(k));
    cells.reverse();
    // Yolu düzleştir (görünür noktaları atla)
    const out = [];
    let cur = from.clone().setY(0);
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !this.lineFree(cur, cells[j])) j--;
      out.push(cells[j]);
      cur = cells[j];
      i = j;
    }
    if (this.freeAt(to.x, to.z)) out.push(to.clone().setY(0));
    return out.length ? out : [to.clone()];
  }

  pathLength(path, from) {
    let len = 0, prev = from;
    for (const p of path) { len += prev.distanceTo(p); prev = p; }
    return len;
  }

  // Yol üzerinde, hedefe "dist" metre kala olan nokta
  pointBeforeEnd(from, path, dist) {
    const pts = [from.clone().setY(0), ...path];
    let remain = dist;
    for (let i = pts.length - 1; i > 0; i--) {
      const seg = pts[i].distanceTo(pts[i - 1]);
      if (seg >= remain) return pts[i].clone().lerp(pts[i - 1], remain / seg);
      remain -= seg;
    }
    return pts[0].clone();
  }
}

// ---------------- Malzemeler (temaya göre, önbellekli) ----------------
const matCache = new Map();
function themeMaterials(key, t) {
  if (matCache.has(key)) return matCache.get(key);
  const std = (map, shiny) => new THREE.MeshStandardMaterial({ map, roughness: shiny ? 0.55 : 0.92, metalness: shiny ? 0.3 : 0 });
  const m = {
    floor: std(TX.stoneFloor(t.floor, t.gap)),
    wall: std(TX.brickWall(t.wall, t.mortar, t.wallStain || 'rgba(90,80,60,A)', t.wallStains || 30)),
    wall2: std(TX.brickWall(t.wall2, t.mortar2, 'rgba(40,30,20,A)', 20, 96, 48)),
    concrete: std(TX.concrete(t.concrete)),
    crate: std(TX.crate()),
    metal: std(TX.metal(), true),
    container: std(TX.container(t.cont[0], t.cont[1]), true),
    sky: TX.sky(t.sky),
  };
  matCache.set(key, m);
  return m;
}

// ---------------- Haritayı kur ----------------
export function buildMap(scene, key, def, env) {
  const t = def.theme;
  const mat = themeMaterials(key, t);
  const objects = [];
  const meshes = [];
  colliders.length = 0;

  // Işık ve gökyüzü
  scene.background = mat.sky;
  scene.fog = new THREE.Fog(t.fog, t.fogNear ?? 70, t.fogFar ?? 180);
  env.sun.color.setHex(t.sun);
  env.sun.intensity = t.sunI;
  env.hemi.color.setHex(t.hemiSky);
  env.hemi.groundColor.setHex(t.hemiGround);
  env.hemi.intensity = t.hemiI;
  env.renderer.toneMappingExposure = t.exposure ?? 1.05;

  const add = (o) => { scene.add(o); objects.push(o); return o; };
  function addBox(x, y, z, w, h, d, m, { uv = 4, collide = true, surface = 'stone' } = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (uv) worldUV(geo, w, h, d, uv);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.surface = surface;
    add(mesh);
    meshes.push(mesh);
    if (collide) colliders.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2)));
    return mesh;
  }

  const grid = def.grid;
  const R = grid.length, C = grid[0].length;
  for (let r = 0; r < R; r++) if (grid[r].length !== C) console.warn(`Harita ${key}: ${r}. satır ${grid[r].length} karakter`);
  const cx = (c) => ORIGIN + c * CELL + CELL / 2;
  const cz = (r) => ORIGIN + r * CELL + CELL / 2;
  const at = (r, c) => (grid[r] && grid[r][c]) || '#';
  const bounds = { minX: ORIGIN, maxX: ORIGIN + C * CELL, minZ: ORIGIN, maxZ: ORIGIN + R * CELL };

  // Zemin
  const W = bounds.maxX - bounds.minX, D = bounds.maxZ - bounds.minZ;
  const floorGeo = new THREE.PlaneGeometry(W, D);
  const fuv = floorGeo.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * W / 5, fuv.getY(i) * D / 5);
  const floor = new THREE.Mesh(floorGeo, mat.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  floor.receiveShadow = true;
  floor.userData.surface = 'stone';
  add(floor);
  meshes.push(floor);

  // Duvarlar: yan yana '#' kareleri tek kutu olur
  for (let r = 0; r < R; r++) {
    let c = 0;
    while (c < C) {
      if (at(r, c) !== '#') { c++; continue; }
      let e = c;
      while (e + 1 < C && at(r, e + 1) === '#') e++;
      const x1 = ORIGIN + c * CELL, x2 = ORIGIN + (e + 1) * CELL;
      const border = r === 0 || r === R - 1 || c === 0 || e === C - 1;
      const h = border ? 9 : 7;
      addBox((x1 + x2) / 2, 0, cz(r), x2 - x1, h, CELL, (r + c) % 3 === 0 && !border ? mat.wall2 : mat.wall);
      if (!border) addBox((x1 + x2) / 2, h, cz(r), x2 - x1 + 0.3, 0.35, CELL + 0.3, mat.concrete);
      c = e + 1;
    }
  }

  const site = { A: [], B: [] };
  const spawns = { atk: [], def: [] };
  const orbs = [];
  const barrierCells = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const ch = at(r, c), x = cx(c), z = cz(r);
      const seed = (r * 31 + c * 17) % 7;
      switch (ch) {
        case '=': // kemer: üstte duvar, altından geçilir
          addBox(x, 3.6, z, CELL, 3.4, CELL, mat.wall2);
          break;
        case 'x':
          addBox(x + (seed - 3) * 0.15, 0, z, 1.8, 1.8, 1.8, mat.crate, { uv: 0, surface: 'wood' });
          if (seed % 2 === 0) addBox(x + 0.9, 0, z + 1.3, 1.3, 1.3, 1.3, mat.crate, { uv: 0, surface: 'wood' });
          if (seed === 4) addBox(x, 1.8, z, 1.2, 1.2, 1.2, mat.crate, { uv: 0, surface: 'wood' });
          break;
        case 'k': {
          const along = (at(r, c - 1) === 'k' || at(r, c + 1) === 'k') || seed % 2 === 0;
          addBox(x, 0, z, along ? 3.7 : 2.5, 2.8, along ? 2.5 : 3.7, mat.container, { uv: 2, surface: 'metal' });
          break;
        }
        case 'c':
          addBox(x, 0, z, seed % 2 ? 3 : 1.4, 1.1, seed % 2 ? 1.2 : 3, mat.concrete);
          break;
        case 'p':
          addBox(x, 0, z, 1.6, 7, 1.6, mat.wall2);
          break;
        case 'A': case 'B': site[ch].push([r, c]); break;
        case 'a': spawns.atk.push(P(x, z)); break;
        case 'd': spawns.def.push(P(x, z)); break;
        case 'o': orbs.push(P(x, z)); break;
        case '-': barrierCells.push([r, c]); break;
        default:
      }
      // site kareleri içindeki engeller de site sayılır
      if ('xkcp'.includes(ch)) {
        for (const s of ['A', 'B']) {
          const n = [at(r - 1, c), at(r + 1, c), at(r, c - 1), at(r, c + 1)].filter((q) => q === s).length;
          if (n >= 2) site[s].push([r, c]);
        }
      }
    }
  }
  // 5 doğuş noktası olsun
  for (const k of ['atk', 'def']) {
    const list = spawns[k];
    list.sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || (k === 'atk' ? b.z - a.z : a.z - b.z));
    while (list.length < 5) list.push(list[list.length % Math.max(1, list.length)].clone().add(P(1.2, 0)));
    spawns[k] = list.slice(0, 5);
  }

  // Satın alma bariyerleri (mavi cam): yan yana olanlar tek panel
  const barrierTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(90,200,255,0.15)');
    g.addColorStop(1, 'rgba(90,200,255,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(190,240,255,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
    }
    const tx = new THREE.CanvasTexture(c);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  })();
  const barrierMat = new THREE.MeshBasicMaterial({ map: barrierTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const barriers = [];
  const isB = (r, c) => at(r, c) === '-';
  const used = new Set();
  const makeBarrier = (x1, z1, x2, z2) => {
    const w = Math.max(0.2, x2 - x1), d = Math.max(0.2, z2 - z1), h = 7;
    const geo = new THREE.BoxGeometry(w, h, d);
    worldUV(geo, w, h, d, 2);
    const mesh = new THREE.Mesh(geo, barrierMat);
    mesh.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
    mesh.visible = false;
    mesh.renderOrder = 2;
    add(mesh);
    barriers.push({ mesh, box: new THREE.Box3(new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, h, z2)) });
  };
  const passable = (r, c) => at(r, c) !== '#';
  for (const [r, c] of barrierCells) {
    if (used.has(`${r},${c}`)) continue;
    let e = c;
    while (isB(r, e + 1)) e++;
    for (let q = c; q <= e; q++) used.add(`${r},${q}`);
    // Geçit doğu-batı yönündeyse (sağı solu açık, üstü altı duvar) panel dikey durur
    const sideDoor = e === c && passable(r, c - 1) && passable(r, c + 1) && !passable(r - 1, c) && !passable(r + 1, c);
    if (sideDoor) makeBarrier(cx(c) - 0.15, ORIGIN + r * CELL, cx(c) + 0.15, ORIGIN + (r + 1) * CELL);
    else {
      // Panel doğuş tarafındaki kenara konur (güneyde saldıran, kuzeyde savunan doğuşu)
      const edge = r > R / 2 ? ORIGIN + (r + 1) * CELL : ORIGIN + r * CELL;
      makeBarrier(ORIGIN + c * CELL, edge - 0.15, ORIGIN + (e + 1) * CELL, edge + 0.15);
    }
  }

  // ---------- Bot yol ağı ve otomatik noktalar ----------
  const nav = new NavGrid(bounds);
  const free = (p) => nav.center(nav.nearestFree(p));
  const plantZones = {}, plantSpots = {}, siteCenters = {}, siteSpots = {}, staging = {}, smokePoints = {}, holds = {}, retake = {};
  for (const s of ['A', 'B']) {
    const cells = site[s];
    const rs = cells.map((q) => q[0]), cs = cells.map((q) => q[1]);
    const z = { minX: ORIGIN + Math.min(...cs) * CELL, maxX: ORIGIN + (Math.max(...cs) + 1) * CELL, minZ: ORIGIN + Math.min(...rs) * CELL, maxZ: ORIGIN + (Math.max(...rs) + 1) * CELL };
    plantZones[s] = z;
    siteCenters[s] = P((z.minX + z.maxX) / 2, (z.minZ + z.maxZ) / 2);
    plantSpots[s] = free(siteCenters[s]);
    siteSpots[s] = [[5, 0], [-5, 0], [0, 5], [0, -5]].map(([dx, dz]) => free(siteCenters[s].clone().add(P(dx, dz))));
    const atkPath = nav.findPath(spawns.atk[0], plantSpots[s]);
    const defPath = nav.findPath(spawns.def[0], plantSpots[s]);
    const stage = free(nav.pointBeforeEnd(spawns.atk[0], atkPath, 22));
    staging[s] = [stage, free(stage.clone().add(P(1.5, 1.5))), free(stage.clone().add(P(-1.5, 1.5)))];
    smokePoints[s] = [free(nav.pointBeforeEnd(spawns.atk[0], atkPath, 6)), free(nav.pointBeforeEnd(spawns.def[0], defPath, 8))];
    const look = nav.pointBeforeEnd(spawns.atk[0], atkPath, 14);
    holds[s] = [{ p: siteSpots[s][3], look }, { p: siteSpots[s][1], look }];
    retake[s] = {
      atk: [plantSpots[s], siteSpots[s][0], siteSpots[s][1]],
      def: [free(nav.pointBeforeEnd(spawns.def[0], defPath, 24)), free(nav.pointBeforeEnd(spawns.atk[0], atkPath, 26)), free(nav.pointBeforeEnd(spawns.atk[0], atkPath, 32).add(P(1.5, 0)))],
    };
  }
  const midPath = nav.findPath(spawns.def[0], spawns.atk[0]);
  const midLen = nav.pathLength(midPath, spawns.def[0]);
  holds.mid = [{ p: free(nav.pointBeforeEnd(spawns.def[0], midPath, midLen * 0.62)), look: nav.pointBeforeEnd(spawns.def[0], midPath, midLen * 0.35) }];

  // Site harfleri (yerde)
  for (const s of ['A', 'B']) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({
      map: TX.letter(s, 'rgba(255,214,90,0.8)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(plantSpots[s]).setY(0.03);
    add(m);
  }

  return {
    key, name: def.name, desc: def.desc,
    objects, meshes, barriers, nav, bounds,
    spawns, orbs, plantZones, plantSpots, siteCenters, siteSpots, staging, smokePoints, holds, retake,
  };
}

export function unloadMap(scene, world) {
  if (!world) return;
  for (const o of world.objects) {
    scene.remove(o);
    if (o.geometry) o.geometry.dispose();
  }
  colliders.length = 0;
}
