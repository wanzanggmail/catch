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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Easy vertical climb: short rises, wide ledges, lots of checkpoints.
 * Seed bumped (v2) so old hard layouts are discarded.
 */
export function generateMap(stage: number, map: number): MapDef {
  const width = GAME.mapWidthTiles;
  // Compact tower — much less climbing
  const height = 40 + Math.floor(stage * 0.5) + Math.floor(map / 3);
  const seed = stage * 1009 + map * 9176 + 2026; // v2 easy seed
  const rnd = mulberry32(seed);
  const tiles = emptyGrid(width, height);
  const questionBuffs: Record<string, BuffType> = {};

  // Solid floor
  for (let x = 0; x < width; x++) {
    tiles[height - 1]![x] = 'brick';
  }

  // Continuous side walls (safer — no fall-through gaps)
  for (let y = 0; y < height; y++) {
    tiles[y]![0] = 'brick';
    tiles[y]![width - 1] = 'brick';
  }

  const spawnX = Math.floor(width / 2);
  const spawnY = height - 4;
  tiles[spawnY]![spawnX] = 'spawn';

  // Very wide starter ledge
  for (let x = spawnX - 4; x <= spawnX + 4; x++) {
    if (x > 0 && x < width - 1) {
      tiles[height - 3]![x] = 'brick';
      tiles[spawnY]![x] = x === spawnX ? 'spawn' : 'empty';
      tiles[spawnY - 1]![x] = 'empty';
    }
  }

  let y = height - 6;
  const checkpointEvery = 6;
  let lastCheckpoint = y;
  let platIndex = 0;
  let prevCenter = spawnX;

  while (y > 8) {
    // Wide platforms: 5~8 tiles (easy to land)
    const platW = 5 + Math.floor(rnd() * 4);
    // Tiny horizontal shift so jumps are almost straight up
    const maxShift = 2;
    let center = clamp(
      prevCenter + Math.floor((rnd() - 0.5) * 2 * maxShift),
      2 + Math.floor(platW / 2),
      width - 3 - Math.floor(platW / 2),
    );
    // Keep platforms near the middle corridor
    center = clamp(center, Math.floor(width * 0.35), Math.floor(width * 0.65));

    const x = clamp(center - Math.floor(platW / 2), 1, width - platW - 1);

    let kind: TileKind = 'brick';
    const roll = rnd();
    // Almost no hazards on early stages
    if (stage >= 5 && roll < 0.06) kind = 'cloud';
    else if (stage >= 4 && roll < 0.03) kind = 'line';
    else if (roll < 0.35) kind = 'question';

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
      const cx = clamp(x + Math.floor(platW / 2), 1, width - 2);
      if (tyIn(tiles, cx, y - 1)) tiles[y - 1]![cx] = 'checkpoint';
      lastCheckpoint = y;
    }

    // Always add a helper step between platforms
    {
      const stepY = y - 1;
      const mid = Math.floor((prevCenter + center) / 2);
      const stepX = clamp(mid - 1, 1, width - 4);
      setPlat(tiles, stepX, stepY, 3, 'brick');
    }

    // Rise of only 2 tiles — easy single jump
    const rise = 2;
    prevCenter = center;
    y -= rise;
    platIndex++;
  }

  // Boss arena — full-width safe floor
  for (let x = 1; x < width - 1; x++) {
    tiles[6]![x] = 'brick';
  }
  setPlat(tiles, 2, 9, 5, 'brick');
  setPlat(tiles, width - 7, 9, 5, 'brick');
  setPlat(tiles, Math.floor(width / 2) - 3, 11, 7, 'brick');
  tiles[4]![Math.floor(width / 2)] = 'boss';

  return { stage, map, width, height, tiles, questionBuffs };
}

export function mapKey(stage: number, map: number): string {
  return `v2-s${stage}m${map}`;
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
