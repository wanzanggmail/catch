import { GAME, type BuffType, BUFF_TYPES } from '../game/config';

export type TileKind =
  | 'empty'
  | 'brick'
  | 'line'
  | 'question'
  | 'cloud'
  | 'checkpoint'
  | 'spawn'
  | 'boss';

export interface MapDef {
  stage: number;
  map: number;
  width: number;
  height: number;
  tiles: TileKind[][]; // [y][x]
  questionBuffs: Record<string, BuffType>; // "x,y" -> buff
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyGrid(w: number, h: number): TileKind[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => 'empty' as TileKind));
}

function setPlat(tiles: TileKind[][], x: number, y: number, w: number, kind: TileKind): void {
  for (let i = 0; i < w; i++) {
    const tx = x + i;
    if (tyIn(tiles, tx, y)) tiles[y]![tx] = kind;
  }
}

function tyIn(tiles: TileKind[][], x: number, y: number): boolean {
  return y >= 0 && y < tiles.length && x >= 0 && x < (tiles[0]?.length ?? 0);
}

/**
 * Generate a vertical platformer layout for stage/map.
 * Y=0 is top (boss), Y=height-1 is bottom (spawn).
 */
export function generateMap(stage: number, map: number): MapDef {
  const width = GAME.mapWidthTiles;
  const height = GAME.mapHeightTiles + stage * 2 + map;
  const seed = stage * 1009 + map * 9176 + 42;
  const rnd = mulberry32(seed);
  const tiles = emptyGrid(width, height);
  const questionBuffs: Record<string, BuffType> = {};

  // Floor at bottom
  for (let x = 0; x < width; x++) {
    tiles[height - 1]![x] = 'brick';
    tiles[height - 2]![x] = x > 2 && x < width - 3 ? 'empty' : 'brick';
  }

  // Side walls (partial)
  for (let y = 0; y < height; y++) {
    if (y % 7 !== 0) {
      tiles[y]![0] = 'brick';
      tiles[y]![width - 1] = 'brick';
    }
  }

  // Spawn
  const spawnX = Math.floor(width / 2);
  const spawnY = height - 4;
  tiles[spawnY]![spawnX] = 'spawn';

  // Platforms ascending
  let y = height - 6;
  let checkpointEvery = 14;
  let lastCheckpoint = y;
  let platIndex = 0;

  while (y > 8) {
    const gapBias = 0.15 + stage * 0.03 + map * 0.01;
    const platW = 2 + Math.floor(rnd() * (5 - Math.min(2, stage * 0.3)));
    let x = 1 + Math.floor(rnd() * (width - platW - 2));

    // Alternate sides for climbability
    if (platIndex % 2 === 0) x = Math.min(x, Math.floor(width / 2) - 1);
    else x = Math.max(x, Math.floor(width / 2) - platW + 1);

    let kind: TileKind = 'brick';
    const roll = rnd();
    if (stage >= 5 && roll < 0.28) kind = 'cloud';
    else if (roll < 0.12 + gapBias * 0.3) kind = 'line';
    else if (roll < 0.22) kind = 'question';

    setPlat(tiles, x, y, platW, kind);

    if (kind === 'question') {
      const qx = x + Math.floor(platW / 2);
      const buff = BUFF_TYPES[Math.floor(rnd() * BUFF_TYPES.length)]!;
      questionBuffs[`${qx},${y}`] = buff;
      tiles[y]![qx] = 'question';
      for (let i = 0; i < platW; i++) {
        if (x + i !== qx) tiles[y]![x + i] = 'brick';
      }
    }

    if (lastCheckpoint - y >= checkpointEvery) {
      const cx = PhaserClamp(x + Math.floor(platW / 2), 1, width - 2);
      // place checkpoint just above platform
      if (tyIn(tiles, cx, y - 1)) tiles[y - 1]![cx] = 'checkpoint';
      lastCheckpoint = y;
    }

    // Occasional brick filler step
    if (rnd() < 0.35) {
      const stepY = y - 2;
      const stepX = PhaserClamp(x + (rnd() < 0.5 ? -2 : platW), 1, width - 4);
      setPlat(tiles, stepX, stepY, 2, 'brick');
    }

    const rise = 3 + Math.floor(rnd() * (2 + Math.min(stage, 3)));
    y -= rise;
    platIndex++;
  }

  // Boss arena floor near top
  for (let x = 2; x < width - 2; x++) {
    tiles[6]![x] = 'brick';
  }
  tiles[4]![Math.floor(width / 2)] = 'boss';

  // Ensure spawn platform clear
  for (let x = spawnX - 2; x <= spawnX + 2; x++) {
    if (x > 0 && x < width - 1) {
      tiles[height - 3]![x] = 'brick';
      tiles[spawnY]![x] = x === spawnX ? 'spawn' : 'empty';
    }
  }

  return { stage, map, width, height, tiles, questionBuffs };
}

function PhaserClamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function mapKey(stage: number, map: number): string {
  return `s${stage}m${map}`;
}

export function allMapDefs(): MapDef[] {
  const list: MapDef[] = [];
  for (let s = 1; s <= 6; s++) {
    for (let m = 1; m <= 5; m++) {
      list.push(generateMap(s, m));
    }
  }
  return list;
}

export function findMarker(
  def: MapDef,
  kind: TileKind,
): { x: number; y: number } | null {
  for (let y = 0; y < def.height; y++) {
    for (let x = 0; x < def.width; x++) {
      if (def.tiles[y]![x] === kind) return { x, y };
    }
  }
  return null;
}
