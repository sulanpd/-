import { player, getPlayerDefPercent } from "./player.js";

export const enemies = [];
export const shooterBullets = [];   // projéteis dos laranjas
export const bossProjectiles = [];  // projéteis do boss (skills)

const ENEMY_DETECT = { basic:650, orange:800, boss:1000 };

const BASES = {
  basic:  { hp:160, dmg:10, xp:20,  radius:26, color:"#f35555",  speed:2.6 },
  orange: { hp:210, dmg:14, xp:40,  radius:26, color:"#ff9c40",  speed:2.2 },
  boss:   { hp:2800,dmg:55, xp:250, radius:60, color:"#b1002a",  speed:1.8 }
};

function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
function combineDR(a,b){ return 1 - (1-a)*(1-b); } // composição de reduções

function randomPosOutsideSafe(mapW, mapH, safeZones, pad=80){
  let p, ok=false;
  for (let i=0;i<50 && !ok;i++){
    p = { x: Math.random()*mapW, y: Math.random()*mapH };
    ok = !safeZones.some(s => Math.hypot(p.x-s.x, p.y-s.y) < s.r + pad);
  }
  return p || { x: mapW*0.5, y: mapH*0.5 };
}

function randomLevelForType(type){
  if (type==="basic")  return randInt(1,10);
  if (type==="orange") return randInt(9,30);
  return randInt(10,60); // boss
}

function scaleByLevel(type, level){
  const b = BASES[type];
  const lvl = Math.max(1, level|0);
  const hp  = Math.round(b.hp  * (1 + 0.10*(lvl-1)));
  const dmg = Math.round(b.dmg * (1 + 0.05*(lvl-1)));
  const xp  = Math.round(b.xp  * (1 + 0.10*(lvl-1)));
  const levelDR = Math.min(0.9, Math.floor((lvl-1)/10) * 0.15); // 0.15 por 10 níveis
  return { hp, dmg, xp, levelDR, lvl };
}

export function spawnEnemy(type, mapW, mapH, safeZones, level=null) {
  const pos = randomPosOutsideSafe(mapW, mapH, safeZones, 80);
  const b = BASES[type];
  const lv = level ?? randomLevelForType(type);
  const sc = scaleByLevel(type, lv);

  const e = {
    x: pos.x, y: pos.y,
    type, level: sc.lvl,
    radius: b.radius,
    color:  b.color,
    maxHp:  sc.hp,
    hp:     sc.hp,
    speed:  b.speed,
    baseDmg: b.dmg,
    dmg:    sc.dmg,
    xpReward: sc.xp,
    alive: true,
    // reduções
    levelDR: sc.levelDR,
    phaseDR: 0,
    dmgReduce: sc.levelDR, // combinado (level + fase)
    // boss state
    phase:1, s1cd:0, s2cd:0, lastSkillCd:0,
    // shooters
    shootCd:0
  };
  enemies.push(e);
  return e;
}

export function spawnBoss(mapW, mapH, safeZones, level=null){
  return spawnEnemy("boss", mapW, mapH, safeZones, level);
}

export function updateEnemies(dt, safeZones) {
  for (const e of enemies) {
    if (!e.alive) continue;

    // Fases do boss
    if (e.type==="boss") {
      if (e.hp <= e.maxHp*0.6 && e.phase < 2) e.phase = 2;
      if (e.hp <= e.maxHp*0.4 && e.phase < 3) {
        e.phase = 3;
        e.phaseDR = 0.5; // DR extra na fase 3
        e.dmgReduce = combineDR(e.levelDR, e.phaseDR);
        e.s1cd = Math.min(e.s1cd, 3);
        e.speed *= 1.3;
      }
    }

    const inSafe = safeZones.some(s => Math.hypot(player.x - s.x, player.y - s.y) < s.r);
    const dist   = Math.hypot(e.x - player.x, e.y - player.y);
    const detect = ENEMY_DETECT[e.type] || 650;

    // Movimento
    if (!inSafe && dist < detect) {
      const d = Math.max(1, dist);
      e.x += (player.x - e.x)/d * e.speed * 60 * dt;
      e.y += (player.y - e.y)/d * e.speed * 60 * dt;
    }

    // Shooters (laranja) disparam projéteis
    if (e.type==="orange" && !inSafe && dist < 700) {
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = 1.2;
        const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx,dy)||1;
        const bulletDmg = Math.round(10 + e.dmg*0.4); // dano dos tiros escala com o inimigo
        shooterBullets.push({ x:e.x, y:e.y, vx:(dx/d)*13, vy:(dy/d)*13, life:2.2, alive:true, dmg: bulletDmg });
      }
    }

    // Skills do boss
    if (e.type==="boss" && !inSafe) {
      e.s1cd -= dt; e.s2cd -= dt; e.lastSkillCd -= dt;
      if (e.lastSkillCd <= 0) {
        const wantS1 = e.s1cd <= 0;
        const wantS2 = e.phase>=2 && e.s2cd <= 0;
        if (wantS1 && (!wantS2 || Math.random()<0.6)) {
          // Skill 1: trap 1.5s
          const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy)||1;
          bossProjectiles.push({ x:e.x, y:e.y, vx:(dx/d)*10, vy:(dy/d)*10, life:2.5, alive:true, type:"trap" });
          e.s1cd = (e.phase>=3) ? 3 : 6;
          e.lastSkillCd = 1.5;
        } else if (wantS2) {
          // Skill 2: círculo (debuff)
          const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy)||1;
          bossProjectiles.push({ x:e.x, y:e.y, vx:(dx/d)*8, vy:(dy/d)*8, life:2.8, alive:true, type:"circle" });
          e.s2cd = 5;
          e.lastSkillCd = 1.5;
        }
      }
    }
  }

  // Balas dos laranjas → player
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

  // Projéteis do boss → player (aplica efeitos)
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
        player.circleTimer = 4; // 4s de debuff
      }
      p.alive=false;
    }
  }

  // Decaimento do debuff de círculo
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
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx = Math.floor(e.x - cam.x), sy = Math.floor(e.y - cam.y);
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI*2); ctx.fill();

    // HP bar
    const w = e.radius*2, pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle="#000"; ctx.fillRect(sx - w/2, sy - e.radius - 16, w, 6);
    ctx.fillStyle="#2ecc71"; ctx.fillRect(sx - w/2, sy - e.radius - 16, w*pct, 6);

    // Nível (texto)
    ctx.fillStyle="#fff";
    ctx.font="12px sans-serif";
    ctx.textAlign="center";
    ctx.fillText(`Lv ${e.level}`, sx, sy - e.radius - 22);
  }

  // balas dos laranjas
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
