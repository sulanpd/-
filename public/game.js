import { player, resetPlayer, playerBaseStats, getPlayerRegen, xpToNext } from "./player.js";
import { enemies, spawnEnemy, spawnBoss, updateEnemies, drawEnemies } from "./enemy.js";
import { blocks, BLOCK_TYPES, spawnBlock, updateBlocks, drawBlocks } from "./blocks.js";
import { spawnProjectile, updateProjectiles, updateCircles, drawProjectiles, drawCircles } from "./projectiles.js";
import { clamp } from "./utils.js";

// ====== CANVAS ======
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let viewW = window.innerWidth, viewH = window.innerHeight;
canvas.width = viewW; canvas.height = viewH;
let MAP_W = viewW * 3, MAP_H = viewH * 3;
const cam = { x: 0, y: 0 };

// ====== BASES ======
const BASES = { BASE_HP:100, BASE_DMG:25, BASE_DEF:0, BASE_SPEED:3.2, BASE_MOB:1.0, BASE_BODY:10 };
playerBaseStats(BASES);

// ====== SAFE ZONES ======
export function getSafeZones() {
  return [
    { x: MAP_W * 0.25, y: MAP_H * 0.25, r: 160 },
    { x: MAP_W * 0.75, y: MAP_H * 0.25, r: 160 },
    { x: MAP_W * 0.50, y: MAP_H * 0.75, r: 160 }
  ];
}
function drawSafeZones() {
  ctx.strokeStyle = "rgba(0,255,0,0.35)";
  ctx.lineWidth = 2;
  for (const s of getSafeZones()) {
    ctx.beginPath();
    ctx.arc(s.x - cam.x, s.y - cam.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ====== INPUT / TIRO ======
const keys = new Set();
window.addEventListener("keydown", e => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup",   e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const tx = cam.x + (e.clientX - rect.left);
  const ty = cam.y + (e.clientY - rect.top);
  spawnProjectile(player.x, player.y, tx, ty, 12, player.dmg, "normal");
});

let currentSlowFactor = 0;
function handleInput(dt) {
  let vx=0, vy=0;
  if (keys.has("w")||keys.has("arrowup"))    vy-=1;
  if (keys.has("s")||keys.has("arrowdown"))  vy+=1;
  if (keys.has("a")||keys.has("arrowleft"))  vx-=1;
  if (keys.has("d")||keys.has("arrowright")) vx+=1;
  if (vx||vy){ const l=Math.hypot(vx,vy)||1; vx/=l; vy/=l; }
  const spd = player.speed*(1-currentSlowFactor)*60*dt;
  player.x = clamp(player.x + vx*spd, player.radius||28, MAP_W-(player.radius||28));
  player.y = clamp(player.y + vy*spd, player.radius||28, MAP_H-(player.radius||28));
}

function centerCameraOnPlayer(){
  cam.x = clamp(player.x - viewW/2, 0, Math.max(0, MAP_W - viewW));
  cam.y = clamp(player.y - viewH/2, 0, Math.max(0, MAP_H - viewH));
}

// ====== INIT ======
function initGame() {
  resetPlayer(getSafeZones());
  for (let i=0;i<50;i++){
    spawnBlock("yellow", MAP_W, MAP_H, getSafeZones());
    spawnBlock("blue",   MAP_W, MAP_H, getSafeZones());
    spawnBlock("purple", MAP_W, MAP_H, getSafeZones());
  }
  centerCameraOnPlayer();
}

// ====== XP / LEVEL ======
function flashEvent(msg){
  const el = document.getElementById("eventMsg");
  if(!el) return; el.textContent = msg; el.style.display="block";
  setTimeout(()=>{ el.style.display="none"; }, 3000);
}

let level10Shown=false;
function levelTick() {
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++; player.points++;
    player.xpToNext = xpToNext(player.level);
    playerBaseStats(BASES);
    if (player.level === 10 && !level10Shown){ flashEvent("Posso sentir sua presença"); level10Shown=true; }
    if (player.level >= 15) spawnEnemy("orange", MAP_W, MAP_H, getSafeZones());
    if (player.level >= 45 && !enemies.some(e => e.type === "boss")) spawnBoss(MAP_W, MAP_H, getSafeZones());
    flashEvent(`Nível ${player.level}! +1 ponto de habilidade`);
  }
}

// ====== UPDATE ======
function updateGame(dt){
  currentSlowFactor = 0;

  const regen = getPlayerRegen();
  if (regen > 0 && player.alive) player.hp = Math.min(player.maxHp, player.hp + regen*player.maxHp*dt);

  updateBlocks(dt);             // dano de corpo-a-corpo nos blocos é tratado lá
  updateEnemies(dt, getSafeZones());
  updateProjectiles(dt);
  updateCircles(dt);

  levelTick();
}

function drawGrid(){
  const g=64;
  ctx.strokeStyle="#2a2a2a"; ctx.lineWidth=1;
  let sx = -(cam.x % g);
  for(let x=sx;x<=viewW;x+=g){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,viewH); ctx.stroke(); }
  let sy = -(cam.y % g);
  for(let y=sy;y<=viewH;y+=g){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(viewW,y); ctx.stroke(); }
}

function drawPlayer(){
  const r = player.radius||28, sx=Math.floor(player.x-cam.x), sy=Math.floor(player.y-cam.y);
  ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fillStyle=player.color||"#4ccfff"; ctx.fill();
}

// ====== LOOP ======
let lastTime = performance.now();
function gameLoop(){
  const now = performance.now();
  const dt = Math.min(0.033, (now-lastTime)/1000);
  lastTime = now;

  if (player.alive) handleInput(dt);
  updateGame(dt);
  centerCameraOnPlayer();

  ctx.fillStyle="#202020"; ctx.fillRect(0,0,viewW,viewH);
  drawGrid(); drawSafeZones();
  drawBlocks(ctx, cam);
  drawEnemies(ctx, cam);
  drawProjectiles(ctx, cam);
  drawCircles(ctx, cam);
  drawPlayer();

  requestAnimationFrame(gameLoop);
}

// ====== RESIZE ======
window.addEventListener("resize", () => {
  viewW = window.innerWidth; viewH = window.innerHeight;
  canvas.width=viewW; canvas.height=viewH;
  MAP_W = viewW*3; MAP_H = viewH*3;
  centerCameraOnPlayer();
});

// ====== START ======
initGame(); gameLoop();
