// BOT YAPAY ZEKÂSI (sadece sunucuda çalışır)
// Yol bulma (A*), raund planı (Gemini varsa ondan), satın alma, savaş, yetenek ve ulti kullanımı,
// Spike kurma/çözme.
import * as THREE from 'three';
import { game } from './game.js';
import { moveBody } from './physics.js';
import { WEAPONS, ARMORS, slotOf } from './weapons.js';
import { AGENTS } from './agents.js';
import { DIFFICULTY } from './config.js';
import { worldLOS } from './abilities.js';
import { askStrategy, askChat } from './gemini.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rc = new THREE.Raycaster();

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function approachAngle(a, b, step) {
  const d = wrapAngle(b - a);
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
}
// Kamera yönü kuralı: ileri = (-sin yaw, -cos yaw)
const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

function clearWalk(a, b) {
  const from = new THREE.Vector3(a.x, a.y + 0.5, a.z);
  const to = new THREE.Vector3(b.x, from.y, b.z);
  const d = to.clone().sub(from);
  const len = d.length();
  if (len < 0.1) return true;
  rc.set(from, d.divideScalar(len));
  rc.near = 0;
  rc.far = len;
  return rc.intersectObjects(game.blockers, false).length === 0;
}

// Atılan yeteneklerin hedefe düşmesi için açı hesabı (yer çekimi 15)
function lobDir(from, to, speed) {
  const g = 15;
  const dx = to.x - from.x, dz = to.z - from.z;
  const d = Math.hypot(dx, dz), h = to.y - from.y;
  const v2 = speed * speed;
  const disc = v2 * v2 - g * (g * d * d + 2 * h * v2);
  const theta = disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (g * Math.max(d, 0.1)));
  const D = new THREE.Vector3(dx / Math.max(d, 0.01) * Math.cos(theta), Math.sin(theta), dz / Math.max(d, 0.01) * Math.cos(theta));
  // throwVel yönü 0.12 yukarı kaydırdığı için telafi et
  const k = 0.12 * D.y + Math.sqrt(0.0144 * D.y * D.y + 0.9856);
  return D.multiplyScalar(k).sub(new THREE.Vector3(0, 0.12, 0)).normalize();
}

const THROWN = new Set(['molly', 'grenade', 'stunGrenade', 'satchel', 'slowOrb', 'nanoswarm', 'scoutPulse']);
const OFFENSIVE = new Set(['flash', 'grenade', 'molly', 'shockDart', 'stunGrenade', 'blindLine', 'faultLine', 'leer', 'aftershock', 'slowOrb']);
const RECON = new Set(['revealDart', 'scoutPulse']);
const SETUP = new Set(['turret', 'alarmbot', 'trap', 'camera', 'nanoswarm']);
const HEALS = new Set(['healOrb', 'healArea', 'devour']);
const ULT_COMBAT = new Set(['bladeStorm', 'empress', 'rocket', 'orbital', 'hunterFury', 'seekers', 'rollingThunder', 'lockdown', 'rebirth', 'revealAll']);

const KILL_LINES = ['Bir tane gitti!', 'Kolaydı.', 'Sıradaki!', 'Hadi ama, bu kadar mı?', 'Temizlendi.', 'Nişan tam isabet!', 'gg ez... şaka şaka'];
const PLAN_LINES = { A: ['A\'ya gidiyoruz, toplanın!', 'Hepimiz A, hızlı girelim.', 'A bölgesi, dumanları atın!'], B: ['B\'ye gidiyoruz!', 'B uzun, birlikte girelim.', 'Herkes B, Spike bende değil ama koruyun!'] };

export class BotManager {
  constructor() {
    this.brains = new Map();
    this.plan = { site: 'A', mode: 'default', goTime: 15 };
    this.lastChat = -99;
  }

  brainOf(c) {
    if (!this.brains.has(c.id)) this.brains.set(c.id, new BotBrain(c, this));
    return this.brains.get(c.id);
  }

  bots() { return game.chars.filter((c) => c.kind === 'bot'); }

  onRoundStart() {
    const m = game.match;
    const site = m.mode.prePlanted ? m.spike.site : (Math.random() < 0.5 ? 'A' : 'B');
    const rush = Math.random() < 0.3;
    this.plan = { site, mode: rush ? 'rush' : 'default', goTime: rush ? 2 : rand(10, 22), executed: false };

    // Gemini anahtarı varsa raund planını yapay zekâya sor
    const atkBots = this.bots().filter((c) => c.side === 'atk');
    if (atkBots.length && game.settings.geminiKey && !m.mode.prePlanted) {
      const ctx = {
        round: m.round, score: m.score, mode: m.mode.name,
        team: atkBots.map((c) => ({ agent: AGENTS[c.agent].name, credits: c.credits })),
        lastSite: this.lastSite,
      };
      askStrategy(ctx).then((r) => {
        if (!r || game.match !== m || m.phase !== 'buy') return;
        if (r.site === 'A' || r.site === 'B') this.plan.site = r.site;
        if (r.plan === 'rush') { this.plan.mode = 'rush'; this.plan.goTime = 2; }
        if (r.chat) this.say(pick(atkBots), r.chat);
      });
    } else if (atkBots.length && Math.random() < 0.5) {
      this.say(pick(atkBots), pick(PLAN_LINES[site]));
    }
    this.lastSite = site;

    // Savunma pozisyonları
    const defBots = this.bots().filter((c) => c.side === 'def');
    const holds = game.world.holds;
    const slots = [holds.A[0], holds.B[0], holds.mid[0], holds.A[1], holds.B[1]];
    defBots.forEach((c, i) => this.brainOf(c).onRoundStart({ type: 'hold', ...slots[i % slots.length] }, i));
    atkBots.forEach((c, i) => this.brainOf(c).onRoundStart({ type: 'attack' }, i));

    if (m.mode.economy) for (const c of this.bots()) this.buyFor(c);
    for (const c of this.bots()) this.brainOf(c).weaponKey = c.loadout.primary || c.loadout.secondary;
  }

  buyFor(c) {
    const m = game.match;
    const b = (item) => m.buy(c, item);
    const pistolRound = m.round === 1 || m.round === m.mode.halfAt + 1;
    if (pistolRound) {
      if (Math.random() < 0.5) b('light'); else b('nova');
    } else if (!c.loadout.primary) {
      if (c.credits >= 3900) { b(pick(['vortex', 'phase'])); b('heavy'); }
      else if (c.credits >= 2900) { b(pick(['vortex', 'phase'])); b('light'); }
      else if (c.credits >= 2500) { b(pick(['hornet', 'mastiff', 'hammer'])); b('light'); }
      else if (c.credits >= 1300 && Math.random() < 0.4) b('marshal');
    }
    if (c.armor < 50 && c.credits >= 2000) b('heavy');
    else if (c.armor < 25 && c.credits >= 1000) b('light');
    for (const k of ['C', 'Q']) if (c.credits > 600) b(k);
  }

  onDamaged(target, attacker) {
    const br = this.brains.get(target.id);
    if (br) br.alert(attacker);
  }

  onKill(killer) {
    if (killer?.kind !== 'bot' || game.time - this.lastChat < 8 || Math.random() > 0.3) return;
    this.lastChat = game.time;
    if (game.settings.geminiKey) {
      askChat(`${AGENTS[killer.agent].name} adlı bot az önce bir rakibini öldürdü.`).then((t) => this.say(killer, t || pick(KILL_LINES)));
    } else {
      this.say(killer, pick(KILL_LINES));
    }
  }

  say(c, text) {
    if (!c || !text) return;
    game.match.emit({ t: 'chat', n: c.name, m: String(text).slice(0, 120), tm: c.team, bot: 1 });
  }

  update(dt) {
    for (const c of game.chars) {
      if (c.kind !== 'bot') continue;
      const br = this.brainOf(c);
      if (c.alive) br.update(dt);
    }
    if (!this.plan.executed && game.match.roundTime >= this.plan.goTime) this.plan.executed = true;
  }
}

class BotBrain {
  constructor(c, mgr) {
    this.c = c;
    this.mgr = mgr;
    this.path = [];
    this.weaponKey = 'kestrel';
    this.onRoundStart({ type: 'attack' }, 0);
  }

  get diff() { return DIFFICULTY[game.settings.difficulty] || DIFFICULTY.normal; }
  get def() { return WEAPONS[this.weaponKey] || WEAPONS.kestrel; }

  onRoundStart(role, idx) {
    this.role = role;
    this.idx = idx;
    this.path = [];
    this.goal = null;
    this.goalT = 0;
    this.target = null;
    this.canSee = false;
    this.reaction = 0.5;
    this.fireT = 0;
    this.burst = 0;
    this.reloadT = 0;
    this.ammo = null;
    this.losT = 0;
    this.alertT = 0;
    this.lastSeenPos = null;
    this.lastSeenT = -99;
    this.abilityT = rand(2, 5);
    this.setupDone = false;
    this.execDone = false;
    this.stuckT = 0;
    this.lastPos = this.c.pos.clone();
    this.sitePick = null;
    this.bladeAmmo = 0;
    this.strafe = 0;
    this.strafeT = 0;
  }

  alert(attacker) {
    this.alertT = 3;
    if (attacker && attacker.alive) {
      this.lastSeenPos = attacker.pos.clone();
      this.lastSeenT = game.time;
      if (!this.canSee) this.c.yaw = approachAngle(this.c.yaw, yawTo(this.c.pos, attacker.pos), 1.2);
    }
  }

  update(dt) {
    const c = this.c, m = game.match;
    this.alertT -= dt;
    this.abilityT -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.ammo = this.def.mag;
    }
    if (this.ammo === null) this.ammo = this.def.mag || 1;
    c.weapon = c.ultWeapon || this.weaponKey;
    if (c.ultWeapon === 'blades' && this.bladeAmmo <= 0) this.bladeAmmo = 5;

    let wish = new THREE.Vector3();
    if (m.phase === 'buy' || m.phase === 'post' || m.phase === 'end') {
      c.action = null;
    } else {
      this.losT -= dt;
      if (this.losT <= 0) { this.losT = rand(0.12, 0.2); this.perceive(); }
      if (this.target && this.canSee && c.st.blind <= 0.2) {
        c.action = null;
        wish = this.combat(dt);
      } else {
        wish = this.navigate(dt);
        this.utility();
      }
    }
    this.move(dt, wish);
  }

  // ---------- Algı ----------
  perceive() {
    const c = this.c;
    if (c.st.blind > 0.2) { this.canSee = false; return; }
    const eye = c.eye();
    const fwd = c.aimDir().setY(0).normalize();
    const maxD = c.st.nearsight > 0 ? 6 : 55;
    let best = null, bestD = Infinity;
    for (const e of game.enemiesOf(c.team)) {
      if (e.st.intangible > 0) continue;
      const head = e.eye();
      const to = head.clone().sub(eye);
      const d = to.length();
      if (d > maxD) continue;
      const facing = to.clone().setY(0).normalize().dot(fwd);
      const aware = this.alertT > 0 || d < 4 || facing > 0.34 || (e.st.revealed > 0 && d < 35);
      if (!aware) continue;
      const chest = e.pos.clone().setY(e.pos.y + 1.0);
      let vis = worldLOS(eye, head) && !game.abilities.blocksVision(eye, head);
      if (!vis) vis = worldLOS(eye, chest) && !game.abilities.blocksVision(eye, chest);
      if (!vis) continue;
      if (d < bestD) { best = e; bestD = d; }
    }
    if (best) {
      if (this.target !== best || !this.canSee) {
        const [a, b] = this.diff.react;
        this.reaction = rand(a, b) * (this.alertT > 0 ? 0.7 : 1);
      }
      this.target = best;
      this.canSee = true;
      this.lastSeenPos = best.pos.clone();
      this.lastSeenT = game.time;
    } else {
      this.canSee = false;
      if (game.time - this.lastSeenT > 3) this.target = null;
    }
  }

  // ---------- Savaş ----------
  combat(dt) {
    const c = this.c, t = this.target;
    const eye = c.eye();
    const aim = t.pos.clone().setY(t.pos.y + (t.crouching ? 0.95 : 1.35));
    const want = yawTo(c.pos, aim);
    c.yaw = approachAngle(c.yaw, want, this.diff.turn * dt);
    c.pitch = Math.atan2(aim.y - eye.y, Math.hypot(aim.x - eye.x, aim.z - eye.z));
    // Hafif sağa-sola kayma (strafe)
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = rand(0.4, 1.0); this.strafe = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
    this.reaction -= dt;
    if (this.reaction > 0) return new THREE.Vector3();

    this.tryCombatAbility(t);
    if (c.st.detained > 0 || c.st.intangible > 0) return new THREE.Vector3();
    if (Math.abs(wrapAngle(want - c.yaw)) > 0.3) return new THREE.Vector3();
    this.fireT -= dt;
    if (this.fireT <= 0 && this.reloadT <= 0) this.shoot(t, aim);
    // ateş ederken durur (Valorant'taki gibi), arada kayar
    if (this.strafe && this.fireT > 0.15) {
      const side = new THREE.Vector3(-Math.cos(c.yaw), 0, Math.sin(c.yaw)).multiplyScalar(this.strafe);
      return side;
    }
    return new THREE.Vector3();
  }

  shoot(t, aim) {
    const c = this.c, m = game.match;
    const key = c.ultWeapon || this.weaponKey;
    const def = WEAPONS[key] || WEAPONS.kestrel;
    const eye = c.eye();
    if (key === 'rocket') {
      m.requestCast(c, 'W', 'rocketShot', eye, aim.clone().sub(eye).normalize());
      c.ultWeapon = null;
      this.fireT = 1;
      return;
    }
    let rateMult = 1;
    if (c.st.stim > 0) rateMult *= 1.15;
    if (c.st.empress > 0) rateMult *= 1.2;
    let interval = 1 / (def.rate * rateMult);
    if (def.auto) {
      this.burst--;
      if (this.burst <= 0) { this.burst = 3 + Math.floor(Math.random() * 4); interval += rand(0.25, 0.5); }
    } else {
      interval += rand(0.05, 0.2);
    }
    this.fireT = interval;
    if (key === 'blades') {
      this.bladeAmmo--;
      if (this.bladeAmmo <= 0) c.ultWeapon = null;
    } else {
      this.ammo--;
      if (this.ammo <= 0) { this.reloadT = def.reload || 2; }
    }

    const d = eye.distanceTo(aim);
    let p = this.diff.hit * Math.max(0.12, Math.min(1.15, 1.2 - d / 40));
    if (def.cat === 'sniper') p *= 1.6;
    if (def.cat === 'shotgun') p *= d < 8 ? 1.6 : d < 15 ? 0.6 : 0.15;
    if (def.cat === 'smg' && d > 25) p *= 0.6;
    if (def.cat === 'sidearm' && d > 25) p *= 0.7;
    if (key === 'blades') p *= 1.4;
    const tSpeed = t.kind === 'bot' ? t.speed : t.modelVel;
    if (tSpeed > 3) p *= 0.65;
    if (c.speed > 1) p *= 0.6;
    if (c.st.stun > 0) p *= 0.3;
    if (c.st.nearsight > 0) p *= 0.5;
    if (t.crouching) p *= 0.9;

    const muzzle = c.model ? c.model.group.localToWorld(new THREE.Vector3(0.12, 1.37, 0.8)) : eye;
    if (Math.random() < Math.min(0.95, p)) {
      const r = Math.random();
      const part = r < this.diff.head * (def.cat === 'sniper' ? 1.5 : 1) ? 'head' : r > 0.9 ? 'legs' : 'body';
      const mult = part === 'head' ? def.headMult : part === 'legs' ? def.legMult : 1;
      const dmg = (def.dmg || 26) * mult * (def.pellets ? def.pellets * 0.55 : 1);
      m.applyDamage(t, dmg, c, part, def.name);
      m.reportShot(c, muzzle, aim, def.sound);
    } else {
      const miss = aim.clone().add(new THREE.Vector3(rand(-1, 1), rand(-0.6, 0.9), rand(-1, 1)).multiplyScalar(0.4 + d * 0.03));
      const dir = miss.clone().sub(eye).normalize();
      rc.set(eye, dir);
      rc.near = 0;
      rc.far = 120;
      const h = rc.intersectObjects(game.blockers, false)[0];
      const end = h ? h.point : eye.clone().addScaledVector(dir, 120);
      if (h && h.face) game.fx.bulletHole(h.point, h.face.normal.clone().transformDirection(h.object.matrixWorld));
      m.reportShot(c, muzzle, end, def.sound);
    }
  }

  // ---------- Yetenekler ----------
  abilityBy(pred) {
    const c = this.c;
    return AGENTS[c.agent].abilities.find((a) => a.key !== 'X' && c.charges[a.key] > 0 && pred(a)) || null;
  }

  ultReady() { return this.c.ult >= AGENTS[this.c.agent].ult; }

  cast(a, targetPos) {
    const c = this.c;
    const eye = c.eye();
    let dir;
    const thrown = THROWN.has(a.type) || (a.type === 'smoke' && a.mode === 'throw');
    if (thrown) dir = lobDir(eye, targetPos, a.type === 'smoke' ? 21 : (a.speed || 17));
    else dir = targetPos.clone().sub(eye).normalize();
    c.yaw = Math.atan2(-dir.x, -dir.z);
    c.pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    game.match.requestCast(c, a.key, a.type, eye, dir);
    this.abilityT = rand(4, 8);
  }

  tryCombatAbility(t) {
    const c = this.c;
    if (this.abilityT > 0 || c.st.detained > 0) return;
    this.abilityT = rand(2, 4);
    const ult = AGENTS[c.agent].abilities.find((a) => a.key === 'X');
    if (this.ultReady() && ULT_COMBAT.has(ult.type) && Math.random() < 0.5) {
      this.cast(ult, t.pos.clone().setY(t.pos.y + 1));
      return;
    }
    if (Math.random() > 0.35) return;
    const a = this.abilityBy((x) => OFFENSIVE.has(x.type));
    if (a) this.cast(a, t.pos.clone().setY(t.pos.y + 0.5));
  }

  // Savaş dışında: kurulum, iyileşme, saldırı öncesi duman/keşif, diriltme
  utility() {
    const c = this.c, m = game.match;
    if (this.abilityT > 0 || c.st.detained > 0) return;
    if (c.health < 60) {
      const h = this.abilityBy((x) => HEALS.has(x.type) && (!x.needKill || game.time - c.lastKill < 5));
      if (h) { this.cast(h, c.eye().add(c.aimDir())); return; }
    }
    const ult = AGENTS[c.agent].abilities.find((a) => a.key === 'X');
    if (this.ultReady()) {
      const dead = game.chars.find((o) => o.team === c.team && !o.alive);
      if (ult.type === 'resurrect' && dead && dead.pos.distanceTo(c.pos) < 30) { this.cast(ult, dead.pos.clone()); return; }
      if (ult.type === 'revealAll' && m.roundTime > 15) { this.cast(ult, c.eye().add(c.aimDir())); return; }
    }
    if (this.role.type === 'hold' && !this.setupDone && this.atGoal && m.phase === 'round') {
      this.setupDone = true;
      const a = this.abilityBy((x) => SETUP.has(x.type));
      if (a) { this.cast(a, this.role.look.clone().setY(a.type === 'camera' ? 2 : 0.5)); return; }
    }
    if (this.role.type === 'attack' && this.mgr.plan.executed && !this.execDone && m.phase === 'round') {
      this.execDone = true;
      const site = this.mgr.plan.site;
      const smoke = this.abilityBy((x) => x.type === 'smoke' && x.mode === 'place');
      if (smoke) { this.cast(smoke, game.world.smokePoints[site][this.idx % 2].clone()); return; }
      const recon = this.abilityBy((x) => RECON.has(x.type));
      if (recon) { this.cast(recon, game.world.siteCenters[site].clone().setY(3)); return; }
    }
  }

  // ---------- Hedef seçimi ve yürüme ----------
  pickGoal() {
    const c = this.c, m = game.match, w = game.world;
    const sp = new THREE.Vector3(...m.spike.pos);
    // Yakındaki ulti küresini al
    if (m.phase === 'round' && m.spike.state !== 'planted') {
      const orb = m.orbs.find((o) => !o.taken && Math.hypot(o.p[0] - c.pos.x, o.p[2] - c.pos.z) < 10);
      if (orb) return { pos: new THREE.Vector3(orb.p[0], 0, orb.p[2]), action: 'orb' };
    }
    if (m.spike.state === 'planted') {
      if (c.side === 'def') return { pos: sp, action: 'defuse', look: sp };
      if (!this.sitePick) {
        const spots = w.siteSpots[m.spike.site];
        this.sitePick = spots[this.idx % spots.length].clone();
      }
      return { pos: this.sitePick, look: sp };
    }
    if (c.side === 'atk') {
      if (m.spike.state === 'dropped') {
        const atk = game.chars.filter((o) => o.alive && o.side === 'atk' && o.kind === 'bot');
        atk.sort((a, b) => a.pos.distanceTo(sp) - b.pos.distanceTo(sp));
        if (atk[0] === c) return { pos: sp };
      }
      const plan = this.mgr.plan;
      const site = plan.site;
      if (!plan.executed) {
        const st = w.staging[site];
        return { pos: st[this.idx % st.length].clone().add(new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1))), look: w.siteCenters[site] };
      }
      const carrier = c.hasSpike || (m.mode.allSpikes && this.idx === 0);
      if (carrier) return { pos: w.plantSpots[site], action: 'plant' };
      if (!this.sitePick) {
        const spots = w.siteSpots[site];
        this.sitePick = spots[(this.idx + 1) % spots.length].clone();
      }
      return { pos: this.sitePick, look: w.siteCenters[site] };
    }
    // savunma: kendi noktanı tut
    return { pos: this.role.p, look: this.role.look };
  }

  navigate(dt) {
    const c = this.c;
    this.goalT -= dt;
    // Kısa süre önce gördüğü düşmanın peşine düş
    let goal;
    if (this.lastSeenPos && game.time - this.lastSeenT < 4 && game.match.spike.state !== 'planted') {
      goal = { pos: this.lastSeenPos, look: this.lastSeenPos };
    } else {
      goal = this.pickGoal();
    }
    if (!this.goal || this.goal.pos.distanceTo(goal.pos) > 1.5 || this.goalT <= 0) {
      this.goal = goal;
      this.goalT = 3;
      this.path = this.makePath(goal.pos);
    }
    this.goal = goal;
    // yol takibi
    while (this.path.length && Math.hypot(this.path[0].x - c.pos.x, this.path[0].z - c.pos.z) < 0.6) this.path.shift();
    this.atGoal = Math.hypot(goal.pos.x - c.pos.x, goal.pos.z - c.pos.z) < 1.2;
    if (this.atGoal) {
      c.action = goal.action || null;
      if (goal.look) {
        c.yaw = approachAngle(c.yaw, yawTo(c.pos, goal.look), dt * 4);
        c.pitch *= 0.9;
      }
      return new THREE.Vector3();
    }
    c.action = null;
    const next = this.path[0] || goal.pos;
    const dir = new THREE.Vector3(next.x - c.pos.x, 0, next.z - c.pos.z);
    if (dir.lengthSq() < 1e-4) return new THREE.Vector3();
    dir.normalize();
    c.yaw = approachAngle(c.yaw, Math.atan2(-dir.x, -dir.z), dt * 6);
    c.pitch *= 0.9;
    // takılma kontrolü
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      if (c.pos.distanceTo(this.lastPos) < 0.4) {
        this.path = this.makePath(goal.pos);
        if (this.path.length > 1) this.path.shift();
        c.vel.y = c.onGround ? 6 : c.vel.y; // zıplayarak kurtulmayı dene
      }
      this.lastPos.copy(c.pos);
      this.stuckT = 0;
    }
    return dir;
  }

  makePath(goal) {
    // Izgara yol bulucu botun gövde genişliğini hesaba katar (köşelerde takılmaz)
    return game.world.nav.findPath(this.c.pos, goal);
  }

  move(dt, wish) {
    const c = this.c;
    let speed = 5.4;
    if (this.weaponKey === 'longbow') speed = 5.13;
    if (c.st.slow > 0 || c.st.tether > 0) speed *= 0.5;
    if (c.st.stun > 0) speed *= 0.6;
    if (c.st.detained > 0) speed *= 0.5;
    if (c.st.stim > 0) speed *= 1.1;
    if (c.action) speed = 0;
    if (c.dashT > 0) {
      c.dashT -= dt;
      c.vel.x = c.dashDir.x * 20;
      c.vel.z = c.dashDir.z * 20;
    } else {
      const tx = wish.x * speed, tz = wish.z * speed;
      const k = Math.min(1, dt * (c.onGround ? 12 : 2));
      c.vel.x += (tx - c.vel.x) * k;
      c.vel.z += (tz - c.vel.z) * k;
    }
    c.vel.y -= 20 * dt;
    c.onGround = moveBody(c.pos, c.vel, dt, 0.35, 1.8, c.onGround ? 0.45 : 0);
  }
}
