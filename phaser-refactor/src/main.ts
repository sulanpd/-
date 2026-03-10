import Phaser from 'phaser';
import { GameConfig } from './GameConfig';

window.addEventListener('load', () => {
  new Phaser.Game(GameConfig);
});
