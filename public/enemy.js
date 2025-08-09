/* ========================================================================
 * enemy.js
 * Inimigos com níveis, IA, projéteis dos laranjas e skills do Boss.
 * Corrigido: remoção de movimento duplicado, variável "dist" indefinida,
 * e escopos/fechamentos de chaves. Mantém as funcionalidades do jogo.
 * ===================================================================== */
import { player, getPlayerDefPercent, getShieldDefPercent } from "./player.js";
import { blocks, BLOCK_TYPES } from "./blocks.js";
import { randInt } from "./utils.js";

export const enemies = [];
export const shooterBullets = [];
export const bossProjectiles = [];

/* ---------- Rank visual (rótulo) ---------- */
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

/* ---------- Enemy Ranks ---------- */
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
  "A+":  { },
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
export function enemyRankAdvantage(selfRank, targetRank){
  if (!targetRank || !selfRank) return 0;
  const gap = rankIndex(selfRank) - rankIndex(targetRank);
  if (gap <= 0) return 0;
  return Math.min(0.60, 0.25 + Math.max(0, gap-1)*0.05);
}

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
  if (b.secondBar) e.rankSecondBar = 1;
  if (b.damageReduce2) e._secondBarDR = b.damageReduce2;
}
export function enemyGainPower(e, amount){
  e.power += Math.max(0, amount|0);
  const nr = nextRankForPower(e.power);
  if (nr && nr !== e.rank){ e.rank = nr; e.rankLabel = nr; applyEnemyRankBenefits(e); }
}

/* ---------- Bases ---------- */
const ENEMY_DETECT = { basic:650, orange:800, boss:1000 };

// Distâncias-alvo para combate à distância e cadência de tiro por tipo
const STANDOFF = {
  basic: 320,
  orange: 380,
  boss: 460
};
const FIRE_PROFILE = {
  basic: { cd: 1.6, speed: 12, dmgMul: 0.35, life: 2.0 },
  orange:{ cd: 1.2, speed: 13, dmgMul: 0.40, life: 2.2 },
  boss:  { cd: 0.9, speed: 14, dmgMul: 0.55, life: 2.6 }
};

const BASES = {
  basic:  { hp:160, dmg:10, xp:20,  radius:26, color:"#f35555",  speed:2.6 },
  orange: { hp:210, dmg:14, xp:40,  radius:26, color:"#ff9c40",  speed:2.2 },
  boss:   { hp:2800,dmg:55, xp:250, radius:60, color:"#b1002a",  speed:1.8 }
};
function combineDR(a,b){ return 1 - (1-a)*(1-b); }
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
function randomPosOutsideSafe(mapW, mapH, safeZones, pad=80){
  let p, ok=false;
  for (let i=0;i<50 && !ok;i++){
    p = { x: Math.random()*mapW, y: Math.random()*mapH };
    ok = !safeZones.some(s => Math.hypot(p.x-s.x, p.y-s.y) < s.r + pad);
  }
  return p || { x: mapW*0.5, y: mapH*0.5 };
}

/* ---------- Spawns ---------- */
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

  // Progression-boss (Rank Trial)
  if (e.type==="boss" && e._rankTrial && e._trialTargetRank && !e.rank) {
    e.rank = e._trialTargetRank; e.rankLabel = e._trialTargetRank;
    if (typeof e._forcedPower === 'number') e.power = e._forcedPower;
  }
  // Compute initial rank
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

/* ---------- Dano ao jogador (projéteis/skills) ---------- */
function dealDamageToPlayer(raw) {
  if (raw <= 0) return;
  // chance de ignorar dano (velocidade 10+), já aplicada no game.js para contato;
  // aqui aplicamos apenas DR/escudo para projéteis.
  const baseDef = getPlayerDefPercent();
  const shieldDef = getShieldDefPercent();
  let remaining = raw;

  if (player.shield > 0) {
    const dmgToShield = remaining * (1 - shieldDef);
    const taken = Math.min(player.shield, dmgToShield);
    player.shield -= taken;
    remaining -= taken;
    if (remaining <= 0) return;
  }
  const dmgToHP = remaining * (1 - baseDef);
  player.hp -= dmgToHP;
}

/* ---------- Update loop ---------- */
export function updateEnemies(dt, safeZones) {
  for (const e of enemies) {
    if (!e.alive) continue;

    // Fases do Boss
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

    /* Seleção de alvo (prioridade: Jogador > Inimigos > Blocos) */
    let target = null, targetType = null;
    const canChasePlayer = !inSafe && distTarget < detect;
    if (canChasePlayer) { target = player; targetType = "player"; }
    if (!target){
      // inimigo mais próximo
      let bestD = Infinity, best=null;
      for (const other of enemies){
        if (!other.alive || other===e) continue;
        const d2 = Math.hypot(other.x - e.x, other.y - e.y);
        if (d2 < bestD){ bestD = d2; best = other; }
      }
      if (best) { target = best; targetType = "enemy"; distTarget = bestD; }
    }
    if (!target){
      // bloco mais próximo
      let bestD = Infinity, best=null;
      for (const b of blocks){
        if (!b.alive) continue;
        const d2 = Math.hypot(b.x - e.x, b.y - e.y);
        if (d2 < bestD){ bestD = d2; best = b; }
      }
      if (best) { target = best; targetType = "block"; distTarget = bestD; }
    }

    // Movimento (standoff: aproxima se longe, recua se perto, strafing quando em alcance)
    if (target){
      const dxT = (target.x - e.x), dyT = (target.y - e.y);
      const d = Math.max(1, Math.hypot(dxT, dyT));
      const desired = STANDOFF[e.type] || 340;
      const tooFar = d > desired * 1.10;
      const tooClose = d < desired * 0.90;

      let mvx = 0, mvy = 0;
      if (tooFar) {
        mvx = dxT / d; mvy = dyT / d;              // aproxima
      } else if (tooClose) {
        mvx = -dxT / d; mvy = -dyT / d;            // recua
      } else {
        // strafe perpendicular
        const sx = -dyT / d, sy = dxT / d;
        const dir = (e._strafeDir || (Math.random() < 0.5 ? 1 : -1));
        e._strafeDir = dir;
        mvx = sx * dir; mvy = sy * dir;
      }
      e.x += mvx * e.speed * 60 * dt;
      e.y += mvy * e.speed * 60 * dt;
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

    // Tiro de TODOS os inimigos (passam a lutar à distância; podem atirar em blocos também)
     (não atiram em blocos)
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

    // Regen passiva por rank
    if (e._regenPct && e.alive){ e.hp = Math.min(e.maxHp, e.hp + e.maxHp*e._regenPct*dt); }

    // Skills do boss (fora da safe zone)
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
  } // end for enemies

  // Atualiza projéteis dos laranjas
  for (const b of shooterBullets) {
    if (!b.alive) continue;
    b.x += b.vx * 60 * dt; b.y += b.vy * 60 * dt; b.life -= dt;
    if (b.life <= 0) { b.alive=false; continue; }
    // colisão com player
    const dist = Math.hypot(b.x - player.x, b.y - player.y);
    if (dist < (player.radius||28) + 6) {
      dealDamageToPlayer(b.dmg);
      b.alive = false;
    }
    // colisão com blocos (absorvem projéteis)
    if (!b.alive) continue;
    for (const k of blocks){
      if (!k.alive) continue;
      const half = (BLOCK_TYPES[k.type]?.size||40)/2;
      if (Math.abs(b.x - k.x) <= half + 6 && Math.abs(b.y - k.y) <= half + 6) { b.alive=false; break; }
    }
  }

  // Atualiza projéteis do boss
  for (const p of bossProjectiles) {
    if (!p.alive) continue;
    p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt; p.life -= dt;
    if (p.life <= 0) { p.alive=false; continue; }
    const dist = Math.hypot(p.x - player.x, p.y - player.y);
    if (dist < (player.radius||28) + 10) {
      // dano base de skill do boss um pouco maior que tiro laranja
      dealDamageToPlayer(30);
      p.alive=false;
    }
  }
}

/* ---------- Draw ---------- */
export function drawEnemies(ctx, cam){
  ctx.save();
  for (const e of enemies){
    if (!e.alive) continue;
    const sx = Math.floor(e.x - cam.x), sy = Math.floor(e.y - cam.y);

    // corpo
    ctx.beginPath();
    ctx.arc(sx, sy, e.radius, 0, Math.PI*2);
    ctx.fillStyle = e.color || "#c55";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111";
    ctx.stroke();

    // HP bar
    if (e.maxHp > 0){
      const w = Math.max(40, e.radius*2);
      const h = 6;
      const pct = Math.max(0, Math.min(1, e.hp / e.maxHp));
      const barY = sy - e.radius - 14;
      ctx.fillStyle = "#000"; ctx.fillRect(sx - w/2, barY, w, h);
      ctx.fillStyle = "#e74c3c"; ctx.fillRect(sx - w/2, barY, w * pct, h);
      ctx.strokeStyle = "#111"; ctx.strokeRect(sx - w/2, barY, w, h);
    }

    // Level e Rank acima (centralizado)
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Lv ${e.level||1}`, sx, sy - e.radius - 24);
    if (e.rankLabel){
      drawRankBadge(ctx, sx, sy - e.radius - 36, e.rankLabel);
    }
  }
  ctx.restore();

  // desenha projéteis
  ctx.fillStyle = "#ffcf6e";
  for (const b of shooterBullets){
    if (!b.alive) continue;
    const sx = Math.floor(b.x - cam.x), sy = Math.floor(b.y - cam.y);
    ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = "#ff5c8a";
  for (const p of bossProjectiles){
    if (!p.alive) continue;
    const sx = Math.floor(p.x - cam.x), sy = Math.floor(p.y - cam.y);
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI*2); ctx.fill();
  }
}
