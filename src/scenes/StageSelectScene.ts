import Phaser from 'phaser';
import { GAME, STAGES, MAPS_PER_STAGE, EVOLUTION } from '../game/config';
import { saveManager } from '../systems/SaveManager';

export class StageSelectScene extends Phaser.Scene {
  private stage = 1;

  constructor() {
    super('StageSelect');
  }

  init(data?: { stage?: number }): void {
    this.stage = data?.stage ?? saveManager.getActive().unlockedStage;
  }

  create(): void {
    const w = GAME.width;
    const h = GAME.height;
    this.cameras.main.setBackgroundColor('#0d1b2a');
    const slot = saveManager.getActive();
    const evo = saveManager.evolution();

    this.add
      .text(w / 2, 48, '스테이지 선택', {
        fontFamily: 'Georgia, serif',
        fontSize: '32px',
        color: '#fefae0',
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, 88, `진화: ${EVOLUTION[evo].label}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#f4a261',
      })
      .setOrigin(0.5);

    // Stage tabs
    for (let s = 1; s <= STAGES; s++) {
      const locked = s > slot.unlockedStage;
      const x = 40 + (s - 1) * 72;
      const tab = this.add
        .rectangle(x + 28, 140, 64, 40, locked ? 0x1b263b : s === this.stage ? 0x2d6a4f : 0x415a77)
        .setStrokeStyle(1, locked ? 0x333 : 0x95d5b2)
        .setInteractive({ useHandCursor: !locked });
      this.add
        .text(x + 28, 140, `S${s}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: locked ? '#555' : '#fefae0',
        })
        .setOrigin(0.5);
      if (!locked) {
        tab.on('pointerup', () => {
          this.stage = s;
          this.scene.restart({ stage: s });
        });
      }
    }

    this.add
      .text(w / 2, 190, `Stage ${this.stage} — 맵 선택`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#95d5b2',
      })
      .setOrigin(0.5);

    for (let m = 1; m <= MAPS_PER_STAGE; m++) {
      const unlocked = saveManager.isMapUnlocked(this.stage, m);
      const cleared = slot.clearedMaps.includes(`${this.stage}-${m}`);
      const y = 240 + (m - 1) * 90;
      const box = this.add
        .rectangle(w / 2, y, w - 80, 72, unlocked ? 0x1b263b : 0x111)
        .setStrokeStyle(2, cleared ? 0xffd166 : unlocked ? 0x415a77 : 0x222)
        .setInteractive({ useHandCursor: unlocked });
      this.add
        .text(70, y, `맵 ${m}${cleared ? '  ✓' : ''}${unlocked ? '' : '  🔒'}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: unlocked ? '#e0e1dd' : '#444',
        })
        .setOrigin(0, 0.5);

      if (unlocked) {
        box.on('pointerover', () => box.setFillStyle(0x243b55));
        box.on('pointerout', () => box.setFillStyle(0x1b263b));
        box.on('pointerup', () => {
          this.scene.start('Play', { stage: this.stage, map: m });
        });
      }
    }

    const back = this.add
      .text(40, h - 40, '← 슬롯', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#778da9',
      })
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('SaveSlot'));
  }
}
