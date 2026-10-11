// OYUN İÇİ ARAYÜZ: can, yetenekler, ulti, süre, skor, mini harita, market, skor tablosu, sohbet.
import * as THREE from 'three';
import { game } from './game.js';
import { AGENTS, ROLES } from './agents.js';
import { WEAPONS, ARMORS, SHOP } from './weapons.js';
import { colliders } from './physics.js';
import { TIMES } from './config.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export const TYPE_ICON = {
  updraft: '⤒', dash: '➶', smoke: '☁', molly: '🔥', flash: '✷', leer: '👁', devour: '♥', dismiss: '◌',
  empress: '♛', fireWall: '▤', rebirth: '↺', satchel: '✹', grenade: '●', rocket: '🚀', teleport: '⇢',
  blindLine: '≋', stim: '⇡', orbital: '◎', wall: '▥', slowOrb: '❄', healOrb: '✚', resurrect: '✟',
  nanoswarm: '⁂', alarmbot: '⚠', turret: '⌖', lockdown: '⬢', trap: '⎯', camera: '◉', revealAll: '⌬',
  shockDart: '⚡', scoutPulse: '◍', revealDart: '➹', hunterFury: '⫸', healArea: '❀', stunGrenade: '✺',
  seekers: '⟡', aftershock: '≈', faultLine: '⩘', rollingThunder: '⛰', bladeStorm: '✦',
};

export class HUD {
  constructor() {
    this.el = {
      root: $('hud'), hp: $('hpval'), armor: $('armorval'), hpBar: $('hpbar'),
      weapon: $('weaponname'), ammo: $('ammoval'), reserve: $('reserveval'), reloadHint: $('reloadhint'), credits: $('credits'), spikeBadge: $('spike-badge'), weaponSlots: $('weapon-slots'),
      crosshair: $('crosshair'), hitmarker: $('hitmarker'), vignette: $('damage-vignette'),
      killfeed: $('killfeed'), banner: $('banner'), bannerBig: $('banner-big'), bannerSmall: $('banner-small'),
      toast: $('toast'), timer: $('round-timer'), roundLabel: $('round-label'), spikeIcon: $('spike-icon'),
      scoreAlly: $('score-ally'), scoreEnemy: $('score-enemy'), teamL: $('team-left'), teamR: $('team-right'),
      abilities: $('abilities'), prompt: $('prompt'), actionBar: $('action-bar'), actionFill: $('action-fill'),
      actionLabel: $('action-label'), actionHalf: $('action-half'),
      blind: $('blind'), nearsight: $('nearsight'), statusText: $('status-text'), empress: $('empress-fx'),
      scope: $('scope'), minimap: $('minimap'), scoreboard: $('scoreboard'), buymenu: $('buymenu'),
      chatLog: $('chat-log'), chatInput: $('chat-input'), fps: $('fps'), spectate: $('spectate'),
    };
    this.hitT = 0;
    this.dmgT = 0;
    this.bannerT = 0;
    this.toastT = 0;
    this.frames = 0;
    this.fpsT = 0;
    this.mmT = 0;
    this.seen = new Set();
    this.cache = {};
    this.buildAbilityBar();
    this.mapCanvas = null;
    this.el.buymenu.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { game.closeBuy?.(); return; }
      const b = e.target.closest('[data-buy]');
      if (b && game.local) {
        game.match.requestBuy(game.local, b.dataset.buy);
        setTimeout(() => this.renderBuyMenu(), 120);
      }
    });
  }

  show(on) { this.el.root.classList.toggle('hidden', !on); }

  set(key, el, value, prop = 'textContent') {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el[prop] = value;
  }

  // ---------- Silah / nişangah ----------
  setWeapon(name, ammo, reserve, reloading, low) {
    this.el.weapon.textContent = name;
    this.el.ammo.textContent = ammo;
    this.el.reserve.textContent = reserve;
    this.el.reserve.parentElement.classList.toggle('noreserve', reserve === '');
    this.el.ammo.parentElement.classList.toggle('empty', ammo === 0);
    this.el.reloadHint.textContent = reloading ? 'DOLDURULUYOR...' : 'R — DOLDUR';
    this.el.reloadHint.style.visibility = reloading || low ? 'visible' : 'hidden';
  }

  setSpread(gap, scoped) {
    const v = `${gap.toFixed(1)}px`;
    if (this.cache.gap !== v) { this.cache.gap = v; this.el.crosshair.style.setProperty('--gap', v); }
    this.set('scoped', this.el.scope.classList, scoped ? 'on' : 'off', 'value');
    this.el.scope.style.display = scoped ? 'block' : 'none';
    this.el.crosshair.style.display = scoped ? 'none' : 'block';
  }

  hitmarker(head, killed) {
    this.el.hitmarker.className = (head ? 'head ' : '') + (killed ? 'kill' : '');
    this.hitT = killed ? 0.35 : 0.15;
  }

  damage() { this.dmgT = 0.5; }

  // ---------- Mesajlar ----------
  killfeed(k, v, weapon, head) {
    const me = game.local;
    const div = document.createElement('div');
    const allyV = me && v.team === me.team;
    div.className = 'entry' + (allyV ? ' bad' : '') + ((k === me || v === me) ? ' me' : '');
    const kName = k ? `<span class="${k.team === me?.team ? 'ally' : 'enemy'}">${AGENTS[k.agent].icon} ${esc(k.name)}</span>` : '';
    div.innerHTML = `${kName}<span class="wpn">${esc(weapon || '')}${head ? ' ◎' : ''}</span>` +
      `<span class="${allyV ? 'ally' : 'enemy'}">${AGENTS[v.agent].icon} ${esc(v.name)}</span>`;
    this.el.killfeed.prepend(div);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
    setTimeout(() => div.remove(), 6000);
  }

  banner(big, small, short = false, kind = '') {
    this.el.bannerBig.textContent = big || '';
    this.el.bannerSmall.textContent = small || '';
    this.el.banner.className = kind;
    this.el.banner.style.opacity = 1;
    this.bannerT = short ? 1.8 : 3;
  }

  toast(text) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = 1;
    this.toastT = 2.2;
  }

  chat(name, msg, team, bot) {
    const me = game.local;
    const div = document.createElement('div');
    div.className = 'line';
    const cls = me && team === me.team ? 'ally' : 'enemy';
    div.innerHTML = `<span class="${cls}">${bot ? '[BOT] ' : ''}${esc(name)}:</span> ${esc(msg)}`;
    this.el.chatLog.append(div);
    while (this.el.chatLog.children.length > 8) this.el.chatLog.firstChild.remove();
    setTimeout(() => div.classList.add('old'), 9000);
  }

  // ---------- Yetenek çubuğu ----------
  buildAbilityBar() {
    this.el.abilities.innerHTML = ['C', 'Q', 'E', 'X'].map((k) => `
      <div class="ab ${k === 'X' ? 'ult' : ''}" id="ab-${k}">
        <div class="ab-icon"></div>
        <div class="ab-key">${k}</div>
        <div class="ab-pips"></div>
      </div>`).join('');
  }

  updateAbilities(c) {
    const key = `${c.agent}|${c.charges.C}|${c.charges.Q}|${c.charges.E}|${c.ult}`;
    if (this.cache.ab === key) return;
    this.cache.ab = key;
    const def = AGENTS[c.agent];
    for (const a of def.abilities) {
      const el = $(`ab-${a.key}`);
      el.querySelector('.ab-icon').textContent = TYPE_ICON[a.type] || '•';
      el.title = `${a.name} — ${a.desc}`;
      const pips = el.querySelector('.ab-pips');
      if (a.key === 'X') {
        const ready = c.ult >= def.ult;
        el.classList.toggle('ready', ready);
        pips.innerHTML = Array.from({ length: def.ult }, (_, i) => `<i class="${i < c.ult ? 'on' : ''}"></i>`).join('');
      } else {
        const n = c.charges[a.key];
        el.classList.toggle('empty', n <= 0);
        pips.innerHTML = Array.from({ length: Math.max(a.charges, n) }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
      }
    }
  }

  // ---------- Takım simgeleri ----------
  updateTeams(me) {
    const side = (team) => game.chars.filter((c) => c.team === team)
      .map((c) => `<div class="ti ${c.alive ? '' : 'dead'}" title="${esc(c.name)}">${AGENTS[c.agent].icon}</div>`).join('');
    const key = game.chars.map((c) => `${c.id}${c.alive ? 1 : 0}${c.agent}${c.team}`).join(',');
    if (this.cache.teams === key) return;
    this.cache.teams = key;
    this.el.teamL.innerHTML = side(me.team);
    this.el.teamR.innerHTML = side(1 - me.team);
  }

  // ---------- Mini harita ----------
  drawStaticMap() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 440;
    const ctx = cv.getContext('2d');
    const b = game.world.bounds;
    const sx = (x) => (x - b.minX) / (b.maxX - b.minX) * 440;
    const sz = (z) => (z - b.minZ) / (b.maxZ - b.minZ) * 440;
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.fillRect(0, 0, 440, 440);
    ctx.fillStyle = 'rgba(70,90,105,0.9)';
    ctx.fillRect(sx(-42), sz(-42), sx(42) - sx(-42), sz(42) - sz(-42));
    for (const z of Object.values(game.world.plantZones)) {
      ctx.fillStyle = 'rgba(255,70,85,0.18)';
      ctx.fillRect(sx(z.minX), sz(z.minZ), sx(z.maxX) - sx(z.minX), sz(z.maxZ) - sz(z.minZ));
    }
    for (const c of colliders) {
      const tall = c.max.y > 1.5;
      ctx.fillStyle = tall ? 'rgba(15,20,26,0.95)' : 'rgba(40,52,62,0.95)';
      ctx.fillRect(sx(c.min.x), sz(c.min.z), sx(c.max.x) - sx(c.min.x), sz(c.max.z) - sz(c.min.z));
    }
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 34px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [k, p] of Object.entries(game.world.siteCenters)) ctx.fillText(k, sx(p.x), sz(p.z));
    this.mapCanvas = cv;
    this.sx = sx;
    this.sz = sz;
  }

  drawMinimap(me) {
    if (!this.mapCanvas) this.drawStaticMap();
    const cv = this.el.minimap;
    const ctx = cv.getContext('2d');
    const S = cv.width;
    const k = S / 440;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(this.mapCanvas, 0, 0, S, S);
    const X = (x) => this.sx(x) * k, Z = (z) => this.sz(z) * k;
    for (const s of game.abilities.smokes()) {
      ctx.fillStyle = 'rgba(200,200,220,0.55)';
      ctx.beginPath();
      ctx.arc(X(s.x), Z(s.z), Math.max(2, s.r * 5 * k), 0, Math.PI * 2);
      ctx.fill();
    }
    const m = game.match;
    m.orbs.forEach((o) => {
      if (o.taken) return;
      ctx.fillStyle = '#9ff7ff';
      ctx.beginPath();
      ctx.arc(X(o.p[0]), Z(o.p[2]), 4 * k * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    if (m.spike.state === 'planted' || m.spike.state === 'dropped') {
      ctx.fillStyle = m.spike.state === 'planted' && Math.sin(game.time * 10) > 0 ? '#ff4655' : '#ffd166';
      ctx.fillRect(X(m.spike.pos[0]) - 5 * k * 2, Z(m.spike.pos[2]) - 5 * k * 2, 10 * k * 2, 10 * k * 2);
    }
    for (const c of game.chars) {
      if (!c.alive) continue;
      const ally = c.team === me.team;
      if (!ally && !this.seen.has(c.id) && !(c.st.revealed > 0)) continue;
      const p = c.model ? c.model.group.position : c.pos;
      const x = X(p.x), z = Z(p.z);
      if (ally) {
        ctx.strokeStyle = 'rgba(61,255,197,0.5)';
        ctx.lineWidth = 2 * k * 2;
        ctx.beginPath();
        ctx.moveTo(x, z);
        ctx.lineTo(x - Math.sin(c.yaw) * 14 * k * 2, z - Math.cos(c.yaw) * 14 * k * 2);
        ctx.stroke();
      }
      ctx.fillStyle = c === me ? '#ffe14d' : ally ? '#3dffc5' : '#ff4655';
      ctx.beginPath();
      ctx.arc(x, z, (c === me ? 6 : 5) * k * 2, 0, Math.PI * 2);
      ctx.fill();
      if (c.hasSpike) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.stroke(); }
    }
  }

  // Düşmanlar: takımdan biri görüyorsa mini haritada görünür
  updateSeen(me) {
    this.seen.clear();
    const allies = game.chars.filter((c) => c.team === me.team && c.alive);
    for (const e of game.chars) {
      if (e.team === me.team || !e.alive) continue;
      const head = e.eye();
      for (const a of allies) {
        const eye = a.eye();
        if (eye.distanceTo(head) > 70) continue;
        if (game.worldLOS(eye, head) && !game.abilities.blocksVision(eye, head)) { this.seen.add(e.id); break; }
      }
    }
  }

  // ---------- Skor tablosu ----------
  renderScoreboard() {
    const me = game.local;
    const row = (c) => `<tr class="${c === me ? 'me' : ''} ${c.alive ? '' : 'dead'}">
      <td>${AGENTS[c.agent].icon}</td><td>${esc(c.name)}${c.kind === 'bot' ? ' <small>BOT</small>' : ''}</td>
      <td>${c.kills}</td><td>${c.deaths}</td>
      <td>${c.team === me.team ? c.credits : '—'}</td><td>${c.ult}/${AGENTS[c.agent].ult}</td></tr>`;
    const team = (t) => game.chars.filter((c) => c.team === t).sort((a, b) => b.kills - a.kills).map(row).join('');
    const sc = game.match.score;
    this.el.scoreboard.innerHTML = `
      <h2><span class="ally">${sc[me.team]}</span> — <span class="enemy">${sc[1 - me.team]}</span></h2>
      <table><thead><tr><th></th><th>OYUNCU</th><th>LEŞ</th><th>ÖLÜM</th><th>KREDİ</th><th>ULTİ</th></tr></thead>
      <tbody class="ally-rows">${team(me.team)}</tbody>
      <tbody class="enemy-rows">${team(1 - me.team)}</tbody></table>`;
  }

  // ---------- Market ----------
  renderBuyMenu() {
    const c = game.local;
    if (!c) return;
    const card = (key, name, price, owned, extra = '') => `
      <button class="buy-item ${owned ? 'owned' : ''} ${c.credits < price && !owned ? 'poor' : ''}" data-buy="${key}">
        <span class="bi-name">${name}</span><span class="bi-extra">${extra}</span><span class="bi-price">${owned ? 'ALINDI' : '¤ ' + price}</span>
      </button>`;
    const groups = SHOP.map((g) => `<div class="buy-group"><h4>${g.title}</h4>${g.items.map((k) => {
      const w = WEAPONS[k];
      return card(k, w.name, w.price, c.loadout.primary === k || c.loadout.secondary === k, `${w.dmg} hasar · ${w.mag} mermi`);
    }).join('')}</div>`).join('');
    const armor = `<div class="buy-group"><h4>SHIELDS</h4>${Object.entries(ARMORS).map(([k, a]) => card(k, a.name, a.price, c.armor >= a.value, `+${a.value}`)).join('')}</div>`;
    const abil = `<div class="buy-group"><h4>ABILITIES</h4>${AGENTS[c.agent].abilities.filter((a) => a.key === 'C' || a.key === 'Q').map((a) =>
      card(a.key, `${a.key} · ${a.name}`, a.cost, c.charges[a.key] >= a.charges, `${c.charges[a.key]}/${a.charges}`)).join('')}</div>`;
    const canBuy = game.match.phase === 'buy' && game.match.mode.economy;
    this.el.buymenu.innerHTML = `
      <div class="buy-head"><h2>MARKET</h2><div class="buy-credits">¤ ${c.credits}</div>
      <div class="buy-note">${canBuy ? 'Satın almak için tıkla. Kapatmak için B.' : 'Satın alma sadece raund başındaki satın alma aşamasında yapılabilir.'}</div>
      <button class="btn buy-close" data-close="1">KAPAT</button></div>
      <div class="buy-grid">${groups}${armor}${abil}</div>`;
  }

  // ---------- Her kare ----------
  update(dt) {
    const me = game.local;
    const m = game.match;
    this.hitT = Math.max(0, this.hitT - dt);
    this.el.hitmarker.style.opacity = this.hitT > 0 ? Math.min(1, this.hitT * 8) : 0;
    this.dmgT = Math.max(0, this.dmgT - dt);
    this.el.vignette.style.opacity = this.dmgT * 2;
    this.bannerT -= dt;
    this.el.banner.style.opacity = Math.max(0, Math.min(1, this.bannerT * 2));
    this.toastT -= dt;
    this.el.toast.style.opacity = Math.max(0, Math.min(1, this.toastT * 2));
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.el.fps.textContent = `${Math.round(this.frames / this.fpsT)} FPS`;
      this.frames = 0;
      this.fpsT = 0;
    }
    if (!me || !m) return;

    // Can / zırh / kredi
    this.set('hp', this.el.hp, String(Math.max(0, Math.ceil(me.health))));
    this.set('ar', this.el.armor, String(Math.max(0, Math.ceil(me.armor))));
    this.el.hp.parentElement.classList.toggle('low', me.health <= 30);
    this.set('hpw', this.el.hpBar.style, `${Math.max(0, me.health)}%`, 'width');
    this.set('cr', this.el.credits, m.mode.economy ? `¤ ${me.credits}` : '');
    const hasSpike = me.alive && (me.hasSpike || (m.mode.allSpikes && me.side === 'atk' && m.spike.state === 'carried'));
    this.set('spk', this.el.spikeBadge.style, hasSpike ? 'block' : 'none', 'display');

    // Silah yuvaları: 1 ana silah, 2 tabanca, 3 bıçak, 4 Spike
    const cur = game.gun?.current;
    const slots = [
      ['1', me.loadout.primary],
      ['2', me.loadout.secondary],
      ['3', 'knife'],
    ];
    if (hasSpike) slots.push(['4', 'spike']);
    const slotKey = `${slots.map((s) => s[1]).join()}|${cur}|${me.alive}`;
    if (this.cache.slots !== slotKey) {
      this.cache.slots = slotKey;
      this.el.weaponSlots.innerHTML = me.alive ? slots.map(([k, w]) =>
        `<div class="wslot ${w === cur ? 'cur' : ''} ${w ? '' : 'empty'} ${w === 'spike' ? 'spike' : ''}">${w ? WEAPONS[w].name : '—'}<b>${k}</b></div>`).join('') : '';
    }
    this.updateAbilities(me);
    this.updateTeams(me);

    // Süre ve skor
    const t = Math.max(0, Math.ceil(m.timer));
    const planted = m.phase === 'planted';
    this.set('tm', this.el.timer, planted ? '' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    this.el.spikeIcon.style.display = planted ? 'block' : 'none';
    if (planted) this.el.spikeIcon.style.opacity = m.timer < 10 ? (Math.sin(game.time * 20) > 0 ? 1 : 0.4) : 1;
    const label = { buy: 'SATIN ALMA', round: `RAUND ${m.round}`, planted: 'SPIKE KURULDU', post: `RAUND ${m.round}`, end: 'MAÇ BİTTİ' }[m.phase] || '';
    this.set('rl', this.el.roundLabel, label);
    this.set('sa', this.el.scoreAlly, String(m.score[me.team]));
    this.set('se', this.el.scoreEnemy, String(m.score[1 - me.team]));

    // Etkileşim ipuçları
    let prompt = '';
    const sp = new THREE.Vector3(...m.spike.pos);
    if (me.alive) {
      if (m.phase === 'buy' && m.mode.economy) prompt = 'B — MARKET';
      else if (planted && me.side === 'def' && me.pos.distanceTo(sp) < 2.4) prompt = 'F basılı tut — SPIKE\'I ÇÖZ';
      else if (m.phase === 'round' && m.canPlant(me) && m.plantZoneAt(me.pos)) prompt = game.gun?.current === 'spike' ? 'Sol tık basılı tut — SPIKE KUR' : '4 — SPIKE\'I ÇIKAR';
      else if (m.nearOrb(me.pos)) prompt = 'F basılı tut — ULTİ KÜRESİ';
    }
    this.set('pr', this.el.prompt, prompt);

    // İlerleme çubuğu
    const prog = me.alive ? me.actionProg : 0;
    if (prog > 0 && me.action) {
      const total = me.action === 'plant' ? TIMES.plant : me.action === 'defuse' ? TIMES.defuse : TIMES.orb;
      this.el.actionBar.style.display = 'block';
      this.el.actionFill.style.width = `${Math.min(100, prog / total * 100)}%`;
      this.el.actionLabel.textContent = { plant: 'SPIKE KURULUYOR', defuse: 'SPIKE ÇÖZÜLÜYOR', orb: 'KÜRE ALINIYOR' }[me.action];
      this.el.actionHalf.style.display = me.action === 'defuse' ? 'block' : 'none';
    } else {
      this.el.actionBar.style.display = 'none';
    }

    // Durum efektleri
    this.el.blind.style.opacity = Math.min(1, me.st.blind * 1.4);
    this.el.nearsight.style.opacity = Math.min(1, me.st.nearsight * 2);
    this.el.empress.style.opacity = me.st.empress > 0 ? 0.6 : 0;
    let status = '';
    if (me.st.detained > 0) status = 'KUŞATILDIN — ateş edemezsin';
    else if (me.st.stun > 0) status = 'SERSEMLEDİN';
    else if (me.st.tether > 0) status = 'TUZAĞA YAKALANDIN';
    else if (me.st.vulnerable > 0) status = 'SAVUNMASIZ — iki kat hasar alırsın';
    else if (me.st.revealed > 0) status = 'AÇIĞA ÇIKTIN';
    else if (me.st.intangible > 0) status = 'HASAR ALMAZSIN';
    this.set('st', this.el.statusText, status);

    const spec = game.spectating && game.spectating !== 'dead' ? game.spectating : null;
    this.set('spec', this.el.spectate, !me.alive ? (spec ? `İZLENİYOR: ${spec.name} (${AGENTS[spec.agent].name}) — sol tık: sonraki` : 'ELENDİN') : '');

    // Mini harita (saniyede 10 kez)
    this.mmT -= dt;
    if (this.mmT <= 0) {
      this.mmT = 0.1;
      if (Math.floor(game.time * 5) % 2 === 0) this.updateSeen(me);
      this.drawMinimap(me);
    }
    if (!this.el.scoreboard.classList.contains('hidden')) {
      this.sbT = (this.sbT || 0) - dt;
      if (this.sbT <= 0) { this.sbT = 0.5; this.renderScoreboard(); }
    }
  }
}
