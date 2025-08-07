// BLOCO 1 — DEFINIÇÕES INICIAIS E VARIÁVEIS DINÂMICAS

import { player, resetPlayer, playerBaseStats, getPlayerDefPercent, getPlayerRegen, getPlayerBonusXP } from "./player.js";
import { enemies, ENEMY_SIZE, ENEMY_RESPAWN_MS, spawnEnemy } from "./enemy.js";
import { blocks, BLOCK_TYPES, spawnBlock } from "./blocks.js";
import { clamp, isInSafeZone } from "./utils.js";

// Canvas e variáveis de dimensão
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let viewW = window.innerWidth, viewH = window.innerHeight;
let MAP_W = viewW * 3;
let MAP_H = viewH * 3;
canvas.width = viewW;
canvas.height = viewH;

// Função para obter SAFE_ZONES atualizadas conforme o mapa
function getSafeZones() {
    return [
        { x: MAP_W / 2, y: MAP_H / 2, r: 160 },
        { x: 250, y: 250, r: 160 },
        { x: MAP_W - 250, y: MAP_H - 250, r: 160 }
    ];
}

// Atualiza tamanho do canvas e do mapa dinamicamente
window.addEventListener('resize', () => {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = viewW;
    canvas.height = viewH;
    MAP_W = viewW * 3;
    MAP_H = viewH * 3;
});

let cam = { x: 0, y: 0 };

// Restante das variáveis do jogo
let bullets = [];
let shooterBullets = [];
let keys = {};
let mouseX = 0, mouseY = 0;
let BASES = {}; // Ajuste conforme sua lógica de status base do player

// BLOCO 2 — INPUTS E INICIALIZAÇÃO

// Input teclado
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// Input mouse
canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

// Exemplo de inicialização de blocos, inimigos, player, etc.
const SAFE_ZONES = getSafeZones();
resetPlayer(SAFE_ZONES);
playerBaseStats(BASES);

// Centraliza a câmera ao inicializar o player
cam.x = clamp(player.x - viewW / 2, 0, MAP_W - viewW);
cam.y = clamp(player.y - viewH / 2, 0, MAP_H - viewH);

// BLOCO 3 — HUD, XP, MENSAGENS, ETC

function addXP(xp) {
    player.xp += xp;
    // Aqui vai sua lógica de subida de nível, habilidades, etc
}

function showConquestMsg(msg) {
    // Função para mostrar mensagens de conquista (HUD)
    const eventMsg = document.getElementById("eventMsg");
    eventMsg.innerText = msg;
    eventMsg.style.display = "block";
    setTimeout(() => eventMsg.style.display = "none", 3200);
}

// Outras funções auxiliares para habilidades, pontos, árvore, etc.
// ...
// BLOCO 4 — GAME LOOP PRINCIPAL (UPDATE)

function update() {
    // Sempre atualize viewW, viewH, MAP_W, MAP_H em cada frame
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = viewW;
    canvas.height = viewH;
    MAP_W = viewW * 3;
    MAP_H = viewH * 3;

    const SAFE_ZONES = getSafeZones();

    // --- Respawn automático após morte ---
    if (!player.alive) {
        player.respawnTimer -= 1/60;
        if (player.respawnTimer <= 0) {
            const zona = SAFE_ZONES[Math.floor(Math.random() * SAFE_ZONES.length)];
            player.x = zona.x;
            player.y = zona.y;
            player.hp = player.maxHp;
            player.alive = true;
            player.respawnTimer = 0;
            player.contactBlocks = {};
            playerBaseStats(BASES);

            // Centraliza câmera ao respawn
            cam.x = clamp(player.x - viewW / 2, 0, MAP_W - viewW);
            cam.y = clamp(player.y - viewH / 2, 0, MAP_H - viewH);
        }
        // Câmera permanece no último ponto até respawn
        return;
    }

    // INPUT movimentação player
    let speed = player.speed, mob = player.mob;
    let blockSlowest = 1.0;

    // Blocos e colisão (exemplo)
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
                let meleeDmg = Math.max(1, Math.floor(player.dmg * 0.35) * 3);
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

    // (Seu código de regen, tiros, inimigos, boss, XP, conquistas, etc)

    // SEMPRE ao final do update, centralize a câmera
    cam.x = clamp(player.x - viewW / 2, 0, MAP_W - viewW);
    cam.y = clamp(player.y - viewH / 2, 0, MAP_H - viewH);

    // --- Verifica morte do player ---
    if (player.hp <= 0 && player.alive) {
        player.alive = false;
        player.respawnTimer = 2.5;
    }

    // ...continua shooters, boss, etc
}
// BLOCO 5 — DRAW E GAMELOOP

function draw() {
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Exemplo de desenho: fundo, blocos, inimigos, player
    ctx.fillStyle = "#232";
    ctx.fillRect(cam.x, cam.y, viewW, viewH);

    // (Seu código de desenho de blocos, zonas seguras, inimigos, player, tiros, etc.)

    ctx.restore();
}

// Loop principal
function gameLoop() {
    update();
    draw();
    // Se tiver função de atualizar HUD, chame aqui
    requestAnimationFrame(gameLoop);
}

// Inicia o jogo
gameLoop();
