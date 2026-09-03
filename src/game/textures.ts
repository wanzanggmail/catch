import Phaser from 'phaser';
import { GAME } from '../game/config';

/** Generate placeholder textures at runtime — no external art required. */
export function generateTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  const block = (key: string, color: number, detail?: (gg: Phaser.GameObjects.Graphics) => void) => {
    g.clear();
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, GAME.tileSize, GAME.tileSize, 4);
    g.lineStyle(2, 0x000000, 0.25);
    g.strokeRoundedRect(1, 1, GAME.tileSize - 2, GAME.tileSize - 2, 4);
    detail?.(g);
    g.generateTexture(key, GAME.tileSize, GAME.tileSize);
  };

  block('brick', 0xc4a484, (gg) => {
    gg.lineStyle(1, 0x000000, 0.2);
    gg.lineBetween(0, 16, 32, 16);
    gg.lineBetween(16, 0, 16, 16);
    gg.lineBetween(8, 16, 8, 32);
    gg.lineBetween(24, 16, 24, 32);
  });

  block('line', 0x90e0ef, (gg) => {
    gg.fillStyle(0xffffff, 0.35);
    gg.fillRect(2, 2, 28, 8);
  });

  block('question', 0xffd166, (gg) => {
    gg.fillStyle(0x333333, 1);
    // simple "?"
    gg.fillRect(12, 6, 8, 4);
    gg.fillRect(18, 10, 6, 6);
    gg.fillRect(12, 16, 8, 4);
    gg.fillRect(14, 24, 4, 4);
  });

  block('question_empty', 0x6c757d);

  block('cloud', 0xf8f9fa, (gg) => {
    gg.fillStyle(0xe9ecef, 1);
    gg.fillCircle(10, 18, 10);
    gg.fillCircle(22, 16, 12);
    gg.fillCircle(16, 20, 9);
  });

  // checkpoint flag
  g.clear();
  g.fillStyle(0x06d6a0, 1);
  g.fillRect(14, 4, 4, 28);
  g.fillStyle(0xff6b6b, 1);
  g.fillTriangle(18, 6, 30, 12, 18, 18);
  g.generateTexture('checkpoint', GAME.tileSize, GAME.tileSize);

  // player cat (32x32)
  g.clear();
  g.fillStyle(0xf4a261, 1);
  g.fillRoundedRect(6, 8, 20, 20, 6);
  g.fillStyle(0xe9c46a, 1);
  g.fillCircle(10, 6, 5);
  g.fillCircle(22, 6, 5);
  g.fillStyle(0x222222, 1);
  g.fillCircle(12, 16, 2);
  g.fillCircle(20, 16, 2);
  g.fillStyle(0xe76f51, 1);
  g.fillTriangle(16, 18, 14, 22, 18, 22);
  g.generateTexture('player', 32, 32);

  // boss rat
  g.clear();
  g.fillStyle(0xb56576, 1);
  g.fillRoundedRect(4, 12, 56, 36, 10);
  g.fillCircle(16, 14, 10);
  g.fillCircle(48, 14, 10);
  g.fillStyle(0x222222, 1);
  g.fillCircle(22, 28, 3);
  g.fillCircle(42, 28, 3);
  g.fillStyle(0xffcad4, 1);
  g.fillCircle(32, 36, 5);
  g.generateTexture('boss', 64, 56);

  // projectile
  g.clear();
  g.fillStyle(0x6d597a, 1);
  g.fillCircle(8, 8, 8);
  g.generateTexture('projectile', 16, 16);

  // claw slash
  g.clear();
  g.lineStyle(3, 0xffffff, 0.9);
  g.lineBetween(2, 4, 20, 12);
  g.lineBetween(2, 12, 20, 16);
  g.lineBetween(2, 20, 20, 20);
  g.generateTexture('slash', 24, 24);

  // buff orbs
  const buffColors: Record<string, number> = {
    speed: 0x4cc9f0,
    jump: 0x80ed99,
    shield: 0xf72585,
    power: 0xff9f1c,
  };
  for (const [k, c] of Object.entries(buffColors)) {
    g.clear();
    g.fillStyle(c, 1);
    g.fillCircle(10, 10, 10);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(7, 7, 3);
    g.generateTexture(`buff_${k}`, 20, 20);
  }

  // bg tile soft
  g.clear();
  g.fillStyle(0x1b263b, 1);
  g.fillRect(0, 0, 64, 64);
  g.fillStyle(0x415a77, 0.15);
  g.fillCircle(20, 30, 18);
  g.fillCircle(48, 40, 12);
  g.generateTexture('bg_tile', 64, 64);

  g.destroy();
}
