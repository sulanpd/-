import Phaser from 'phaser';

export class Block extends Phaser.GameObjects.Container {
    public hp: number;
    public maxHp: number;
    public dmg: number;
    public xpReward: number;
    public alive: boolean = true;

    private hpBar!: Phaser.GameObjects.Rectangle;
    private hpBarBg!: Phaser.GameObjects.Rectangle;
    private label!: Phaser.GameObjects.Text;
    private visual!: Phaser.GameObjects.Rectangle;

    constructor(scene: Phaser.Scene, x: number, y: number, level: number) {
        super(scene, x, y);

        const stats = Block.getStats(level);
        this.maxHp = stats.hp;
        this.hp = stats.hp;
        this.dmg = stats.dmg;
        this.xpReward = stats.xp;

        // Visual rectangle
        this.visual = scene.add.rectangle(0, 0, 40, 40, stats.color);
        this.add(this.visual);

        // HP Bar Background
        this.hpBarBg = scene.add.rectangle(0, 30, 40, 5, 0x000000, 0.5);
        this.add(this.hpBarBg);

        // HP Bar Fill
        this.hpBar = scene.add.rectangle(-20, 30, 40, 5, 0x55ff55);
        this.hpBar.setOrigin(0, 0.5);
        this.add(this.hpBar);

        // Level Label
        this.label = scene.add.text(0, -35, `Lv ${level}`, {
            fontSize: '12px',
            fontFamily: 'Inter',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.add(this.label);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(40, 40);
        body.setOffset(-20, -20);
        body.setImmovable(true);
    }

    private static getStats(level: number) {
        const colors = [0x55acee, 0xbb8dbd, 0xffd166, 0xff6b6b];
        const color = colors[Math.floor(Math.random() * colors.length)];
        return {
            hp: 40 + (level * 15),
            dmg: 5 + (level * 2),
            xp: 10 + (level * 5),
            color: color
        };
    }

    public updateHPBar() {
        const perc = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
        this.hpBar.setScale(perc, 1);

        if (perc < 0.3) this.hpBar.setFillStyle(0xff5555);
        else if (perc < 0.6) this.hpBar.setFillStyle(0xffff55);
        else this.hpBar.setFillStyle(0x55ff55);
    }

    public preUpdate() {
        this.updateHPBar();
    }
}
