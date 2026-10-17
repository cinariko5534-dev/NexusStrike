// ANA DOSYA: sahneyi kurar, menüleri ve maçı başlatır, girişleri dinler, oyun döngüsünü çalıştırır.
import * as THREE from 'three';
import { game } from './game.js';
import { buildMap, unloadMap } from './map.js';
import { MAPS, MAP_KEYS } from './maps.js';
import { Effects } from './decals.js';
import { HUD } from './hud.js';
import { UI } from './ui.js';
import { AbilitySystem, worldLOS } from './abilities.js';
import { GunController, WEAPONS } from './weapons.js';
import { PlayerController } from './player.js';
import { Match } from './match.js';
import { BotManager } from './bots.js';
import { Net } from './net.js';
import { AGENTS } from './agents.js';
import * as TX from './textures.js';
import * as sfx from './audio.js';
import { colliders, removeCollider } from './physics.js';
import { isMobile, setupTouch, mobileFullscreen } from './touch.js';

const MOBILE = isMobile();
game.mobile = MOBILE;

// ---------- Görüntü motoru ----------
const renderer = new THREE.WebGLRenderer({ antialias: !MOBILE });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = TX.sky();
scene.fog = new THREE.Fog(0xc9dbe6, 70, 180);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 400);
scene.add(camera);
const hemi = new THREE.HemisphereLight(0xdcebff, 0x8a7656, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
sun.position.set(35, 60, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun);

// Silah ayrı sahnede çizilir ki duvarların içine girmesin
const weaponScene = new THREE.Scene();
const weaponCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 10);
weaponScene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.8));
weaponScene.add(new THREE.AmbientLight(0xffffff, 0.8));
const wLight = new THREE.DirectionalLight(0xffffff, 1.6);
wLight.position.set(1, 2, 1);
weaponScene.add(wLight);

game.renderer = renderer;
game.scene = scene;
game.camera = camera;
game.worldLOS = worldLOS;
game.fx = new Effects(scene);
game.abilities = new AbilitySystem();
game.hud = new HUD();
game.controller = new PlayerController();
game.gun = new GunController(weaponScene, weaponCamera);
sfx.setVolume(game.settings.volume);

// ---------- Spike ve ulti küresi görselleri ----------
const spikeMesh = new THREE.Group();
{
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x2a2d34 }));
  base.position.y = 0.17;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20), new THREE.MeshStandardMaterial({ color: 0xff4655, emissive: 0xff2244, emissiveIntensity: 1 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.36;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0x9ff7ff, emissive: 0x6fe7ff, emissiveIntensity: 1 }));
  core.position.y = 0.48;
  // yerdeki Spike'ın üstünde uzaktan görünen ışık sütunu
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 10, 1, true), new THREE.MeshBasicMaterial({
    color: 0xff4655, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  beam.position.y = 3.2;
  spikeMesh.add(base, ring, core, beam);
  spikeMesh.userData.ring = ring;
  spikeMesh.userData.beam = beam;
  spikeMesh.visible = false;
  scene.add(spikeMesh);
}
let orbMeshes = [];
const orbGeo = new THREE.OctahedronGeometry(0.35);
const orbMat = new THREE.MeshStandardMaterial({ color: 0x9ff7ff, emissive: 0x3fd8ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 });

// ---------- Harita havuzu: her maçta rastgele harita ----------
let barriersOn = false;
function loadMap(key) {
  if (game.world && game.world.key === key) return;
  if (game.world) {
    for (const b of game.world.barriers) removeCollider(b.box);
    unloadMap(scene, game.world);
  }
  barriersOn = false;
  for (const o of orbMeshes) scene.remove(o);
  game.world = buildMap(scene, key, MAPS[key], { sun, hemi, renderer });
  game.blockers = game.world.meshes.slice();
  orbMeshes = game.world.orbs.map((p) => {
    const m = new THREE.Mesh(orbGeo, orbMat);
    m.position.copy(p).setY(1.1);
    m.visible = false;
    scene.add(m);
    return m;
  });
  game.hud.mapCanvas = null; // mini harita yeniden çizilsin
}
function randomMapKey() {
  const options = MAP_KEYS.filter((k) => !game.world || k !== game.world.key);
  return options[Math.floor(Math.random() * options.length)];
}
loadMap(MAP_KEYS[Math.floor(Math.random() * MAP_KEYS.length)]);

// Satın alma aşamasında doğuş bölgelerini kapatan mavi cam bariyerler
function updateBarriers(on) {
  if (on === barriersOn) return;
  barriersOn = on;
  for (const b of game.world.barriers) {
    b.mesh.visible = on;
    if (on) colliders.push(b.box); else removeCollider(b.box);
  }
}

function updateWorldProps() {
  const m = game.match;
  updateBarriers(!!m && m.phase === 'buy' && !m.mode.prePlanted && (game.state === 'playing'));
  if (barriersOn && game.world.barriers.length) {
    const k = 0.75 + Math.sin(game.time * 2) * 0.1;
    game.world.barriers[0].mesh.material.opacity = k;
  }
  const sp = m ? m.spike : null;
  spikeMesh.visible = !!sp && (sp.state === 'planted' || sp.state === 'dropped');
  if (spikeMesh.visible) {
    spikeMesh.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
    const blink = sp.state === 'planted' ? Math.sin(game.time * (m.timer < 10 ? 25 : 8)) > 0 : true;
    spikeMesh.userData.ring.material.emissiveIntensity = blink ? 1.5 : 0.1;
    spikeMesh.userData.beam.visible = sp.state === 'dropped';
  }
  orbMeshes.forEach((o, i) => {
    o.visible = !!m && !m.orbs[i].taken;
    o.rotation.y += 0.03;
    o.position.y = 1.1 + Math.sin(game.time * 2 + i) * 0.12;
  });
}

// ---------- Görüş açısı (FOV) ----------
let baseVFov = 70;
function applySettings() {
  const aspect = innerWidth / innerHeight;
  const h = THREE.MathUtils.degToRad(game.settings.fov || 103);
  baseVFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / aspect));
  sfx.setVolume(game.settings.volume);
  document.documentElement.style.setProperty('--ch', game.settings.crosshairColor || '#3dff8b');
}
applySettings();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const c of [camera, weaponCamera]) {
    c.aspect = innerWidth / innerHeight;
    c.updateProjectionMatrix();
  }
  applySettings();
});

// ---------- Girişler ----------
const input = { keys: new Set(), pressed: new Set(), mouseDown: false, wheel: 0, typing: false };
const canvas = renderer.domElement;
const clickEl = document.getElementById('click-to-play');
let locked = false;
let buyOpen = false;
let paused = false;

function lockPointer() {
  if (MOBILE) return; // telefonda fare kilidi yok, dokunmatik kontroller kullanılır
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch { /* desteklenmiyor */ }
}

// Tam ekran + klavye kilidi: Ctrl+W gibi tarayıcı kısayolları oyunu kapatmasın
function enterFullscreen() {
  if (MOBILE) { mobileFullscreen(); return; }
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen().then(() => {
    navigator.keyboard?.lock?.(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyT', 'KeyN',
      'KeyB', 'KeyC', 'KeyX', 'KeyM', 'Tab', 'Digit1', 'Digit2', 'Digit3', 'Digit4']).catch(() => {});
  }).catch(() => {});
}

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) {
    if (ui.current === 'screen-pause') ui.hideAll();
    paused = false;
    return;
  }
  input.keys.clear();
  input.mouseDown = false;
  if (input.typing) closeChat();
  if (game.state === 'playing' && !buyOpen) {
    ui.show('screen-pause');
    paused = game.isHost && (!game.net || game.net.clientCount === 0);
  }
});

addEventListener('keydown', (e) => {
  if (game.state !== 'playing') return;
  if (input.typing) {
    if (e.code === 'Enter') { e.preventDefault(); sendChat(); }
    else if (e.code === 'Escape') closeChat();
    return;
  }
  if (e.code === 'KeyB' && !e.repeat) { toggleBuy(); return; }
  if (buyOpen && e.code === 'Escape') { closeBuy(); return; }
  if (e.code === 'Tab') {
    e.preventDefault();
    game.hud.el.scoreboard.classList.remove('hidden');
    game.hud.renderScoreboard();
  }
  if (e.code === 'KeyM' && !e.repeat) game.hud.el.minimap.classList.toggle('big');
  if (!locked) return;
  if (e.code === 'Enter') { e.preventDefault(); openChat(); return; }
  if (!e.repeat && !input.keys.has(e.code)) input.pressed.add(e.code);
  input.keys.add(e.code);
  if (e.code === 'Space' || e.ctrlKey || e.code.startsWith('Digit')) e.preventDefault();
});
addEventListener('keyup', (e) => {
  input.keys.delete(e.code);
  if (e.code === 'Tab') game.hud.el.scoreboard.classList.add('hidden');
});
addEventListener('mousedown', (e) => {
  if (game.state !== 'playing') return;
  if (!locked) {
    if (e.target === canvas || e.target === clickEl) { enterFullscreen(); lockPointer(); }
    return;
  }
  if (e.button === 0) { input.mouseDown = true; input.pressed.add('Mouse0'); }
  if (e.button === 2) input.pressed.add('Mouse2');
});
addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseDown = false; });
addEventListener('mousemove', (e) => { if (locked) game.controller.look(e.movementX, e.movementY); });
addEventListener('wheel', (e) => { if (locked) input.wheel = Math.sign(e.deltaY); }, { passive: true });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('beforeunload', (e) => {
  if (game.state === 'playing') { e.preventDefault(); e.returnValue = ''; }
});

// ---------- Market ve sohbet ----------
function toggleBuy() {
  if (buyOpen) { closeBuy(); return; }
  if (!game.match?.mode.economy) { game.hud.toast('Bu modda market yok — silahlar otomatik verilir'); return; }
  buyOpen = true;
  game.hud.renderBuyMenu();
  game.hud.el.buymenu.classList.remove('hidden');
  document.exitPointerLock?.();
}
function closeBuy() {
  if (!buyOpen) return;
  buyOpen = false;
  game.hud.el.buymenu.classList.add('hidden');
  if (game.state === 'playing') lockPointer();
}
game.closeBuy = closeBuy;

const chatInput = document.getElementById('chat-input');
function openChat() {
  input.typing = true;
  input.keys.clear();
  input.mouseDown = false;
  chatInput.classList.remove('hidden');
  chatInput.value = '';
  setTimeout(() => chatInput.focus(), 0);
}
function closeChat() {
  input.typing = false;
  chatInput.blur();
  chatInput.classList.add('hidden');
}
function sendChat() {
  const text = chatInput.value.trim().slice(0, 120);
  closeChat();
  if (!text || !game.local) return;
  if (game.isHost) game.match.emit({ t: 'chat', n: game.local.name, m: text, tm: game.local.team });
  else net.send({ t: 'chat', m: text });
}

// ---------- Maç akışı ----------
const net = new Net();
let pendingJoins = [];
let snapT = 0;
let stateT = 0;
let joinTimer = null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function startSearch(modeKey) {
  game.state = 'search';
  ui.show('screen-search');
  ui.setSearch('Bağlanılıyor...');
  const role = await net.findMatch(modeKey, (t) => ui.setSearch(t));
  if (role === 'cancel' || game.state !== 'search') return;
  game.pendingMode = modeKey;
  game.pendingRole = role;
  if (role === 'client') ui.setSearch('Maç bulundu! Ajanını seç.');
  else if (role === 'host') ui.setSearch('Online kimse yok — botlarla maç başlıyor. Sonradan gelen oyuncular botların yerine geçecek.');
  else ui.setSearch('Online bağlantı kurulamadı — botlarla çevrimdışı maç başlıyor.');
  await wait(1200);
  if (game.state !== 'search') return;
  game.state = 'agents';
  ui.openAgents(false, modeKey);
}

function cancelSearch() {
  net.close();
  game.state = 'menu';
  ui.show('screen-play');
}

function lockAgent(agent) {
  game.pendingAgent = agent;
  enterFullscreen();
  if (game.pendingRole === 'client') {
    game.state = 'search';
    ui.show('screen-search');
    ui.setSearch('Maça bağlanılıyor...');
    net.send({ t: 'join', name: game.settings.name, agent });
    clearTimeout(joinTimer);
    joinTimer = setTimeout(() => {
      if (game.state === 'search') {
        net.close();
        game.pendingRole = 'offline';
        startHostMatch(game.pendingMode, agent);
      }
    }, 10000);
  } else {
    startHostMatch(game.pendingMode, agent);
  }
}

function resetWorld() {
  for (const c of game.chars) c.removeModel();
  game.chars = [];
  game.local = null;
  game.spectating = null;
  game.abilities.clearAll();
  game.fx.clearHoles();
  closeBuy();
}

function enterPlaying() {
  game.state = 'playing';
  ui.hideAll();
  game.hud.show(true);
  lockPointer();
}

function startHostMatch(modeKey, agent) {
  resetWorld();
  game.isHost = true;
  game.net = net.role === 'host' ? net : null;
  loadMap(game.forceMap || randomMapKey());
  game.forceMap = null;
  game.match = new Match(modeKey);
  game.bots = new BotManager();
  game.match.populate(game.settings.name, agent);
  game.onLocalAgent();
  game.match.begin();
  enterPlaying();
  for (const j of pendingJoins) assignJoin(j.peer, j.msg);
  pendingJoins = [];
}

function startClientMatch(msg) {
  clearTimeout(joinTimer);
  resetWorld();
  game.isHost = false;
  game.net = net;
  game.localId = msg.id;
  lastHostMsg = performance.now();
  if (MAPS[msg.map]) loadMap(msg.map);
  game.match = new Match(msg.mode);
  game.bots = null;
  enterPlaying();
}

function leave() {
  lastHostMsg = 0;
  net.close();
  game.net = null;
  resetWorld();
  game.match = null;
  game.bots = null;
  game.state = 'menu';
  paused = false;
  game.hud.show(false);
  if (document.pointerLockElement) document.exitPointerLock();
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  ui.show('screen-main');
}

game.onLocalAgent = () => {
  const c = game.local;
  if (!c) return;
  game.gun.setSleeve(AGENTS[c.agent].look.main);
  game.gun.resetForRound();
};
game.onLocalLoadout = () => game.gun.onLoadoutChanged(game.gun.knownLo || {});
game.onMatchEnd = (winner, score) => {
  game.state = 'end';
  const me = game.local;
  const won = me && winner === me.team;
  if (won) sfx.win(); else sfx.lose();
  game.hud.show(false);
  if (document.pointerLockElement) document.exitPointerLock();
  ui.showEnd(won, score, me ? me.team : 0);
};

// ---------- Online mesajlar ----------
function assignJoin(peer, msg) {
  const humans = (t) => game.chars.filter((c) => c.team === t && c.kind !== 'bot').length;
  const order = humans(0) <= humans(1) ? [0, 1] : [1, 0];
  let slot = null;
  for (const t of order) {
    slot = game.chars.find((c) => c.team === t && c.kind === 'bot');
    if (slot) break;
  }
  if (!slot) { net.sendTo(peer, { t: 'full' }); return; }
  slot.kind = 'remote';
  slot.peer = peer;
  slot.name = String(msg.name || 'Oyuncu').slice(0, 16);
  if (AGENTS[msg.agent] && msg.agent !== slot.agent) {
    slot.agent = msg.agent;
    slot.resetCharges(true);
    slot.ult = Math.min(slot.ult, AGENTS[msg.agent].ult);
  }
  slot.createModel();
  slot.action = null;
  slot.ultWeapon = null;
  game.bots?.brains.delete(slot.id);
  net.sendTo(peer, { t: 'welcome', id: slot.id, mode: game.match.modeKey, map: game.world.key });
  net.sendTo(peer, game.match.snapshot());
  game.match.emit({ t: 'chat', n: 'SİSTEM', m: `${slot.name} maça katıldı!`, tm: slot.team });
}

net.handlers.onClientMessage = (peer, msg) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'join') {
    if (game.state !== 'playing' || !game.match) pendingJoins.push({ peer, msg });
    else assignJoin(peer, msg);
    return;
  }
  const m = game.match;
  const c = game.chars.find((x) => x.peer === peer);
  if (!c || !m) return;
  c.lastMsg = performance.now();
  switch (msg.t) {
    case 'state':
      if (msg.pv === c.pv && c.alive && Array.isArray(msg.p)) {
        const dtS = Math.max(0.03, game.time - (c.lastStateT ?? game.time - 0.05));
        c.vel.set((msg.p[0] - c.pos.x) / dtS, 0, (msg.p[2] - c.pos.z) / dtS);
        c.pos.set(msg.p[0], msg.p[1], msg.p[2]);
        c.lastStateT = game.time;
      }
      c.yaw = msg.y;
      c.pitch = msg.pi;
      c.crouching = !!msg.cr;
      c.walking = !!msg.wk;
      c.weapon = msg.w;
      c.onGround = !!msg.g;
      break;
    case 'hit': {
      const v = game.charById(msg.v);
      if (v && c.alive && v.team !== c.team) m.applyDamage(v, Math.min(Number(msg.dmg) || 0, 260), c, msg.part, WEAPONS[msg.w]?.name || 'Silah');
      break;
    }
    case 'fxhit':
      game.abilities.byId(msg.id)?.takeDamage?.(Math.min(Number(msg.dmg) || 0, 260), msg.seg);
      break;
    case 'shot':
      m.drawShot(msg);
      net.broadcast(msg, peer);
      break;
    case 'cast':
      if (msg.ev && msg.ev.owner === c.id) m.handleCast(c, msg.ev);
      break;
    case 'act':
      c.action = ['plant', 'defuse', 'orb'].includes(msg.a) ? msg.a : null;
      break;
    case 'buy':
      m.buy(c, msg.item);
      break;
    case 'chat':
      m.emit({ t: 'chat', n: c.name, m: String(msg.m || '').slice(0, 120), tm: c.team });
      break;
    default:
  }
};

net.handlers.onClientLeft = (peer) => {
  pendingJoins = pendingJoins.filter((j) => j.peer !== peer);
  const c = game.chars.find((x) => x.peer === peer);
  if (!c || !game.match) return;
  c.kind = 'bot';
  c.peer = null;
  game.match.emit({ t: 'chat', n: 'SİSTEM', m: `${c.name} ayrıldı, yerine bot geçti.`, tm: c.team });
};

let lastHostMsg = 0;
net.handlers.onHostMessage = (msg) => {
  if (!msg || typeof msg !== 'object') return;
  lastHostMsg = performance.now();
  switch (msg.t) {
    case 'welcome': startClientMatch(msg); break;
    case 'full':
      net.close();
      ui.message('MAÇ DOLU', 'Bu maçta boş yer kalmadı. Biraz sonra tekrar dene.');
      break;
    case 'snap': game.match?.applySnapshot(msg); break;
    case 'cast': game.abilities.spawn(msg.ev); break;
    case 'fx': game.abilities.applyState(msg.id, msg.s); break;
    case 'shot': if (msg.c !== game.localId) game.match?.drawShot(msg); break;
    default: game.match?.onEvent(msg);
  }
};

// Maçın sahibi ayrılırsa hata verme: maç bu bilgisayarda botlarla devam eder
net.handlers.onHostLost = () => {
  if (game.isHost) return;
  lastHostMsg = 0;
  net.close();
  game.net = null;
  game.pendingRole = 'offline';
  if (game.state === 'agents') return; // ajan seçince botlu maç başlar
  if (game.state === 'search') {
    // ajan seçildi, maça bağlanırken sahip çıktı → hemen botlu maç başlat
    clearTimeout(joinTimer);
    startHostMatch(game.pendingMode, game.pendingAgent || 'zephyr');
    return;
  }
  if (game.state !== 'playing' || !game.match) return;
  takeOverAsHost();
};

// İstemciden sunucuya geçiş: diğer herkes bot olur, skor ve raund aynen kalır
function takeOverAsHost() {
  const m = game.match;
  game.isHost = true;
  game.bots = new BotManager();
  for (const c of game.chars) {
    if (c === game.local) continue;
    c.kind = 'bot';
    c.peer = null;
    c.vel.set(0, 0, 0);
    if (c.model) c.pos.copy(c.model.group.position);
  }
  m.nextEvId = 100000; // eski yetenek kimlikleriyle çakışmasın
  const winner = m.score.findIndex((s) => s >= m.mode.winRounds);
  m.endAfterPost = winner >= 0 ? winner : null;
  game.bots.onRoundStart();
  game.hud.toast('Maç sahibi ayrıldı — maça botlarla devam ediyorsun');
  m.emit({ t: 'chat', n: 'SİSTEM', m: 'Maç sahibi ayrıldı. Diğer oyuncuların yerine botlar geçti.', tm: game.local?.team ?? 0 });
}

// Bağlantı kontrolü: uzun süre mesaj gelmezse oyuncu (ya da maç sahibi) ayrılmış sayılır
setInterval(() => {
  const now = performance.now();
  if (game.state !== 'playing' || !game.match) return;
  if (game.isHost && game.net) {
    for (const c of game.chars) {
      if (c.kind === 'remote' && c.peer && now - (c.lastMsg || now) > 10000) {
        const peer = c.peer;
        try { net.conns.get(peer)?.close(); } catch { /* yok say */ }
        net.conns.delete(peer);
        net.handlers.onClientLeft(peer);
      } else if (c.kind === 'remote' && !c.lastMsg) {
        c.lastMsg = now;
      }
    }
  } else if (!game.isHost && lastHostMsg && now - lastHostMsg > 15000) {
    net.handlers.onHostLost();
  }
}, 1000);

function netTick(dt) {
  if (game.isHost) {
    if (game.net && game.net.clientCount > 0) {
      snapT -= dt;
      if (snapT <= 0) { snapT = 0.05; game.net.broadcast(game.match.snapshot()); }
    }
  } else if (game.local) {
    stateT -= dt;
    if (stateT <= 0) {
      stateT = 0.05;
      const c = game.local;
      net.send({
        t: 'state', p: [c.pos.x, c.pos.y, c.pos.z].map((v) => Math.round(v * 100) / 100), y: c.yaw, pi: c.pitch,
        cr: c.crouching ? 1 : 0, wk: c.walking ? 1 : 0, w: c.weapon, pv: c.pv, g: c.onGround ? 1 : 0,
      });
    }
  }
}

// Diğer karakterlerin ayak sesleri (Valorant'taki gibi koşanları duyarsın)
function footsteps(dt) {
  const me = game.local;
  if (!me) return;
  for (const c of game.chars) {
    if (c === me || !c.alive || !c.model) continue;
    const sp = c.kind === 'bot' && game.isHost ? c.speed : c.modelVel;
    if (sp < 3.2 || c.walking || c.crouching) continue;
    c.stepT -= dt;
    if (c.stepT <= 0) {
      c.stepT = 0.38;
      const d = c.pos.distanceTo(me.pos);
      if (d < 40) sfx.step(d);
    }
  }
}

// ---------- Menüler ----------
const ui = new UI({ startSearch, cancelSearch, lockAgent, leave, applySettings, resume: () => { enterFullscreen(); lockPointer(); ui.hideAll(); paused = false; } });

// ---------- Mobil ----------
const touchEl = document.getElementById('touch');
const spikeBtn = document.getElementById('t-spike');
if (MOBILE) {
  setupTouch({
    input,
    toggleBuy,
    openPause: () => {
      input.keys.clear();
      input.mouseDown = false;
      ui.show('screen-pause');
      paused = game.isHost && (!game.net || game.net.clientCount === 0);
    },
  });
  document.getElementById('rotate-hint').classList.remove('hidden');
}
function updateTouchUi() {
  if (!MOBILE) return;
  const show = game.state === 'playing' && !ui.current && !buyOpen;
  touchEl.classList.toggle('hidden', !show);
  const me = game.local, m = game.match;
  const spike = !!me && !!m && me.alive && (me.hasSpike || (m.mode.allSpikes && me.side === 'atk' && m.spike.state === 'carried'));
  spikeBtn.style.display = spike ? 'block' : 'none';
}

// ---------- Oyun döngüsü ----------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  tick(Math.min(clock.getDelta(), 0.05));
}

function tick(dt, draw = true) {
  game.time += dt;
  ui.update(dt);
  updateTouchUi();
  const inMatch = (game.state === 'playing' || game.state === 'end') && game.match;
  if (inMatch) {
    const m = game.match;
    if (game.state === 'playing' && !paused) {
      game.controller.update(dt, input);
      game.gun.update(dt, input);
      if (game.isHost) game.bots?.update(dt);
      m.update(dt);
      game.abilities.update(dt);
      footsteps(dt);
      netTick(dt);
    }
    for (const c of game.chars) c.updateModel(dt);
    updateWorldProps();
    game.fx.update(dt);
    if (!draw) { input.pressed.clear(); input.wheel = 0; return; }
    game.hud.update(dt);
    clickEl.classList.toggle('hidden', !(game.state === 'playing' && !locked && !ui.current && !buyOpen && !input.typing));
    const fov = baseVFov / (game.gun.zoomFactor || 1);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    renderer.clear();
    renderer.render(scene, camera);
    if (game.local?.alive && !game.spectating) {
      renderer.clearDepth();
      renderer.render(weaponScene, weaponCamera);
    }
  } else {
    // Menü arka planı: haritanın etrafında dönen kamera
    clickEl.classList.add('hidden');
    updateWorldProps();
    const a = game.time * 0.05;
    camera.position.set(Math.sin(a) * 55, 32, Math.cos(a) * 55);
    camera.lookAt(0, 0, -4);
    if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
    game.fx.update(dt);
    renderer.clear();
    renderer.render(scene, camera);
  }
  input.pressed.clear();
  input.wheel = 0;
}
frame();

// Test / hata ayıklama için konsoldan erişim
window.game = game;
window.nexus = {
  input,
  tick,
  step(frames = 1, dt = 1 / 60) { for (let i = 0; i < frames; i++) tick(dt); },
  sim(frames = 1, dt = 1 / 60) { for (let i = 0; i < frames; i++) tick(dt, i === frames - 1); },
  loadMap,
  search: (mode) => startSearch(mode),
  lock: (agent) => lockAgent(agent),
  net,
  quickStart(mode = 'swiftplay', agent = 'zephyr') { game.pendingRole = 'offline'; game.pendingMode = mode; startHostMatch(mode, agent); },
  leave,
};
