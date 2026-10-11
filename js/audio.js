// Ses efektleri — ses dosyası yerine Web Audio ile anlık üretiliyor.
let ctx = null;
let master = null;
let noiseBuf = null;
let volume = 0.5;

// Tarayıcılar sesi ancak kullanıcı tıkladıktan sonra açar.
export function unlock() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}

function noise(dur, freq, type, vol, when = 0) {
  if (!ctx || vol < 0.003) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 1.5, dur);
}

function tone(freq, dur, type, vol, when = 0, endFreq = freq) {
  if (!ctx || vol < 0.003) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur);
}

const att = (dist) => 1 / (1 + dist * 0.07);

export function shot(kind = 'rifle', dist = 0) {
  const a = att(dist);
  const lp = 2800 * a + 300;
  switch (kind) {
    case 'pistol':
      noise(0.12, lp + 500, 'lowpass', 0.8 * a);
      tone(170, 0.08, 'triangle', 0.5 * a, 0, 60);
      break;
    case 'smg':
      noise(0.1, lp + 300, 'lowpass', 0.7 * a);
      tone(150, 0.07, 'triangle', 0.4 * a, 0, 60);
      break;
    case 'shotgun':
      noise(0.3, lp * 0.8, 'lowpass', 1.1 * a);
      tone(90, 0.2, 'triangle', 0.8 * a, 0, 35);
      break;
    case 'sniper':
      noise(0.45, lp, 'lowpass', 1.2 * a);
      tone(70, 0.35, 'sawtooth', 0.6 * a, 0, 30);
      break;
    case 'silenced':
      noise(0.08, 1800 * a + 200, 'lowpass', 0.45 * a);
      break;
    case 'knife':
      noise(0.12, 3500, 'bandpass', 0.35 * a);
      break;
    case 'rocket':
      noise(0.5, 900, 'lowpass', 1.0 * a);
      tone(200, 0.4, 'sawtooth', 0.4 * a, 0, 60);
      break;
    default:
      noise(0.2, lp, 'lowpass', 1.0 * a);
      tone(120, 0.12, 'triangle', 0.7 * a, 0, 40);
  }
}

export function hit(head) {
  tone(head ? 1500 : 950, 0.06, 'square', 0.1);
  if (head) tone(2200, 0.1, 'sine', 0.15, 0.03);
}

export function kill() {
  tone(700, 0.1, 'triangle', 0.25);
  tone(1050, 0.18, 'triangle', 0.25, 0.08);
}

export function reload(duration) {
  noise(0.05, 3000, 'highpass', 0.5, 0.1);
  noise(0.05, 2500, 'highpass', 0.5, duration * 0.5);
  noise(0.06, 3500, 'highpass', 0.6, duration * 0.9);
}

export function dry() { noise(0.03, 5000, 'highpass', 0.4); }
export function equip() { noise(0.06, 2000, 'bandpass', 0.5); }
export function hurt() { tone(200, 0.18, 'sawtooth', 0.15, 0, 90); }

export function step(dist = 0, own = false) {
  const a = own ? 0.12 : att(dist) * 0.5;
  noise(0.07, 600 + Math.random() * 300, 'lowpass', a);
}

export function land(dist = 0) { noise(0.12, 500, 'lowpass', att(dist) * 0.5); }

export function explosion(dist = 0) {
  const a = att(dist * 0.5);
  noise(0.9, 700 * a + 150, 'lowpass', 1.3 * a);
  tone(60, 0.6, 'sine', 0.9 * a, 0, 25);
}

export function ability(dist = 0) {
  const a = att(dist);
  noise(0.25, 1400, 'bandpass', 0.5 * a);
  tone(500, 0.2, 'sine', 0.15 * a, 0, 900);
}

export function flashPop(dist = 0) {
  const a = att(dist);
  tone(2400, 0.4, 'sine', 0.35 * a, 0, 600);
  noise(0.2, 6000, 'highpass', 0.4 * a);
}

export function smoke(dist = 0) { noise(0.8, 900, 'lowpass', 0.5 * att(dist)); }

export function beep(fast) { tone(fast ? 1800 : 1400, 0.08, 'square', 0.18); }

export function plantDone() {
  tone(600, 0.15, 'square', 0.2);
  tone(900, 0.3, 'square', 0.2, 0.15);
}

export function defuseTick() { tone(1200, 0.04, 'square', 0.08); }

export function orb() {
  tone(880, 0.15, 'sine', 0.25);
  tone(1320, 0.3, 'sine', 0.25, 0.12);
}

export function ultReady() {
  tone(523, 0.15, 'triangle', 0.25);
  tone(784, 0.15, 'triangle', 0.25, 0.12);
  tone(1047, 0.3, 'triangle', 0.25, 0.24);
}

export function roundStart() {
  tone(440, 0.2, 'sawtooth', 0.12);
  tone(660, 0.35, 'sawtooth', 0.12, 0.2);
}

export function win() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.25, i * 0.12));
}

export function lose() {
  [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'triangle', 0.25, i * 0.15));
}

export function chat() { tone(1100, 0.06, 'sine', 0.15); }
export function click() { tone(800, 0.03, 'square', 0.06); }
