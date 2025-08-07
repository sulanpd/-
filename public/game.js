// game.js — Safe zones visuais + inimigos (melee, shooters, projéteis, boss)

import {
  player, resetPlayer, playerBaseStats, getPlayerDefPercent,
  getPlayerRegen, getPlayerBonusXP, xpToNext
} from "./player.js";

import {
  enemies, shooterEnemies, shooterBullets, boss,
  ENEMY_SIZE, SHOOTER_SIZE, BOSS_SIZE,
  ENEMY_SPEED, SHOOTER_SPEED, BOSS_SPEED,
  ENEMY_DPS_CONTACT, SHOOTER_DPS_CONTACT, BOSS_DPS_CONTACT,
  SHOOTER_BULLET_DMG, SHOOTER_BULLET_SPEED, SHOOTER_FIRE_RATE,
  ENEMY_XP_KILL, SHOOTER_XP_KILL, BOSS_XP_KILL,
  ENEMY_SCORE, SHOOTER_SCORE, BOSS_SCORE,
  ENEMY_RESPAWN_MS, SHOOTER_RESPAWN_MS, BOSS_SPAWN_HP,
  spawnEnemy, spawnShooter, spawnBoss
} from "./enemy.js";

import { blocks, BLOCK_TYPES, spawnBlock } from "./blocks.js";
import { clamp } from "./utils.js";

// ====== CANVAS / MAPA / CÂMERA ======
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

function resizeCanvas() {
  let viewW = window.innerWidth;
  let viewH = window.innerHeight;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.style.width = viewW + "px";
  canvas.style.height = viewH + "px";
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { viewW, viewH };
}
let { viewW, viewH } = resizeCanvas();

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
const SAFE_ZONES = getSafeZones();

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

  if (vx !== 0 || vy !== 0) {
    const len = Math.hypot(vx, vy) || 1;
    vx /= len; vy /= len;
  }

  const spd = player.speed * (1 - currentSlowFactor) * 60 * dt;

  player.x += vx * spd;
  player.y += vy * spd;

  const r = player.radius || 28;
  player.x = clamp(player.x, r, MAP_W - r);
  player.y = clamp(player.y, r, MAP_H - r);
}

// ====== SPAWN INICIAL ======
function initGame() {
  resetPlayer(SAFE_ZONES);

  // blocos
  for (let i = 0; i < 25; i++) {
    spawnBlock("yellow", MAP_W, MAP_H, SAFE_ZONES);
    spawnBlock("blue",   MAP_W, MAP_H, SAFE_ZONES);
    spawnBlock("purple", MAP_W, MAP_H, SAFE_ZONES);
  }

  // alguns inimigos iniciais
  for (let i = 0; i < 8; i++) spawnEnemy(MAP_W, MAP_H, SAFE_ZONES);
  for (let i = 0; i < 4; i++) spawnShooter(MAP_W, MAP_H, SAFE_ZONES);

  centerCameraOnPlayer();
}
function centerCameraOnPlayer() {
  cam.x = clamp(player.x - viewW / 2, 0, Math.max(0, MAP_W - viewW));
  cam.y = clamp(player.y - viewH / 2, 0, Math.max(0, MAP_H - viewH));
}

// ====== COLISÕES / COMBATE (BLOCOS) ======
let score = 0;
let currentSlowFactor = 0;

function updateCollisionsBlocks(dt) {
  currentSlowFactor = 0;

  // regen passiva
  const regenRate = getPlayerRegen();
  if (regenRate > 0 && player.alive) {
    player.hp = Math.min(player.maxHp, player.hp + regenRate * player.maxHp * dt);
  }

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

      b.hp -= Math.max(1, player.dmg) * dt;

      if (b.hp <= 0 && b.alive) {
        b.alive = false;
        const baseXP = t.xp || 0;
        const gained = getPlayerBonusXP(baseXP);
        addXP(gained);
        score += Math.floor(baseXP);
      }
    }
  }
}

// ====== INIMIGOS ======
let enemyRespawnTimer   = ENEMY_RESPAWN_MS * 0.5;   // começa mais cedo
let shooterRespawnTimer = SHOOTER_RESPAWN_MS * 0.5;

function moveTowards(obj, tx, ty, speed, dt) {
  const dx = tx - obj.x;
  const dy = ty - obj.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  obj.x += ux * speed * 60 * dt;
  obj.y += uy * speed * 60 * dt;
}

function keepDistance(obj, tx, ty, desired, speed, dt) {
  const dx = tx - obj.x;
  const dy = ty - obj.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d < desired) {
    // afasta
    obj.x -= (dx / d) * speed * 60 * dt;
    obj.y -= (dy / d) * speed * 60 * dt;
  } else if (d > desired * 1.2) {
    // aproxima um pouco
    obj.x += (dx / d) * speed * 60 * dt;
    obj.y += (dy / d) * speed * 60 * dt;
  }
}

function fireShooter(sh) {
  const dx = player.x - sh.x;
  const dy = player.y - sh.y;
  const d  = Math.hypot(dx, dy) || 1;
  const vx = (dx / d) * SHOOTER_BULLET_SPEED;
  const vy = (dy / d) * SHOOTER_BULLET_SPEED;
  shooterBullets.push({ x: sh.x, y: sh.y, vx, vy, alive: true, life: 2.8 }); // 2.8s de vida
}

function updateEnemies(dt) {
  // normais: perseguem e causam dano por contato
  for (const e of enemies) {
    if (!e.alive) continue;
    moveTowards(e, player.x, player.y, ENEMY_SPEED, dt);

    // contato
    const rSum = player.radius + ENEMY_SIZE/2;
    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    if (dist < rSum) {
      const def = getPlayerDefPercent();
      player.hp -= ENEMY_DPS_CONTACT * (1 - def) * dt;

      // player causa dano por contato
      e.hp -= Math.max(1, player.dmg) * dt;
      if (e.hp <= 0) {
        e.alive = false;
        addXP(getPlayerBonusXP(ENEMY_XP_KILL));
        score += ENEMY_SCORE;
      }
    }
  }

  // atiradores: mantêm distância e disparam
  for (const s of shooterEnemies) {
    if (!s.alive) continue;
    keepDistance(s, player.x, player.y, 280, SHOOTER_SPEED, dt);

    // contato também machuca (menos)
    const rSum = player.radius + SHOOTER_SIZE/2;
    const dist = Math.hypot(s.x - player.x, s.y - player.y);
    if (dist < rSum) {
      const def = getPlayerDefPercent();
      player.hp -= SHOOTER_DPS_CONTACT * (1 - def) * dt;
      s.hp -= Math.max(1, player.dmg) * dt;
      if (s.hp <= 0) {
        s.alive = false;
        addXP(getPlayerBonusXP(SHOOTER_XP_KILL));
        score += SHOOTER_SCORE;
      }
    }

    // tiros
    s.fireTimer -= dt * SHOOTER_FIRE_RATE;
    if (s.fireTimer <= 0) {
      s.fireTimer += 1;
      fireShooter(s);
    }
  }

  // projéteis
  for (const b of shooterBullets) {
    if (!b.alive) continue;
    b.x += b.vx * 60 * dt;
    b.y += b.vy * 60 * dt;
    b.life -= dt;
    if (b.life <= 0) { b.alive = false; continue; }

    // colisão com player
    const dist = Math.hypot(b.x - player.x, b.y - player.y);
    if (dist < player.radius + 6) {
      const def = getPlayerDefPercent();
      player.hp -= SHOOTER_BULLET_DMG * (1 - def);
      b.alive = false;
    }
  }

  // boss (spawna quando pontuação atingir limiar e ainda não existe)
  if (!boss && score >= 500) {
    spawnBoss(MAP_W, MAP_H, SAFE_ZONES);
    flashEvent("⚠️ Boss apareceu!");
  }

  if (boss && boss.alive) {
    moveTowards(boss, player.x, player.y, BOSS_SPEED, dt);

    // contato
    const rSum = player.radius + BOSS_SIZE/2;
    const dist = Math.hypot(boss.x - player.x, boss.y - player.y);
    if (dist < rSum) {
      const def = getPlayerDefPercent();
      player.hp -= BOSS_DPS_CONTACT * (1 - def) * dt;
      const dmgToBoss = Math.max(1, player.dmg) * (1 - (boss.dmgReduce || 0));
      boss.hp -= dmgToBoss * dt;
    }

    if (boss.hp <= 0) {
      boss.alive = false;
      addXP(getPlayerBonusXP(BOSS_XP_KILL));
      score += BOSS_SCORE;
      flashEvent("🏆 Boss derrotado!");
    }
  }

  // respawn timers simples
  enemyRespawnTimer -= dt * 1000;
  shooterRespawnTimer -= dt * 1000;

  if (enemyRespawnTimer <= 0) {
    enemyRespawnTimer = ENEMY_RESPAWN_MS;
    for (let i = 0; i < 4; i++) spawnEnemy(MAP_W, MAP_H, SAFE_ZONES);
  }
  if (shooterRespawnTimer <= 0) {
    shooterRespawnTimer = SHOOTER_RESPAWN_MS;
    for (let i = 0; i < 2; i++) spawnShooter(MAP_W, MAP_H, SAFE_ZONES);
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
}
function updateRespawn(dt) {
  if (!player.alive) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      resetPlayer(SAFE_ZONES);
      playerBaseStats(BASES);
      showDeathMsg(false);
    }
  }
}

// ====== HUD / SKILLS ======
const hudHp      = document.getElementById("hp");
const hudLvl     = document.getElementById("level");
const hudScore   = document.getElementById("score");
const btnSkills  = document.getElementById("openSkills");
const spanPoints = document.getElementById("points");
const xpbar      = document.getElementById("xpbar");
const skillsDiv  = document.getElementById("skills");
const eventMsg   = document.getElementById("eventMsg");
const deathMsg   = document.getElementById("deathMsg");

btnSkills?.addEventListener("click", () => toggleSkills());

function toggleSkills(force = false) {
  const show = force === false ? (skillsDiv?.style.display !== "block") : force;
  if (!skillsDiv) return;
  skillsDiv.style.display = show ? "block" : "none";
  if (show) renderSkills();
}
function renderSkills() {
  if (!skillsDiv) return;
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
    <button id="closeSkills" class="skill-btn">Fechar</button>
  `;
  document.getElementById("closeSkills")?.addEventListener("click", () => toggleSkills(false));
  for (const k of ["dmg","def","hp","regen","speed","mob"]) {
    document.getElementById(`up_${k}`)?.addEventListener("click", () => upgradeSkill(k));
  }
}
function renderSkillRow(key, label) {
  const val = player.skill?.[key] ?? 0;
  return `
    <div class="skill-row">
      <span>${label}: <b>${val}</b></span>
      <button id="up_${key}" class="skill-btn">+1</button>
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
  if (hudHp)     hudHp.textContent = `${Math.ceil(Math.max(0, player.hp))}/${player.maxHp}`;
  if (hudLvl)    hudLvl.textContent = player.level;
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
  setTimeout(() => { eventMsg.style.display = "none"; }, 1800);
}
function showDeathMsg(show) {
  if (!deathMsg) return;
  deathMsg.textContent = show ? "Você Morreu!" : "";
  deathMsg.style.display = show ? "block" : "none";
}

// ====== DRAW ======
function drawSafeZones() {
  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  for (const z of SAFE_ZONES) {
    const sx = z.x - cam.x;
    const sy = z.y - cam.y;
    ctx.beginPath();
    ctx.arc(sx, sy, z.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(50,200,120,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(80,255,160,0.75)";
    ctx.stroke();
  }
  ctx.restore();
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

function drawHPBar(sx, sy, w, h, pct) {
  ctx.fillStyle = "#000";
  ctx.fillRect(sx - w/2, sy - h - 14, w, h);
  ctx.fillStyle = "#2ecc71";
  ctx.fillRect(sx - w/2, sy - h - 14, w * pct, h);
  ctx.strokeStyle = "#111";
  ctx.strokeRect(sx - w/2, sy - h - 14, w, h);
}

function drawEnemies() {
  // normais (vermelho)
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx = Math.floor(e.x - cam.x);
    const sy = Math.floor(e.y - cam.y);
    ctx.fillStyle = "#f35555";
    ctx.beginPath();
    ctx.arc(sx, sy, ENEMY_SIZE/2, 0, Math.PI * 2);
    ctx.fill();

    const pct = Math.max(0, Math.min(1, e.hp / 160));
    drawHPBar(sx, sy - ENEMY_SIZE/2, 60, 6, pct);
  }

  // atiradores (laranja)
  for (const s of shooterEnemies) {
    if (!s.alive) continue;
    const sx = Math.floor(s.x - cam.x);
    const sy = Math.floor(s.y - cam.y);
    ctx.fillStyle = "#ff9c40";
    ctx.beginPath();
    ctx.arc(sx, sy, SHOOTER_SIZE/2, 0, Math.PI * 2);
    ctx.fill();

    const pct = Math.max(0, Math.min(1, s.hp / 210));
    drawHPBar(sx, sy - SHOOTER_SIZE/2, 70, 6, pct);
  }

  // boss (vinho escuro)
  if (boss && boss.alive) {
    const sx = Math.floor(boss.x - cam.x);
    const sy = Math.floor(boss.y - cam.y);
    ctx.fillStyle = "#731c2e";
    ctx.beginPath();
    ctx.arc(sx, sy, BOSS_SIZE/2, 0, Math.PI * 2);
    ctx.fill();

    const pct = Math.max(0, Math.min(1, boss.hp / BOSS_SPAWN_HP));
    drawHPBar(sx, sy - BOSS_SIZE/2, 160, 10, pct);
    // anel indicando redução de dano
    ctx.strokeStyle = "rgba(255,255,0,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, BOSS_SIZE/2 + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBullets() {
  ctx.fillStyle = "#ffffff";
  for (const b of shooterBullets) {
    if (!b.alive) continue;
    const sx = Math.floor(b.x - cam.x);
    const sy = Math.floor(b.y - cam.y);
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();
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
  drawSafeZones();     // <-- visuais das Safe Zones
  drawBlocks();
  drawEnemies();
  drawBullets();
  drawPlayer();
}

// ====== UPDATE / LOOP ======
let lastTime = performance.now();
function update() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (player.alive) handleInput(dt);
  updateCollisionsBlocks(dt);
  updateEnemies(dt);

  if (player.hp <= 0 && player.alive) {
    player.alive = false;
    player.respawnTimer = 2.5;
    showDeathMsg(true);
  }
  updateRespawn(dt);

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
  ({ viewW, viewH } = resizeCanvas());
  MAP_W = viewW * 3;
  MAP_H = viewH * 3;
  // recomputa safe zones no novo mapa
  SAFE_ZONES.length = 0;
  for (const z of getSafeZones()) SAFE_ZONES.push(z);
  centerCameraOnPlayer();
});

// ====== START ======
initGame();
gameLoop();
