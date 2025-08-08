import { player, resetPlayer, playerBaseStats, getPlayerRegen, getPlayerDefPercent, getPlayerBonusXP, xpToNext } from "./player.js";
import { enemies, spawnEnemy, spawnBoss, updateEnemies, drawEnemies } from "./enemy.js";
import { blocks, BLOCK_TYPES, spawnBlock, drawBlocks } from "./blocks.js";
import { playerBullets, spawnPlayerBullet, updatePlayerBullets, drawPlayerBullets } from "./projectiles.js";
import { clamp } from "./utils.js";

// ===== Canvas & Map =====
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let viewW = window.innerWidth, viewH = window.innerHeight;
canvas.width = viewW; canvas.height = viewH;
let MAP_W = viewW*3, MAP_H = viewH*3;
const cam = { x:0, y:0 };

// ===== Base Stats =====
const BASES = { BASE_HP:100, BASE_DMG:25, BASE_DEF:0, BASE_SPEED:3.2, BASE_MOB:1.0, BASE_BODY:10 };
playerBaseStats(BASES);

// ===== Safe Zones =====
export function getSafeZones(){
  return [
    { x: MAP_W*0.25, y: MAP_H*0.25, r: 160 },
    { x: MAP_W*0.75, y: MAP_H*0.25, r: 160 },
    { x: MAP_W*0.50, y: MAP_H*0.75, r: 160 }
  ];
}
function drawSafeZones(){
  ctx.save();
  ctx.setLineDash([8,8]);
  ctx.lineWidth = 2;
  for (const s of getSafeZones()){
    const sx = s.x - cam.x, sy = s.y - cam.y;
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI*2);
    ctx.fillStyle="rgba(50,200,120,0.10)"; ctx.fill();
    ctx.strokeStyle="rgba(80,255,160,0.75)"; ctx.stroke();
  }
  ctx.restore();
}

// ===== Input =====
const keys = new Set();
window.addEventListener("keydown", e => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup",   e => keys.delete(e.key.toLowerCase()));

canvas.addEventListener("mousedown", e => {
  if (!player.alive) return;
  const rect = canvas.getBoundingClientRect();
  const tx = cam.x + (e.clientX - rect.left);
  const ty = cam.y + (e.clientY - rect.top);
  spawnPlayerBullet(player.x, player.y, tx, ty, 16, Math.max(1, player.dmg));
});

let currentSlowFactor = 0;
function handleInput(dt){
  // freeze (skill 1 do boss)
  if (player.freezeTimer > 0) {
    player.freezeTimer -= dt;
    return;
  }
  let vx=0, vy=0;
  if (keys.has("w")||keys.has("arrowup"))    vy-=1;
  if (keys.has("s")||keys.has("arrowdown"))  vy+=1;
  if (keys.has("a")||keys.has("arrowleft"))  vx-=1;
  if (keys.has("d")||keys.has("arrowright")) vx+=1;
  if (vx||vy){ const l=Math.hypot(vx,vy)||1; vx/=l; vy/=l; }
  const spd = player.speed * (1 - currentSlowFactor) * (player.slowMult || 1) * 60 * dt;
  const r = player.radius || 28;
  player.x = clamp(player.x + vx*spd, r, MAP_W - r);
  player.y = clamp(player.y + vy*spd, r, MAP_H - r);
}

function centerCameraOnPlayer(){
  cam.x = clamp(player.x - viewW/2, 0, Math.max(0, MAP_W - viewW));
  cam.y = clamp(player.y - viewH/2, 0, Math.max(0, MAP_H - viewH));
}

// ===== Init =====
function initGame(){
  resetPlayer(getSafeZones());
  for (let i=0; i<50; i++){ // spawn dobrado
    spawnBlock("yellow", MAP_W, MAP_H, getSafeZones());
    spawnBlock("blue",   MAP_W, MAP_H, getSafeZones());
    spawnBlock("purple", MAP_W, MAP_H, getSafeZones());
  }
  // inimigos básicos iniciais
  for (let i=0;i<8;i++) spawnEnemy("basic", MAP_W, MAP_H, getSafeZones());
  centerCameraOnPlayer();
}

// ===== HUD =====
const hudHp=document.getElementById("hp");
const hudLvl=document.getElementById("level");
const hudScore=document.getElementById("score");
const spanPoints=document.getElementById("points");
const xpbar=document.getElementById("xpbar");
const eventMsg=document.getElementById("eventMsg");
const deathMsg=document.getElementById("deathMsg");

function updateHUD(){
  if (hudHp)   hudHp.textContent = `${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`;
  if (hudLvl)  hudLvl.textContent = player.level;
  if (hudScore)hudScore.textContent = score;
  if (spanPoints) spanPoints.textContent = player.points;
  if (xpbar) {
    const pct = Math.max(0, Math.min(1, player.xp / player.xpToNext));
    xpbar.style.width = Math.floor(pct*100) + "%";
  }
}
function flashEvent(msg){ if(!eventMsg) return; eventMsg.textContent=msg; eventMsg.style.display="block"; setTimeout(()=>eventMsg.style.display="none",3000); }
function showDeathMsg(show){ if(!deathMsg) return; deathMsg.style.display = show ? "block" : "none"; }

// ===== Score / XP =====
let score = 0;
let level10Shown = false;
function addXP(v){
  player.xp += v;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++; player.points++;
    player.xpToNext = xpToNext(player.level);
    playerBaseStats(BASES);
    if (player.level === 10 && !level10Shown){ level10Shown=true; flashEvent("Posso sentir sua presença"); }
    if (player.level >= 15) spawnEnemy("orange", MAP_W, MAP_H, getSafeZones());
    if (player.level >= 45 && !enemies.some(e => e.type==="boss")) spawnBoss(MAP_W, MAP_H, getSafeZones());
    flashEvent(`Nível ${player.level}! +1 ponto de habilidade`);
  }
}

// ===== Collisions =====
function updateCollisions(dt){
  currentSlowFactor = 0;

  // regen
  const regen = getPlayerRegen();
  if (regen>0 && player.alive) player.hp = Math.min(player.maxHp, player.hp + regen * player.maxHp * dt);

  // player vs blocks (contato) + break + xp
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type];
    const dx=b.x-player.x, dy=b.y-player.y, dist=Math.hypot(dx,dy);
    const overlap = (t.size/2 + (player.radius||28)) - dist;
    if (overlap>0){
      currentSlowFactor = Math.max(currentSlowFactor, 1 - t.slow);
      const def = getPlayerDefPercent();
      player.hp -= t.dmg * (1 - def) * dt * 10;
      b.hp -= Math.max(1, player.bodyDmg) * dt;
      if (b.hp <= 0) {
        b.alive=false;
        const baseXP=t.xp||0;
        addXP(getPlayerBonusXP(baseXP));
        score += Math.floor(baseXP);
      }
    }
  }

  // player bullets vs enemies / blocks
  for (const pb of playerBullets) {
    if (!pb.alive) continue;
    // enemies
    for (const e of enemies) {
      if (!e.alive) continue;
      const hit = Math.hypot(pb.x - e.x, pb.y - e.y) < (e.radius + 6);
      if (hit){
        const dmg = pb.damage * (1 - (e.dmgReduce || 0));
        e.hp -= dmg;
        pb.alive = false;
        if (e.hp <= 0) {
          e.alive = false;
          const xp = e.type==="boss" ? 250 : (e.type==="orange" ? 40 : 20);
          const sc = e.type==="boss" ? 500 : (e.type==="orange" ? 25 : 10);
          addXP(getPlayerBonusXP(xp)); score += sc; flashEvent(e.type==="boss"?"🏆 Boss derrotado!":"+XP");
        }
        break;
      }
    }
    if (!pb.alive) continue;
    // blocks
    for (const k of blocks) {
      if (!k.alive) continue;
      const half=(BLOCK_TYPES[k.type]?.size||40)/2;
      if (Math.abs(pb.x - k.x) <= half+6 && Math.abs(pb.y - k.y) <= half+6){
        k.hp -= pb.damage; pb.alive=false;
        if (k.hp<=0){ k.alive=false; const xp=BLOCK_TYPES[k.type]?.xp||0; addXP(getPlayerBonusXP(xp)); score += Math.floor(xp); }
        break;
      }
    }
  }

  // player vs enemies (body damage/contact)
  for (const e of enemies) {
    if (!e.alive) continue;
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist < (player.radius||28) + e.radius) {
      const def = getPlayerDefPercent();
      player.hp -= e.dmg * (1 - def) * dt;
      const dmgToEnemy = Math.max(1, player.bodyDmg) * (1 - (e.dmgReduce||0)) * dt;
      e.hp -= dmgToEnemy;
      if (e.hp <= 0) {
        e.alive = false;
        const xp = e.type==="boss" ? 250 : (e.type==="orange" ? 40 : 20);
        const sc = e.type==="boss" ? 500 : (e.type==="orange" ? 25 : 10);
        addXP(getPlayerBonusXP(xp)); score += sc;
      }
    }
  }

  if (player.hp <= 0 && player.alive) {
    player.alive=false; player.respawnTimer=2.5; showDeathMsg(true);
  }
}

function updateRespawn(dt){
  if (!player.alive){
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0){
      resetPlayer(getSafeZones());
      playerBaseStats(BASES);
      showDeathMsg(false);
    }
  }
}

// ===== Draw =====
function drawGrid(){
  const g=64; ctx.strokeStyle="#2a2a2a"; ctx.lineWidth=1;
  const sx = -(cam.x % g); for (let x=sx; x<=viewW; x+=g){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,viewH); ctx.stroke(); }
  const sy = -(cam.y % g); for (let y=sy; y<=viewH; y+=g){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(viewW,y); ctx.stroke(); }
}
function drawPlayer(){
  const r=player.radius||28, sx=Math.floor(player.x-cam.x), sy=Math.floor(player.y-cam.y);
  ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fillStyle=player.color||"#4ccfff"; ctx.fill();
  const w=80,h=8, pct=Math.max(0, Math.min(1, player.hp/player.maxHp));
  ctx.fillStyle="#000"; ctx.fillRect(sx-w/2, sy-r-18, w, h);
  ctx.fillStyle="#2ecc71"; ctx.fillRect(sx-w/2, sy-r-18, w*pct, h);
  ctx.strokeStyle="#111"; ctx.strokeRect(sx-w/2, sy-r-18, w, h);
}

function draw(){
  ctx.fillStyle="#202020"; ctx.fillRect(0,0,viewW,viewH);
  drawGrid(); drawSafeZones();
  drawBlocks(ctx, cam);
  drawEnemies(ctx, cam);
  drawPlayerBullets(ctx, cam);
  drawPlayer();
}

// ===== Loop =====
let lastTime = performance.now();
function update(){
  const now = performance.now();
  const dt = Math.min(0.033, (now - lastTime)/1000);
  lastTime = now;

  if (player.alive) handleInput(dt);
  updateCollisions(dt);
  updateEnemies(dt, getSafeZones());
  updatePlayerBullets(dt);
  updateRespawn(dt);

  centerCameraOnPlayer();
  updateHUD();
}

function gameLoop(){ update(); draw(); requestAnimationFrame(gameLoop); }

// ===== Resize =====
window.addEventListener("resize", ()=>{
  viewW = window.innerWidth; viewH = window.innerHeight;
  canvas.width=viewW; canvas.height=viewH;
  MAP_W=viewW*3; MAP_H=viewH*3;
  centerCameraOnPlayer();
});

// ===== Start =====
initGame();
gameLoop();
