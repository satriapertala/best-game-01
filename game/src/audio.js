// audio.js — tiny WebAudio synth: one shared AudioContext, no asset files.
// Every sound is generated on the fly (square/saw blips + noise), so the game
// stays offline and original.
let ctx = null;
let master = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.22;
  return muted;
}

function blip(freq, dur, type, vol, slide = 0) {
  if (!ctx || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + dur);
}

function noise(dur, vol, hp = 800) {
  if (!ctx || muted) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

export const sfx = {
  shoot:   () => blip(880, 0.07, 'square', 0.5, -320),
  enemyShot: () => blip(300, 0.12, 'sawtooth', 0.4, -120),
  hitEnemy: () => noise(0.06, 0.5, 1400),
  kill:    () => { blip(520, 0.14, 'square', 0.6, 260); noise(0.12, 0.5, 900); },
  split:   () => blip(220, 0.2, 'sawtooth', 0.5, 140),
  hurt:    () => { blip(160, 0.25, 'sawtooth', 0.7, -80); noise(0.18, 0.6, 400); },
  dash:    () => blip(240, 0.16, 'sine', 0.6, 620),
  pickup:  () => { blip(660, 0.09, 'sine', 0.5); setTimeout(() => blip(990, 0.12, 'sine', 0.5), 70); },
  wave:    () => { [440, 554, 659].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'square', 0.4), i * 110)); },
  upgrade: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'square', 0.4), i * 90)); },
  gameover:() => { [392, 311, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.5), i * 170)); },
  ui:      () => blip(700, 0.05, 'square', 0.3),
};
