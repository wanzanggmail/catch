import Phaser from 'phaser';
import { GAME } from '../game/config';

/**
 * Small patrol rat — dies in 1 hit.
 * Walks back and forth on a platform ledge.
 */
export class SmallRat extends Phaser.Physics.Arcade.Sprite {
  private dir = 1;
  private leftBound: number;
  private rightBound: number;
  private dead = false;
  private speed: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    leftBound: number,
    rightBound: number,
    speedMul = 1,
  ) {
    super(scene, x, y, 'rat');
    this.leftBound = leftBound;
    this.rightBound = Math.max(rightBound, leftBound + GAME.tileSize);
    this.speed = 55 * speedMul;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(12);
    this.setTint(0x8d99ae);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(18, 14);
    body.setOffset(3, 6);
    body.setCollideWorldBounds(false);
    body.setMaxVelocity(120, 600);
  }

  get isDead(): boolean {
    return this.dead;
  }

  /** One-hit kill. Returns true if killed. */
  takeHit(): boolean {
    if (this.dead) return true;
    this.dead = true;
    this.setVelocity(0, -120);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      angle: this.dir * 90,
      duration: 350,
      onComplete: () => this.destroy(),
    });
    return true;
  }

  updatePatrol(): void {
    if (this.dead || !this.active) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(this.dir * this.speed);
    if (this.x <= this.leftBound) {
      this.dir = 1;
      this.x = this.leftBound;
    } else if (this.x >= this.rightBound) {
      this.dir = -1;
      this.x = this.rightBound;
    }
    // Turn around at walls
    if (body.blocked.left) this.dir = 1;
    if (body.blocked.right) this.dir = -1;
    this.setFlipX(this.dir < 0);
  }
}
