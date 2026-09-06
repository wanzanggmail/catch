import Phaser from 'phaser';
import { GAME } from '../game/config';

/**
 * Vertical camera: smooth Y follow both up and down (clamped to map).
 * Falling no longer kills — the view just tracks the player downward.
 */
export class VerticalCamera {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private floorY: number;
  private mapTop: number;
  private targetY: number;

  constructor(
    cam: Phaser.Cameras.Scene2D.Camera,
    mapPixelHeight: number,
    mapPixelWidth: number,
  ) {
    this.cam = cam;
    this.mapTop = 0;
    this.floorY = Math.max(0, mapPixelHeight - GAME.height);
    this.targetY = this.floorY;
    cam.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    cam.setScroll(0, this.floorY);
  }

  get scrollY(): number {
    return this.cam.scrollY;
  }

  /** Bottom edge of the view (for HUD / debug only — not deadly). */
  get viewBottomY(): number {
    return this.cam.scrollY + GAME.height;
  }

  update(playerY: number, dt: number): void {
    const desired = Phaser.Math.Clamp(
      playerY - GAME.height * 0.5,
      this.mapTop,
      this.floorY,
    );
    this.targetY = desired;
    const current = this.cam.scrollY;
    const next = Phaser.Math.Linear(current, this.targetY, 1 - Math.pow(0.0008, dt));
    this.cam.setScroll(0, next);
  }

  snapToPlayer(playerY: number): void {
    const desired = Phaser.Math.Clamp(
      playerY - GAME.height * 0.5,
      this.mapTop,
      this.floorY,
    );
    this.targetY = desired;
    this.cam.setScroll(0, desired);
  }
}
