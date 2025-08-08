export let player = {
  x: 0, y: 0,
  radius: 28,
  color: "#4ccfff",
  hp: 100, maxHp: 100,
  dmg: 25,            // dano do tiro
  bodyDmg: 10,        // dano corpo-a-corpo
  def: 0,             // 0..0.95 (percentual de redução)
  speed: 3.2,
  mob: 1.0,
  xp: 0, xpToNext: 100, level: 1, points: 0,
  alive: true, respawnTimer: 0,
  // estados aplicados pelo boss
  freezeTimer: 0,          // não move enquanto >0
  defDebuff: 0,            // +dano recebido (0.25 quando círculo ativo)
  slowMult: 1,             // 0.5 quando círculo ativo
};

let BASES = {
  BASE_HP: 100, BASE_DMG: 25, BASE_DEF: 0, BASE_SPEED: 3.2, BASE_MOB: 1.0, BASE_BODY: 10
};

export function playerBaseStats(bases) {
  if (bases) BASES = bases;
  player.maxHp = Math.floor(BASES.BASE_HP + (player.points ? player.points : 0) * 5 + (player.skill?.hp || 0) * 20);
  player.hp = Math.min(player.hp, player.maxHp);
  player.dmg = Math.floor(BASES.BASE_DMG + (player.skill?.dmg || 0) * 5);
  player.bodyDmg = Math.floor(BASES.BASE_BODY + (player.skill?.body || player.skill?.bodyDmg || 0) * 5);
  player.def = Math.min(0.95, (BASES.BASE_DEF || 0) + (player.skill?.def || 0) * 0.02);
  player.speed = (BASES.BASE_SPEED || 3.2) + (player.skill?.speed || 0) * 0.15;
  player.mob = (BASES.BASE_MOB || 1.0) + Math.min(0.5, (player.skill?.mob || 0) * 0.02);
  if (!player.skill) player.skill = { dmg:0, def:0, hp:0, regen:0, speed:0, mob:0, body:0 };
}

export function resetPlayer(safeZones) {
  const z = safeZones[Math.floor(Math.random()*safeZones.length)];
  player.x = z.x; player.y = z.y;
  player.hp = player.maxHp;
  player.alive = true;
  player.respawnTimer = 0;
  player.freezeTimer = 0;
  player.defDebuff = 0;
  player.slowMult = 1;
}

export function getPlayerRegen(){ return (player.skill?.regen || 0) * 0.005; }
export function getPlayerDefPercent(){
  const eff = Math.max(0, player.def - (player.defDebuff || 0));
  return Math.min(0.95, eff);
}
export function getPlayerBonusXP(x){ return x; }
export function xpToNext(level){ return 100 + (level-1)*50; }
