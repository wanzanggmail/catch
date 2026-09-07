import Phaser from 'phaser';
import { GAME, MAPS_PER_STAGE, STAGES } from '../game/config';
import { saveManager } from '../systems/SaveManager';

export interface ResultData {
  victory: boolean;
  stage: number;
  map: number;
  reason?: string;
}

export class ResultScene extends Phaser.Scene {
  private result!: ResultData;

  constructor() {
    super('Result');
  }

  init(data: ResultData): void {
    this.result = data;
  }

  create(): void {
    const w = GAME.width;
    const h = GAME.height;
    this.cameras.main.setBackgroundColor('#0d1b2a');
    const { victory, stage, map, reason } = this.result;

    this.add
      .text(w / 2, h * 0.28, victory ? '스테이지 클리어!' : '실패…', {
        fontFamily: 'Georgia, serif',
        fontSize: '40px',
        color: victory ? '#ffd166' : '#e63946',
      })
      .setOrigin(0.5);

    this.add
      .text(
        w / 2,
        h * 0.38,
        victory
          ? `Stage ${stage} · Map ${map} 클리어`
          : reason ?? '다시 도전하세요',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#95d5b2',
        },
      )
      .setOrigin(0.5);

    if (victory) {
      const next =
        map < MAPS_PER_STAGE
          ? { stage, map: map + 1 }
          : stage < STAGES
            ? { stage: stage + 1, map: 1 }
            : null;
      if (next) {
        this.makeBtn(w / 2, h * 0.55, '다음 맵', () => {
          this.scene.start('Play', next);
        });
      } else {
        this.add
          .text(w / 2, h * 0.52, '모든 스테이지를 클리어했습니다!', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '15px',
            color: '#f4a261',
          })
          .setOrigin(0.5);
      }
    } else {
      this.makeBtn(w / 2, h * 0.55, '다시 도전', () => {
        this.scene.start('Play', { stage, map });
      });
    }

    this.makeBtn(w / 2, h * 0.68, '스테이지 선택', () => {
      this.scene.start('StageSelect', { stage: saveManager.getActive().unlockedStage });
    });

    this.makeBtn(w / 2, h * 0.8, '타이틀로', () => {
      this.scene.start('Title');
    }, true);
  }

  private makeBtn(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    muted = false,
  ): void {
    const box = this.add
      .rectangle(x, y, 220, 48, muted ? 0x1b263b : 0x2d6a4f)
      .setStrokeStyle(2, muted ? 0x415a77 : 0x95d5b2)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#fefae0',
      })
      .setOrigin(0.5);
    box.on('pointerup', onClick);
  }
}
