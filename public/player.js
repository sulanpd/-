export let player = {
  x: 0,
  y: 0,
  radius: 28,
  color: "#4ccfff",
  hp: 100,
  maxHp: 100,
  dmg: 25,
  bodyDmg: 10,
  def: 0,
  speed: 3.2,
  mob: 1.0,
  regen: 0,
  xp: 0,
  xpToNext: 100,
  level: 1,
  points: 0,
  skill: { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, bodyDmg:0 },
  alive: true,
  respawnTimer: 0,
  shots: []
};

let BASES = {};

export function playerBaseStats(base) {
  BASES = base;
  player.maxHp = base.BASE_HP + player.skill.hp * 20;
  player.hp = Math.min(player.hp, player.maxHp);
  player.dmg = base.BASE_DMG + player.skill.dmg * 5;
  player.bodyDmg = 10 + player.skill.bodyDmg * 5;
  player.def = (base.BASE_DEF + player.skill.def * 0.02);
  player.speed = base.BASE_SPEED + player.skill.speed * 0.15;
  player.mob = base.BASE_MOB + player.skill.mob * 0.05;
  player.regen = player.skill.regen * 0.005;
}

export function resetPlayer(safeZones) {
  const safe = safeZones[Math.floor(Math.random() * safeZones.length)];
  player.x = safe.x;
  player.y = safe.y;
  player.hp = player.maxHp;
  player.alive = true;
  player.shots = [];
}

export function getPlayerDefPercent() {
  return Math.min(0.8, player.def);
}

export function getPlayerRegen() {
  return player.regen;
}

export function getPlayerBonusXP(base) {
  return base;
}

export function xpToNext(level) {
  return 100 + (level - 1) * 50;
}

// ====== DISPAROS ======
export function shoot(targetX, targetY) {
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  const speed = 500;
  player.shots.push({
    x: player.x,
    y: player.y,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    radius: 5,
    dmg: player.dmg,
    alive: true
  });
}

export function updateShots(dt, mapW, mapH) {
  for (const s of player.shots) {
    if (!s.alive) continue;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.x < 0 || s.y < 0 || s.x > mapW || s.y > mapH) {
      s.alive = false;
    }
  }
}

export function drawShots(ctx, cam) {
  ctx.fillStyle = "#fff";
  for (const s of player.shots) {
    if (!s.alive) continue;
    ctx.beginPath();
    ctx.arc(s.x - cam.x, s.y - cam.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
