/* ========================================================================
 * projectiles.js
 * Projéteis do jogador com alcance configurável (para conquista lvl 35).
 * ===================================================================== */
export const playerBullets = [];
let projectileRangeMult = 1;
export function setProjectileRangeMult(mult) {
  projectileRangeMult = Math.max(0.1, mult || 1);
}

export function spawnPlayerBullet(sx, sy, tx, ty, speedPxPerFrame, damage, opts = {}) {
  const dx = (opts?.dirX ?? (tx - sx)), dy = (opts?.dirY ?? (ty - sy));
  const d = Math.hypot(dx, dy) || 1;
  const vx = (dx / d) * speedPxPerFrame;
  const vy = (dy / d) * speedPxPerFrame;
  const baseLife = opts?.life ?? 1.4;
  playerBullets.push({
    x: sx, y: sy, vx, vy, life: baseLife * projectileRangeMult, alive: true, damage,
    type: opts?.type || "normal",
    aimId: opts?.aimId || null,   // id do alvo (índice de enemies), se homing
    homing: !!opts?.homing,
    turnRate: opts?.turnRate ?? 6, // rad/s
    speed: speedPxPerFrame
  });
}

export function updatePlayerBullets(dt) {
  for (const b of playerBullets) {
    if (!b.alive) continue;
    if (b.homing && typeof window.__getEnemyRef === "function") {
      const t = window.__getEnemyRef(b.aimId);
      if (t && t.alive) {
        const dx = t.x - b.x, dy = t.y - b.y;
        const ang = Math.atan2(b.vy, b.vx);
        const angTo = Math.atan2(dy, dx);
        let da = angTo - ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const maxTurn = b.turnRate * dt;
        const newAng = ang + Math.max(-maxTurn, Math.min(maxTurn, da));
        b.vx = Math.cos(newAng) * b.speed;
        b.vy = Math.sin(newAng) * b.speed;
      }
    }
    b.x += b.vx * 60 * dt;
    b.y += b.vy * 60 * dt;
    b.life -= dt;
    if (b.life <= 0) b.alive = false;
  }
}


export function drawPlayerBullets(ctx, cam) {
  ctx.fillStyle = "#7ee7ff";
  for (const b of playerBullets) {
    if (!b.alive) continue;
    const sx = Math.floor(b.x - cam.x), sy = Math.floor(b.y - cam.y);
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
  }
}
