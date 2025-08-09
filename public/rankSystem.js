// rankSystem.js
// Sistema de Rank estilo Solo Leveling: desbloqueia no Reborn 2, PC (Poder de Combate), progressão via boss Tank

// ======= ORDEM DE RANKS =======
export const RANK_ORDER = [
  "NonRank", // Sem Rank
  "E","E+","D","D+","C+","B","B+","A","A+","S","S+","SS","SS+","SSS","SSS+","U"
];

// ======= REQUISITOS DE PODER PARA PROGREDIR =======
// Ajuste livremente para ritmo de progressão desejado
export const RANK_REQUIREMENTS = {
  "E": 10,
  "E+": 20,
  "D": 35,
  "D+": 50,
  "C+": 75,
  "B": 110,
  "B+": 160,
  "A": 220,
  "A+": 300,
  "S": 400,
  "S+": 550,
  "SS": 750,
  "SS+": 1000,
  "SSS": 1350,
  "SSS+": 1800,
  "U": 2400,
};

// ======= RECOMPENSA DE PC POR MATAR BOSS DE RANK =======
// Base pedido: matar boss dá 10 PC e "aumenta conforme o rank". Aqui uma curva leve.
export const BOSS_PC_REWARD = {
  "E": 10,
  "E+": 12,
  "D": 14,
  "D+": 16,
  "C+": 18,
  "B": 20,
  "B+": 24,
  "A": 28,
  "A+": 32,
  "S": 40,
  "S+": 50,
  "SS": 65,
  "SS+": 85,
  "SSS": 110,
  "SSS+": 140,
  "U": 180,
};

// ======= BÔNUS DO PLAYER POR RANK (DPS/TANK) =======
// Valores percentuais aplicados como multiplicadores (1.00 = sem bônus)
export const PLAYER_RANK_BONUS = {
  // rank: { DPS: { dmg, dr }, TANK: { dmg, dr } }  // dr = damage reduction
  "E":   { DPS:{dmg:1.02, dr:1.01}, TANK:{dmg:1.01, dr:1.02} },
  "E+":  { DPS:{dmg:1.03, dr:1.01}, TANK:{dmg:1.01, dr:1.03} },
  "D":   { DPS:{dmg:1.04, dr:1.02}, TANK:{dmg:1.02, dr:1.04} },
  "D+":  { DPS:{dmg:1.06, dr:1.02}, TANK:{dmg:1.02, dr:1.06} },
  "C+":  { DPS:{dmg:1.08, dr:1.03}, TANK:{dmg:1.03, dr:1.08} },
  "B":   { DPS:{dmg:1.10, dr:1.04}, TANK:{dmg:1.04, dr:1.10} },
  "B+":  { DPS:{dmg:1.12, dr:1.05}, TANK:{dmg:1.05, dr:1.12} },
  "A":   { DPS:{dmg:1.15, dr:1.06}, TANK:{dmg:1.06, dr:1.15} },
  "A+":  { DPS:{dmg:1.18, dr:1.07}, TANK:{dmg:1.07, dr:1.18} },
  "S":   { DPS:{dmg:1.22, dr:1.09}, TANK:{dmg:1.09, dr:1.22} },
  "S+":  { DPS:{dmg:1.26, dr:1.11}, TANK:{dmg:1.11, dr:1.26} },
  "SS":  { DPS:{dmg:1.30, dr:1.13}, TANK:{dmg:1.13, dr:1.30} },
  "SS+": { DPS:{dmg:1.34, dr:1.15}, TANK:{dmg:1.15, dr:1.34} },
  "SSS": { DPS:{dmg:1.38, dr:1.17}, TANK:{dmg:1.17, dr:1.38} },
  "SSS+":{ DPS:{dmg:1.42, dr:1.19}, TANK:{dmg:1.19, dr:1.42} },
  "U":   { DPS:{dmg:1.40, dr:1.20}, TANK:{dmg:1.20, dr:1.40} }, // levemente diferente p/ feeling "U"
};

// ======= MULTIPLICADORES DOS INIMIGOS POR RANK =======
// enemyDmgMult: multiplicador no dano que o inimigo causa
// enemyDR: redução do dano recebido (1.00 = sem redução; >1 significa "reduz mais")
export const ENEMY_RANK_MULT = {
  "NonRank": { enemyDmgMult:1.00, enemyDR:1.00 },
  "E":   { enemyDmgMult:1.05, enemyDR:1.03 },
  "E+":  { enemyDmgMult:1.07, enemyDR:1.05 },
  "D":   { enemyDmgMult:1.10, enemyDR:1.07 },
  "D+":  { enemyDmgMult:1.12, enemyDR:1.09 },
  "C+":  { enemyDmgMult:1.15, enemyDR:1.12 },
  "B":   { enemyDmgMult:1.18, enemyDR:1.15 },
  "B+":  { enemyDmgMult:1.22, enemyDR:1.18 },
  "A":   { enemyDmgMult:1.26, enemyDR:1.22 },
  "A+":  { enemyDmgMult:1.31, enemyDR:1.26 },
  "S":   { enemyDmgMult:1.36, enemyDR:1.31 },
  "S+":  { enemyDmgMult:1.42, enemyDR:1.36 },
  "SS":  { enemyDmgMult:1.48, enemyDR:1.42 },
  "SS+": { enemyDmgMult:1.55, enemyDR:1.48 },
  "SSS": { enemyDmgMult:1.63, enemyDR:1.55 },
  "SSS+":{ enemyDmgMult:1.72, enemyDR:1.63 },
  "U":   { enemyDmgMult:1.82, enemyDR:1.72 },
};

// ======= CÁLCULO: PODER DE COMBATE =======
// soma "dinâmica" a partir dos stats atuais + bônus cumulativos (boss/conquistas)
export function calculateCombatPower(player) {
  const p = player;
  const base =
      (p.dmg || 0) * 2
    + (p.bodyDmg || 0) * 3
    + (p.def || 0) * 3
    + (p.maxHp || 0) * 1;

  const extra = (p.bonusCombatPower || 0); // por bosses, conquistas futuras, etc.
  const total = Math.max(0, Math.floor(base + extra));
  p.combatPower = total;
  return total;
}

// ======= UTILITÁRIOS DE RANK =======
export function getNextRank(currentRank) {
  const idx = RANK_ORDER.indexOf(currentRank || "NonRank");
  return RANK_ORDER[Math.min(idx + 1, RANK_ORDER.length - 1)];
}

export function hasRankSystemUnlocked(player) {
  return !!player.rankSystemUnlocked;
}

export function unlockRankSystemIfEligible(player) {
  // desbloqueia no Reborn 2
  if (!player.rankSystemUnlocked && (player.rebornCount || 0) >= 2) {
    player.rankSystemUnlocked = true;
    // inicia missão: atingir 10 PC
    if (!player.rankMission) {
      player.rankMission = { targetRank: "E", requiredPC: RANK_REQUIREMENTS["E"], status: "PENDING" };
    }
  }
}

// ======= CONDIÇÃO PARA PROGREDIR =======
export function canProgressToNextRank(player) {
  if (!player.rankSystemUnlocked) return { ok:false, reason:"Sistema de Rank bloqueado (Reborn 2 necessário)." };
  const current = player.currentRank || "NonRank";
  const next = getNextRank(current);
  if (next === current || next === "NonRank") return { ok:false, reason:"Sem próximo rank." };
  // precisa de poder de combate mínimo
  calculateCombatPower(player);
  const req = RANK_REQUIREMENTS[next];
  if (req == null) return { ok:false, reason:"Requisito não definido para o próximo rank." };
  if (player.combatPower < req) {
    return { ok:false, reason:`Poder de Combate insuficiente (${player.combatPower}/${req}).` };
  }
  return { ok:true, nextRank: next, requiredPC: req };
}

// ======= PROGRESSÃO VIA BOSS =======
let _rankChallenge = null;
// { active: true, targetRank: "E", bossId: <id> }

export function isInRankChallenge() {
  return _rankChallenge?.active === true;
}

export function requestRankProgression(player, spawnBossFn) {
  const check = canProgressToNextRank(player);
  if (!check.ok) return check;

  const targetRank = check.nextRank;
  // spawna boss Tank no nível atual do player e com rank alvo
  const bossInfo = spawnBossFn({
    level: player.level || 1,
    rank: targetRank,
    clazz: "TANK",
    isRankTrial: true
  });

  _rankChallenge = {
    active: true,
    targetRank,
    bossId: bossInfo?.id ?? null
  };

  return { ok:true, targetRank, bossId: _rankChallenge.bossId };
}

// Deve ser chamado quando o boss de progressão MORRER
export function onRankBossDefeated(player, bossRank) {
  if (!isInRankChallenge()) return;
  if (bossRank !== _rankChallenge.targetRank) return; // segurança

  // Concede PC extra conforme rank do boss
  const reward = BOSS_PC_REWARD[bossRank] ?? 10;
  player.bonusCombatPower = (player.bonusCombatPower || 0) + reward;

  // Sobe Rank
  player.currentRank = bossRank;

  // Atualiza missão: prepara próxima
  const next = getNextRank(player.currentRank);
  if (next !== player.currentRank) {
    player.rankMission = { targetRank: next, requiredPC: RANK_REQUIREMENTS[next], status: "PENDING" };
  } else {
    player.rankMission = { targetRank: null, requiredPC: null, status: "MAX" };
  }

  // Finaliza challenge
  _rankChallenge = null;
}

// ======= BÔNUS DO PLAYER (DANO/REDUÇÃO) POR RANK E CLASSE =======
export function getPlayerRankBonuses(player) {
  const rank = player.currentRank;
  const clazz = (player.rebornClass || "DPS").toUpperCase(); // "DPS" ou "TANK"
  const b = PLAYER_RANK_BONUS[rank];
  if (!b) return { dmg:1.00, dr:1.00 };
  const byClass = b[clazz] || b["DPS"];
  return { dmg: byClass.dmg, dr: byClass.dr };
}

// ======= MULTIPLICADORES DO INIMIGO POR RANK =======
export function getEnemyRankMultipliers(enemyRank) {
  return ENEMY_RANK_MULT[enemyRank || "NonRank"] || ENEMY_RANK_MULT["NonRank"];
}
