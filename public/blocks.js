// blocks.js
export const BLOCK_TYPES = {
    yellow: { color: "#f0e130", hp: 24, xp: 12, dmg: 0.1, size: 32, slow: 0.8 },
    blue:   { color: "#3cf", hp: 48, xp: 24, dmg: 0.2, size: 32, slow: 0.6 },
    purple: { color: "#b36ef8", hp: 180, xp: 120, dmg: 1.8, size: 64, slow: 0.2 }
};

export let blocks = [];

export function spawnBlock(type, MAP_W, MAP_H, SAFE_ZONES) {
    let bx, by, safe;
    do {
        bx = Math.random() * (MAP_W-120) + 60;
        by = Math.random() * (MAP_H-120) + 60;
        safe = SAFE_ZONES.some(z => Math.hypot(bx-z.x,by-z.y) < z.r+50);
    } while (safe);
    let t = BLOCK_TYPES[type];
    blocks.push({
        x: bx, y: by, alive: true, type: type, hp: t.hp, id: Math.random().toString(36).slice(2)
    });
}

// Implemente funções para update e draw dos blocos, separe todas aqui!
