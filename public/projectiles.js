import { player } from "./player.js";

export const projectiles = [];
export const circles = []; // círculos da skill 2 do boss

export function spawnProjectile(sx, sy, tx, ty, speed, dmg, type = "normal") {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.max(1, Math.hypot(dx, dy));
  projectiles.push({
    x: sx,
    y: sy,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    radius: type === "circle" ? 14 : 6,
    dmg,
    type,
    alive: true,
    ttl: 5 // tempo de vida em segundos
  });
}

export function updateProjectiles(dt) {
  for (const p of projectiles) {
    if (!p.alive) continue;

    p.x += p.vx * 60 * dt;
    p.y += p.vy * 60 * dt;
    p.ttl -= dt;

    // Colisão com player
    const dist = Math.hypot(p.x - player.x, p.y - player.y);
    if (dist < (player.radius || 28) + p.radius) {
      if (p.type === "trap") {
        player.trapped = 1.5; // 1.5s preso
      } else if (p.type === "circle") {
        circles.push({
          x: player.x,
          y: player.y,
          r: 100,
          hp: 250,
          slow: 0.5,
          defReduce: 0.25
        });
      } else {
        player.hp -= p.dmg;
      }
      p.alive = false;
    }

    if (p.ttl <= 0) p.alive = false;
  }
}

export function updateCircles(dt) {
  for (let i = circles.length - 1; i >= 0; i--) {
    const c = circles[i];
    const dist = Math.hypot(c.x - player.x, c.y - player.y);
    if (dist < c.r) {
      player.speed *= 1 - c.slow;
      player.defBonus = -(c.defReduce);
    }

    // Se o círculo perder HP, remove
    if (c.hp <= 0) {
      circles.splice(i, 1);
    }
  }
}

export function drawProjectiles(ctx, cam) {
  ctx.fillStyle = "#ff0";
  for (const p of projectiles) {
    if (!p.alive) continue;
    ctx.beginPath();
    ctx.arc(Math.floor(p.x - cam.x), Math.floor(p.y - cam.y), p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCircles(ctx, cam) {
  ctx.strokeStyle = "rgba(0,255,255,0.5)";
  ctx.lineWidth = 3;
  for (const c of circles) {
    ctx.beginPath();
    ctx.arc(Math.floor(c.x - cam.x), Math.floor(c.y - cam.y), c.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}
