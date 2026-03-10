import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { UIScene } from './scenes/UIScene';

export const GameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#111111',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    dom: {
        createContainer: true
    },
    scene: [MainScene, UIScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};
