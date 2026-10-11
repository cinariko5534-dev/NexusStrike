// YEREL OYUNCU KONTROLÜ (Valorant tuşları)
// WASD hareket, Shift yürü, Ctrl eğil, Boşluk zıpla, C/Q/E yetenekler, X ulti, F etkileşim.
import * as THREE from 'three';
import { game } from './game.js';
import { moveBody, overlaps } from './physics.js';
import { WEAPONS } from './weapons.js';
import * as sfx from './audio.js';

const JUMP = 6.8;
const GRAV = 20;
const RADIUS = 0.35;

export class PlayerController {
  constructor() {
    this.spawnPos = new THREE.Vector3();
    this.spawnPv = -99;
    this.moveDir = new THREE.Vector3();
    this.deadT = 0;
    this.specIdx = 0;
    this.stepT = 0;
    this.eye = 1.62;
  }

  onRoundStart() {
    this.deadT = 0;
    game.spectating = null;
  }

  look(dx, dy) {
    const c = game.local;
    if (!c || !c.alive) return;
    const zoom = game.gun ? game.gun.zoomFactor : 1;
    const s = 0.0022 * (game.settings.sens || 1) / zoom;
    c.yaw -= dx * s;
    c.pitch = Math.max(-1.5, Math.min(1.5, c.pitch - dy * s));
    c.lookDX += dx;
  }

  update(dt, input) {
    const c = game.local;
    const m = game.match;
    if (!c || !m) return;
    if (!c.alive) { this.spectate(dt, input); return; }
    game.spectating = null;
    this.deadT = 0;
    if (c.pv !== this.spawnPv) {
      this.spawnPv = c.pv;
      this.spawnPos.copy(c.pos);
      c.recoilPitch = c.recoilYaw = 0;
    }

    const k = input.typing ? new Set() : input.keys;
    const wantCrouch = k.has('ControlLeft') || k.has('ControlRight');
    if (wantCrouch) c.crouching = true;
    else if (c.crouching && !overlaps(c.pos, RADIUS, 1.8)) c.crouching = false;
    c.walking = k.has('ShiftLeft') || k.has('ShiftRight');

    let fx = 0, fz = 0;
    if (k.has('KeyW')) fz -= 1;
    if (k.has('KeyS')) fz += 1;
    if (k.has('KeyA')) fx -= 1;
    if (k.has('KeyD')) fx += 1;
    const len = Math.hypot(fx, fz);
    const sin = Math.sin(c.yaw), cos = Math.cos(c.yaw);
    this.moveDir.set(0, 0, 0);
    if (len > 0) this.moveDir.set((fx * cos + fz * sin) / len, 0, (-fx * sin + fz * cos) / len);

    const busy = (c.action === 'plant' || c.action === 'defuse' || c.action === 'orb') && c.actionProg > 0;
    const frozen = m.phase === 'end' || busy;
    let max = WEAPONS[game.gun?.current]?.speed || 5.4;
    if (c.walking) max *= 0.55;
    if (c.crouching) max *= 0.5;
    if (c.st.slow > 0 || c.st.tether > 0) max *= 0.5;
    if (c.st.stun > 0) max *= 0.6;
    if (c.st.detained > 0) max *= 0.5;
    if (c.st.stim > 0) max *= 1.1;
    if (c.st.intangible > 0) max *= 1.5;
    if (game.gun && game.gun.zoomFactor > 1) max *= 0.75;
    const wish = frozen ? new THREE.Vector3() : this.moveDir;

    if (c.dashT > 0) {
      c.dashT -= dt;
      c.vel.x = c.dashDir.x * 20;
      c.vel.z = c.dashDir.z * 20;
    } else if (c.onGround || wish.lengthSq() > 0) {
      if (c.launchT > 0) c.launchT -= dt;
      const accel = c.onGround && !(c.launchT > 0) ? (wish.lengthSq() > 0 ? 70 : 55) : 12;
      const dvx = wish.x * max - c.vel.x, dvz = wish.z * max - c.vel.z;
      const dl = Math.hypot(dvx, dvz), step = accel * dt;
      if (dl <= step) { c.vel.x += dvx; c.vel.z += dvz; } else { c.vel.x += dvx / dl * step; c.vel.z += dvz / dl * step; }
    }

    const canJump = !frozen && !(c.st.slow > 0 || c.st.tether > 0);
    if (input.pressed.has('Space') && c.onGround && canJump) { c.vel.y = JUMP; c.onGround = false; }
    c.vel.y -= GRAV * dt;
    const wasGround = c.onGround;
    c.onGround = moveBody(c.pos, c.vel, dt, RADIUS, c.height, c.onGround ? 0.45 : 0);
    if (!wasGround && c.onGround) sfx.land(0);

    // Satın alma aşamasında doğuş bölgesinden çıkılmaz
    if (m.phase === 'buy') {
      const dx = c.pos.x - this.spawnPos.x, dz = c.pos.z - this.spawnPos.z;
      const d = Math.hypot(dx, dz);
      if (d > 4.5) { c.pos.x = this.spawnPos.x + dx / d * 4.5; c.pos.z = this.spawnPos.z + dz / d * 4.5; }
    }

    // Ayak sesleri (Shift ile yürürsen ve eğilirsen ses çıkmaz)
    if (c.onGround && c.speed > 3.5 && !c.walking && !c.crouching) {
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.36; sfx.step(0, true); }
    }

    if (!input.typing) {
      for (const slot of ['C', 'Q', 'E', 'X']) if (input.pressed.has(`Key${slot}`)) this.tryCast(slot);
    }

    // Etkileşim: Spike kur / çöz, ulti küresi
    let action = null;
    if (game.gun?.wantPlant) action = 'plant';
    else if (k.has('KeyF')) {
      const sp = new THREE.Vector3(...m.spike.pos);
      if (m.spike.state === 'planted' && c.side === 'def' && c.pos.distanceTo(sp) < 2.4) action = 'defuse';
      else if (m.nearOrb(c.pos)) action = 'orb';
    }
    m.setAction(c, action);

    const targetEye = c.crouching ? 1.05 : 1.62;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 12);
    this.updateCamera();
  }

  updateCamera() {
    const c = game.local;
    const cam = game.camera;
    cam.position.set(c.pos.x, c.pos.y + this.eye, c.pos.z);
    let shake = 0;
    if (c.st.stun > 0) shake = Math.sin(game.time * 23) * 0.03;
    cam.rotation.set(c.pitch + c.recoilPitch + shake, c.yaw + c.recoilYaw + shake * 0.7, shake * 0.5, 'YXZ');
  }

  tryCast(slot) {
    const c = game.local, m = game.match, hud = game.hud;
    const a = c.def.abilities.find((x) => x.key === slot);
    if (!a || !c.alive || c.st.detained > 0 || m.phase === 'end' || m.phase === 'post') return;
    if (slot === 'X') {
      if (c.ult < c.def.ult) { hud.toast(`Ulti hazır değil (${c.ult}/${c.def.ult})`); return; }
    } else if (!(c.charges[slot] > 0)) {
      hud.toast(`${a.name}: hakkın kalmadı${m.mode.economy && slot !== 'E' ? ' (B ile satın al)' : ''}`);
      return;
    }
    if (a.needKill && game.time - c.lastKill > 5) { hud.toast('Önce bir leş almalısın (son 5 saniye)'); return; }
    if (a.type === 'resurrect' && !game.chars.some((o) => o.team === c.team && !o.alive)) {
      hud.toast('Diriltilecek ölü takım arkadaşı yok');
      return;
    }
    const eye = c.eye();
    let dir = c.aimDir();
    if (a.type === 'dash') {
      const d = this.moveDir.lengthSq() > 0 ? this.moveDir.clone() : c.aimDir().setY(0).normalize();
      c.dashT = 0.2;
      c.dashDir.copy(d);
      dir = d;
    }
    if (a.type === 'updraft') { c.vel.y = 9.5; c.onGround = false; }
    m.requestCast(c, slot, a.type, eye, dir);
  }

  // Ölünce: önce kendi bedenine bak, sonra yaşayan takım arkadaşını izle (sol tık ile değiştir)
  spectate(dt, input) {
    const c = game.local;
    const cam = game.camera;
    this.deadT += dt;
    const allies = game.chars.filter((o) => o.team === c.team && o.alive && o !== c);
    if (this.deadT < 2 || !allies.length) {
      game.spectating = 'dead';
      const back = new THREE.Vector3(Math.sin(c.yaw) * 3, 2.2 + Math.min(this.deadT, 2) * 0.5, Math.cos(c.yaw) * 3);
      cam.position.copy(c.pos).add(back);
      cam.lookAt(c.pos.x, c.pos.y + 0.4, c.pos.z);
      return;
    }
    if (input.pressed.has('Mouse0') || input.pressed.has('Space')) this.specIdx++;
    const t = allies[this.specIdx % allies.length];
    game.spectating = t;
    const base = t.model ? t.model.group.position : t.pos;
    cam.position.set(base.x, base.y + t.eyeHeight, base.z);
    cam.rotation.set(t.pitch, t.yaw, 0, 'YXZ');
  }
}
