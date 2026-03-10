import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
    private hpLabel!: HTMLElement;
    private xpBarInner!: HTMLElement;
    private levelLabel!: HTMLElement;
    private statsPanel!: HTMLElement;
    private deathOverlay!: HTMLElement;

    constructor() {
        super({ key: 'UIScene', active: true });
    }

    create() {
        // Main HUD
        const hud = document.createElement('div');
        hud.id = 'hud';
        hud.className = 'glass-panel';
        hud.style.position = 'absolute';
        hud.style.top = '20px';
        hud.style.left = '20px';
        hud.style.padding = '10px 20px';
        hud.style.minWidth = '220px';
        hud.style.zIndex = '100';

        hud.innerHTML = `
            <div style="font-weight: 800; font-size: 18px; margin-bottom: 4px; color: #ff5555;">HP: <span id="hp-val">100/100</span></div>
            <div style="font-size: 14px; opacity: 0.8;">Level: <span id="lvl-val">1</span></div>
            <div id="xp-bar" style="width: 100%; height: 6px; background: rgba(0,0,0,0.3); border-radius: 3px; margin-top: 8px; overflow: hidden;">
                <div id="xp-inner" style="width: 0%; height: 100%; background: #ffd166; transition: width 0.3s ease;"></div>
            </div>
        `;
        document.body.appendChild(hud);

        // Stats Panel
        this.statsPanel = document.createElement('div');
        this.statsPanel.id = 'stats-panel';
        this.statsPanel.className = 'glass-panel';
        this.statsPanel.style.position = 'absolute';
        this.statsPanel.style.bottom = '20px';
        this.statsPanel.style.left = '20px';
        this.statsPanel.style.padding = '15px';
        this.statsPanel.style.fontSize = '13px';
        this.statsPanel.style.lineHeight = '1.6';
        this.statsPanel.style.minWidth = '180px';
        this.statsPanel.style.zIndex = '100';

        this.statsPanel.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 8px; color: #9ad0ff; text-transform: uppercase; letter-spacing: 1px;">Atributos</div>
            <div style="display: flex; justify-content: space-between;"><span>Dano:</span> <b id="stat-dmg">25</b></div>
            <div style="display: flex; justify-content: space-between;"><span>Corpo:</span> <b id="stat-body">10</b></div>
            <div style="display: flex; justify-content: space-between;"><span>Defesa:</span> <b id="stat-def">0%</b></div>
            <div style="display: flex; justify-content: space-between;"><span>Velocidade:</span> <b id="stat-spd">3.2</b></div>
            <div style="display: flex; justify-content: space-between;"><span>Regeneração:</span> <b id="stat-regen">0.05</b></div>
        `;
        document.body.appendChild(this.statsPanel);

        // Death Overlay
        this.deathOverlay = document.createElement('div');
        this.deathOverlay.id = 'death-overlay';
        this.deathOverlay.style.position = 'fixed';
        this.deathOverlay.style.inset = '0';
        this.deathOverlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
        this.deathOverlay.style.display = 'none';
        this.deathOverlay.style.flexDirection = 'column';
        this.deathOverlay.style.alignItems = 'center';
        this.deathOverlay.style.justifyContent = 'center';
        this.deathOverlay.style.zIndex = '1000';
        this.deathOverlay.style.backdropFilter = 'blur(10px)';

        this.deathOverlay.innerHTML = `
            <div class="glass-panel" style="padding: 40px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                <h1 style="color: #ff5555; font-size: 48px; margin-bottom: 10px; font-weight: 900;">FIM DE JOGO</h1>
                <p style="font-size: 20px; margin-bottom: 30px; opacity: 0.8;">Você chegou ao nível <span id="death-lvl">1</span></p>
                <button id="respawn-btn" style="
                    background: #4ccfff; 
                    color: #fff; 
                    border: none; 
                    padding: 12px 40px; 
                    font-size: 18px; 
                    font-weight: 700; 
                    border-radius: 8px; 
                    cursor: pointer;
                    transition: transform 0.2s, background 0.2s;
                ">REVIVER</button>
            </div>
        `;
        document.body.appendChild(this.deathOverlay);

        document.getElementById('respawn-btn')!.onclick = () => {
            this.deathOverlay.style.display = 'none';
            this.scene.get('MainScene').game.events.emit('player-respawn');
        };

        this.hpLabel = document.getElementById('hp-val')!;
        this.xpBarInner = document.getElementById('xp-inner')!;
        this.levelLabel = document.getElementById('lvl-val')!;

        // Listen for events from MainScene
        const mainScene = this.scene.get('MainScene');
        mainScene.events.on('update-hud', (data: any) => {
            if (this.deathOverlay.style.display === 'flex') return;

            this.hpLabel.innerText = `${Math.ceil(data.hp)}/${data.maxHp}`;
            this.levelLabel.innerText = data.level;
            const xpPerc = (data.xp / data.xpToNext) * 100;
            this.xpBarInner.style.width = `${xpPerc}%`;

            if (data.stats) {
                document.getElementById('stat-dmg')!.innerText = data.stats.dmg;
                document.getElementById('stat-body')!.innerText = data.stats.bodyDmg;
                document.getElementById('stat-def')!.innerText = Math.round(data.stats.def * 100) + '%';
                document.getElementById('stat-spd')!.innerText = data.stats.speed.toFixed(1);
                document.getElementById('stat-regen')!.innerText = data.stats.regen.toFixed(2);
            }
        });

        mainScene.events.on('player-died', (data: any) => {
            document.getElementById('death-lvl')!.innerText = data.level;
            this.deathOverlay.style.display = 'flex';
        });
    }
}
