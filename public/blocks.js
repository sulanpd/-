/* ========================================================================
 * blocks.js
 * Blocos com níveis, XP e redução de dano por nível (DR).
 * Exibem barra de HP quando forem ATINGIDOS recentemente.
 * ===================================================================== */
import { randInt } from "./utils.js";
export const blocks = [];

export const BLOCK_TYPES = {
  yellow: { color:"#f1c40f", size:40, hp: 70, dmg: 6, slow: 0.30, xp: 9999, levelMin:1,  levelMax:10 },
  blue:   { color:"#3498db", size:50, hp:110, dmg: 9, slow: 0.40, xp: 9999, levelMin:10, levelMax:30 },
  purple: { color:"#9b59b6", size:60, hp:160, dmg:12, slow: 0.50, xp: 30, levelMin:15, levelMax:60 }
};

function rollBlockLevel(t) {
  const lvl = randInt(t.levelMin, t.levelMax);
  const xpReward = Math.round(t.xp * (1 + 0.15 * (lvl - 1)));
  let dr = Math.max(0, 0.10 * (lvl - 1));
  if (lvl >= 40) dr += 0.30;
  dr = Math.min(0.95, dr);
  return { level: lvl, xpReward, dmgReduce: dr };
}

export function spawnBlock(type, mapW, mapH, safeZones) {
  const t = BLOCK_TYPES[type]; if (!t) return;
  const roll = rollBlockLevel(t);
  for (let i=0; i<40; i++) {
    const x = Math.random()*mapW, y = Math.random()*mapH;
    const safe = !safeZones.some(z => Math.hypot(x - z.x, y - z.y) < z.r + t.size);
    if (safe) {
      blocks.push({
        x, y, hp: t.hp, maxHp: t.hp, type, alive:true,
        level: roll.level, xpReward: roll.xpReward, dmgReduce: roll.dmgReduce,
        recentHitTimer: 0
      });
      return;
    }
  }
}

export function updateBlocksHitTimers(dt) {
  for (const b of blocks) {
    if (!b.alive) continue;
    if (b.recentHitTimer > 0) {
      b.recentHitTimer -= dt;
      if (b.recentHitTimer < 0) b.recentHitTimer = 0;
    }
  }
}

export function drawBlocks(ctx, cam) {
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type]; if (!t) continue;
    const sx = Math.floor(b.x - cam.x), sy = Math.floor(b.y - cam.y);

    ctx.fillStyle = t.color;
    ctx.fillRect(sx - t.size/2, sy - t.size/2, t.size, t.size);

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Lv ${b.level||1}`, sx, sy - t.size/2 - 6);

    if (b.recentHitTimer > 0 && b.maxHp > 0) {
      const w = t.size, h = 6;
      const pct = Math.max(0, Math.min(1, b.hp / b.maxHp));
      const barY = sy - t.size/2 - 16;
      ctx.fillStyle = "#000"; ctx.fillRect(sx - w/2, barY, w, h);
      ctx.fillStyle = "#2ecc71"; ctx.fillRect(sx - w/2, barY, w * pct, h);
      ctx.strokeStyle = "#111"; ctx.strokeRect(sx - w/2, barY, w, h);
    }
  }
}
