// YETENEK SİSTEMİ: dumanlar, flaşlar, molotoflar, duvarlar, taretler, ultiler...
// Her yetenek bir "olay" (ev) ile başlar; tüm bilgisayarlarda aynı şekilde simüle edilir.
// Hasar, can ve açığa çıkarma sadece sunucuda (host) hesaplanır.
import * as THREE from 'three';
import { game } from './game.js';
import { colliders, removeCollider } from './physics.js';
import { ability } from './agents.js';
import * as sfx from './audio.js';
import * as TX from './textures.js';

const GRAV = 15;
const rc = new THREE.Raycaster();
const UP = new THREE.Vector3(0, 1, 0);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
const flashTex = TX.flash();

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function distToLocal(p) {
  const c = game.local;
  return c ? c.pos.distanceTo(p) : 0;
}

// ---------- Yardımcılar ----------
export function aimHit(origin, dir, range) {
  rc.set(origin, dir);
  rc.near = 0;
  rc.far = range;
  const h = rc.intersectObjects(game.blockers, false)[0];
  if (!h) return null;
  const normal = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : UP.clone();
  return { point: h.point.clone(), normal, dist: h.distance };
}

export function groundBelow(p) {
  rc.set(new THREE.Vector3(p.x, p.y + 0.3, p.z), new THREE.Vector3(0, -1, 0));
  rc.near = 0;
  rc.far = 80;
  const h = rc.intersectObjects(game.blockers, false)[0];
  return h ? h.point.y : 0;
}

// Nişan alınan yerdeki zemin noktası
export function groundTarget(origin, dir, range) {
  const h = aimHit(origin, dir, range);
  let p;
  if (h) {
    p = h.point.clone();
    if (h.normal.y < 0.7) p.addScaledVector(dir, -0.5);
  } else {
    p = origin.clone().addScaledVector(dir, range);
  }
  p.y = Math.max(0, groundBelow(p));
  return p;
}

export function worldLOS(a, b) {
  const d = b.clone().sub(a);
  const len = d.length();
  if (len < 0.01) return true;
  rc.set(a, d.divideScalar(len));
  rc.near = 0;
  rc.far = len - 0.05;
  return rc.intersectObjects(game.blockers, false).length === 0;
}

export function throwVel(dir, speed) {
  return dir.clone().add(new THREE.Vector3(0, 0.12, 0)).normalize().multiplyScalar(speed);
}

// Sabit adımlı (her bilgisayarda aynı sonucu veren) fırlatma simülasyonu
export function simulateThrow(origin, vel, { maxTime = 3, bounce = 0.35, stick = false, gravity = GRAV } = {}) {
  const pos = origin.clone();
  const v = vel.clone();
  const dt = 1 / 60;
  const path = [pos.clone()];
  let t = 0, normal = null;
  while (t < maxTime) {
    t += dt;
    const prev = pos.clone();
    v.y -= gravity * dt;
    pos.addScaledVector(v, dt);
    let n = null;
    if (pos.y < 0.08) { pos.y = 0.08; n = new THREE.Vector3(0, 1, 0); } else {
      for (const c of colliders) {
        if (pos.x > c.min.x && pos.x < c.max.x && pos.y > c.min.y && pos.y < c.max.y && pos.z > c.min.z && pos.z < c.max.z) {
          if (prev.y >= c.max.y) { pos.y = c.max.y + 0.02; n = new THREE.Vector3(0, 1, 0); }
          else if (prev.y <= c.min.y) { pos.y = c.min.y - 0.02; n = new THREE.Vector3(0, -1, 0); }
          else if (prev.x <= c.min.x) { pos.x = c.min.x - 0.02; n = new THREE.Vector3(-1, 0, 0); }
          else if (prev.x >= c.max.x) { pos.x = c.max.x + 0.02; n = new THREE.Vector3(1, 0, 0); }
          else if (prev.z <= c.min.z) { pos.z = c.min.z - 0.02; n = new THREE.Vector3(0, 0, -1); }
          else { pos.z = c.max.z + 0.02; n = new THREE.Vector3(0, 0, 1); }
          break;
        }
      }
    }
    path.push(pos.clone());
    if (n) {
      normal = n;
      if (stick) break;
      const dn = v.dot(n);
      v.addScaledVector(n, -(1 + bounce) * dn).multiplyScalar(0.7);
      if (n.y > 0.5 && v.length() < 1.2) break;
    }
  }
  return { path, end: pos.clone(), time: t, normal: normal || UP.clone() };
}

function arcPath(from, to, duration, height) {
  const n = Math.max(2, Math.ceil(duration * 60));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const p = from.clone().lerp(to, k);
    p.y += 4 * height * k * (1 - k);
    pts.push(p);
  }
  return pts;
}

function distToSeg2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx - px, z = az + t * dz - pz;
  return Math.sqrt(x * x + z * z);
}

function segSphere(a, b, c, r) {
  const ab = b.clone().sub(a);
  const l2 = ab.lengthSq();
  let t = l2 ? c.clone().sub(a).dot(ab) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return a.clone().addScaledVector(ab, t).distanceTo(c) < r;
}

function segInter2(a, b, c, d) {
  const cross = (ox, oz, px, pz, qx, qz) => (px - ox) * (qz - oz) - (pz - oz) * (qx - ox);
  const d1 = cross(c.x, c.z, d.x, d.z, a.x, a.z), d2 = cross(c.x, c.z, d.x, d.z, b.x, b.z);
  const d3 = cross(a.x, a.z, b.x, b.z, c.x, c.z), d4 = cross(a.x, a.z, b.x, b.z, d.x, d.z);
  return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
}

// Flaş: karakter flaşa bakıyorsa kör olur
export function applyFlash(c, pos, maxDur) {
  const eye = c.eye();
  const to = pos.clone().sub(eye);
  const d = to.length();
  if (d > 55 || !worldLOS(eye, pos) || game.abilities.blocksVision(eye, pos)) return;
  to.divideScalar(d);
  const dot = c.aimDir().dot(to);
  if (dot < -0.15) return;
  const k = dot > 0.55 ? 1 : 0.3 + Math.max(0, dot) * 0.9;
  c.st.blind = Math.max(c.st.blind, maxDur * k);
}

function addGlow(eff, color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flashTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  s.scale.setScalar(size);
  return eff.add(s);
}

function ball(eff, color, size) {
  const m = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color }));
  m.scale.setScalar(size);
  return eff.add(m);
}

// ---------- Temel yetenek sınıfı ----------
class Effect {
  constructor(ev) {
    this.ev = ev;
    this.id = ev.id;
    this.type = ev.type;
    this.team = ev.team;
    this.owner = game.charById(ev.owner);
    this.origin = V(ev.o);
    this.dir = V(ev.d).normalize();
    this.p = ev.slot === 'W' ? {} : (ability(ev.ag, ev.slot) || {});
    this.t = 0;
    this.done = false;
    this.objs = [];
    this.rand = rng(ev.id + 17);
    this.tick = 0;
  }

  add(o) { game.scene.add(o); this.objs.push(o); return o; }
  remove(o) { game.scene.remove(o); }

  dispose() {
    for (const o of this.objs) {
      game.scene.remove(o);
      if (o.material && o.material !== undefined && o.material.map !== flashTex && !o.material.shared) o.material.dispose?.();
    }
  }

  enemies() { return game.chars.filter((c) => c.alive && c.team !== this.team); }
  allies() { return game.chars.filter((c) => c.alive && c.team === this.team); }
  here(list) { return list.filter((c) => game.controlsHere(c)); }

  // Sunucu bir durum değişikliği yayınlar (ör. duvar parçası kırıldı)
  sync(s) {
    if (!game.isHost) return;
    this.applyState(s);
    game.match.broadcastFx(this.id, s);
  }

  applyState() {}
  start() {}
  update() {}
  blocks() { return false; }
  every(interval, dt) {
    this.tick += dt;
    if (this.tick >= interval) { this.tick -= interval; return true; }
    return false;
  }
}

// Yere/duvara sabitlenen kırılabilir objeler için
class Destructible extends Effect {
  setupHp(hp, meshes) {
    this.hp = hp;
    this.hitList = meshes;
    for (const m of meshes) m.userData = { effect: this, surface: 'metal' };
  }
  takeDamage(dmg) {
    if (this.hp <= 0) return;
    this.hp -= dmg;
    if (this.hp <= 0) this.sync({ dead: 1 });
  }
  applyState(s) {
    if (s.dead) {
      this.hp = 0;
      this.done = true;
      game.fx.explosion(this.hitList[0]?.getWorldPosition(new THREE.Vector3()) || this.origin, 1.2, 0xffd27a);
    }
  }
}

// ---------- DUMANLAR ----------
class SmokeFx extends Effect {
  start() {
    const p = this.p;
    this.color = p.color ?? 0xcccccc;
    if (p.mode === 'throw') {
      const sim = simulateThrow(this.origin, throwVel(this.dir, 21), { stick: true, maxTime: 1.6 });
      this.path = sim.path;
      this.popAt = sim.time;
      this.target = sim.end;
      this.target.y = Math.max(0, groundBelow(this.target));
    } else {
      this.target = groundTarget(this.origin, this.dir, p.range);
      this.popAt = 0.5 + this.target.distanceTo(this.origin) / 45;
      this.path = arcPath(this.origin, this.target, this.popAt, 5);
    }
    this.orb = addGlow(this, this.color, 0.6);
    sfx.ability(distToLocal(this.origin));
  }

  update(dt) {
    const p = this.p;
    if (!this.mesh) {
      this.orb.position.copy(this.path[Math.min(this.path.length - 1, Math.floor(this.t * 60))]);
      if (this.t >= this.popAt) this.pop();
      return;
    }
    const life = this.t - this.popAt;
    const grow = Math.min(1, life / 0.5);
    const shrink = Math.max(0, Math.min(1, (p.duration - life) / 0.6));
    const s = this.radius * grow * shrink;
    this.mesh.scale.set(s, s * 0.88, s);
    if (life >= p.duration) this.done = true;
    if (p.slow) {
      for (const c of this.here(this.enemies())) {
        if (c.pos.distanceTo(this.center) < this.radius) c.st.slow = Math.max(c.st.slow, 0.4);
      }
    }
  }

  pop() {
    this.remove(this.orb);
    this.radius = this.p.radius;
    this.center = this.target.clone();
    this.center.y += this.radius * 0.45;
    this.mesh = this.add(new THREE.Mesh(sphereGeo, new THREE.MeshLambertMaterial({
      color: this.color, emissive: this.color, emissiveIntensity: 0.25,
      transparent: true, opacity: 0.97, side: THREE.DoubleSide,
    })));
    this.mesh.position.copy(this.center);
    this.mesh.scale.setScalar(0.01);
    sfx.smoke(distToLocal(this.center));
  }

  blocks(a, b) {
    if (!this.mesh) return false;
    return segSphere(a, b, this.center, this.mesh.scale.x * 0.95);
  }
}

// ---------- MOLOTOF / ATEŞ ----------
class MollyFx extends Effect {
  start() {
    const sim = simulateThrow(this.origin, throwVel(this.dir, this.p.speed || 16), { bounce: 0.25, maxTime: 1.8 });
    this.path = sim.path;
    this.landAt = sim.time;
    this.target = sim.end;
    this.target.y = Math.max(0, groundBelow(this.target.clone().setY(this.target.y + 0.2)));
    this.orb = addGlow(this, 0xff7a1a, 0.5);
    sfx.ability(distToLocal(this.origin));
  }

  update(dt) {
    const p = this.p;
    if (!this.fire) {
      this.orb.position.copy(this.path[Math.min(this.path.length - 1, Math.floor(this.t * 60))]);
      if (this.t >= this.landAt) this.ignite();
      return;
    }
    const life = this.t - this.landAt;
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i];
      f.scale.setScalar(0.9 + Math.sin(game.time * 12 + i) * 0.25);
      f.position.y = this.target.y + 0.4 + Math.sin(game.time * 8 + i * 2) * 0.1;
    }
    this.fire.material.opacity = 0.55 + Math.sin(game.time * 15) * 0.1;
    if (game.isHost && this.every(0.25, dt)) {
      for (const c of game.chars) {
        if (!c.alive) continue;
        const d = Math.hypot(c.pos.x - this.target.x, c.pos.z - this.target.z);
        if (d > p.radius || Math.abs(c.pos.y - this.target.y) > 1.6) continue;
        if (c.team !== this.team) game.match.applyDamage(c, p.dps * 0.25, this.owner, 'body', p.name);
        else if (c === this.owner && this.owner.agent === 'ember') game.match.heal(c, 3);
      }
    }
    if (life >= p.duration) this.done = true;
  }

  ignite() {
    this.remove(this.orb);
    const r = this.p.radius;
    this.fire = this.add(new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({
      color: 0xff5a10, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending,
    })));
    this.fire.rotation.x = -Math.PI / 2;
    this.fire.position.copy(this.target).setY(this.target.y + 0.05);
    this.flames = [];
    for (let i = 0; i < 14; i++) {
      const a = this.rand() * Math.PI * 2, d = Math.sqrt(this.rand()) * r * 0.9;
      const f = addGlow(this, 0xff8a2a, 1.1);
      f.position.set(this.target.x + Math.cos(a) * d, this.target.y + 0.4, this.target.z + Math.sin(a) * d);
      this.flames.push(f);
    }
    sfx.smoke(distToLocal(this.target));
  }
}

// ---------- FLAŞ ----------
class FlashFx extends Effect {
  start() {
    const p = this.p;
    if (p.mode === 'wall') {
      const h = aimHit(this.origin, this.dir, p.range);
      this.popPos = h ? h.point.clone().addScaledVector(this.dir, 1.6) : this.origin.clone().addScaledVector(this.dir, p.range);
      this.popAt = p.pop;
      this.path = arcPath(this.origin, this.popPos, this.popAt, 0.3);
    } else {
      const sim = simulateThrow(this.origin, this.dir.clone().multiplyScalar(p.speed), { gravity: 2, bounce: 0.5, maxTime: p.pop });
      this.path = sim.path;
      this.popAt = Math.min(p.pop, sim.time);
      this.popPos = sim.end;
    }
    this.orb = addGlow(this, 0xffffff, 0.45);
    sfx.ability(distToLocal(this.origin));
  }

  update() {
    if (!this.popped) {
      this.orb.position.copy(this.path[Math.min(this.path.length - 1, Math.floor(this.t * 60))]);
      if (this.t >= this.popAt) {
        this.popped = true;
        this.popPos = this.orb.position.clone();
        this.orb.scale.setScalar(5);
        sfx.flashPop(distToLocal(this.popPos));
        for (const c of this.here(this.enemies())) applyFlash(c, this.popPos, this.p.blind);
      }
    } else {
      const k = (this.t - this.popAt) / 0.35;
      this.orb.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) this.done = true;
    }
  }
}

// Kira: Kötü Göz — ona bakanların görüşü daralır
class LeerFx extends Effect {
  start() {
    this.from = this.origin.clone();
    this.to = this.origin.clone().addScaledVector(this.dir, 9);
    this.orb = addGlow(this, 0xc04dff, 1.0);
    this.core = ball(this, 0xff66ff, 0.12);
    sfx.ability(distToLocal(this.origin));
  }
  update(dt) {
    const k = Math.min(1, this.t / 0.5);
    const pos = this.from.clone().lerp(this.to, k);
    this.orb.position.copy(pos);
    this.core.position.copy(pos);
    if (this.t > 0.5 && this.every(0.15, dt)) {
      for (const c of this.here(this.enemies())) {
        const eye = c.eye();
        const to = pos.clone().sub(eye).normalize();
        if (c.aimDir().dot(to) > 0.6 && worldLOS(eye, pos)) c.st.nearsight = Math.max(c.st.nearsight, 0.8);
      }
    }
    if (this.t > 0.5 + this.p.duration) this.done = true;
  }
}

// ---------- BOMBALAR (el bombası, küme bombası, sersemletme, patlama paketi) ----------
class GrenadeFx extends Effect {
  start() {
    const p = this.p;
    const satchel = this.type === 'satchel';
    const fuse = satchel ? 1.0 : p.fuse;
    const sim = simulateThrow(this.origin, throwVel(this.dir, p.speed || 17), { bounce: 0.4, maxTime: fuse, stick: satchel });
    this.path = sim.path;
    this.fuse = fuse;
    this.orb = ball(this, satchel ? 0x18c6b5 : this.type === 'stunGrenade' ? 0xd8ff6a : 0x333333, 0.12);
    this.glow = addGlow(this, satchel ? 0x18c6b5 : 0xff4655, 0.4);
    this.subs = [];
    sfx.ability(distToLocal(this.origin));
  }

  update() {
    if (!this.exploded) {
      const pos = this.path[Math.min(this.path.length - 1, Math.floor(this.t * 60))];
      this.orb.position.copy(pos);
      this.glow.position.copy(pos);
      if (this.t >= this.fuse) this.explode(pos.clone());
      return;
    }
    for (const s of this.subs) {
      if (!s.done && this.t >= s.at) { s.done = true; this.blast(s.pos, 3.5, 35, 0xff9a3a); }
    }
    if (this.subs.every((s) => s.done)) this.done = true;
  }

  explode(pos) {
    this.exploded = true;
    this.remove(this.orb);
    this.remove(this.glow);
    const p = this.p;
    if (this.type === 'stunGrenade') {
      game.fx.explosion(pos, p.radius, 0xb8ff4a);
      sfx.explosion(distToLocal(pos));
      for (const c of this.here(this.enemies())) {
        if (c.pos.distanceTo(pos) < p.radius && worldLOS(pos, c.eye())) c.st.stun = Math.max(c.st.stun, p.stun);
      }
    } else if (this.type === 'satchel') {
      game.fx.explosion(pos, 3, 0x18c6b5);
      sfx.explosion(distToLocal(pos));
      for (const c of game.chars) {
        if (!c.alive) continue;
        const d = c.pos.distanceTo(pos);
        if (d > 5) continue;
        if (game.controlsHere(c) && (c === this.owner || c.team !== this.team)) {
          const push = c.pos.clone().sub(pos).setY(0);
          if (push.lengthSq() < 0.01) push.copy(this.dir).setY(0);
          push.normalize().multiplyScalar(c === this.owner ? 11 : 8);
          c.vel.x += push.x;
          c.vel.z += push.z;
          c.vel.y = c === this.owner ? 10 : 6;
          c.onGround = false;
          c.launchT = 0.6;
        }
        if (game.isHost && c.team !== this.team) game.match.applyDamage(c, 25, this.owner, 'body', p.name);
      }
    } else {
      this.blast(pos, p.radius, p.dmg, 0xff8a2a);
      if (p.cluster) {
        for (let i = 0; i < p.cluster; i++) {
          const a = this.rand() * Math.PI * 2, d = 1.5 + this.rand() * 2.5;
          const sp = pos.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
          sp.y = Math.max(0, groundBelow(sp.clone().setY(pos.y + 0.5))) + 0.2;
          this.subs.push({ at: this.t + 0.4 + this.rand() * 0.5, pos: sp, done: false });
        }
      }
    }
  }

  blast(pos, radius, dmg, color) {
    game.fx.explosion(pos, radius * 0.8, color);
    sfx.explosion(distToLocal(pos));
    if (!game.isHost) return;
    for (const c of this.enemies()) {
      const d = c.pos.distanceTo(pos);
      if (d > radius || !worldLOS(pos.clone().setY(pos.y + 0.3), c.eye())) continue;
      game.match.applyDamage(c, dmg * (1 - 0.6 * d / radius), this.owner, 'body', this.p.name);
    }
  }
}

// ---------- OKLAR ----------
class DartFx extends Effect {
  start() {
    const sim = simulateThrow(this.origin, this.dir.clone().multiplyScalar(38), { gravity: 7, stick: true, maxTime: 2 });
    this.path = sim.path;
    this.hitAt = sim.time;
    this.normal = sim.normal;
    this.arrow = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6),
      new THREE.MeshBasicMaterial({ color: this.type === 'shockDart' ? 0x6fe7ff : 0x9ff7ff })));
    this.glow = addGlow(this, 0x6fe7ff, 0.5);
    this.pulses = this.type === 'revealDart' ? [0.4, 2.2] : [];
    sfx.ability(distToLocal(this.origin));
  }

  update() {
    const i = Math.min(this.path.length - 1, Math.floor(this.t * 60));
    const pos = this.path[i];
    this.arrow.position.copy(pos);
    this.glow.position.copy(pos);
    if (i > 0) {
      const d = pos.clone().sub(this.path[i - 1]);
      if (d.lengthSq() > 1e-6) this.arrow.quaternion.setFromUnitVectors(UP, d.normalize());
    }
    if (this.t < this.hitAt) return;
    const at = this.path[this.path.length - 1].clone().addScaledVector(this.normal, 0.3);
    if (this.type === 'shockDart') {
      if (!this.exploded && this.t >= this.hitAt + 0.25) {
        this.exploded = true;
        game.fx.explosion(at, this.p.radius, 0x6fe7ff);
        sfx.explosion(distToLocal(at));
        if (game.isHost) {
          for (const c of this.enemies()) {
            const d = c.pos.distanceTo(at);
            if (d < this.p.radius && worldLOS(at, c.eye())) game.match.applyDamage(c, this.p.dmg * (1 - 0.4 * d / this.p.radius), this.owner, 'body', this.p.name);
          }
        }
      }
      if (this.t > this.hitAt + 0.6) this.done = true;
      return;
    }
    // Keşif oku: iki tarama
    while (this.pulses.length && this.t >= this.hitAt + this.pulses[0]) {
      this.pulses.shift();
      game.fx.pulse(at, this.p.radius, 0x6fe7ff, 0.9, 0.5, true);
      sfx.ability(distToLocal(at));
      if (game.isHost) {
        for (const c of this.enemies()) {
          if (c.pos.distanceTo(at) < this.p.radius && worldLOS(at, c.eye())) game.match.reveal(c, 3);
        }
      }
    }
    if (!this.pulses.length && this.t > this.hitAt + 2.6) this.done = true;
  }
}

// Hawk: Baykuş Darbesi — düştüğü yerde 3 tarama
class ScoutPulseFx extends Effect {
  start() {
    const sim = simulateThrow(this.origin, throwVel(this.dir, this.p.speed || 18), { bounce: 0.3, maxTime: 2 });
    this.path = sim.path;
    this.landAt = sim.time;
    this.orb = addGlow(this, 0x7ff0ff, 0.7);
    this.left = this.p.pulses || 3;
    this.next = this.landAt + 0.4;
    sfx.ability(distToLocal(this.origin));
  }
  update() {
    const pos = this.path[Math.min(this.path.length - 1, Math.floor(this.t * 60))];
    this.orb.position.copy(pos);
    if (this.t >= this.next && this.left > 0) {
      this.left--;
      this.next += 1.2;
      game.fx.pulse(pos, this.p.radius, 0x7ff0ff, 0.8, 0.45, true);
      if (game.isHost) for (const c of this.enemies()) if (c.pos.distanceTo(pos) < this.p.radius) game.match.reveal(c, 2);
    }
    if (this.left <= 0 && this.t > this.next - 0.6) this.done = true;
  }
}

// ---------- YAVAŞLATMA ----------
class SlowOrbFx extends Effect {
  start() {
    const sim = simulateThrow(this.origin, throwVel(this.dir, this.p.speed || 18), { bounce: 0.2, maxTime: 1.6 });
    this.path = sim.path;
    this.landAt = sim.time;
    this.orb = addGlow(this, 0x9ff7ff, 0.5);
    sfx.ability(distToLocal(this.origin));
  }
  update() {
    const p = this.p;
    if (!this.field) {
      this.orb.position.copy(this.path[Math.min(this.path.length - 1, Math.floor(this.t * 60))]);
      if (this.t >= this.landAt) {
        this.remove(this.orb);
        this.pos = this.orb.position.clone();
        this.pos.y = Math.max(0, groundBelow(this.pos.clone().setY(this.pos.y + 0.3)));
        this.field = this.add(new THREE.Mesh(new THREE.CircleGeometry(p.radius, 32), new THREE.MeshBasicMaterial({
          color: 0x9ff7ff, transparent: true, opacity: 0.35, depthWrite: false,
        })));
        this.field.rotation.x = -Math.PI / 2;
        this.field.position.copy(this.pos).setY(this.pos.y + 0.04);
        for (let i = 0; i < 10; i++) {
          const a = this.rand() * Math.PI * 2, d = Math.sqrt(this.rand()) * p.radius * 0.9;
          const crystal = this.add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 5),
            new THREE.MeshStandardMaterial({ color: 0xbff8ff, emissive: 0x4fd8ff, emissiveIntensity: 0.5 })));
          crystal.position.set(this.pos.x + Math.cos(a) * d, this.pos.y + 0.25, this.pos.z + Math.sin(a) * d);
        }
      }
      return;
    }
    for (const c of this.here(this.enemies())) {
      if (Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) < p.radius && c.pos.y - this.pos.y < 1.5) {
        c.st.slow = Math.max(c.st.slow, 0.3);
      }
    }
    if (this.t > this.landAt + p.duration) this.done = true;
  }
}

// ---------- İYİLEŞTİRME ----------
class HealFx extends Effect {
  start() {
    const p = this.p;
    const o = this.owner;
    if (!o) { this.done = true; return; }
    let targets = [o];
    let amount = p.amount, dur = 3;
    if (this.type === 'healOrb') {
      dur = 4;
      let best = null, bestDot = Math.cos(THREE.MathUtils.degToRad(8));
      for (const c of this.allies()) {
        if (c === o) continue;
        const to = c.pos.clone().setY(c.pos.y + 1.2).sub(this.origin);
        const d = to.length();
        if (d > 15) continue;
        const dot = to.divideScalar(d).dot(this.dir);
        if (dot > bestDot && worldLOS(this.origin, c.eye())) { best = c; bestDot = dot; }
      }
      if (best) targets = [best];
    } else if (this.type === 'healArea') {
      targets = this.allies().filter((c) => c.pos.distanceTo(o.pos) < p.radius);
    } else if (this.type === 'devour') {
      dur = 1.5;
    }
    for (const c of targets) {
      game.fx.pulse(c.pos.clone().setY(c.pos.y + 1), 1.5, 0x6aff9a, 0.8, 0.5);
      if (game.isHost) {
        c.st.heal = dur;
        c.healRate = amount / dur;
      }
    }
    sfx.ability(distToLocal(o.pos));
    this.done = true;
  }
}

// ---------- BUZ DUVARI ----------
class WallFx extends Effect {
  start() {
    const p = this.p;
    const center = groundTarget(this.origin, this.dir, p.range || 10);
    const alongZ = Math.abs(this.dir.x) > Math.abs(this.dir.z);
    this.segs = [];
    const n = 4, segW = 1.75, h = 3.2, th = 0.5;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xa8f4ff, emissive: 0x2fb8d8, emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.1,
      transparent: true, opacity: 0.88,
    });
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * segW;
      const x = center.x + (alongZ ? 0 : off), z = center.z + (alongZ ? off : 0);
      const w = alongZ ? th : segW - 0.05, d = alongZ ? segW - 0.05 : th;
      const y = groundBelow(new THREE.Vector3(x, center.y + 1, z));
      const mesh = this.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData = { effect: this, seg: i, surface: 'ice' };
      mesh.scale.y = 0.05;
      const box = new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2));
      colliders.push(box);
      game.blockers.push(mesh);
      this.segs.push({ mesh, box, hp: 800, alive: true });
    }
    sfx.ability(distToLocal(center));
  }

  update() {
    const k = Math.min(1, this.t / 0.8);
    for (const s of this.segs) if (s.alive) s.mesh.scale.y = Math.max(0.05, k);
    if (this.t > 30) this.done = true;
  }

  takeDamage(dmg, seg) {
    const s = this.segs[seg];
    if (!s || !s.alive) return;
    s.hp -= dmg;
    if (s.hp <= 0) this.sync({ dead: seg });
  }

  applyState(st) {
    const s = this.segs[st.dead];
    if (!s || !s.alive) return;
    this.killSeg(s);
    game.fx.burst(s.mesh.position, UP, 0xbff4ff, 18, 4);
  }

  killSeg(s) {
    s.alive = false;
    this.remove(s.mesh);
    removeCollider(s.box);
    const i = game.blockers.indexOf(s.mesh);
    if (i >= 0) game.blockers.splice(i, 1);
  }

  get hitList() { return this.segs.filter((s) => s.alive).map((s) => s.mesh); }

  dispose() {
    for (const s of this.segs) if (s.alive) this.killSeg(s);
    super.dispose();
  }
}

// ---------- ATEŞ DUVARI ----------
class FireWallFx extends Effect {
  start() {
    const p = this.p;
    this.a = this.origin.clone().setY(0);
    const d = this.dir.clone().setY(0);
    if (d.lengthSq() < 1e-4) d.set(0, 0, -1);
    this.hdir = d.normalize();
    this.len = p.length;
    this.planes = [];
    const n = 8;
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6a1a, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < n; i++) {
      const pl = this.add(new THREE.Mesh(new THREE.PlaneGeometry(this.len / n + 0.1, 3.6), mat));
      const k = (i + 0.5) / n;
      const pos = this.a.clone().addScaledVector(this.hdir, k * this.len);
      pos.y = groundBelow(pos.clone().setY(3)) + 1.8;
      pl.position.copy(pos);
      pl.rotation.y = Math.atan2(this.hdir.x, this.hdir.z) + Math.PI / 2;
      pl.visible = false;
      this.planes.push({ mesh: pl, k });
    }
    sfx.ability(distToLocal(this.origin));
  }

  get extent() { return Math.min(1, this.t / 0.8); }

  update(dt) {
    const p = this.p;
    for (const pl of this.planes) {
      pl.mesh.visible = pl.k <= this.extent;
      pl.mesh.scale.y = 0.85 + Math.sin(game.time * 10 + pl.k * 9) * 0.12;
    }
    const b = this.a.clone().addScaledVector(this.hdir, this.len * this.extent);
    if (game.isHost && this.every(0.25, dt)) {
      for (const c of game.chars) {
        if (!c.alive || c.pos.y > 3.5) continue;
        if (distToSeg2(c.pos.x, c.pos.z, this.a.x, this.a.z, b.x, b.z) > 0.9) continue;
        if (c.team !== this.team) game.match.applyDamage(c, p.dps * 0.25, this.owner, 'body', p.name);
        else if (c === this.owner) game.match.heal(c, 3);
      }
    }
    if (this.t > p.duration) this.done = true;
  }

  blocks(a, b) {
    if (a.y > 3.6 && b.y > 3.6) return false;
    const e = this.a.clone().addScaledVector(this.hdir, this.len * this.extent);
    return segInter2(a, b, this.a, e);
  }
}

// ---------- IŞINLANMA ----------
class TeleportFx extends Effect {
  start() {
    this.target = groundTarget(this.origin, this.dir, this.p.range);
    this.mark = addGlow(this, 0x6c5cff, 0.2);
    this.mark.position.copy(this.target).setY(this.target.y + 1);
    this.src = addGlow(this, 0x2a1a5a, 1.5);
    if (this.owner) this.src.position.copy(this.owner.pos).setY(this.owner.pos.y + 1);
    sfx.ability(distToLocal(this.origin));
  }
  update() {
    const k = Math.min(1, this.t / this.p.delay);
    this.mark.scale.setScalar(0.2 + k * 2.2);
    if (this.t >= this.p.delay && !this.moved) {
      this.moved = true;
      const o = this.owner;
      if (o && o.alive && game.controlsHere(o)) {
        o.pos.copy(this.target);
        o.vel.set(0, 0, 0);
      }
      sfx.ability(distToLocal(this.target));
    }
    if (this.t > this.p.delay + 0.4) this.done = true;
  }
}

// ---------- NYX: PARANOYA ----------
class BlindLineFx extends Effect {
  start() {
    this.orb = addGlow(this, 0x2a1450, 2.6);
    this.orb.material.blending = THREE.NormalBlending;
    this.core = addGlow(this, 0x6c5cff, 1.2);
    this.hitSet = new Set();
    sfx.ability(distToLocal(this.origin));
  }
  update() {
    const d = this.t * 25;
    const pos = this.origin.clone().addScaledVector(this.dir, d);
    this.orb.position.copy(pos);
    this.core.position.copy(pos);
    for (const c of this.here(this.enemies())) {
      if (!this.hitSet.has(c) && c.eye().distanceTo(pos) < 2.8) {
        this.hitSet.add(c);
        c.st.nearsight = Math.max(c.st.nearsight, this.p.dur);
      }
    }
    if (d > this.p.range) this.done = true;
  }
}

// ---------- ATLAS: DESTEK İŞARETİ ----------
class StimFx extends Effect {
  start() {
    const p = this.p;
    this.pos = groundTarget(this.origin, this.dir, p.range);
    this.beacon = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xff9c3a, emissiveIntensity: 0.6 })));
    this.beacon.position.copy(this.pos).setY(this.pos.y + 0.35);
    this.ring = this.add(new THREE.Mesh(new THREE.RingGeometry(p.radius - 0.15, p.radius, 40),
      new THREE.MeshBasicMaterial({ color: 0xff9c3a, transparent: true, opacity: 0.6, side: THREE.DoubleSide })));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.copy(this.pos).setY(this.pos.y + 0.05);
    sfx.ability(distToLocal(this.pos));
  }
  update() {
    for (const c of this.here(this.allies())) {
      if (c.pos.distanceTo(this.pos) < this.p.radius) c.st.stim = Math.max(c.st.stim, 0.4);
    }
    this.ring.material.opacity = 0.4 + Math.sin(game.time * 4) * 0.2;
    if (this.t > this.p.duration) this.done = true;
  }
}

// ---------- ATLAS: YÖRÜNGE SALDIRISI ----------
class OrbitalFx extends Effect {
  start() {
    const p = this.p;
    this.pos = groundTarget(this.origin, this.dir, p.range);
    this.ring = this.add(new THREE.Mesh(new THREE.RingGeometry(p.radius - 0.3, p.radius, 48),
      new THREE.MeshBasicMaterial({ color: 0xff4655, transparent: true, opacity: 0.8, side: THREE.DoubleSide })));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.copy(this.pos).setY(this.pos.y + 0.06);
    this.beam = this.add(new THREE.Mesh(new THREE.CylinderGeometry(p.radius, p.radius, 80, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
    this.beam.position.copy(this.pos).setY(this.pos.y + 40);
    sfx.ability(distToLocal(this.pos));
  }
  update(dt) {
    const warm = 1.6, dur = 3;
    if (this.t > warm) {
      if (!this.fired) { this.fired = true; sfx.explosion(distToLocal(this.pos)); }
      this.beam.material.opacity = 0.45 + Math.sin(game.time * 30) * 0.1;
      if (this.every(0.3, dt)) game.fx.explosion(this.pos.clone().add(new THREE.Vector3((this.rand() - 0.5) * 8, 0.3, (this.rand() - 0.5) * 8)), 2.5);
      if (game.isHost && Math.floor(this.t * 5) !== Math.floor((this.t - dt) * 5)) {
        for (const c of this.enemies()) {
          if (Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) < this.p.radius && c.pos.y - this.pos.y < 6) {
            game.match.applyDamage(c, this.p.dps * 0.2, this.owner, 'body', this.p.name);
          }
        }
      }
    } else {
      this.ring.material.opacity = 0.5 + Math.sin(this.t * 20) * 0.3;
    }
    if (this.t > warm + dur) this.done = true;
  }
}

// ---------- GEAR: NANO SÜRÜ ----------
class NanoswarmFx extends Effect {
  start() {
    const sim = simulateThrow(this.origin, throwVel(this.dir, this.p.speed || 15), { bounce: 0.2, maxTime: 1.8 });
    this.path = sim.path;
    this.landAt = sim.time;
    this.orb = ball(this, 0xf5d020, 0.1);
    this.activeAt = -1;
    sfx.ability(distToLocal(this.origin));
  }
  update(dt) {
    const p = this.p;
    const pos = this.path[Math.min(this.path.length - 1, Math.floor(this.t * 60))];
    this.orb.position.copy(pos);
    if (this.activeAt < 0) {
      if (game.isHost && this.t > this.landAt + 0.8) {
        for (const c of this.enemies()) if (c.pos.distanceTo(pos) < p.radius + 0.5) { this.sync({ on: 1 }); break; }
      }
      if (this.t > 60) this.done = true;
      return;
    }
    const life = this.t - this.activeAt;
    for (const s of this.swarm) {
      s.position.set(pos.x + Math.cos(game.time * 6 + s.userData.a) * s.userData.r, pos.y + 0.3 + Math.sin(game.time * 9 + s.userData.a) * 0.3,
        pos.z + Math.sin(game.time * 6 + s.userData.a) * s.userData.r);
    }
    if (game.isHost && this.every(0.25, dt)) {
      for (const c of this.enemies()) if (c.pos.distanceTo(pos) < p.radius) game.match.applyDamage(c, p.dps * 0.25, this.owner, 'body', p.name);
    }
    if (life > 3.5) this.done = true;
  }
  applyState(s) {
    if (s.on && this.activeAt < 0) {
      this.activeAt = this.t;
      this.swarm = [];
      for (let i = 0; i < 16; i++) {
        const g = addGlow(this, 0xf5d020, 0.35);
        g.userData = { a: this.rand() * Math.PI * 2, r: this.rand() * this.p.radius };
        this.swarm.push(g);
      }
      sfx.ability(distToLocal(this.origin));
    }
  }
}

// ---------- GEAR: ALARM ROBOTU / TARET / KUŞATMA ----------
function deviceBase(eff, pos, color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), new THREE.MeshStandardMaterial({ color: 0xf5d020, roughness: 0.5 }));
  body.position.y = 0.15;
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 }));
  light.position.set(0, 0.2, 0.18);
  g.add(body, light);
  g.position.copy(pos);
  eff.add(g);
  return { g, body, light };
}

class AlarmbotFx extends Destructible {
  start() {
    this.pos = groundTarget(this.origin, this.dir, this.p.range || 10);
    const d = deviceBase(this, this.pos, 0xff4655);
    d.g.rotation.y = Math.atan2(-this.dir.x, -this.dir.z) + Math.PI;
    this.setupHp(20, [d.body]);
    sfx.ability(distToLocal(this.pos));
  }
  update() {
    if (this.trigAt === undefined) {
      if (game.isHost && this.t > 1) {
        const eye = this.pos.clone().setY(this.pos.y + 0.3);
        for (const c of this.enemies()) {
          if (c.pos.distanceTo(this.pos) < 6 && worldLOS(eye, c.eye())) { this.sync({ trig: 1 }); break; }
        }
      }
      return;
    }
    if (this.t > this.trigAt + 0.6 && !this.boomed) {
      this.boomed = true;
      game.fx.explosion(this.pos, 2.5, 0xff4655);
      sfx.explosion(distToLocal(this.pos));
      if (game.isHost) {
        for (const c of this.enemies()) {
          if (c.pos.distanceTo(this.pos) < 5) {
            c.st.vulnerable = Math.max(c.st.vulnerable, 4);
            game.match.reveal(c, 2);
          }
        }
      }
      this.done = true;
    }
  }
  applyState(s) {
    if (s.trig && this.trigAt === undefined) { this.trigAt = this.t; sfx.beep(true); }
    super.applyState(s);
  }
}

class TurretFx extends Destructible {
  start() {
    this.pos = groundTarget(this.origin, this.dir, this.p.range || 10);
    const g = new THREE.Group();
    const legM = new THREE.MeshStandardMaterial({ color: 0x2d2a3a });
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), legM);
      const a = i * Math.PI * 2 / 3;
      leg.position.set(Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2);
      leg.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      g.add(leg);
    }
    this.head = new THREE.Group();
    this.head.position.y = 0.75;
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0xf5d020 }));
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    barrel.position.z = 0.4;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0x6b4bff, emissive: 0x6b4bff }));
    eye.position.set(0, 0.06, 0.26);
    this.head.add(hb, barrel, eye);
    g.add(this.head);
    g.position.copy(this.pos);
    this.add(g);
    this.yaw = this.owner ? this.owner.yaw + Math.PI : 0;
    this.head.rotation.y = this.yaw;
    this.setupHp(120, [hb]);
    this.fireT = 0;
    sfx.ability(distToLocal(this.pos));
  }
  update(dt) {
    if (!game.isHost) return;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    this.fireT = 0.22;
    const eye = this.pos.clone().setY(this.pos.y + 0.8);
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    let target = null, best = 36;
    for (const c of this.enemies()) {
      const to = c.pos.clone().sub(this.pos);
      const d = to.length();
      if (d > best || to.setY(0).normalize().dot(fwd) < 0) continue;
      if (!worldLOS(eye, c.eye()) || game.abilities.blocksVision(eye, c.eye())) continue;
      target = c;
      best = d;
    }
    if (!target) return;
    const aim = target.pos.clone().setY(target.pos.y + 1.1);
    this.head.rotation.y = Math.atan2(aim.x - this.pos.x, aim.z - this.pos.z);
    if (Math.random() < 0.55) {
      game.match.applyDamage(target, 7, this.owner, 'body', this.p.name);
      game.match.reportShot(null, eye, aim, 'smg');
    } else {
      game.match.reportShot(null, eye, aim.add(new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.5, (Math.random() - 0.5))), 'smg');
    }
  }
}

class LockdownFx extends Destructible {
  start() {
    this.pos = groundTarget(this.origin, this.dir, this.p.range || 10);
    const d = deviceBase(this, this.pos, 0x6b4bff);
    d.g.scale.setScalar(1.6);
    this.dome = this.add(new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({
      color: 0x6b4bff, wireframe: true, transparent: true, opacity: 0.35,
    })));
    this.dome.position.copy(this.pos);
    this.setupHp(150, [d.body]);
    sfx.ability(distToLocal(this.pos));
  }
  update() {
    const k = Math.min(1, this.t / 8);
    this.dome.scale.setScalar(Math.max(0.1, 20 * k));
    if (this.t >= 8 && !this.fired) {
      this.fired = true;
      game.fx.pulse(this.pos, 20, 0x6b4bff, 1.2, 0.5);
      sfx.explosion(distToLocal(this.pos));
      if (game.isHost) {
        for (const c of this.enemies()) if (c.pos.distanceTo(this.pos) < 20) c.st.detained = Math.max(c.st.detained, 8);
      }
    }
    if (this.t > 8.5) this.done = true;
  }
}

// ---------- VİGİL: TUZAK TELİ / KAMERA / SİNİRSEL HIRSIZLIK ----------
class TrapFx extends Effect {
  start() {
    const range = this.p.range || 12;
    const h = aimHit(this.origin, this.dir, range);
    let a, b;
    if (h && Math.abs(h.normal.y) < 0.5) {
      a = h.point.clone().setY(groundBelow(h.point.clone().addScaledVector(h.normal, 0.3)) + 0.45);
      const n = h.normal.clone().setY(0).normalize();
      const h2 = aimHit(a.clone().addScaledVector(n, 0.05), n, 14);
      b = h2 ? h2.point.clone() : a.clone().addScaledVector(n, 14);
    } else {
      const c = groundTarget(this.origin, this.dir, range).setY(0.45);
      const side = new THREE.Vector3(-this.dir.z, 0, this.dir.x).normalize();
      const h1 = aimHit(c, side, 7), h2 = aimHit(c, side.clone().negate(), 7);
      a = h1 ? h1.point : c.clone().addScaledVector(side, 7);
      b = h2 ? h2.point : c.clone().addScaledVector(side, -7);
    }
    b.y = a.y;
    this.a = a;
    this.b = b;
    const len = a.distanceTo(b);
    const wire = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 4),
      new THREE.MeshBasicMaterial({ color: 0x2fd4ff, transparent: true, opacity: 0.8 })));
    wire.position.copy(a).lerp(b, 0.5);
    wire.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    this.wire = wire;
    for (const p of [a, b]) {
      const anchor = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0xe6e2da, emissive: 0x2fd4ff, emissiveIntensity: 0.4 })));
      anchor.position.copy(p);
    }
    sfx.ability(distToLocal(a));
  }
  update() {
    if (this.broken) {
      if (this.t > this.brokenAt + 0.3) this.done = true;
      return;
    }
    this.wire.visible = this.t > 1.2 ? (game.local?.team === this.team || Math.sin(game.time * 3) > 0.3) : true;
    if (game.isHost && this.t > 1.2) {
      for (const c of this.enemies()) {
        if (c.pos.y > this.a.y + 0.3) continue;
        if (distToSeg2(c.pos.x, c.pos.z, this.a.x, this.a.z, this.b.x, this.b.z) < 0.45) {
          game.match.reveal(c, 3);
          c.st.tether = Math.max(c.st.tether, 3);
          this.sync({ broken: 1 });
          break;
        }
      }
    }
  }
  applyState(s) {
    if (s.broken && !this.broken) {
      this.broken = true;
      this.brokenAt = this.t;
      game.fx.pulse(this.a.clone().lerp(this.b, 0.5), 1.5, 0x2fd4ff, 0.4, 0.6);
      sfx.beep(true);
    }
  }
}

class CameraFx extends Destructible {
  start() {
    const h = aimHit(this.origin, this.dir, this.p.range || 15);
    const pos = h ? h.point.clone().addScaledVector(h.normal, 0.12) : groundTarget(this.origin, this.dir, 15).setY(1.5);
    this.pos = pos;
    const cam = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), new THREE.MeshStandardMaterial({ color: 0xe6e2da })));
    cam.position.copy(pos);
    const lens = this.add(new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: 0x2fd4ff, emissive: 0x2fd4ff })));
    lens.scale.setScalar(0.07);
    lens.position.copy(pos).addScaledVector(h ? h.normal : this.dir.clone().negate(), 0.11);
    this.setupHp(50, [cam]);
    sfx.ability(distToLocal(pos));
  }
  update(dt) {
    if (game.isHost && this.every(0.25, dt)) {
      for (const c of this.enemies()) {
        if (c.pos.distanceTo(this.pos) < 32 && worldLOS(this.pos, c.eye()) && !game.abilities.blocksVision(this.pos, c.eye())) {
          game.match.reveal(c, 0.6);
        }
      }
    }
    if (this.t > 45) this.done = true;
  }
}

class RevealAllFx extends Effect {
  start() { this.left = [0, 2.5]; sfx.ultReady(); }
  update() {
    while (this.left.length && this.t >= this.left[0]) {
      this.left.shift();
      for (const c of this.enemies()) {
        game.fx.pulse(c.pos.clone().setY(c.pos.y + 1), 1.2, 0x2fd4ff, 0.6, 0.6, true);
        if (game.isHost) game.match.reveal(c, 2.5);
      }
    }
    if (!this.left.length) this.done = true;
  }
}

// ---------- HAWK: AVCININ ÖFKESİ ----------
class HunterFuryFx extends Effect {
  start() { this.shots = [0.6, 1.9, 3.2]; sfx.ultReady(); }
  update() {
    const o = this.owner;
    while (this.shots.length && this.t >= this.shots[0]) {
      this.shots.shift();
      if (!o || !o.alive) { this.shots = []; break; }
      const from = o.eye();
      const dir = o.aimDir();
      const len = 90;
      const beam = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, len, 8),
        new THREE.MeshBasicMaterial({ color: 0x7ff0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
      beam.position.copy(from).addScaledVector(dir, len / 2 + 1);
      beam.quaternion.setFromUnitVectors(UP, dir);
      beam.userData.born = this.t;
      sfx.shot('sniper', distToLocal(from));
      if (game.isHost) {
        const end = from.clone().addScaledVector(dir, len);
        for (const c of this.enemies()) {
          const chest = c.pos.clone().setY(c.pos.y + 1.1);
          if (segSphere(from, end, chest, 1.4)) {
            game.match.applyDamage(c, 80, o, 'body', this.p.name);
            game.match.reveal(c, 2);
          }
        }
      }
    }
    for (const b of this.objs) {
      if (b.userData.born !== undefined) b.material.opacity = Math.max(0, 0.9 - (this.t - b.userData.born) * 2);
    }
    if (!this.shots.length && this.t > 3.8) this.done = true;
  }
}

// ---------- FLORA: ARAYICILAR ----------
class SeekersFx extends Effect {
  start() {
    const o = this.owner;
    const from = o ? o.pos : this.origin;
    const targets = this.enemies().sort((a, b) => a.pos.distanceTo(from) - b.pos.distanceTo(from)).slice(0, 3);
    this.seekers = targets.map((c, i) => {
      const g = addGlow(this, 0xd8ff6a, 0.8);
      g.position.copy(this.origin).add(new THREE.Vector3((i - 1) * 0.6, 0, 0));
      return { g, target: c, hit: false };
    });
    sfx.ultReady();
  }
  update(dt) {
    for (const s of this.seekers) {
      if (s.hit) continue;
      const aim = s.target.pos.clone().setY(s.target.pos.y + 1.2);
      const to = aim.sub(s.g.position);
      const d = to.length();
      if (d < 1.2 || !s.target.alive) {
        s.hit = true;
        s.g.visible = false;
        if (s.target.alive) {
          game.fx.pulse(s.g.position, 1.5, 0xd8ff6a, 0.5, 0.7);
          if (game.controlsHere(s.target)) s.target.st.nearsight = Math.max(s.target.st.nearsight, 3);
          if (game.isHost) game.match.reveal(s.target, 3);
        }
        continue;
      }
      s.g.position.addScaledVector(to.divideScalar(d), Math.min(d, 11 * dt));
    }
    if (this.seekers.every((s) => s.hit) || this.t > 12) this.done = true;
  }
}

// ---------- QUAKE ----------
class AftershockFx extends Effect {
  start() {
    const h = aimHit(this.origin, this.dir, this.p.range || 12);
    this.mark = h ? h.point : this.origin.clone().addScaledVector(this.dir, this.p.range || 12);
    this.pos = this.mark.clone().addScaledVector(this.dir, 1.6);
    this.glow = addGlow(this, 0xff8a2a, 0.6);
    this.glow.position.copy(this.mark);
    this.bursts = [1.0, 1.35, 1.7];
    sfx.ability(distToLocal(this.mark));
  }
  update() {
    this.glow.scale.setScalar(0.5 + Math.sin(this.t * 25) * 0.2);
    while (this.bursts.length && this.t >= this.bursts[0]) {
      this.bursts.shift();
      game.fx.explosion(this.pos, 3, 0xff8a2a);
      sfx.explosion(distToLocal(this.pos));
      if (game.isHost) {
        for (const c of this.enemies()) if (c.pos.clone().setY(c.pos.y + 0.9).distanceTo(this.pos) < 3.5) game.match.applyDamage(c, this.p.dmg, this.owner, 'body', this.p.name);
      }
    }
    if (!this.bursts.length) this.done = true;
  }
}

class FaultLineFx extends Effect {
  start() {
    this.a = this.origin.clone().setY(0);
    const d = this.dir.clone().setY(0);
    if (d.lengthSq() < 1e-4) d.set(0, 0, -1);
    this.hdir = d.normalize();
    this.cracks = [];
    const len = this.p.range;
    for (let i = 0; i < 14; i++) {
      const k = (i + 0.5) / 14;
      const m = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, len / 14),
        new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.8 })));
      const pos = this.a.clone().addScaledVector(this.hdir, k * len);
      pos.y = groundBelow(pos.clone().setY(3)) + 0.03;
      m.position.copy(pos);
      m.rotation.y = Math.atan2(this.hdir.x, this.hdir.z);
      m.visible = false;
      this.cracks.push({ m, k });
    }
    sfx.ability(distToLocal(this.origin));
  }
  update() {
    const k = Math.min(1, this.t / 0.9);
    for (const c of this.cracks) c.m.visible = c.k <= k;
    if (this.t >= 0.9 && !this.fired) {
      this.fired = true;
      sfx.explosion(distToLocal(this.origin));
      const b = this.a.clone().addScaledVector(this.hdir, this.p.range);
      for (const c of this.cracks) game.fx.burst(c.m.position, UP, 0xff8a2a, 2, 4);
      for (const c of this.here(this.enemies())) {
        if (distToSeg2(c.pos.x, c.pos.z, this.a.x, this.a.z, b.x, b.z) < 1.9) c.st.stun = Math.max(c.st.stun, this.p.stun);
      }
    }
    if (this.fired) for (const c of this.cracks) c.m.material.opacity = Math.max(0, 0.8 - (this.t - 0.9));
    if (this.t > 1.8) this.done = true;
  }
}

class RollingThunderFx extends Effect {
  start() {
    this.a = this.origin.clone().setY(0);
    const d = this.dir.clone().setY(0);
    if (d.lengthSq() < 1e-4) d.set(0, 0, -1);
    this.hdir = d.normalize();
    this.wave = 0;
    sfx.ultReady();
  }
  update() {
    const rows = 8;
    while (this.wave < rows && this.t >= 0.2 + this.wave * 0.12) {
      const dist = (this.wave + 1) * 4;
      const width = Math.tan(0.6) * dist;
      for (let i = -1; i <= 1; i++) {
        const side = new THREE.Vector3(-this.hdir.z, 0, this.hdir.x).multiplyScalar(i * width * 0.7);
        const p = this.a.clone().addScaledVector(this.hdir, dist).add(side);
        p.y = groundBelow(p.clone().setY(4)) + 0.3;
        game.fx.explosion(p, 2.2, 0xff8a2a);
      }
      this.wave++;
    }
    if (this.t >= 1.0 && !this.fired) {
      this.fired = true;
      sfx.explosion(distToLocal(this.origin));
      for (const c of this.here(this.enemies())) {
        const to = c.pos.clone().sub(this.a).setY(0);
        const d = to.length();
        if (d > 32 || d < 0.1) continue;
        if (to.normalize().dot(this.hdir) > Math.cos(0.62)) {
          c.st.stun = Math.max(c.st.stun, 5);
          c.vel.y = 7;
          c.onGround = false;
        }
      }
    }
    if (this.t > 1.6) this.done = true;
  }
}

// ---------- ULTİLER ----------
class ResurrectFx extends Effect {
  start() {
    const aim = groundTarget(this.origin, this.dir, 40);
    const dead = game.chars.filter((c) => c.team === this.team && !c.alive);
    dead.sort((a, b) => a.pos.distanceTo(aim) - b.pos.distanceTo(aim));
    this.target = dead[0] || null;
    if (!this.target) { this.done = true; return; }
    this.beam = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 12, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9ff7ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })));
    this.beam.position.copy(this.target.pos).setY(this.target.pos.y + 6);
    sfx.ultReady();
  }
  update() {
    if (this.t >= 1.4 && !this.revived) {
      this.revived = true;
      if (game.isHost && this.target && !this.target.alive) game.match.revive(this.target);
    }
    if (this.beam) this.beam.material.opacity = Math.max(0, 0.5 - Math.max(0, this.t - 1.4));
    if (this.t > 2) this.done = true;
  }
}

class RebirthFx extends Effect {
  start() {
    const o = this.owner;
    this.pos = o ? o.pos.clone() : this.origin.clone();
    this.mark = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16),
      new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.8 })));
    this.mark.position.copy(this.pos).setY(this.pos.y + 0.05);
    this.glow = addGlow(this, 0xff7a1a, 1.4);
    this.glow.position.copy(this.pos).setY(this.pos.y + 0.8);
    if (game.isHost && o) o.rebirth = { pos: this.pos.clone(), until: game.time + 10 };
    sfx.ultReady();
  }
  update() {
    const o = this.owner;
    this.glow.scale.setScalar(1.2 + Math.sin(this.t * 6) * 0.2);
    if (this.t >= 10) {
      if (game.isHost && o && o.rebirth) {
        o.rebirth = null;
        if (o.alive) game.match.teleport(o, this.pos);
      }
      this.done = true;
    }
    if (game.isHost && o && !o.rebirth && this.t > 0.1) this.done = true;
  }
}

class SelfBuffFx extends Effect {
  start() {
    const o = this.owner;
    if (!o) { this.done = true; return; }
    const color = this.type === 'empress' ? 0xc04dff : this.type === 'dismiss' ? 0x8a2bff : 0x6fd3ff;
    game.fx.pulse(o.pos.clone().setY(o.pos.y + 1), 1.8, color, 0.6, 0.6);
    if (game.isHost) {
      if (this.type === 'empress') o.st.empress = 25;
      if (this.type === 'dismiss') o.st.intangible = 2;
    }
    if (game.controlsHere(o)) {
      if (this.type === 'bladeStorm') o.ultWeapon = 'blades';
      if (this.type === 'rocket') o.ultWeapon = 'rocket';
    }
    if (this.p.key === 'X') sfx.ultReady(); else sfx.ability(distToLocal(o.pos));
    this.done = true;
  }
}

// Zephyr: atılma ve yükseliş (botlar için; yerel oyuncuda kontrolcü hemen uygular)
class MoveFx extends Effect {
  start() {
    const o = this.owner;
    if (o) {
      game.fx.burst(o.pos.clone().setY(o.pos.y + 0.3), UP, 0xdfeeff, 10, 4);
      if (o.kind === 'bot' && game.isHost) {
        if (this.type === 'updraft') { o.vel.y = 9.5; o.onGround = false; } else {
          o.dashT = 0.2;
          o.dashDir.copy(this.dir).setY(0).normalize();
        }
      }
      sfx.ability(distToLocal(o.pos));
    }
    this.done = true;
  }
}

// Blast: roket mermisi
class RocketShotFx extends Effect {
  start() {
    rc.set(this.origin, this.dir);
    rc.near = 0.5;
    rc.far = 200;
    const targets = game.blockers.slice();
    for (const c of this.enemies()) targets.push(...c.hitMeshes);
    const h = rc.intersectObjects(targets, false)[0];
    this.end = h ? h.point.clone() : this.origin.clone().addScaledVector(this.dir, 200);
    this.travel = this.origin.distanceTo(this.end) / 45;
    this.rocket = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xf2b134 })));
    this.rocket.quaternion.setFromUnitVectors(UP, this.dir);
    this.glow = addGlow(this, 0xffa040, 0.6);
  }
  update() {
    const k = Math.min(1, this.t / this.travel);
    const pos = this.origin.clone().lerp(this.end, k);
    this.rocket.position.copy(pos);
    this.glow.position.copy(pos);
    if (k >= 1) {
      game.fx.explosion(this.end, 6, 0xff8a2a);
      sfx.explosion(distToLocal(this.end));
      if (game.isHost) {
        for (const c of this.enemies()) {
          const d = c.pos.clone().setY(c.pos.y + 0.9).distanceTo(this.end);
          if (d > 7) continue;
          const dmg = d < 2.5 ? 150 : 150 * (1 - (d - 2.5) / 4.5) * 0.8 + 30;
          game.match.applyDamage(c, dmg, this.owner, 'body', 'Roketatar');
        }
      }
      this.done = true;
    }
  }
}

const TYPES = {
  smoke: SmokeFx, molly: MollyFx, flash: FlashFx, leer: LeerFx,
  grenade: GrenadeFx, stunGrenade: GrenadeFx, satchel: GrenadeFx,
  shockDart: DartFx, revealDart: DartFx, scoutPulse: ScoutPulseFx, slowOrb: SlowOrbFx,
  healOrb: HealFx, healArea: HealFx, devour: HealFx,
  wall: WallFx, fireWall: FireWallFx, teleport: TeleportFx, blindLine: BlindLineFx,
  stim: StimFx, orbital: OrbitalFx, nanoswarm: NanoswarmFx, alarmbot: AlarmbotFx,
  turret: TurretFx, lockdown: LockdownFx, trap: TrapFx, camera: CameraFx, revealAll: RevealAllFx,
  hunterFury: HunterFuryFx, seekers: SeekersFx, aftershock: AftershockFx, faultLine: FaultLineFx,
  rollingThunder: RollingThunderFx, resurrect: ResurrectFx, rebirth: RebirthFx,
  empress: SelfBuffFx, dismiss: SelfBuffFx, bladeStorm: SelfBuffFx, rocket: SelfBuffFx,
  dash: MoveFx, updraft: MoveFx, rocketShot: RocketShotFx,
};

export class AbilitySystem {
  constructor() {
    this.list = [];
  }

  spawn(ev) {
    const Cls = TYPES[ev.type];
    if (!Cls) return null;
    const e = new Cls(ev);
    this.list.push(e);
    try {
      e.start();
    } catch (err) {
      console.warn('Yetenek başlatılamadı', ev.type, err);
      e.done = true;
    }
    return e;
  }

  byId(id) { return this.list.find((e) => e.id === id) || null; }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.done) {
        e.t += dt;
        try { e.update(dt); } catch (err) { console.warn('Yetenek hatası', e.type, err); e.done = true; }
      }
      if (e.done) {
        e.dispose();
        this.list.splice(i, 1);
      }
    }
  }

  clearAll() {
    for (const e of this.list) e.dispose();
    this.list = [];
  }

  applyState(id, s) {
    const e = this.byId(id);
    if (e) e.applyState(s);
  }

  // Görüşü kesen yetenekler (duman, ateş duvarı) iki nokta arasında mı?
  blocksVision(a, b) {
    for (const e of this.list) if (e.blocks(a, b)) return true;
    return false;
  }

  // Mermilerin vurabileceği yetenek objeleri (düşman cihazları + tüm duvarlar)
  hittables(team) {
    const out = [];
    for (const e of this.list) {
      if (e.done) continue;
      if (e instanceof WallFx) out.push(...e.hitList);
      else if (e instanceof Destructible && e.team !== team && e.hp > 0) out.push(...e.hitList);
    }
    return out;
  }

  // Minimap için dumanlar
  smokes() {
    return this.list.filter((e) => e instanceof SmokeFx && e.mesh).map((e) => ({ x: e.center.x, z: e.center.z, r: e.mesh.scale.x, color: e.color }));
  }
}
