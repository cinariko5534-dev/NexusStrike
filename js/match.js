// MAÇ: raundlar, ekonomi, Spike, ulti küreleri, hasar ve leşler.
// Sunucu (host) bütün kararları verir; istemciler anlık görüntüleri (snapshot) uygular.
import * as THREE from 'three';
import { game } from './game.js';
import { MODES, ECON, TIMES, RANDOM_WEAPONS, BOT_NAMES } from './config.js';
import { AGENTS, AGENT_KEYS, ability } from './agents.js';
import { WEAPONS, ARMORS, slotOf } from './weapons.js';
import { Character } from './character.js';
import * as sfx from './audio.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const r2 = (v) => Math.round(v * 100) / 100;
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

export class Match {
  constructor(modeKey) {
    this.modeKey = modeKey;
    this.mode = MODES[modeKey];
    this.phase = 'pre';
    this.timer = 0;
    this.round = 0;
    this.score = [0, 0];
    this.half = 0;
    this.lossStreak = [0, 0];
    this.spike = { state: 'none', carrier: null, pos: [0, 0, 0], site: null, timer: 0, saved: 0 };
    this.orbs = game.world.orbs.map((p) => ({ p: [p.x, p.y, p.z], taken: false }));
    this.roundWeapon = null;
    this.nextEvId = 1;
    this.resetLoadouts = false;
    this.beepT = 0;
    this.roundTime = 0;
    this.endAfterPost = null;
    this.lastActSent = null;
  }

  sideOf(team) { return (team === 0) === (this.half === 0) ? 'atk' : 'def'; }
  teamOfSide(side) { return this.sideOf(0) === side ? 0 : 1; }
  aliveOnSide(side) { return game.chars.filter((c) => c.alive && c.side === side); }

  // ---------- Kurulum ----------
  // Yerel oyuncu + botlarla takımları doldur
  populate(localName, localAgent) {
    const size = this.mode.teamSize;
    const names = shuffle(BOT_NAMES);
    const local = new Character({ id: game.nextId++, name: localName, team: 0, agent: localAgent, kind: 'local' });
    game.chars.push(local);
    game.local = local;
    const used = [new Set([localAgent]), new Set()];
    for (let team = 0; team < 2; team++) {
      const n = team === 0 ? size - 1 : size;
      for (let i = 0; i < n; i++) {
        const free = AGENT_KEYS.filter((a) => !used[team].has(a));
        const agent = pick(free.length ? free : AGENT_KEYS);
        used[team].add(agent);
        const c = new Character({ id: game.nextId++, name: names.pop() || `Bot${i}`, team, agent, kind: 'bot' });
        game.chars.push(c);
      }
    }
    for (const c of game.chars) c.createModel();
  }

  begin() {
    for (const c of game.chars) {
      c.credits = ECON.start;
      c.ult = 0;
      c.resetCharges(true);
      c.alive = false;
    }
    this.startRound();
  }

  // ---------- Raund akışı (sadece sunucu) ----------
  startRound() {
    const m = this.mode, w = game.world;
    this.round++;
    game.abilities.clearAll();
    game.fx.clearHoles();
    for (const o of this.orbs) o.taken = false;
    if (m.randomWeapon) this.roundWeapon = pick(RANDOM_WEAPONS);
    const site = m.prePlanted ? (Math.random() < 0.5 ? 'A' : 'B') : null;
    const spikePos = site ? w.plantSpots[site] : null;

    const bySide = { atk: [], def: [] };
    for (const c of game.chars) bySide[c.side].push(c);
    for (const side of ['atk', 'def']) {
      bySide[side].forEach((c, i) => {
        const spots = site ? w.retake[site][side] : w.spawns[side];
        const base = spots[i % spots.length];
        const pos = base.clone().add(new THREE.Vector3(i >= spots.length ? 1.2 : 0, 0, 0));
        const look = site ? (side === 'atk' ? w.siteCenters[site].clone().multiplyScalar(0.3).add(pos.clone().multiplyScalar(0.7)).add(new THREE.Vector3(0, 0, -5)) : spikePos)
          : (side === 'atk' ? pos.clone().add(new THREE.Vector3(0, 0, -10)) : pos.clone().add(new THREE.Vector3(0, 0, 10)));
        const survived = c.alive && this.round > 1 && !this.resetLoadouts;
        if (!survived) {
          c.loadout = { primary: null, secondary: 'kestrel' };
          c.armor = 0;
        }
        if (!m.economy) {
          const wpn = m.randomWeapon ? this.roundWeapon : pick(['vortex', 'phase']);
          c.loadout = slotOf(wpn) === 'secondary' ? { primary: null, secondary: wpn } : { primary: wpn, secondary: 'kestrel' };
          c.armor = 50;
        }
        if (m.economy) {
          c.charges.E = AGENTS[c.agent].abilities.find((a) => a.key === 'E').charges;
          if (this.round === 1 || this.resetLoadouts) c.resetCharges(true);
        } else {
          c.resetCharges(true);
        }
        c.alive = true;
        c.health = 100;
        c.clearStatus();
        c.vel.set(0, 0, 0);
        c.pos.copy(pos);
        c.yaw = Math.atan2(-(look.x - pos.x), -(look.z - pos.z));
        c.pitch = 0;
        c.crouching = false;
        c.hasSpike = false;
        c.boughtThisRound = {};
        c.pv++;
        c.lv++;
        c.deathT = 0;
        if (c.model) { c.model.group.position.copy(pos); c.model.group.rotation.set(0, c.yaw + Math.PI, 0); }
      });
    }
    this.resetLoadouts = false;

    // Spike
    this.spike = { state: 'none', carrier: null, pos: [0, 0, 0], site: null, timer: 0, saved: 0 };
    if (m.prePlanted) {
      this.spike = { state: 'planted', carrier: null, pos: [spikePos.x, spikePos.y, spikePos.z], site, timer: m.spikeTime, saved: 0 };
    } else if (m.allSpikes) {
      this.spike.state = 'carried';
    } else if (bySide.atk.length) {
      const humans = bySide.atk.filter((c) => c.kind !== 'bot');
      const carrier = humans.length && Math.random() < 0.6 ? pick(humans) : pick(bySide.atk);
      carrier.hasSpike = true;
      this.spike.state = 'carried';
      this.spike.carrier = carrier.id;
    }

    this.phase = 'buy';
    this.timer = m.buyTime;
    this.roundTime = 0;
    game.bots?.onRoundStart();
    game.net?.broadcast(this.snapshot());
    this.emit({ t: 'round', r: this.round, site });
  }

  endRound(winner, reason) {
    if (this.phase === 'post' || this.phase === 'end') return;
    this.phase = 'post';
    this.timer = TIMES.post;
    this.score[winner]++;
    const loser = 1 - winner;
    if (this.mode.economy) {
      this.lossStreak[winner] = 0;
      this.lossStreak[loser]++;
      const lossPay = Math.min(ECON.lossMax, ECON.loss + (this.lossStreak[loser] - 1) * ECON.streakBonus);
      for (const c of game.chars) {
        c.credits = Math.min(ECON.max, c.credits + (c.team === winner ? ECON.win : lossPay));
      }
    }
    for (const c of game.chars) c.action = null;
    this.endAfterPost = this.score[winner] >= this.mode.winRounds ? winner : null;
    this.emit({ t: 'roundEnd', w: winner, why: reason, sc: this.score.slice() });
  }

  afterPost() {
    if (this.endAfterPost !== null) {
      this.phase = 'end';
      this.emit({ t: 'end', w: this.endAfterPost, sc: this.score.slice() });
      return;
    }
    if (this.round === this.mode.halfAt) {
      this.half = 1;
      this.resetLoadouts = true;
      this.lossStreak = [0, 0];
      if (this.mode.economy) for (const c of game.chars) c.credits = ECON.start;
      this.emit({ t: 'banner', a: 'TARAF DEĞİŞTİRİLİYOR', b: 'İkinci yarı başlıyor' });
    }
    this.startRound();
  }

  update(dt) {
    for (const c of game.chars) {
      c.tickStatus(dt);
      if (game.isHost && c.alive && c.st.heal > 0) c.health = Math.min(100, c.health + c.healRate * dt);
    }
    if (!game.isHost) {
      this.timer = Math.max(0, this.timer - dt);
      if (this.phase === 'planted') this.spikeBeeps(dt);
      return;
    }
    const m = this.mode;
    this.timer -= dt;
    if (this.phase === 'round' || this.phase === 'planted') this.roundTime += dt;
    switch (this.phase) {
      case 'buy':
        if (this.timer <= 0) {
          if (m.prePlanted) { this.phase = 'planted'; this.timer = this.spike.timer; } else { this.phase = 'round'; this.timer = m.roundTime; }
          this.emit({ t: 'go' });
        }
        break;
      case 'round':
        if (this.timer <= 0) this.endRound(this.teamOfSide('def'), 'time');
        break;
      case 'planted':
        this.spike.timer = this.timer;
        this.spikeBeeps(dt);
        if (this.timer <= 0) this.explodeSpike();
        break;
      case 'post':
        if (this.timer <= 0) this.afterPost();
        break;
      default:
    }
    if (this.phase === 'round' || this.phase === 'planted') {
      this.processActions(dt);
      this.spikePickup();
      this.checkWin();
    }
  }

  spikeBeeps(dt) {
    this.beepT -= dt;
    if (this.beepT > 0) return;
    const t = Math.max(0, this.timer);
    this.beepT = t > 20 ? 1 : t > 10 ? 0.5 : t > 5 ? 0.25 : 0.12;
    const sp = new THREE.Vector3(...this.spike.pos);
    const d = game.local ? game.local.pos.distanceTo(sp) : 0;
    if (d < 45) sfx.beep(t < 10);
  }

  checkWin() {
    const atk = this.aliveOnSide('atk').length, def = this.aliveOnSide('def').length;
    const atkTeam = this.teamOfSide('atk'), defTeam = 1 - atkTeam;
    if (this.phase === 'round') {
      if (atk === 0) this.endRound(defTeam, 'elim');
      else if (def === 0) this.endRound(atkTeam, 'elim');
    } else if (this.phase === 'planted') {
      if (def === 0) this.endRound(atkTeam, 'elim');
    }
  }

  // ---------- Spike ----------
  canPlant(c) {
    if (c.side !== 'atk') return false;
    return c.hasSpike || (this.mode.allSpikes && this.spike.state === 'carried');
  }

  plantZoneAt(pos) {
    for (const [k, z] of Object.entries(game.world.plantZones)) {
      if (pos.x > z.minX && pos.x < z.maxX && pos.z > z.minZ && pos.z < z.maxZ) return k;
    }
    return null;
  }

  processActions(dt) {
    const sp = new THREE.Vector3(...this.spike.pos);
    for (const c of game.chars) {
      if (!c.alive || !c.action) { if (c.action !== 'defuse') c.actionProg = 0; continue; }
      let valid = false;
      if (c.action === 'plant') {
        const site = this.plantZoneAt(c.pos);
        valid = this.phase === 'round' && this.canPlant(c) && !!site && c.pos.y < 1;
        if (valid) {
          c.actionProg += dt;
          if (c.actionProg >= TIMES.plant) this.plantSpike(c, site);
        }
      } else if (c.action === 'defuse') {
        valid = this.phase === 'planted' && c.side === 'def' && c.pos.distanceTo(sp) < 2.4;
        if (valid) {
          if (c.actionProg < this.spike.saved) c.actionProg = this.spike.saved;
          c.actionProg += dt;
          if (c.actionProg >= TIMES.defuseHalf) this.spike.saved = TIMES.defuseHalf;
          if (c.actionProg >= TIMES.defuse) this.defuseSpike(c);
        }
      } else if (c.action === 'orb') {
        const orb = this.nearOrb(c.pos);
        valid = !!orb;
        if (valid) {
          c.actionProg += dt;
          if (c.actionProg >= TIMES.orb) {
            orb.taken = true;
            this.addUlt(c, 1);
            c.actionProg = 0;
            c.action = null;
            this.emit({ t: 'orb', c: c.id });
          }
        }
      }
      if (!valid) c.actionProg = 0;
    }
  }

  nearOrb(pos) {
    return this.orbs.find((o) => !o.taken && Math.hypot(pos.x - o.p[0], pos.z - o.p[2]) < 1.7 && Math.abs(pos.y - o.p[1]) < 1.5) || null;
  }

  plantSpike(c, site) {
    this.spike = { state: 'planted', carrier: null, pos: [c.pos.x, c.pos.y, c.pos.z], site, timer: this.mode.spikeTime, saved: 0 };
    c.hasSpike = false;
    c.action = null;
    c.actionProg = 0;
    this.phase = 'planted';
    this.timer = this.mode.spikeTime;
    this.addUlt(c, 1);
    if (this.mode.economy) for (const o of game.chars) if (o.side === 'atk') o.credits = Math.min(ECON.max, o.credits + ECON.plant);
    this.emit({ t: 'plant', c: c.id, site });
  }

  defuseSpike(c) {
    this.spike.state = 'defused';
    c.action = null;
    this.addUlt(c, 1);
    this.emit({ t: 'defuse', c: c.id });
    this.endRound(c.team, 'defuse');
  }

  explodeSpike() {
    this.spike.state = 'exploded';
    const sp = new THREE.Vector3(...this.spike.pos);
    this.emit({ t: 'explode' });
    for (const c of game.chars) {
      if (c.alive && c.pos.distanceTo(sp) < TIMES.spikeRadius) this.applyDamage(c, 999, null, 'body', 'SPIKE', true);
    }
    this.endRound(this.teamOfSide('atk'), 'spike');
  }

  spikePickup() {
    if (this.spike.state !== 'dropped') return;
    const sp = new THREE.Vector3(...this.spike.pos);
    for (const c of game.chars) {
      if (c.alive && c.side === 'atk' && c.pos.distanceTo(sp) < 1.4) {
        c.hasSpike = true;
        this.spike.state = 'carried';
        this.spike.carrier = c.id;
        this.emit({ t: 'pickup', c: c.id });
        break;
      }
    }
  }

  // ---------- Hasar / leş (sadece sunucu) ----------
  applyDamage(target, amount, attacker, part, source, ignoreArmor = false) {
    if (!game.isHost || !target.alive || amount <= 0) return;
    if (this.phase === 'buy' || this.phase === 'end') return;
    if (target.st.intangible > 0 && !ignoreArmor) return;
    if (target.st.vulnerable > 0) amount *= 2;
    if (!ignoreArmor) {
      const absorbed = Math.min(target.armor, amount);
      target.armor -= absorbed;
      amount -= absorbed;
    }
    target.health -= amount;
    if (target.kind === 'local') game.hud.damage();
    if (target.kind === 'bot' && attacker) game.bots?.onDamaged(target, attacker);
    if (target.health > 0) return;
    // Ember'in ultisi: ölmek yerine işarette yeniden doğ
    if (target.rebirth && game.time < target.rebirth.until && source !== 'SPIKE') {
      const pos = target.rebirth.pos;
      target.rebirth = null;
      target.health = 100;
      this.teleport(target, pos);
      this.emit({ t: 'banner', a: '', b: `${target.name} küllerinden doğdu!`, small: true });
      return;
    }
    this.kill(target, attacker, part, source);
  }

  kill(victim, killer, part, source) {
    victim.alive = false;
    victim.health = 0;
    victim.deaths++;
    victim.action = null;
    victim.actionProg = 0;
    victim.ultWeapon = null;
    victim.rebirth = null;
    this.addUlt(victim, 1);
    if (victim.hasSpike) {
      victim.hasSpike = false;
      this.spike.state = 'dropped';
      this.spike.carrier = null;
      this.spike.pos = [victim.pos.x, Math.max(0, victim.pos.y), victim.pos.z];
    }
    if (killer && killer !== victim && killer.team !== victim.team) {
      killer.kills++;
      killer.lastKill = game.time;
      if (this.mode.economy) killer.credits = Math.min(ECON.max, killer.credits + ECON.kill);
      this.addUlt(killer, 1);
      game.bots?.onKill(killer);
    }
    this.emit({ t: 'kill', k: killer ? killer.id : null, v: victim.id, w: source, h: part === 'head' ? 1 : 0 });
  }

  addUlt(c, n) {
    const max = AGENTS[c.agent].ult;
    const before = c.ult;
    c.ult = Math.min(max, c.ult + n);
    if (before < max && c.ult >= max && c.kind === 'local') sfx.ultReady();
  }

  reveal(c, t) { c.st.revealed = Math.max(c.st.revealed, t); }
  heal(c, amount) { if (c.alive) c.health = Math.min(100, c.health + amount); }

  revive(c) {
    c.alive = true;
    c.health = 100;
    c.clearStatus();
    c.deathT = 0;
    c.pv++;
    this.emit({ t: 'banner', a: '', b: `${c.name} diriltildi!`, small: true });
  }

  teleport(c, pos) {
    c.pos.copy(pos);
    c.vel.set(0, 0, 0);
    c.pv++;
  }

  // ---------- Satın alma ----------
  buy(c, item) {
    if (!this.mode.economy || this.phase !== 'buy' || !c.alive) return false;
    if (WEAPONS[item]) {
      const def = WEAPONS[item];
      const slot = slotOf(item);
      if (c.loadout[slot] === item || c.credits < def.price) return false;
      const refund = c.loadout[slot] && c.loadout[slot] !== 'kestrel' && c.boughtThisRound?.[slot] ? WEAPONS[c.loadout[slot]].price : 0;
      c.credits += refund;
      c.credits -= def.price;
      c.loadout = { ...c.loadout, [slot]: item };
      c.boughtThisRound = { ...(c.boughtThisRound || {}), [slot]: true };
      c.lv++;
    } else if (ARMORS[item]) {
      const a = ARMORS[item];
      if (c.armor >= a.value || c.credits < a.price) return false;
      c.credits -= a.price;
      c.armor = a.value;
    } else if (item === 'C' || item === 'Q') {
      const a = ability(c.agent, item);
      if (c.charges[item] >= a.charges || c.credits < a.cost) return false;
      c.credits -= a.cost;
      c.charges[item]++;
    } else {
      return false;
    }
    if (c.kind === 'local') game.onLocalLoadout?.();
    return true;
  }

  // ---------- Yerel oyuncudan gelen istekler (sunucuysak uygula, değilsek gönder) ----------
  requestCast(c, slot, type, origin, dir) {
    const ev = {
      type, slot, owner: c.id, team: c.team, ag: c.agent,
      o: [r2(origin.x), r2(origin.y), r2(origin.z)],
      d: [dir.x, dir.y, dir.z].map((v) => Math.round(v * 1000) / 1000),
    };
    if (game.isHost) {
      this.handleCast(c, ev);
    } else {
      if (slot === 'X') c.ult = 0; else if (slot !== 'W') c.charges[slot] = Math.max(0, c.charges[slot] - 1);
      game.net.send({ t: 'cast', ev });
    }
  }

  handleCast(c, ev) {
    if (!c || !c.alive) return;
    if (ev.slot === 'X') {
      if (c.ult < AGENTS[c.agent].ult) return;
      c.ult = 0;
    } else if (ev.slot !== 'W') {
      if (!(c.charges[ev.slot] > 0)) return;
      c.charges[ev.slot]--;
    }
    ev.id = this.nextEvId++;
    ev.team = c.team;
    ev.ag = c.agent;
    game.abilities.spawn(ev);
    game.net?.broadcast({ t: 'cast', ev });
  }

  reportHit(attacker, target, dmg, part, weapon) {
    const name = WEAPONS[weapon]?.name || weapon;
    if (game.isHost) this.applyDamage(target, dmg, attacker, part, name);
    else game.net.send({ t: 'hit', v: target.id, dmg: Math.round(dmg * 10) / 10, part, w: weapon });
  }

  reportFxHit(id, dmg, seg) {
    if (game.isHost) game.abilities.byId(id)?.takeDamage?.(dmg, seg);
    else game.net.send({ t: 'fxhit', id, dmg, seg });
  }

  // Mermi izi çizgisini diğer oyunculara da göster
  reportShot(c, from, to, sound) {
    const msg = { t: 'shot', c: c ? c.id : 0, f: [r2(from.x), r2(from.y), r2(from.z)], e: [r2(to.x), r2(to.y), r2(to.z)], s: sound };
    if (game.isHost) {
      if (!c || c.kind === 'bot') this.drawShot(msg);
      game.net?.broadcast(msg);
    } else {
      game.net.send(msg);
    }
  }

  drawShot(msg) {
    const from = new THREE.Vector3(...msg.f), to = new THREE.Vector3(...msg.e);
    if (msg.s !== 'silenced' || Math.random() < 0.3) game.fx.tracer(from, to, 0xffc890);
    const d = game.local ? game.local.pos.distanceTo(from) : 0;
    sfx.shot(msg.s, d);
  }

  requestUltEnd(c) { c.ultWeapon = null; }

  requestBuy(c, item) {
    if (game.isHost) return this.buy(c, item);
    game.net.send({ t: 'buy', item });
    return true;
  }

  setAction(c, action) {
    if (game.isHost) { c.action = action; return; }
    c.action = action;
    if (action !== this.lastActSent) {
      this.lastActSent = action;
      game.net.send({ t: 'act', a: action });
    }
  }

  broadcastFx(id, s) { game.net?.broadcast({ t: 'fx', id, s }); }

  // ---------- Olaylar ----------
  emit(e) {
    this.onEvent(e);
    game.net?.broadcast(e);
  }

  onEvent(e) {
    const hud = game.hud;
    const me = game.local;
    switch (e.t) {
      case 'round':
        if (!game.isHost) {
          game.abilities.clearAll();
          game.fx.clearHoles();
          this.round = e.r;
        }
        game.gun?.resetForRound();
        game.controller?.onRoundStart();
        hud.banner(`RAUND ${e.r}`, this.mode.economy ? 'SATIN ALMA AŞAMASI — B ile market' : (e.site ? `Spike ${e.site} bölgesinde kurulu!` : 'HAZIRLAN'));
        sfx.roundStart();
        if (me && me.hasSpike) hud.toast('Spike sende! Bölgeye götür: 4 ile çıkar, sol tık basılı tut.');
        else if (me && me.side === 'atk' && !this.mode.prePlanted) hud.toast('Spike bir takım arkadaşında — sırtındaki kırmızı cihaz.');
        break;
      case 'go':
        hud.banner('', this.mode.prePlanted ? (me && me.side === 'atk' ? 'SPIKE\'I KORU!' : 'BÖLGEYİ GERİ AL!') : 'RAUND BAŞLADI', true);
        break;
      case 'roundEnd': {
        const won = me && e.w === me.team;
        const why = { elim: 'Tüm düşmanlar öldürüldü', time: 'Süre doldu', spike: 'Spike patladı', defuse: 'Spike çözüldü' }[e.why] || '';
        hud.banner(won ? 'RAUNDU KAZANDIN' : 'RAUNDU KAYBETTİN', why, false, won ? 'win' : 'lose');
        if (won) sfx.win(); else sfx.lose();
        break;
      }
      case 'end':
        game.onMatchEnd?.(e.w, e.sc);
        break;
      case 'kill': {
        const k = game.charById(e.k), v = game.charById(e.v);
        if (!v) break;
        hud.killfeed(k, v, e.w, e.h);
        if (k && k === me) {
          sfx.kill();
          hud.hitmarker(!!e.h, true);
          game.gun?.onKill(e.w === WEAPONS.blades.name ? 'blades' : e.w);
        }
        break;
      }
      case 'plant':
        hud.banner('SPIKE KURULDU', `${e.site} bölgesi`, true);
        sfx.plantDone();
        this.beepT = 0;
        break;
      case 'defuse':
        hud.banner('SPIKE ÇÖZÜLDÜ', '', true);
        break;
      case 'explode': {
        const sp = new THREE.Vector3(...this.spike.pos);
        game.fx.explosion(sp.clone().setY(sp.y + 1), 22, 0xfff0c0);
        game.fx.explosion(sp.clone().setY(sp.y + 1), 14, 0xff6a2a);
        sfx.explosion(0);
        break;
      }
      case 'orb':
        if (me && e.c === me.id) { sfx.orb(); hud.toast('Ulti küresi alındı! +1 ulti puanı'); }
        break;
      case 'pickup':
        if (me && e.c === me.id) hud.toast('Spike sende! 4 ile çıkar, bölgede sol tık basılı tut.');
        break;
      case 'banner':
        hud.banner(e.a, e.b, true);
        break;
      case 'chat':
        hud.chat(e.n, e.m, e.tm, e.bot);
        sfx.chat();
        break;
      default:
    }
  }

  // ---------- Online senkronizasyon ----------
  snapshot() {
    return {
      t: 'snap',
      m: {
        ph: this.phase, tm: r2(this.timer), r: this.round, sc: this.score, h: this.half,
        sp: this.spike, ob: this.orbs.map((o) => (o.taken ? 1 : 0)),
      },
      c: game.chars.map((c) => ({
        i: c.id, n: c.name, tm: c.team, ag: c.agent, k: c.kind === 'bot' ? 'b' : 'h',
        p: [r2(c.pos.x), r2(c.pos.y), r2(c.pos.z)], y: r2(c.yaw), pi: r2(c.pitch), cr: c.crouching ? 1 : 0,
        wk: c.walking ? 1 : 0, w: c.weapon, hp: Math.ceil(c.health), ar: Math.ceil(c.armor), al: c.alive ? 1 : 0,
        cd: c.credits, u: c.ult, ch: [c.charges.C, c.charges.Q, c.charges.E], lo: [c.loadout.primary, c.loadout.secondary],
        lv: c.lv, pv: c.pv, rv: r2(c.st.revealed), vu: r2(c.st.vulnerable), dt: r2(c.st.detained),
        it: r2(c.st.intangible), em: r2(c.st.empress), tt: r2(c.st.tether), ki: c.kills, de: c.deaths,
        ac: c.action, ap: r2(c.actionProg), lk: r2(Math.min(99, game.time - c.lastKill)), sp: c.hasSpike ? 1 : 0,
      })),
    };
  }

  applySnapshot(s) {
    const m = s.m;
    const prevPhase = this.phase;
    this.phase = m.ph;
    this.timer = m.tm;
    this.round = m.r;
    this.score = m.sc;
    this.half = m.h;
    this.spike = m.sp;
    m.ob.forEach((t, i) => { if (this.orbs[i]) this.orbs[i].taken = !!t; });
    if (prevPhase === 'planted' && m.ph !== 'planted') this.beepT = 0;

    const seen = new Set();
    for (const d of s.c) {
      seen.add(d.i);
      let c = game.charById(d.i);
      const isMe = d.i === game.localId;
      if (!c) {
        c = new Character({ id: d.i, name: d.n, team: d.tm, agent: d.ag, kind: isMe ? 'local' : d.k === 'b' ? 'bot' : 'remote' });
        c.pos.set(...d.p);
        c.prevPos.copy(c.pos);
        game.chars.push(c);
        c.createModel();
        if (isMe) { game.local = c; c.pv = -1; game.onLocalAgent?.(); }
      }
      if (c.agent !== d.ag) { c.setAgent(d.ag); if (isMe) game.onLocalAgent?.(); }
      c.name = d.n;
      c.team = d.tm;
      if (!isMe) {
        c.kind = d.k === 'b' ? 'bot' : 'remote';
        c.pos.set(...d.p);
        c.yaw = d.y;
        c.pitch = d.pi;
        c.crouching = !!d.cr;
        c.walking = !!d.wk;
        c.weapon = d.w;
        c.charges.C = d.ch[0]; c.charges.Q = d.ch[1]; c.charges.E = d.ch[2];
        c.ult = d.u;
      } else {
        if (d.pv !== c.pv) {
          c.pv = d.pv;
          c.pos.set(...d.p);
          c.vel.set(0, 0, 0);
          c.yaw = d.y;
          c.pitch = 0;
        }
        if (d.hp < c.health && d.al) game.hud.damage();
        // Sunucunun onayladığı yetenek hakları ve ulti
        c.charges.C = d.ch[0]; c.charges.Q = d.ch[1]; c.charges.E = d.ch[2];
        if (d.u >= AGENTS[c.agent].ult && c.ult < d.u) sfx.ultReady();
        c.ult = d.u;
      }
      c.health = d.hp;
      c.armor = d.ar;
      const wasAlive = c.alive;
      c.alive = !!d.al;
      if (!wasAlive && c.alive) c.deathT = 0;
      c.credits = d.cd;
      const prevLo = { ...c.loadout };
      c.loadout = { primary: d.lo[0], secondary: d.lo[1] };
      if (isMe && d.lv !== c.lv) { c.lv = d.lv; game.gun?.onLoadoutChanged(prevLo); } else c.lv = d.lv;
      c.st.revealed = d.rv; c.st.vulnerable = d.vu; c.st.detained = d.dt; c.st.intangible = d.it; c.st.empress = d.em; c.st.tether = d.tt;
      c.kills = d.ki;
      c.deaths = d.de;
      c.actionProg = d.ap;
      if (!isMe) c.action = d.ac;
      c.lastKill = game.time - d.lk;
      c.hasSpike = !!d.sp;
    }
    for (const c of game.chars.slice()) {
      if (!seen.has(c.id)) {
        c.removeModel();
        game.chars.splice(game.chars.indexOf(c), 1);
      }
    }
  }
}
