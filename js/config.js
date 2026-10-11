// OYUN AYARLARI: modlar, ekonomi, süreler, bot zorlukları.

// Online lobi kimliğinin başı (PeerJS). Değiştirirsen eski sürümle eşleşmez.
export const LOBBY_PREFIX = 'nexusstrike-cnr5534-v2-';

export const MODES = {
  unrated: {
    key: 'unrated', name: 'DERECESİZ', tag: '5v5 · 13 RAUND', color: '#ff4655',
    desc: 'Klasik maç: ekonomi, satın alma ve Spike. 13 raund alan takım kazanır, 12. raunddan sonra taraf değişir.',
    teamSize: 5, winRounds: 13, halfAt: 12, economy: true, buyTime: 30, roundTime: 100, spikeTime: 45,
  },
  swiftplay: {
    key: 'swiftplay', name: 'TAM GAZ', tag: '5v5 · 5 RAUND', color: '#ffb547',
    desc: 'Derecesiz maçın kısa hali. 5 raund alan kazanır, 4. raunddan sonra taraf değişir.',
    teamSize: 5, winRounds: 5, halfAt: 4, economy: true, buyTime: 20, roundTime: 100, spikeTime: 45,
  },
  spikerush: {
    key: 'spikerush', name: 'GALEYAN', tag: '5v5 · 4 RAUND', color: '#3dffc5',
    desc: 'Her raund herkese aynı rastgele silah. Yetenekler dolu, saldıranların hepsinde Spike var, haritada ulti küreleri. 4 raund alan kazanır.',
    teamSize: 5, winRounds: 4, halfAt: 3, economy: false, randomWeapon: true, allSpikes: true,
    buyTime: 6, roundTime: 100, spikeTime: 45,
  },
  retake: {
    key: 'retake', name: 'AKIN', tag: '3v3 · 5 RAUND', color: '#8b7bff',
    desc: '3\'e 3. Spike raund başında kurulu! Saldıranlar Spike\'ı korur, savunanlar bölgeyi geri alıp Spike\'ı çözer. 5 raund alan kazanır.',
    teamSize: 3, winRounds: 5, halfAt: 4, economy: false, prePlanted: true,
    buyTime: 6, roundTime: 50, spikeTime: 50,
  },
};

export const ECON = {
  start: 800, win: 3000, loss: 1900, streakBonus: 500, lossMax: 2900, kill: 200, plant: 300, max: 9000,
};

export const TIMES = {
  plant: 4, defuse: 7, defuseHalf: 3.5, orb: 1, post: 5, spikeRadius: 22,
};

export const BOT_NAMES = [
  'Kobra', 'Hayalet', 'Raptor', 'Şahin', 'Kartal', 'Fırtına', 'Gölge', 'Yıldırım',
  'Kurt', 'Pars', 'Atmaca', 'Bora', 'Tufan', 'Volkan', 'Poyraz', 'Sis',
];

export const DIFFICULTY = {
  easy: { name: 'Kolay', hit: 0.22, head: 0.05, react: [0.6, 0.95], turn: 5 },
  normal: { name: 'Normal', hit: 0.34, head: 0.12, react: [0.4, 0.7], turn: 7 },
  hard: { name: 'Zor', hit: 0.5, head: 0.22, react: [0.25, 0.45], turn: 10 },
};

export const RANDOM_WEAPONS = ['vortex', 'phase', 'hornet', 'hammer', 'mastiff', 'marshal', 'longbow', 'dart'];

export const DEFAULT_SETTINGS = {
  name: 'Oyuncu',
  sens: 1.0,
  fov: 103,
  volume: 0.5,
  difficulty: 'normal',
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  crosshairColor: '#3dff8b',
};
