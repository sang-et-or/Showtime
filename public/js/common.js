// Outils partagés : DOM, bruitages synthétisés, voix de l'animateur, confettis, écran allumé.
/* global window, document */

const $ = (sel, root = document) => root.querySelector(sel);

/** Crée un élément. Les textes passent TOUJOURS par textContent (jamais d'HTML injecté depuis les joueurs). */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function avatarEl(p, size = '') {
  const el = h('div', { class: `avatar ${size}`, text: p.avatar, title: p.name });
  el.style.setProperty('--c', p.color || '#ff3d8b');
  return el;
}

const SHAPES = ['▲', '◆', '●', '■'];
const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🐸', '🐵', '🦄', '🐙', '🦖', '🐧', '🐨', '🐷', '👽', '🤖', '👻', '🤠', '😎', '🤩', '🧙', '🦸', '🧛', '🍕', '🎸', '🚀'];

function toast(text, ms = 2500) {
  const t = h('div', { class: 'toast', role: 'status', text });
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

// ---------------------------------------------------------------------------
// Bruitages : tous synthétisés en direct avec la Web Audio API.
// Aucun fichier audio, donc aucun problème de droits d'auteur.
// ---------------------------------------------------------------------------
const SFX = (() => {
  let ctx = null; let master = null; let muted = false;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, { type = 'sine', vol = 0.25, delay = 0, slide = null, attack = 0.01 } = {}) {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  let noiseBuf = null;
  function noise(dur, { vol = 0.2, delay = 0, freq = 1200, q = 0.8, kind = 'bandpass', sweep = null } = {}) {
    const c = ac(); if (!c || muted) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = kind; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t); s.stop(t + dur + 0.05);
  }

  const chord = (notes, dur, opts) => notes.forEach((n) => tone(n, dur, opts));

  return {
    unlock: () => ac(),
    get muted() { return muted; },
    set muted(v) { muted = v; },
    tick: () => tone(1200, 0.06, { type: 'square', vol: 0.08 }),
    tock: () => tone(800, 0.08, { type: 'square', vol: 0.12 }),
    pop: () => { tone(500, 0.12, { type: 'triangle', vol: 0.3, slide: 1100 }); tone(1400, 0.08, { vol: 0.1, delay: 0.06 }); },
    blip: () => tone(880, 0.09, { type: 'triangle', vol: 0.18, slide: 1320 }),
    tap: () => tone(660, 0.05, { type: 'triangle', vol: 0.15 }),
    whoosh: () => noise(0.7, { vol: 0.35, freq: 300, sweep: 5000, q: 1.2 }),
    correct: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.25, delay: i * 0.09 })),
    wrong: () => { tone(300, 0.35, { type: 'sawtooth', vol: 0.15, slide: 120 }); tone(290, 0.4, { type: 'square', vol: 0.06, slide: 110 }); },
    reveal: () => { noise(1.2, { vol: 0.25, freq: 7000, kind: 'highpass' }); chord([392, 494, 587], 0.5, { type: 'sawtooth', vol: 0.07 }); },
    fanfare: () => {
      const seq = [[392, 0], [523, 0.15], [659, 0.3], [784, 0.45], [659, 0.7], [784, 0.85]];
      seq.forEach(([f, d]) => { tone(f, 0.22, { type: 'sawtooth', vol: 0.1, delay: d }); tone(f / 2, 0.22, { type: 'square', vol: 0.05, delay: d }); });
      chord([523, 659, 784, 1047], 1.1, { type: 'sawtooth', vol: 0.07, delay: 1.05, attack: 0.05 });
      noise(1.4, { vol: 0.18, freq: 8000, kind: 'highpass', delay: 1.05 });
    },
    drumroll: (sec = 2.5) => {
      for (let t = 0; t < sec; t += 0.045) noise(0.06, { vol: 0.08 + (t / sec) * 0.18, freq: 180, q: 0.7, delay: t, kind: 'lowpass' });
      noise(1.5, { vol: 0.35, freq: 6000, kind: 'highpass', delay: sec });
    },
    applause: (sec = 2.5) => {
      for (let t = 0; t < sec; t += 0.025) noise(0.05, { vol: 0.05 + Math.random() * 0.06, freq: 1500 + Math.random() * 2500, q: 1.5, delay: t });
    },
    beep: (hi) => tone(hi ? 1320 : 660, hi ? 0.5 : 0.2, { type: 'square', vol: 0.15 }),
  };
})();

// ---------------------------------------------------------------------------
// Voix de l'animateur : synthèse vocale du navigateur (gratuite, hors ligne sur la plupart des appareils).
// Architecture évolutive : il suffira plus tard de remplacer speak() par une voix enregistrée ou une API TTS.
// ---------------------------------------------------------------------------
const Voice = (() => {
  const KEY = 'showtime-voice';
  let enabled = true; let voice = null;
  let preferred = null;
  try { preferred = localStorage.getItem(KEY); } catch { /* navigation privée */ }
  const synth = window.speechSynthesis;

  // Qualité estimée d'une voix : les voix « naturelles » (Edge) et Google sonnent bien moins robotiques.
  const quality = (v) => (/natural|neural|online/i.test(v.name) ? 3 : /google/i.test(v.name) ? 2 : /premium|enhanced|amélior|siri/i.test(v.name) ? 2 : 0);
  function list() {
    if (!synth) return [];
    return synth.getVoices().filter((v) => /^fr(-|_|$)/i.test(v.lang))
      .sort((a, b) => quality(b) - quality(a) || (/fr-FR/i.test(b.lang) ? 1 : 0) - (/fr-FR/i.test(a.lang) ? 1 : 0));
  }
  function choose() {
    const l = list();
    voice = l.find((v) => v.name === preferred) || l[0] || null;
  }
  if (synth) { choose(); synth.onvoiceschanged = choose; }

  // Petites corrections de prononciation et pauses naturelles.
  function prepare(text) {
    return text
      .replace(/[\p{Extended_Pictographic}‍️]/gu, '')
      .replace(/SHOWTIME/gi, 'Chô-taïme')
      .replace(/…/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    get supported() { return !!synth; },
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; if (!v && synth) synth.cancel(); },
    voices: () => list().map((v) => ({ name: v.name, natural: quality(v) >= 2 })),
    get current() { return voice ? voice.name : ''; },
    get natural() { return !!voice && quality(voice) >= 2; },
    use(name) {
      preferred = name;
      try { localStorage.setItem(KEY, name); } catch { /* */ }
      choose();
    },
    /** Lit le texte phrase par phrase : les pauses entre phrases rendent la voix plus vivante. */
    speak(text, onStart, onEnd) {
      if (!synth || !enabled || !text) { if (onEnd) onEnd(); return; }
      synth.cancel();
      const sentences = prepare(text).split(/(?<=[.!?])\s+/).filter(Boolean);
      const good = voice && quality(voice) >= 2;
      sentences.forEach((sentence, i) => {
        const u = new SpeechSynthesisUtterance(sentence);
        u.lang = voice ? voice.lang : 'fr-FR';
        if (voice) u.voice = voice;
        u.rate = good ? 1.02 : 0.95;
        u.pitch = 1;
        if (i === 0 && onStart) u.onstart = onStart;
        if (i === sentences.length - 1 && onEnd) { u.onend = onEnd; u.onerror = onEnd; }
        synth.speak(u);
      });
    },
  };
})();

// ---------------------------------------------------------------------------
// Confettis (canvas)
// ---------------------------------------------------------------------------
function confetti(duration = 4000) {
  let canvas = $('#confetti');
  if (!canvas) { canvas = h('canvas', { id: 'confetti' }); document.body.append(canvas); }
  const ctx = canvas.getContext('2d');
  const W = canvas.width = window.innerWidth; const H = canvas.height = window.innerHeight;
  const colors = ['#ff3d8b', '#22d3ee', '#facc15', '#4ade80', '#c084fc', '#fff'];
  const parts = Array.from({ length: 220 }, () => ({
    x: Math.random() * W, y: -20 - Math.random() * H * 0.6, w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
    vx: -2 + Math.random() * 4, vy: 2 + Math.random() * 4, r: Math.random() * Math.PI, vr: -0.2 + Math.random() * 0.4,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const end = performance.now() + duration;
  (function frame(now) {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.03;
      if (p.y > H + 20 && now < end) { p.y = -20; p.x = Math.random() * W; p.vy = 2 + Math.random() * 3; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (now < end + 3000) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  }(performance.now()));
}

// Garde l'écran allumé pendant la partie (si le navigateur le permet).
async function keepAwake() {
  try {
    if ('wakeLock' in navigator) {
      await navigator.wakeLock.request('screen');
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {});
      }, { once: true });
    }
  } catch { /* pas grave */ }
}

/** Petit compte à rebours côté client, recalé à chaque état reçu du serveur. */
function makeCountdown(onTick) {
  let raf = 0; let deadline = 0; let total = 0; let lastSec = null;
  function loop() {
    const left = Math.max(0, deadline - Date.now());
    const sec = Math.ceil(left / 1000);
    onTick(left, total, sec, sec !== lastSec);
    lastSec = sec;
    if (left > 0) raf = requestAnimationFrame(loop);
  }
  return {
    set(remainingMs, totalMs) {
      cancelAnimationFrame(raf);
      deadline = Date.now() + remainingMs; total = totalMs; lastSec = null;
      if (remainingMs > 0) loop(); else onTick(0, 0, 0, false);
    },
    stop() { cancelAnimationFrame(raf); },
  };
}

/** Écran de pause commun (télé et téléphones) : compte à rebours avant la fin de partie et bouton « Reprendre ». */
const PauseOverlay = (() => {
  let el = null; let tick = null; let endAt = 0;
  const mmss = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  return {
    /** @param {{by:string, remainingMs:number, maxMs:number}|null} p @param {(() => void)|null} onResume */
    set(p, onResume) {
      if (!p) { if (el) { el.remove(); el = null; clearInterval(tick); SFX.whoosh(); } return; }
      endAt = Date.now() + p.remainingMs;
      if (el) return;
      const left = h('b', { class: 'pause-left' });
      el = h('div', { class: 'pause-overlay', role: 'dialog', 'aria-label': 'Partie en pause' },
        h('div', { class: 'pause-card' },
          h('div', { class: 'pause-ic', text: '⏸️' }),
          h('h1', { text: 'Pause' }),
          h('p', { text: `Demandée par ${p.by}. Prenez votre temps !` }),
          h('p', { class: 'pause-time' }, 'Reprise possible encore ', left),
          h('small', { text: `Sans reprise dans les ${Math.round(p.maxMs / 60_000)} minutes, la partie s’arrête et le classement final s’affiche.` }),
          onResume ? h('button', { class: 'btn gold big', onclick: () => { onResume(); SFX.tap(); } }, '▶️ Reprendre la partie') : ''));
      document.body.append(el);
      SFX.pop();
      const paint = () => { left.textContent = mmss(endAt - Date.now()); };
      paint(); tick = setInterval(paint, 1000);
    },
  };
})();
