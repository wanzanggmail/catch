import Phaser from 'phaser';
import { GAME } from '../game/config';

type BossPhase = 1 | 2 | 3;

/**
 * Giant Rat boss — HP 5, three phases per design doc.
 */
export class BossRat extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  private phase: BossPhase = 1;
  private dir = 1;
  private nextAction = 0;
  private aiState: 'idle' | 'strafe' | 'drop' | 'slam' | 'recover' = 'strafe';
  private arenaLeft: number;
  private arenaRight: number;
  private homeY: number;
  private difficulty: number;
  projectiles: Phaser.Physics.Arcade.Group;
  private dead = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    difficulty: number,
  ) {
    super(scene, x, y, 'boss');
    this.hp = GAME.bossHp;
    this.difficulty = difficulty;
    this.homeY = y;
    this.arenaLeft = GAME.tileSize * 2.5;
    this.arenaRight = GAME.tileSize * (GAME.mapWidthTiles - 2.5);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setImmovable(true);
    this.setDepth(20);
    this.setTint(0xb56576);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(56, 40);
    body.setOffset(4, 8);
    this.projectiles = scene.physics.add.group({
      allowGravity: true,
      bounceX: 0,
      bounceY: 0,
    });
    this.nextAction = scene.time.now + 800;
  }

  get isDead(): boolean {
    return this.dead;
  }

  get currentPhase(): BossPhase {
    return this.phase;
  }

  takeDamage(amount: number): boolean {
    if (this.dead) return true;
    this.hp = Math.max(0, this.hp - amount);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.dead) this.setTint(0xb56576);
    });
    this.updatePhase();
    if (this.hp <= 0) {
      this.dead = true;
      this.setVelocity(0, 0);
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scale: 1.4,
        duration: 600,
      });
      return true;
    }
    return false;
  }

  private updatePhase(): void {
    if (this.hp >= 4) this.phase = 1;
    else if (this.hp >= 2) this.phase = 2;
    else this.phase = 3;
  }

  updateAI(time: number, playerX: number): void {
    if (this.dead) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speedMul = (this.phase === 3 ? 1.45 : this.phase === 2 ? 1.2 : 1) * this.difficulty;

    if (this.aiState === 'slam') {
      // handled by tween-ish velocity
      if (body.y > this.homeY + 90) {
        this.aiState = 'recover';
        body.setVelocity(0, -220);
      }
      return;
    }
    if (this.aiState === 'recover') {
      if (this.y <= this.homeY + 4) {
        this.y = this.homeY;
        body.setVelocity(0, 0);
        this.aiState = 'strafe';
        this.nextAction = time + 600 / speedMul;
      }
      return;
    }

    // Strafe
    body.setVelocityX(this.dir * 90 * speedMul);
    if (this.x < this.arenaLeft) this.dir = 1;
    if (this.x > this.arenaRight) this.dir = -1;

    // Face player occasionally
    if (Math.random() < 0.01) this.dir = playerX < this.x ? -1 : 1;

    if (time >= this.nextAction) {
      this.performAction(time, playerX, speedMul);
    }
  }

  private performAction(time: number, playerX: number, speedMul: number): void {
    if (this.phase === 1) {
      this.dropProjectile(playerX);
      this.nextAction = time + 1100 / speedMul;
    } else if (this.phase === 2) {
      if (Math.random() < 0.55) {
        this.startSlam();
        this.nextAction = time + 1800 / speedMul;
      } else {
        this.dropProjectile(playerX);
        this.nextAction = time + 900 / speedMul;
      }
    } else {
      if (Math.random() < 0.45) this.startSlam();
      else this.dropProjectile(playerX + (Math.random() - 0.5) * 80);
      this.nextAction = time + 650 / speedMul;
    }
  }

  private dropProjectile(targetX: number): void {
    const p = this.projectiles.create(this.x, this.y + 30, 'projectile') as Phaser.Physics.Arcade.Sprite;
    p.setVelocity((targetX - this.x) * 0.4, 80);
    p.setTint(0x6d597a);
    p.setDepth(15);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setGravityY(400);
    this.scene.time.delayedCall(4000, () => {
      if (p.active) p.destroy();
    });
  }

  private startSlam(): void {
    this.aiState = 'slam';
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 420);
  }
}
