/* ========================================================================
 * rankSystem.js
 * Sistema de Rank inspirado em Solo Leveling.
 * - Desbloqueia após Reborn 2
 * - "Poder de Combate" (Power) vem de:
 *     * Pontos em skills: Dano=+2, Body=+3, Defesa=+3, Vida=+1 (por ponto)
 *     * Bônus de chefes de prova de rank (escala por rank)
 *     * (Futuro) conquistas específicas
 * - Progressão: quando o Power alcançar o requisito, aparece botão de "Progredir >> Rank X".
 *   Ao clicar, nasce um Boss (classe Tank) no nível atual do jogador. Ao derrotá-lo, sobe o Rank.
 * - Bônus por Rank (cumulativos por degrau):
 *     * DPS: +3% dano, +1% redução
 *     * TANK: +1.5% dano, +3% redução
 * ===================================================================== */
import { player } from "./player.js";
import { spawnBoss, enemies } from "./enemy.js";
import { clamp } from "./utils.js";

/* ---------- Tiers e Requisitos ---------- */
export const RANK_ORDER = ["E","E+","D","D+","C+","B","B+","A","A+","S","S+","SS","SS+","SSS","SSS+","U"];
const RANK_REQUIREMENTS = {
  "E":10, "E+":20, "D":35, "D+":50, "C+":70, "B":95, "B+":120,
  "A":150, "A+":185, "S":230, "S+":280, "SS":340, "SS+":410,
  "SSS":490, "SSS+":580, "U":700
};
/* Power ganho por Boss de prova (pode ajustar conforme balance) */
const RANK_BOSS_REWARD = {
  "E":10, "E+":12, "D":15, "D+":18, "C+":20, "B":25, "B+":30,
  "A":35, "A+":40, "S":50, "S+":60, "SS":75, "SS+":90,
  "SSS":110, "SSS+":140, "U":180
};

/* ---------- Estado ---------- */
const state = {
  unlocked: false,          // vira true após Reborn 2
  currentRank: null,        // null = Sem Rank
  powerFromSkills: 0,
  powerFromBosses: 0,
  powerFromAchievements: 0,
  activeTrial: null,        // { targetRank, bossRef }
};

/* ---------- API ---------- */
export function isUnlocked() { return !!state.unlocked; }
export function getCurrentRank() { return state.currentRank; }
export function getPowerBreakdown(){
  return {
    total: state.powerFromSkills + state.powerFromBosses + state.powerFromAchievements,
    skills: state.powerFromSkills,
    bosses: state.powerFromBosses,
    achieves: state.powerFromAchievements
  };
}
export function getNextRank(){
  if (!state.unlocked) return null;
  const idx = (state.currentRank ? RANK_ORDER.indexOf(state.currentRank)+1 : 0);
  return RANK_ORDER[idx] || null;
}
export function getRequiredPowerFor(rank){
  return RANK_REQUIREMENTS[rank] ?? Infinity;
}
export function grantAchievementPower(v){
  state.powerFromAchievements += Math.max(0, v|0);
}
export function addBossPowerFor(rank){
  const v = RANK_BOSS_REWARD[rank] ?? 10;
  state.powerFromBosses += v;
}

/* ---------- Regras de Pontos por Level ---------- */
export function shouldGrantPointOnLevel(level){
  // Antes de desbloquear: 1 ponto por level (comportamento antigo)
  // Após desbloquear (Reborn >=2): 1 ponto a cada 3 níveis
  if (!state.unlocked) return true;
  return (level % 3) === 0;
}

/* ---------- Poder de combate (skills) ---------- */
export function recomputeSkillPower(){
  const s = player.skill || { dmg:0, def:0, hp:0, body:0 };
  state.powerFromSkills =
      (s.dmg|0)*2 +
      (s.body|0)*3 +
      (s.def|0)*3 +
      (s.hp|0)*1;
}

/* ---------- Trial de Rank ---------- */
export function canProgress(){
  const next = getNextRank();
  if (!next) return { ok:false, reason: "No next rank" };
  if (state.activeTrial) return { ok:false, reason: "Trial already active" };
  const p = getPowerBreakdown().total;
  const need = getRequiredPowerFor(next);
  return { ok: p >= need, need };
}
export function startTrial(mapW, mapH, safeZones){
  const next = getNextRank();
  if (!next) return null;
  // Nasce Boss Tank com nível atual do jogador
  const boss = spawnBoss(mapW, mapH, safeZones, player.level);
  boss._rankTrial = true;
  boss._trialTargetRank = next;
  state.activeTrial = { targetRank: next, bossRef: boss };
  return boss;
}
export function onBossDefeated(boss){
  if (!boss?._rankTrial) return;
  const rank = boss._trialTargetRank;
  addBossPowerFor(rank);
  // Sobe para o rank em questão
  state.currentRank = rank;
  state.activeTrial = null;
}

/* ---------- Desbloqueio ---------- */
export function checkUnlockByReborn(){
  state.unlocked = (player.rebornCount||0) >= 2;
}

/* ---------- Bônus por Rank ---------- */
function rankStepsCount(){
  if (!state.currentRank) return 0;
  const idx = RANK_ORDER.indexOf(state.currentRank);
  return (idx >= 0) ? (idx+1) : 0;
}
export function getRankBonuses(){
  const steps = rankStepsCount();
  if (steps <= 0) return { dmgMult:1.0, drBonus:0.0 };
  // pesos diferentes por classe
  const isDPS = player.rebornClass === "DPS";
  const dmgPer = isDPS ? 0.03 : 0.015;
  const drPer  = isDPS ? 0.01 : 0.03;
  const dmgMult = 1 + dmgPer * steps;
  const drBonus = clamp(drPer * steps, 0, 0.6);
  return { dmgMult, drBonus };
}
export function applyRankBonusesToPlayer(){
  const b = getRankBonuses();
  player.rankDamageMult = b.dmgMult || 1.0;
  player.rankExtraDR    = b.drBonus || 0.0;
}

/* ---------- Tick ---------- */
export function tickRankSystem(){
  checkUnlockByReborn();
  recomputeSkillPower();
  applyRankBonusesToPlayer();
}
