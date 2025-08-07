// enemy.js
export const ENEMY_SIZE   = 38;
export const SHOOTER_SIZE = 38;
export const BOSS_SIZE    = 78;

export const ENEMY_SPEED   = 2.0;
export const SHOOTER_SPEED = 1.6;
export const BOSS_SPEED    = 1.2;

export const ENEMY_DPS_CONTACT   = 12;  // dano por segundo em contato
export const SHOOTER_DPS_CONTACT = 8;
export const BOSS_DPS_CONTACT    = 65;

export const SHOOTER_BULLET_DMG   = 30;
export const SHOOTER_BULLET_SPEED = 9;
export const SHOOTER_FIRE_RATE    = 3.0; // tiros / s (1/t = intervalo)

export const ENEMY_XP_KILL   = 20;
export const SHOOTER_XP_KILL = 35;
export const BOSS_XP_KILL    = 1200;

export const ENEMY_SCORE   = 15;
export const SHOOTER_SCORE = 25;
export const BOSS_SCORE    = 1500;

export let enemies = [];         // {x,y,hp,alive,type:"normal"}
export let shooterEnemies = [];  // {x,y,hp,alive,fireTimer,type:"shooter"}
export let shooterBullets = [];  // {x,y,vx,vy,alive,life}
export let boss = null;          // {x,y,hp,alive,type:"boss",dmgReduce}

export const ENEMY_RESPAWN_MS   = 120_000;
export const SHOOTER_RESPAWN_MS = 100_000;
export const BOSS_SPAWN_HP      = 6000; // vida inicial do boss

export function spawnEnemy(MAP_W, MAP_H, SAFE_ZONES) {
  let ex, ey, safe;
  do {
    ex = Math.random() * (MAP_W - 160) + 80;
    ey = Math.random() * (MAP_H - 160) + 80;
    safe = SAFE_ZONES.some(z => Math.hypot(ex - z.x, ey - z.y) < z.r + ENEMY_SIZE / 2 + 8);
  } while (safe);
  enemies.push({ x: ex, y: ey, hp: 100 + Math.random() * 60, alive: true, type: "normal" });
}

export function spawnShooter(MAP_W, MAP_H, SAFE_ZONES) {
  let ex, ey, safe;
  do {
    ex = Math.random() * (MAP_W - 180) + 90;
    ey = Math.random() * (MAP_H - 180) + 90;
    safe = SAFE_ZONES.some(z => Math.hypot(ex - z.x, ey - z.y) < z.r + SHOOTER_SIZE / 2 + 18);
  } while (safe);
  shooterEnemies.push({
    x: ex, y: ey, hp: 140 + Math.random() * 70, alive: true, fireTimer: Math.random() * 0.8, type: "shooter"
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
