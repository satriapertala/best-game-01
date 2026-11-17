// main.js — NEON RIFT: fixed-timestep loop, screen flow, high-score persistence.
// Flow: title -> click starts a run -> play (pause with P/ESC, upgrade picks on
// even waves) -> game over -> click/R restarts, best score kept in localStorage.
import { initRender, render, screenToArena } from './render.js';
import { World } from './world.js';
import { Input } from './input.js';
import { initAudio, toggleMute, sfx } from './audio.js';
import { isShotMode, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
initRender(canvas);
initAudio();

const HIGH_KEY = 'neon-rift-best';
let highScore = Number(localStorage.getItem(HIGH_KEY) || 0);

const world = new World();
const input = new Input(canvas);
let muted = false;

// Deterministic screenshot states (?shot=start|play|wave5|upgrade|end).
const params = new URLSearchParams(location.search);
if (isShotMode(params)) applyShot(world, input, params);

function announce(t) { status.textContent = t; }

// Screens and edges are handled once per animation frame, before stepping.
function handleFlow() {
  const pauseEdge = input.takePause();
  if (input.takeMute()) muted = toggleMute();

  if (world.state === 'title') {
    if (input.takeClick() || input.key('Space') || input.key('Enter')) {
      world.reset();
      world.start();
      announce('Run started: survive the waves.');
      input.keys.delete('Space');
    }
    return;
  }
  if (world.state === 'upgrade') {
    for (const [code, i] of [['Digit1', 0], ['Digit2', 1], ['Digit3', 2]]) {
      if (input.key(code)) { world.takeUpgrade(i); input.keys.delete(code); }
    }
    return;
  }
  if (pauseEdge && (world.state === 'playing' || world.state === 'paused')) {
    world.state = world.state === 'playing' ? 'paused' : 'playing';
    announce(world.state === 'paused' ? 'Paused.' : 'Resumed.');
    sfx.ui();
    return;
  }
  if (world.state === 'gameover' && (input.takeClick() || input.key('KeyR') || input.key('Enter'))) {
    if (world.score > highScore) {
      highScore = world.score;
      localStorage.setItem(HIGH_KEY, String(highScore));
    }
    world.reset();
    world.start();
    announce('Redeployed. Good luck.');
    input.keys.delete('KeyR');
  }
}

// Fixed 60 Hz simulation with an accumulator; rendering runs every rAF.
const STEP = 1 / 60;
let acc = 0;
let last = performance.now();

function frame(now) {
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += elapsed;

  if (!isShotMode(params)) handleFlow();

  // keep the aim in arena space
  if (!isShotMode(params)) {
    const a = screenToArena(input.mouse.x, input.mouse.y);
    input.mouse.x = a.x; input.mouse.y = a.y;
    world.player.aim = Math.atan2(input.mouse.y - world.player.y, input.mouse.x - world.player.x);
  }

  while (acc >= STEP) {
    world.update(STEP, input, world.state === 'playing' && input.firing());
    acc -= STEP;
  }
  // deterministic shots do not accumulate time past their staged frame
  if (isShotMode(params)) acc = 0;

  render(world, highScore, muted);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
