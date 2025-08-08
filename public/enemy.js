import { player } from "./player.js";
import { spawnProjectile } from "./projectiles.js";

export const enemies = [];

function randomPosOutsideSafe(mapW, mapH, safeZones, extra = 50) {
  let pos, inSafe;
  do {
    pos = { x: Math.random() * mapW, y: Math.random() * mapH };
    inSafe = safeZones.some(s => Math.hypot(pos.x - s.x, pos.y - s.y) < s.r + extra);
  } while (inSafe);
  return pos;
}

export function spawnEnemy(type, mapW, mapH, safeZones) {
  const pos = randomPosOutsideSafe(mapW, mapH, safeZones, 80);
  const enemy = {
    x: pos.x, y: pos.y,
    type,
    radius: type === "boss" ? 50 : 25,
    color:  type === "boss" ? "#ff0000" : (type === "orange" ? "#ff8000" : "#ff4444"),
    maxHp:  type === "boss" ? 2000 : (type === "orange" ? 200 : 100),
    hp:     type === "boss" ? 2000 : (type === "orange" ? 200 : 100),
    speed:  type === "boss" ? 1.5  : (type === "orange" ? 2.2 : 2.5),
    dmg:    type === "boss" ? 40   : (type === "orange" ? 15 : 10),
    alive: true,
    // Boss state
    phase: 1,
    cooldown1: 0,
    cooldown2: 0,
    dmgReduction: 0
  };
  enemies.push(enemy);
  return enemy;
}

export function spawnBoss(mapW, mapH, safeZones) {
  return spawnEnemy("boss", mapW, mapH, safeZones);
}

export function updateEnemies(dt, safeZones) {
  for (const e of enemies) {
    if (!e.alive) continue;

    // Fases do boss
    if (e.type === "boss") {
      if (e.hp <= e.maxHp * 0.6 && e.phase < 2) e.phase = 2;
      if (e.hp <= e.maxHp * 0.4 && e.phase < 3) {
        e.phase = 3;
        e.speed *= 1.3;
        e.dmgReduction = 0.5;
      }
    }

    // IA: só persegue se player NÃO estiver em safe zone
    const inSafe = safeZones.some(s => Math.hypot(player.x - s.x, player.y - s.y) < s.r);
    const distP = Math.hypot(player.x - e.x, player.y - e.y);

    if (!inSafe && distP < (e.type === "boss" ? 1000 : (e.type === "orange" ? 800 : 650))) {
      const d = Math.max(1, distP);
      e.x += ((player.x - e.x) / d) * e.speed * 60 * dt;
      e.y += ((player.y - e.y) / d) * e.speed * 60 * dt;
    }

    // Contato (dano simples + body damage do jogador)
    if (distP < (player.radius || 28) + e.radius) {
      player.hp -= e.dmg * dt;
      e.hp -= Math.max(1, player.bodyDmg || 0) * dt;
      if (e.hp <= 0) e.alive = false;
    }

    // Skills do boss
    if (e.type === "boss") {
      e.cooldown1 -= dt;
      e.cooldown2 -= dt;

      // respeita intervalo mínimo entre skills: nunca as duas “ao mesmo tempo”
      const canCastSkill1 = e.cooldown1 <= 0 && distP < 900;
      const canCastSkill2 = e.phase >= 2 && e.cooldown2 <= 0 && distP < 900;

      if (canCastSkill1 && (!canCastSkill2 || Math.random() < 0.6)) {
        // Skill 1: projétil que prende 1.5s (trap) — CD 6s (ou 3s na fase 3)
        spawnProjectile(e.x, e.y, player.x, player.y, 200, 0, "trap");
        e.cooldown1 = (e.phase >= 3) ? 3 : 6;
        // trava 1.5s antes da próxima skill
        e.cooldown2 = Math.max(e.cooldown2, 1.5);
      } else if (canCastSkill2) {
        // Skill 2: projétil que cria círculo (HP 250, -50% spd, -25% def) — CD 5s
        spawnProjectile(e.x, e.y, player.x, player.y, 150, 0, "circle");
        e.cooldown2 = 5;
        e.cooldown1 = Math.max(e.cooldown1, 1.5);
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

    const w = e.radius * 2;
    const hpPct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "#000";
    ctx.fillRect(e.x - cam.x - w/2, e.y - cam.y - e.radius - 10, w, 5);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(e.x - cam.x - w/2, e.y - cam.y - e.radius - 10, w * hpPct, 5);
  }
}
