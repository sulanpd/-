import Phaser from 'phaser';

export interface PlayerStats {
    dmg: number;
    bodyDmg: number;
    def: number;
    speed: number;
    mob: number;
    regen: number;
    maxHp: number;
}

export class Player extends Phaser.GameObjects.Arc {
    public hp: number = 100;
    public maxHp: number = 100;
    public level: number = 1;
    public xp: number = 0;
    public xpToNext: number = 100;
    public points: number = 0;
    public alive: boolean = true;
    private sceneBases: any = null;

    // Movement and Stats
    public baseStats: PlayerStats = {
        dmg: 25,
        bodyDmg: 10,
        def: 0.1,
        speed: 2.5,
        mob: 1.0,
        regen: 0.05,
        maxHp: 100
    };

    public skill = { dmg: 0, def: 0, hp: 0, regen: 0, speed: 0, mob: 0, body: 0 };
    public milestones = { dmg10: false, def10: false, spd10: false };

    public rebornCount: number = 0;
    public rebornClass: 'DPS' | 'TANK' | null = null;
    public shield: number = 0;
    public shieldMax: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 28, 0, 360, false, 0x4ccfff);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCircle(28);
        body.setCollideWorldBounds(true);
    }

    public die() {
        this.alive = false;
        this.setVisible(false);
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        body.setEnable(false);
    }

    public respawn(x: number, y: number) {
        this.alive = true;
        this.setVisible(true);
        this.setPosition(x, y);
        this.hp = this.maxHp;
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setEnable(true);
        body.setVelocity(0, 0);
    }

    public updateStats(BASES: any) {
        if (BASES) this.sceneBases = BASES;
        const s = this.skill;
        const hpMul = 1 + 0.10 * (s.hp || 0);
        const dmgMul = 1 + 0.12 * (s.dmg || 0);
        const bodyMul = 1 + 0.15 * (s.body || 0);
        const defAdd = 0.04 * (s.def || 0);
        const speedMul = 1 + 0.06 * (s.speed || 0);
        const mobMul = 1 + 0.05 * (s.mob || 0);
        const regenAdd = 0.005 * (s.regen || 0);

        this.maxHp = Math.round((BASES?.BASE_HP ?? 100) * hpMul);
        this.hp = Math.min(this.maxHp, this.hp > 0 ? this.hp : this.maxHp);
        this.baseStats.dmg = Math.round((BASES?.BASE_DMG ?? 25) * dmgMul);
        this.baseStats.bodyDmg = Math.round((BASES?.BASE_BODY ?? 10) * bodyMul);
        this.baseStats.def = Math.max(0, Math.min(0.8, (BASES?.BASE_DEF ?? 0) + defAdd));
        this.baseStats.speed = (BASES?.BASE_SPEED ?? 3.2) * speedMul;
        this.baseStats.mob = (BASES?.BASE_MOB ?? 1.0) * mobMul;
        this.baseStats.regen = Math.max(0, regenAdd);

        this.milestones.dmg10 = s.dmg >= 10;
        this.milestones.def10 = s.def >= 10;
        this.milestones.spd10 = s.speed >= 10;

        if (this.rebornClass === "TANK") {
            this.shieldMax = Math.round(this.maxHp * 0.6);
            if (this.shield === 0) this.shield = this.shieldMax;
        }
    }

    public gainXP(amount: number) {
        const mult = 1 + 0.25 * this.rebornCount;
        this.xp += amount * mult;
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level++;
            this.points++;
            this.xpToNext = 100 + Math.floor((this.level - 1) * 35);
        }
    }
}
