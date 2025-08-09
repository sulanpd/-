/* ========================================================================
 * enemy.js
 * Inimigos com níveis, IA básica, projéteis dos laranjas e skills simples do boss.
 * Sem dependência do rankSystem.js (evita erros de import).
 * ===================================================================== */
import { player, getPlayerDefPercent } from "./player.js";
import { randInt } from "./utils.js";

export const enemies = [];
export const shooterBullets = [];
export const bossProjectiles = [];

const ENEMY_DETECT = { basic:650, orange:800, boss:1000 };

const BASES = {
  basic:  { hp:160, dmg:10, xp:20,  radius:26, color:"#f35555",  speed:2.6 },
  orange: { hp:210, dmg:14, xp:40,  radius:26, color:"#ff9c40",  speed:2.2 },
  boss:   { hp:2800,dmg:55, xp:250, radius:60, color:"#b1002a",  speed:1.8 }
};

function combineDR(a,b){ return 1 - (1-a)*(1-b); }

function randomPosOutsideSafe(mapW, mapH, safeZones, pad=80){
  let p, ok=false;
  for (let i=0;i<50 && !ok;i++){
    p = { x: Math.random()*mapW, y: Math.random()*mapH };
    ok = !safeZones?.some?.(s => Math.hypot(p.x-s.x, p.y-s.y) < s.r + pad);
  }
  return p || { x: mapW*0.5, y: mapH*0.5 };
}
function randomLevelForType(type){
  if (type==="basic")  return randInt(1,10);
  if (type==="orange") return randInt(5,20);
  return randInt(20,30);
}
function scaleByLevel(type, level){
  const b = BASES[type];
  const lvl = Math.max(1, level|0);
  const hp  = Math.round(b.hp  * (1 + 0.10*(lvl-1)));
  const dmg = Math.round(b.dmg * (1 + 0.05*(lvl-1)));
  const xp  = Math.round(b.xp  * (1 + 0.10*(lvl-1)));
  const levelDR = Math.min(0.9, Math.floor((lvl-1)/10) * 0.15);
  return { hp, dmg, xp, levelDR, lvl };
}

/* ---------- HUD: badge simples para Rank/Boss ---------- */
function drawRankBadge(ctx, x, y, text){
  if (!text) return;
  ctx.save();
  ctx.font = "bold 12px Arial";
  const padX=6;
  const w = Math.floor(ctx.measureText(text).width) + padX*2;
  const h = 18;
  const rx = x - w/2, ry = y - h;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(rx, ry, w, h);
  ctx.strokeStyle = "#6aa3ff";
  ctx.strokeRect(rx, ry, w, h);
  ctx.fillStyle = "#bfe0ff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x - w/2 + padX, ry + h/2);
  ctx.restore();
}

/* ---------- Spawn ---------- */
export function spawnEnemy(type, mapW, mapH, safeZones, level=null) {
  const pos = randomPosOutsideSafe(mapW, mapH, safeZones, 80);
  const b = BASES[type];
  const lv = level ?? randomLevelForType(type);
  const sc = scaleByLevel(type, lv);

  const e = {
    x: pos.x, y: pos.y, type, level: sc.lvl,
    radius: b.radius, color: b.color,
    baseSpeed: b.speed, speed: b.speed,
    maxHp: sc.hp, hp: sc.hp,
    dmg: sc.dmg, xp: sc.xp,
    alive: true,
    // DR por nível + por fase (boss)
    levelDR: sc.levelDR, phaseDR: 0, dmgReduce: sc.levelDR,
    // IA
    aiTimer: 0, dir: {x:0,y:0},
    // Orange shooter
    shootCD: 0,
    // Boss
    phase: 1, s1cd: 4, s2cd: 7, lastSkillCd: 0
  };
  enemies.push(e);
  return e;
}
export function spawnBoss(mapW, mapH, safeZones, level=null){
  const lv = level ?? randomLevelForType("boss");
  return spawnEnemy("boss", mapW, mapH, safeZones, lv);
}

/* ---------- Update ---------- */
export function updateEnemies(dt, safeZones) {
  for (const e of enemies) {
    if (!e.alive) continue;

    // fases do boss
    if (e.type==="boss") {
      if (e.hp <= e.maxHp*0.6 && e.phase < 2) e.phase = 2;
      if (e.hp <= e.maxHp*0.4 && e.phase < 3) {
        e.phase = 3;
        e.phaseDR = 0.5;
        e.dmgReduce = combineDR(e.levelDR, e.phaseDR);
        e.s1cd = Math.min(e.s1cd, 3);
        e.speed *= 1.3;
      }
    }

    // Movimento & IA
    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx,dy) || 1;
    const ndx = dx/dist, ndy = dy/dist;

    if (e.type==="basic") {
      if (dist < ENEMY_DETECT.basic) {
        e.dir.x = ndx; e.dir.y = ndy;
      } else {
        e.dir.x *= 0.9; e.dir.y *= 0.9;
      }
    } else if (e.type==="orange") {
      const desired = 420;
      if (dist < desired) { // afasta
        e.dir.x = -ndx; e.dir.y = -ndy;
      } else {
        e.dir.x = ndx; e.dir.y = ndy;
      }
      e.shootCD -= dt;
      if (dist < ENEMY_DETECT.orange && e.shootCD <= 0) {
        shooterBullets.push({
          x: e.x + ndx*e.radius, y: e.y + ndy*e.radius,
          vx: ndx*10, vy: ndy*10, life: 2.0, dmg: Math.max(8, Math.floor(e.dmg*0.8)),
          alive: true
        });
        e.shootCD = 1.6;
      }
    } else if (e.type==="boss") {
      e.dir.x = ndx; e.dir.y = ndy;
      e.s1cd -= dt; e.s2cd -= dt; e.lastSkillCd -= dt;
      if (e.lastSkillCd <= 0) {
        const wantS1 = e.s1cd <= 0;
        const wantS2 = e.phase>=2 && e.s2cd <= 0;
        if (wantS1 && (!wantS2 || Math.random()<0.6)) {
          bossProjectiles.push({ x:e.x, y:e.y, vx:ndx*10, vy:ndy*10, life:2.5, alive:true, type:"trap" });
          e.s1cd = (e.phase>=3) ? 3 : 6;
          e.lastSkillCd = 1.5;
        } else if (wantS2) {
          bossProjectiles.push({ x:e.x, y:e.y, vx:ndx*8, vy:ndy*8, life:2.8, alive:true, type:"circle" });
          e.s2cd = 5;
          e.lastSkillCd = 1.5;
        }
      }
    }

    // aplica movimento
    e.x += e.dir.x * e.speed * 60 * dt;
    e.y += e.dir.y * e.speed * 60 * dt;

    // contato com o player (dano por toque)
    const touch = (e.radius + (player.radius||28));
    if (dist < touch) {
      const def = getPlayerDefPercent();
      const raw = e.dmg;
      const final = raw * (1 - def) * (1 - (e.dmgReduce||0));
      player.hp -= final;
    }
  }

  // atualiza balas laranja
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

  // projéteis do boss
  for (const p of bossProjectiles) {
    if (!p.alive) continue;
    p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt; p.life -= dt;
    if (p.life <= 0) { p.alive=false; continue; }
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d < (player.radius||28) + (p.type==="circle"?12:8)) {
      const def = getPlayerDefPercent();
      const dmg = p.type==="circle" ? 40 : 25;
      player.hp -= dmg * (1 - def);
      p.alive = false;
    }
  }
}

/* ---------- Draw ---------- */
export function drawEnemies(ctx, cam) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx = Math.floor(e.x - cam.x), sy = Math.floor(e.y - cam.y);

    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI*2); ctx.fill();

    const w = e.radius*2, pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle="#000"; ctx.fillRect(sx - w/2, sy - e.radius - 16, w, 6);
    ctx.fillStyle="#2ecc71"; ctx.fillRect(sx - w/2, sy - e.radius - 16, w*pct, 6);

    let levelColor = "#e0e0e0";
    if (e.type === "basic")   levelColor = "#7ec8ff";
    if (e.type === "orange")  levelColor = "#ffd27e";
    if (e.type === "boss")    levelColor = "#ff6a8a";
    ctx.fillStyle = levelColor;
    ctx.font = "bold 12px Arial";
    ctx.fillText(`Lv.${e.level}`, sx - e.radius, sy - e.radius - 20);

    // Rank badge (se houver)
    const rankText = (e._trialTargetRank ? `Rank ${e._trialTargetRank}` : (e.enemyRank ? `Rank ${e.enemyRank}` : (e.type==='boss' ? 'BOSS' : '')));
    if (rankText) drawRankBadge(ctx, sx, sy - e.radius - 24, rankText);
  }

  // projéteis dos laranjas
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
