import Phaser from 'phaser';
import { GAME, SAVE_SLOTS, EVOLUTION, evolutionForPlayingStage } from '../game/config';
import { saveManager } from '../systems/SaveManager';

export class SaveSlotScene extends Phaser.Scene {
  constructor() {
    super('SaveSlot');
  }

  create(): void {
    const w = GAME.width;
    const h = GAME.height;
    this.cameras.main.setBackgroundColor('#0d1b2a');

    this.add
      .text(w / 2, 60, '세이브 슬롯', {
        fontFamily: 'Georgia, serif',
        fontSize: '36px',
        color: '#fefae0',
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, 100, '슬롯을 선택하세요 (최대 3개)', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#95d5b2',
      })
      .setOrigin(0.5);

    for (let i = 0; i < SAVE_SLOTS; i++) {
      this.drawSlot(i, 160 + i * 170);
    }

    const back = this.add
      .text(40, h - 40, '← 타이틀', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#778da9',
      })
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('Title'));
  }

  private drawSlot(index: number, y: number): void {
    const w = GAME.width;
    const slot = saveManager.getSlot(index);
    const box = this.add
      .rectangle(w / 2, y, w - 60, 140, 0x1b263b)
      .setStrokeStyle(2, 0x415a77)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(50, y - 48, `슬롯 ${index + 1}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#e0e1dd',
      });

    if (!slot) {
      this.add.text(50, y - 10, '비어 있음 — 탭하여 새 게임', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#778da9',
      });
    } else {
      const evo = evolutionForPlayingStage(slot.unlockedStage);
      this.add.text(50, y - 14, `스테이지 ${slot.unlockedStage} · 맵 ${slot.unlockedMap[slot.unlockedStage] ?? 1}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#95d5b2',
      });
      this.add.text(50, y + 12, `진화: ${EVOLUTION[evo].label}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#f4a261',
      });
      this.add.text(50, y + 36, `클리어 ${slot.clearedMaps.length}맵 · 버프 보유 ${slot.inventoryBuffs.length}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#778da9',
      });

      const del = this.add
        .text(w - 70, y - 48, '삭제', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: '#e63946',
        })
        .setInteractive({ useHandCursor: true });
      del.on('pointerup', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        saveManager.deleteSlot(index);
        this.scene.restart();
      });
    }

    box.on('pointerover', () => box.setStrokeStyle(2, 0x95d5b2));
    box.on('pointerout', () => box.setStrokeStyle(2, 0x415a77));
    box.on('pointerup', () => {
      saveManager.selectSlot(index);
      this.scene.start('StageSelect');
    });
  }
}
