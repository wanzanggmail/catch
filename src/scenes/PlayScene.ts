import Phaser from 'phaser';
import { GAME, EVOLUTION, evolutionForPlayingStage, type BuffType } from '../game/config';
import { getMapDef } from '../maps/index';
import { TerrainBuilder, updateCloudBlock } from '../entities/Terrain';
import { Player } from '../entities/Player';
import { BossRat } from '../entities/BossRat';
import { VerticalCamera } from '../systems/CameraSystem';
import { BuffSystem } from '../systems/BuffSystem';
import { InputAdapter } from '../systems/InputAdapter';
import { TouchControls } from '../ui/TouchControls';
import { saveManager } from '../systems/SaveManager';

export interface PlayData {
  stage: number;
  map: number;
}

export class PlayScene extends Phaser.Scene {
  private stage = 1;
  private map = 1;
  private player!: Player;
  private boss!: BossRat;
  private terrain!: TerrainBuilder;
  private vcam!: VerticalCamera;
  private buffs = new BuffSystem();
  private inputAdapter = new InputAdapter();
  private touch!: TouchControls;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyZ!: Phaser.Input.Keyboard.Key;
  private keyJ!: Phaser.Input.Keyboard.Key;
  private keyX!: Phaser.Input.Keyboard.Key;
  private keyK!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private spawn!: { x: number; y: number };
  private checkpoint!: { x: number; y: number };
  private hud!: Phaser.GameObjects.Text;
  private buffHud!: Phaser.GameObjects.Text;
  private ended = false;
  private slash?: Phaser.GameObjects.Sprite;
  private difficulty = 1;

  constructor() {
    super('Play');
  }

  init(data: PlayData): void {
    this.stage = data.stage ?? 1;
    this.map = data.map ?? 1;
    this.ended = false;
    this.buffs.clear();
  }

  create(): void {
    const def = getMapDef(this.stage, this.map);
    this.difficulty = saveManager.difficultyFactor();
    this.terrain = new TerrainBuilder(this, def);
    const markers = this.terrain.build();
    this.spawn = markers.spawn;
    this.checkpoint = { ...markers.spawn };

    // Background
    const bg = this.add.tileSprite(
      def.width * GAME.tileSize / 2,
      def.height * GAME.tileSize / 2,
      def.width * GAME.tileSize,
      def.height * GAME.tileSize,
      'bg_tile',
    );
    bg.setDepth(-10);

    this.physics.world.setBounds(0, 0, this.terrain.pixelWidth, this.terrain.pixelHeight);
    this.physics.world.gravity.y = 990;

    const evo = evolutionForPlayingStage(this.stage);
    this.player = new Player(
      this,
      this.spawn.x,
      this.spawn.y,
      evo,
      this.buffs,
      GAME.playerHp,
    );

    this.boss = new BossRat(this, markers.boss.x, markers.boss.y, this.difficulty);

    // Collisions
    this.physics.add.collider(this.player, this.terrain.solids);
    this.physics.add.collider(this.player, this.terrain.questions, undefined, (p, q) => {
      this.handleQuestionHit(p as Player, q as Phaser.Physics.Arcade.Sprite);
      return true;
    });
    this.physics.add.collider(this.player, this.terrain.lines);
    this.physics.add.collider(this.player, this.terrain.clouds);

    this.physics.add.overlap(this.player, this.terrain.checkpoints, (_p, c) => {
      const cp = c as Phaser.Physics.Arcade.Sprite;
      if (!cp.getData('activated')) {
        cp.setData('activated', true);
        cp.setTint(0xffd166);
        this.checkpoint = { x: cp.x, y: cp.y - 20 };
        this.flashMsg('체크포인트!');
      }
    });

    this.physics.add.overlap(this.player, this.boss, () => {
      if (this.ended || this.boss.isDead) return;
      if (this.player.takeHit()) this.lose('거대 쥐에게 당했습니다');
    });

    this.physics.add.overlap(this.player, this.boss.projectiles, (_p, proj) => {
      if (this.ended) return;
      (proj as Phaser.Physics.Arcade.Sprite).destroy();
      if (this.player.takeHit()) this.lose('투사체에 맞았습니다');
    });

    this.physics.add.collider(this.boss.projectiles, this.terrain.solids, (proj) => {
      (proj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    this.vcam = new VerticalCamera(
      this.cameras.main,
      this.terrain.pixelHeight,
      this.terrain.pixelWidth,
    );
    this.vcam.snapToPlayer(this.player.y);

    // Input
    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.keyA = kb.addKey('A');
      this.keyD = kb.addKey('D');
      this.keyZ = kb.addKey('Z');
      this.keyJ = kb.addKey('J');
      this.keyX = kb.addKey('X');
      this.keyK = kb.addKey('K');
      this.keySpace = kb.addKey('SPACE');
    } else {
      this.cursors = {
        left: { isDown: false },
        right: { isDown: false },
        up: { isDown: false },
        down: { isDown: false },
      } as Phaser.Types.Input.Keyboard.CursorKeys;
      const noop = { isDown: false } as Phaser.Input.Keyboard.Key;
      this.keyA = noop;
      this.keyD = noop;
      this.keyZ = noop;
      this.keyJ = noop;
      this.keyX = noop;
      this.keyK = noop;
      this.keySpace = noop;
    }
    this.touch = new TouchControls(this, this.inputAdapter);

    this.hud = this.add
      .text(12, 12, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fefae0',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(900);

    this.buffHud = this.add
      .text(12, 56, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#95d5b2',
        backgroundColor: '#00000066',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(900);

    this.add
      .text(GAME.width - 12, 12, `S${this.stage}-M${this.map}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#778da9',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(900);

    this.flashMsg(`${EVOLUTION[evo].label} — 꼭대기의 거대 쥐를 처치하라!`);
  }

  private handleQuestionHit(
    player: Player,
    block: Phaser.Physics.Arcade.Sprite,
  ): void {
    const body = player.body as Phaser.Physics.Arcade.Body;
    // Head bump from below
    if (body.velocity.y < 0 || body.touching.up || body.blocked.up) {
      const granted = this.terrain.hitQuestion(block, this.buffs, this.time.now);
      if (granted) {
        this.spawnBuffFx(block.x, block.y - 24, granted);
        this.flashMsg(buffLabel(granted));
        // Also stash one inventory buff chance
        if (Math.random() < 0.35) saveManager.addInventoryBuff(granted);
      }
    }
  }

  private spawnBuffFx(x: number, y: number, type: BuffType): void {
    const orb = this.add.image(x, y, `buff_${type}`).setDepth(30);
    this.tweens.add({
      targets: orb,
      y: y - 40,
      alpha: 0,
      duration: 700,
      onComplete: () => orb.destroy(),
    });
  }

  private flashMsg(msg: string): void {
    const t = this.add
      .text(GAME.width / 2, 100, msg, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffd166',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(950);
    this.tweens.add({
      targets: t,
      alpha: 0,
      y: 70,
      duration: 1400,
      onComplete: () => t.destroy(),
    });
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;

    this.buffs.tick(this.time.now);

    // Merge input
    this.inputAdapter.resetTransient(this.touch.flags);
    this.inputAdapter.applyKeyboard({
      left: this.cursors.left.isDown || this.keyA.isDown,
      right: this.cursors.right.isDown || this.keyD.isDown,
      jump: !!this.cursors.up?.isDown || this.keySpace.isDown,
      attack: this.keyZ.isDown || this.keyJ.isDown || this.touch.flags.attack,
      useItem: this.keyX.isDown || this.keyK.isDown || this.touch.flags.useItem,
    });
    // touch jump already in resetTransient
    this.inputAdapter.finalize();
    const input = this.inputAdapter.snapshot();

    // Slippery check
    const onLine = this.physics.overlap(this.player, this.terrain.lines);
    this.player.setSlippery(onLine);

    this.player.updateControl(input, delta);

    // Clouds
    this.terrain.clouds.getChildren().forEach((obj) => {
      const cloud = obj as Phaser.Physics.Arcade.Sprite;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const playerOn =
        body.blocked.down &&
        Math.abs(this.player.x - cloud.x) < GAME.tileSize * 0.7 &&
        this.player.y < cloud.y &&
        cloud.y - this.player.y < GAME.tileSize * 1.2 &&
        cloud.getData('state') !== 'collapsed';
      updateCloudBlock(this, cloud, playerOn, this.time.now);
    });

    // Attack
    if (input.attackPressed && this.player.canAttack()) {
      this.doAttack();
    }

    // Use inventory buff
    if (input.useItemPressed) {
      const b = saveManager.consumeInventoryBuff();
      if (b) {
        this.buffs.grant(b, this.time.now);
        this.flashMsg(`아이템 사용: ${buffLabel(b)}`);
      }
    }

    this.vcam.update(this.player.y, delta / 1000);
    this.boss.updateAI(this.time.now, this.player.x);

    // Fall death
    if (this.player.y > this.vcam.deadlyBottomY) {
      this.respawnOrLose();
    }

    // HUD
    const evo = EVOLUTION[this.player.evolution];
    this.hud.setText(
      `HP ${this.player.hp}/${GAME.playerHp}  ·  보스 ${this.boss.isDead ? 0 : this.boss.hp}/${GAME.bossHp}  ·  ${evo.label}`,
    );
    const buffs = this.buffs.list();
    const inv = saveManager.getActive().inventoryBuffs;
    this.buffHud.setText(
      `버프: ${buffs.length ? buffs.map((b) => b.type).join(', ') : '없음'}  |  가방: ${inv.join(', ') || '없음'}`,
    );
  }

  private doAttack(): void {
    this.player.markAttacked();
    const facing = this.player.getFacing();
    const sx = this.player.x + facing * 28;
    const sy = this.player.y;
    this.slash?.destroy();
    this.slash = this.add.sprite(sx, sy, 'slash').setDepth(25).setFlipX(facing < 0);
    this.tweens.add({
      targets: this.slash,
      alpha: 0,
      x: sx + facing * 16,
      duration: 180,
      onComplete: () => this.slash?.destroy(),
    });

    // Hit boss if in range
    if (
      !this.boss.isDead &&
      Math.abs(this.boss.x - sx) < 50 &&
      Math.abs(this.boss.y - sy) < 50
    ) {
      const dead = this.boss.takeDamage(this.player.attackDamage());
      this.flashMsg(dead ? '보스 처치!' : `히트! 남은 HP ${this.boss.hp}`);
      if (dead) this.win();
    }

    // Also melee nearby projectiles destroy
    this.boss.projectiles.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (Phaser.Math.Distance.Between(sx, sy, p.x, p.y) < 40) p.destroy();
    });
  }

  private respawnOrLose(): void {
    if (this.ended) return;
    if (this.player.takeHit()) {
      this.lose('낙사');
      return;
    }
    this.player.setPosition(this.checkpoint.x, this.checkpoint.y);
    this.player.setVelocity(0, 0);
    this.vcam.snapToPlayer(this.player.y);
    this.flashMsg('체크포인트에서 재시작');
  }

  private win(): void {
    if (this.ended) return;
    this.ended = true;
    saveManager.markCleared(this.stage, this.map);
    this.time.delayedCall(900, () => {
      this.scene.start('Result', {
        victory: true,
        stage: this.stage,
        map: this.map,
      });
    });
  }

  private lose(reason: string): void {
    if (this.ended) return;
    this.ended = true;
    this.flashMsg(reason);
    this.time.delayedCall(900, () => {
      this.scene.start('Result', {
        victory: false,
        stage: this.stage,
        map: this.map,
        reason,
      });
    });
  }
}

function buffLabel(t: BuffType): string {
  switch (t) {
    case 'speed':
      return '속도 버프!';
    case 'jump':
      return '점프력 버프!';
    case 'shield':
      return '실드!';
    case 'power':
      return '공격력 강화!';
  }
}
