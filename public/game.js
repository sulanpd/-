import { player, resetPlayer, playerBaseStats, getPlayerDefPercent, getPlayerRegen, getPlayerBonusXP, xpToNext } from "./player.js";
import { enemies, spawnEnemy, spawnBoss, updateEnemies, drawEnemies } from "./enemy.js";
import { blocks, BLOCK_TYPES, spawnBlock, updateBlocks, damageBlockByProjectile, drawBlocks } from "./blocks.js";
import { projectiles, circles, spawnProjectile, updateProjectiles, updateCircles, drawProjectiles, drawCircles } from "./projectiles.js";
import { clamp } from "./utils.js";

// ====== CANVAS ======
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let viewW = window.innerWidth;
let viewH = window.innerHeight;
canvas.width  = viewW;
canvas.height = viewH;

let MAP_W = viewW * 3;
let MAP_H = viewH * 3;

const cam = { x: 0, y: 0 };

// ====== BASES ======
const BASES = {
  BASE_HP:    100,
  BASE_DMG:   25,
  BASE_DEF:   0,
  BASE_SPEED: 3.2,
  BASE_MOB:   1.0,
  BASE_BODY:  10
};
playerBaseStats(BASES);

// ====== SAFE ZONES ======
function getSafeZones() {
  return [
    { x: MAP_W * 0.25, y: MAP_H * 0.25, r: 160 },
    { x: MAP_W * 0.75, y: MAP_H * 0.25, r: 160 },
    { x: MAP_W * 0.50, y: MAP_H * 0.75, r: 160 }
  ];
}
function drawSafeZones() {
  ctx.strokeStyle = "rgba(0,255,0,0.3)";
  ctx.lineWidth = 2;
  for (const s of getSafeZones()) {
    ctx.beginPath();
    ctx.arc(s.x - cam.x, s.y - cam.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ====== INPUT ======
const keys = new Set();
window.addEventListener("keydown", e => {
  keys.add(e.key.toLowerCase());
  if (e.key === " ") shoot();
});
window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));

function handleInput(dt) {
  let vx = 0, vy = 0;
  if (keys.has("w") || keys.has("arrowup"))    vy -= 1;
  if (keys.has("s") || keys.has("arrowdown"))  vy += 1;
  if (keys.has("a") || keys.has("arrowleft"))  vx -= 1;
  if (keys.has("d") || keys.has("arrowright")) vx += 1;

  if (vx !== 0 || vy !== 0) {
    const len = Math.hypot(vx, vy) || 1;
    vx /= len; vy /= len;
  }

  const slow = currentSlowFactor;
  const spd = player.speed * (1 - slow) * 60 * dt;
  player.x += vx * spd;
  player.y += vy * spd;

  const r = player.radius || 28;
  player.x = clamp(player.x, r, MAP_W - r);
  player.y = clamp(player.y, r, MAP_H - r);
}

// ====== SHOOT ======
let shootCooldown = 0;
function shoot() {
  if (shootCooldown > 0) return;
  const mouseX = cam.x + viewW / 2;
  const mouseY = cam.y + viewH / 2 - 50;
  spawnProjectile(player.x, player.y, mouseX, mouseY, 12, player.dmg, "normal");
  shootCooldown = 0.25;
}

// ====== INIT ======
function initGame() {
  resetPlayer(getSafeZones());
  for (let i = 0; i < 50; i++) { // spawn dobrado
    spawnBlock("yellow", MAP_W, MAP_H, getSafeZones());
    spawnBlock("blue",   MAP_W, MAP_H, getSafeZones());
    spawnBlock("purple", MAP_W, MAP_H, getSafeZones());
  }
  centerCameraOnPlayer();
}

function centerCameraOnPlayer() {
  cam.x = clamp(player.x - viewW / 2, 0, Math.max(0, MAP_W - viewW));
  cam.y = clamp(player.y - viewH / 2, 0, Math.max(0, MAP_H - viewH));
}

// ====== COMBATE / XP ======
let score = 0;
let currentSlowFactor = 0;
let level10MsgShown = false;

function updateGame(dt) {
  currentSlowFactor = 0;

  // Regen
  const regenRate = getPlayerRegen();
  if (regenRate > 0 && player.alive) {
    player.hp = Math.min(player.maxHp, player.hp + regenRate * player.maxHp * dt);
  }

  updateBlocks(dt);
  updateEnemies(dt, getSafeZones());
  updateProjectiles(dt);
  updateCircles(dt);

  // XP / Nível
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.points++;
    player.xpToNext = xpToNext(player.level);
    playerBaseStats(BASES);

    if (player.level === 10 && !level10MsgShown) {
      flashEvent("Posso sentir sua presença");
      level10MsgShown = true;
    }
    if (player.level >= 15) spawnEnemy("orange", MAP_W, MAP_H, getSafeZones());
    if (player.level >= 45 && !enemies.some(e => e.isBoss)) {
      spawnBoss(MAP_W, MAP_H, getSafeZones());
    }
  }

  if (shootCooldown > 0) shootCooldown -= dt;
}

function flashEvent(msg) {
  const eventMsg = document.getElementById("eventMsg");
  if (!eventMsg) return;
  eventMsg.textContent = msg;
  eventMsg.style.display = "block";
  setTimeout(() => eventMsg.style.display = "none", 3000);
}

// ====== DRAW ======
function draw() {
  ctx.fillStyle = "#202020";
  ctx.fillRect(0, 0, viewW, viewH);
  drawGrid();
  drawSafeZones();
  drawBlocks(ctx, cam);
  drawEnemies(ctx, cam);
  drawProjectiles(ctx, cam);
  drawCircles(ctx, cam);
  drawPlayer();
}

function drawGrid() {
  const gridSize = 64;
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1;
  const startX = - (cam.x % gridSize);
  for (let x = startX; x <= viewW; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewH);
    ctx.stroke();
  }
  const startY = - (cam.y % gridSize);
  for (let y = startY; y <= viewH; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(viewW, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const pr = player.radius || 28;
  const sx = Math.floor(player.x - cam.x);
  const sy = Math.floor(player.y - cam.y);

  ctx.beginPath();
  ctx.arc(sx, sy, pr, 0, Math.PI * 2);
  ctx.fillStyle = player.color || "#4ccfff";
  ctx.fill();
}

// ====== LOOP ======
let lastTime = performance.now();
function gameLoop() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (player.alive) handleInput(dt);
  updateGame(dt);
  centerCameraOnPlayer();
  draw();

  requestAnimationFrame(gameLoop);
}

// ====== RESIZE ======
window.addEventListener("resize", () => {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width  = viewW;
  canvas.height = viewH;
  centerCameraOnPlayer();
});

// ====== START ======
initGame();
gameLoop();
