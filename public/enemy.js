import { spawnProjectile } from "./projectiles.js";
import { clamp } from "./utils.js";

export const enemies = [];

export function spawnEnemies(level, safeZones) {
  const numEnemies = Math.floor(level * 2);
  for (let i = 0; i < numEnemies; i++) {
    const type = (level >= 15 && Math.random() < 0.3) ? "orange" : "basic";
    spawnEnemy(type, safeZones);
  }
  if (level >= 45 && !enemies.find(e => e.type === "boss")) {
    spawnEnemy("boss", safeZones);
  }
}

function spawnEnemy(type, safeZones) {
  let e = {
    type,
    x: Math.random() * 3000,
    y: Math.random() * 3000,
    radius: type === "boss" ? 80 : 28,
    speed: type === "boss" ? 2 : 1.8,
    hp: type === "boss" ? 3000 : 200,
    maxHp: type === "boss" ? 3000 : 200,
    dmg: type === "boss" ? 60 : 20,
    alive: true,
    skill1CD: 0,
    skill2CD: 0,
    phase: 1
  };
  if (safeZones.some(z => Math.hypot(z.x - e.x, z.y - e.y) < z.r + 100)) {
    e.x += 300; e.y += 300;
  }
  enemies.push(e);
}

export function updateEnemies(dt, player, safeZones) {
  for (const e of enemies) {
    if (!e.alive) continue;

    // Boss fases
    if (e.type === "boss") {
      if (e.hp <= e.maxHp * 0.6 && e.phase === 1) {
        e.phase = 2;
      }
      if (e.hp <= e.maxHp * 0.4 && e.phase === 2) {
        e.phase = 3;
        e.speed *= 1.3;
      }
    }

    // Distância do player e safe zones
    const distP = Math.hypot(player.x - e.x, player.y - e.y);
    const inSafe = safeZones.some(z => Math.hypot(z.x - player.x, z.y - player.y) < z.r);

    if (distP < 600 && !inSafe) {
      const dx = (player.x - e.x) / distP;
      const dy = (player.y - e.y) / distP;
      e.x += dx * e.speed * 60 * dt;
      e.y += dy * e.speed * 60 * dt;
    }

    // Colisão com player
    if (distP < player.radius + e.radius) {
      player.hp -= e.dmg * dt * (1 - player.def);
      e.hp -= player.bodyDmg * dt;
      if (e.hp <= 0) e.alive = false;
    }

    // Boss skills
    if (e.type === "boss") {
      e.skill1CD -= dt;
      e.skill2CD -= dt;
      if (e.phase >= 1 && e.skill1CD <= 0 && distP < 500) {
        spawnProjectile(e.x, e.y, player.x, player.y, 9, 0, "trap");
        e.skill1CD = (e.phase >= 3) ? 3 : 6;
      } else if (e.phase >= 2 && e.skill2CD <= 0 && distP < 500) {
        spawnProjectile(e.x, e.y, player.x, player.y, 7, 0, "circle");
        e.skill2CD = 5;
      }
    }
  }
}

export function drawEnemies(ctx, cam) {
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.beginPath();
    ctx.arc(e.x - cam.x, e.y - cam.y, e.radius, 0, Math.PI * 2);
    ctx.fillStyle = e.type === "boss" ? "#f00" : (e.type === "orange" ? "#fa0" : "#0f0");
    ctx.fill();

    // HP bar
    ctx.fillStyle = "#000";
    ctx.fillRect(e.x - cam.x - e.radius, e.y - cam.y - e.radius - 10, e.radius * 2, 6);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(e.x - cam.x - e.radius, e.y - cam.y - e.radius - 10, (e.hp / e.maxHp) * e.radius * 2, 6);
  }
}
