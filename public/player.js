/* ========================================================================
 * player.js
 * Define o objeto player, funções de stats, XP e auxiliares.
 * Com marcos de 10 pontos (Dano/Defesa/Velocidade).
 * ===================================================================== */
export const player = {
  x: 0, y: 0, radius: 28, color: "#4ccfff",
  alive: true, hp: 100, maxHp: 100,
  level: 1, xp: 0, xpToNext: 100, points: 0,

  // stats derivados
  dmg: 25, bodyDmg: 10, def: 0, speed: 3.2, mob: 1.0, regen: 0,

  // debuffs/efeitos
  freezeTimer: 0, slowMult: 1, defDebuff: 0, circleTimer: 0,

  // skill tree
  skill: { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, body:0 },

  // marcos de 10 pontos
  milestones: { dmg10:false, def10:false, spd10:false },
  blockDmgMult: 1.0,  // +20% vs blocos
  extraDR: 0.0,       // +20% DR extra
  ignoreChance: 0.0,  // 10% de chance de ignorar 1 dano

  respawnTimer: 0
};

export function xpToNext(lvl) {
  return 100 + Math.floor((lvl - 1) * 35);
}

export function playerBaseStats(BASES) {
  const s = player.skill || { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, body:0 };
  const hpMul     = 1 + 0.10 * (s.hp || 0);
  const dmgMul    = 1 + 0.12 * (s.dmg || 0);
  const bodyMul   = 1 + 0.15 * (s.body || 0);
  const defAdd    = 0.04 * (s.def || 0);
  const speedMul  = 1 + 0.06 * (s.speed || 0);
  const mobMul    = 1 + 0.05 * (s.mob || 0);
  const regenAdd  = 0.005 * (s.regen || 0);

  player.maxHp   = Math.round((BASES?.BASE_HP ?? 100) * hpMul);
  player.hp      = Math.min(player.maxHp, player.hp > 0 ? player.hp : player.maxHp);
  player.dmg     = Math.round((BASES?.BASE_DMG ?? 25) * dmgMul);
  player.bodyDmg = Math.round((BASES?.BASE_BODY ?? 10) * bodyMul);
  player.def     = Math.max(0, Math.min(0.8, (BASES?.BASE_DEF ?? 0) + defAdd));
  player.speed   = (BASES?.BASE_SPEED ?? 3.2) * speedMul;
  player.mob     = (BASES?.BASE_MOB ?? 1.0) * mobMul;
  player.regen   = Math.max(0, regenAdd);

  if (!player.xpToNext) player.xpToNext = xpToNext(player.level);

  // marcos 10+
  player.milestones.dmg10 = (s.dmg || 0) >= 10;
  player.milestones.def10 = (s.def || 0) >= 10;
  player.milestones.spd10 = (s.speed || 0) >= 10;

  player.blockDmgMult = player.milestones.dmg10 ? 1.20 : 1.0;
  player.extraDR      = player.milestones.def10 ? 0.20 : 0.0;
  player.ignoreChance = player.milestones.spd10 ? 0.10 : 0.0;
}

export function getPlayerRegen() { return player.regen || 0; }
export function getPlayerDefPercent() {
  const base = Math.max(0, Math.min(0.95, player.def || 0));
  const debuff = Math.max(0, Math.min(0.9, player.defDebuff || 0));
  return Math.max(0, Math.min(0.95, base - debuff));
}
export function getPlayerBonusXP(amount) { return amount; }

export function resetPlayer(safeZones) {
  const z = safeZones[Math.floor(Math.random() * safeZones.length)];
  const ang = Math.random() * Math.PI * 2;
  const r = Math.random() * (z.r * 0.5);
  player.x = z.x + Math.cos(ang) * r;
  player.y = z.y + Math.sin(ang) * r;
  player.alive = true;
  player.hp = player.maxHp;
  player.freezeTimer = 0;
  player.slowMult = 1;
  player.defDebuff = 0;
  player.circleTimer = 0;
}
export function getPlayerMilestoneSummary() {
  return {
    dmg10: player.milestones.dmg10,
    def10: player.milestones.def10,
    spd10: player.milestones.spd10,
    blockDmgMult: player.blockDmgMult,
    extraDR: player.extraDR,
    ignoreChance: player.ignoreChance
  };
}