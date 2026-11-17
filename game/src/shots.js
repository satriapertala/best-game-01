// shots.js — deterministic states for screenshot capture via ?shot=NAME.
// Each mode rebuilds a representative frame with a fixed seed, so every
// screenshot of the same name is identical.
import { ARENA } from './config.js';
import { makeEnemy, makeBullet, makePickup, burstParticles } from './entities.js';
import { Rng } from './random.js';

export function isShotMode(params) {
  return params.has('shot');
}

export function applyShot(world, input, params) {
  const mode = params.get('shot') || '';
  const seed = Number(params.get('seed') || '1');
  world.rng = new Rng(seed);
  if (mode === 'start') {
    world.state = 'title';
    world.time = 1.0;
    return true;
  }
  if (mode === 'play') return staged(world, input, {
    wave: 3, score: 12450, combo: 2.5, comboTimer: 1.4, kills: 37, hp: 71,
    px: 0.5, py: 0.5, aim: -0.5, banner: '', dashCd: 0.4,
    layout: [['chaser',0.22,0.30],['chaser',0.72,0.26],['speeder',0.44,0.14],['speeder',0.82,0.55],
             ['shooter',0.16,0.70],['shooter',0.84,0.78],['splitter',0.56,0.84],['chaser',0.34,0.62],
             ['child',0.62,0.44]],
    shots: 7, pickups: [[0.30,0.22]], burst: [[0.72,0.26,'#ff5c7a',16],[0.44,0.14,'#ffd166',12]],
  }, seed);
  if (mode === 'wave5') return staged(world, input, {
    wave: 5, score: 28310, combo: 4.25, comboTimer: 1.0, kills: 82, hp: 54,
    px: 0.40, py: 0.50, aim: 0.9, banner: 'WAVE 5', dashCd: 0,
    layout: [['chaser',0.14,0.20],['chaser',0.86,0.30],['speeder',0.60,0.18],['speeder',0.28,0.86],
             ['shooter',0.76,0.72],['shooter',0.18,0.60],['splitter',0.50,0.10],['splitter',0.90,0.86],
             ['child',0.46,0.40],['child',0.56,0.62]],
    shots: 5, pickups: [[0.62,0.30]], burst: [[0.86,0.30,'#ff5c7a',18],[0.50,0.10,'#c77dff',14]],
  }, seed);
  if (mode === 'upgrade') {
    world.state = 'upgrade';
    world.wave = 4;
    world.score = 20100;
    world.kills = 61;
    world.time = 1.0;
    world.offerUpgrade();
    // make the choices deterministic
    world.upgradeChoices = ['rapid', 'pierce', 'shield'].map(id => world.rng ? null : null) && world.upgradeChoices;
    return true;
  }
  if (mode === 'end') {
    world.state = 'gameover';
    world.wave = 7;
    world.score = 46200;
    world.kills = 134;
    world.time = 1.0;
    world.player.alive = false;
    world.aim = 0;
    burstParticles(world.particles, ARENA.w / 2, ARENA.h / 2, '#4dffdb', 30, world.rng, 340, 5, 0.95);
    return true;
  }
  return false;
}

// Build one staged play frame from a compact description.
function staged(world, input, cfg, seed) {
  world.state = 'playing';
  world.wave = cfg.wave;
  world.score = cfg.score;
  world.combo = cfg.combo;
  world.comboTimer = cfg.comboTimer;
  world.kills = cfg.kills;
  world.say(cfg.banner, cfg.banner ? 3 : 0);
  const p = world.player;
  p.x = ARENA.w * cfg.px; p.y = ARENA.h * cfg.py;
  p.hp = cfg.hp;
  p.aim = cfg.aim;
  p.dashCooldown = cfg.dashCd;
  for (const [type, fx, fy] of cfg.layout)
    world.enemies.push(makeEnemy(type, fx * ARENA.w, fy * ARENA.h, cfg.wave, world.rng));
  for (let i = 0; i < cfg.shots; i++) {
    const a = cfg.aim + (i / cfg.shots) * Math.PI * 2 * 0.8;
    const b = makeBullet(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, a, 820, 13, true);
    b.life = 0.75;
    world.bullets.push(b);
  }
  // a couple of incoming enemy bullets near shooters
  for (const [type, fx, fy] of cfg.layout) {
    if (type !== 'shooter') continue;
    const a = Math.atan2(p.y - fy * ARENA.h, p.x - fx * ARENA.w);
    world.ebullets.push(makeBullet(fx * ARENA.w, fy * ARENA.h, a, 310, 12, false));
  }
  for (const [fx, fy] of cfg.pickups)
    world.pickups.push(makePickup(fx * ARENA.w, fy * ARENA.h, 'heal', world.rng));
  for (const [fx, fy, color, n] of cfg.burst)
    burstParticles(world.particles, fx * ARENA.w, fy * ARENA.h, color, n, world.rng, 240, 4, 0.55);
  world.time = 1.0;
  return true;
}
