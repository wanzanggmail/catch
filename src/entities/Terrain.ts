import Phaser from 'phaser';
import { GAME, type BuffType } from '../game/config';
import type { BuffSystem } from '../systems/BuffSystem';
import type { MapDef, TileKind } from '../maps/generateMap';
import { findMarker } from '../maps/generateMap';

export type BlockType = 'brick' | 'line' | 'question' | 'cloud' | 'checkpoint';

export class TerrainBuilder {
  scene: Phaser.Scene;
  solids: Phaser.Physics.Arcade.StaticGroup;
  lines: Phaser.Physics.Arcade.StaticGroup;
  questions: Phaser.Physics.Arcade.StaticGroup;
  clouds: Phaser.Physics.Arcade.StaticGroup;
  checkpoints: Phaser.Physics.Arcade.StaticGroup;
  def: MapDef;
  pixelWidth: number;
  pixelHeight: number;

  constructor(scene: Phaser.Scene, def: MapDef) {
    this.scene = scene;
    this.def = def;
    this.pixelWidth = def.width * GAME.tileSize;
    this.pixelHeight = def.height * GAME.tileSize;
    this.solids = scene.physics.add.staticGroup();
    this.lines = scene.physics.add.staticGroup();
    this.questions = scene.physics.add.staticGroup();
    this.clouds = scene.physics.add.staticGroup();
    this.checkpoints = scene.physics.add.staticGroup();
  }

  build(): { spawn: { x: number; y: number }; boss: { x: number; y: number } } {
    const ts = GAME.tileSize;
    for (let y = 0; y < this.def.height; y++) {
      for (let x = 0; x < this.def.width; x++) {
        const kind = this.def.tiles[y]![x] as TileKind;
        const wx = x * ts + ts / 2;
        const wy = y * ts + ts / 2;
        switch (kind) {
          case 'brick':
            this.addSolid(wx, wy, 'brick');
            break;
          case 'line':
            this.addLine(wx, wy);
            break;
          case 'question':
            this.addQuestion(wx, wy, x, y);
            break;
          case 'cloud':
            this.addCloud(wx, wy);
            break;
          case 'checkpoint':
            this.addCheckpoint(wx, wy);
            break;
          default:
            break;
        }
      }
    }

    const spawnM = findMarker(this.def, 'spawn') ?? {
      x: Math.floor(this.def.width / 2),
      y: this.def.height - 4,
    };
    const bossM = findMarker(this.def, 'boss') ?? {
      x: Math.floor(this.def.width / 2),
      y: 4,
    };

    return {
      spawn: {
        x: spawnM.x * ts + ts / 2,
        y: spawnM.y * ts + ts / 2,
      },
      boss: {
        x: bossM.x * ts + ts / 2,
        y: bossM.y * ts + ts / 2,
      },
    };
  }

  private addSolid(x: number, y: number, tex: string): Phaser.Physics.Arcade.Sprite {
    const s = this.solids.create(x, y, tex) as Phaser.Physics.Arcade.Sprite;
    s.refreshBody();
    s.setData('block', 'brick');
    return s;
  }

  private addLine(x: number, y: number): void {
    const s = this.lines.create(x, y, 'line') as Phaser.Physics.Arcade.Sprite;
    s.refreshBody();
    s.setData('block', 'line');
  }

  private addQuestion(x: number, y: number, tx: number, ty: number): void {
    const s = this.questions.create(x, y, 'question') as Phaser.Physics.Arcade.Sprite;
    s.refreshBody();
    s.setData('block', 'question');
    s.setData('used', false);
    s.setData('tx', tx);
    s.setData('ty', ty);
    const buff = this.def.questionBuffs[`${tx},${ty}`] as BuffType | undefined;
    s.setData('buff', buff ?? 'speed');
  }

  private addCloud(x: number, y: number): void {
    const s = this.clouds.create(x, y, 'cloud') as Phaser.Physics.Arcade.Sprite;
    s.refreshBody();
    s.setData('block', 'cloud');
    s.setData('state', 'idle');
  }

  private addCheckpoint(x: number, y: number): void {
    const s = this.checkpoints.create(x, y, 'checkpoint') as Phaser.Physics.Arcade.Sprite;
    s.refreshBody();
    s.setData('block', 'checkpoint');
    s.setData('activated', false);
    // soft sensor
    const body = s.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(20, 28);
  }

  hitQuestion(
    block: Phaser.Physics.Arcade.Sprite,
    buffs: BuffSystem,
    now: number,
  ): BuffType | null {
    if (block.getData('used')) return null;
    block.setData('used', true);
    block.setTexture('question_empty');
    block.refreshBody();
    const type = block.getData('buff') as BuffType;
    buffs.grant(type, now);
    return type;
  }
}

/** Cloud block state machine helper */
export function updateCloudBlock(
  scene: Phaser.Scene,
  cloud: Phaser.Physics.Arcade.Sprite,
  playerOn: boolean,
  time: number,
): void {
  const state = cloud.getData('state') as string;
  if (state === 'idle' && playerOn) {
    cloud.setData('state', 'triggered');
    cloud.setData('triggerAt', time);
    scene.tweens.add({
      targets: cloud,
      alpha: 0.35,
      duration: 150,
      yoyo: true,
      repeat: Math.floor(GAME.cloudTriggerMs / 300),
    });
  } else if (state === 'triggered') {
    const triggerAt = cloud.getData('triggerAt') as number;
    if (time - triggerAt >= GAME.cloudTriggerMs) {
      cloud.setData('state', 'collapsed');
      cloud.setData('collapseAt', time);
      cloud.setAlpha(0);
      const body = cloud.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = false;
    }
  } else if (state === 'collapsed') {
    const collapseAt = cloud.getData('collapseAt') as number;
    if (time - collapseAt >= GAME.cloudRespawnMs) {
      cloud.setData('state', 'idle');
      cloud.setAlpha(1);
      const body = cloud.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = true;
      cloud.refreshBody();
    }
  }
}
