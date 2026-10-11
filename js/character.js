// KARAKTER: oyuncu, bot ya da online oyuncu. Durum (can, zırh, yetenekler) + 3D model.
import * as THREE from 'three';
import { game } from './game.js';
import { AGENTS } from './agents.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();
function mat(color, emissive = 0, ei = 0.6) {
  const k = `${color}-${emissive}-${ei}`;
  if (!matCache.has(k)) {
    matCache.set(k, new THREE.MeshStandardMaterial({
      color, roughness: 0.7, metalness: 0.1, emissive, emissiveIntensity: emissive ? ei : 0,
    }));
  }
  return matCache.get(k);
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c.getHex();
}

// Bir ajanın gövde modelini kurar. hit = vuruş bölgesi kaydı için fonksiyon (part, mesh)
export function buildAgentModel(agentKey, hit = () => {}) {
  const L = AGENTS[agentKey].look;
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const add = (parent, w, h, d, m, x, y, z, part, rot) => {
    const mesh = new THREE.Mesh(boxGeo, m);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = true;
    parent.add(mesh);
    if (part) hit(part, mesh);
    return mesh;
  };
  const main = mat(L.main), pants = mat(L.pants), skin = mat(L.skin), hair = mat(L.hair);
  const accent = mat(L.accent, L.accent, 0.7), dark = mat(shade(L.main, 0.45)), boots = mat(0x1a1a1e);

  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0.9, 0);
    add(hip, 0.2, 0.75, 0.24, pants, 0, -0.38, 0, 'legs');
    add(hip, 0.22, 0.14, 0.32, boots, 0, -0.83, 0.04, 'legs');
    g.add(hip);
    legs.push(hip);
  }
  const body = new THREE.Group();
  g.add(body);
  add(body, 0.56, 0.72, 0.32, main, 0, 1.27, 0, 'body');
  add(body, 0.5, 0.08, 0.33, dark, 0, 0.95, 0, 'body');
  add(body, 0.1, 0.5, 0.02, accent, 0.12, 1.32, 0.165, null);
  add(body, 0.58, 0.06, 0.34, accent, 0, 1.55, 0, null);
  // kollar (silah tutar)
  add(body, 0.14, 0.55, 0.14, main, 0.33, 1.32, 0.18, 'body', [-1.1, 0, 0]);
  add(body, 0.14, 0.55, 0.14, main, -0.2, 1.32, 0.28, 'body', [-1.25, 0, -0.5]);
  add(body, 0.1, 0.1, 0.1, skin, 0.33, 1.2, 0.42, null);
  // silah
  const gun = add(body, 0.08, 0.12, 0.62, mat(0x222222), 0.12, 1.36, 0.48, null);
  gun.castShadow = true;

  // kafa
  const head = new THREE.Group();
  head.position.set(0, 1.8, 0);
  body.add(head);
  add(head, 0.3, 0.3, 0.3, skin, 0, 0, 0, 'head');
  add(head, 0.06, 0.04, 0.02, mat(0x111111), -0.07, 0.03, 0.151, null);
  add(head, 0.06, 0.04, 0.02, mat(0x111111), 0.07, 0.03, 0.151, null);
  switch (L.style) {
    case 'ponytail':
      add(head, 0.32, 0.1, 0.32, hair, 0, 0.17, -0.01, 'head');
      add(head, 0.32, 0.22, 0.08, hair, 0, 0.06, -0.15, 'head');
      add(head, 0.1, 0.3, 0.1, hair, 0, -0.08, -0.25, null, [0.4, 0, 0]);
      add(head, 0.33, 0.04, 0.04, accent, 0, 0.11, 0.15, null);
      break;
    case 'spiky':
      add(head, 0.32, 0.08, 0.32, hair, 0, 0.17, 0, 'head');
      for (let i = 0; i < 4; i++) add(head, 0.08, 0.16, 0.08, hair, -0.12 + i * 0.08, 0.26, -0.02 + (i % 2) * 0.06, null, [0.3, 0, 0]);
      add(head, 0.33, 0.04, 0.04, accent, 0, -0.06, 0.15, null);
      break;
    case 'long':
      add(head, 0.33, 0.1, 0.33, hair, 0, 0.17, 0, 'head');
      add(head, 0.34, 0.45, 0.08, hair, 0, -0.08, -0.15, 'head');
      add(head, 0.06, 0.38, 0.28, hair, -0.17, -0.06, -0.02, null);
      add(head, 0.06, 0.38, 0.28, hair, 0.17, -0.06, -0.02, null);
      add(head, 0.08, 0.08, 0.02, accent, 0.08, 0.1, 0.16, null);
      break;
    case 'bandana':
      add(head, 0.32, 0.1, 0.32, mat(L.accent), 0, 0.15, 0, 'head');
      add(head, 0.08, 0.16, 0.04, mat(L.accent), 0, 0.05, -0.18, null, [0.5, 0, 0]);
      break;
    case 'hood':
      add(head, 0.38, 0.12, 0.38, main, 0, 0.19, -0.02, 'head');
      add(head, 0.06, 0.36, 0.36, main, -0.18, 0.02, -0.02, null);
      add(head, 0.06, 0.36, 0.36, main, 0.18, 0.02, -0.02, null);
      add(head, 0.38, 0.36, 0.06, main, 0, 0.02, -0.19, null);
      add(head, 0.28, 0.06, 0.02, accent, 0, 0.03, 0.155, null);
      break;
    case 'beret':
      add(head, 0.36, 0.08, 0.36, mat(shade(L.main, 0.7)), 0.03, 0.18, 0, 'head');
      add(head, 0.32, 0.08, 0.06, hair, 0, -0.1, 0.13, null);
      break;
    case 'bun':
      add(head, 0.32, 0.1, 0.32, hair, 0, 0.17, -0.01, 'head');
      add(head, 0.14, 0.14, 0.14, hair, 0, 0.26, -0.1, 'head');
      add(head, 0.33, 0.03, 0.03, accent, 0, 0.21, 0.0, null);
      break;
    case 'goggles':
      add(head, 0.32, 0.12, 0.32, hair, 0, 0.16, 0, 'head');
      add(head, 0.33, 0.07, 0.05, mat(0x222222), 0, 0.1, 0.15, null);
      add(head, 0.09, 0.06, 0.02, accent, -0.07, 0.1, 0.175, null);
      add(head, 0.09, 0.06, 0.02, accent, 0.07, 0.1, 0.175, null);
      break;
    case 'mask':
      add(head, 0.4, 0.04, 0.4, hair, 0, 0.17, 0, 'head');
      add(head, 0.26, 0.14, 0.26, hair, 0, 0.26, 0, 'head');
      add(head, 0.31, 0.12, 0.04, main, 0, -0.07, 0.15, null);
      add(head, 0.18, 0.03, 0.02, accent, 0, 0.03, 0.165, null);
      break;
    case 'cap':
      add(head, 0.33, 0.1, 0.33, main, 0, 0.17, 0, 'head');
      add(head, 0.3, 0.03, 0.15, main, 0, 0.13, 0.2, null);
      add(head, 0.34, 0.12, 0.08, hair, 0, 0.0, -0.15, null);
      add(head, 0.04, 0.04, 0.03, accent, 0.1, 0.03, 0.155, null);
      break;
    case 'mohawk':
      add(head, 0.08, 0.18, 0.34, hair, 0, 0.22, 0, 'head');
      add(head, 0.31, 0.12, 0.03, mat(0x333333), 0, -0.07, 0.155, null);
      add(head, 0.33, 0.03, 0.03, accent, 0, 0.06, 0.155, null);
      break;
    default:
      add(head, 0.32, 0.1, 0.32, hair, 0, 0.17, 0, 'head');
  }
  // sırt çantası / omuz detayı
  add(body, 0.36, 0.4, 0.12, dark, 0, 1.3, -0.2, null);
  add(body, 0.2, 0.06, 0.02, accent, 0, 1.4, -0.265, null);
  return { group: g, legs, body, head };
}

function textSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 30px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(text, 128, 34);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.4, 0.35, 1);
  s.renderOrder = 999;
  return s;
}

let revealTex = null;
function revealMarker() {
  if (!revealTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.translate(32, 32);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ff4655';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.fillRect(-16, -16, 32, 32);
    ctx.strokeRect(-16, -16, 32, 32);
    revealTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: revealTex, depthTest: false, transparent: true }));
  s.scale.set(0.45, 0.45, 1);
  s.renderOrder = 1000;
  return s;
}

const STATUS_KEYS = ['blind', 'nearsight', 'slow', 'stun', 'stim', 'revealed', 'vulnerable', 'detained',
  'intangible', 'empress', 'heal', 'tether'];

export class Character {
  constructor({ id, name, team, agent, kind }) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.agent = agent;
    this.kind = kind; // 'local' | 'bot' | 'remote'
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.lookDX = 0;
    this.crouching = false;
    this.walking = false;
    this.onGround = true;
    this.health = 100;
    this.armor = 0;
    this.alive = true;
    this.credits = 800;
    this.ult = 0;
    this.charges = { C: 0, Q: 0, E: 0 };
    this.loadout = { primary: null, secondary: 'kestrel' };
    this.lv = 0; // satın alma sürümü
    this.pv = 0; // ışınlama sürümü (sunucu zorla konum değiştirince artar)
    this.weapon = 'kestrel';
    this.kills = 0;
    this.deaths = 0;
    this.st = {};
    for (const k of STATUS_KEYS) this.st[k] = 0;
    this.healRate = 0;
    this.action = null;
    this.actionProg = 0;
    this.lastKill = -99;
    this.ultWeapon = null;
    this.hasSpike = false;
    this.rebirth = null;
    this.dashT = 0;
    this.dashDir = new THREE.Vector3();
    this.hitMeshes = [];
    this.model = null;
    this.deathT = 0;
    this.stepT = 0;
    this.prevPos = new THREE.Vector3();
    this.modelVel = 0;
    this.peer = null;
  }

  get side() { return game.match ? game.match.sideOf(this.team) : 'atk'; }
  get def() { return AGENTS[this.agent]; }
  get eyeHeight() { return this.crouching ? 1.05 : 1.62; }
  get height() { return this.crouching ? 1.25 : 1.8; }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }

  eye(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  aimDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  resetCharges(full = true) {
    for (const a of this.def.abilities) {
      if (a.key === 'X') continue;
      if (full || a.key === 'E') this.charges[a.key] = a.charges;
    }
  }

  clearStatus() {
    for (const k of STATUS_KEYS) this.st[k] = 0;
    this.healRate = 0;
    this.dashT = 0;
    this.action = null;
    this.actionProg = 0;
    this.ultWeapon = null;
    this.rebirth = null;
  }

  tickStatus(dt) {
    for (const k of STATUS_KEYS) if (this.st[k] > 0) this.st[k] = Math.max(0, this.st[k] - dt);
  }

  // ---------- 3D model ----------
  createModel() {
    this.removeModel();
    this.hitMeshes = [];
    const m = buildAgentModel(this.agent, (part, mesh) => {
      mesh.userData = { char: this, part };
      this.hitMeshes.push(mesh);
    });
    this.model = m;
    m.group.position.copy(this.pos);
    game.scene.add(m.group);
    this.tag = textSprite(this.name, '#9ff7e8');
    this.tag.position.set(0, 2.35, 0);
    m.group.add(this.tag);
    this.marker = revealMarker();
    this.marker.position.set(0, 2.25, 0);
    m.group.add(this.marker);
  }

  removeModel() {
    if (this.model) game.scene.remove(this.model.group);
    this.model = null;
    this.hitMeshes = [];
  }

  setAgent(agent) {
    this.agent = agent;
    if (this.model) this.createModel();
  }

  updateModel(dt) {
    if (!this.model) return;
    const g = this.model.group;
    const local = game.local;
    const isMe = this === local && !game.spectating;
    g.visible = !isMe && game.spectating !== this;
    if (isMe) return;
    // Uzaktaki karakterleri yumuşakça hareket ettir
    if (this.kind === 'remote' || (this.kind === 'bot' && !game.isHost)) {
      g.position.lerp(this.pos, Math.min(1, dt * 14));
    } else {
      g.position.copy(this.pos);
    }
    const moved = Math.hypot(g.position.x - this.prevPos.x, g.position.z - this.prevPos.z) / Math.max(dt, 1e-4);
    this.prevPos.copy(g.position);
    this.modelVel += (moved - this.modelVel) * Math.min(1, dt * 10);
    // Model +z yönüne bakıyor, kamera ise -z: bu yüzden 180° çevir
    let dy = this.yaw + Math.PI - g.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    g.rotation.y += dy * Math.min(1, dt * 15);

    if (!this.alive) {
      this.deathT += dt;
      g.rotation.x = -Math.min(this.deathT / 0.35, 1) * Math.PI / 2;
      g.scale.y = 1;
    } else {
      this.deathT = 0;
      g.rotation.x = 0;
      g.scale.y = this.crouching ? 0.72 : 1;
      const swing = this.modelVel > 0.5 ? Math.sin(game.time * 10) * Math.min(0.6, this.modelVel * 0.1) : 0;
      this.model.legs[0].rotation.x = swing;
      this.model.legs[1].rotation.x = -swing;
      this.model.head.rotation.x = -this.pitch * 0.5;
    }
    // Ölü karakterin ve görünmez (Kaçış) karakterin yarı saydamlığı
    const ghost = this.st.intangible > 0;
    g.traverse((o) => { if (o.isMesh) o.visible = !ghost || Math.sin(game.time * 30) > 0.6; });

    const ally = local && this.team === local.team;
    this.tag.visible = ally && this.alive;
    this.marker.visible = !ally && this.alive && this.st.revealed > 0;
  }
}
