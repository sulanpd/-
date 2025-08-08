import { player, getPlayerDefPercent } from "./player.js";

export const enemies = [];
export const shooterBullets = [];  // projéteis dos laranjas
export const bossProjectiles = []; // projéteis das skills do boss

const ENEMY_DETECT = { basic:650, orange:800, boss:1000 };

function randomPosOutsideSafe(mapW, mapH, safeZones, pad=80){
  let p, ok=false;
  for (let i=0;i<40 && !ok;i++){
    p = { x: Math.random()*mapW, y: Math.random()*mapH };
    ok = !safeZones.some(s => Math.hypot(p.x-s.x, p.y-s.y) < s.r + pad);
  }
  return p || { x: mapW*0.5, y: mapH*0.5 };
}

export function spawnEnemy(type, mapW, mapH, safeZones) {
  const isBoss = type === "boss";
  const p = randomPosOutsideSafe(mapW, mapH, safeZones);
  const e = {
    x:p.x, y:p.y, type,
    radius: isBoss ? 60 : 26,
    color:  isBoss ? "#b1002a" : (type==="orange" ? "#ff9c40" : "#f35555"),
    maxHp:  isBoss ? 2800 : (type==="orange" ? 210 : 160),
    hp:     isBoss ? 2800 : (type==="orange" ? 210 : 160),
    speed:  isBoss ? 1.8  : (type==="orange" ? 2.2 : 2.6),
    dmg:    isBoss ? 55   : (type==="orange" ? 14 : 10),
    alive:true,
    // boss state
    phase:1, dmgReduce:0, s1cd:0, s2cd:0, lastSkillCd:0
  };
  enemies.push(e);
  return e;
}

export function spawnBoss(mapW, mapH, safeZones){ return spawnEnemy("boss", mapW, mapH, safeZones); }

export function updateEnemies(dt, safeZones) {
  // mover inimigos
  for (const e of enemies) {
    if (!e.alive) continue;

    // fases do boss
    if (e.type==="boss") {
      if (e.hp <= e.maxHp*0.6 && e.phase < 2) e.phase = 2;
      if (e.hp <= e.maxHp*0.4 && e.phase < 3) { e.phase = 3; e.dmgReduce = 0.5; e.s1cd = Math.min(e.s1cd, 3); e.speed *= 1.3; }
    }

    const inSafe = safeZones.some(s => Math.hypot(player.x - s.x, player.y - s.y) < s.r);
    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    const detect = e.type==="boss" ? ENEMY_DETECT.boss : (e.type==="orange" ? ENEMY_DETECT.orange : ENEMY_DETECT.basic);

    if (!inSafe && dist < detect) {
      const d = Math.max(1, dist);
      e.x += (player.x - e.x)/d * e.speed * 60 * dt;
      e.y += (player.y - e.y)/d * e.speed * 60 * dt;
    }

    // laranjas atiram
    if (e.type==="orange" && !inSafe && dist < 700) {
      e.shootCd = (e.shootCd || 0) - dt;
      if (e.shootCd <= 0) {
        e.shootCd = 1.2;
        const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx,dy)||1;
        shooterBullets.push({ x:e.x, y:e.y, vx:(dx/d)*13, vy:(dy/d)*13, life:2.2, alive:true, dmg:16 });
      }
    }

    // skills do boss
    if (e.type==="boss" && !inSafe) {
      e.s1cd -= dt; e.s2cd -= dt; e.lastSkillCd -= dt;
      if (e.lastSkillCd <= 0) {
        const wantS1 = e.s1cd <= 0;
        const wantS2 = e.phase>=2 && e.s2cd <= 0;
        if (wantS1 && (!wantS2 || Math.random()<0.6)) {
          const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy)||1;
          bossProjectiles.push({ x:e.x, y:e.y, vx:(dx/d)*10, vy:(dy/d)*10, life:2.5, alive:true, type:"trap" });
          e.s1cd = (e.phase>=3) ? 3 : 6;
          e.lastSkillCd = 1.5;
        } else if (wantS2) {
          const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy)||1;
          bossProjectiles.push({ x:e.x, y:e.y, vx:(dx/d)*8, vy:(dy/d)*8, life:2.8, alive:true, type:"circle" });
          e.s2cd = 5;
          e.lastSkillCd = 1.5;
        }
      }
    }
  }

  // atualizar projéteis dos laranjas (colisão com player)
  for (const b of shooterBullets) {
    if (!b.alive) continue;
    b.x += b.vx * 60 * dt; b.y += b.vy * 60 * dt; b.life -= dt;
    if (b.life <= 0) { b.alive=false; continue; }
    const dist = Math.hypot(b.x - player.x, b.y - player.y);
    if (dist < (player.radius||28) + 6) {
      const def = getPlayerDefPercent();
      player.hp -= b.dmg * (1 - def);
      b.alive = false;
    }
  }

  // atualizar projéteis do boss + aplicar efeitos no player
  for (const p of bossProjectiles) {
    if (!p.alive) continue;
    p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt; p.life -= dt;
    if (p.life <= 0) { p.alive=false; continue; }
    const dist = Math.hypot(p.x - player.x, p.y - player.y);
    const rad = p.type==="circle" ? 14 : 8;
    if (dist < (player.radius||28) + rad) {
      if (p.type==="trap") {
        player.freezeTimer = Math.max(player.freezeTimer, 1.5);
      } else if (p.type==="circle") {
        player.defDebuff = Math.max(player.defDebuff, 0.25);
        player.slowMult = Math.min(player.slowMult, 0.5);
        // efeito dura 4s
        player.circleTimer = 4;
      }
      p.alive=false;
    }
  }

  // timer de círculo ativo no player
  if (player.circleTimer !== undefined) {
    player.circleTimer -= dt;
    if (player.circleTimer <= 0) {
      player.circleTimer = 0;
      player.defDebuff = 0;
      player.slowMult = 1;
    }
  }
}

export function drawEnemies(ctx, cam) {
  // inimigos
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx = Math.floor(e.x - cam.x), sy = Math.floor(e.y - cam.y);
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI*2); ctx.fill();
    // HP bar
    const w = e.radius*2, pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle="#000"; ctx.fillRect(sx - w/2, sy - e.radius - 10, w, 6);
    ctx.fillStyle="#2ecc71"; ctx.fillRect(sx - w/2, sy - e.radius - 10, w*pct, 6);
  }

  // balas laranjas
  ctx.fillStyle="#ffffff";
  for (const b of shooterBullets) {
    if (!b.alive) continue;
    const sx=Math.floor(b.x-cam.x), sy=Math.floor(b.y-cam.y);
    ctx.beginPath(); ctx.arc(sx,sy,6,0,Math.PI*2); ctx.fill();
  }

  // projéteis do boss
  for (const p of bossProjectiles) {
    if (!p.alive) continue;
    const sx=Math.floor(p.x-cam.x), sy=Math.floor(p.y-cam.y);
    ctx.beginPath();
    ctx.fillStyle = p.type==="circle" ? "#00e0ff" : "#ff0066";
    ctx.arc(sx,sy,p.type==="circle"?14:8,0,Math.PI*2); ctx.fill();
  }
}
