export const playerBullets = []; // {x,y,vx,vy,life,alive,damage}
let projectileRangeMult = 1;

export function setProjectileRangeMult(mult){
  projectileRangeMult = Math.max(0.1, mult || 1);
}

export function spawnPlayerBullet(sx, sy, tx, ty, speedPxPerFrame, damage) {
  const dx = tx - sx, dy = ty - sy;
  const d = Math.hypot(dx, dy) || 1;
  const vx = (dx/d) * speedPxPerFrame;
  const vy = (dy/d) * speedPxPerFrame;
  const baseLife = 1.4; // segundos
  playerBullets.push({
    x:sx, y:sy, vx, vy,
    life: baseLife * projectileRangeMult,
    alive:true, damage
  });
}

export function updatePlayerBullets(dt) {
  for (const b of playerBullets) {
    if (!b.alive) continue;
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
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI*2); ctx.fill();
  }
}
