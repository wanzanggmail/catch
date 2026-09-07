import Phaser from 'phaser';
import { InputAdapter } from '../systems/InputAdapter';
import { GAME } from '../game/config';

type TouchFlags = {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  useItem: boolean;
};

/**
 * On-screen D-Pad + action buttons for mobile.
 * Fixed to camera (scrollFactor 0).
 */
export class TouchControls {
  private scene: Phaser.Scene;
  private input: InputAdapter;
  readonly flags: TouchFlags = {
    left: false,
    right: false,
    jump: false,
    attack: false,
    useItem: false,
  };
  private root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, input: InputAdapter) {
    this.scene = scene;
    this.input = input;
    this.root = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);

    const y = GAME.height - 90;
    this.makeBtn(70, y, 70, 70, '◀', () => {
      this.flags.left = true;
      this.flags.right = false;
    }, () => {
      this.flags.left = false;
    });
    this.makeBtn(150, y, 70, 70, '▶', () => {
      this.flags.right = true;
      this.flags.left = false;
    }, () => {
      this.flags.right = false;
    });
    this.makeBtn(GAME.width - 160, y, 72, 72, '점프', () => {
      this.flags.jump = true;
    }, () => {
      this.flags.jump = false;
    });
    this.makeBtn(GAME.width - 70, y, 72, 72, '공격', () => {
      this.flags.attack = true;
    }, () => {
      this.flags.attack = false;
    });
    this.makeBtn(GAME.width - 70, y - 90, 64, 48, '아이템', () => {
      this.flags.useItem = true;
    }, () => {
      this.flags.useItem = false;
    });
  }

  private makeBtn(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onDown: () => void,
    onUp: () => void,
  ): void {
    const bg = this.scene.add
      .rectangle(x, y, w, h, 0xffffff, 0.18)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add
      .text(x, y, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: label.length > 2 ? '14px' : '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.root.add([bg, text]);

    bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      onDown();
      bg.setFillStyle(0xffffff, 0.35);
    });
    const release = () => {
      onUp();
      bg.setFillStyle(0xffffff, 0.18);
    };
    bg.on('pointerup', release);
    bg.on('pointerout', release);
    bg.on('pointerupoutside', release);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
