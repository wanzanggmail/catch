import Phaser from 'phaser';
import { GAME, PHYSICS, EVOLUTION, evolutionForPlayingStage, BUFF_TYPES, type BuffType } from '../game/config';
import { getMapDef } from '../maps/index';
import { TerrainBuilder, updateCloudBlock } from '../entities/Terrain';
import { Player } from '../entities/Player';
import { BossRat } from '../entities/BossRat';
import { SmallRat } from '../entities/SmallRat';
import { VerticalCamera } from '../systems/CameraSystem';
import { BuffSystem } from '../systems/BuffSystem';
import { InputAdapter } from '../systems/InputAdapter';
import { TouchControls } from '../ui/TouchControls';
import { saveManager } from '../systems/SaveManager';
import { sideJumpSettings, type SideBlocks } from '../systems/JumpSettings';

export interface PlayData {
  stage: number;
  map: number;
}

export class PlayScene extends Phaser.Scene {
  private stage = 1;
  private map = 1;
  private player!: Player;
  private boss!: BossRat;
  private rats: SmallRat[] = [];
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
  private holeHint?: Phaser.GameObjects.Text;
  private enteredHole = false;

  constructor() {
    super('Play');
  }

  init(data: PlayData): void {
    this.stage = data.stage ?? 1;
    this.map = data.map ?? 1;
    this.ended = false;
    this.enteredHole = false;
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
    this.physics.world.gravity.y = PHYSICS.gravity;

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

    // Small 1-hit rats
    this.rats = [];
    const ts = GAME.tileSize;
    for (const spawn of def.ratSpawns ?? []) {
      const wx = spawn.x * ts + ts / 2;
      const wy = spawn.y * ts + ts / 2;
      const left = spawn.left * ts + 8;
      const right = (spawn.right + 1) * ts - 8;
      const rat = new SmallRat(this, wx, wy, left, right, 0.9 + this.difficulty * 0.15);
      this.rats.push(rat);
      this.physics.add.collider(rat, this.terrain.solids);
      this.physics.add.collider(rat, this.terrain.questions);
      this.physics.add.collider(rat, this.terrain.lines);
      this.physics.add.overlap(this.player, rat, () => {
        if (this.ended || rat.isDead) return;
        if (this.player.takeHit()) this.lose('작은 쥐에게 물렸습니다');
      });
    }

    // Collisions
    this.physics.add.collider(this.player, this.terrain.solids);
    this.physics.add.collider(this.player, this.terrain.questions, undefined, (p, q) => {
      this.handleQuestionHit(p as Player, q as Phaser.Physics.Arcade.Sprite);
      return true;
    });
    // Extra forgiving trigger volume under/? around the block
    this.physics.add.overlap(this.player, this.terrain.questions, (p, q) => {
      this.handleQuestionHit(p as Player, q as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.collider(this.player, this.terrain.lines);
    this.physics.add.collider(this.player, this.terrain.clouds);

    this.physics.add.overlap(this.player, this.terrain.checkpoints, (_p, c) => {
      const cp = c as Phaser.Physics.Arcade.Sprite;
      if (!cp.getData('activated')) {
        cp.setData('activated', true);
        cp.setTint(0xffd166);
        this.checkpoint = { x: cp.x, y: cp.y - 20 };
        this.player.gainLife();
        this.flashMsg(`체크포인트! 목숨 +1 (HP ${this.player.hp})`);
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

    // Save + Exit buttons (top-right)
    const saveBtn = this.add
      .rectangle(GAME.width - 148, 52, 88, 32, 0x1b263b, 0.85)
      .setStrokeStyle(2, 0x2a9d8f)
      .setScrollFactor(0)
      .setDepth(910)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME.width - 148, 52, '저장', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fefae0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(911);
    saveBtn.on('pointerover', () => saveBtn.setFillStyle(0x0d3b36, 0.9));
    saveBtn.on('pointerout', () => saveBtn.setFillStyle(0x1b263b, 0.85));
    saveBtn.on('pointerdown', () => {
      saveManager.persist();
      this.flashMsg('저장되었습니다');
    });

    const exitBtn = this.add
      .rectangle(GAME.width - 52, 52, 88, 32, 0x1b263b, 0.85)
      .setStrokeStyle(2, 0xe63946)
      .setScrollFactor(0)
      .setDepth(910)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME.width - 52, 52, '나가기', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#fefae0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(911);
    exitBtn.on('pointerover', () => exitBtn.setFillStyle(0x3d0000, 0.9));
    exitBtn.on('pointerout', () => exitBtn.setFillStyle(0x1b263b, 0.85));
    exitBtn.on('pointerdown', () => {
      saveManager.persist();
      this.ended = true;
      this.scene.start('StageSelect', { stage: this.stage });
    });

    // Left/right jump travel: 1 / 3 / 5 tiles (height stays fixed)
    this.add
      .text(GAME.width - 12, 78, '좌우', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#778da9',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(900);

    const sideOpts: SideBlocks[] = [1, 3, 5];
    const sideButtons: { blocks: SideBlocks; bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
    const refreshSideUi = () => {
      for (const b of sideButtons) {
        const on = sideJumpSettings.blocks === b.blocks;
        b.bg.setFillStyle(on ? 0x2a9d8f : 0x1b263b, on ? 0.95 : 0.85);
        b.bg.setStrokeStyle(2, on ? 0x95d5b2 : 0x415a77);
        b.label.setColor(on ? '#fefae0' : '#adb5bd');
      }
    };
    sideOpts.forEach((blocks, i) => {
      const x = GAME.width - 148 + i * 48;
      const y = 108;
      const bg = this.add
        .rectangle(x, y, 44, 28, 0x1b263b, 0.85)
        .setStrokeStyle(2, 0x415a77)
        .setScrollFactor(0)
        .setDepth(910)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, y, `${blocks}칸`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#adb5bd',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(911);
      bg.on('pointerdown', () => {
        sideJumpSettings.setBlocks(blocks);
        refreshSideUi();
        this.flashMsg(`좌우 ${blocks}칸`);
      });
      sideButtons.push({ blocks, bg, label });
    });
    refreshSideUi();

    if (this.terrain.holeMouth) {
      const hx = this.terrain.holeMouth.x;
      const hy = this.terrain.holeMouth.y;
      this.holeHint = this.add
        .text(hx, hy + 28, '↑ 구멍으로 들어가기', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: '#ffe8a3',
          stroke: '#000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(40)
        .setAlpha(0.9);
      this.tweens.add({
        targets: this.holeHint,
        alpha: 0.35,
        y: hy + 34,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
      this.terrain.holes.getChildren().forEach((obj) => {
        this.tweens.add({
          targets: obj,
          alpha: 0.7,
          duration: 700,
          yoyo: true,
          repeat: -1,
        });
      });
    }

    this.flashMsg(`${EVOLUTION[evo].label} — 꼭대기 구멍으로 들어가 거대 쥐를 처치하라!`);
  }

  private handleQuestionHit(
    player: Player,
    block: Phaser.Physics.Arcade.Sprite,
  ): void {
    if (block.getData('used')) return;
    const body = player.body as Phaser.Physics.Arcade.Body;
    // Standing on top of the block → ignore
    if (body.blocked.down && player.y < block.y - 4) return;
    // Generous hit: any contact while player is at/below the block center
    if (player.y < block.y - 12 && body.velocity.y >= 0 && !body.touching.up && !body.blocked.up) {
      return;
    }
    const granted = this.terrain.hitQuestion(block, this.buffs, this.time.now);
    if (granted) {
      this.applyItem(granted);
      this.spawnBuffFx(block.x, block.y - 24, granted);
      this.flashMsg(buffLabel(granted));
      if (Math.random() < 0.55) {
        saveManager.addInventoryBuff(pickBagItem(granted));
      }
      if (body.velocity.y < 0) body.setVelocityY(Math.min(body.velocity.y, -140));
    }
  }

  private applyItem(type: BuffType): void {
    if (type === 'heal') {
      this.player.heal(1);
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

    // Slippery only when standing on a line block
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onLine =
      (body.blocked.down || body.touching.down) &&
      this.physics.overlap(this.player, this.terrain.lines);
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
        this.applyItem(b);
        this.flashMsg(`아이템 사용: ${buffLabel(b)}`);
      }
    }

    // Near hole mouth: show hint; entering shaft announces once
    if (this.terrain.holeMouth && this.holeHint) {
      const hx = this.terrain.holeMouth.x;
      const hy = this.terrain.holeMouth.y;
      const near =
        Math.abs(this.player.x - hx) < GAME.tileSize * 2.2 &&
        this.player.y > hy &&
        this.player.y < hy + GAME.tileSize * 5;
      this.holeHint.setVisible(near && !this.enteredHole);
      if (
        !this.enteredHole &&
        Math.abs(this.player.x - hx) < GAME.tileSize * 1.6 &&
        this.player.y < hy + GAME.tileSize * 0.5 &&
        this.player.y > hy - GAME.tileSize * 4
      ) {
        this.enteredHole = true;
        this.holeHint.setVisible(false);
        this.flashMsg('구멍 진입! 거대 쥐의 동굴');
      }
    }

    this.vcam.update(this.player.y, delta / 1000);
    this.boss.updateAI(this.time.now, this.player.x);
    for (const rat of this.rats) {
      if (!rat.isDead && rat.active) rat.updatePatrol();
    }

    // Soft floor clamp — no fall death; camera follows down instead
    const mapBottom = this.terrain.pixelHeight - 8;
    if (this.player.y > mapBottom) {
      this.player.y = mapBottom;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      if (body.velocity.y > 0) body.setVelocityY(0);
    }

    // HUD
    const evo = EVOLUTION[this.player.evolution];
    this.hud.setText(
      `HP ${this.player.hp}/${this.player.maxHp}  ·  보스 ${this.boss.isDead ? 0 : this.boss.hp}/${GAME.bossHp}  ·  ${evo.label}`,
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

    // One-hit rats
    for (const rat of this.rats) {
      if (rat.isDead || !rat.active) continue;
      if (Math.abs(rat.x - sx) < 42 && Math.abs(rat.y - sy) < 36) {
        const rx = rat.x;
        const ry = rat.y;
        rat.takeHit();
        this.flashMsg('쥐 처치!');
        // Random item drop from rats
        if (Math.random() < 0.65) {
          const drop = this.buffs.grantRandom(this.time.now);
          this.applyItem(drop);
          this.spawnBuffFx(rx, ry - 16, drop);
          this.flashMsg(buffLabel(drop));
        }
      }
    }

    // Also melee nearby projectiles destroy
    this.boss.projectiles.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (Phaser.Math.Distance.Between(sx, sy, p.x, p.y) < 40) p.destroy();
    });
  }

  // Fall death removed — camera follows downward instead.
  // Keep helper only if needed for future hazards.
  private softRespawnAtCheckpoint(): void {
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
    case 'heal':
      return '체력 회복!';
    case 'feather':
      return '깃털 — 활강!';
    case 'haste':
      return '신속 — 이속·공속 업!';
  }
}

function pickBagItem(exclude?: BuffType): BuffType {
  const pool = BUFF_TYPES.filter((t) => t !== exclude);
  return pool[Math.floor(Math.random() * pool.length)]!;
}
