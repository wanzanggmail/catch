import Phaser from 'phaser';
import { GAME, PHYSICS } from './game/config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { SaveSlotScene } from './scenes/SaveSlotScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { PlayScene } from './scenes/PlayScene';
import { ResultScene } from './scenes/ResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME.width,
  height: GAME.height,
  backgroundColor: '#0d1b2a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PHYSICS.gravity },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, SaveSlotScene, StageSelectScene, PlayScene, ResultScene],
  input: {
    activePointers: 3,
  },
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
