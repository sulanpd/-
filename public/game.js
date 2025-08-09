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

/* ========================================================================
 * game.js — XP Mult por Reborn (até 3), indicador visual e bloqueio Body DPS
 * ===================================================================== */
import {
  player, resetPlayer, playerBaseStats, getPlayerRegen,
  getPlayerDefPercent, getShieldDefPercent, getPlayerBonusXP, xpToNext, getPlayerMilestoneSummary,
  doReborn
} from "./player.js";
import { enemies, spawnEnemy, spawnBoss, updateEnemies, drawEnemies, enemyGainPower, enemyRankAdvantage } from "./enemy.js";
import { blocks, BLOCK_TYPES, spawnBlock, drawBlocks, updateBlocksHitTimers } from "./blocks.js";
import { playerBullets, spawnPlayerBullet, updatePlayerBullets, drawPlayerBullets, setProjectileRangeMult } from "./projectiles.js";
import { clamp } from "./utils.js";
import {
  isUnlocked as rankUnlocked,
  getCurrentRank, getNextRank, getPowerBreakdown, getRequiredPowerFor,
  shouldGrantPointOnLevel, startTrial, onBossDefeated, tickRankSystem
} from "./rankSystem.js";

/* ---------- Canvas / Mapa ---------- */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let viewW = window.innerWidth, viewH = window.innerHeight;
canvas.width = viewW; canvas.height = viewH;
let MAP_W = viewW * 3, MAP_H = viewH * 3;
const cam = { x: 0, y: 0 };

/* ---------- Bases do Player ---------- */
const BASES = { BASE_HP: 100, BASE_DMG: 25, BASE_DEF: 0, BASE_SPEED: 3.2, BASE_MOB: 1.0, BASE_BODY: 10 };
playerBaseStats(BASES);

/* ---------- Safe Zones ---------- */
export function getSafeZones() {
  return [
    { x: MAP_W * 0.25, y: MAP_H * 0.25, r: 160 },
    { x: MAP_W * 0.75, y: MAP_H * 0.25, r: 160 },
    { x: MAP_W * 0.50, y: MAP_H * 0.75, r: 160 }
  ];
}
function drawSafeZones() {
  ctx.save();
  ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
  for (const s of getSafeZones()) {
    const sx = s.x - cam.x, sy = s.y - cam.y;
    ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(50,200,120,0.10)"; ctx.fill();
    ctx.strokeStyle = "rgba(80,255,160,0.75)"; ctx.stroke();
  }
  ctx.restore();
}

/* ---------- Input / Tiro ---------- */
const keys = new Set();
let isShooting = false;
let shootCD = 0;
const FIRE_RATE = 0.18;
let mouseWX = 0, mouseWY = 0;
function updateMouseWorld(e){
  const rect = canvas.getBoundingClientRect();
  mouseWX = cam.x + (e.clientX - rect.left);
  mouseWY = cam.y + (e.clientY - rect.top);
}
window.addEventListener("keydown", e => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === "escape") { toggleSkills(false); toggleReborn(false); }
});
window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener("mousedown", e => { if (!player.alive) return; updateMouseWorld(e); isShooting = true; tryShoot(); });
window.addEventListener("mouseup", () => { isShooting = false; });
canvas.addEventListener("mousemove", updateMouseWorld);

function tryShoot(){
  if (!player.alive) return;
  if (shootCD <= 0 && isShooting) {
    const dmg = Math.max(1, player.dmg) * playerDamageMult;
    spawnPlayerBullet(player.x, player.y, mouseWX, mouseWY, 16, dmg);
    shootCD = FIRE_RATE;
  }
}

let currentSlowFactor = 0;
function handleInput(dt) {
  if (player.freezeTimer > 0) { player.freezeTimer -= dt; return; }
  let vx = 0, vy = 0;
  if (keys.has("w") || keys.has("arrowup")) vy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) vy += 1;
  if (keys.has("a") || keys.has("arrowleft")) vx -= 1;
  if (keys.has("d") || keys.has("arrowright")) vx += 1;
  if (vx || vy) { const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l; }
  const spd = player.speed * (1 - currentSlowFactor) * (player.slowMult || 1) * 60 * dt;
  const r = player.radius || 28;
  player.x = clamp(player.x + vx * spd, r, MAP_W - r);
  player.y = clamp(player.y + vy * spd, r, MAP_H - r);
}
function centerCameraOnPlayer() {
  cam.x = clamp(player.x - viewW / 2, 0, Math.max(0, MAP_W - viewW));
  cam.y = clamp(player.y - viewH / 2, 0, Math.max(0, MAP_H - viewH));
}

/* ---------- Init ---------- */
function initGame() {
  resetPlayer(getSafeZones());
  for (let i = 0; i < 50; i++) {
    spawnBlock("yellow", MAP_W, MAP_H, getSafeZones());
    spawnBlock("blue", MAP_W, MAP_H, getSafeZones());
    spawnBlock("purple", MAP_W, MAP_H, getSafeZones());
  }
  for (let i = 0; i < 8; i++) spawnEnemy("basic", MAP_W, MAP_H, getSafeZones());
  centerCameraOnPlayer();
}

/* ---------- HUD ---------- */
const hudHp = document.getElementById("hp");
const hudLvl = document.getElementById("level");
const hudScore = document.getElementById("score");
const spanPoints = document.getElementById("points");
const xpbar = document.getElementById("xpbar");
const eventMsg = document.getElementById("eventMsg");
const deathMsg = document.getElementById("deathMsg");
const dmgReduceIcon = document.getElementById("dmgReduceIcon");
const rebornBadge = document.getElementById("rebornBadge");
// Rank UI
const rankBtn = document.getElementById("openRank");
const rankPanel = document.getElementById("rankPanel");

function updateRebornBadge() {
  if (!rebornBadge) return;
  const n = player.rebornCount || 0;
  rebornBadge.textContent = `⭐ x${n} / 3`;
  rebornBadge.title = `Reborns: ${n}/3 • Bônus XP: +${n*25}%`;
}

function updateHUD() {
  if (hudHp) hudHp.textContent = `${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`;
  if (hudLvl) hudLvl.textContent = player.level;
  if (hudScore) hudScore.textContent = score;
  if (spanPoints) spanPoints.textContent = player.points;
  if (xpbar) { const pct = Math.max(0, Math.min(1, player.xp / player.xpToNext)); xpbar.style.width = Math.floor(pct * 100) + "%"; }
  if (dmgReduceIcon) dmgReduceIcon.style.display = (player.milestones.def10 ? "flex" : "none");
  updateRebornBadge();
  if (rankBtn) {
    const unlocked = rankUnlocked();
    const next = unlocked ? getNextRank() : null;
    const pb = unlocked && next ? getPowerBreakdown() : null;
    const can = unlocked && next && pb.total >= getRequiredPowerFor(next);
    rankBtn.disabled = !unlocked;
    rankBtn.className = (unlocked && can) ? 'glow' : '';
    rankBtn.title = unlocked ? (can && next ? `Pronto para Rank ${next}` : 'Progrida o Poder para avançar') : 'Desbloqueia no Reborn 2';
  }
}
function flashEvent(msg) {
  if (!eventMsg) return;
  eventMsg.textContent = msg;
  eventMsg.style.display = "block";
  setTimeout(() => { eventMsg.style.display = "none"; }, 3000);
}
function showDeathMsg(show) { if (deathMsg) deathMsg.style.display = show ? "block" : "none"; }

/* ---------- Skills UI ---------- */
const btnSkills = document.getElementById("openSkills");
const skillsDiv = document.getElementById("skills");
btnSkills?.addEventListener("click", () => toggleSkills());
function toggleSkills(force) {
  if (!skillsDiv) return;
  const show = (typeof force === "boolean") ? force : (skillsDiv.style.display !== "block");
  skillsDiv.style.display = show ? "block" : "none";
  if (show) renderSkills();
}
function renderSkills() {
  if (!skillsDiv) return;
  if (!player.skill) player.skill = { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, body:0 };

  // Bloqueio de Body Damage se for DPS após Reborn
  const isDPS = player.rebornClass === "DPS";
  const bodyDisabled = isDPS;

  const rows = [
    ["dmg","Dano", false],
    ["body","Body Damage", bodyDisabled],
    ["def","Defesa", false],
    ["hp","Vida", false],
    ["regen","Regeneração", false],
    ["speed","Velocidade", false],
    ["mob","Mobilidade", false],
  ].map(([k,label,locked])=>{
    const v = player.skill[k]||0;
    const lockNote = (k==="body" && locked) ? " <span style='font-size:11px;opacity:.8;'>(exclusivo de TANK após Reborn)</span>" : "";
    return `<div class="skill-row"><span>${label}${lockNote}: <b>${v}</b></span><button class="up-skill" data-k="${k}" ${player.points<=0||locked?"disabled":""}>+1</button></div>`;
  }).join("");

  const ms = getPlayerMilestoneSummary();
  const msLines = [
    `<li>${ms.dmg10 ? "✅" : "❌"} Dano 10+: +20% dano vs blocos</li>`,
    `<li>${ms.def10 ? "✅" : "❌"} Defesa 10+: +20% DR extra</li>`,
    `<li>${ms.spd10 ? "✅" : "❌"} Velocidade 10+: 10% chance de ignorar 1 dano</li>`
  ].join("");

  const rebornLine = player.hasReborn
    ? `<div style="margin:8px 0 10px 0;padding:8px;border-radius:10px;border:1px solid #556;background:#1b2230;">
         <b>Árvore Reborn</b>: ${player.rebornClass || "-"} ${player.rebornClass==="DPS"?"• Multiplicador de projétil x1.25 • Body Damage desativado (exclusivo de TANK)":
         (player.rebornClass==="TANK"?"• DR +25% & Escudo (60% do HP) • Body Damage disponível":"")}
       </div>`
    : "";

  skillsDiv.innerHTML = `
    <div class="skills-wrap">
      <h3>Habilidades</h3>
      ${rebornLine}
      <p>Pontos disponíveis: <b id="skillPoints">${player.points}</b></p>
      <div class="skills-grid">${rows}</div>
      <div class="skills-milestones" style="margin-top:8px;">
        <h4>Marcos ativos</h4>
        <ul style="margin:6px 0 12px 18px; line-height:1.5;">${msLines}</ul>
      </div>
      <button id="closeSkills">Fechar</button>
    </div>`;
  document.getElementById("closeSkills")?.addEventListener("click", () => toggleSkills(false));
  skillsDiv.querySelectorAll(".up-skill").forEach(btn => btn.addEventListener("click", () => upgradeSkill(btn.getAttribute("data-k"))));
}
function upgradeSkill(key) {
  if (player.points <= 0) return;
  if (!player.skill) player.skill = { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, body:0 };
  // trava Body se for DPS
  if (key === "body" && player.rebornClass === "DPS") return;
  player.skill[key] = (player.skill[key] || 0) + 1;
  player.points -= 1;
  playerBaseStats(BASES);
  renderSkills(); updateHUD();
}

/* ---------- Conquistas / XP / Level ---------- */
let score = 0;
let level10Shown = false;
const achievements = { brave:false, bravePending:false, power8k:false };

/* multiplicadores */
let xpMult = 1.0;
function updateXpMult() {
  const rebornMult = 1 + 0.25 * (player.rebornCount || 0); // +25% por Reborn
  const braveMult = achievements.brave ? 1.25 : 1.0;       // +25% (Coragem dos Fracos)
  xpMult = rebornMult * braveMult;
}

// Dano de projétil (considera DPS e conquista 35)
let playerDamageMult = 1.0;

function pushAchievementBanner(text, ms=3000){
  activeBanners.push({ text, until: performance.now() + ms });
}
const activeBanners = [];
function drawAchievementBanners(){
  const now = performance.now(); let y = 20;
  for (let i=activeBanners.length-1; i>=0; i--){
    const b = activeBanners[i];
    if (now > b.until) { activeBanners.splice(i,1); continue; }
    ctx.save(); ctx.globalAlpha = 0.9;
    ctx.fillStyle="#111a"; ctx.fillRect(viewW/2 - 180, y, 360, 34);
    ctx.strokeStyle="#44f"; ctx.strokeRect(viewW/2 - 180, y, 360, 34);
    ctx.fillStyle="#fff"; ctx.font="14px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(b.text, viewW/2, y+17);
    ctx.restore(); y += 40;
  }
}
function drawAchievementIcons(){
  const icons = [];
  if (achievements.brave) icons.push({emoji:"🏅",title:"+25% XP"});
  if (achievements.power8k) icons.push({emoji:"⚡",title:"+10% DMG + Alcance"});
  let x=10, y=10, size=28, pad=6;
  for (const ic of icons){
    ctx.save(); ctx.globalAlpha=0.95;
    ctx.fillStyle="#1e1e1e"; ctx.fillRect(x,y,size,size);
    ctx.strokeStyle="#66f"; ctx.strokeRect(x,y,size,size);
    ctx.font="20px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(ic.emoji, x+size/2, y+size/2+1);
    ctx.restore(); x += size+pad;
  }
}
function drawMilestoneBadges() {
  const ms = getPlayerMilestoneSummary();
  const list = [];
  if (ms.dmg10) list.push({ text:"+20% vs blocos", color:"#ffd27e" });
  if (ms.def10) list.push({ text:"+20% DR extra",  color:"#7ee57e" });
  if (ms.spd10) list.push({ text:"10% esquiva",    color:"#7ec8ff" });
  if (!list.length) return;
  let x = 10, y = 48, w = 125, h = 20;
  for (const b of list) {
    ctx.save(); ctx.globalAlpha=0.9;
    ctx.fillStyle="#111a"; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=b.color; ctx.strokeRect(x,y,w,h);
    ctx.fillStyle="#fff"; ctx.font="12px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(b.text, x+w/2, y+h/2+1);
    ctx.restore(); x += w + 6;
  }
}

function addXP(v) {
  player.xp += v * xpMult;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    // Regras de pontos com Rank System
    if (shouldGrantPointOnLevel(player.level)) player.points++;
    player.xpToNext = xpToNext(player.level);
    playerBaseStats(BASES);

    if (!achievements.power8k && player.level >= 35) {
      achievements.power8k = true;
      playerDamageMult = (player.rebornClass==="DPS" ? 1.25 : 1.0) * 1.10;
      setProjectileRangeMult(1.35);
      flashEvent('Você obteve a conquista "Um Poder de Mais de 8 mil" (+10% dano, +35% alcance do projétil)');
      pushAchievementBanner("⚡ Um Poder de Mais de 8 mil", 3000);
    } else {
      playerDamageMult = (player.rebornClass==="DPS" ? 1.25 : 1.0) * (achievements.power8k ? 1.10 : 1.0);
    }

    if (player.level === 10 && !level10Shown) { level10Shown = true; flashEvent("Novo objetivo: Renascer (alcance o Nível 25)"); }
    flashEvent(`Nível ${player.level}! +1 ponto de habilidade`);
  }
}

/* ---------- Respawns ---------- */
const LIMITS = { basic:12, orange:6, boss:1, blocks:80 };
const RESPAWN = { basic:40, orange:120, boss:600, block:2 };
let accBasic=0, accOrange=0, accBoss=0, accBlock=0;

function updateRespawns(dt) {
  accBlock += dt;
  if (accBlock >= RESPAWN.block) {
    accBlock -= RESPAWN.block;
    if (blocks.filter(b=>b.alive).length < LIMITS.blocks) {
      const types=["yellow","blue","purple"]; const type = types[(Math.random()*types.length)|0];
      spawnBlock(type, MAP_W, MAP_H, getSafeZones());
    }
  }
  accBasic += dt;
  if (accBasic >= RESPAWN.basic) {
    accBasic -= RESPAWN.basic;
    if (enemies.filter(e=>e.alive && e.type==="basic").length < LIMITS.basic) {
      spawnEnemy("basic", MAP_W, MAP_H, getSafeZones());
    }
  }
  if (player.level >= 15) {
    accOrange += dt;
    if (accOrange >= RESPAWN.orange) {
      accOrange -= RESPAWN.orange;
      if (enemies.filter(e=>e.alive && e.type==="orange").length < LIMITS.orange) {
        spawnEnemy("orange", MAP_W, MAP_H, getSafeZones());
      }
    }
  } else accOrange = 0;
  if (player.level >= 45) {
    accBoss += dt;
    if (accBoss >= RESPAWN.boss) {
      accBoss = 0;
      if (!enemies.some(e=>e.alive && e.type==="boss")) {
        spawnBoss(MAP_W, MAP_H, getSafeZones());
        flashEvent("⚠️ Boss apareceu!"); pushAchievementBanner("⚠️ Boss apareceu!", 2000);
      }
    }
  } else accBoss = 0;
}


function awardNearestEnemyPower(x,y, amount){
  let best=null, bestD=Infinity;
  for (const e of enemies){ if (!e.alive) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD){ bestD=d; best=e; }
  }
  if (best) enemyGainPower(best, Math.max(1, Math.round(amount)));
}

/* ---------- Dano ao Player ---------- */
function dealDamageToPlayer(raw) {
  if (raw <= 0) return;
  if (player.ignoreChance > 0 && Math.random() < player.ignoreChance) return;

  const baseDef = getPlayerDefPercent();
  const totalDR = Math.max(0, Math.min(0.95, 1 - (1 - baseDef) * (1 - (player.extraDR || 0)) * (1 - (player.rebornExtraDR || 0)) * (1 - (player.rankExtraDR || 0))));
  let remaining = raw;

  if (player.shield > 0) {
    const shieldDR = Math.max(totalDR, getShieldDefPercent());
    const dmgToShield = remaining * (1 - shieldDR);
    const taken = Math.min(player.shield, dmgToShield);
    player.shield -= taken;
    remaining -= taken;
    if (remaining <= 0) return;
  }

  const dmgToHP = remaining * (1 - totalDR);
  player.hp -= dmgToHP;
}

/* ---------- Colisões / Combate ---------- */
function updateCollisions(dt) {
  currentSlowFactor = 0;
  const regen = getPlayerRegen();
  if (regen > 0 && player.alive) {
    player.hp = Math.min(player.maxHp, player.hp + regen * player.maxHp * dt);
    if (player.shieldMax > 0) {
      player.shield = Math.min(player.shieldMax, player.shield + (regen * player.maxHp * 0.5) * dt);
    }
  }

  // player vs blocos
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type];
    const dx = b.x - player.x, dy = b.y - player.y;
    const dist = Math.hypot(dx, dy);
    const overlap = (t.size/2 + (player.radius||28)) - dist;
    if (overlap > 0) {
      currentSlowFactor = Math.max(currentSlowFactor, 1 - t.slow);
      dealDamageToPlayer(t.dmg * dt * 10);

      const eff = Math.max(0, 1 - (b.dmgReduce || 0));
      const bonusVsBlocks = player.blockDmgMult || 1.0;
      const bodyDps = Math.max(1, player.bodyDmg) * playerDamageMult * bonusVsBlocks * eff * dt;
      b.hp -= bodyDps; b.recentHitTimer = 1.2;
      if (b.hp <= 0) {
        b.alive = false;
        const xpGain = b.xpReward || (t.xp || 0);
        addXP(getPlayerBonusXP(xpGain)); score += Math.floor(xpGain);
      }
    }
  }

  // tiros do player vs inimigos e blocos (igual antes)
  for (const pb of playerBullets) {
    if (!pb.alive) continue;

    for (const e of enemies) {
      if (!e.alive) continue;
      const hit = Math.hypot(pb.x - e.x, pb.y - e.y) < (e.radius + 6);
      if (hit) {
        const dmg = pb.damage * (1 - (e.dmgReduce || 0));
        e.hp -= dmg; pb.alive = false;
        if (e.hp <= 0) {
          e.alive = false;
          try { onBossDefeated(e); } catch (err) {}
          const xp = e.xpReward || 10;
          addXP(getPlayerBonusXP(xp)); score += Math.floor(xp * 0.5);
          flashEvent(e.type === "boss" ? "🏆 Boss derrotado!" : "+XP");
          pushAchievementBanner(e.type === "boss" ? "🏆 Boss derrotado!" : "+XP", 1200);
        }
        break;
      }
    }
    if (!pb.alive) continue;

    for (const k of blocks) {
      if (!k.alive) continue;
      const half = (BLOCK_TYPES[k.type]?.size || 40)/2;
      if (Math.abs(pb.x - k.x) <= half + 6 && Math.abs(pb.y - k.y) <= half + 6) {
        const eff = Math.max(0, 1 - (k.dmgReduce || 0));
        const bonusVsBlocks = player.blockDmgMult || 1.0;
        k.hp -= pb.damage * bonusVsBlocks * eff; k.recentHitTimer = 1.2; pb.alive = false;
        if (k.hp <= 0) {
          k.alive = false;
          const xp = k.xpReward || (BLOCK_TYPES[k.type]?.xp || 0);
          addXP(getPlayerBonusXP(xp)); score += Math.floor(xp);
        }
        break;
      }
    }
  }

  // contato com inimigos
  for (const e of enemies) {
    /* enemy vs enemy & blocks */
    // enemies collide with other enemies/blocks causing damage and gaining power on kills
    for (const other of enemies){
      if (!other.alive || other===e) continue;
      const d = Math.hypot(e.x - other.x, e.y - other.y);
      if (d < e.radius + other.radius){
        // damage each other slightly per tick
        const adv = enemyRankAdvantage(e.rank, other.rank);
        const advOther = enemyRankAdvantage(other.rank, e.rank);
        const de = e.dmg * 0.5 * (1+adv) * dt;
        const do_ = other.dmg * 0.5 * (1+advOther) * dt;
        other.hp -= de * (1 - (other.dmgReduce||0));
        if (other.hp <= 0){ other.alive=false; awardNearestEnemyPower(other.x, other.y, Math.max(3, Math.floor((other.xpReward||20)*0.5))); }
        e.hp -= do_ * (1 - (e.dmgReduce||0));
      }
    }
    // enemy touching blocks
    for (const b of blocks){
      if (!b.alive) continue;
      const half = (BLOCK_TYPES[b.type]?.size||40)/2;
      const dx = b.x - e.x, dy = b.y - e.y; const dist = Math.hypot(dx,dy);
      if (dist < half + e.radius){
        // Enemy scratches the block
        b.hp -= e.dmg * 0.4 * dt; b.recentHitTimer = 1.0;
        if (b.hp <= 0){ b.alive=false; const xp = b.xpReward || (BLOCK_TYPES[b.type]?.xp||0); awardNearestEnemyPower(b.x,b.y, Math.max(1, Math.floor((xp||10)*0.5))); }
      }
    }

    if (!e.alive) continue;
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist < (player.radius||28) + e.radius) {
      dealDamageToPlayer(e.dmg * dt);
      const dmgToEnemy = Math.max(1, player.bodyDmg) * playerDamageMult * (1 - (e.dmgReduce || 0)) * dt;
      e.hp -= dmgToEnemy;
      if (e.hp <= 0) {
        e.alive = false;
        const xp = e.xpReward || 10;
        addXP(getPlayerBonusXP(xp)); score += Math.floor(xp * 0.5);
      }
    }
  }

  if (player.hp <= 0 && player.alive) {
    player.alive = false;
    player.respawnTimer = 2.5;
    showDeathMsg(true);
    if (!achievements.brave && player.level > 10) achievements.bravePending = true;
  }
}

/* ---------- Respawn Player ---------- */
function updateRespawn(dt) {
  if (!player.alive) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      resetPlayer(getSafeZones());
      playerBaseStats(BASES);
      showDeathMsg(false);
      if (achievements.bravePending && !achievements.brave && player.level > 10) {
        achievements.bravePending = false; achievements.brave = true;
        updateXpMult(); // atualiza com bônus de conquista
        flashEvent('Você obteve a conquista "Coragem dos Fracos" (+25% XP)');
        pushAchievementBanner("🏅 Coragem dos Fracos (+25% XP)", 3000);
      }
    }
  }
}

/* ---------- Quests (UI lateral) ---------- */
const questsDiv = document.getElementById("quests");
const rebornQuest = { started:false, completed:false, requiredLevel:25 };
function renderQuests() {
  if (!questsDiv) return;
  const started = player.level >= 10 || rebornQuest.started || player.rebornCount > 0;
  const done = player.rebornCount > 0 || rebornQuest.completed;
  const active = started && !done;
  const statusDot = done ? "done" : (active ? "active" : "");
  questsDiv.innerHTML = `
    <div class="quest-title">📜 Missões</div>
    <div class="quest-item">
      <div class="quest-dot ${statusDot}"></div>
      <div>
        <div><b>Reborn System</b></div>
        <div class="small">
          ${player.rebornCount>=1 ? "Concluída (você já renasceu)" :
            (active ? "Progrida até o Lv 25 para desbloquear" : "Quest System após Lv 10")}
        </div>
      </div>
    </div>`;
}

/* ---------- Reborn Panel ---------- */
const rebornBtn = document.getElementById("openReborn");
const rebornPanel = document.getElementById("rebornPanel");
let rebornPanelState = "status"; // "status" | "choose"

rebornBtn?.addEventListener("click", () => toggleReborn());
function toggleReborn(force) {
  if (!rebornPanel) return;
  const show = (typeof force === "boolean") ? force : (rebornPanel.style.display !== "block");
  rebornPanel.style.display = show ? "block" : "none";
  if (show) renderRebornPanel();
}
function renderRebornPanel() {
  if (!rebornPanel) return;

  const maxReached = (player.rebornCount || 0) >= 3;
  const eligible = (player.level >= rebornQuest.requiredLevel) && !maxReached;
  const current = `<div class="reborn-row">Seu nível atual: <b>${player.level}</b> • Necessário: <b>${rebornQuest.requiredLevel}</b> • Reborns: <b>${player.rebornCount}/3</b></div>`;
  const rebornLabel = `<div class="reborn-row"><span class="reborn-big ${eligible ? "glow" : ""}">REBORN</span></div>`;
  const tip = maxReached
    ? `<div class="small" style="margin-top:6px;">Limite de Reborns atingido (3/3). Você já tem +75% XP do Reborn.</div>`
    : (!eligible
        ? `<div class="small" style="margin-top:6px;opacity:.85;">Continue evoluindo para liberar o Reborn.</div>`
        : (player.rebornCount===0
            ? `<div class="small" style="margin-top:6px;">Clique em prosseguir para escolher sua árvore (DPS ou TANK).</div>`
            : `<div class="small" style="margin-top:6px;">Prossegua para ganhar +25% XP (apenas multiplicador nas próximas renascenças).</div>`));

  // status ou escolha
  if (rebornPanelState === "status") {
    rebornPanel.innerHTML = `
      <h3>Reborn System</h3>
      ${current}
      ${rebornLabel}
      ${tip}
      <div class="reborn-row">
        <button id="rebornAction" ${eligible ? "" : "disabled"}>${eligible ? "Prosseguir" : "Indisponível"}</button>
        <button id="closeReborn" style="margin-left:8px;">Fechar</button>
      </div>`;
    document.getElementById("closeReborn")?.addEventListener("click", () => toggleReborn(false));
    const act = document.getElementById("rebornAction");
    if (act && eligible) {
      if (player.rebornCount === 0) {
        act.addEventListener("click", () => { rebornPanelState = "choose"; renderRebornPanel(); });
      } else {
        act.addEventListener("click", () => confirmReborn(null)); // apenas XP mult
      }
    }
  } else {
    // Escolha de classe (apenas no 1º Reborn)
    rebornPanel.innerHTML = `
      <h3>Escolha sua nova árvore</h3>
      <div class="choice-grid">
        <div class="choice" id="pickDPS">
          <b>DPS</b>
          <div class="small">• Multiplicador de projétil x1.25<br>• <u>Body Damage fica desativado</u> após o Reborn (exclusivo de TANK)</div>
        </div>
        <div class="choice" id="pickTANK">
          <b>TANK</b>
          <div class="small">• +25% de redução de dano adicional<br>• Escudo = 60% do seu HP (consumido antes da vida)<br>• Defesa é 25% mais efetiva no escudo<br>• Body Damage permanece disponível</div>
        </div>
      </div>
      <div class="reborn-row">
        <button id="backReborn" style="margin-top:8px;">Voltar</button>
      </div>`;
    document.getElementById("backReborn")?.addEventListener("click", () => { rebornPanelState = "status"; renderRebornPanel(); });
    document.getElementById("pickDPS")?.addEventListener("click", () => confirmReborn("DPS"));
    document.getElementById("pickTANK")?.addEventListener("click", () => confirmReborn("TANK"));
  }
}
function confirmReborn(cls) {
  const previousCount = player.rebornCount || 0;
  doReborn(cls, BASES, getSafeZones());

  // Atualiza multiplicadores depois do Reborn
  updateXpMult();
  playerDamageMult = (player.rebornClass==="DPS" ? 1.25 : 1.0) * (achievements.power8k ? 1.10 : 1.0);

  // Mensagem diferente se foi 1º Reborn (com escolha) ou somente XP
  if (previousCount === 0) {
    flashEvent(`Reborn concluído! Nova árvore: ${cls}`);
    rebornQuest.completed = true;
    rebornPanelState = "status";
  } else {
    flashEvent(`Reborn ${player.rebornCount}/3: +25% XP total agora +${player.rebornCount*25}%`);
  }

  renderRebornPanel();
  renderQuests();
  updateHUD();
}

/* ---------- Render ---------- */
function drawGrid() {
  const g = 64; ctx.strokeStyle="#2a2a2a"; ctx.lineWidth=1;
  let sx = -(cam.x % g); for (let x=sx; x<=viewW; x+=g){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,viewH); ctx.stroke(); }
  let sy = -(cam.y % g); for (let y=sy; y<=viewH; y+=g){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(viewW,y); ctx.stroke(); }
}
function drawPlayer() {
  const r = player.radius || 28;
  const sx = Math.floor(player.x - cam.x), sy = Math.floor(player.y - cam.y);
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fillStyle = player.color || "#4ccfff"; ctx.fill();

  // Barra de ESCUDO (se houver) acima da de HP
  if (player.shieldMax > 0) {
    const w=84, h=6;
    const pctS = Math.max(0, Math.min(1, player.shield / player.shieldMax));
    ctx.fillStyle="#000"; ctx.fillRect(sx - w/2, sy - r - 26, w, h);
    ctx.fillStyle="#7ec8ff"; ctx.fillRect(sx - w/2, sy - r - 26, w * pctS, h);
    ctx.strokeStyle="#111"; ctx.strokeRect(sx - w/2, sy - r - 26, w, h);
  }

  // Badge de Rank do jogador (centralizado)
  try {
    const pr = (typeof getCurrentRank === 'function') ? getCurrentRank() : null;
    const label = pr ? `Rank ${pr}` : `Sem Rank`;
    drawRankBadge(ctx, sx, sy - r - 46, label, {height:20});
  } catch(e){}

  // Barra de HP
  if (player.maxHp) {
    const w=84, h=8, pct=Math.max(0, Math.min(1, player.hp/player.maxHp));
    ctx.fillStyle="#000"; ctx.fillRect(sx - w/2, sy - r - 18, w, h);
    ctx.fillStyle="#2ecc71"; ctx.fillRect(sx - w/2, sy - r - 18, w * pct, h);
    ctx.strokeStyle="#111"; ctx.strokeRect(sx - w/2, sy - r - 18, w, h);
  }
}
function drawAchievementOverlays(){ drawAchievementIcons(); drawAchievementBanners(); drawMilestoneBadges(); }

function draw() {
  ctx.fillStyle = "#202020"; ctx.fillRect(0,0,viewW,viewH);
  drawGrid(); drawSafeZones(); drawBlocks(ctx, cam); drawEnemies(ctx, cam); drawPlayerBullets(ctx, cam); drawPlayer(); drawAchievementOverlays();

  if (rebornBtn) {
    const maxReached = (player.rebornCount || 0) >= 3;
    const eligible = (player.level >= rebornQuest.requiredLevel) && !maxReached;
    rebornBtn.className = eligible ? "glow" : "";
    rebornBtn.title = eligible ? "Pronto para renascer!" : (maxReached ? "Limite de Reborns atingido" : "Progrida até o nível 25");
  }
}

/* ---------- Loop ---------- */
let lastTime = performance.now();
function update() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - lastTime)/1000);
  lastTime = now;

  if (!rebornQuest.started && player.level >= 10) {
    rebornQuest.started = true;
  }

  if (player.alive) handleInput(dt);
  shootCD -= dt; if (isShooting) tryShoot();

  updateCollisions(dt);
  updateEnemies(dt, getSafeZones());
  updatePlayerBullets(dt);
  updateRespawn(dt);
  updateBlocksHitTimers(dt);
  updateRespawns(dt);

  // Rank: atualizar poder e bônus
  tickRankSystem();
  // Aplicar multiplicadores no dano do jogador (projétil/body)
  playerDamageMult = (player.rebornClass==="DPS" ? 1.25 : 1.0) * (achievements.power8k ? 1.10 : 1.0) * (player.rankDamageMult||1.0);

  centerCameraOnPlayer(); updateHUD(); renderQuests();
}
function gameLoop(){ update(); draw(); requestAnimationFrame(gameLoop); }

/* ---------- Resize ---------- */
window.addEventListener("resize", () => {
  viewW = window.innerWidth; viewH = window.innerHeight;
  canvas.width = viewW; canvas.height = viewH;
  MAP_W = viewW * 3; MAP_H = viewH * 3;
  centerCameraOnPlayer();
});

/* ---------- Start ---------- */
initGame();
updateXpMult(); // inicializa multiplicador de XP
gameLoop();

/* ---------- Rank UI ---------- */
rankBtn?.addEventListener("click", () => toggleRank());
function toggleRank(force){
  if (!rankPanel) return;
  const show = (typeof force === "boolean") ? force : (rankPanel.style.display !== "block");
  rankPanel.style.display = show ? "block" : "none";
  if (show) renderRankPanel();
}
function renderRankPanel(){
  if (!rankPanel) return;
  const unlocked = rankUnlocked();
  const cur = getCurrentRank() || "Sem Rank";
  const next = getNextRank();
  const pb = getPowerBreakdown();
  const need = next ? getRequiredPowerFor(next) : 0;
  const pct = next ? Math.max(0, Math.min(1, pb.total / need)) : 1;
  const can = next ? (pb.total >= need) : false;

  rankPanel.innerHTML = `
    <div class="title">Rank System</div>
    <div class="row"><b>Status:</b> ${unlocked ? "Desbloqueado" : "Bloqueado (Reborn 2 necessário)"}</div>
    <div class="row"><b>Rank Atual:</b> ${cur}${next ? ` &nbsp;•&nbsp; <span class="small">Próximo: ${next} (requer ${need} Poder)</span>` : ""}</div>
    <div class="row"><b>Poder de Combate:</b> ${pb.total}
      <div class="small">Skills: ${pb.skills} • Bosses: ${pb.bosses} • Conquistas: ${pb.achieves}</div>
      ${next ? `<div class="pbar"><div style="width:${Math.floor(pct*100)}%"></div></div>` : ""}
    </div>
    <div class="row">
      <button id="rankProgressBtn" ${unlocked && can ? "" : "disabled"}>${next ? `Progredir &raquo; Rank ${next}` : "Máximo atingido"}</button>
      <button id="rankCloseBtn" style="margin-left:8px;">Fechar</button>
    </div>`;
  document.getElementById("rankCloseBtn")?.addEventListener("click", () => toggleRank(false));
  const btn = document.getElementById("rankProgressBtn");
  if (btn && unlocked && can && next){
    btn.addEventListener("click", () => {
      const boss = startTrial(MAP_W, MAP_H, getSafeZones());
      if (boss){
        flashEvent(`Prova de Rank iniciada! Derrote o Boss para obter Rank ${next}.`);
        toggleRank(false);
      }
    });
  }
}
