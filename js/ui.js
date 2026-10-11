// MENÜLER: ana ekran, mod seçimi, maç arama, ajan seçimi, ayarlar, duraklatma, maç sonu.
import * as THREE from 'three';
import { game } from './game.js';
import { MODES, DIFFICULTY } from './config.js';
import { AGENTS, AGENT_KEYS, ROLES } from './agents.js';
import { buildAgentModel } from './character.js';
import { TYPE_ICON } from './hud.js';
import { testKey } from './gemini.js';
import * as sfx from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const SCREENS = ['screen-main', 'screen-play', 'screen-search', 'screen-agents', 'screen-settings', 'screen-help', 'screen-pause', 'screen-end', 'screen-msg'];

export class UI {
  constructor(cb) {
    this.cb = cb;
    this.mode = 'unrated';
    this.agent = game.settings.lastAgent && AGENTS[game.settings.lastAgent] ? game.settings.lastAgent : 'zephyr';
    this.agentTimer = 0;
    this.agentBrowse = false;
    this.settingsBack = 'screen-main';
    this.current = null;
    this.buildModes();
    this.buildAgentGrid();
    this.bind();
    this.setupPreview();
    this.show('screen-main');
  }

  show(id) {
    this.current = id;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    if (id === 'screen-settings') this.fillSettings();
  }

  hideAll() {
    this.current = null;
    for (const s of SCREENS) $(s).classList.add('hidden');
  }

  bind() {
    const on = (id, fn) => $(id).addEventListener('click', (e) => { sfx.unlock(); sfx.click(); fn(e); });
    on('btn-play', () => this.show('screen-play'));
    on('btn-agents', () => this.openAgents(true));
    on('btn-settings', () => { this.settingsBack = 'screen-main'; this.show('screen-settings'); });
    on('btn-help', () => this.show('screen-help'));
    on('help-back', () => this.show('screen-main'));
    on('play-back', () => this.show('screen-main'));
    on('btn-start', () => this.cb.startSearch(this.mode));
    on('search-cancel', () => this.cb.cancelSearch());
    on('settings-save', () => { this.saveSettings(); this.show(this.settingsBack); });
    on('settings-back', () => this.show(this.settingsBack));
    on('gemini-test', async () => {
      this.saveSettings();
      $('gemini-status').textContent = 'Deneniyor...';
      const ok = await testKey();
      $('gemini-status').textContent = ok ? '✅ Gemini bağlantısı çalışıyor!' : '❌ Bağlanamadı. Anahtarı ve model adını kontrol et.';
    });
    on('agent-lock', () => {
      if (this.agentBrowse) { this.show('screen-main'); return; }
      this.lockAgent();
    });
    on('pause-resume', () => this.cb.resume());
    on('pause-settings', () => { this.settingsBack = 'screen-pause'; this.show('screen-settings'); });
    on('pause-leave', () => this.cb.leave());
    on('end-menu', () => this.cb.leave());
    on('msg-ok', () => this.cb.leave());
  }

  // ---------- Modlar ----------
  buildModes() {
    $('mode-list').innerHTML = Object.values(MODES).map((m) => `
      <button class="mode-card" data-mode="${m.key}" style="--c:${m.color}">
        <div class="mode-name">${m.name}</div>
        <div class="mode-tag">${m.tag}</div>
        <div class="mode-desc">${m.desc}</div>
      </button>`).join('');
    $('mode-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      sfx.unlock();
      sfx.click();
      this.mode = b.dataset.mode;
      this.markMode();
    });
    this.markMode();
  }

  markMode() {
    for (const b of document.querySelectorAll('.mode-card')) b.classList.toggle('sel', b.dataset.mode === this.mode);
    $('btn-start').textContent = `${MODES[this.mode].name} — MAÇ BUL`;
  }

  setSearch(text) { $('search-status').textContent = text; }

  // ---------- Ajan seçimi ----------
  buildAgentGrid() {
    $('agent-grid').innerHTML = AGENT_KEYS.map((k) => {
      const a = AGENTS[k];
      const c = '#' + a.look.accent.toString(16).padStart(6, '0');
      return `<button class="agent-card" data-agent="${k}" style="--c:${c}">
        <span class="ac-icon">${a.icon}</span><span class="ac-name">${a.name}</span><span class="ac-role">${ROLES[a.role].name}</span></button>`;
    }).join('');
    $('agent-grid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-agent]');
      if (!b) return;
      sfx.click();
      this.selectAgent(b.dataset.agent);
    });
  }

  openAgents(browse, modeKey) {
    this.agentBrowse = browse;
    $('agent-lock').textContent = browse ? 'GERİ' : 'KİLİTLE';
    $('agent-title').textContent = browse ? 'AJANLAR' : 'AJANINI SEÇ';
    $('agent-mode').textContent = browse ? '12 ajan · 4 rol' : `${MODES[modeKey].name} · ${MODES[modeKey].tag}`;
    this.agentTimer = browse ? 0 : 30;
    this.selectAgent(this.agent);
    this.show('screen-agents');
  }

  selectAgent(k) {
    this.agent = k;
    const a = AGENTS[k];
    for (const b of document.querySelectorAll('.agent-card')) b.classList.toggle('sel', b.dataset.agent === k);
    const c = '#' + a.look.accent.toString(16).padStart(6, '0');
    $('agent-detail').style.setProperty('--c', c);
    $('agent-detail').innerHTML = `
      <div class="ad-role">${ROLES[a.role].name}</div>
      <h2>${a.icon} ${a.name}</h2>
      <p class="ad-bio">${a.bio}</p>
      <div class="ad-abilities">${a.abilities.map((ab) => `
        <div class="ad-ab ${ab.key === 'X' ? 'ult' : ''}">
          <div class="ad-key">${ab.key}</div><div class="ad-icon">${TYPE_ICON[ab.type] || '•'}</div>
          <div><b>${ab.name}</b>${ab.key === 'X' ? ` <small>${a.ult} ulti puanı</small>` : ab.charges ? ` <small>×${ab.charges}</small>` : ''}<br><span>${ab.desc}</span></div>
        </div>`).join('')}</div>`;
    this.setPreview(k);
  }

  lockAgent() {
    if (this.agentBrowse) return;
    game.settings.lastAgent = this.agent;
    game.saveSettings();
    sfx.unlock();
    this.agentTimer = 0;
    this.cb.lockAgent(this.agent);
  }

  // Seçilen ajanın dönen 3D önizlemesi
  setupPreview() {
    const cv = $('agent-preview');
    try {
      this.pr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    } catch {
      this.pr = null;
      return;
    }
    this.pr.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.pScene = new THREE.Scene();
    this.pScene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 2));
    const dl = new THREE.DirectionalLight(0xffffff, 2);
    dl.position.set(2, 3, 4);
    this.pScene.add(dl);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.12, 32), new THREE.MeshStandardMaterial({ color: 0x1f2a36 }));
    ped.position.y = -0.06;
    this.pScene.add(ped);
    this.pCam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.pCam.position.set(0, 1.3, 5.2);
    this.pCam.lookAt(0, 1.05, 0);
  }

  setPreview(k) {
    if (!this.pr) return;
    if (this.pModel) this.pScene.remove(this.pModel);
    this.pModel = buildAgentModel(k).group;
    this.pScene.add(this.pModel);
  }

  update(dt) {
    if (this.current === 'screen-agents') {
      if (this.pr && this.pModel) {
        const cv = this.pr.domElement;
        const w = cv.clientWidth, h = cv.clientHeight;
        if (w && h && (cv.width !== Math.floor(w * this.pr.getPixelRatio()) || cv.height !== Math.floor(h * this.pr.getPixelRatio()))) {
          this.pr.setSize(w, h, false);
          this.pCam.aspect = w / h;
          this.pCam.updateProjectionMatrix();
        }
        this.pModel.rotation.y += dt * 0.8;
        this.pr.render(this.pScene, this.pCam);
      }
      if (!this.agentBrowse && this.agentTimer > 0) {
        this.agentTimer -= dt;
        $('agent-timer').textContent = Math.max(0, Math.ceil(this.agentTimer));
        if (this.agentTimer <= 0) this.lockAgent();
      } else {
        $('agent-timer').textContent = '';
      }
    }
  }

  // ---------- Ayarlar ----------
  fillSettings() {
    const s = game.settings;
    $('set-name').value = s.name;
    $('set-sens').value = s.sens;
    $('set-sens-v').textContent = Number(s.sens).toFixed(2);
    $('set-fov').value = s.fov;
    $('set-fov-v').textContent = s.fov;
    $('set-vol').value = s.volume;
    $('set-diff').innerHTML = Object.entries(DIFFICULTY).map(([k, d]) => `<option value="${k}" ${k === s.difficulty ? 'selected' : ''}>${d.name}</option>`).join('');
    $('set-key').value = s.geminiKey;
    $('set-model').value = s.geminiModel;
    $('set-ch').value = s.crosshairColor;
    $('gemini-status').textContent = s.geminiKey ? 'Anahtar kayıtlı.' : 'Anahtar yok — botlar yerleşik yapay zekâyla oynar.';
    $('set-sens').oninput = () => { $('set-sens-v').textContent = Number($('set-sens').value).toFixed(2); };
    $('set-fov').oninput = () => { $('set-fov-v').textContent = $('set-fov').value; };
  }

  saveSettings() {
    const s = game.settings;
    s.name = ($('set-name').value || 'Oyuncu').slice(0, 16);
    s.sens = Number($('set-sens').value) || 1;
    s.fov = Number($('set-fov').value) || 103;
    s.volume = Number($('set-vol').value);
    s.difficulty = $('set-diff').value;
    s.geminiKey = $('set-key').value.trim();
    s.geminiModel = $('set-model').value.trim() || 'gemini-2.5-flash';
    s.crosshairColor = $('set-ch').value;
    game.saveSettings();
    this.cb.applySettings();
  }

  // ---------- Maç sonu / mesaj ----------
  showEnd(won, score, myTeam) {
    $('end-title').textContent = won ? 'ZAFER' : 'YENİLGİ';
    $('end-title').className = won ? 'win' : 'lose';
    $('end-score').textContent = `${score[myTeam]} — ${score[1 - myTeam]}`;
    const rows = game.chars.slice().sort((a, b) => b.kills - a.kills).map((c) => `
      <tr class="${c.team === myTeam ? 'ally' : 'enemy'} ${c === game.local ? 'me' : ''}">
        <td>${AGENTS[c.agent].icon} ${esc(c.name)}</td><td>${c.kills}</td><td>${c.deaths}</td></tr>`).join('');
    $('end-table').innerHTML = `<tr><th>OYUNCU</th><th>LEŞ</th><th>ÖLÜM</th></tr>${rows}`;
    this.show('screen-end');
  }

  message(title, text) {
    $('msg-title').textContent = title;
    $('msg-text').textContent = text;
    this.show('screen-msg');
  }
}
