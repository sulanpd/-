import Phaser from 'phaser';

export const ENEMY_RANKS = ["E", "E+", "D", "D+", "C+", "B", "B+", "A", "A+", "S", "S+", "SS", "SS+", "SSS", "SSS+", "U"];

export class Enemy extends Phaser.GameObjects.Container {
    public hp: number;
    public maxHp: number;
    public type: string;
    public level: number;
    public dmg: number;
    public xpReward: number;
    public speed: number;
    public alive: boolean = true;

    private hpBar!: Phaser.GameObjects.Rectangle;
    private hpBarBg!: Phaser.GameObjects.Rectangle;
    private label!: Phaser.GameObjects.Text;
    private visual!: Phaser.GameObjects.Arc;

    constructor(scene: Phaser.Scene, x: number, y: number, type: string, level: number) {
        super(scene, x, y);

        const config = Enemy.getStats(type, level);
        this.type = type;
        this.level = level;
        this.maxHp = config.hp;
        this.hp = config.hp;
        this.dmg = config.dmg;
        this.xpReward = config.xp;
        this.speed = config.speed;

        // Visual circle
        this.visual = scene.add.arc(0, 0, config.radius, 0, 360, false, config.color);
        this.add(this.visual);

        // HP Bar Background
        const barWidth = config.radius * 2;
        this.hpBarBg = scene.add.rectangle(0, config.radius + 15, barWidth, 6, 0x000000, 0.5);
        this.add(this.hpBarBg);

        // HP Bar Fill
        this.hpBar = scene.add.rectangle(-barWidth / 2, config.radius + 15, barWidth, 6, 0x55ff55);
        this.hpBar.setOrigin(0, 0.5);
        this.add(this.hpBar);

        // Level Label
        this.label = scene.add.text(0, -config.radius - 20, `Lv ${level}`, {
            fontSize: '14px',
            fontFamily: 'Inter',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        this.add(this.label);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCircle(config.radius, -config.radius, -config.radius);
    }

    private static getStats(type: string, level: number) {
        const bases: any = {
            basic: { hp: 160, dmg: 10, xp: 20, radius: 26, color: 0xf35555, speed: 2.6 },
            orange: { hp: 210, dmg: 14, xp: 40, radius: 26, color: 0xff9c40, speed: 2.2 },
            boss: { hp: 2800, dmg: 55, xp: 250, radius: 60, color: 0xb1002a, speed: 1.8 }
        };

        const b = bases[type] || bases.basic;
        const lvl = Math.max(1, level);
        return {
            hp: Math.round(b.hp * (1 + 0.10 * (lvl - 1))),
            dmg: Math.round(b.dmg * (1 + 0.05 * (lvl - 1))),
            xp: Math.round(b.xp * (1 + 0.10 * (lvl - 1))),
            radius: b.radius,
            color: b.color,
            speed: b.speed
        };
    }

    public updateHPBar() {
        const perc = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
        this.hpBar.setScale(perc, 1);

        // Color transition
        if (perc < 0.3) this.hpBar.setFillStyle(0xff5555);
        else if (perc < 0.6) this.hpBar.setFillStyle(0xffff55);
        else this.hpBar.setFillStyle(0x55ff55);
    }

    public updateAI(player: Phaser.GameObjects.Components.Transform) {
        if (!this.alive) return;

        const body = this.body as Phaser.Physics.Arcade.Body;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

        if (dist < 650) {
            this.scene.physics.moveToObject(this, player, this.speed * 60);
        } else {
            body.setVelocity(0, 0);
        }

        this.updateHPBar();
    }
}
