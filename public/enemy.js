// enemy.js
export const ENEMY_SIZE = 38;
export const SHOOTER_SIZE = 38;
export const BOSS_SIZE = 78;

export let enemies = [];
export let shooterEnemies = [];
export let shooterBullets = [];
export let boss = null;

export const ENEMY_RESPAWN_MS   = 120_000;
export const SHOOTER_RESPAWN_MS = 100_000;
export const SHOOTER_FIRE_RATE  = 3.0;
export const SHOOTER_DMG        = 25;
export const SHOOTER_BULLET_SPEED = 9;
export const BOSS_SPAWN_HP      = 6000;
export const BOSS_DMG           = 120;
export const BOSS_HIT_RATE      = 4.0;

export function spawnEnemy(MAP_W, MAP_H, SAFE_ZONES) {
  let ex, ey, safe;
  do {
    ex = Math.random() * (MAP_W - 160) + 80;
    ey = Math.random() * (MAP_H - 160) + 80;
    safe = SAFE_ZONES.some(z => Math.hypot(ex - z.x, ey - z.y) < z.r + ENEMY_SIZE / 2 + 8);
  } while (safe);
  enemies.push({ x: ex, y: ey, hp: 42 + Math.random() * 60, alive: true, respawnTime: null, type: "normal" });
}

export function spawnShooter(MAP_W, MAP_H, SAFE_ZONES) {
  let ex, ey, safe;
  do {
    ex = Math.random() * (MAP_W - 180) + 90;
    ey = Math.random() * (MAP_H - 180) + 90;
    safe = SAFE_ZONES.some(z => Math.hypot(ex - z.x, ey - z.y) < z.r + SHOOTER_SIZE / 2 + 18);
  } while (safe);
  shooterEnemies.push({
    x: ex, y: ey, hp: 70 + Math.random() * 45, alive: true, fireTimer: Math.random() * 3, type: "shooter"
  });
}

export function spawnBoss(MAP_W, MAP_H, SAFE_ZONES) {
  let ex, ey, safe;
  do {
    ex = Math.random() * (MAP_W - 250) + 125;
    ey = Math.random() * (MAP_H - 250) + 125;
    safe = SAFE_ZONES.some(z => Math.hypot(ex - z.x, ey - z.y) < z.r + BOSS_SIZE / 2 + 28);
  } while (safe);
  boss = {
    x: ex, y: ey, hp: BOSS_SPAWN_HP, alive: true, type: "boss",
    dmgReduce: 0.20 // redução de dano tomada
  };
}
