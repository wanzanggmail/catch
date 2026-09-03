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
      .text(w / 2, 100, '슬롯 선택 (키 1~3)', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#95d5b2',
      })
      .setOrigin(0.5);

    for (let i = 0; i < SAVE_SLOTS; i++) {
      this.drawSlot(i, 160 + i * 170);
    }

    const backHit = this.add
      .rectangle(80, h - 40, 120, 36, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(40, h - 40, '← 타이틀', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#778da9',
      })
      .setOrigin(0, 0.5);
    backHit.on('pointerdown', () => this.scene.start('Title'));

    this.input.keyboard?.on('keydown-ONE', () => this.selectSlot(0));
    this.input.keyboard?.on('keydown-TWO', () => this.selectSlot(1));
    this.input.keyboard?.on('keydown-THREE', () => this.selectSlot(2));
  }

  private selectSlot(index: number): void {
    saveManager.selectSlot(index);
    this.scene.start('StageSelect');
  }

  private drawSlot(index: number, y: number): void {
    const w = GAME.width;
    const slot = saveManager.getSlot(index);
    const boxW = w - 60;
    const boxH = 140;

    const row = this.add.container(w / 2, y);
    const box = this.add
      .rectangle(0, 0, boxW, boxH, 0x1b263b)
      .setStrokeStyle(2, 0x415a77);

    row.add(box);

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
      del.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        saveManager.deleteSlot(index);
        this.scene.restart();
      });
    }

    row.setInteractive(
      {
        hitArea: new Phaser.Geom.Rectangle(-boxW / 2, -boxH / 2, boxW, boxH),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      },
    );
    row.on('pointerover', () => box.setStrokeStyle(2, 0x95d5b2));
    row.on('pointerout', () => box.setStrokeStyle(2, 0x415a77));
    row.on('pointerdown', () => this.selectSlot(index));
  }
}
