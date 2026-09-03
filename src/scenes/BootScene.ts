import Phaser from 'phaser';
import { generateTextures } from '../game/textures';
import { GAME } from '../game/config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateTextures(this);
    this.cameras.main.setBackgroundColor('#0d1b2a');
    this.add
      .text(GAME.width / 2, GAME.height / 2, 'CATCH', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '48px',
        color: '#e0e1dd',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME.width / 2, GAME.height / 2 + 48, '로딩…', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#778da9',
      })
      .setOrigin(0.5);

    this.time.delayedCall(400, () => this.scene.start('Title'));
  }
}
