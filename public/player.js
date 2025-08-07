// player.js
export const player = {
  x: 0, y: 0,
  angle: 0,
  radius: 28,
  color: "#4ccfff",
  hp: 100, maxHp: 100,
  dmg: 25,            // dano dos TIROS
  bodyDmg: 20,        // dano CORPO-A-CORPO (novo)
  speed: 3.2,
  def: 0, mob: 1.0,
  xp: 0, level: 1, xpToNext: 60,
  points: 0,
  // adiciona "body" como novo stat
  skill: { dmg: 0, def: 0, hp: 0, regen: 0, speed: 0, mob: 0, body: 0 },
  alive: true, respawnTimer: 0,
  contactBlocks: {},
  hasDmgReduction: false,
  conquest: { vontadeFracos: false, nuncaDesistir: false },
  deathsAfter10: 0,
  deathsAfter25: 0
};

export function resetPlayer(SAFE_ZONES) {
  const zona = SAFE_ZONES[Math.floor(Math.random() * SAFE_ZONES.length)];
  player.x = zona.x;
  player.y = zona.y;
  player.hp = player.maxHp;
  player.alive = true;
  player.respawnTimer = 0;
  player.contactBlocks = {};
}

export function getPlayerRegen() {
  const pts = player.skill.regen;
  if (pts < 1) return 0;
  let total = 0;
  for (let i = 1; i <= pts; i++) {
    if (i <= 3) total += 0.01;
    else if (i <= 6) total += 0.02;
    else total += 0.03;
  }
  return total;
}

export function getPlayerDefPercent() {
  let percent = Math.min(0.8, (Math.floor(player.skill.def / 3) * 0.005));
  if (player.hasDmgReduction) percent += 0.20;
  percent += getPlayerBonusDmgReduce();
  return Math.min(percent, 0.95);
}

export function getPlayerDmgMultiplier() {
  // multiplicador do DANO dos TIROS (mantido)
  return 1 + (player.skill.dmg * 0.001);
}

export function getPlayerBodyMultiplier() {
  // multiplicador do DANO corpo-a-corpo (novo) — ~8% por ponto
  return 1 + (player.skill.body * 0.08);
}

export function getPlayerBonusDmg() {
  return player.conquest.vontadeFracos ? 1.10 : 1.0;
}

export function getPlayerBonusDmgReduce() {
  let reduce = 0;
  if (player.conquest.vontadeFracos) reduce += 0.05;
  return reduce;
}

export function getPlayerBonusXP(amt) {
  return amt * (player.conquest.vontadeFracos ? 1.25 : 1.0);
}

export function playerBaseStats(BASES) {
  let buffHp  = 1 + (Math.floor(player.level / 10) * 0.015);
  let buffDmg = 1 + (Math.floor(player.level / 10) * 0.01);

  player.maxHp = Math.floor(BASES.BASE_HP * buffHp + player.skill.hp * 25);
  // Dano dos TIROS
  player.dmg   = Math.floor(BASES.BASE_DMG * buffDmg * getPlayerDmgMultiplier() * getPlayerBonusDmg());
  // Dano CORPO-A-CORPO
  const baseBody = BASES.BASE_BODY ?? 20;
  player.bodyDmg = Math.floor(baseBody * getPlayerBodyMultiplier());

  player.def   = BASES.BASE_DEF + Math.floor(player.skill.def / 3);
  player.speed = BASES.BASE_SPEED + player.skill.speed * 0.14;
  player.mob   = BASES.BASE_MOB + Math.min(0.5, player.skill.mob * 0.02);
  if (player.hp > player.maxHp) player.hp = player.maxHp;
}

export function xpToNext(level) {
  return Math.floor(60 + 12 * Math.pow(level, 1.22));
}
