// Ortak oyun durumu: tüm modüller bu nesneyi kullanır.
import { DEFAULT_SETTINGS } from './config.js';

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('nexus-settings') || '{}');
    return { ...DEFAULT_SETTINGS, ...s };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const game = {
  renderer: null,
  scene: null,
  camera: null,
  world: null,
  chars: [],
  local: null,
  isHost: true,
  net: null,
  match: null,
  abilities: null,
  fx: null,
  hud: null,
  gun: null,
  controller: null,
  bots: null,
  time: 0,
  state: 'menu', // menu | search | agents | playing | end
  settings: loadSettings(),
  blockers: [], // mermiyi ve görüşü engelleyen yüzeyler (harita + duvar yetenekleri)
  nextId: 1,

  saveSettings() {
    try { localStorage.setItem('nexus-settings', JSON.stringify(this.settings)); } catch { /* gizli mod */ }
  },

  charById(id) {
    return this.chars.find((c) => c.id === id) || null;
  },

  // Bu karakteri bu bilgisayar mı yönetiyor? (kendi oyuncumuz ya da sunucudaysak botlar)
  controlsHere(c) {
    return c.kind === 'local' || (c.kind === 'bot' && this.isHost);
  },

  enemiesOf(team) {
    return this.chars.filter((c) => c.team !== team && c.alive);
  },

  alliesOf(team) {
    return this.chars.filter((c) => c.team === team && c.alive);
  },
};
