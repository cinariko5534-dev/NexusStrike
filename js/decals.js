// Görsel efektler: duvardaki mermi izleri, toz/kıvılcım/kan parçacıkları, mermi izi çizgileri,
// patlamalar ve tarama halkaları.
import * as THREE from 'three';
import * as TX from './textures.js';

const MAX_HOLES = 250;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.holes = [];
    this.particles = [];
    this.tracers = [];
    this.pulses = [];
    this.holeGeo = new THREE.PlaneGeometry(0.13, 0.13);
    this.holeMat = new THREE.MeshBasicMaterial({
      map: TX.bulletHole(), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.partGeo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
    this.partMats = {};
    this.sphereGeo = new THREE.SphereGeometry(1, 20, 14);
  }

  // Çarpma noktasına, yüzey normaline bakan bir mermi deliği yapıştırır.
  bulletHole(point, normal) {
    const m = new THREE.Mesh(this.holeGeo, this.holeMat);
    m.position.copy(point).addScaledVector(normal, 0.004);
    m.lookAt(point.clone().add(normal));
    m.rotateZ(Math.random() * Math.PI * 2);
    const s = 0.8 + Math.random() * 0.5;
    m.scale.set(s, s, 1);
    this.scene.add(m);
    this.holes.push(m);
    if (this.holes.length > MAX_HOLES) this.scene.remove(this.holes.shift());
  }

  clearHoles() {
    for (const h of this.holes) this.scene.remove(h);
    this.holes = [];
  }

  burst(point, normal, color, count = 6, speed = 3) {
    let mat = this.partMats[color];
    if (!mat) mat = this.partMats[color] = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(this.partGeo, mat);
      p.position.copy(point);
      const v = normal.clone().multiplyScalar(speed * (0.4 + Math.random()));
      v.x += (Math.random() - 0.5) * speed;
      v.y += Math.random() * speed * 0.8;
      v.z += (Math.random() - 0.5) * speed;
      p.userData.vel = v;
      p.userData.life = p.userData.maxLife = 0.35 + Math.random() * 0.35;
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  tracer(from, to, color = 0xffe08a) {
    if (![from.x, from.y, from.z, to.x, to.y, to.z].every(Number.isFinite)) return;
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    line.userData.life = 0.07;
    this.scene.add(line);
    this.tracers.push(line);
  }

  // Büyüyüp sönen küre: patlama, tarama halkası vb.
  pulse(point, radius, color, life = 0.5, opacity = 0.8, wire = false) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, wireframe: wire,
      blending: wire ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(this.sphereGeo, mat);
    m.position.copy(point);
    m.scale.setScalar(0.1);
    m.userData = { life, maxLife: life, radius, opacity };
    this.scene.add(m);
    this.pulses.push(m);
  }

  explosion(point, radius = 4, color = 0xff8a2a) {
    this.pulse(point, radius, color, 0.45, 0.9);
    this.pulse(point, radius * 0.6, 0xfff2c0, 0.25, 1);
    this.burst(point, new THREE.Vector3(0, 1, 0), 0x3a3530, 14, 6);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const u = p.userData;
      u.life -= dt;
      if (u.life <= 0) {
        this.scene.remove(p);
        this.particles.splice(i, 1);
        continue;
      }
      u.vel.y -= 12 * dt;
      p.position.addScaledVector(u.vel, dt);
      p.scale.setScalar(u.life / u.maxLife);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life / 0.07) * 0.85;
      if (t.userData.life <= 0) {
        this.scene.remove(t);
        t.geometry.dispose();
        t.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const m = this.pulses[i];
      const u = m.userData;
      u.life -= dt;
      const k = 1 - u.life / u.maxLife;
      m.scale.setScalar(Math.max(0.1, u.radius * Math.min(1, k * 1.6)));
      m.material.opacity = u.opacity * Math.max(0, 1 - k);
      if (u.life <= 0) {
        this.scene.remove(m);
        m.material.dispose();
        this.pulses.splice(i, 1);
      }
    }
  }
}
