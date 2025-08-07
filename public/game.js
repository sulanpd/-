// game.js — versão com XP, colisões, skills e HUD

import { player, resetPlayer, playerBaseStats, getPlayerDefPercent, getPlayerRegen, getPlayerBonusXP, xpToNext } from "./player.js";
import { enemies } from "./enemy.js";
import { blocks, BLOCK_TYPES, spawnBlock } from "./blocks.js";
import { clamp } from "./utils.js";

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

// ====== INPUT ======
const keys = new Set();
window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === "Escape") toggleSkills(false);
});
window.addEventListener("keyup",   (e) => keys.delete(e.key.toLowerCase()));

function handleInput(dt) {
  let vx = 0, vy = 0;
  if (keys.has("w") || keys.has("arrowup"))    vy -= 1;
  if (keys.has("s") || keys.has("arrowdown"))  vy += 1;
  if (keys.has("a") || keys.has("arrowleft"))  vx -= 1;
  if (keys.has("d") || keys.has("arrowright")) vx += 1;

  // normaliza
  if (vx !== 0 || vy !== 0) {
    const len = Math.hypot(vx, vy) || 1;
    vx /= len; vy /= len;
  }

  // slow por contato com blocos
  const slow = currentSlowFactor; // atualizado em updateCollisions()
  const spd = player.speed * (1 - slow) * 60 * dt;

  player.x += vx * spd;
  player.y += vy * spd;

  // limites do mapa
  const r = player.radius || 28;
  player.x = clamp(player.x, r, MAP_W - r);
  player.y = clamp(player.y, r, MAP_H - r);
}

// ====== SPAWN ======
function initGame() {
  resetPlayer(getSafeZones());
  // blocos de teste
  for (let i = 0; i < 25; i++) {
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

// ====== COLISÕES E COMBATE ======
let score = 0;
let currentSlowFactor = 0;

function updateCollisions(dt) {
  currentSlowFactor = 0;

  // Regen
  const regenRate = getPlayerRegen(); // fração por segundo
  if (regenRate > 0 && player.alive) {
    player.hp = Math.min(player.maxHp, player.hp + regenRate * player.maxHp * dt);
  }

  // Player x Blocos: slow + dano por contato; player "minera" o bloco
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type];
    if (!t) continue;

    const dx = b.x - player.x;
    const dy = b.y - player.y;
    const dist = Math.hypot(dx, dy);
    const overlap = (t.size/2 + player.radius) - dist;

    if (overlap > 0) {
      // slow e dano de contato do bloco
      currentSlowFactor = Math.max(currentSlowFactor, 1 - t.slow);

      // dano que o bloco causa ao player (por segundo), reduzido pela defesa total
      const def = getPlayerDefPercent();
      const dmgTick = t.dmg * (1 - def) * dt * 10; // *10 para tornar relevante
      player.hp -= dmgTick;

      // dano do player ao bloco (mineração por contato)
      b.hp -= Math.max(1, player.dmg) * dt;

      // se bloco morreu: XP + score
      if (b.hp <= 0 && b.alive) {
        b.alive = false;
        const baseXP = t.xp || 0;
        const gained = getPlayerBonusXP(baseXP);
        addXP(gained);
        score += Math.floor(baseXP);
      }
    }
  }

  // morte do player
  if (player.hp <= 0 && player.alive) {
    player.alive = false;
    player.respawnTimer = 2.5; // segundos
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
  player.points += 1; // 1 ponto por nível
  player.xpToNext = xpToNext(player.level);
  playerBaseStats(BASES);
  flashEvent(`Nível ${player.level}! +1 ponto de habilidade`);
}

function updateRespawn(dt) {
  if (!player.alive) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      // respawn
      resetPlayer(getSafeZones());
      playerBaseStats(BASES);
      showDeathMsg(false);
    }
  }
}

// ====== HUD / SKILLS ======
const hudHp   = document.getElementById("hp");
const hudLvl  = document.getElementById("level");
const hudScore= document.getElementById("score");
const btnSkills = document.getElementById("openSkills");
const spanPoints= document.getElementById("points");
const xpbarCt   = document.getElementById("xpbar-ct");
const xpbar     = document.getElementById("xpbar");
const skillsDiv = document.getElementById("skills");
const eventMsg  = document.getElementById("eventMsg");
const deathMsg  = document.getElementById("deathMsg");

btnSkills?.addEventListener("click", () => toggleSkills());

function toggleSkills(force=false) {
  const show = force === false ? (skillsDiv.style.display !== "block") : force;
  skillsDiv.style.display = show ? "block" : "none";
  if (show) renderSkills();
}

function renderSkills() {
  skillsDiv.innerHTML = `
    <h3>Habilidades</h3>
    <p>Pontos: <b>${player.points}</b></p>
    <div class="skills-grid">
      ${renderSkillRow("dmg",   "Dano")}
      ${renderSkillRow("def",   "Defesa")}
      ${renderSkillRow("hp",    "Vida")}
      ${renderSkillRow("regen", "Regeneração")}
      ${renderSkillRow("speed", "Velocidade")}
      ${renderSkillRow("mob",   "Mobilidade")}
    </div>
    <button id="closeSkills">Fechar</button>
  `;
  document.getElementById("closeSkills").onclick = () => toggleSkills(false);
  for (const k of ["dmg","def","hp","regen","speed","mob"]) {
    const btn = document.getElementById(`up_${k}`);
    if (btn) btn.onclick = () => upgradeSkill(k);
  }
}

function renderSkillRow(key, label) {
  const val = player.skill?.[key] ?? 0;
  return `
    <div class="skill-row">
      <span>${label}: <b>${val}</b></span>
      <button id="up_${key}">+1</button>
    </div>`;
}

function upgradeSkill(key) {
  if (player.points <= 0) return;
  if (!player.skill) player.skill = { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0 };
  player.skill[key] = (player.skill[key] || 0) + 1;
  player.points -= 1;
  playerBaseStats(BASES);
  renderSkills();
  updateHUD();
}

function updateHUD() {
  hudHp.textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
  hudLvl.textContent = player.level;
  hudScore.textContent = score;
  spanPoints.textContent = player.points;

  // barra de XP
  const pct = Math.max(0, Math.min(1, player.xp / player.xpToNext));
  xpbar.style.width = Math.floor(pct * 100) + "%";
}

function flashEvent(msg) {
  if (!eventMsg) return;
  eventMsg.textContent = msg;
  eventMsg.style.display = "block";
  setTimeout(() => { eventMsg.style.display = "none"; }, 1800);
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

function drawBlocks() {
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type];
    if (!t) continue;
    const sx = Math.floor(b.x - cam.x);
    const sy = Math.floor(b.y - cam.y);
    ctx.fillStyle = t.color;
    ctx.fillRect(sx - t.size/2, sy - t.size/2, t.size, t.size);
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

  // HP bar simples
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

function draw() {
  ctx.fillStyle = "#202020";
  ctx.fillRect(0, 0, viewW, viewH);

  drawGrid();
  drawBlocks();
  drawPlayer();
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

  // câmera
  centerCameraOnPlayer();
  // HUD
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
