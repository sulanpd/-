import {
  player, resetPlayer, playerBaseStats, getPlayerRegen,
  getPlayerDefPercent, getPlayerBonusXP, xpToNext
} from "./player.js";
import {
  enemies, spawnEnemy, spawnBoss, updateEnemies, drawEnemies
} from "./enemy.js";
import {
  blocks, BLOCK_TYPES, spawnBlock, drawBlocks
} from "./blocks.js";
import {
  playerBullets, spawnPlayerBullet, updatePlayerBullets, drawPlayerBullets, setProjectileRangeMult
} from "./projectiles.js";
import { clamp } from "./utils.js";

/* ===================== Canvas & Mapa ===================== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let viewW = window.innerWidth, viewH = window.innerHeight;
canvas.width = viewW; canvas.height = viewH;

let MAP_W = viewW * 3, MAP_H = viewH * 3;
const cam = { x: 0, y: 0 };

/* ===================== Bases do Player ===================== */
const BASES = {
  BASE_HP: 100, BASE_DMG: 25, BASE_DEF: 0,
  BASE_SPEED: 3.2, BASE_MOB: 1.0, BASE_BODY: 10
};
playerBaseStats(BASES);

/* ===================== Safe Zones ===================== */
export function getSafeZones() {
  return [
    { x: MAP_W * 0.25, y: MAP_H * 0.25, r: 160 },
    { x: MAP_W * 0.75, y: MAP_H * 0.25, r: 160 },
    { x: MAP_W * 0.50, y: MAP_H * 0.75, r: 160 }
  ];
}
function drawSafeZones() {
  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  for (const s of getSafeZones()) {
    const sx = s.x - cam.x, sy = s.y - cam.y;
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(50,200,120,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(80,255,160,0.75)";
    ctx.stroke();
  }
  ctx.restore();
}

/* ===================== Input / Tiro (auto-fire) ===================== */
const keys = new Set();
let isShooting = false;
let shootCD = 0;              // cooldown em segundos
const FIRE_RATE = 0.18;       // ~5.5 tiros/s
let mouseWX = 0, mouseWY = 0; // posição do mouse no mundo

function updateMouseWorld(e){
  const rect = canvas.getBoundingClientRect();
  mouseWX = cam.x + (e.clientX - rect.left);
  mouseWY = cam.y + (e.clientY - rect.top);
}

window.addEventListener("keydown", e => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === "escape") toggleSkills(false);
});
window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));

canvas.addEventListener("mousedown", e => {
  if (!player.alive) return;
  updateMouseWorld(e);
  isShooting = true;
  tryShoot();
});
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
  if (player.freezeTimer > 0) {
    player.freezeTimer -= dt;
    return;
  }
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

/* ===================== Init ===================== */
function initGame() {
  resetPlayer(getSafeZones());
  // spawn inicial de blocos (dobrado)
  for (let i = 0; i < 50; i++) {
    spawnBlock("yellow", MAP_W, MAP_H, getSafeZones());
    spawnBlock("blue",   MAP_W, MAP_H, getSafeZones());
    spawnBlock("purple", MAP_W, MAP_H, getSafeZones());
  }
  // alguns inimigos básicos iniciais
  for (let i = 0; i < 8; i++) spawnEnemy("basic", MAP_W, MAP_H, getSafeZones());
  centerCameraOnPlayer();
}

/* ===================== HUD ===================== */
const hudHp      = document.getElementById("hp");
const hudLvl     = document.getElementById("level");
const hudScore   = document.getElementById("score");
const spanPoints = document.getElementById("points");
const xpbar      = document.getElementById("xpbar");
const eventMsg   = document.getElementById("eventMsg");
const deathMsg   = document.getElementById("deathMsg");

function updateHUD() {
  if (hudHp)    hudHp.textContent = `${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`;
  if (hudLvl)   hudLvl.textContent = player.level;
  if (hudScore) hudScore.textContent = score;
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

/* ===================== Skills UI (botão + Esc) ===================== */
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

  const rows = [
    ["dmg",  "Dano"],
    ["body", "Body Damage"],
    ["def",  "Defesa"],
    ["hp",   "Vida"],
    ["regen","Regeneração"],
    ["speed","Velocidade"],
    ["mob",  "Mobilidade"],
  ].map(([k, label]) => {
    const v = player.skill[k] || 0;
    return `
      <div class="skill-row">
        <span>${label}: <b>${v}</b></span>
        <button class="up-skill" data-k="${k}" ${player.points<=0 ? "disabled" : ""}>+1</button>
      </div>`;
  }).join("");

  skillsDiv.innerHTML = `
    <div class="skills-wrap">
      <h3>Habilidades</h3>
      <p>Pontos disponíveis: <b id="skillPoints">${player.points}</b></p>
      <div class="skills-grid">${rows}</div>
      <button id="closeSkills">Fechar</button>
    </div>
  `;

  document.getElementById("closeSkills")?.addEventListener("click", () => toggleSkills(false));
  skillsDiv.querySelectorAll(".up-skill").forEach(btn => {
    btn.addEventListener("click", () => upgradeSkill(btn.getAttribute("data-k")));
  });
}

function upgradeSkill(key) {
  if (player.points <= 0) return;
  if (!player.skill) player.skill = { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, body:0 };
  player.skill[key] = (player.skill[key] || 0) + 1;
  player.points -= 1;
  playerBaseStats(BASES);
  renderSkills();
  updateHUD();
}

/* ===================== Score / XP / Level & Conquistas ===================== */
let score = 0;
let level10Shown = false;

// conquistas (ícones e buffs)
const achievements = {
  brave: false,       // Coragem dos Fracos (aplicada após respawn)
  bravePending: false,
  power8k: false      // Um Poder de Mais de 8 mil
};
let xpMult = 1.0;
let playerDamageMult = 1.0;

function addXP(v) {
  player.xp += v * xpMult;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++; player.points++;
    player.xpToNext = xpToNext(player.level);
    playerBaseStats(BASES);

    // conquista "Um Poder de Mais de 8 mil" no lvl 35
    if (!achievements.power8k && player.level >= 35) {
      achievements.power8k = true;
      playerDamageMult = 1.10;         // +10% dano
      setProjectileRangeMult(1.35);    // +35% alcance
      flashEvent('Você obteve a conquista "Um Poder de Mais de 8 mil" (+10% dano, +35% alcance do projétil)');
      pushAchievementBanner("⚡ Um Poder de Mais de 8 mil", 3000);
    }

    if (player.level === 10 && !level10Shown) { level10Shown = true; flashEvent("Posso sentir sua presença"); }
    flashEvent(`Nível ${player.level}! +1 ponto de habilidade`);
  }
}

/* ===== Banners de Conquista (3s) e Ícones permanentes no canto ===== */
const activeBanners = []; // {text, until}
function pushAchievementBanner(text, ms=3000){
  activeBanners.push({ text, until: performance.now() + ms });
}
function drawAchievementBanners(){
  const now = performance.now();
  const y0 = 20;
  let y = y0;
  for (let i=activeBanners.length-1; i>=0; i--){
    const b = activeBanners[i];
    if (now > b.until) { activeBanners.splice(i,1); continue; }
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#111a";
    ctx.fillRect(viewW/2 - 180, y, 360, 34);
    ctx.strokeStyle="#44f"; ctx.strokeRect(viewW/2 - 180, y, 360, 34);
    ctx.fillStyle="#fff"; ctx.font="14px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(b.text, viewW/2, y+17);
    ctx.restore();
    y += 40;
  }
}
function drawAchievementIcons(){
  const icons = [];
  if (achievements.brave)  icons.push({emoji:"🏅", title:"+25% XP"});
  if (achievements.power8k) icons.push({emoji:"⚡", title:"+10% DMG + Alcance"});

  const x0 = 10, y0 = 10, size = 28, pad = 6;
  let x = x0;
  for (const ic of icons) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle="#1e1e1e"; ctx.fillRect(x, y0, size, size);
    ctx.strokeStyle="#66f"; ctx.strokeRect(x, y0, size, size);
    ctx.font="20px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(ic.emoji, x + size/2, y0 + size/2 + 1);
    ctx.restore();
    x += size + pad;
  }
}

/* ===================== Respawns (Timers + Limites) ===================== */
const LIMITS = { basic: 12, orange: 6, boss: 1, blocks: 80 };
const RESPAWN = { basic: 40, orange: 120, boss: 600, block: 2 }; // s

let accBasic = 0, accOrange = 0, accBoss = 0, accBlock = 0;

function updateRespawns(dt) {
  // Blocos — 1 a cada 2s se < 80
  accBlock += dt;
  if (accBlock >= RESPAWN.block) {
    accBlock -= RESPAWN.block;
    const aliveBlocks = blocks.filter(b => b.alive).length;
    if (aliveBlocks < LIMITS.blocks) {
      const types = ["yellow","blue","purple"];
      const type = types[(Math.random()*types.length)|0];
      spawnBlock(type, MAP_W, MAP_H, getSafeZones());
    }
  }

  // Básicos — 1 a cada 40s se < 12
  accBasic += dt;
  if (accBasic >= RESPAWN.basic) {
    accBasic -= RESPAWN.basic;
    const aliveBasics = enemies.filter(e => e.alive && e.type === "basic").length;
    if (aliveBasics < LIMITS.basic) {
      spawnEnemy("basic", MAP_W, MAP_H, getSafeZones()); // nível aleatório interno
    }
  }

  // Laranjas — 1 a cada 120s se < 6 e lvl >= 15
  if (player.level >= 15) {
    accOrange += dt;
    if (accOrange >= RESPAWN.orange) {
      accOrange -= RESPAWN.orange;
      const aliveOranges = enemies.filter(e => e.alive && e.type === "orange").length;
      if (aliveOranges < LIMITS.orange) {
        spawnEnemy("orange", MAP_W, MAP_H, getSafeZones()); // nível aleatório interno
      }
    }
  } else {
    accOrange = 0;
  }

  // Boss — 1 a cada 10 min, lvl >= 45, 1 vivo no máximo
  if (player.level >= 45) {
    accBoss += dt;
    if (accBoss >= RESPAWN.boss) {
      accBoss = 0;
      const aliveBoss = enemies.some(e => e.alive && e.type === "boss");
      if (!aliveBoss) {
        spawnBoss(MAP_W, MAP_H, getSafeZones()); // nível aleatório interno
        flashEvent("⚠️ Boss apareceu!");
      }
    }
  } else {
    accBoss = 0;
  }
}

/* ===================== Colisões / Combate ===================== */
function updateCollisions(dt) {
  currentSlowFactor = 0;

  // Regen
  const regen = getPlayerRegen();
  if (regen > 0 && player.alive) {
    player.hp = Math.min(player.maxHp, player.hp + regen * player.maxHp * dt);
  }

  // Player vs Blocks (contato) + DR e XP por nível
  for (const b of blocks) {
    if (!b.alive) continue;
    const t = BLOCK_TYPES[b.type];
    const dx = b.x - player.x, dy = b.y - player.y;
    const dist = Math.hypot(dx, dy);
    const overlap = (t.size/2 + (player.radius||28)) - dist;
    if (overlap > 0) {
      currentSlowFactor = Math.max(currentSlowFactor, 1 - t.slow);
      const def = getPlayerDefPercent();
      player.hp -= t.dmg * (1 - def) * dt * 10;

      // dano corpo-a-corpo sofre DR do bloco
      const eff = Math.max(0, 1 - (b.dmgReduce || 0));
      b.hp -= Math.max(1, player.bodyDmg) * playerDamageMult * eff * dt;

      if (b.hp <= 0) {
        b.alive = false;
        const xpGain = b.xpReward || (t.xp || 0);
        addXP(getPlayerBonusXP(xpGain));
        score += Math.floor(xpGain);
      }
    }
  }

  // Tiros do player vs Enemies / Blocks
  for (const pb of playerBullets) {
    if (!pb.alive) continue;

    // Inimigos
    for (const e of enemies) {
      if (!e.alive) continue;
      const hit = Math.hypot(pb.x - e.x, pb.y - e.y) < (e.radius + 6);
      if (hit) {
        const dmg = pb.damage * (1 - (e.dmgReduce || 0));
        e.hp -= dmg;
        pb.alive = false;
        if (e.hp <= 0) {
          e.alive = false;
          const xp = e.xpReward || 10;
          addXP(getPlayerBonusXP(xp));
          score += Math.floor(xp * 0.5);
          flashEvent(e.type === "boss" ? "🏆 Boss derrotado!" : "+XP");
          pushAchievementBanner(e.type === "boss" ? "🏆 Boss derrotado!" : "+XP", 1200);
        }
        break;
      }
    }
    if (!pb.alive) continue;

    // Blocos (considera DR do bloco)
    for (const k of blocks) {
      if (!k.alive) continue;
      const half = (BLOCK_TYPES[k.type]?.size || 40) / 2;
      if (Math.abs(pb.x - k.x) <= half + 6 && Math.abs(pb.y - k.y) <= half + 6) {
        const eff = Math.max(0, 1 - (k.dmgReduce || 0));
        k.hp -= pb.damage * eff;
        pb.alive = false;
        if (k.hp <= 0) {
          k.alive = false;
          const xp = k.xpReward || (BLOCK_TYPES[k.type]?.xp || 0);
          addXP(getPlayerBonusXP(xp)); score += Math.floor(xp);
        }
        break;
      }
    }
  }

  // Player vs Enemies (contato)
  for (const e of enemies) {
    if (!e.alive) continue;
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist < (player.radius||28) + e.radius) {
      const def = getPlayerDefPercent();
      player.hp -= e.dmg * (1 - def) * dt;
      const dmgToEnemy = Math.max(1, player.bodyDmg) * playerDamageMult * (1 - (e.dmgReduce || 0)) * dt;
      e.hp -= dmgToEnemy;
      if (e.hp <= 0) {
        e.alive = false;
        const xp = e.xpReward || 10;
        addXP(getPlayerBonusXP(xp)); score += Math.floor(xp * 0.5);
      }
    }
  }

  // Morte do player → apenas marca conquista "Coragem..." como pendente
  if (player.hp <= 0 && player.alive) {
    player.alive = false;
    player.respawnTimer = 2.5;
    showDeathMsg(true);

    if (!achievements.brave && player.level > 10) {
      achievements.bravePending = true; // só aplicará no respawn
    }
  }
}

function updateRespawn(dt) {
  if (!player.alive) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      resetPlayer(getSafeZones());
      playerBaseStats(BASES);
      showDeathMsg(false);

      // Concede "Coragem dos Fracos" no momento do respawn
      if (achievements.bravePending && !achievements.brave && player.level > 10) {
        achievements.bravePending = false;
        achievements.brave = true;
        xpMult = 1.25; // +25% XP
        flashEvent('Você obteve a conquista "Coragem dos Fracos" (+25% XP)');
        pushAchievementBanner("🏅 Coragem dos Fracos (+25% XP)", 3000);
      }
    }
  }
}

/* ===================== Respawns (Timers + Limites) ===================== */
const LIMITS = { basic: 12, orange: 6, boss: 1, blocks: 80 };
const RESPAWN = { basic: 40, orange: 120, boss: 600, block: 2 }; // s
let accBasic = 0, accOrange = 0, accBoss = 0, accBlock = 0;

function updateRespawns(dt) {
  // Blocos — 1 a cada 2s se < 80
  accBlock += dt;
  if (accBlock >= RESPAWN.block) {
    accBlock -= RESPAWN.block;
    const aliveBlocks = blocks.filter(b => b.alive).length;
    if (aliveBlocks < LIMITS.blocks) {
      const types = ["yellow","blue","purple"];
      const type = types[(Math.random()*types.length)|0];
      spawnBlock(type, MAP_W, MAP_H, getSafeZones());
    }
  }

  // Básicos — 1 a cada 40s se < 12
  accBasic += dt;
  if (accBasic >= RESPAWN.basic) {
    accBasic -= RESPAWN.basic;
    const aliveBasics = enemies.filter(e => e.alive && e.type === "basic").length;
    if (aliveBasics < LIMITS.basic) {
      spawnEnemy("basic", MAP_W, MAP_H, getSafeZones());
    }
  }

  // Laranjas — 1 a cada 120s se < 6 e lvl >= 15
  if (player.level >= 15) {
    accOrange += dt;
    if (accOrange >= RESPAWN.orange) {
      accOrange -= RESPAWN.orange;
      const aliveOranges = enemies.filter(e => e.alive && e.type === "orange").length;
      if (aliveOranges < LIMITS.orange) {
        spawnEnemy("orange", MAP_W, MAP_H, getSafeZones());
      }
    }
  } else {
    accOrange = 0;
  }

  // Boss — 1 a cada 10 min, lvl >= 45, 1 vivo no máximo
  if (player.level >= 45) {
    accBoss += dt;
    if (accBoss >= RESPAWN.boss) {
      accBoss = 0;
      const aliveBoss = enemies.some(e => e.alive && e.type === "boss");
      if (!aliveBoss) {
        spawnBoss(MAP_W, MAP_H, getSafeZones());
        flashEvent("⚠️ Boss apareceu!");
        pushAchievementBanner("⚠️ Boss apareceu!", 2000);
      }
    }
  } else {
    accBoss = 0;
  }
}

/* ===================== Render ===================== */
function drawGrid() {
  const g = 64;
  ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 1;
  let sx = -(cam.x % g);
  for (let x = sx; x <= viewW; x += g) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, viewH); ctx.stroke();
  }
  let sy = -(cam.y % g);
  for (let y = sy; y <= viewH; y += g) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewW, y); ctx.stroke();
  }
}

function drawPlayer() {
  const r = player.radius || 28;
  const sx = Math.floor(player.x - cam.x), sy = Math.floor(player.y - cam.y);
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fillStyle = player.color || "#4ccfff"; ctx.fill();
  if (player.maxHp) {
    const w = 80, h = 8;
    const pct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    ctx.fillStyle = "#000"; ctx.fillRect(sx - w/2, sy - r - 18, w, h);
    ctx.fillStyle = "#2ecc71"; ctx.fillRect(sx - w/2, sy - r - 18, w * pct, h);
    ctx.strokeStyle = "#111"; ctx.strokeRect(sx - w/2, sy - r - 18, w, h);
  }
}

function drawAchievementOverlays(){
  drawAchievementIcons();
  drawAchievementBanners();
}

function draw() {
  ctx.fillStyle = "#202020"; ctx.fillRect(0, 0, viewW, viewH);
  drawGrid();
  drawSafeZones();
  drawBlocks(ctx, cam);
  drawEnemies(ctx, cam);
  drawPlayerBullets(ctx, cam);
  drawPlayer();
  drawAchievementOverlays();
}

/* ===================== Loop ===================== */
let lastTime = performance.now();
function update() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (player.alive) handleInput(dt);

  // Auto-fire
  shootCD -= dt;
  if (isShooting) tryShoot();

  updateCollisions(dt);
  updateEnemies(dt, getSafeZones());
  updatePlayerBullets(dt);
  updateRespawn(dt);

  // timers de respawn com limites
  updateRespawns(dt);

  centerCameraOnPlayer();
  updateHUD();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

/* ===================== Resize ===================== */
window.addEventListener("resize", () => {
  viewW = window.innerWidth; viewH = window.innerHeight;
  canvas.width = viewW; canvas.height = viewH;
  MAP_W = viewW * 3; MAP_H = viewH * 3;
  centerCameraOnPlayer();
});

/* ===================== Start ===================== */
initGame();
gameLoop();
