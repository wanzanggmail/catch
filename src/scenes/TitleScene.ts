import Phaser from 'phaser';
import { GAME } from '../game/config';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width: w, height: h } = { width: GAME.width, height: GAME.height };
    this.cameras.main.setBackgroundColor('#0d1b2a');

    // Atmosphere gradient strips
    for (let i = 0; i < 12; i++) {
      const y = (h / 12) * i;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x0d1b2a),
        Phaser.Display.Color.ValueToColor(0x1b4332),
        12,
        i,
      );
      this.add.rectangle(w / 2, y + h / 24, w, h / 12, Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    }

    // Floating platforms decoration
    for (let i = 0; i < 6; i++) {
      const plat = this.add.image(40 + i * 70, h - 80 - i * 90, 'brick').setAlpha(0.35).setScale(1.2);
      this.tweens.add({
        targets: plat,
        y: plat.y - 10,
        duration: 1800 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const cat = this.add.image(w / 2, h * 0.38, 'player').setScale(3.2);
    this.tweens.add({
      targets: cat,
      y: cat.y - 16,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(w / 2, h * 0.18, 'CATCH', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '72px',
        color: '#fefae0',
        stroke: '#1b4332',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h * 0.28, '아래에서 꼭대기까지, 거대 쥐를 잡아라', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#95d5b2',
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(w / 2, h * 0.72, 220, 56, 0x2d6a4f)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x95d5b2);
    this.add
      .text(w / 2, h * 0.72, '시작하기', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#fefae0',
      })
      .setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x40916c));
    btn.on('pointerout', () => btn.setFillStyle(0x2d6a4f));
    btn.on('pointerdown', () => this.scene.start('SaveSlot'));

    this.add
      .text(w / 2, h * 0.88, '키보드: ←→ / A D 이동 · Space 점프 · Z 공격 · X 아이템', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#778da9',
        align: 'center',
      })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('SaveSlot'));
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('SaveSlot'));
  }
}
