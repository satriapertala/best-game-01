// render.js — everything drawn: arena, actors, particles, HUD and the four
// screens (title, upgrade, pause, game over). The arena maps 1:1 onto a
// 1280x720 canvas and letterboxes on other window sizes.
import { ARENA, COLORS } from './config.js';

let canvas, ctx, W, H, dpr, scale = 1, ox = 0, oy = 0;

export function initRender(cv) {
  canvas = cv;
  ctx = canvas.getContext('2d');
  resize();
  addEventListener('resize', resize);
}

function resize() {
  W = innerWidth; H = innerHeight;
  dpr = devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  scale = Math.min(W / ARENA.w, H / ARENA.h);
  ox = (W - ARENA.w * scale) / 2;
  oy = (H - ARENA.h * scale) / 2;
}

// Screen point -> arena point (mouse aiming uses this).
export function screenToArena(sx, sy) {
  return { x: (sx - ox) / scale, y: (sy - oy) / scale };
}

function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function noGlow() { ctx.shadowBlur = 0; }

function text(str, x, y, size, color, align = 'left', blur = 8, weight = 700) {
  ctx.font = `${weight} ${size}px "Segoe UI", "Helvetica Neue", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  if (blur) glow(color, blur);
  ctx.fillText(str, x, y);
  noGlow();
}

export function render(world, highScore, muted) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  if (world.state === 'title') { drawTitle(world, highScore); return; }

  ctx.save();
  const shx = (Math.random() - 0.5) * world.shake * 2;
  const shy = (Math.random() - 0.5) * world.shake * 2;
  ctx.translate(Math.round(ox + shx), Math.round(oy + shy));
  ctx.scale(scale, scale);

  drawArena(world);
  drawTrail(world);
  drawPickups(world);
  drawEnemies(world);
  drawBullets(world);
  drawPlayer(world);
  drawParticles(world.particles);
  drawVignette();
  ctx.restore();

  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255,92,122,${world.flash * 0.22})`;
    ctx.fillRect(0, 0, W, H);
  }
  drawHud(world, highScore, muted);
  if (world.waveBanner.t > 0) drawBanner(world);
  if (world.state === 'upgrade') drawUpgrade(world);
  if (world.state === 'paused') drawPause();
  if (world.state === 'gameover') drawGameOver(world, highScore);
}

// --- arena --------------------------------------------------------------

function drawArena(world) {
  // starfield
  for (const s of world.stars) {
    const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(s.tw));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#9fb6dd';
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  // grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 80; x < ARENA.w; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.h); }
  for (let y = 80; y < ARENA.h; y += 80) { ctx.moveTo(0, y); ctx.lineTo(ARENA.w, y); }
  ctx.stroke();

  // border
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  glow(COLORS.accent, 14);
  ctx.strokeRect(1, 1, ARENA.w - 2, ARENA.h - 2);
  noGlow();
}

function drawVignette() {
  const g = ctx.createRadialGradient(ARENA.w / 2, ARENA.h / 2, ARENA.h * 0.42, ARENA.w / 2, ARENA.h / 2, ARENA.h * 0.9);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
}

// --- actors -------------------------------------------------------------

function drawPlayer(world) {
  const p = world.player;
  if (!p.alive) return;
  const blinking = p.invuln > 0 && p.dashTimer <= 0 && Math.floor(world.time * 18) % 2 === 0;
  if (blinking) return;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aim);
  // engine glow behind the hull
  ctx.fillStyle = COLORS.player;
  glow(COLORS.player, 24);
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(-6, 0, p.r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // barrel
  ctx.fillStyle = COLORS.bullet;
  glow(COLORS.bullet, 10);
  ctx.fillRect(8, -2.5, 20, 5);
  noGlow();
  // arrow hull
  ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : COLORS.player;
  glow(p.hitFlash > 0 ? '#ffffff' : COLORS.player, 16);
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -12);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 12);
  ctx.closePath();
  ctx.fill();
  noGlow();
  ctx.restore();

  // dash cooldown ring
  if (p.dashCooldown > 0) {
    ctx.strokeStyle = 'rgba(107,125,158,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 8, -Math.PI / 2, -Math.PI / 2 + (1 - p.dashCooldown / p.dashCdMax) * Math.PI * 2);
    ctx.stroke();
  }
}

function drawEnemies(world) {
  for (const e of world.enemies) {
    const col = e.hitFlash > 0 ? '#ffffff' : e.color;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = col;
    glow(col, 15);
    ctx.beginPath();
    if (e.type === 'chaser') {
      ctx.rotate(Math.atan2(world.player.y - e.y, world.player.x - e.x));
      ctx.moveTo(e.r, 0); ctx.lineTo(-e.r * 0.75, -e.r * 0.75); ctx.lineTo(-e.r * 0.35, 0); ctx.lineTo(-e.r * 0.75, e.r * 0.75);
      ctx.closePath();
    } else if (e.type === 'speeder' || e.type === 'child') {
      ctx.rotate(e.wobble * 1.4);
      ctx.moveTo(e.r, 0); ctx.lineTo(0, -e.r); ctx.lineTo(-e.r, 0); ctx.lineTo(0, e.r);
      ctx.closePath();
    } else if (e.type === 'shooter') {
      ctx.rotate(e.wobble * 0.4);
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        const px = Math.cos(a) * e.r, py = Math.sin(a) * e.r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else { // splitter: rotating square
      ctx.rotate(e.wobble * 0.7);
      ctx.rect(-e.r * 0.8, -e.r * 0.8, e.r * 1.6, e.r * 1.6);
    }
    ctx.fill();
    noGlow();
    ctx.restore();
    // HP pips for tough enemies
    if (e.maxHp > 3 && e.hp < e.maxHp) {
      const w = e.r * 2.4;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4);
      ctx.fillStyle = col;
      ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * (e.hp / e.maxHp), 4);
    }
  }
}

function drawBullets(world) {
  ctx.lineCap = 'round';
  for (const b of world.bullets) {
    ctx.strokeStyle = COLORS.bullet;
    glow(COLORS.bullet, 12);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
    ctx.stroke();
  }
  for (const b of world.ebullets) {
    ctx.fillStyle = COLORS.enemyBullet;
    glow(COLORS.enemyBullet, 12);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  noGlow();
  // muzzle flashes
  for (const r of world.flashRing) {
    const a = r.t / r.max;
    ctx.globalAlpha = a;
    ctx.strokeStyle = COLORS.bullet;
    glow(COLORS.bullet, 14);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 8 + (1 - a) * 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  noGlow();
}

function drawParticles(list) {
  for (const p of list) {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    glow(p.color, 8);
    const s = p.size * (0.5 + a * 0.5);
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  noGlow();
}

function drawTrail(world) {
  for (const t of world.trail) {
    const a = t.life / t.maxLife;
    ctx.globalAlpha = a * 0.55;
    ctx.fillStyle = COLORS.player;
    glow(COLORS.player, 16);
    ctx.beginPath();
    ctx.arc(t.x, t.y, 12 * a + 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  noGlow();
}

function drawPickups(world) {
  for (const k of world.pickups) {
    const bob = Math.sin(k.t) * 3;
    const blink = k.life < 2.5 && Math.floor(k.life * 8) % 2 === 0;
    if (blink) continue;
    ctx.save();
    ctx.translate(k.x, k.y + bob);
    ctx.rotate(k.t * 0.6);
    ctx.fillStyle = '#7dff9e';
    glow('#7dff9e', 16);
    // cross/capsule shape
    ctx.fillRect(-4, -11, 8, 22);
    ctx.fillRect(-11, -4, 22, 8);
    ctx.restore();
    noGlow();
  }
}

// --- HUD & screens ------------------------------------------------------

function drawHud(world, highScore, muted) {
  const p = world.player;
  const bw = 300;
  // hull bar
  ctx.fillStyle = 'rgba(4,6,12,0.8)';
  ctx.fillRect(28, 22, bw + 10, 30);
  ctx.strokeStyle = COLORS.dim;
  ctx.lineWidth = 1;
  ctx.strokeRect(28.5, 22.5, bw + 9, 29);
  const frac = p.hp / p.hpMax;
  const col = frac > 0.35 ? COLORS.accent : COLORS.danger;
  ctx.fillStyle = col;
  glow(col, 10);
  ctx.fillRect(33, 27, bw * frac, 20);
  noGlow();
  text(`HULL ${Math.ceil(p.hp)}/${p.hpMax}`, 34, 68, 14, COLORS.hud, 'left', 4);
  text(`HOSTILES ${world.enemies.length + world.spawnQueue}`, 34, 90, 13, COLORS.dim, 'left', 3);

  // right block
  text(`WAVE ${world.wave}`, W - 36, 44, 26, COLORS.hud, 'right', 8);
  text(String(world.score).padStart(7, '0'), W - 36, 78, 30, COLORS.gold, 'right', 10);
  if (world.combo > 1) text(`x${world.combo.toFixed(2)} COMBO`, W - 36, 104, 17, COLORS.accent, 'right', 8);
  text(`BEST ${Math.max(highScore, world.score)}`, W - 36, 126, 13, COLORS.dim, 'right', 3);

  // dash state, bottom left
  const ready = p.dashCooldown <= 0;
  text(ready ? 'DASH READY  [SPACE]' : 'DASH CHARGING', 34, H - 30, 14, ready ? COLORS.accent : COLORS.dim, 'left', ready ? 8 : 3);
  text(muted ? 'M — SOUND OFF' : 'M — SOUND ON', W - 36, H - 30, 13, COLORS.dim, 'right', 3);
}

function drawBanner(world) {
  const a = Math.min(1, world.waveBanner.t * 2);
  ctx.globalAlpha = a;
  text(world.waveBanner.text, W / 2, H * 0.26, 46, COLORS.accent, 'center', 18);
  ctx.globalAlpha = 1;
}

function panel(w, h) {
  const x = (W - w) / 2, y = (H - h) / 2;
  ctx.fillStyle = 'rgba(6,9,16,0.9)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.accent;
  glow(COLORS.accent, 16);
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  noGlow();
  return { x, y, w, h };
}

function drawTitle(world, highScore) {
  // drifting grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const off = (world.time * 26) % 80;
  ctx.beginPath();
  for (let x = -80 + off; x < W + 80; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = -80 + off; y < H + 80; y += 80) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  const pulse = 1 + Math.sin(world.time * 2) * 0.03;
  ctx.save();
  ctx.translate(W / 2, H * 0.28);
  ctx.scale(pulse, pulse);
  text('NEON RIFT', 0, 0, 92, COLORS.accent, 'center', 26);
  text('survive the waves  ·  chain the kills', 0, 46, 21, COLORS.hud, 'center', 6);
  ctx.restore();

  text('WASD / ARROWS — move      MOUSE — aim      HOLD LMB or J — fire', W / 2, H * 0.5, 18, COLORS.hud, 'center', 4);
  text('SPACE / SHIFT — dash (dodges everything)      P / ESC — pause      M — mute', W / 2, H * 0.5 + 30, 18, COLORS.hud, 'center', 4);
  text('CLEAR EVERY SECOND WAVE TO INSTALL AN UPGRADE', W / 2, H * 0.5 + 62, 16, COLORS.gold, 'center', 6);
  text(`BEST SCORE  ${highScore}`, W / 2, H * 0.5 + 96, 16, COLORS.dim, 'center', 3);

  ctx.globalAlpha = 0.75 + 0.25 * Math.sin(world.time * 4);
  text('CLICK TO ENTER THE RIFT', W / 2, H * 0.8, 28, COLORS.accent, 'center', 14);
  ctx.globalAlpha = 1;
}

function drawUpgrade(world) {
  const { x, y, w, h } = panel(760, 380);
  text('RIFT UPGRADE — PRESS 1 · 2 · 3', x + w / 2, y + 56, 26, COLORS.accent, 'center', 10);
  world.upgradeChoices.forEach((u, i) => {
    const uy = y + 112 + i * 82;
    ctx.fillStyle = 'rgba(77,255,219,0.07)';
    ctx.fillRect(x + 30, uy - 38, w - 60, 66);
    ctx.strokeStyle = COLORS.dim;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 30.5, uy - 37.5, w - 61, 65);
    text(`[${i + 1}]   ${u.name}`, x + 52, uy - 8, 22, COLORS.hud, 'left', 6);
    text(u.desc, x + 52, uy + 18, 15, COLORS.dim, 'left', 2);
  });
}

function drawPause() {
  const { y, h } = panel(420, 170);
  text('PAUSED', W / 2, y + h / 2 - 6, 42, COLORS.hud, 'center', 10);
  text('P / ESC to resume  ·  M to mute', W / 2, y + h / 2 + 34, 16, COLORS.dim, 'center', 3);
}

function drawGameOver(world, highScore) {
  ctx.fillStyle = 'rgba(10,2,8,0.6)';
  ctx.fillRect(0, 0, W, H);
  const { x, y, w, h } = panel(660, 360);
  const beat = world.score >= highScore && world.score > 0;
  text('RIFT COLLAPSED', x + w / 2, y + 76, 46, COLORS.danger, 'center', 16);
  text(`FINAL SCORE  ${world.score}`, x + w / 2, y + 136, 30, COLORS.gold, 'center', 10);
  text(`WAVE REACHED  ${world.wave}      KILLS  ${world.kills}`, x + w / 2, y + 176, 20, COLORS.hud, 'center', 4);
  if (beat) text('NEW BEST SCORE!', x + w / 2, y + 216, 22, COLORS.accent, 'center', 8);
  else text(`BEST  ${highScore}`, x + w / 2, y + 216, 18, COLORS.dim, 'center', 3);
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(world.time * 4);
  text('CLICK or press R to redeploy', x + w / 2, y + 286, 21, COLORS.accent, 'center', 8);
  ctx.globalAlpha = 1;
}
