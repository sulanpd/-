import { player } from "./player.js";
import { spawnProjectile } from "./projectiles.js";
import { getSafeZones } from "./game.js";

export const enemies = [];

export function spawnEnemy(type, x, y) {
  const enemy = {
    x, y,
    radius: type === "boss" ? 50 : 25,
    color: type === "orange" ? "#ff8000" : type === "boss" ? "#ff0000" : "#ff4444",
    hp: type === "boss" ? 2000 : type === "orange" ? 200 : 100,
    maxHp: type === "boss" ? 2000 : type === "orange" ? 200 : 100,
    speed: type === "boss" ? 1.5 : type === "orange" ? 2.2 : 2.5,
    dmg: type === "boss" ? 40 : type === "orange" ? 15 : 10,
    alive: true,
    type,
    cooldown1: 0,
    cooldown2: 0,
    phase: 1 // fases do boss
  };
  enemies.push(enemy);
}

export function spawnWave(level, mapW, mapH) {
  const safeZones = getSafeZones();
  for (let i = 0; i < 5; i++) {
    let type = "normal";
    if (level >= 15 && Math.random() < 0.3) type = "orange";
    const pos = randomPosOutsideSafe(mapW, mapH, safeZones);
    spawnEnemy(type, pos.x, pos.y);
  }
  if (level >= 45 && !enemies.find(e => e.type === "boss")) {
    const pos = randomPosOutsideSafe(mapW, mapH, safeZones);
    spawnEnemy("boss", pos.x, pos.y);
  }
}

function randomPosOutsideSafe(mapW, mapH, safeZones) {
  let pos;
  let inSafe;
  do {
    pos = { x: Math.random() * mapW, y: Math.random() * mapH };
    inSafe = safeZones.some(s => Math.hypot(pos.x - s.x, pos.y - s.y) < s.r + 50);
  } while (inSafe);
  return pos;
}

export function updateEnemies(dt) {
  const safeZones = getSafeZones();

  for (const e of enemies) {
    if (!e.alive) continue;

    // Boss fases
    if (e.type === "boss") {
      if (e.hp <= e.maxHp * 0.6 && e.phase < 2) {
        e.phase = 2;
      }
      if (e.hp <= e.maxHp * 0.4 && e.phase < 3) {
        e.phase = 3;
        e.speed *= 1.3;
        e.dmgReduction = 0.5;
      }
    }

    // Movimento e IA
    const distPlayer = Math.hypot(player.x - e.x, player.y - e.y);
    const inSafe = safeZones.some(s => Math.hypot(player.x - s.x, player.y - s.y) < s.r);

    if (!inSafe && distPlayer < 500) {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      e.x += (dx / len) * e.speed * 60 * dt;
      e.y += (dy / len) * e.speed * 60 * dt;
    }

    // Boss skills
    if (e.type === "boss") {
      e.cooldown1 -= dt;
      e.cooldown2 -= dt;

      if (e.phase === 1 && e.cooldown1 <= 0) {
        spawnProjectile(e.x, e.y, player.x, player.y, 200, 0, "trap");
        e.cooldown1 = 6;
      }

      if (e.phase >= 2) {
        if (e.cooldown2 <= 0) {
          spawnProjectile(e.x, e.y, player.x, player.y, 150, 0, "circle");
          e.cooldown2 = 5;
        }
      }

      if (e.phase === 3 && e.cooldown1 <= 0) {
        spawnProjectile(e.x, e.y, player.x, player.y, 200, 0, "trap");
        e.cooldown1 = 3;
      }
    }
  }
}

export function drawEnemies(ctx, cam) {
  for (const e of enemies) {
    if (!e.alive) continue;

    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x - cam.x, e.y - cam.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // Barra de vida
    const w = e.radius * 2;
    const hpPct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "#000";
    ctx.fillRect(e.x - cam.x - w / 2, e.y - cam.y - e.radius - 10, w, 5);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(e.x - cam.x - w / 2, e.y - cam.y - e.radius - 10, w * hpPct, 5);
  }
}
