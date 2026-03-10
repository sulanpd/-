import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Block } from '../entities/Block';

export class MainScene extends Phaser.Scene {
    private player!: Player;
    private enemies!: Phaser.Physics.Arcade.Group;
    private blocks!: Phaser.Physics.Arcade.Group;
    private projectiles!: Phaser.Physics.Arcade.Group;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private score: number = 0;
    private shootTimer: number = 0;
    private fireRate: number = 200; // ms
    private isGameOver: boolean = false;

    constructor() {
        super('MainScene');
    }

    create() {
        this.isGameOver = false;

        // World setup
        this.physics.world.setBounds(0, 0, 3000, 3000);

        // Groups
        this.enemies = this.physics.add.group({ classType: Enemy });
        this.blocks = this.physics.add.group({ classType: Block });
        this.projectiles = this.physics.add.group({ classType: Projectile });

        // Player
        this.player = new Player(this, 1500, 1500);
        this.player.updateStats({ BASE_HP: 100, BASE_DMG: 25, BASE_BODY: 10, BASE_SPEED: 3.2, BASE_MOB: 1.0 });

        // Camera
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, 3000, 3000);

        // Input
        this.cursors = this.input.keyboard!.createCursorKeys();

        // Spawner
        this.time.addEvent({
            delay: 1000,
            callback: () => {
                if (this.isGameOver) return;
                this.spawnBlock();
                this.spawnEnemyRange();
            },
            loop: true
        });

        // Collisions
        this.physics.add.collider(this.projectiles, this.enemies, (p, e) => {
            this.handleProjectileEnemyCollision(p as Projectile, e as Enemy);
        });

        this.physics.add.collider(this.projectiles, this.blocks, (p, b) => {
            this.handleProjectileBlockCollision(p as Projectile, b as Block);
        });

        this.physics.add.overlap(this.player, this.enemies, (p, e) => {
            if (this.isGameOver) return;
            this.handlePlayerEnemyCollision(p as Player, e as Enemy);
        });

        this.physics.add.collider(this.player, this.blocks, (p, b) => {
            if (this.isGameOver) return;
            this.handlePlayerBlockCollision(p as Player, b as Block);
        });

        // Event for respawn
        this.game.events.on('player-respawn', () => {
            this.respawnPlayer();
        });
    }

    update(time: number, delta: number) {
        if (this.isGameOver) return;

        if (this.player.hp <= 0 && this.player.alive) {
            this.playerDie();
            return;
        }

        // Regen
        if (this.player.hp < this.player.maxHp) {
            this.player.hp += this.player.baseStats.regen * (delta / 1000) * 60;
        }

        // Player movement
        let vx = 0;
        let vy = 0;
        const speed = this.player.baseStats.speed * 60;

        if (this.cursors.left.isDown || this.input.keyboard!.addKey('A').isDown) vx = -1;
        if (this.cursors.right.isDown || this.input.keyboard!.addKey('D').isDown) vx = 1;
        if (this.cursors.up.isDown || this.input.keyboard!.addKey('W').isDown) vy = -1;
        if (this.cursors.down.isDown || this.input.keyboard!.addKey('S').isDown) vy = 1;

        if (vx !== 0 || vy !== 0) {
            const length = Math.sqrt(vx * vx + vy * vy);
            vx /= length;
            vy /= length;
        }

        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(vx * speed, vy * speed);

        // Continuous fire
        if (this.input.activePointer.isDown && time > this.shootTimer) {
            this.fireProjectile();
            this.shootTimer = time + this.fireRate;
        }

        // Projectiles update
        this.projectiles.getChildren().forEach((p) => {
            (p as Projectile).update(delta / 1000);
        });

        // Enemies update
        this.enemies.getChildren().forEach((e) => {
            (e as Enemy).updateAI(this.player);
        });

        // Update HUD via event
        this.events.emit('update-hud', {
            hp: this.player.hp,
            maxHp: this.player.maxHp,
            xp: this.player.xp,
            xpToNext: this.player.xpToNext,
            level: this.player.level,
            stats: this.player.baseStats
        });
    }

    private playerDie() {
        this.isGameOver = true;
        this.player.die();
        this.events.emit('player-died', { level: this.player.level });

        // Stop all enemies
        this.enemies.getChildren().forEach(e => {
            const body = e.body as Phaser.Physics.Arcade.Body;
            body.setVelocity(0, 0);
        });
    }

    private respawnPlayer() {
        this.isGameOver = false;
        this.player.respawn(1500, 1500);
        // Stats are kept by the player object
    }

    private fireProjectile() {
        const pointer = this.input.activePointer;
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
        const vx = Math.cos(angle) * 16;
        const vy = Math.sin(angle) * 16;

        const p = new Projectile(this, this.player.x, this.player.y, this.player.baseStats.dmg, 1.4);
        this.projectiles.add(p);

        // Apply physics to the projectile manually after adding to group
        const pBody = p.body as Phaser.Physics.Arcade.Body;
        if (pBody) {
            pBody.setCircle(5);
            pBody.setVelocity(vx * 60, vy * 60);
            pBody.setCollideWorldBounds(false);
        }
    }

    private spawnEnemyRange() {
        if (this.enemies.getLength() > 25) return;

        const angle = Math.random() * Math.PI * 2;
        const dist = 600 + Math.random() * 200;
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;

        const type = Math.random() > 0.8 ? 'orange' : 'basic';
        const e = new Enemy(this, x, y, type, this.player.level);
        this.enemies.add(e);
    }

    private spawnBlock() {
        if (this.blocks.getLength() > 50) return;
        const x = Math.random() * 3000;
        const y = Math.random() * 3000;
        if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 300) return;

        const b = new Block(this, x, y, Math.max(1, Math.floor(this.player.level * 0.8)));
        this.blocks.add(b);
    }

    private handleProjectileEnemyCollision(p: Projectile, e: Enemy) {
        e.hp -= p.damage;
        e.updateHPBar();
        p.destroy();
        if (e.hp <= 0) {
            e.alive = false;
            this.player.gainXP(e.xpReward);
            e.destroy();
            this.score += 10;
        }
    }

    private handleProjectileBlockCollision(p: Projectile, b: Block) {
        b.hp -= p.damage;
        b.updateHPBar();
        p.destroy();
        if (b.hp <= 0) {
            b.alive = false;
            this.player.gainXP(b.xpReward);
            b.destroy();
            this.score += 5;
        }
    }

    private handlePlayerEnemyCollision(p: Player, e: Enemy) {
        const dt = this.game.loop.delta / 1000;
        e.hp -= p.baseStats.bodyDmg * dt * 60;
        p.hp -= e.dmg * dt;
        e.updateHPBar();

        if (e.hp <= 0) {
            e.alive = false;
            p.gainXP(e.xpReward);
            e.destroy();
        }
    }

    private handlePlayerBlockCollision(p: Player, b: Block) {
        const dt = this.game.loop.delta / 1000;
        b.hp -= p.baseStats.bodyDmg * dt * 60;
        p.hp -= b.dmg * dt;
        b.updateHPBar();

        if (b.hp <= 0) {
            b.alive = false;
            p.gainXP(b.xpReward);
            b.destroy();
        }
    }
}
