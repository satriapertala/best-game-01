// config.js — every tunable of NEON RIFT in one place.
export const ARENA = { w: 1280, h: 720 };
export const PLAYER = {
  r: 16, accel: 3600, maxSpeed: 330, drag: 6.5,
  hpMax: 100, iframes: 0.9, contactDamage: 18,
  dashSpeed: 1000, dashTime: 0.15, dashCooldown: 1.1, dashIFrames: 0.22,
  fireRate: 0.135, bulletSpeed: 820, bulletLife: 0.9, bulletDamage: 13,
};
export const ENEMY = {
  chaser:  { r: 15, speed: 160, hp: 3,  damage: 14, score: 100, color: '#ff5c7a' },
  speeder: { r: 12, speed: 268, hp: 2,  damage: 10, score: 150, color: '#ffd166' },
  shooter: { r: 17, speed: 96,  hp: 5,  damage: 12, score: 200, color: '#7bdff2', fireRate: 1.55, bulletSpeed: 310, keepDist: 290 },
  splitter:{ r: 24, speed: 112, hp: 8,  damage: 16, score: 250, color: '#c77dff', children: 3 },
  child:   { r: 11, speed: 210, hp: 1,  damage: 8,  score: 60,  color: '#e0aaff' },
};
export const WAVES = {
  baseCount: 6, perWave: 2, spawnInterval: 0.5, breakTime: 3.0, hpScale: 0.12, speedScale: 0.03,
};
export const COMBO = { window: 2.2, maxMult: 8, step: 0.25 };
export const PICKUP = { dropChance: 0.16, heal: 22, life: 9 };
export const UPGRADES = [
  { id: 'rapid',  name: 'RAPID FIRE',  desc: '+25% fire rate',        apply: p => { p.fireRate *= 0.75; } },
  { id: 'damage', name: 'HEAVY SLUGS', desc: '+35% bullet damage',    apply: p => { p.bulletDamage *= 1.35; } },
  { id: 'speed',  name: 'LIGHT FRAME', desc: '+15% move speed',       apply: p => { p.maxSpeed *= 1.15; } },
  { id: 'pierce', name: 'PIERCER',     desc: 'shots pierce one more', apply: p => { p.pierce += 1; } },
  { id: 'spread', name: 'TWIN BARREL', desc: 'fire one extra shot',   apply: p => { p.spread += 1; } },
  { id: 'shield', name: 'BULWARK',     desc: '+30 max hull, repairs', apply: p => { p.hpMax += 30; p.hp = Math.min(p.hpMax, p.hp + 30); } },
  { id: 'dash',   name: 'PHASE DRIVE', desc: 'dash recharges faster', apply: p => { p.dashCdMax *= 0.65; } },
];
export const COLORS = {
  bg: '#080a11', grid: '#131a2b', gridBright: '#1c2740',
  player: '#4dffdb', bullet: '#c8fff2', enemyBullet: '#ff8fa3',
  hud: '#d6ecff', accent: '#4dffdb', danger: '#ff5c7a', gold: '#ffd166', dim: '#6b7d9e',
};
