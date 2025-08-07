// enemy.js
export let enemies = [];
export let shooterEnemies = [];
export let shooterBullets = [];
export let boss = null;
export const ENEMY_SIZE = 38;
export const SHOOTER_SIZE = 38;
export const BOSS_SIZE = 78;
export const ENEMY_RESPAWN_MS = 120000;
export const SHOOTER_RESPAWN_MS = 100000;

export function spawnEnemy(MAP_W, MAP_H, SAFE_ZONES) {
    let ex, ey, safe;
    do {
        ex = Math.random() * (MAP_W-160) + 80;
        ey = Math.random() * (MAP_H-160) + 80;
        safe = SAFE_ZONES.some(z => Math.hypot(ex-z.x,ey-z.y) < z.r+ENEMY_SIZE/2+8);
    } while (safe);
    enemies.push({x: ex, y: ey, hp: 42+Math.random()*60, alive: true, respawnTime: null, type: "normal"});
}

// Crie funções semelhantes para shooterEnemies, boss, update e draw
// (A lógica é idêntica à que já tem, só organize tudo aqui!)
// Exporte todas as funções que forem necessárias para update/draw dos inimigos.
