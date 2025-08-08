import { player, getPlayerBonusXP } from "./player.js";

export const blocks = [];

export const BLOCK_TYPES = {
  yellow: { color: "#f1c40f", size: 40, hp: 50, dmg: 5, slow: 0.3, xp: 10 },
  blue:   { color: "#3498db", size: 50, hp: 80, dmg: 8, slow: 0.4, xp: 20 },
  purple: { color: "#9b59b6", size: 60, hp: 120, dmg: 12, slow: 0.5, xp: 30 }
};

export function spawnBlock(type, mapW, mapH, safeZones) {
  const t = BLOCK_TYPES[type];
  if (!t) return;

  let pos;
  let inSafe;
  do {
    pos = { x: Math.random() * mapW, y: Math.random() * mapH };
    inSafe = safeZones.some(s => Math.hypot(pos.x - s.x, pos.y - s.y) < s.r + t.size);
  } while (inSafe);

  blocks.push({
    type,
    x: pos.x,
    y: pos.y,
    hp: t.hp,
    alive: true
  });
}

export function updateBlocks(dt) {
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type];
    if (!t) continue;

    // Dano por contato (Body Damage)
    const dx = b.x - player.x;
    const dy = b.y - player.y;
    const dist = Math.hypot(dx, dy);
    const overlap = (t.size / 2 + player.radius) - dist;

    if (overlap > 0) {
      b.hp -= Math.max(1, player.bodyDmg || 0) * dt * 10;
      if (b.hp <= 0) {
        b.alive = false;
        const baseXP = t.xp || 0;
        const gained = getPlayerBonusXP(baseXP);
        player.xp += gained;
      }
    }
  }
}

export function damageBlockByProjectile(block, damage) {
  if (!block.alive) return;
  block.hp -= damage;
  if (block.hp <= 0) {
    block.alive = false;
    const t = BLOCK_TYPES[block.type];
    if (t) {
      const baseXP = t.xp || 0;
      const gained = getPlayerBonusXP(baseXP);
      player.xp += gained;
    }
  }
}

export function drawBlocks(ctx, cam) {
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type];
    if (!t) continue;
    ctx.fillStyle = t.color;
    ctx.fillRect(
      b.x - cam.x - t.size / 2,
      b.y - cam.y - t.size / 2,
      t.size,
      t.size
    );
  }
}
