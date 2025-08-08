/* ========================================================================
 * blocks.js
 * Blocos com níveis, XP e redução de dano por nível (DR).
 * ===================================================================== */
import { randInt } from "./utils.js";

export const blocks = [];

/** Definição base de cada tipo de bloco. */
export const BLOCK_TYPES = {
  yellow: { color:"#f1c40f", size:40, hp: 70, dmg: 6, slow: 0.30, xp: 10, levelMin:1,  levelMax:10 },
  blue:   { color:"#3498db", size:50, hp:110, dmg: 9, slow: 0.40, xp: 20, levelMin:10, levelMax:30 },
  purple: { color:"#9b59b6", size:60, hp:160, dmg:12, slow: 0.50, xp: 30, levelMin:15, levelMax:60 }
};

/** Rola o nível do bloco e calcula XP e DR conforme regras. */
function rollBlockLevel(t) {
  const lvl = randInt(t.levelMin, t.levelMax);
  const xpReward = Math.round(t.xp * (1 + 0.15 * (lvl - 1))); // +15% XP / nível
  // DR base +10% por nível; níveis 40–60 ganham +30% adicional; clamp a 95% no total
  let dr = Math.max(0, 0.10 * (lvl - 1));
  if (lvl >= 40) dr += 0.30;
  dr = Math.min(0.95, dr);
  return { level: lvl, xpReward, dmgReduce: dr };
}

/** Spawna bloco fora das safe zones. */
export function spawnBlock(type, mapW, mapH, safeZones) {
  const t = BLOCK_TYPES[type]; if (!t) return;
  const roll = rollBlockLevel(t);

  for (let i=0; i<40; i++) {
    const x = Math.random() * mapW, y = Math.random() * mapH;
    const safe = !safeZones.some(z => Math.hypot(x - z.x, y - z.y) < z.r + t.size);
    if (safe) {
      blocks.push({
        x, y,
        hp: t.hp,
        type,
        alive: true,
        level: roll.level,
        xpReward: roll.xpReward,
        dmgReduce: roll.dmgReduce
      });
      return;
    }
  }
}

/** Desenho simples dos blocos + nível. */
export function drawBlocks(ctx, cam) {
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type]; if (!t) continue;
    const sx = Math.floor(b.x - cam.x), sy = Math.floor(b.y - cam.y);

    // quadrado do bloco
    ctx.fillStyle = t.color;
    ctx.fillRect(sx - t.size/2, sy - t.size/2, t.size, t.size);

    // nível renderizado acima
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Lv ${b.level||1}`, sx, sy - t.size/2 - 6);
  }
}