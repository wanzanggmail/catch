import Phaser from 'phaser';
import { GAME } from '../game/config';

/**
 * Vertical ascent camera: smooth Y follow when player is above mid-screen,
 * never scrolls down, deadly bottom edge for fall death.
 */
export class VerticalCamera {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private floorY: number;
  private mapBottom: number;
  private mapTop: number;
  private targetY: number;

  constructor(
    cam: Phaser.Cameras.Scene2D.Camera,
    mapPixelHeight: number,
    mapPixelWidth: number,
  ) {
    this.cam = cam;
    this.mapBottom = mapPixelHeight;
    this.mapTop = 0;
    this.floorY = mapPixelHeight - GAME.height;
    this.targetY = this.floorY;
    cam.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    cam.setScroll(0, this.floorY);
  }

  get deadlyBottomY(): number {
    return this.cam.scrollY + GAME.height + GAME.checkpointGracePx;
  }

  get scrollY(): number {
    return this.cam.scrollY;
  }

  update(playerY: number, dt: number): void {
    const mid = this.cam.scrollY + GAME.height * 0.5;
    if (playerY < mid) {
      const desired = Phaser.Math.Clamp(
        playerY - GAME.height * 0.5,
        this.mapTop,
        this.floorY,
      );
      // Only allow scrolling upward (smaller scrollY)
      if (desired < this.targetY) {
        this.targetY = desired;
      }
    }
    const current = this.cam.scrollY;
    const next = Phaser.Math.Linear(current, this.targetY, 1 - Math.pow(0.001, dt));
    // Never go downward
    this.cam.setScroll(0, Math.min(current, next));
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
