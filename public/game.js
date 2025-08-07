// game.js

// IMPORTAÇÕES DOS MÓDULOS
import { player, resetPlayer, getPlayerRegen, getPlayerDefPercent, getPlayerDmgMultiplier, getPlayerBonusDmg, getPlayerBonusDmgReduce, getPlayerBonusXP, playerBaseStats, xpToNext } from "./player.js";
import { enemies, shooterEnemies, shooterBullets, boss, ENEMY_SIZE, SHOOTER_SIZE, BOSS_SIZE, ENEMY_RESPAWN_MS, SHOOTER_RESPAWN_MS, SHOOTER_FIRE_RATE, SHOOTER_DMG, SHOOTER_BULLET_SPEED, BOSS_SPAWN_HP, BOSS_DMG, BOSS_HIT_RATE, spawnEnemy, spawnShooter, spawnBoss } from "./enemy.js";
import { blocks, BLOCK_TYPES, spawnBlock } from "./blocks.js";
import { clamp, isInSafeZone } from "./utils.js";

// ======= CONSTANTES BASE (para stats do player)
export const BASES = {
    BASE_HP: 100,
    BASE_DMG: 25,
    BASE_SPEED: 3.2,
    BASE_DEF: 0,
    BASE_MOB: 1.0
};

// ======= CANVAS E ELEMENTOS DE UI =======
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const viewW = window.innerWidth, viewH = window.innerHeight;
canvas.width = viewW;
canvas.height = viewH;

// Dimensões do mapa (ajuste conforme seu gosto)
export const MAP_W = viewW * 3;
export const MAP_H = viewH * 3;

// Zonas seguras (mesmo conceito de antes)
export const SAFE_ZONES = [
    { x: MAP_W / 2, y: MAP_H / 2, r: 160 },                 // centro do mapa
    { x: 250, y: 250, r: 160 },                             // canto superior esquerdo
    { x: MAP_W - 250, y: MAP_H - 250, r: 160 }              // canto inferior direito
];

// Variáveis de controle do loop e camera
const cam = { x: 0, y: 0 };
let mouseX = viewW / 2, mouseY = viewH / 2;

// Elementos de UI
const scoreDiv = document.getElementById('score');
const pointsSpan = document.getElementById('points');
const xpbar = document.getElementById('xpbar');
const skillsDiv = document.getElementById('skills');
const openSkills = document.getElementById('openSkills');
const deathMsg = document.getElementById('deathMsg');
const eventMsg = document.getElementById('eventMsg');
const dmgReduceIcon = document.getElementById('dmgReduceIcon');
const conquestDiv = document.getElementById('conquests');

// ====== BALAS DO PLAYER ======
let bullets = [];
export const BULLET_SPEED = 10;
export const BULLET_LIFE = 38;

// ====== OUTRAS VARIÁVEIS ======
let msgQueue = [], msgTime = 0;
let conquestMsgQueue = [];
let shooterUnlocked = false, bossUnlocked = false, bossMsg1 = false, bossMsg2 = false;
let BOSS_SPAWNED = { spawned: false, killed: false };

// ====== CONTROLES ======
const keys = {};
document.addEventListener('keydown', e => {
    if (e.key === "Escape") skillsDiv.style.display = "none";
    keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});
// game.js — Bloco 2

// ===== SPAWN INICIAL DOS BLOCOS =====
for (let i = 0; i < 14; i++) spawnBlock("yellow", MAP_W, MAP_H, SAFE_ZONES);
for (let i = 0; i < 4; i++) spawnBlock("blue", MAP_W, MAP_H, SAFE_ZONES);
for (let i = 0; i < 2; i++) spawnBlock("purple", MAP_W, MAP_H, SAFE_ZONES);

// ===== SPAWN INICIAL DOS INIMIGOS =====
for (let i = 0; i < 15; i++) spawnEnemy(MAP_W, MAP_H, SAFE_ZONES);

// ===== INICIALIZA O PLAYER NO CENTRO DA SAFE =====
resetPlayer(SAFE_ZONES);
cam.x = clamp(player.x - viewW / 2, 0, MAP_W - viewW);
cam.y = clamp(player.y - viewH / 2, 0, MAP_H - viewH);
playerBaseStats(BASES);

// ====== MENSAGENS DE EVENTO ======
function showEventMsg(msg, duration = 3) {
    msgQueue.push({ msg: msg, t: duration });
}

function showConquestMsg(msg, duration = 5) {
    conquestMsgQueue.push({ msg, t: duration });
}

// ===== AJUSTA O TAMANHO DO CANVAS NO RESIZE =====
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
// game.js — Bloco 3

// ======= ATIRAR (MOUSE) =======
document.addEventListener('mousedown', e => {
    if (!player.alive || e.button !== 0) return;
    let dx = mouseX - (player.x - cam.x), dy = mouseY - (player.y - cam.y);
    let angle = Math.atan2(dy, dx);
    bullets.push({
        x: player.x + Math.cos(angle) * (player.radius + 15),
        y: player.y + Math.sin(angle) * (player.radius + 15),
        dx: Math.cos(angle) * BULLET_SPEED * player.mob,
        dy: Math.sin(angle) * BULLET_SPEED * player.mob,
        life: BULLET_LIFE * (player.conquest.nuncaDesistir ? 2 : 1),
        dmg: player.dmg
    });
});

// =========== HABILIDADES / SKILLS ===========
function renderSkills() {
    skillsDiv.innerHTML = `<h2>Árvore de Habilidades</h2>
    <div style="font-size:15px; margin-bottom:14px;">
    <b>${player.points}</b> pontos disponíveis.<br>
    <small style="color:#aaa;">Clique nos botões para distribuir pontos. <br>
    <span style="color:#fa8;">DEFESA e MOBILIDADE custam 3 pontos cada.<br>
    MOBILIDADE só pode ser aumentada até +50% da velocidade base.</span></small>
    </div>
    <table style="font-size:20px;">
    <tr>
    <td>Dano:</td>
    <td>${player.skill.dmg}</td>
    <td><button class="skill-btn" id="up-dmg" ${player.points < 1 ? 'disabled' : ''}>+1</button></td>
    </tr>
    <tr>
    <td>Defesa:</td>
    <td>${Math.floor(player.skill.def / 3)}</td>
    <td><button class="skill-btn" id="up-def" ${(player.points < 3) ? 'disabled' : ''}>+1</button></td>
    </tr>
    <tr>
    <td>HP:</td>
    <td>${player.skill.hp}</td>
    <td><button class="skill-btn" id="up-hp" ${player.points < 1 ? 'disabled' : ''}>+1</button></td>
    </tr>
    <tr>
    <td>Regeneração:</td>
    <td>${player.skill.regen}</td>
    <td><button class="skill-btn" id="up-regen" ${player.points < 1 ? 'disabled' : ''}>+1</button></td>
    </tr>
    <tr>
    <td>Velocidade:</td>
    <td>${player.skill.speed}</td>
    <td><button class="skill-btn" id="up-speed" ${player.points < 1 ? 'disabled' : ''}>+1</button></td>
    </tr>
    <tr>
    <td>Mobilidade:</td>
    <td>${player.skill.mob}</td>
    <td><button class="skill-btn" id="up-mob" ${(player.points < 3 || player.skill.mob >= 25) ? 'disabled' : ''}>+1</button></td>
    </tr>
    </table>
    <div style="margin-top:14px;font-size:15px;color:#bfc;">Cada 10 níveis: <b>+1.5% HP</b> e <b>+1% Dano</b> (acumulativo).</div>
    <div style="margin-top:10px;">
        <button class="skill-btn" id="fechar">Fechar</button>
    </div>`;
    document.getElementById('up-dmg').onclick = () => {
        if (player.points >= 1) { player.skill.dmg++; player.points--; playerBaseStats(BASES); renderSkills(); }
    };
    document.getElementById('up-def').onclick = () => {
        if (player.points >= 3) { player.skill.def += 3; player.points -= 3; playerBaseStats(BASES); renderSkills(); }
    };
    document.getElementById('up-hp').onclick = () => {
        if (player.points >= 1) { player.skill.hp++; player.points--; playerBaseStats(BASES); renderSkills(); }
    };
    document.getElementById('up-regen').onclick = () => {
        if (player.points >= 1) { player.skill.regen++; player.points--; playerBaseStats(BASES); renderSkills(); }
    };
    document.getElementById('up-speed').onclick = () => {
        if (player.points >= 1) { player.skill.speed++; player.points--; playerBaseStats(BASES); renderSkills(); }
    };
    document.getElementById('up-mob').onclick = () => {
        if (player.points >= 3 && player.skill.mob < 25) {
            player.skill.mob++;
            player.points -= 3;
            playerBaseStats(BASES);
            renderSkills();
        }
    };
    document.getElementById('fechar').onclick = () => {
        skillsDiv.style.display = "none";
    };
}

openSkills.onclick = () => {
    renderSkills();
    skillsDiv.style.display = skillsDiv.style.display === "none" ? "block" : "none";
};

// ============ XP E HUD ===========
function addXP(amt) {
    if (player.level >= 500) return;
    player.xp += amt;
    while (player.xp >= player.xpToNext && player.level < 500) {
        player.xp -= player.xpToNext;
        player.level++;
        player.points++;
        player.xpToNext = xpToNext(player.level);
        playerBaseStats(BASES);
    }
}

function updateHUD() {
    scoreDiv.innerHTML =
        `Nível: <b>${player.level}</b> &nbsp;&nbsp; Vida: <b>${player.alive ? Math.round(player.hp) : 0}/${player.maxHp}</b>`;
    pointsSpan.textContent = player.points;
    let percent = Math.min(100, 100 * player.xp / player.xpToNext);
    xpbar.style.width = percent + "%";
    xpbar.style.background = percent < 99 ? "linear-gradient(90deg,#1fd1f9,#88e8a0)" : "#FFD700";
    if (!player.alive) {
        deathMsg.style.display = "block";
        deathMsg.innerHTML = "Você morreu!<br><span style='font-size:28px'>Respawn em " + player.respawnTimer.toFixed(1) + "s</span>";
    } else {
        deathMsg.style.display = "none";
    }
    if (player.hasDmgReduction) dmgReduceIcon.style.display = "flex";
    // Exibir conquistas
    let conquestText = "";
    if (player.conquest.vontadeFracos) conquestText += "🏅 Vontade dos fracos<br>";
    if (player.conquest.nuncaDesistir) conquestText += "🏅 Nunca Desistir<br>";
    conquestDiv.innerHTML = conquestText;
}
// game.js — Bloco 4

function update() {
    // --- Respawn automático após morte ---
    if (!player.alive) {
        player.respawnTimer -= 1/60;
        if (player.respawnTimer <= 0) {
            // Respawn do player em uma das safe zones
            const zona = SAFE_ZONES[Math.floor(Math.random() * SAFE_ZONES.length)];
            player.x = zona.x;
            player.y = zona.y;
            player.hp = player.maxHp;
            player.alive = true;
            player.respawnTimer = 0;
            player.contactBlocks = {};
            playerBaseStats(BASES);
            // Centraliza a câmera no player ao respawn
            cam.x = clamp(player.x - viewW / 2, 0, MAP_W - viewW);
            cam.y = clamp(player.y - viewH / 2, 0, MAP_H - viewH);
        }
        // Câmera permanece no último ponto do player até o respawn
        return;
    }

    // ---- INPUT MOVIMENTAÇÃO PLAYER ----
    let speed = player.speed, mob = player.mob;
    let blockSlowest = 1.0;

    // --- BLOCO/COLISÃO ---
    for (let block of blocks) {
        if (!block.alive) continue;
        let t = BLOCK_TYPES[block.type];
        let closestX = Math.max(block.x - t.size/2, Math.min(player.x, block.x + t.size/2));
        let closestY = Math.max(block.y - t.size/2, Math.min(player.y, block.y + t.size/2));
        let dist = Math.hypot(player.x - closestX, player.y - closestY);
        if (dist < player.radius + 1) {
            if (t.slow < blockSlowest) blockSlowest = t.slow;
            if (!player.contactBlocks[block.id]) player.contactBlocks[block.id] = 0;
            player.contactBlocks[block.id] += 1/60;
            if (player.contactBlocks[block.id] >= 0.25) {
                player.contactBlocks[block.id] = 0;
                let blockDmg = t.dmg * (1 - getPlayerDefPercent());
                player.hp -= blockDmg;
                let meleeDmg = Math.max(1, Math.floor(player.dmg * 0.35) * 3); // 3x mais dano corpo a corpo!
                block.hp -= meleeDmg;
            }
        } else {
            player.contactBlocks[block.id] = 0;
        }
        if (block.hp <= 0 && block.alive) {
            block.alive = false;
            addXP(getPlayerBonusXP(t.xp));
            setTimeout(()=> spawnBlock(block.type, MAP_W, MAP_H, SAFE_ZONES), 1800);
        }
    }

    speed = player.speed * blockSlowest;
    if (keys['w']) player.y -= speed * mob;
    if (keys['s']) player.y += speed * mob;
    if (keys['a']) player.x -= speed * mob;
    if (keys['d']) player.x += speed * mob;

    player.x = clamp(player.x, player.radius, MAP_W-player.radius);
    player.y = clamp(player.y, player.radius, MAP_H-player.radius);
    player.angle = Math.atan2(mouseY - (player.y - cam.y), mouseX - (player.x - cam.x));

    // ---- REGEN ----
    let regen = getPlayerRegen();
    if (regen > 0) {
        let inSafeZone = isInSafeZone(player.x, player.y, SAFE_ZONES, player.radius);
        player.hp = Math.min(player.maxHp, player.hp + regen * (inSafeZone ? 1.6 : 0.7));
    }

    // ---- TIROS DO PLAYER ----
    for (let b of bullets) {
        b.x += b.dx;
        b.y += b.dy;
        b.life--;
    }
    for (let i = bullets.length-1; i >=0; i--) {
        if (bullets[i].life <=0) bullets.splice(i,1);
    }

    // ---- DANO DE TIROS NOS BLOCOS ----
    for (let block of blocks) {
        if (!block.alive) continue;
        let t = BLOCK_TYPES[block.type];
        for (let b of bullets) {
            if (
                b.x > block.x - t.size/2 &&
                b.x < block.x + t.size/2 &&
                b.y > block.y - t.size/2 &&
                b.y < block.y + t.size/2
            ) {
                block.hp -= b.dmg;
                b.life = 0;
            }
        }
        if (block.hp <= 0 && block.alive) {
            block.alive = false;
            addXP(getPlayerBonusXP(t.xp));
            setTimeout(()=> spawnBlock(block.type, MAP_W, MAP_H, SAFE_ZONES), 1800);
        }
    }

    // ---- INIMIGOS NORMAIS ----
    for (let enemy of enemies) {
        if (!enemy.alive) continue;
        let inSafe = isInSafeZone(enemy.x, enemy.y, SAFE_ZONES, ENEMY_SIZE/2+6);
        let dx = player.x - enemy.x, dy = player.y - enemy.y;
        let dist = Math.hypot(dx,dy);

        if (!inSafe) {
            let espeed = 1.7 + Math.random()*0.6;
            if (dist < 300) {
                enemy.x += dx/dist*espeed*0.77 + (Math.random()-0.5)*0.7;
                enemy.y += dy/dist*espeed*0.77 + (Math.random()-0.5)*0.7;
            } else {
                enemy.x += (Math.random()-0.5)*1.2;
                enemy.y += (Math.random()-0.5)*1.2;
            }
            enemy.x = clamp(enemy.x, ENEMY_SIZE/2, MAP_W-ENEMY_SIZE/2);
            enemy.y = clamp(enemy.y, ENEMY_SIZE/2, MAP_H-ENEMY_SIZE/2);
            for (const zone of SAFE_ZONES) {
                let dz = Math.hypot(enemy.x-zone.x, enemy.y-zone.y);
                if (dz < zone.r + ENEMY_SIZE/2) {
                    let ang = Math.atan2(enemy.y-zone.y, enemy.x-zone.x);
                    let newDist = zone.r + ENEMY_SIZE/2 + 5;
                    enemy.x = zone.x + Math.cos(ang)*newDist;
                    enemy.y = zone.y + Math.sin(ang)*newDist;
                }
            }
        } else {
            for (const zone of SAFE_ZONES) {
                let dz = Math.hypot(enemy.x-zone.x, enemy.y-zone.y);
                if (dz < zone.r + ENEMY_SIZE/2) {
                    let ang = Math.atan2(enemy.y-zone.y, enemy.x-zone.x);
                    let newDist = zone.r + ENEMY_SIZE/2 + 5;
                    enemy.x = zone.x + Math.cos(ang)*newDist;
                    enemy.y = zone.y + Math.sin(ang)*newDist;
                }
            }
        }

        // DANO POR TIRO
        for (let b of bullets) {
            if (
                b.x > enemy.x - ENEMY_SIZE/2 &&
                b.x < enemy.x + ENEMY_SIZE/2 &&
                b.y > enemy.y - ENEMY_SIZE/2 &&
                b.y < enemy.y + ENEMY_SIZE/2
            ) {
                let dmgFinal = b.dmg * (1 - getPlayerDefPercent());
                enemy.hp -= dmgFinal;
                b.life = 0;
            }
        }

        // DANO POR ENCOSTAR NO PLAYER
        let dplayer = Math.hypot(enemy.x-player.x, enemy.y-player.y);
        if (dplayer < ENEMY_SIZE/2 + player.radius-3 && player.hp > 0) {
            let inSafeZone = isInSafeZone(player.x, player.y, SAFE_ZONES, player.radius);
            let dmgToPlayer = 14 * 0.5;
            dmgToPlayer = dmgToPlayer * (1 - getPlayerDefPercent());
            if (!inSafeZone) player.hp -= Math.max(1, dmgToPlayer);
        }

        // MORTE DO INIMIGO
        if (enemy.hp <= 0 && enemy.alive) {
            enemy.alive = false;
            addXP(getPlayerBonusXP(48 + Math.floor(player.level/2)));
            setTimeout(() => {
                let ex, ey, safe;
                do {
                    ex = Math.random() * (MAP_W-200) + 100;
                    ey = Math.random() * (MAP_H-200) + 100;
                    safe = SAFE_ZONES.some(z => Math.hypot(ex-z.x,ey-z.y) < z.r+ENEMY_SIZE/2+6);
                } while (safe);
                enemy.x = ex; enemy.y = ey; enemy.hp = 60 + Math.random()*65;
                enemy.alive = true;
            }, ENEMY_RESPAWN_MS);
        }
    }

    // --- SEMPRE ao final do update: CÂMERA centraliza no player ---
    cam.x = clamp(player.x - viewW / 2, 0, MAP_W - viewW);
    cam.y = clamp(player.y - viewH / 2, 0, MAP_H - viewH);

    // --- Verifica morte do player ---
    if (player.hp <= 0 && player.alive) {
        player.alive = false;
        player.respawnTimer = 2.5;
    }
    
    // --- resto igual ao bloco anterior (shooters, boss, conquistas, etc) ---
    // (Se quiser o Bloco 4B novamente, é só pedir!)
}


// game.js — Bloco 4B

// --- SHOOTER ENEMIES (LARANJA) ---
// Desbloqueia shooters no level 15
if (!shooterUnlocked && player.level >= 15) {
    showEventMsg("posso sentir sua presença", 2.5);
    setTimeout(() => showEventMsg("e Agora o campo de batalha se agita", 2.5), 2.6 * 1000);
    for (let i = 0; i < 4; i++) spawnShooter(MAP_W, MAP_H, SAFE_ZONES);
    shooterUnlocked = true;
}

for (let sh of shooterEnemies) {
    if (!sh.alive) continue;
    let inSafe = isInSafeZone(sh.x, sh.y, SAFE_ZONES, SHOOTER_SIZE / 2 + 18);
    let dx = player.x - sh.x, dy = player.y - sh.y;
    let dist = Math.hypot(dx, dy);

    // Movimento
    let espeed = 1.2;
    if (dist < 180) {
        sh.x -= dx / dist * espeed * 0.87 + (Math.random() - 0.5) * 0.4;
        sh.y -= dy / dist * espeed * 0.87 + (Math.random() - 0.5) * 0.4;
    } else if (dist < 370) {
        sh.x += (Math.random() - 0.5) * 1.1;
        sh.y += (Math.random() - 0.5) * 1.1;
    } else {
        sh.x += dx / dist * espeed * 0.7 + (Math.random() - 0.5) * 0.2;
        sh.y += dy / dist * espeed * 0.7 + (Math.random() - 0.5) * 0.2;
    }
    sh.x = clamp(sh.x, SHOOTER_SIZE / 2, MAP_W - SHOOTER_SIZE / 2);
    sh.y = clamp(sh.y, SHOOTER_SIZE / 2, MAP_H - SHOOTER_SIZE / 2);
    for (const zone of SAFE_ZONES) {
        let dz = Math.hypot(sh.x - zone.x, sh.y - zone.y);
        if (dz < zone.r + SHOOTER_SIZE / 2) {
            let ang = Math.atan2(sh.y - zone.y, sh.x - zone.x);
            let newDist = zone.r + SHOOTER_SIZE / 2 + 15;
            sh.x = zone.x + Math.cos(ang) * newDist;
            sh.y = zone.y + Math.sin(ang) * newDist;
        }
    }

    // Atira no player a cada 3s
    sh.fireTimer -= 1 / 60;
    if (sh.fireTimer <= 0) {
        sh.fireTimer = SHOOTER_FIRE_RATE;
        let angle = Math.atan2(player.y - sh.y, player.x - sh.x);
        shooterBullets.push({
            x: sh.x + Math.cos(angle) * 36,
            y: sh.y + Math.sin(angle) * 36,
            dx: Math.cos(angle) * SHOOTER_BULLET_SPEED,
            dy: Math.sin(angle) * SHOOTER_BULLET_SPEED,
            alive: true
        });
    }

    // Dano de tiro do player
    for (let b of bullets) {
        if (
            b.x > sh.x - SHOOTER_SIZE / 2 &&
            b.x < sh.x + SHOOTER_SIZE / 2 &&
            b.y > sh.y - SHOOTER_SIZE / 2 &&
            b.y < sh.y + SHOOTER_SIZE / 2
        ) {
            let dmgFinal = b.dmg * (1 - getPlayerDefPercent());
            sh.hp -= dmgFinal;
            b.life = 0;
        }
    }

    if (sh.hp <= 0 && sh.alive) {
        sh.alive = false;
        addXP(getPlayerBonusXP(96 + Math.floor(player.level / 2)));
        setTimeout(() => {
            let ex, ey, safe;
            do {
                ex = Math.random() * (MAP_W - 180) + 90;
                ey = Math.random() * (MAP_H - 180) + 90;
                safe = SAFE_ZONES.some(z => Math.hypot(ex - z.x, ey - z.y) < z.r + SHOOTER_SIZE / 2 + 18);
            } while (safe);
            sh.x = ex; sh.y = ey; sh.hp = 70 + Math.random() * 45;
            sh.alive = true;
            sh.fireTimer = Math.random() * 3;
        }, SHOOTER_RESPAWN_MS);
    }
}

// SHOOTER BULLETS
for (let s = shooterBullets.length - 1; s >= 0; s--) {
    let sb = shooterBullets[s];
    if (!sb.alive) continue;
    sb.x += sb.dx; sb.y += sb.dy;
    if (sb.x < 0 || sb.y < 0 || sb.x > MAP_W || sb.y > MAP_H) { shooterBullets.splice(s, 1); continue; }
    let dist = Math.hypot(sb.x - player.x, sb.y - player.y);
    if (player.alive && dist < player.radius + 9) {
        let dmg = SHOOTER_DMG * (1 - getPlayerDefPercent());
        player.hp -= dmg;
        shooterBullets.splice(s, 1);
    }
}

// --- BOSS LOGIC ---
if (!bossUnlocked && player.level >= 40) {
    if (!bossMsg1) {
        showEventMsg("Um Novo Poder ???", 3);
        bossMsg1 = true;
        setTimeout(() => {
            showEventMsg("Yo Ishi Ten Kai!", 3);
            bossMsg2 = true;
            setTimeout(() => {
                spawnBoss(MAP_W, MAP_H, SAFE_ZONES);
                bossUnlocked = true;
                BOSS_SPAWNED.spawned = true;
            }, 3.2 * 1000);
        }, 3.2 * 1000);
    }
}

if (boss && boss.alive) {
    let inSafe = isInSafeZone(boss.x, boss.y, SAFE_ZONES, BOSS_SIZE / 2 + 22);
    let dx = player.x - boss.x, dy = player.y - boss.y;
    let dist = Math.hypot(dx, dy);
    if (!inSafe) {
        let espeed = 0.88 + Math.random() * 0.13;
        boss.x += dx / dist * espeed * 0.55 + (Math.random() - 0.5) * 0.31;
        boss.y += dy / dist * espeed * 0.55 + (Math.random() - 0.5) * 0.31;
        boss.x = clamp(boss.x, BOSS_SIZE / 2, MAP_W - BOSS_SIZE / 2);
        boss.y = clamp(boss.y, BOSS_SIZE / 2, MAP_H - BOSS_SIZE / 2);
        for (const zone of SAFE_ZONES) {
            let dz = Math.hypot(boss.x - zone.x, boss.y - zone.y);
            if (dz < zone.r + BOSS_SIZE / 2) {
                let ang = Math.atan2(boss.y - zone.y, boss.x - zone.x);
                let newDist = zone.r + BOSS_SIZE / 2 + 16;
                boss.x = zone.x + Math.cos(ang) * newDist;
                boss.y = zone.y + Math.sin(ang) * newDist;
            }
        }
    }
    for (let b of bullets) {
        if (
            b.x > boss.x - BOSS_SIZE / 2 &&
            b.x < boss.x + BOSS_SIZE / 2 &&
            b.y > boss.y - BOSS_SIZE / 2 &&
            b.y < boss.y + BOSS_SIZE / 2
        ) {
            let dmgFinal = b.dmg * (1 - getPlayerDefPercent()) * (1 - boss.dmgReduce);
            boss.hp -= dmgFinal;
            b.life = 0;
        }
    }
    bossHitTimer += 1 / 60;
    let dplayer = Math.hypot(boss.x - player.x, boss.y - player.y);
    if (bossHitTimer >= BOSS_HIT_RATE && dplayer < BOSS_SIZE / 2 + player.radius + 14) {
        bossHitTimer = 0;
        let dmg = BOSS_DMG * (1 - getPlayerDefPercent());
        player.hp -= dmg;
        showEventMsg("!!! Boss Hit !!!", 1.0);
    }
    if (boss.hp <= 0 && boss.alive) {
        boss.alive = false;
        BOSS_SPAWNED.killed = true;
        showEventMsg("AGORA VC É UM JOGADOR", 6);
        player.hasDmgReduction = true;
        dmgReduceIcon.style.display = "flex";
    }
}

// --- CÂMERA CENTRALIZADA ---
cam.x = clamp(player.x - viewW / 2, 0, MAP_W - viewW);
cam.y = clamp(player.y - viewH / 2, 0, MAP_H - viewH);

// --- MENSAGENS DE EVENTO ---
if (msgQueue.length > 0) {
    let m = msgQueue[0];
    eventMsg.innerHTML = m.msg;
    eventMsg.style.display = "block";
    m.t -= 1 / 60;
    if (m.t <= 0) { msgQueue.shift(); if (msgQueue.length == 0) eventMsg.style.display = "none"; }
} else {
    eventMsg.style.display = "none";
}

// --- MENSAGENS DE CONQUISTA ---
if (conquestMsgQueue.length > 0) {
    let m = conquestMsgQueue[0];
    eventMsg.innerHTML = "<span style='color:#fff911;'>🏆 " + m.msg + "</span>";
    eventMsg.style.display = "block";
    m.t -= 1 / 60;
    if (m.t <= 0) { conquestMsgQueue.shift(); if (conquestMsgQueue.length == 0) eventMsg.style.display = "none"; }
}

// ===================== DRAW ======================
function draw() {
    ctx.clearRect(0, 0, viewW, viewH);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    // ...desenhar tudo...
    ctx.restore();

    // Zonas seguras
    for (const zone of SAFE_ZONES) {
        ctx.save();
        ctx.globalAlpha = 0.17;
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, zone.r, 0, 2 * Math.PI);
        ctx.fillStyle = "#49fcbf";
        ctx.fill();
        ctx.restore();
    }

    // Bordas do mapa
    ctx.save();
    ctx.strokeStyle = "#46c";
    ctx.lineWidth = 12;
    ctx.globalAlpha = 0.22;
    ctx.strokeRect(0, 0, MAP_W, MAP_H);
    ctx.restore();

    // Blocos
    for (let block of blocks) {
        if (!block.alive) continue;
        let t = BLOCK_TYPES[block.type];
        ctx.save();
        ctx.translate(block.x, block.y);
        ctx.fillStyle = t.color;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.rect(-t.size / 2, -t.size / 2, t.size, t.size);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#111";
        ctx.fillRect(-t.size / 2, -t.size / 2 - 14, t.size, 10);
        ctx.fillStyle = "#4fc";
        ctx.fillRect(-t.size / 2, -t.size / 2 - 14, t.size * (block.hp / t.hp), 10);
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(-t.size / 2, -t.size / 2 - 14, t.size, 10);
        ctx.restore();
    }

    // Inimigos normais
    for (let enemy of enemies) {
        if (!enemy.alive) continue;
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.fillStyle = "#e44";
        ctx.globalAlpha = 0.83;
        ctx.beginPath();
        ctx.arc(0, 0, ENEMY_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
        ctx.fillRect(-20, -ENEMY_SIZE / 2 - 13, 40, 10);
        ctx.fillStyle = "#7f3";
        ctx.fillRect(-20, -ENEMY_SIZE / 2 - 13, 40 * (enemy.hp / 105), 10);
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(-20, -ENEMY_SIZE / 2 - 13, 40, 10);
        ctx.restore();
    }

    // Atiradores laranja
    for (let sh of shooterEnemies) {
        if (!sh.alive) continue;
        ctx.save();
        ctx.translate(sh.x, sh.y);
        ctx.fillStyle = "#fa3";
        ctx.globalAlpha = 0.93;
        ctx.beginPath();
        ctx.arc(0, 0, SHOOTER_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
        ctx.fillRect(-20, -SHOOTER_SIZE / 2 - 13, 40, 10);
        ctx.fillStyle = "#fa4";
        ctx.fillRect(-20, -SHOOTER_SIZE / 2 - 13, 40 * (sh.hp / 115), 10);
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(-20, -SHOOTER_SIZE / 2 - 13, 40, 10);
        ctx.restore();
    }

    // Boss
    if (boss && boss.alive) {
        ctx.save();
        ctx.translate(boss.x, boss.y);
        ctx.fillStyle = "#c3e";
        ctx.globalAlpha = 0.96;
        ctx.beginPath();
        ctx.arc(0, 0, BOSS_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#fbf";
        ctx.stroke();
        // HP bar
        ctx.fillStyle = "#111";
        ctx.fillRect(-45, -BOSS_SIZE / 2 - 18, 90, 13);
        ctx.fillStyle = "#f3f";
        ctx.fillRect(-45, -BOSS_SIZE / 2 - 18, 90 * (boss.hp / BOSS_SPAWN_HP), 13);
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(-45, -BOSS_SIZE / 2 - 18, 90, 13);
        ctx.restore();
    }

    // Player
    if (player.alive) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        ctx.globalAlpha = 1;
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(0, 0, player.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(40, 0);
        ctx.stroke();
        ctx.save();
        ctx.rotate(-player.angle);
        ctx.fillStyle = "#222";
        ctx.fillRect(-32, player.radius + 7, 64, 12);
        ctx.fillStyle = "#55f7";
        ctx.fillRect(-32, player.radius + 7, 64 * (player.hp / player.maxHp), 12);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-32, player.radius + 7, 64, 12);
        ctx.restore();
        ctx.restore();
    }

    // Bullets (player)
    for (let b of bullets) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, 7, 0, 2 * Math.PI);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.restore();
    }
    // Bullets (shooter inimigos)
    for (let sb of shooterBullets) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sb.x, sb.y, 13, 0, 2 * Math.PI);
        ctx.fillStyle = "#fa4";
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
}

function gameLoop() {
    update();
    draw();
    updateHUD();
    requestAnimationFrame(gameLoop);
}

gameLoop();
