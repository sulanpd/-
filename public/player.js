/* ========================================================================
 * player.js
 * Define o objeto player, funções de stats, XP e auxiliares.
 * ===================================================================== */
export const player = {
  // posição / colisão
  x: 0, y: 0,
  radius: 28,
  color: "#4ccfff",

  // status
  alive: true,
  hp: 100, maxHp: 100,

  // progressão
  level: 1,
  xp: 0,
  xpToNext: 100,
  points: 0,

  // atributos base calculados (via playerBaseStats)
  dmg: 25,          // dano do TIRO
  bodyDmg: 10,      // dano corpo-a-corpo (Body Damage)
  def: 0,           // defesa absoluta (0..1)
  speed: 3.2,       // tiles/frame-base (ajustada no loop)
  mob: 1.0,         // mobilidade multiplicativa
  regen: 0,         // fração da maxHp por segundo (ex.: 0.01 => 1%/s)

  // efeitos temporários/debuffs
  freezeTimer: 0,   // quando >0, jogador não se move
  slowMult: 1,      // multiplicador de velocidade (círculo do boss aplica 0.5)
  defDebuff: 0,     // redução de defesa (círculo do boss aplica 0.25)
  circleTimer: 0,   // duração do debuff

  // skill tree (será criada se não existir)
  skill: { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, body:0 },

  // respawn
  respawnTimer: 0
};

/** Recalcula os stats do player a partir dos BASES e da árvore de habilidades. */
export function playerBaseStats(BASES) {
  const s = player.skill || { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, body:0 };
  const hpMul     = 1 + 0.10 * (s.hp || 0);
  const dmgMul    = 1 + 0.12 * (s.dmg || 0);
  const bodyMul   = 1 + 0.15 * (s.body || 0);
  const defAdd    = 0.04 * (s.def || 0);       // +4% def / ponto
  const speedMul  = 1 + 0.06 * (s.speed || 0);
  const mobMul    = 1 + 0.05 * (s.mob || 0);
  const regenAdd  = 0.005 * (s.regen || 0);    // +0.5% maxHP/s por ponto

  player.maxHp  = Math.round((BASES?.BASE_HP ?? 100) * hpMul);
  player.hp     = Math.min(player.maxHp, player.hp > 0 ? player.hp : player.maxHp);
  player.dmg    = Math.round((BASES?.BASE_DMG ?? 25) * dmgMul);
  player.bodyDmg= Math.round((BASES?.BASE_BODY ?? 10) * bodyMul);
  player.def    = Math.max(0, Math.min(0.8, (BASES?.BASE_DEF ?? 0) + defAdd)); // clamp 80%
  player.speed  = (BASES?.BASE_SPEED ?? 3.2) * speedMul;
  player.mob    = (BASES?.BASE_MOB ?? 1.0) * mobMul;
  player.regen  = Math.max(0, regenAdd);

  if (!player.xpToNext) player.xpToNext = xpToNext(player.level);
}

export function getPlayerRegen() { return player.regen || 0; }

/** Defesa efetiva: aplica debuff de defesa (ex.: -25% em círculo). */
export function getPlayerDefPercent() {
  const base = Math.max(0, Math.min(0.95, player.def || 0));
  const debuff = Math.max(0, Math.min(0.9, player.defDebuff || 0));
  const eff = Math.max(0, base - debuff); // debuff reduz a defesa
  return Math.max(0, Math.min(0.95, eff));
}

/** Hook de bônus adicional a fontes de XP (mantido simples; o multiplicador global é aplicado no addXP). */
export function getPlayerBonusXP(amount) {
  return amount; // multiplicador de conquistas é aplicado no addXP, não aqui.
}

/** Fórmula de XP para próximo nível (pode ajustar à vontade). */
export function xpToNext(lvl) {
  // curva simples: cresce linear+
  return 100 + Math.floor((lvl - 1) * 35);
}

/** Reinicia o player num ponto seguro aleatório. */
export function resetPlayer(safeZones) {
  const z = safeZones[Math.floor(Math.random() * safeZones.length)];
  // posiciona próximo do centro da zona
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
