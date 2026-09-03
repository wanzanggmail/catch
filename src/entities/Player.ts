import Phaser from 'phaser';
import { EVOLUTION, PHYSICS, type EvolutionStage } from '../game/config';
import type { BuffSystem } from '../systems/BuffSystem';
import type { InputState } from '../systems/InputAdapter';

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  evolution: EvolutionStage;
  private buffs: BuffSystem;
  private coyote = 0;
  private jumpBuffer = 0;
  private jumping = false;
  private doubleJumpAvailable = false;
  private wallJumpLock = 0;
  private facing = 1;
  private attackCooldown = 0;
  private invuln = 0;
  private onSlippery = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    evolution: EvolutionStage,
    buffs: BuffSystem,
    hp: number,
  ) {
    super(scene, x, y, 'player');
    this.evolution = evolution;
    this.buffs = buffs;
    this.hp = hp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(false);
    this.setMaxVelocity(500, PHYSICS.maxFallSpeed);
    this.setDragX(0);
    this.setDepth(10);
    this.refreshTint();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 28);
    body.setOffset(5, 4);
  }

  refreshTint(): void {
    this.setTint(EVOLUTION[this.evolution].color);
  }

  setEvolution(stage: EvolutionStage): void {
    this.evolution = stage;
    this.refreshTint();
  }

  setSlippery(v: boolean): void {
    this.onSlippery = v;
  }

  isInvulnerable(): boolean {
    return this.invuln > 0;
  }

  takeHit(): boolean {
    if (this.invuln > 0) return false;
    if (this.buffs.tryAbsorbHit()) {
      this.invuln = 800;
      this.setAlpha(0.5);
      return false;
    }
    this.hp -= 1;
    this.invuln = 1200;
    this.setAlpha(0.5);
    this.setVelocityY(-280);
    this.setVelocityX(-this.facing * 180);
    return this.hp <= 0;
  }

  getFacing(): number {
    return this.facing;
  }

  canAttack(): boolean {
    return this.attackCooldown <= 0;
  }

  markAttacked(): void {
    this.attackCooldown = 280;
  }

  attackDamage(): number {
    return this.buffs.powerMul() >= 2 ? 2 : 1;
  }

  updateControl(input: InputState, delta: number): void {
    const evo = EVOLUTION[this.evolution];
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onFloor = body.blocked.down || body.touching.down;
    const onWall = body.blocked.left || body.blocked.right || body.touching.left || body.touching.right;

    if (this.invuln > 0) {
      this.invuln -= delta;
      if (this.invuln <= 0) this.setAlpha(1);
    }
    if (this.attackCooldown > 0) this.attackCooldown -= delta;
    if (this.wallJumpLock > 0) this.wallJumpLock -= delta;

    if (onFloor) {
      this.coyote = PHYSICS.coyoteTimeMs;
      this.doubleJumpAvailable = evo.doubleJump;
      this.jumping = false;
    } else {
      this.coyote -= delta;
    }

    if (input.jumpPressed) this.jumpBuffer = PHYSICS.jumpBufferMs;
    else this.jumpBuffer -= delta;

    const speed =
      PHYSICS.moveSpeed * evo.speedMul * this.buffs.speedMul();
    const air = onFloor ? 1 : PHYSICS.airControlFactor;

    if (this.wallJumpLock <= 0) {
      if (input.left) {
        this.facing = -1;
        const target = -speed;
        if (this.onSlippery && onFloor) {
          body.velocity.x = Phaser.Math.Linear(body.velocity.x, target, 0.04);
        } else {
          body.velocity.x = Phaser.Math.Linear(body.velocity.x, target, air);
        }
      } else if (input.right) {
        this.facing = 1;
        const target = speed;
        if (this.onSlippery && onFloor) {
          body.velocity.x = Phaser.Math.Linear(body.velocity.x, target, 0.04);
        } else {
          body.velocity.x = Phaser.Math.Linear(body.velocity.x, target, air);
        }
      } else if (onFloor) {
        if (this.onSlippery) {
          body.velocity.x *= 0.995;
        } else {
          body.velocity.x *= PHYSICS.friction;
          if (Math.abs(body.velocity.x) < 8) body.velocity.x = 0;
        }
      }
    }

    // Variable jump
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      const jump = PHYSICS.jumpForce * evo.jumpMul * this.buffs.jumpMul();
      body.setVelocityY(-jump);
      this.jumping = true;
      this.jumpBuffer = 0;
      this.coyote = 0;
    } else if (
      input.jumpPressed &&
      !onFloor &&
      this.doubleJumpAvailable &&
      evo.doubleJump
    ) {
      const jump = PHYSICS.jumpForce * 0.85 * evo.jumpMul * this.buffs.jumpMul();
      body.setVelocityY(-jump);
      this.doubleJumpAvailable = false;
      this.jumping = true;
    } else if (
      input.jumpPressed &&
      evo.wallJump &&
      onWall &&
      !onFloor
    ) {
      const jump = PHYSICS.jumpForce * 0.9 * evo.jumpMul;
      const dir = body.blocked.left || body.touching.left ? 1 : -1;
      body.setVelocityY(-jump);
      body.setVelocityX(dir * speed * 0.95);
      this.facing = dir;
      this.wallJumpLock = 120;
      this.jumping = true;
    }

    if (this.jumping && input.jumpJustReleased && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * PHYSICS.variableJumpCut);
      this.jumping = false;
    }

    // Glide
    if (evo.glide && input.jump && !onFloor && body.velocity.y > 60) {
      body.setVelocityY(Math.min(body.velocity.y, 120));
      this.setAlpha(Math.max(this.alpha, 0.85));
    }

    if (body.velocity.y > PHYSICS.maxFallSpeed) {
      body.setVelocityY(PHYSICS.maxFallSpeed);
    }

    this.setFlipX(this.facing < 0);
  }
}
