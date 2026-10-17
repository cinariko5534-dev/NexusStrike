// Tüm dokular (texture) kodla çiziliyor — dışarıdan resim dosyası gerekmez.
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function rgb(c, k = 1) {
  return `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
}

function addNoise(ctx, w, h, strength) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * strength;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx, S, count, color, rMin, rMax) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = color.replace('A', rand(0.03, 0.1).toFixed(3));
    ctx.beginPath();
    ctx.arc(rand(0, S), rand(0, S), rand(rMin, rMax), 0, Math.PI * 2);
    ctx.fill();
  }
}

function toTexture(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Yatayda sarmalayan dikdörtgen (doku kenarlardan kesintisiz tekrar etsin diye)
function wrapRect(ctx, x, y, w, h, S) {
  ctx.fillRect(x, y, w, h);
  if (x + w > S) ctx.fillRect(x - S, y, w, h);
  if (x < 0) ctx.fillRect(x + S, y, w, h);
}

function brickCanvas(base, mortar, bw, bh, kMin, kMax) {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = rgb(mortar);
  ctx.fillRect(0, 0, S, S);
  for (let r = 0; r * bh < S; r++) {
    const off = (r % 2) * bw / 2;
    for (let x = -bw; x < S; x += bw) {
      ctx.fillStyle = rgb(base, rand(kMin, kMax));
      wrapRect(ctx, x + off + 3, r * bh + 3, bw - 6, bh - 6, S);
    }
  }
  return [c, ctx, S];
}

export function stoneFloor(base = [176, 166, 146], gap = [92, 86, 74], stain = 'rgba(60,55,45,A)') {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = rgb(gap);
  ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 64) {
    const start = rand(0, 60);
    let x = start;
    while (x < start + S - 1) {
      const w = Math.min(rand(55, 125), start + S - x);
      ctx.fillStyle = rgb(base, rand(0.8, 1.08));
      wrapRect(ctx, x + 2, y + 2, w - 4, 60, S);
      x += w;
    }
  }
  blotches(ctx, S, 40, stain, 10, 50);
  addNoise(ctx, S, S, 26);
  return toTexture(c);
}

// Tuğla duvar (renkler haritanın temasına göre)
export function brickWall(base = [212, 190, 150], mortar = [150, 132, 102], stain = 'rgba(110,90,60,A)', stains = 30, bw = 128, bh = 64) {
  const [c, ctx, S] = brickCanvas(base, mortar, bw, bh, 0.84, 1.06);
  blotches(ctx, S, stains, stain, 15, 65);
  addNoise(ctx, S, S, 30);
  return toTexture(c);
}

export function sandWall() { return brickWall(); }
export function mossWall() { return brickWall([150, 152, 128], [96, 100, 80], 'rgba(60,110,40,A)', 60); }

export function concrete(base = [188, 182, 170]) {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = rgb(base);
  ctx.fillRect(0, 0, S, S);
  blotches(ctx, S, 30, 'rgba(90,85,75,A)', 8, 40);
  ctx.fillStyle = 'rgba(80,75,65,0.25)';
  ctx.fillRect(0, 0, S, 3);
  ctx.fillRect(0, 0, 3, S);
  addNoise(ctx, S, S, 20);
  return toTexture(c);
}

export function crate() {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = 'rgb(176,122,68)';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(90,55,25,0.6)';
  ctx.lineWidth = 2;
  for (let y = 32; y < S; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgb(122,80,40)';
  ctx.lineWidth = 22;
  ctx.strokeRect(11, 11, S - 22, S - 22);
  ctx.lineWidth = 18;
  ctx.beginPath(); ctx.moveTo(22, 22); ctx.lineTo(S - 22, S - 22); ctx.stroke();
  ctx.fillStyle = 'rgb(60,60,60)';
  for (const [x, y] of [[11, 11], [S - 11, 11], [11, S - 11], [S - 11, S - 11]]) {
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  }
  addNoise(ctx, S, S, 22);
  return toTexture(c);
}

export function metal() {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = 'rgb(98,106,114)';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(30,35,40,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, S - 4, S - 4);
  ctx.fillStyle = 'rgb(140,148,156)';
  for (let i = 12; i < S; i += 40) {
    for (const p of [[i, 10], [i, S - 10], [10, i], [S - 10, i]]) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  addNoise(ctx, S, S, 14);
  return toTexture(c);
}

export function container(c1 = [52, 108, 136], c2 = [64, 126, 156]) {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  for (let x = 0; x < S; x += 16) {
    ctx.fillStyle = (x / 16) % 2 ? rgb(c1) : rgb(c2);
    ctx.fillRect(x, 0, 16, S);
  }
  blotches(ctx, S, 25, 'rgba(120,70,30,A)', 4, 20);
  addNoise(ctx, S, S, 16);
  return toTexture(c);
}

// Duvar / yerdeki site harfi (A, B)
export function letter(text, color) {
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.font = '900 180px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 138);
  ctx.lineWidth = 10;
  ctx.strokeRect(16, 16, 224, 224);
  return toTexture(c, false);
}

// Mermi izi: koyu delik + etrafında kırık taş halkası + çatlaklar
export function bulletHole() {
  const S = 64;
  const [c, ctx] = makeCanvas(S);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(8,6,4,1)');
  g.addColorStop(0.2, 'rgba(22,18,14,1)');
  g.addColorStop(0.3, 'rgba(70,60,50,0.9)');
  g.addColorStop(0.5, 'rgba(125,110,90,0.45)');
  g.addColorStop(1, 'rgba(125,110,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(20,15,10,0.75)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    let a = Math.random() * Math.PI * 2;
    let x = 32, y = 32;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const len = rand(14, 26);
    for (let s = 0; s < len; s += 4) {
      a += rand(-0.5, 0.5);
      x += Math.cos(a) * 4;
      y += Math.sin(a) * 4;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return toTexture(c, false);
}

export function flash() {
  const S = 64;
  const [c, ctx] = makeCanvas(S);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.25, 'rgba(255,210,110,0.9)');
  g.addColorStop(0.6, 'rgba(255,120,30,0.35)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c, false);
}

export function sky(stops = ['#3f86d6', '#a7cdee', '#e9f1f4', '#c9bfa8', '#8f8676']) {
  const [c, ctx] = makeCanvas(4, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.42, stops[1]);
  g.addColorStop(0.5, stops[2]);
  g.addColorStop(0.55, stops[3]);
  g.addColorStop(1, stops[4]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = toTexture(c, false);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}
