import Phaser from 'phaser';

/**
 * Small stationary rat — dies in 1 hit.
 * Stays put on its platform; contact damages the player.
 */
export class SmallRat extends Phaser.Physics.Arcade.Sprite {
  private dead = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    _leftBound = 0,
    _rightBound = 0,
    _speedMul = 1,
  ) {
    super(scene, x, y, 'rat');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(12);
    this.setTint(0x8d99ae);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(18, 14);
    body.setOffset(3, 6);
    body.setCollideWorldBounds(false);
    body.setMaxVelocity(0, 600);
    body.setVelocity(0, 0);
    body.setAllowGravity(true);
    this.setFlipX(Math.random() < 0.5);
  }

  get isDead(): boolean {
    return this.dead;
  }

  /** One-hit kill. Returns true if killed. */
  takeHit(): boolean {
    if (this.dead) return true;
    this.dead = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocity(200, 600);
    this.setVelocity(0, -120);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      angle: 90,
      duration: 350,
      onComplete: () => this.destroy(),
    });
    return true;
  }

  /** Kept for PlayScene loop — rats stay still. */
  updatePatrol(): void {
    if (this.dead || !this.active) return;
    this.setVelocityX(0);
  }
}
