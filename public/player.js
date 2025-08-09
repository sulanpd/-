/* ========================================================================
 * player.js — com Reborn Count, XP Mult por Reborn e bloqueio de Body p/ DPS
 * ===================================================================== */
export const player = {
  x: 0, y: 0, radius: 28, color: "#4ccfff",
  alive: true, hp: 100, maxHp: 100,
  level: 0, xp: 0, xpToNext: 100, points: 0,

  dmg: 25, bodyDmg: 10, def: 0.1, speed: 2.5, mob: 1.0, regen: 0.05,

  freezeTimer: 0, slowMult: 1, defDebuff: 0, circleTimer: 0,

  skill: { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, body:0 },

  milestones: { dmg10:false, def10:false, spd10:false },
  blockDmgMult: 1.0,
  extraDR: 0.0,
  ignoreChance: 0.0,

  // Rank System (multiplicadores aplicados por rankSystem.js)
  rankDamageMult: 1.0,
  rankExtraDR: 0.0,

  // Reborn System
  hasReborn: false,
  rebornClass: null,        // "DPS" | "TANK" | null
  rebornCount: 0,           // 0..3
  rebornDamageMult: 1.0,    // DPS: 1.25
  rebornExtraDR: 0.0,       // TANK: 0.25
  shield: 0,
  shieldMax: 0,
  shieldDRBoost: 0.25,      // 25% mais efetivo no escudo

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

  player.milestones.dmg10 = (s.dmg || 0) >= 10;
  player.milestones.def10 = (s.def || 0) >= 10;
  player.milestones.spd10 = (s.speed || 0) >= 10;

  player.blockDmgMult = player.milestones.dmg10 ? 1.20 : 1.0;
  player.extraDR      = player.milestones.def10 ? 0.20 : 0.0;
  player.ignoreChance = player.milestones.spd10 ? 0.10 : 0.0;

  // Recalcula escudo TANK = 60% do HP atual
  if (player.rebornClass === "TANK") {
    const newShieldMax = Math.round(player.maxHp * 0.6);
    const pct = player.shieldMax > 0 ? (player.shield / player.shieldMax) : 1;
    player.shieldMax = newShieldMax;
    player.shield = Math.max(0, Math.min(newShieldMax, Math.round(newShieldMax * pct)));
  }
}

export function getPlayerRegen() { return player.regen || 0; }
export function getPlayerDefPercent() {
  const base = Math.max(0, Math.min(0.95, player.def || 0));
  const debuff = Math.max(0, Math.min(0.9, player.defDebuff || 0));
  const withReborn = Math.max(0, Math.min(0.95, (base - debuff)));
  return withReborn;
}
export function getShieldDefPercent() {
  let d = getPlayerDefPercent();
  d = Math.min(0.95, d * (1 + (player.shieldDRBoost || 0)));
  return d;
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

/* =========================
 * Reborn System
 * ========================= */
export function doReborn(classChoice, BASES, safeZones) {
  // Incrementa contador (máx 3)
  player.rebornCount = Math.min(3, (player.rebornCount || 0) + 1);
  player.hasReborn = true;

  // Apenas no 1º Reborn escolhe classe; nos próximos, mantém
  if (player.rebornCount === 1) {
    player.rebornClass = classChoice; // "DPS" | "TANK"
  }

  // Reset progressão
  player.level = 1;
  player.xp = 0;
  player.xpToNext = xpToNext(1);
  player.points = 0;

  // Zera árvore (após Reborn, Body será bloqueado se DPS; liberado se TANK)
  player.skill = { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, body:0 };
  player.milestones = { dmg10:false, def10:false, spd10:false };
  player.blockDmgMult = 1.0;
  player.extraDR = 0.0;
  player.ignoreChance = 0.0;

  // Efeitos de classe
  if (player.rebornClass === "DPS") {
    player.rebornDamageMult = 1.25;
    player.rebornExtraDR = 0.0;
    player.shield = 0; player.shieldMax = 0;
  } else if (player.rebornClass === "TANK") {
    player.rebornDamageMult = 1.0;
    player.rebornExtraDR = 0.25;
    player.shieldMax = Math.round(player.maxHp * 0.6);
    player.shield = player.shieldMax;
  }

  playerBaseStats(BASES);
  resetPlayer(safeZones);
}
