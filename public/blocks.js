export const blocks = [];

export const BLOCK_TYPES = {
  yellow: { color:"#f1c40f", size:40, hp: 70, dmg: 6, slow: 0.30, xp: 10, levelMin:1,  levelMax:10 },
  blue:   { color:"#3498db", size:50, hp:110, dmg: 9, slow: 0.40, xp: 20, levelMin:10, levelMax:30 },
  purple: { color:"#9b59b6", size:60, hp:160, dmg:12, slow: 0.50, xp: 30, levelMin:15, levelMax:60 }
};

function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

function rollBlockLevel(typeInfo){
  const lvl = randInt(typeInfo.levelMin, typeInfo.levelMax);
  // XP por nível: +15% por nível (acumula sobre o base xp)
  const xpReward = Math.round(typeInfo.xp * (1 + 0.15 * (lvl - 1)));
  // DR por nível: +10% por nível; lv 40–60 +30% adicional; clamp a 95%
  let dr = Math.max(0, 0.10 * (lvl - 1));
  if (lvl >= 40) dr += 0.30;
  dr = Math.min(0.95, dr);
  return { level:lvl, xpReward, dmgReduce: dr };
}

export function spawnBlock(type, mapW, mapH, safeZones) {
  const t = BLOCK_TYPES[type]; if (!t) return;
  const scaling = rollBlockLevel(t);

  let tries=0;
  while (tries++<40) {
    const x = Math.random()*mapW, y = Math.random()*mapH;
    const safe = !safeZones.some(z => Math.hypot(x - z.x, y - z.y) < z.r + t.size);
    if (safe) {
      blocks.push({
        x, y,
        hp: t.hp,
        type,
        alive:true,
        level: scaling.level,
        xpReward: scaling.xpReward,
        dmgReduce: scaling.dmgReduce
      });
      return;
    }
  }
}

export function drawBlocks(ctx, cam) {
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type]; if (!t) continue;
    const sx = Math.floor(b.x - cam.x), sy = Math.floor(b.y - cam.y);

    // bloco
    ctx.fillStyle = t.color;
    ctx.fillRect(sx - t.size/2, sy - t.size/2, t.size, t.size);

    // nível (pequeno texto acima)
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Lv ${b.level||1}`, sx, sy - t.size/2 - 6);
  }
}
