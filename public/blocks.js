export const blocks = [];
export const BLOCK_TYPES = {
  yellow: { size: 40, color: "#ff0", xp: 20, dmg: 10, slow: 0.1 },
  blue:   { size: 50, color: "#0ff", xp: 30, dmg: 15, slow: 0.15 },
  purple: { size: 60, color: "#f0f", xp: 50, dmg: 20, slow: 0.2 }
};

export function spawnBlock(type, mapW, mapH, safeZones) {
  let b = {
    type,
    x: Math.random() * mapW,
    y: Math.random() * mapH,
    hp: (BLOCK_TYPES[type].size || 40) * 5,
    alive: true
  };
  if (safeZones.some(z => Math.hypot(z.x - b.x, z.y - b.y) < z.r + 80)) {
    b.x += 200; b.y += 200;
  }
  blocks.push(b);
}

export function updateBlocks(dt, player) {
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type];
    const dist = Math.hypot(player.x - b.x, player.y - b.y);

    // Body damage
    if (dist < player.radius + t.size / 2) {
      b.hp -= player.bodyDmg * dt;
      player.hp -= t.dmg * dt;
      if (b.hp <= 0) b.alive = false;
    }

    // Tiros
    for (const p of player.shots || []) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) < t.size / 2 + p.radius) {
        b.hp -= p.dmg;
        p.alive = false;
        if (b.hp <= 0) b.alive = false;
      }
    }
  }
}

export function drawBlocks(ctx, cam) {
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type];
    ctx.fillStyle = t.color;
    ctx.fillRect(b.x - cam.x - t.size/2, b.y - cam.y - t.size/2, t.size, t.size);
  }
}
