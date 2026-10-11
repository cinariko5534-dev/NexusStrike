// MOBİL DOKUNMATİK KONTROLLER
// Sol alt: hareket joystick'i · Sağ taraf: parmakla kaydırarak nişan · Butonlar: ateş, zıpla, eğil, şarjör,
// dürbün, F (Spike çöz / küre), silah değiştir. Yetenek simgelerine ve silah yuvalarına dokunarak da kullanılır.
import { game } from './game.js';

export const isMobile = () =>
  (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window || navigator.maxTouchPoints > 1;

export function setupTouch({ input, toggleBuy, openPause }) {
  document.body.classList.add('mobile');
  const $ = (id) => document.getElementById(id);
  const root = $('touch');
  root.classList.remove('hidden');

  // ---------- Sayfa kaymasını / yakınlaştırmayı tamamen engelle ----------
  // Menü panelleri ekrana sığmazsa sadece kendi içlerinde kayabilir; oyun ekranı asla kaymaz
  const allowScroll = (el) => game.state !== 'playing' && el && el.closest && el.closest('.panel, #agent-detail, #agent-grid, #buymenu');
  document.addEventListener('touchmove', (e) => { if (!allowScroll(e.target)) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // ---------- Joystick ----------
  const zone = $('joy-zone'), base = $('joy-base'), knob = $('joy-knob');
  const R = 55;
  let joyId = null, jx = 0, jy = 0;
  const setMove = (dx, dy) => {
    const k = input.keys;
    for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) k.delete(c);
    const m = Math.hypot(dx, dy) / R;
    if (m < 0.2) return;
    const a = Math.atan2(dy, dx), cx = Math.cos(a), cy = Math.sin(a);
    if (cy < -0.38) k.add('KeyW');
    if (cy > 0.38) k.add('KeyS');
    if (cx < -0.38) k.add('KeyA');
    if (cx > 0.38) k.add('KeyD');
    if (m < 0.6) k.add('ShiftLeft'); // az itersen sessiz yürür
  };
  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joyId !== null) return;
    const t = e.changedTouches[0];
    joyId = t.identifier;
    jx = t.clientX;
    jy = t.clientY;
    base.style.left = `${jx}px`;
    base.style.top = `${jy}px`;
    base.classList.add('on');
    knob.style.transform = 'translate(-50%, -50%)';
  }, { passive: false });
  const joyMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      let dx = t.clientX - jx, dy = t.clientY - jy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      setMove(dx, dy);
    }
  };
  const joyEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      joyId = null;
      setMove(0, 0);
      base.classList.remove('on');
      knob.style.transform = 'translate(-50%, -50%)';
    }
  };
  zone.addEventListener('touchmove', joyMove, { passive: false });
  zone.addEventListener('touchend', joyEnd);
  zone.addEventListener('touchcancel', joyEnd);

  // ---------- Nişan alma (sağ taraf) ----------
  const look = $('look-zone');
  const lookTouches = new Map();
  look.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) lookTouches.set(t.identifier, [t.clientX, t.clientY]);
  }, { passive: false });
  look.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const p = lookTouches.get(t.identifier);
      if (!p) continue;
      const dx = t.clientX - p[0], dy = t.clientY - p[1];
      lookTouches.set(t.identifier, [t.clientX, t.clientY]);
      game.controller.look(dx * 1.6, dy * 1.6);
    }
  }, { passive: false });
  const lookEnd = (e) => { for (const t of e.changedTouches) lookTouches.delete(t.identifier); };
  look.addEventListener('touchend', lookEnd);
  look.addEventListener('touchcancel', lookEnd);

  // ---------- Butonlar ----------
  // Ateş butonu basılıyken parmağı kaydırınca nişan da alınır (Valorant Mobile gibi)
  const bind = (id, down, up) => {
    const el = $(id);
    const pos = new Map();
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('on');
      for (const t of e.changedTouches) pos.set(t.identifier, [t.clientX, t.clientY]);
      down();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!el.dataset.aim) return;
      for (const t of e.changedTouches) {
        const p = pos.get(t.identifier);
        if (!p) continue;
        game.controller.look((t.clientX - p[0]) * 1.6, (t.clientY - p[1]) * 1.6);
        pos.set(t.identifier, [t.clientX, t.clientY]);
      }
    }, { passive: false });
    const end = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) pos.delete(t.identifier);
      if (pos.size) return;
      el.classList.remove('on');
      up?.();
    };
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
  };
  const fireDown = () => { input.mouseDown = true; input.pressed.add('Mouse0'); };
  const fireUp = () => { input.mouseDown = false; };
  bind('t-fire', fireDown, fireUp);
  bind('t-fire2', fireDown, fireUp);
  bind('t-jump', () => input.pressed.add('Space'));
  bind('t-crouch', () => {
    if (input.keys.has('ControlLeft')) input.keys.delete('ControlLeft'); else input.keys.add('ControlLeft');
    $('t-crouch').classList.toggle('active', input.keys.has('ControlLeft'));
  });
  bind('t-reload', () => input.pressed.add('KeyR'));
  bind('t-scope', () => input.pressed.add('Mouse2'));
  bind('t-use', () => input.keys.add('KeyF'), () => input.keys.delete('KeyF'));
  bind('t-swap', () => { input.wheel = 1; });
  bind('t-spike', () => input.pressed.add('Digit4'));
  bind('t-buy', () => toggleBuy());
  bind('t-menu', () => openPause());
  bind('t-score', () => {
    const sb = game.hud.el.scoreboard;
    sb.classList.toggle('hidden');
    if (!sb.classList.contains('hidden')) game.hud.renderScoreboard();
  });

  // Yetenek simgelerine dokun → kullan
  $('abilities').addEventListener('touchstart', (e) => {
    const ab = e.target.closest('.ab');
    if (!ab) return;
    e.preventDefault();
    e.stopPropagation();
    input.pressed.add(`Key${ab.id.slice(3)}`);
    ab.classList.add('tap');
    setTimeout(() => ab.classList.remove('tap'), 150);
  }, { passive: false });

  // Silah yuvalarına dokun → o silaha geç
  $('weapon-slots').addEventListener('touchstart', (e) => {
    const s = e.target.closest('.wslot');
    if (!s) return;
    e.preventDefault();
    e.stopPropagation();
    const n = s.querySelector('b')?.textContent;
    if (n) input.pressed.add(`Digit${n}`);
  }, { passive: false });
}

// Telefonda tam ekran + yatay ekran kilidi (Android Chrome destekler)
export function mobileFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) {
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      screen.orientation?.lock?.('landscape').catch(() => {});
    }).catch(() => {});
  }
}
