function drawRankBadge(ctx, x, y, text, opts){
  if (!text) return;
  const padX = (opts?.padX ?? 6);
  const padY = (opts?.padY ?? 3);
  ctx.save();
  ctx.font = (opts?.font ?? "bold 13px Arial");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textW = Math.ceil(ctx.measureText(text).width);
  const w = textW + padX*2;
  const h = (opts?.height ?? 20);
  const rx = Math.round(x - w/2);
  const ry = Math.round(y - h/2);
  ctx.fillStyle = (opts?.bg ?? "rgba(0,0,0,0.55)");
  ctx.fillRect(rx, ry, w, h);
  ctx.lineWidth = 1;
  ctx.strokeStyle = (opts?.stroke ?? "#6aa3ff");
  ctx.strokeRect(rx+0.5, ry+0.5, w-1, h-1);
  ctx.fillStyle = (opts?.fg ?? "#e3f1ff");
  ctx.fillText(text, x, ry + h/2);
  ctx.restore();
}


// === Enemy Rank (display only) ================================
function enemyDisplayRank(level){
  // Map enemy level -> display rank label (visual only; doesn't affect gameplay)
  // Tuned to spread roughly from early to late-game.
  const L = Math.max(1, level|0);
  if (L <= 2)  return "E";
  if (L <= 4)  return "E+";
  if (L <= 6)  return "D";
  if (L <= 8)  return "D+";
  if (L <= 10) return "C+";
  if (L <= 14) return "B";
  if (L <= 18) return "B+";
  if (L <= 22) return "A";
  if (L <= 26) return "A+";
  if (L <= 30) return "S";
  if (L <= 34) return "S+";
  if (L <= 38) return "SS";
  if (L <= 42) return "SS+";
  if (L <= 52) return "SSS";
  if (L <= 58) return "SSS+";
  return "U";
}
/* ========================================================================
 * enemy.js
 * Inimigos com níveis, IA, skills do boss, projéteis dos laranjas e do boss.
 * ===================================================================== */
import { player, getPlayerDefPercent } from "./player.js";
import { blocks, BLOCK_TYPES } from "./blocks.js";
import { randInt } from "./utils.js";
export const enemies = [];
export const shooterBullets = [];
export const bossProjectiles = [];

function computePowerGainFromKill(v){ return Math.max(1, Math.round(v*0.1)); }
export function enemyGainPower(e, amount){
  e.power += Math.max(0, amount|0);
  const nr = nextRankForPower(e.power);
  if (nr && nr !== e.rank){ e.rank = nr; e.rankLabel = nr; applyEnemyRankBenefits(e); }
}


const ENEMY_DETECT = { basic:650, orange:800, boss:1000 };

// === Enemy Power/Rank system ===============================================
export const ENEMY_RANKS = ["E","E+","D","D+","C+","B","B+","A","A+","S","S+","SS","SS+","SSS","SSS+","U"];
export const ENEMY_REQ = { "E":10, "E+":20, "D":35, "D+":50, "C+":70, "B":95, "B+":120, "A":150, "A+":185, "S":230, "S+":280, "SS":340, "SS+":410, "SSS":490, "SSS+":580, "U":700 };
const ENEMY_BENEFITS = {
  "E":   { dmg:0.02, hp:0.05 },
  "E+":  { hp:0.07, speed:0.10 },
  "D":   { hp:0.05, dmg:0.025, regen:0.005 },
  "D+":  { hp:0.08, projSpeed:0.15 },
  "C":   { dmg:0.02, regen:0.0075 },
  "C+":  { hp:0.10, projSpeed:0.15 },
  "B":   { dmg:0.02, hp:0.05 },
  "B+":  { stun:0.2 },
  "A":   { dmg:0.02, hp:0.05 },
  "A+":  { }, // reservado
  "S":   { dmg:0.02, hp:0.05 },
  "S+":  { stun:0.3 },
  "SS":  { dmg:0.02, hp:0.05 },
  "SS+": { },
  "SSS": { dmg:0.02, hp:0.05 },
  "SSS+":{ ignore:0.20 },
  "U":   { dmg:0.25, hp:0.10, secondBar:true, damageReduce2:0.20 }
};
function rankIndex(label){ return Math.max(0, ENEMY_RANKS.indexOf(label)); }
function nextRankForPower(p){
  let current = null;
  for (const r of ENEMY_RANKS){
    if (p >= (ENEMY_REQ[r]||Infinity)) current = r; else break;
  }
  return current;
}


const BASES = {
  basic:  { hp:160, dmg:10, xp:20,  radius:26, color:"#f35555",  speed:2.6 },
  orange: { hp:210, dmg:14, xp:40,  radius:26, color:"#ff9c40",  speed:2.2 },
  boss:   { hp:2800,dmg:55, xp:250, radius:60, color:"#b1002a",  speed:1.8 }
};

function combineDR(a,b){ return 1 - (1-a)*(1-b); }

function applyEnemyRankBenefits(e){
  const b = ENEMY_BENEFITS[e.rank] || null;
  if (!b) return;
  if (b.hp) { const extra = Math.round(e.maxHp * b.hp); e.maxHp += extra; e.hp += extra; }
  if (b.dmg) e.dmg = Math.round(e.dmg * (1 + b.dmg));
  if (b.speed) e.speed *= (1 + b.speed);
  if (b.projSpeed) e._projSpeedMult = (e._projSpeedMult||1) * (1 + b.projSpeed);
  if (b.regen) e._regenPct = (e._regenPct||0) + b.regen;
  if (b.stun) e._stunShot = Math.max(e._stunShot||0, b.stun);
  if (b.ignore) e._ignoreChance = Math.max(e._ignoreChance||0, b.ignore);
  if (b.secondBar) e.rankSecondBar = 1; // enable second HP bar
  if (b.damageReduce2) e._secondBarDR = b.damageReduce2;
}


function advantageVs(targetRank, selfRank){
  if (!targetRank || !selfRank) return 0;
  const gap = rankIndex(selfRank) - rankIndex(targetRank);
  if (gap <= 0) return 0;
  // Base 25% + 5% por diferença adicional, máx 60%
  return Math.min(0.60, 0.25 + Math.max(0, gap-1)*0.05);
}


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
  return randInt(10,60);
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

export function spawnEnemy(type, mapW, mapH, safeZones, level=null, opts={}) {
  const pos = randomPosOutsideSafe(mapW, mapH, safeZones, 80);
  const b = BASES[type];
  const lv = level ?? randomLevelForType(type);
  const sc = scaleByLevel(type, lv);
  const e = {
    x: pos.x, y: pos.y, type, level: sc.lvl,
    radius: b.radius, color: b.color,
    maxHp: sc.hp, hp: sc.hp, speed: b.speed,
    baseDmg: b.dmg, dmg: sc.dmg, xpReward: sc.xp,
    alive: true,
    levelDR: sc.levelDR, phaseDR: 0, dmgReduce: sc.levelDR,
    phase:1, s1cd:0, s2cd:0, lastSkillCd:0,
    shootCd:0,
    power: (type==="basic"? Math.max(0, randInt(0,10)) : (type==="orange"? randInt(10,30) : (type==="boss"? 10 : 0))),
    rank: null,
    rankLabel: null,
    rankSecondBar: 0,
    wander: {tx: pos.x, ty: pos.y, t: 0}
  };

  if (opts && typeof opts.forcedPower === 'number') e.power = opts.forcedPower;
  if (opts && opts.rankLabel) { e.rank = opts.rankLabel; e.rankLabel = opts.rankLabel; }
  // If progression boss was created by rank system, honor its settings
  if (e.type==="boss" && e._rankTrial && e._trialTargetRank && !e.rank) {
    e.rank = e._trialTargetRank; e.rankLabel = e._trialTargetRank;
    if (typeof e._forcedPower === 'number') e.power = e._forcedPower;
  }
  // Compute initial rank from power
  const rr = nextRankForPower(e.power);
  if (!e.rank) e.rank = rr;
  if (!e.rankLabel) e.rankLabel = e.rank;
  applyEnemyRankBenefits(e);
  enemies.push(e);
  return e;
}
export function spawnBoss(mapW, mapH, safeZones, level=null){
  return spawnEnemy("boss", mapW, mapH, safeZones, level);
}

export function updateEnemies(dt, safeZones) {
  for (const e of enemies) {
    if (!e.alive) continue;

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

    const inSafe = safeZones.some(s => Math.hypot(player.x - s.x, player.y - s.y) < s.r);
    let distTarget   = Math.hypot(e.x - player.x, e.y - player.y);
    const detect = ENEMY_DETECT[e.type] || 650;
    /* AI: target selection with priority Player > Enemies > Blocks */
    let target = null, targetType = null;
    const canChasePlayer = !inSafe && distTarget < detect;
    if (canChasePlayer) { target = player; targetType = "player"; }
    if (!target){
      // find nearest enemy (exclude self)
      let bestD = Infinity, best=null;
      for (const other of enemies){
        if (!other.alive || other===e) continue;
        const d2 = Math.hypot(other.x - e.x, other.y - e.y);
        if (d2 < bestD){ bestD = d2; best = other; }
      }
      if (best) { target = best; targetType = "enemy"; distTarget = bestD; }
    }
    if (!target){
      // find nearest block
      let bestD = Infinity, best=null;
      for (const b of blocks){
        if (!b.alive) continue;
        const d2 = Math.hypot(b.x - e.x, b.y - e.y);
        if (d2 < bestD){ bestD = d2; best = b; }
      }
      if (best) { target = best; targetType = "block"; distTarget = bestD; }
    }

    if (target){
      const d = Math.max(1, Math.hypot(target.x - e.x, target.y - e.y));
      e.x += (target.x - e.x)/d * e.speed * 60 * dt;
      e.y += (target.y - e.y)/d * e.speed * 60 * dt;
    } else {
      // wander
      e.wander.t -= dt;
      if (e.wander.t <= 0){
        e.wander.tx = e.x + randInt(-200,200);
        e.wander.ty = e.y + randInt(-200,200);
        e.wander.t = 2 + Math.random()*3;
      }
      const d = Math.max(1, Math.hypot(e.wander.tx - e.x, e.wander.ty - e.y));
      e.x += (e.wander.tx - e.x)/d * e.speed * 40 * dt;
      e.y += (e.wander.ty - e.y)/d * e.speed * 40 * dt;
    }


    if (!inSafe && distTarget < detect) {
      const d = Math.max(1, dist);
      e.x += (player.x - e.x)/d * e.speed * 60 * dt;
      e.y += (player.y - e.y)/d * e.speed * 60 * dt;
    }

    if (e.type==="orange" && target && targetType!=="block" ? distTarget < 700 : distTarget < 500) {
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = 1.2;
        const tx = (target?.x ?? player.x), ty = (target?.y ?? player.y);
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx,dy)||1;
        const bulletDmg = Math.round(10 + e.dmg*0.4);
        const spMult = e._projSpeedMult || 1;
        shooterBullets.push({ x:e.x, y:e.y, vx:(dx/d)*13*spMult, vy:(dy/d)*13*spMult, life:2.2, alive:true, dmg: bulletDmg, from:e, stun:e._stunShot||0 });
      }
    }
  }

    /* Passive regen and second bar */
    if (e._regenPct && e.alive){ e.hp = Math.min(e.maxHp, e.hp + e.maxHp*e._regenPct*dt); }

    if (e.type==="boss" && !inSafe) {
      e.s1cd -= dt; e.s2cd -= dt; e.lastSkillCd -= dt;
      if (e.lastSkillCd <= 0) {
        const wantS1 = e.s1cd <= 0;
        const wantS2 = e.phase>=2 && e.s2cd <= 0;
        
if (wantS1 && (!wantS2 || Math.random()<0.6)) {
  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx,dy)||1;
  bossProjectiles.push({ x:e.x, y:e.y, vx:(dx/d)*10*(e._projSpeedMult||1), vy:(dy/d)*10*(e._projSpeedMult||1), life:2.5, alive:true, type:"trap", from:e });
  e.s1cd = (e.phase>=3) ? 3 : 6;
  e.lastSkillCd = 1.5;
} else if (wantS2) {
  const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx,dy)||1;
  bossProjectiles.push({ x:e.x, y:e.y, vx:(dx/d)*8*(e._projSpeedMult||1), vy:(dy/d)*8*(e._projSpeedMult||1), life:2.8, alive:true, type:"circle", from:e });
  e.s2cd = 5;
  e.lastSkillCd = 1.5;
}
        }
      }
    }

  for (const b of shooterBullets) {
    /* extended bullet collisions */

    if (!b.alive) continue;
    b.x += b.vx * 60 * dt; b.y += b.vy * 60 * dt; b.life -= dt;
    if (b.life <= 0) { b.alive=false; continue; }
    const dist = Math.hypot(b.x - player.x, b.y - player.y);
    if (dist < (player.radius||28) + 6) {
      const def = getPlayerDefPercent();
      player.hp -= b.dmg * (1 - def);
      if (b.stun && b.stun>0) { player.freezeTimer = Math.max(player.freezeTimer||0, b.stun); }
      b.alive = false;
      continue;
    }
    // hit other enemies
    for (const e2 of enemies){
      if (!e2.alive) continue;
      if (Math.hypot(b.x - e2.x, b.y - e2.y) < e2.radius + 6) {
        // advantage if shooter has higher rank
        const adv = advantageVs(e2.rank, b.from?.rank);
        const ignore = (b.from?._ignoreChance||0);
        const dr = (e2.dmgReduce||0);
        const final = ignore>0 && Math.random()<ignore ? b.dmg*(1+adv) : b.dmg*(1 - dr)*(1+adv);
        e2.hp -= final;
        b.alive = false; break;
      }
    }
    if (!b.alive) continue;
    // hit blocks (simple AABB)
    for (const k of blocks){
      if (!k.alive) continue;
      const half = (BLOCK_TYPES[k.type]?.size||40)/2;
      if (Math.abs(b.x - k.x) <= half + 6 && Math.abs(b.y - k.y) <= half + 6) {
        k.hp -= b.dmg; k.recentHitTimer = 1.0; b.alive=false; break;
      }
    }


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
        player.circleTimer = 4;
      }
      p.alive=false; continue;
    }
    // hit other enemies
    for (const e2 of enemies){ if (!e2.alive) continue;
      if (Math.hypot(p.x - e2.x, p.y - e2.y) < e2.radius + rad) {
        const adv = advantageVs(e2.rank, p.from?.rank);
        const ignore = (p.from?._ignoreChance||0);
        const dr = (e2.dmgReduce||0);
        const base = (p.type==="circle"? 35 : 28);
        const dmg = ignore>0 && Math.random()<ignore ? base*(1+adv) : base*(1 - dr)*(1+adv);
        e2.hp -= dmg; p.alive=false; break;
      }
    }
    if (!p.alive) continue;
    // hit blocks
    for (const k of blocks){ if (!k.alive) continue;
      const half = (BLOCK_TYPES[k.type]?.size||40)/2;
      const half = (BLOCK_TYPES[k.type]?.size||40)/2;
      if (Math.abs(p.x - k.x) <= half + rad && Math.abs(p.y - k.y) <= half + rad) { k.hp -= (p.type==="circle"? 35:28); k.recentHitTimer=1.0; p.alive=false; break; }
  }

  if (player.circleTimer !== undefined) {
    player.circleTimer -= dt;
    if (player.circleTimer <= 0) {
      player.circleTimer = 0;
      player.defDebuff = 0;
      player.slowMult = 1;
    }
  }
}

}export function drawEnemies(ctx, cam) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx = Math.floor(e.x - cam.x), sy = Math.floor(e.y - cam.y);

    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI*2); ctx.fill();

    // rank badge
    if (typeof drawRankBadge === 'function' && e.rank){ drawRankBadge(ctx, sx, sy - e.radius - 24, e.rank, {height:18, font:"bold 12px Arial"}); }

    const w = e.radius*2, pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle="#000"; ctx.fillRect(sx - w/2, sy - e.radius - 16, w, 6);
    ctx.fillStyle="#2ecc71"; ctx.fillRect(sx - w/2, sy - e.radius - 16, w*pct, 6);

    let levelColor = "#e0e0e0";
    if (e.type === "basic")   levelColor = "#7ec8ff";
    if (e.type === "orange")  levelColor = "#ffd27e";
    if (e.type === "boss")    levelColor = "#ff6b8a";
    ctx.fillStyle = levelColor;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    try {
      const er = enemyDisplayRank(e.level);
      const stroke = (e.type==="boss"?"#ff6b8a":(e.type==="orange"?"#ffd27e":"#7ec8ff"));
      drawRankBadge(ctx, sx, sy - e.radius - 44, `Rank ${er}`, { height:18, stroke });
    } catch(_) {}
    ctx.fillText(`Lv ${e.level}`, sx, sy - e.radius - 24);
  }

  ctx.fillStyle="#ffffff";
  for (const b of shooterBullets) {
    /* extended bullet collisions */

    if (!b.alive) continue;
    const sx=Math.floor(b.x-cam.x), sy=Math.floor(b.y-cam.y);
    ctx.beginPath(); ctx.arc(sx,sy,6,0,Math.PI*2); ctx.fill();
  }

  for (const p of bossProjectiles) {
    if (!p.alive) continue;
    const sx=Math.floor(p.x-cam.x), sy=Math.floor(p.y-cam.y);
    ctx.beginPath();
    ctx.fillStyle = p.type==="circle" ? "#00e0ff" : "#ff0066";
    ctx.arc(sx,sy,p.type==="circle"?14:8,0,Math.PI*2); ctx.fill();
  }
}

export function enemyRankAdvantage(attackerRank, defenderRank){ return advantageVs(defenderRank, attackerRank); }
