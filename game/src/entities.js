// entities.js — the actors of the arena: player, enemies, bullets, pickups and
// particles. Each factory returns a plain object and each update mutates it, so
// the world only has to own the arrays.
import { ARENA, PLAYER, ENEMY, WAVES, PICKUP } from './config.js';
import { sfx } from './audio.js';

export function makePlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, r: PLAYER.r, hp: PLAYER.hpMax, hpMax: PLAYER.hpMax,
    aim: 0, fireTimer: 0, fireRate: PLAYER.fireRate, bulletDamage: PLAYER.bulletDamage,
    bulletSpeed: PLAYER.bulletSpeed, pierce: 0, spread: 0, maxSpeed: PLAYER.maxSpeed,
    dashTimer: 0, dashCooldown: 0, dashCdMax: PLAYER.dashCooldown, invuln: 0,
    dashDir: { x: 1, y: 0 }, hitFlash: 0, alive: true, taken: new Set(),
  };
}

export function makeEnemy(type, x, y, wave, rng) {
  const base = ENEMY[type];
  const hp = Math.ceil(base.hp * (1 + (wave - 1) * WAVES.hpScale));
  const speed = base.speed * (1 + Math.min(0.8, (wave - 1) * WAVES.speedScale));
  return {
    type, x, y, vx: 0, vy: 0, r: base.r, hp, maxHp: hp, speed,
    damage: base.damage, score: base.score, color: base.color,
    fireTimer: rng.float(0.5, 1.6), fireRate: base.fireRate ?? 0, bulletSpeed: base.bulletSpeed ?? 0,
    keepDist: base.keepDist ?? 0, children: base.children ?? 0,
    hitFlash: 0, wobble: rng.angle(), spin: rng.float(-3, 3), alive: true,
  };
}

export function makeBullet(x, y, angle, speed, damage, fromPlayer, pierce = 0) {
  return {
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    r: fromPlayer ? 5 : 7, damage, fromPlayer, pierce, angle,
    life: fromPlayer ? PLAYER.bulletLife : 1.8, alive: true,
  };
}

export function makePickup(x, y, kind, rng) {
  return { x, y, kind, r: 11, life: PICKUP.life, t: rng.float(0, Math.PI * 2), alive: true };
}

export function makeParticle(x, y, vx, vy, color, life, size) {
  return { x, y, vx, vy, color, life, maxLife: life, size, alive: true };
}

export function burstParticles(list, x, y, color, count, rng, speed = 220, size = 4, life = 0.55) {
  for (let i = 0; i < count; i++) {
    const a = rng.angle(), s = rng.float(0.25, 1) * speed;
    list.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, color, rng.float(0.55, 1) * life, rng.float(0.6, 1) * size));
  }
}

// --- movement -----------------------------------------------------------

export function updatePlayer(p, dt, input, world) {
  const ax = input.axis();
  if (p.dashTimer > 0) {
    // During a dash the player ignores acceleration and travels in a straight line.
    p.dashTimer -= dt;
    p.x += p.dashDir.x * PLAYER.dashSpeed * dt;
    p.y += p.dashDir.y * PLAYER.dashSpeed * dt;
    world.trail.push({ x: p.x, y: p.y, life: 0.32, maxLife: 0.32 });
  } else {
    p.vx += ax.x * PLAYER.accel * dt;
    p.vy += ax.y * PLAYER.accel * dt;
    const drag = Math.exp(-PLAYER.drag * dt);
    p.vx *= drag; p.vy *= drag;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > p.maxSpeed) { p.vx *= p.maxSpeed / sp; p.vy *= p.maxSpeed / sp; }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }

  if (input.wantsDash() && p.dashCooldown <= 0 && p.dashTimer <= 0) {
    let dx = ax.x, dy = ax.y;
    if (!dx && !dy) { dx = Math.cos(p.aim); dy = Math.sin(p.aim); }
    const n = Math.hypot(dx, dy) || 1;
    p.dashDir = { x: dx / n, y: dy / n };
    p.dashTimer = PLAYER.dashTime;
    p.dashCooldown = p.dashCdMax;
    p.invuln = Math.max(p.invuln, PLAYER.dashIFrames);
    world.shake = Math.max(world.shake, 5);
    burstParticles(world.particles, p.x, p.y, '#4dffdb', 12, world.rng, 170, 3, 0.4);
    sfx.dash();
  }

  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt * 4);
  p.fireTimer -= dt;
  p.x = Math.max(p.r, Math.min(ARENA.w - p.r, p.x));
  p.y = Math.max(p.r, Math.min(ARENA.h - p.r, p.y));
}

export function playerFire(p, world) {
  if (p.fireTimer > 0 || p.dashTimer > 0) return;
  const a = p.aim;
  const angles = [a];
  for (let i = 0; i < p.spread; i++) {
    const step = 0.11 + Math.floor(i / 2) * 0.11;
    angles.push(a + (i % 2 ? step : -step));
  }
  for (const ang of angles)
    world.bullets.push(makeBullet(p.x + Math.cos(ang) * 20, p.y + Math.sin(ang) * 20, ang, p.bulletSpeed, p.bulletDamage, true, p.pierce));
  p.fireTimer = p.fireRate;
  // recoil, so firing has a little weight
  p.vx -= Math.cos(a) * 70; p.vy -= Math.sin(a) * 70;
  const mx = p.x + Math.cos(a) * 22, my = p.y + Math.sin(a) * 22;
  world.flashRing.push({ x: mx, y: my, t: 0.12, max: 0.12 });
  sfx.shoot();
}

export function updateEnemy(e, dt, player, world, rng) {
  e.wobble += dt * 3;
  e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  let tx = dx / d, ty = dy / d;

  if (e.type === 'shooter') {
    // Kites the player: closes in from range, backs off when too close.
    if (d < e.keepDist - 60) { tx = -tx; ty = -ty; }
    else if (d < e.keepDist + 40) { const t = tx; tx = -ty; ty = t; }
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && d < 640) {
      e.fireTimer = e.fireRate;
      const aim = Math.atan2(dy, dx) + Math.sin(e.wobble) * 0.1;
      world.ebullets.push(makeBullet(e.x, e.y, aim, e.bulletSpeed, e.damage, false));
      sfx.enemyShot();
    }
  }
  if (e.type === 'speeder' || e.type === 'child') {
    tx += Math.cos(e.wobble) * 0.4; ty += Math.sin(e.wobble * 1.3) * 0.4;
    const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
  }

  e.vx += (tx * e.speed - e.vx) * Math.min(1, dt * 5);
  e.vy += (ty * e.speed - e.vy) * Math.min(1, dt * 5);
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.x = Math.max(e.r, Math.min(ARENA.w - e.r, e.x));
  e.y = Math.max(e.r, Math.min(ARENA.h - e.r, e.y));
}

export function splitEnemy(e, wave, rng) {
  const out = [];
  for (let i = 0; i < e.children; i++) {
    const a = (i / e.children) * Math.PI * 2 + rng.angle() * 0.4;
    const c = makeEnemy('child', e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26, wave, rng);
    c.vx = Math.cos(a) * 180; c.vy = Math.sin(a) * 180;
    out.push(c);
  }
  return out;
}

// --- misc lists ---------------------------------------------------------

export function updateParticles(list, dt) {
  for (const p of list) {
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const damp = Math.exp(-3 * dt);
    p.vx *= damp; p.vy *= damp;
  }
  compact(list);
}

export function updatePickups(list, dt, player, onHeal) {
  for (const k of list) {
    k.life -= dt; k.t += dt * 4;
    if (k.life <= 0) { k.alive = false; continue; }
    const d = Math.hypot(player.x - k.x, player.y - k.y) || 1;
    if (d < 120) { k.x += (player.x - k.x) / d * 300 * dt; k.y += (player.y - k.y) / d * 300 * dt; }
    if (d < player.r + k.r) { k.alive = false; onHeal(k); }
  }
  compact(list);
}

export function compact(list) {
  let w = 0;
  for (let i = 0; i < list.length; i++) if (list[i].alive) list[w++] = list[i];
  list.length = w;
}
