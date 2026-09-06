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
    if (inBounds(tiles, tx, y)) tiles[y]![tx] = kind;
  }
}

function inBounds(tiles: TileKind[][], x: number, y: number): boolean {
  return y >= 0 && y < tiles.length && x >= 0 && x < (tiles[0]?.length ?? 0);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Normal vertical platformer layout (easy difficulty).
 * Clear air gaps between ledges — not a solid brick column.
 */
export function generateMap(stage: number, map: number): MapDef {
  const width = GAME.mapWidthTiles;
  // Playable height: room to climb without feeling endless
  const height = 56 + stage * 2 + map;
  const seed = stage * 7919 + map * 104729 + 7;
  const rnd = mulberry32(seed);
  const tiles = emptyGrid(width, height);
  const questionBuffs: Record<string, BuffType> = {};

  // Ground floor
  for (let x = 0; x < width; x++) {
    tiles[height - 1]![x] = 'brick';
  }

  // Partial side walls (not a sealed tube)
  for (let y = 0; y < height; y++) {
    if (y % 4 !== 2) {
      tiles[y]![0] = 'brick';
      tiles[y]![width - 1] = 'brick';
    }
  }

  // Spawn platform
  const spawnX = Math.floor(width / 2);
  const spawnY = height - 4;
  for (let x = spawnX - 3; x <= spawnX + 3; x++) {
    if (x > 0 && x < width - 1) {
      tiles[height - 3]![x] = 'brick';
      tiles[spawnY]![x] = 'empty';
      tiles[spawnY - 1]![x] = 'empty';
    }
  }
  tiles[spawnY]![spawnX] = 'spawn';

  // Climbing ledges: main platform every 4 rows (jumpable gap)
  let y = height - 7;
  let prevCenter = spawnX;
  let side = -1;
  let platIndex = 0;
  const checkpointEvery = 3; // every 3 main platforms

  while (y > 10) {
    side *= -1;
    const platW = 3 + Math.floor(rnd() * 3); // 3~5
    // Alternate sides with moderate offset (still reachable)
    const target =
      side < 0
        ? 2 + Math.floor(rnd() * 3) + Math.floor(platW / 2)
        : width - 3 - Math.floor(rnd() * 3) - Math.floor(platW / 2);
    // Blend toward previous so gap isn't extreme
    let center = Math.round(prevCenter * 0.35 + target * 0.65);
    center = clamp(center, 2 + Math.floor(platW / 2), width - 3 - Math.floor(platW / 2));
    const x = clamp(center - Math.floor(platW / 2), 1, width - platW - 1);

    let kind: TileKind = 'brick';
    const roll = rnd();
    if (stage >= 5 && roll < 0.12) kind = 'cloud';
    else if (stage >= 3 && roll < 0.08) kind = 'line';
    else if (roll < 0.22) kind = 'question';

    setPlat(tiles, x, y, platW, kind);

    if (kind === 'question') {
      const qx = x + Math.floor(platW / 2);
      questionBuffs[`${qx},${y}`] = BUFF_TYPES[Math.floor(rnd() * BUFF_TYPES.length)]!;
      tiles[y]![qx] = 'question';
      for (let i = 0; i < platW; i++) {
        if (x + i !== qx) tiles[y]![x + i] = 'brick';
      }
    }

    if (platIndex > 0 && platIndex % checkpointEvery === 0) {
      const cx = clamp(x + Math.floor(platW / 2), 1, width - 2);
      if (inBounds(tiles, cx, y - 1) && tiles[y - 1]![cx] === 'empty') {
        tiles[y - 1]![cx] = 'checkpoint';
      }
    }

    // Occasional mid helper (not every platform — keeps air gaps visible)
    if (rnd() < 0.4) {
      const midY = y - 2;
      const midCenter = Math.round((prevCenter + center) / 2);
      const midW = 2;
      const midX = clamp(midCenter - 1, 1, width - midW - 1);
      // Only place if cell is empty so we don't fill the shaft
      if (tiles[midY]![midX] === 'empty') {
        setPlat(tiles, midX, midY, midW, 'brick');
      }
    }

    prevCenter = center;
    // Main spacing: 4 tiles of rise → clear empty rows between ledges
    y -= 4;
    platIndex++;
  }

  // Boss arena
  for (let x = 1; x < width - 1; x++) {
    tiles[7]![x] = 'brick';
    tiles[6]![x] = 'empty';
    tiles[5]![x] = 'empty';
  }
  // Approach platforms into arena
  setPlat(tiles, 2, 11, 3, 'brick');
  setPlat(tiles, width - 5, 11, 3, 'brick');
  setPlat(tiles, Math.floor(width / 2) - 2, 14, 4, 'brick');
  tiles[4]![Math.floor(width / 2)] = 'boss';

  // Clear boss fight space
  for (let by = 1; by <= 5; by++) {
    for (let bx = 1; bx < width - 1; bx++) {
      if (tiles[by]![bx] !== 'boss') tiles[by]![bx] = 'empty';
    }
  }
  tiles[4]![Math.floor(width / 2)] = 'boss';

  return { stage, map, width, height, tiles, questionBuffs };
}

export function mapKey(stage: number, map: number): string {
  return `v3-s${stage}m${map}`;
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
