// SİLAHLAR: tanımlar, ekrandaki silah modeli ve yerel oyuncunun ateş etme sistemi.
import * as THREE from 'three';
import { game } from './game.js';
import * as sfx from './audio.js';
import * as TX from './textures.js';

const S = (base, move, air, grow, max, extra = {}) => ({ base, move, air, grow, max, ...extra });

// Valorant silahlarına benzer değerler (isimler oyuna özgü)
export const WEAPONS = {
  knife: {
    name: 'HANÇER', cat: 'melee', price: 0, dmg: 50, headMult: 1, legMult: 1, rate: 1.8, range: 2.6,
    melee: true, speed: 6.75, equip: 0.35, sound: 'knife', model: 'knife',
  },
  kestrel: {
    name: 'KESTREL', cat: 'sidearm', price: 0, dmg: 26, headMult: 3, legMult: 0.85, rate: 6.75, mag: 12, reserve: 36,
    auto: false, reload: 1.75, equip: 0.4, spread: S(0.004, 0.03, 0.1, 0.008, 0.04), recoil: 0.018,
    speed: 5.73, sound: 'pistol', model: 'pistol', color: 0x2b2f38, accent: 0x7b4bd6,
  },
  nova: {
    name: 'NOVA', cat: 'sidearm', price: 500, dmg: 30, headMult: 3.5, legMult: 0.85, rate: 6.75, mag: 15, reserve: 45,
    auto: false, reload: 1.5, equip: 0.4, spread: S(0.003, 0.025, 0.1, 0.007, 0.035), recoil: 0.016,
    speed: 5.73, sound: 'silenced', silenced: true, model: 'pistol', color: 0x3a3a3a, accent: 0x3dffc5, long: true,
  },
  marshal: {
    name: 'MARŞAL', cat: 'sidearm', price: 800, dmg: 55, headMult: 2.9, legMult: 0.85, rate: 4, mag: 6, reserve: 24,
    auto: false, reload: 2.25, equip: 0.5, spread: S(0.003, 0.04, 0.12, 0.02, 0.06), recoil: 0.05,
    speed: 5.73, sound: 'sniper', model: 'pistol', color: 0x6b4a2a, accent: 0xd8c39a, big: true,
  },
  hornet: {
    name: 'HORNET', cat: 'smg', price: 1600, dmg: 26, headMult: 3, legMult: 0.85, rate: 13.3, mag: 30, reserve: 90,
    auto: true, reload: 2.25, equip: 0.5, spread: S(0.006, 0.02, 0.1, 0.0025, 0.045), recoil: 0.006,
    speed: 5.73, sound: 'smg', silenced: true, model: 'smg', color: 0x2a2d34, accent: 0xff4655,
  },
  hammer: {
    name: 'HAMMER', cat: 'shotgun', price: 1850, dmg: 17, headMult: 2, legMult: 0.85, pellets: 12, rate: 3.5, mag: 7,
    reserve: 21, auto: true, reload: 2.2, equip: 0.6, spread: S(0.055, 0.02, 0.05, 0, 0), recoil: 0.035,
    speed: 5.4, sound: 'shotgun', model: 'shotgun', color: 0x3a2f26, accent: 0xffb547, falloff: 12,
  },
  mastiff: {
    name: 'MASTİF', cat: 'rifle', price: 2050, dmg: 35, headMult: 3.3, legMult: 0.85, rate: 9.15, mag: 24, reserve: 72,
    auto: true, reload: 2.5, equip: 0.6, spread: S(0.003, 0.065, 0.15, 0.005, 0.055), recoil: 0.011,
    speed: 5.4, sound: 'rifle', model: 'rifle', color: 0x4a4f3a, accent: 0xc9a227,
  },
  vortex: {
    name: 'VORTEX', cat: 'rifle', price: 2900, dmg: 40, headMult: 4, legMult: 0.85, rate: 9.75, mag: 25, reserve: 75,
    auto: true, reload: 2.5, equip: 0.6, spread: S(0.0025, 0.07, 0.15, 0.004, 0.05), recoil: 0.012,
    speed: 5.4, sound: 'rifle', model: 'rifle', color: 0x24272e, accent: 0x7b4bd6,
  },
  phase: {
    name: 'PHASE', cat: 'rifle', price: 2900, dmg: 39, headMult: 4, legMult: 0.85, rate: 11, mag: 30, reserve: 90,
    auto: true, reload: 2.5, equip: 0.6, spread: S(0.0025, 0.07, 0.15, 0.0035, 0.045), recoil: 0.010,
    speed: 5.4, sound: 'silenced', silenced: true, falloff: 15, model: 'rifle', color: 0xd8d4cc, accent: 0x18a0ff,
  },
  dart: {
    name: 'DART', cat: 'sniper', price: 950, dmg: 101, headMult: 2, legMult: 0.85, rate: 1.5, mag: 5, reserve: 15,
    auto: false, reload: 2.5, equip: 0.7, spread: S(0.035, 0.08, 0.2, 0, 0, { scoped: 0.0006 }), recoil: 0.04,
    zoom: [2.5], speed: 5.4, sound: 'sniper', model: 'sniper', color: 0x3a4a3a, accent: 0xb8e986,
  },
  longbow: {
    name: 'LONGBOW', cat: 'sniper', price: 4700, dmg: 150, headMult: 1.7, legMult: 0.85, rate: 0.75, mag: 5, reserve: 10,
    auto: false, reload: 3.7, equip: 1.0, spread: S(0.06, 0.12, 0.25, 0, 0, { scoped: 0.0003 }), recoil: 0.06,
    zoom: [2.5, 5], speed: 5.13, sound: 'sniper', model: 'sniper', color: 0x1e2228, accent: 0xff4655, big: true,
  },
  blades: {
    name: 'BIÇAK FIRTINASI', cat: 'ult', dmg: 50, headMult: 3, legMult: 1, rate: 3.3, mag: 5,
    auto: false, reload: 0, equip: 0.3, spread: S(0.001, 0.004, 0.01, 0, 0), recoil: 0.005,
    speed: 6.75, sound: 'knife', model: 'blades',
  },
  rocket: {
    name: 'ROKETATAR', cat: 'ult', rate: 1, mag: 1, auto: false, equip: 0.5, speed: 5.13, sound: 'rocket', model: 'rocket',
    spread: S(0, 0, 0, 0, 0), recoil: 0.08,
  },
  spike: { name: 'SPIKE', cat: 'spike', speed: 5.4, equip: 0.3, model: 'spike' },
};

export const ARMORS = {
  light: { name: 'HAFİF ZIRH', price: 400, value: 25 },
  heavy: { name: 'AĞIR ZIRH', price: 1000, value: 50 },
};

export const SHOP = [
  { title: 'TABANCALAR', items: ['nova', 'marshal'] },
  { title: 'HAFİF MAKİNELİ', items: ['hornet'] },
  { title: 'POMPALI', items: ['hammer'] },
  { title: 'TÜFEKLER', items: ['mastiff', 'vortex', 'phase'] },
  { title: 'KESKİN NİŞANCI', items: ['dart', 'longbow'] },
];

export function slotOf(key) {
  const c = WEAPONS[key].cat;
  return c === 'sidearm' ? 'secondary' : 'primary';
}

// ---------- Silah modelleri ----------
function part(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color, roughness: opts.rough ?? 0.45, metalness: opts.metal ?? 0.35,
      emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1,
    }),
  );
  m.position.set(x, y, z);
  m.rotation.set(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0);
  return m;
}

function cyl(r, len, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, len, 12),
    new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 }),
  );
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

function addArms(g, sleeve, gripZ = 0.12, foreZ = -0.3, twoHand = true) {
  const glove = 0x1c1c22;
  g.add(part(0.075, 0.08, 0.1, glove, 0.005, -0.12, gripZ, { rough: 0.8, metal: 0 }));
  g.add(part(0.09, 0.09, 0.42, sleeve, 0.04, -0.17, gripZ + 0.22, { rough: 0.9, metal: 0, rx: -0.15 }));
  if (twoHand) {
    g.add(part(0.075, 0.06, 0.12, glove, -0.01, -0.07, foreZ, { rough: 0.8, metal: 0 }));
    g.add(part(0.085, 0.085, 0.42, sleeve, -0.13, -0.17, foreZ + 0.16, { rough: 0.9, metal: 0, ry: -0.6, rx: 0.2 }));
  }
}

export function buildViewModel(key, sleeve = 0x3a3f4a) {
  const def = WEAPONS[key];
  const g = new THREE.Group();
  const c = def.color ?? 0x24272e, a = def.accent ?? 0x7b4bd6;
  switch (def.model) {
    case 'knife': {
      g.add(part(0.03, 0.04, 0.12, 0x1c1c22, 0, -0.06, 0.05));
      g.add(part(0.012, 0.05, 0.22, 0xd8dde6, 0, -0.05, -0.12, { metal: 0.9, rough: 0.2 }));
      g.add(part(0.06, 0.012, 0.03, a, 0, -0.04, -0.01, { emissive: a, ei: 0.3 }));
      addArms(g, sleeve, 0.06, 0, false);
      g.userData.muzzle = new THREE.Vector3(0, -0.05, -0.24);
      break;
    }
    case 'blades': {
      for (let i = 0; i < 3; i++) {
        const b = part(0.01, 0.04, 0.24, 0xe8fbff, -0.05 + i * 0.05, -0.02 + Math.abs(i - 1) * -0.02, -0.12,
          { emissive: 0x6fd3ff, ei: 0.8, metal: 0.9, rough: 0.1 });
        b.rotation.z = (i - 1) * 0.3;
        g.add(b);
      }
      addArms(g, sleeve, 0.08, 0, false);
      g.userData.muzzle = new THREE.Vector3(0, -0.02, -0.25);
      break;
    }
    case 'spike': {
      g.add(part(0.16, 0.2, 0.12, 0x2a2d34, 0, -0.05, -0.12));
      g.add(part(0.17, 0.04, 0.13, 0xff4655, 0, 0.04, -0.12, { emissive: 0xff2244, ei: 0.8 }));
      g.add(part(0.04, 0.08, 0.04, 0x9ff7ff, 0, 0.1, -0.12, { emissive: 0x6fe7ff, ei: 1 }));
      addArms(g, sleeve, 0.02, -0.08, true);
      g.userData.muzzle = new THREE.Vector3(0, 0, -0.2);
      break;
    }
    case 'rocket': {
      g.add(cyl(0.07, 0.8, 0x3a4048, 0, 0.02, -0.2));
      g.add(part(0.1, 0.1, 0.15, 0xf2b134, 0, 0.02, -0.62, { emissive: 0xf2b134, ei: 0.2 }));
      g.add(part(0.05, 0.12, 0.06, 0x1c1c22, 0, -0.1, 0.0, { rx: -0.3 }));
      addArms(g, sleeve, 0.02, -0.32, true);
      g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.72);
      break;
    }
    case 'pistol': {
      const len = def.long ? 0.26 : def.big ? 0.24 : 0.2;
      g.add(part(0.045, 0.06, len, a, 0, 0.02, -0.03 - (len - 0.2) / 2));
      g.add(part(0.04, 0.04, len - 0.03, c, 0, -0.025, -0.04));
      g.add(part(0.04, 0.12, 0.055, c, 0, -0.09, 0.04, { rx: -0.25 }));
      if (def.big) g.add(cyl(0.022, 0.08, c, 0, -0.01, 0));
      addArms(g, sleeve, 0.07, 0, false);
      g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.14 - (len - 0.2));
      break;
    }
    case 'smg': {
      g.add(part(0.07, 0.09, 0.34, c, 0, 0, -0.05));
      g.add(part(0.072, 0.03, 0.26, a, 0, 0.055, -0.05, { emissive: a, ei: 0.15 }));
      g.add(cyl(0.02, 0.18, 0x1a1a1a, 0, 0.0, -0.3));
      g.add(part(0.04, 0.2, 0.05, 0x1c1c1c, 0, -0.13, -0.08));
      g.add(part(0.045, 0.11, 0.05, c, 0, -0.1, 0.08, { rx: -0.3 }));
      addArms(g, sleeve, 0.1, -0.2);
      g.userData.muzzle = new THREE.Vector3(0, 0, -0.4);
      break;
    }
    case 'shotgun': {
      g.add(part(0.08, 0.1, 0.4, c, 0, 0, -0.05));
      g.add(cyl(0.03, 0.42, 0x1a1a1a, 0, 0.02, -0.4));
      g.add(cyl(0.024, 0.3, a, 0, -0.04, -0.33));
      g.add(part(0.05, 0.16, 0.08, 0x1c1c1c, 0, -0.12, -0.1, { rx: 0.2 }));
      g.add(part(0.045, 0.11, 0.05, c, 0, -0.1, 0.1, { rx: -0.3 }));
      g.add(part(0.06, 0.085, 0.22, a, 0, -0.02, 0.28));
      addArms(g, sleeve, 0.12, -0.33);
      g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.62);
      break;
    }
    case 'sniper': {
      const len = def.big ? 0.75 : 0.6;
      g.add(part(0.07, 0.09, 0.45, c, 0, 0, 0));
      g.add(cyl(0.016, len, 0x1a1a1a, 0, 0.01, -0.22 - len / 2));
      g.add(cyl(0.035, 0.3, 0x111111, 0, 0.1, -0.02));
      g.add(part(0.03, 0.05, 0.04, 0x111111, 0, 0.065, -0.02));
      g.add(part(0.075, 0.03, 0.25, a, 0, 0.055, 0.05, { emissive: a, ei: 0.15 }));
      g.add(part(0.05, 0.14, 0.08, 0x1c1c1c, 0, -0.11, -0.08, { rx: 0.15 }));
      g.add(part(0.045, 0.11, 0.05, c, 0, -0.1, 0.12, { rx: -0.3 }));
      g.add(part(0.06, 0.1, 0.26, c, 0, -0.02, 0.33));
      addArms(g, sleeve, 0.14, -0.32);
      g.userData.muzzle = new THREE.Vector3(0, 0.01, -0.22 - len);
      break;
    }
    default: { // rifle
      g.add(part(0.07, 0.09, 0.42, c, 0, 0, 0));
      g.add(part(0.075, 0.045, 0.3, a, 0, 0.065, -0.02, { emissive: a, ei: 0.12 }));
      g.add(part(0.065, 0.075, 0.26, a, 0, -0.005, -0.33));
      g.add(cyl(0.012, 0.22, 0x1a1a1a, 0, 0.01, -0.56));
      g.add(part(0.032, 0.032, def.silenced ? 0.16 : 0.06, 0x111111, 0, 0.01, def.silenced ? -0.72 : -0.68));
      g.add(part(0.03, 0.04, 0.07, 0x111111, 0, 0.11, 0.02));
      g.add(part(0.012, 0.012, 0.005, 0xff3355, 0, 0.12, -0.016, { emissive: 0xff2244 }));
      g.add(part(0.05, 0.17, 0.08, 0x1c1c1c, 0, -0.12, -0.1, { rx: 0.25 }));
      g.add(part(0.045, 0.11, 0.05, c, 0, -0.1, 0.1, { rx: -0.3 }));
      g.add(part(0.06, 0.085, 0.22, a, 0, -0.02, 0.3));
      addArms(g, sleeve);
      g.userData.muzzle = new THREE.Vector3(0, 0.01, def.silenced ? -0.8 : -0.72);
    }
  }
  g.scale.setScalar(0.62);
  return g;
}

const BASE_POS = {
  knife: new THREE.Vector3(0.16, -0.14, -0.38),
  blades: new THREE.Vector3(0.14, -0.13, -0.36),
  spike: new THREE.Vector3(0.05, -0.16, -0.4),
  pistol: new THREE.Vector3(0.13, -0.13, -0.38),
  rocket: new THREE.Vector3(0.17, -0.15, -0.5),
  default: new THREE.Vector3(0.17, -0.17, -0.55),
};

const SURFACE_COLORS = { stone: 0xc9b896, wood: 0x8a5a2b, metal: 0xffd27a, ice: 0xbff4ff };

// ---------- Yerel oyuncunun silah sistemi ----------
export class GunController {
  constructor(weaponScene, weaponCamera) {
    this.weaponScene = weaponScene;
    this.weaponCamera = weaponCamera;
    this.models = {};
    this.ammo = {};
    this.current = 'kestrel';
    this.prevWeapon = 'kestrel';
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TX.flash(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    this.flash.visible = false;
    weaponScene.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffc06a, 0, 10, 2);
    game.scene.add(this.flashLight);
    this.raycaster = new THREE.Raycaster();
    this.ray2 = new THREE.Raycaster();
    this.cooldown = 0;
    this.reloadT = 0;
    this.equipT = 0;
    this.flashT = 0;
    this.kick = 0;
    this.bobT = 0;
    this.swayX = 0;
    this.sprayCount = 0;
    this.timeSinceShot = 99;
    this.triggerLatch = false;
    this.zoomLevel = 0;
    this.bladeAmmo = 0;
    this.wantPlant = false;
    this.sleeve = 0x3a3f4a;
  }

  get char() { return game.local; }
  get def() { return WEAPONS[this.current]; }

  model(key) {
    if (!this.models[key]) {
      const m = buildViewModel(key, this.sleeve);
      m.visible = false;
      this.weaponScene.add(m);
      this.models[key] = m;
    }
    return this.models[key];
  }

  // Ajan değişince kol rengini güncelle
  setSleeve(color) {
    this.sleeve = color;
    for (const k in this.models) {
      this.weaponScene.remove(this.models[k]);
    }
    this.models = {};
  }

  fillAmmo(key) {
    const d = WEAPONS[key];
    if (d.mag) this.ammo[key] = { mag: d.mag, reserve: d.reserve ?? 0 };
  }

  resetForRound() {
    const c = this.char;
    if (!c) return;
    this.ammo = {};
    if (c.loadout.primary) this.fillAmmo(c.loadout.primary);
    this.fillAmmo(c.loadout.secondary);
    this.reloadT = 0;
    this.zoomLevel = 0;
    this.bladeAmmo = 0;
    this.current = null;
    this.knownLo = { ...c.loadout };
    this.equip(c.loadout.primary || c.loadout.secondary, true);
  }

  onLoadoutChanged(prev) {
    const c = this.char;
    if (!c) return;
    const lo = c.loadout;
    this.knownLo = { ...lo };
    if (lo.primary && lo.primary !== prev.primary) { this.fillAmmo(lo.primary); this.equip(lo.primary); }
    if (lo.secondary !== prev.secondary) {
      this.fillAmmo(lo.secondary);
      if (!lo.primary) this.equip(lo.secondary);
    }
    if (this.current && this.current !== 'knife' && this.current !== 'spike' &&
        WEAPONS[this.current].cat !== 'ult' && this.current !== lo.primary && this.current !== lo.secondary) {
      this.equip(lo.primary || lo.secondary);
    }
  }

  // Ulti silahları (Bıçak Fırtınası, Roketatar)
  giveUltWeapon(key) {
    if (key === 'blades') this.bladeAmmo = 5;
    this.prevWeapon = this.current && WEAPONS[this.current].cat !== 'ult' ? this.current : this.prevWeapon;
    this.equip(key);
  }

  endUltWeapon() {
    if (this.char) this.char.ultWeapon = null;
    if (WEAPONS[this.current].cat === 'ult') this.equip(this.prevWeapon || this.char.loadout.secondary);
  }

  canHoldSpike() {
    const c = this.char;
    return c && (c.hasSpike || (game.match.mode.allSpikes && c.side === 'atk' && game.match.spike.state === 'carried'));
  }

  equip(key, instant = false) {
    if (!key || key === this.current) return;
    if (this.current && this.models[this.current]) this.models[this.current].visible = false;
    this.current = key;
    this.model(key).visible = true;
    this.reloadT = 0;
    this.zoomLevel = 0;
    this.equipT = instant ? 0 : (WEAPONS[key].equip ?? 0.5);
    this.sprayCount = 0;
    if (this.char) this.char.weapon = key;
    if (!instant) sfx.equip();
    this.updateHud();
  }

  updateHud() {
    const d = this.def;
    const a = this.ammo[this.current];
    let ammoText = '', reserve = '';
    if (this.current === 'blades') { ammoText = this.bladeAmmo; reserve = ''; } else if (a) { ammoText = a.mag; reserve = a.reserve; }
    game.hud?.setWeapon(d.name, ammoText, reserve, this.reloadT > 0, a ? a.mag <= d.mag * 0.3 && a.reserve > 0 : false);
  }

  startReload() {
    const a = this.ammo[this.current];
    const d = this.def;
    if (!a || this.reloadT > 0 || a.mag === d.mag || a.reserve === 0 || !d.reload) return;
    let t = d.reload;
    if (this.char.st.empress > 0) t *= 0.75;
    this.reloadT = t;
    this.reloadTotal = t;
    this.zoomLevel = 0;
    sfx.reload(t);
    this.updateHud();
  }

  finishReload() {
    const a = this.ammo[this.current];
    const take = Math.min(this.def.mag - a.mag, a.reserve);
    a.mag += take;
    a.reserve -= take;
    this.updateHud();
  }

  currentSpread() {
    const d = this.def, c = this.char;
    if (!d.spread) return 0;
    const s = d.spread;
    const moveFrac = Math.max(0, Math.min(1, (c.speed - 0.8) / 4.6));
    if (this.zoomLevel > 0 && s.scoped !== undefined) {
      return s.scoped + s.move * moveFrac * 1.5 + (c.onGround ? 0 : s.air);
    }
    let v = s.base + s.move * moveFrac + Math.min(this.sprayCount * s.grow, s.max);
    if (!c.onGround) v += s.air;
    if (c.crouching) v *= 0.8;
    if (this.zoomLevel > 0) v *= 0.7;
    if (c.st.stun > 0) v += 0.08;
    return v;
  }

  // Dürbün / nişan alma çarpanı (kamera FOV'u buna bölünür)
  get zoomFactor() {
    if (this.zoomLevel === 0) return 1;
    const z = this.def.zoom;
    if (z) return z[this.zoomLevel - 1];
    return 1.15;
  }

  get scoped() { return this.zoomLevel > 0 && !!this.def.zoom; }

  update(dt, input) {
    const c = this.char;
    for (const k in this.models) this.models[k].visible = false;
    this.wantPlant = false;
    if (!c || !c.alive || game.spectating) {
      this.flash.visible = false;
      this.flashLight.intensity = 0;
      return;
    }

    // Ulti silahı geldiyse çıkar, bittiyse geri dön
    if (c.ultWeapon && this.current !== c.ultWeapon) this.giveUltWeapon(c.ultWeapon);
    if (!c.ultWeapon && WEAPONS[this.current]?.cat === 'ult') this.endUltWeapon();
    if (this.current === 'spike' && !this.canHoldSpike()) this.equip(c.loadout.primary || c.loadout.secondary);
    this.model(this.current).visible = !this.scoped;

    const lockedToUlt = WEAPONS[this.current].cat === 'ult';
    if (!lockedToUlt) {
      if (input.pressed.has('Digit1') && c.loadout.primary) this.equip(c.loadout.primary);
      if (input.pressed.has('Digit2')) this.equip(c.loadout.secondary);
      if (input.pressed.has('Digit3')) this.equip('knife');
      if (input.pressed.has('Digit4') && this.canHoldSpike()) this.equip('spike');
      if (input.wheel) {
        const list = [c.loadout.primary, c.loadout.secondary, 'knife'].filter(Boolean);
        const i = list.indexOf(this.current);
        this.equip(list[(i + (input.wheel > 0 ? 1 : list.length - 1)) % list.length]);
      }
    }
    if (input.pressed.has('KeyR')) this.startReload();
    if (input.pressed.has('Mouse2')) {
      const d = this.def;
      if (d.zoom) this.zoomLevel = (this.zoomLevel + 1) % (d.zoom.length + 1);
      else if (d.cat === 'rifle' || d.cat === 'smg' || d.cat === 'sidearm') this.zoomLevel = this.zoomLevel ? 0 : 1;
      else if (d.melee && this.cooldown <= 0 && this.equipT <= 0) this.melee(true);
    }

    this.cooldown -= dt;
    this.timeSinceShot += dt;
    if (this.equipT > 0) this.equipT -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.reloadT = 0; this.finishReload(); }
    }

    const phase = game.match?.phase;
    const blocked = c.st.detained > 0 || c.st.intangible > 0 || phase === 'buy' || phase === 'end';
    if (!input.mouseDown) this.triggerLatch = false;

    if (this.current === 'spike') {
      this.wantPlant = input.mouseDown && !blocked;
    } else {
      const d = this.def;
      const wantFire = input.mouseDown && (d.auto || !this.triggerLatch);
      if (wantFire && !blocked && this.cooldown <= 0 && this.reloadT <= 0 && this.equipT <= 0) {
        if (d.melee) this.melee(false);
        else if (this.current === 'blades') { if (this.bladeAmmo > 0) this.fire(); }
        else if (this.current === 'rocket') this.fireRocket();
        else if (this.ammo[this.current]?.mag > 0) this.fire();
        else if (!this.triggerLatch) { sfx.dry(); this.startReload(); }
        this.triggerLatch = true;
      }
    }

    // Ateş etmeyi bırakınca sekme ve sapma geri toparlanır
    const rate = this.def.rate || 2;
    if (this.timeSinceShot > 1 / rate + 0.06) {
      this.sprayCount = Math.max(0, this.sprayCount - dt * rate * 1.5);
      const r = Math.exp(-dt * 8);
      c.recoilPitch *= r;
      c.recoilYaw *= r;
    }

    game.hud?.setSpread(3 + this.currentSpread() * 550, this.scoped);
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0 && !this.scoped;
    this.flashLight.intensity = this.flashT > 0 && !this.def.silenced ? 6 : 0;
    this.animate(dt);
  }

  fireRateMult() {
    const c = this.char;
    let m = 1;
    if (c.st.stim > 0) m *= 1.15;
    if (c.st.empress > 0) m *= 1.2;
    return m;
  }

  // Mermilerin çarpabileceği her şey: harita, düşman karakterler, düşman yetenek objeleri
  targets() {
    const c = this.char;
    const list = game.blockers.slice();
    for (const o of game.chars) {
      if (o.team !== c.team && o.alive && o.model) list.push(...o.hitMeshes);
    }
    list.push(...game.abilities.hittables(c.team));
    return list;
  }

  aimDir(spread) {
    const cam = game.camera;
    cam.updateMatrixWorld();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    if (spread > 0) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      const r = spread * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    }
    return dir;
  }

  // Bir mermi ışını gönder ve isabeti işle. Sonucu (bitiş noktası) döndürür.
  traceShot(dir, damage, def, targets) {
    const cam = game.camera;
    this.raycaster.set(cam.position, dir);
    this.raycaster.far = def.range ?? 250;
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    const end = hit ? hit.point : cam.position.clone().addScaledVector(dir, this.raycaster.far);
    if (!hit) return { end, hit: null };
    const ud = hit.object.userData;
    if (ud.char) {
      let mult = ud.part === 'head' ? def.headMult : ud.part === 'legs' ? def.legMult : 1;
      if (def.falloff && hit.distance > def.falloff) mult *= def.pellets ? Math.max(0.3, 1 - (hit.distance - def.falloff) / 20) : 0.9;
      game.match.reportHit(this.char, ud.char, damage * mult, ud.part, this.current);
      game.fx.burst(hit.point, dir.clone().negate(), 0xb3121f, 6, 2.5);
      return { end, hit, charHit: ud.char, part: ud.part };
    }
    if (ud.effect) {
      game.match.reportFxHit(ud.effect.id, damage, ud.seg);
    }
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    game.fx.bulletHole(hit.point, normal);
    game.fx.burst(hit.point, normal, SURFACE_COLORS[ud.surface] || 0xc9b896, 5);
    if (ud.surface === 'metal') game.fx.burst(hit.point, normal, 0xfff0a0, 3, 5);
    return { end, hit };
  }

  muzzleWorld() {
    const model = this.model(this.current);
    model.updateMatrixWorld();
    const muzzle = model.localToWorld(model.userData.muzzle.clone());
    const ndc = muzzle.clone().project(this.weaponCamera);
    this.ray2.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), game.camera);
    return { muzzle, start: this.ray2.ray.origin.clone().addScaledVector(this.ray2.ray.direction, 1.0) };
  }

  fire() {
    const d = this.def, c = this.char;
    if (this.current === 'blades') this.bladeAmmo--;
    else this.ammo[this.current].mag--;
    this.cooldown = 1 / (d.rate * this.fireRateMult());
    this.timeSinceShot = 0;

    const spread = this.currentSpread();
    this.sprayCount++;
    const targets = this.targets();
    const pellets = d.pellets || 1;
    let anyHit = null, headHit = false, end = null;
    for (let i = 0; i < pellets; i++) {
      const r = this.traceShot(this.aimDir(spread), d.dmg, d, targets);
      if (i === 0) end = r.end;
      if (r.charHit) { anyHit = r.charHit; headHit = headHit || r.part === 'head'; }
    }
    if (anyHit) { game.hud.hitmarker(headHit, false); sfx.hit(headHit); }

    // Tepme
    c.recoilPitch = Math.min(c.recoilPitch + d.recoil * (this.sprayCount <= 2 ? 0.5 : 1), 0.22);
    if (this.sprayCount > 5) c.recoilYaw += (Math.random() - 0.5) * d.recoil * 1.6;
    if (d.cat === 'sniper') this.zoomLevel = 0;

    const { muzzle, start } = this.muzzleWorld();
    this.flash.position.copy(muzzle);
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.scale.setScalar(d.silenced ? 0.06 : 0.12 + Math.random() * 0.1);
    this.flashT = 0.045;
    this.flashLight.position.copy(start);
    const tracerColor = this.current === 'blades' ? 0x9ff7ff : 0xffe08a;
    if (!d.silenced || this.current === 'blades') game.fx.tracer(start, end, tracerColor);
    game.match.reportShot(c, start, end, d.sound);

    this.kick = 1;
    sfx.shot(d.sound);
    if (this.current === 'blades') {
      if (this.bladeAmmo <= 0) game.match.requestUltEnd(c);
    } else if (this.ammo[this.current].mag === 0) this.startReload();
    this.updateHud();
  }

  melee(heavy) {
    const c = this.char;
    this.cooldown = heavy ? 1.0 : 1 / WEAPONS.knife.rate;
    this.kick = 1;
    sfx.shot('knife');
    const def = { ...WEAPONS.knife, range: 2.6 };
    const r = this.traceShot(this.aimDir(0), heavy ? 75 : 50, def, this.targets());
    if (r.charHit) { game.hud.hitmarker(false, false); sfx.hit(false); }
    c.recoilPitch = 0;
  }

  fireRocket() {
    const c = this.char;
    this.cooldown = 1;
    const dir = this.aimDir(0);
    const cam = game.camera;
    game.match.requestCast(c, 'W', 'rocketShot', cam.position.clone(), dir);
    sfx.shot('rocket');
    this.kick = 2;
    c.recoilPitch = Math.min(c.recoilPitch + 0.08, 0.22);
    game.match.requestUltEnd(c);
  }

  onKill(weapon) {
    if (weapon === 'blades' && this.char.ultWeapon === 'blades') {
      this.bladeAmmo = 5;
      this.updateHud();
    }
  }

  // Silahın ekrandaki hareketi: yürüme sallanması, tepme, şarjör değiştirme, silah çekme
  animate(dt) {
    const m = this.model(this.current);
    const def = this.def;
    const base = BASE_POS[def.model] || BASE_POS.default;
    const c = this.char;
    const sp = c.onGround ? Math.min(c.speed / 5.4, 1) : 0;
    this.bobT += dt * (2 + 9 * sp);
    this.kick *= Math.exp(-dt * 16);
    this.swayX += (Math.max(-0.04, Math.min(0.04, -c.lookDX * 0.0006)) - this.swayX) * Math.min(1, dt * 10);
    c.lookDX = 0;

    let x = base.x + Math.sin(this.bobT) * 0.012 * sp + this.swayX;
    let y = base.y - Math.abs(Math.cos(this.bobT)) * 0.014 * sp;
    let z = base.z + this.kick * 0.05;
    let rx = this.kick * 0.1, rz = 0;
    if (this.zoomLevel > 0 && !def.zoom) { x = 0.0; y = -0.11; z = base.z + 0.05; }
    if (this.reloadT > 0) {
      const t = 1 - this.reloadT / this.reloadTotal;
      const d = Math.sin(t * Math.PI);
      y -= d * 0.1;
      rx -= d * 0.4;
      rz += d * 0.6;
      x -= d * 0.04;
    }
    if (this.equipT > 0) {
      const e = this.equipT / (def.equip || 0.5);
      y -= e * 0.25;
      rx -= e * 0.6;
    }
    if (this.wantPlant) { y -= 0.06; rx -= 0.4; }
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
  }
}
