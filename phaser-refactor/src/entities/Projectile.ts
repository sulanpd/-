import Phaser from 'phaser';

export class Projectile extends Phaser.GameObjects.Arc {
    public damage: number;
    public life: number;
    public alive: boolean = true;

    constructor(scene: Phaser.Scene, x: number, y: number, damage: number, life: number) {
        super(scene, x, y, 5, 0, 360, false, 0x7ee7ff);

        this.damage = damage;
        this.life = life;

        scene.add.existing(this);
        // Physics will be added by the group in MainScene
    }

    public update(dt: number) {
        this.life -= dt;
        if (this.life <= 0) {
            this.alive = false;
            this.destroy();
        }
    }
}
