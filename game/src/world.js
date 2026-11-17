// world.js — the state machine of a run: wave director, collisions, scoring,
// combo, upgrades and the high score. Rendering and input stay outside.
import { ARENA, WAVES, COMBO, PICKUP, UPGRADES } from './config.js';
import { Rng } from './random.js';
import {
  makePlayer, makeEnemy, makeBullet, makePickup, burstParticles,
  updatePlayer, playerFire, updateEnemy, splitEnemy, updateParticles, updatePickups, compact,
} from './entities.js';
import { sfx } from './audio.js';

const TYPES = ['chaser', 'speeder', 'shooter', 'splitter'];

export class World {
  constructor(seed) {
    this.rng = new Rng(seed ?? (Date.now() & 0xffffffff));
    this.reset();
  }

  reset() {
    this.player = makePlayer(ARENA.w / 2, ARENA.h / 2);
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.particles = [];
    this.pickups = [];
    this.trail = [];
    this.flashRing = [];
    this.stars = [];
    for (let i = 0; i < 90; i++)
      this.stars.push({ x: this.rng.float(0, ARENA.w), y: this.rng.float(0, ARENA.h), s: this.rng.float(0.6, 2.2), tw: this.rng.float(0, Math.PI * 2) });
    this.wave = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.kills = 0;
    this.state = 'title'; // title | playing | upgrade | gameover | paused
    this.spawnQueue = 0;
    this.spawnPool = ['chaser'];
    this.spawnTimer = 0;
    this.waveBreak = 0;
    this.upgradeOffered = false;
    this.upgradeChoices = [];
    this.shake = 0;
    this.flash = 0;
    this.time = 0;
    this.msg = '';
    this.msgTimer = 0;
    this.waveBanner = { text: '', t: 0 };
  }

  say(text, time = 2.2) { this.waveBanner = { text, t: time }; }

  startWave() {
    this.wave++;
    const unlocked = 1 + Math.floor(this.wave / 2);
    this.spawnPool = TYPES.slice(0, Math.min(TYPES.length, unlocked));
    this.spawnQueue = WAVES.baseCount + (this.wave - 1) * WAVES.perWave;
    this.spawnTimer = 0.5;
    this.say(`WAVE ${this.wave}`);
    sfx.wave();
  }

  start() {
    this.state = 'playing';
    this.wave = 0;
    this.upgradeOffered = false;
    this.waveBreak = 0;
    this.startWave();
  }

  offerUpgrade() {
    const bag = UPGRADES.filter(u => !this.player.taken.has(u.id)).slice();
    const picks = [];
    while (picks.length < 3 && bag.length)
      picks.push(bag.splice(Math.floor(this.rng.float(0, bag.length)), 1)[0]);
    this.upgradeChoices = picks;
    this.state = 'upgrade';
    sfx.upgrade();
  }

  takeUpgrade(i) {
    const u = this.upgradeChoices[i];
    if (!u) return;
    this.player.taken.add(u.id);
    u.apply(this.player);
    this.state = 'playing';
    this.say(`${u.name} INSTALLED`);
    sfx.upgrade();
  }

  // --- per-frame --------------------------------------------------------

  update(dt, input, fireHeld) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.waveBanner.t > 0) this.waveBanner.t -= dt;
    for (const r of this.flashRing) r.t -= dt;
    compact(this.flashRing);
    for (const s of this.stars) s.tw += dt * 2;

    if (this.state === 'playing') {
      updatePlayer(this.player, dt, input, this);
      if (fireHeld) playerFire(this.player, this);
      this.stepWaves(dt);
      this.stepEntities(dt);
      this.collide();
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 1;
      }
    }
    updateParticles(this.particles, dt);
    updateParticles(this.trail, dt);
  }

  stepWaves(dt) {
    if (this.state !== 'playing') return;
    if (this.spawnQueue > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = WAVES.spawnInterval;
        const type = this.rng.pick(this.spawnPool);
        // Spawn on an edge, but never within 260px of the player.
        let x, y;
        do {
          const side = this.rng.int(0, 3);
          if (side === 0) { x = this.rng.float(60, ARENA.w - 60); y = 45; }
          else if (side === 1) { x = ARENA.w - 45; y = this.rng.float(60, ARENA.h - 60); }
          else if (side === 2) { x = this.rng.float(60, ARENA.w - 60); y = ARENA.h - 45; }
          else { x = 45; y = this.rng.float(60, ARENA.h - 60); }
        } while (Math.hypot(x - this.player.x, y - this.player.y) < 260);
        const e = makeEnemy(type, x, y, this.wave, this.rng);
        this.enemies.push(e);
        burstParticles(this.particles, x, y, e.color, 8, this.rng, 120, 3, 0.4);
        this.spawnQueue--;
      }
      return;
    }
    if (this.enemies.length === 0) {
      // Wave cleared. Every second wave an upgrade installs before the next.
      if (this.wave % 2 === 0 && !this.upgradeOffered) {
        this.upgradeOffered = true;
        this.offerUpgrade();
        return;
      }
      this.waveBreak -= dt;
      if (this.waveBreak <= 0) {
        this.upgradeOffered = false;
        if (this.wave > 0) {
          const bonus = 250 * this.wave;
          this.score += bonus;
          this.say(`WAVE ${this.wave} CLEARED  +${bonus}`);
        }
        this.waveBreak = WAVES.breakTime;
        this.startWave();
      }
    }
  }

  stepEntities(dt) {
    for (const e of this.enemies) updateEnemy(e, dt, this.player, this, this.rng);
    compact(this.enemies);
    for (const arr of [this.bullets, this.ebullets]) {
      for (const b of arr) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.life <= 0 || b.x < -30 || b.x > ARENA.w + 30 || b.y < -30 || b.y > ARENA.h + 30) b.alive = false;
      }
    }
    compact(this.bullets); compact(this.ebullets);
    updatePickups(this.pickups, dt, this.player, k => {
      this.player.hp = Math.min(this.player.hpMax, this.player.hp + PICKUP.heal);
      burstParticles(this.particles, k.x, k.y, '#7dff9e', 10, this.rng, 140, 3, 0.4);
      sfx.pickup();
    });
  }

  // --- combat -----------------------------------------------------------

  hitEnemy(e, dmg, bx, by) {
    e.hp -= dmg;
    e.hitFlash = 1;
    burstParticles(this.particles, bx ?? e.x, by ?? e.y, e.color, 6, this.rng, 160, 3, 0.35);
    if (e.hp <= 0) {
      e.alive = false;
      this.kills++;
      this.combo = Math.min(COMBO.maxMult, this.combo + COMBO.step);
      this.comboTimer = COMBO.window;
      this.score += Math.round(e.score * this.combo);
      burstParticles(this.particles, e.x, e.y, e.color, 18, this.rng, 280, 4.5, 0.6);
      this.shake = Math.max(this.shake, 6);
      sfx.kill();
      if (e.children > 0) {
        this.enemies.push(...splitEnemy(e, this.wave, this.rng));
        sfx.split();
      }
      if (this.rng.float(0, 1) < PICKUP.dropChance) this.pickups.push(makePickup(e.x, e.y, 'heal', this.rng));
    } else {
      sfx.hitEnemy();
      this.comboTimer = Math.max(this.comboTimer, COMBO.window * 0.6);
    }
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (p.invuln > 0 || p.dashTimer > 0) return;
    p.hp -= dmg;
    p.invuln = 0.9;
    p.hitFlash = 1;
    this.combo = 1;
    this.shake = Math.max(this.shake, 9);
    this.flash = 0.55;
    burstParticles(this.particles, p.x, p.y, '#ff5c7a', 14, this.rng, 210, 3.5, 0.5);
    sfx.hurt();
    if (p.hp <= 0) {
      p.hp = 0; p.alive = false;
      this.state = 'gameover';
      burstParticles(this.particles, p.x, p.y, '#4dffdb', 46, this.rng, 400, 5.5, 1.1);
      this.shake = 16;
      sfx.gameover();
    }
  }

  collide() {
    const p = this.player;
    for (const b of this.bullets) {
      for (const e of this.enemies) {
        if (!e.alive || Math.hypot(b.x - e.x, b.y - e.y) >= e.r + b.r) continue;
        this.hitEnemy(e, b.damage, b.x, b.y);
        if (b.pierce > 0) b.pierce--;
        else { b.alive = false; break; }
      }
    }
    compact(this.bullets);
    for (const b of this.ebullets) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + b.r) {
        b.alive = false;
        this.hurtPlayer(b.damage);
      }
    }
    compact(this.ebullets);
    if (p.alive) for (const e of this.enemies) {
      if (Math.hypot(e.x - p.x, e.y - p.y) < p.r + e.r) this.hurtPlayer(e.damage);
    }
  }
}
