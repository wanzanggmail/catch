import Phaser from 'phaser';
import { GAME } from '../game/config';

type BossPhase = 1 | 2 | 3 | 4;

export interface BossRatOptions {
  hp?: number;
  /** Faster / denser attack patterns (stage 6-5 finale) */
  hard?: boolean;
  /** Hidden until awaken() — used when items must be collected first */
  dormant?: boolean;
}

/**
 * Giant Rat boss — default HP 5, three phases.
 * Finale variant: HP 7, harder patterns, can start dormant.
 */
export class BossRat extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  private phase: BossPhase = 1;
  private dir = 1;
  private nextAction = 0;
  private aiState: 'idle' | 'strafe' | 'drop' | 'slam' | 'recover' | 'burst' = 'strafe';
  private arenaLeft: number;
  private arenaRight: number;
  private homeY: number;
  private difficulty: number;
  private hard: boolean;
  private dormant: boolean;
  projectiles: Phaser.Physics.Arcade.Group;
  private dead = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    difficulty: number,
    opts: BossRatOptions = {},
  ) {
    super(scene, x, y, 'boss');
    this.maxHp = opts.hp ?? GAME.bossHp;
    this.hp = this.maxHp;
    this.difficulty = difficulty;
    this.hard = !!opts.hard;
    this.dormant = !!opts.dormant;
    this.homeY = y;
    this.arenaLeft = GAME.tileSize * 2.5;
    this.arenaRight = GAME.tileSize * (GAME.mapWidthTiles - 2.5);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setImmovable(true);
    this.setDepth(20);
    this.setTint(this.hard ? 0x9b2226 : 0xb56576);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(56, 40);
    body.setOffset(4, 8);
    this.projectiles = scene.physics.add.group({
      allowGravity: true,
      bounceX: 0,
      bounceY: 0,
    });
    this.nextAction = scene.time.now + (this.hard ? 1200 : 2000);

    if (this.dormant) {
      this.setVisible(false);
      this.setActive(false);
      body.enable = false;
    }
  }

  get isDead(): boolean {
    return this.dead;
  }

  get isDormant(): boolean {
    return this.dormant;
  }

  get currentPhase(): BossPhase {
    return this.phase;
  }

  awaken(time: number): void {
    if (!this.dormant || this.dead) return;
    this.dormant = false;
    this.setVisible(true);
    this.setActive(true);
    this.setAlpha(0);
    this.setScale(0.4);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scale: 1,
      duration: 700,
      ease: 'Back.easeOut',
    });
    this.aiState = 'strafe';
    this.nextAction = time + 900;
    this.setTint(this.hard ? 0x9b2226 : 0xb56576);
  }

  takeDamage(amount: number): boolean {
    if (this.dead || this.dormant) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.dead) this.setTint(this.hard ? 0x9b2226 : 0xb56576);
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
    const ratio = this.hp / this.maxHp;
    if (ratio > 0.7) this.phase = 1;
    else if (ratio > 0.45) this.phase = 2;
    else if (ratio > 0.2) this.phase = 3;
    else this.phase = 4;
  }

  updateAI(time: number, playerX: number): void {
    if (this.dead || this.dormant) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const diff = 0.65 + this.difficulty * 0.12;
    const hardMul = this.hard ? 1.35 : 1;
    const phaseMul =
      this.phase === 4 ? 1.3 : this.phase === 3 ? 1.18 : this.phase === 2 ? 1.08 : 1;
    const speedMul = phaseMul * diff * hardMul;

    if (this.aiState === 'slam') {
      if (body.y > this.homeY + (this.hard ? 110 : 90)) {
        this.aiState = 'recover';
        body.setVelocity(0, this.hard ? -200 : -160);
      }
      return;
    }
    if (this.aiState === 'recover') {
      if (this.y <= this.homeY + 4) {
        this.y = this.homeY;
        body.setVelocity(0, 0);
        this.aiState = 'strafe';
        this.nextAction = time + (this.hard ? 550 : 900) / speedMul;
      }
      return;
    }
    if (this.aiState === 'burst') {
      return;
    }

    body.setVelocityX(this.dir * (this.hard ? 72 : 48) * speedMul);
    if (this.x < this.arenaLeft) this.dir = 1;
    if (this.x > this.arenaRight) this.dir = -1;

    if (Math.random() < (this.hard ? 0.02 : 0.008)) {
      this.dir = playerX < this.x ? -1 : 1;
    }

    if (time >= this.nextAction) {
      this.performAction(time, playerX, speedMul);
    }
  }

  private performAction(time: number, playerX: number, speedMul: number): void {
    if (!this.hard) {
      if (this.phase === 1) {
        this.dropProjectile(playerX);
        this.nextAction = time + 2200 / speedMul;
      } else if (this.phase === 2) {
        if (Math.random() < 0.35) {
          this.startSlam();
          this.nextAction = time + 2800 / speedMul;
        } else {
          this.dropProjectile(playerX);
          this.nextAction = time + 1800 / speedMul;
        }
      } else {
        if (Math.random() < 0.3) this.startSlam();
        else this.dropProjectile(playerX + (Math.random() - 0.5) * 60);
        this.nextAction = time + 1400 / speedMul;
      }
      return;
    }

    // Hard finale patterns
    const roll = Math.random();
    if (this.phase <= 1) {
      this.dropProjectile(playerX);
      if (roll < 0.45) this.dropProjectile(playerX + (Math.random() < 0.5 ? -50 : 50));
      this.nextAction = time + 1500 / speedMul;
    } else if (this.phase === 2) {
      if (roll < 0.4) {
        this.startSlam();
        this.nextAction = time + 2100 / speedMul;
      } else {
        this.fanProjectiles(playerX, 3);
        this.nextAction = time + 1600 / speedMul;
      }
    } else if (this.phase === 3) {
      if (roll < 0.35) {
        this.startSlam();
        this.nextAction = time + 1800 / speedMul;
      } else if (roll < 0.7) {
        this.fanProjectiles(playerX, 5);
        this.nextAction = time + 1400 / speedMul;
      } else {
        this.burstVolley(playerX);
        this.nextAction = time + 1700 / speedMul;
      }
    } else {
      // Enraged
      if (roll < 0.4) {
        this.startSlam();
        this.scene.time.delayedCall(280, () => {
          if (!this.dead && !this.dormant) this.fanProjectiles(playerX, 3);
        });
        this.nextAction = time + 1500 / speedMul;
      } else {
        this.fanProjectiles(playerX, 5);
        this.scene.time.delayedCall(220, () => {
          if (!this.dead && !this.dormant) this.dropProjectile(playerX);
        });
        this.nextAction = time + 1100 / speedMul;
      }
    }
  }

  private dropProjectile(targetX: number): void {
    const p = this.projectiles.create(this.x, this.y + 30, 'projectile') as Phaser.Physics.Arcade.Sprite;
    const aim = this.hard ? 0.55 : 0.4;
    p.setVelocity((targetX - this.x) * aim, this.hard ? 110 : 80);
    p.setTint(this.hard ? 0xe63946 : 0x6d597a);
    p.setDepth(15);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setGravityY(this.hard ? 480 : 400);
    this.scene.time.delayedCall(4000, () => {
      if (p.active) p.destroy();
    });
  }

  private fanProjectiles(targetX: number, count: number): void {
    const mid = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const offset = (i - mid) * 42;
      this.dropProjectile(targetX + offset);
    }
  }

  private burstVolley(targetX: number): void {
    this.aiState = 'burst';
    this.setVelocity(0, 0);
    let n = 0;
    const fire = () => {
      if (this.dead || this.dormant) return;
      this.dropProjectile(targetX + (Math.random() - 0.5) * 80);
      n++;
      if (n < 4) {
        this.scene.time.delayedCall(140, fire);
      } else {
        this.aiState = 'strafe';
      }
    };
    fire();
  }

  private startSlam(): void {
    this.aiState = 'slam';
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, this.hard ? 300 : 240);
  }
}
