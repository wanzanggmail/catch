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
        .setOrigin(0.5)
        .disableInteractive();
      if (!locked) {
        tab.on('pointerdown', () => {
          this.stage = s;
          this.scene.restart({ stage: s });
        });
      }
    }

    this.add
      .text(w / 2, 190, `Stage ${this.stage} — 맵 선택 (키 1~5)`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#95d5b2',
      })
      .setOrigin(0.5);

    for (let m = 1; m <= MAPS_PER_STAGE; m++) {
      this.drawMapRow(m, slot);
    }

    const back = this.add
      .rectangle(80, h - 40, 120, 36, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(40, h - 40, '← 슬롯', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#778da9',
      })
      .setOrigin(0, 0.5)
      .disableInteractive();
    back.on('pointerdown', () => this.scene.start('SaveSlot'));

    this.input.keyboard?.on('keydown-ONE', () => this.tryStartMap(1));
    this.input.keyboard?.on('keydown-TWO', () => this.tryStartMap(2));
    this.input.keyboard?.on('keydown-THREE', () => this.tryStartMap(3));
    this.input.keyboard?.on('keydown-FOUR', () => this.tryStartMap(4));
    this.input.keyboard?.on('keydown-FIVE', () => this.tryStartMap(5));
    this.input.keyboard?.on('keydown-ENTER', () => this.tryStartMap(1));
  }

  private drawMapRow(
    m: number,
    slot: ReturnType<typeof saveManager.getActive>,
  ): void {
    const w = GAME.width;
    const unlocked = saveManager.isMapUnlocked(this.stage, m);
    const cleared = slot.clearedMaps.includes(`${this.stage}-${m}`);
    const y = 240 + (m - 1) * 90;

    const row = this.add.container(w / 2, y);
    const boxW = w - 80;
    const boxH = 72;
    const fill = unlocked ? 0x1b263b : 0x111;
    const stroke = cleared ? 0xffd166 : unlocked ? 0x415a77 : 0x222;

    const box = this.add
      .rectangle(0, 0, boxW, boxH, fill)
      .setStrokeStyle(2, stroke);
    const label = this.add
      .text(-boxW / 2 + 24, 0, `맵 ${m}${cleared ? '  ✓' : ''}${unlocked ? '' : '  🔒'}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: unlocked ? '#e0e1dd' : '#444',
      })
      .setOrigin(0, 0.5);

    row.add([box, label]);

    if (unlocked) {
      row.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-boxW / 2, -boxH / 2, boxW, boxH),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
      row.on('pointerover', () => box.setFillStyle(0x243b55));
      row.on('pointerout', () => box.setFillStyle(fill));
      row.on('pointerdown', () => this.startMap(m));
    }
  }

  private tryStartMap(m: number): void {
    if (saveManager.isMapUnlocked(this.stage, m)) this.startMap(m);
  }

  private startMap(m: number): void {
    this.scene.start('Play', { stage: this.stage, map: m });
  }
}
