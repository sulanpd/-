import { player, resetPlayer, playerBaseStats, getPlayerDefPercent, getPlayerRegen, getPlayerBonusXP, xpToNext, shoot, updateShots, drawShots } from "./player.js";
import { enemies, spawnEnemy, spawnBoss, updateEnemies, drawEnemies } from "./enemy.js";
import { blocks, BLOCK_TYPES, spawnBlock } from "./blocks.js";
import { clamp } from "./utils.js";
import { projectiles, circles, spawnProjectile, updateProjectiles, updateCircles, drawProjectiles, drawCircles } from "./projectiles.js";

// ====== CANVAS / MAPA / CÂMERA ======
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let viewW = window.innerWidth;
let viewH = window.innerHeight;
canvas.width  = viewW;
canvas.height = viewH;

let MAP_W = viewW * 3;
let MAP_H = viewH * 3;

const cam = { x: 0, y: 0 };

// ====== BASES DO PLAYER ======
const BASES = {
  BASE_HP:    100,
  BASE_DMG:   25,
  BASE_DEF:   0,
  BASE_SPEED: 3.2,
  BASE_MOB:   1.0
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
  ctx.strokeStyle = "rgba(0,255,0,0.4)";
  ctx.lineWidth = 3;
  for (const z of getSafeZones()) {
    ctx.beginPath();
    ctx.arc(z.x - cam.x, z.y - cam.y, z.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ====== INPUT ======
const keys = new Set();
window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === "Escape") toggleSkills(false);
});
window.addEventListener("keyup",   (e) => keys.delete(e.key.toLowerCase()));

canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const tx = e.clientX - rect.left + cam.x;
  const ty = e.clientY - rect.top + cam.y;
  shoot(tx, ty);
});

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

// ====== SPAWN ======
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

// ====== COLISÕES / COMBATE ======
let score = 0;
let currentSlowFactor = 0;

function updateCollisions(dt) {
  currentSlowFactor = 0;

  const regenRate = getPlayerRegen();
  if (regenRate > 0 && player.alive) {
    player.hp = Math.min(player.maxHp, player.hp + regenRate * player.maxHp * dt);
  }

  // colisão com blocos
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type];
    if (!t) continue;

    const dx = b.x - player.x;
    const dy = b.y - player.y;
    const dist = Math.hypot(dx, dy);
    const overlap = (t.size/2 + player.radius) - dist;

    if (overlap > 0) {
      currentSlowFactor = Math.max(currentSlowFactor, 1 - t.slow);

      const def = getPlayerDefPercent();
      const dmgTick = t.dmg * (1 - def) * dt * 10;
      player.hp -= dmgTick;

      b.hp -= Math.max(1, player.bodyDmg) * dt;

      if (b.hp <= 0 && b.alive) {
        b.alive = false;
        const baseXP = t.xp || 0;
        const gained = getPlayerBonusXP(baseXP);
        addXP(gained);
        score += Math.floor(baseXP);
      }
    }
  }

  if (player.hp <= 0 && player.alive) {
    player.alive = false;
    player.respawnTimer = 2.5;
    showDeathMsg(true);
  }
}

// ====== XP / LEVEL ======
function addXP(amt) {
  player.xp += amt;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    levelUp();
  }
}

function levelUp() {
  player.level += 1;
  player.points += 1;
  player.xpToNext = xpToNext(player.level);
  playerBaseStats(BASES);
  flashEvent(`Nível ${player.level}! +1 ponto de habilidade`);
  if (player.level === 10) flashEvent("Posso sentir sua presença");
}

function updateRespawn(dt) {
  if (!player.alive) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      resetPlayer(getSafeZones());
      playerBaseStats(BASES);
      showDeathMsg(false);
    }
  }
}

// ====== HUD / SKILLS ======
const hudHp     = document.getElementById("hp");
const hudLvl    = document.getElementById("level");
const hudScore  = document.getElementById("score");
const spanPoints= document.getElementById("points");
const xpbar     = document.getElementById("xpbar");
const skillsDiv = document.getElementById("skills");
const eventMsg  = document.getElementById("eventMsg");
const deathMsg  = document.getElementById("deathMsg");

function toggleSkills(force=false) {
  const show = force === false ? (skillsDiv?.style.display !== "block") : force;
  if (!skillsDiv) return;
  skillsDiv.style.display = show ? "block" : "none";
}

function updateHUD() {
  if (hudHp)   hudHp.textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
  if (hudLvl)  hudLvl.textContent = player.level;
  if (hudScore)  hudScore.textContent = score;
  if (spanPoints) spanPoints.textContent = player.points;
  if (xpbar) {
    const pct = Math.max(0, Math.min(1, player.xp / player.xpToNext));
    xpbar.style.width = Math.floor(pct * 100) + "%";
  }
}

function flashEvent(msg) {
  if (!eventMsg) return;
  eventMsg.textContent = msg;
  eventMsg.style.display = "block";
  setTimeout(() => { eventMsg.style.display = "none"; }, 3000);
}

function showDeathMsg(show) {
  if (!deathMsg) return;
  deathMsg.style.display = show ? "block" : "none";
}

// ====== DRAW ======
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

function draw() {
  ctx.fillStyle = "#202020";
  ctx.fillRect(0, 0, viewW, viewH);

  drawGrid();
  drawSafeZones();
  drawEnemies(ctx, cam);
  drawProjectiles(ctx, cam);
  drawCircles(ctx, cam);
  drawShots(ctx, cam);

  // player
  const pr = player.radius || 28;
  const sx = Math.floor(player.x - cam.x);
  const sy = Math.floor(player.y - cam.y);
  ctx.beginPath();
  ctx.arc(sx, sy, pr, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  if (player.maxHp) {
    const w = 80, h = 8;
    const hpPct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    ctx.fillStyle = "#000";
    ctx.fillRect(sx - w/2, sy - pr - 18, w, h);
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(sx - w/2, sy - pr - 18, w * hpPct, h);
    ctx.strokeStyle = "#111";
    ctx.strokeRect(sx - w/2, sy - pr - 18, w, h);
  }
}

// ====== UPDATE / LOOP ======
let lastTime = performance.now();
function update() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (player.alive) handleInput(dt);
  updateCollisions(dt);
  updateRespawn(dt);
  updateShots(dt, MAP_W, MAP_H);
  updateProjectiles(dt);
  updateCircles(dt);
  updateEnemies(dt, player, getSafeZones());

  centerCameraOnPlayer();
  updateHUD();
}

function gameLoop() {
  update();
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
