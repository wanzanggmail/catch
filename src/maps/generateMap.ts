import { GAME, type BuffType, BUFF_TYPES } from '../game/config';

export type TileKind =
  | 'empty'
  | 'brick'
  | 'line'
  | 'question'
  | 'cloud'
  | 'checkpoint'
  | 'spawn'
  | 'boss'
  | 'hole'
  | 'cave';

export interface RatSpawn {
  /** Tile coords — rat stands on platform at (x, y) */
  x: number;
  y: number;
  /** Patrol bounds in tiles (inclusive platform edges) */
  left: number;
  right: number;
}

export interface MapDef {
  stage: number;
  map: number;
  width: number;
  height: number;
  tiles: TileKind[][]; // [y][x]
  questionBuffs: Record<string, BuffType>; // "x,y" -> buff
  ratSpawns: RatSpawn[];
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
  // Later stages used to grow too tall — keep climbs shorter
  const height = 46 + Math.min(stage, 3) + Math.min(map, 2);
  const seed = stage * 7919 + map * 104729 + 7;
  const rnd = mulberry32(seed);
  const tiles = emptyGrid(width, height);
  const questionBuffs: Record<string, BuffType> = {};
  const ratSpawns: RatSpawn[] = [];

  // Extra ease on mid/late maps (esp. stage 4 map 3+)
  const softZigzag = stage >= 4 || map >= 3;
  const widePads = stage >= 4 || map >= 3;
  const ratChance = stage >= 4 ? 0.1 : map >= 3 ? 0.18 : 0.28;
  const maxRats = stage >= 4 ? 2 : map >= 3 ? 3 : 5;

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

  // Climbing ledges: pure left↔right zigzag, one pad per row, wide air gap
  let y = height - 7;
  let side = -1; // next platform goes left first
  let platIndex = 0;
  const checkpointEvery = 2;
  const step = 4; // empty rows between ledges (no vertical stacking)
  const leftEdge = 1;
  const rightEdge = width - 1;

  while (y > 10) {
    side *= -1;
    const platW = widePads ? 5 + Math.floor(rnd() * 2) : 4 + Math.floor(rnd() * 2); // 5~6 or 4~5
    // Zigzag only — never place pads on consecutive rows
    let x: number;
    if (side < 0) {
      x = softZigzag ? leftEdge + 1 + Math.floor(rnd() * 2) : leftEdge + Math.floor(rnd() * 2);
    } else {
      const inset = softZigzag ? 2 + Math.floor(rnd() * 2) : Math.floor(rnd() * 2);
      x = rightEdge - platW - inset;
    }
    x = clamp(x, 1, width - platW - 1);

    let kind: TileKind = 'brick';
    const roll = rnd();
    if (stage >= 6 && roll < 0.08) kind = 'cloud';
    else if (stage >= 6 && roll < 0.04) kind = 'line';
    else if (roll < 0.45) kind = 'question';

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

    if (
      platIndex >= 2 &&
      platW >= 4 &&
      kind !== 'cloud' &&
      ratSpawns.length < maxRats &&
      rnd() < ratChance
    ) {
      const rx = x + Math.floor(platW / 2);
      ratSpawns.push({
        x: rx,
        y: y - 1,
        left: x,
        right: x + platW - 1,
      });
    }

    y -= step;
    platIndex++;
  }

  // Boss arena + enterable cave hole at the end of the climb
  const mid = Math.floor(width / 2);
  const holeLeft = mid - 1;
  const holeRight = mid + 1; // 3-tile wide hole

  // Clear climb leftovers so the route to the hole stays open
  for (let cy = 7; cy <= 24; cy++) {
    for (let cx = 1; cx < width - 1; cx++) {
      const t = tiles[cy]![cx];
      if (
        t === 'brick' ||
        t === 'question' ||
        t === 'cloud' ||
        t === 'line' ||
        t === 'checkpoint' ||
        t === 'cave' ||
        t === 'hole'
      ) {
        tiles[cy]![cx] = 'empty';
      }
    }
  }
  for (let i = ratSpawns.length - 1; i >= 0; i--) {
    const r = ratSpawns[i]!;
    if (r.y >= 6 && r.y <= 24) ratSpawns.splice(i, 1);
  }

  // Cave roof (y=8..9) with an open shaft in the center
  for (let x = 1; x < width - 1; x++) {
    const inHole = x >= holeLeft && x <= holeRight;
    tiles[8]![x] = inHole ? 'empty' : 'cave';
    tiles[9]![x] = inHole ? 'empty' : 'cave';
  }

  // Hole mouth at y=10 — only the opening is hole; sides are cave frame
  for (let x = 1; x < width - 1; x++) {
    const inHole = x >= holeLeft && x <= holeRight;
    tiles[10]![x] = inHole ? 'hole' : 'cave';
  }
  // Keep y=11 fully open under the mouth (no cave pillars blocking the climb-in)
  for (let x = holeLeft; x <= holeRight; x++) {
    tiles[11]![x] = 'empty';
  }

  // Arena floor above the hole (y=7) — solid except the hole gap
  for (let x = 1; x < width - 1; x++) {
    const inHole = x >= holeLeft && x <= holeRight;
    tiles[7]![x] = inHole ? 'hole' : 'brick';
  }

  // Landing pads inside the arena after climbing through
  setPlat(tiles, 1, 6, 3, 'brick');
  setPlat(tiles, width - 4, 6, 3, 'brick');

  // Open zigzag path up to the hole (wide gaps, never a sealed row)
  setPlat(tiles, 1, 23, 5, 'brick'); // left
  setPlat(tiles, width - 6, 19, 5, 'brick'); // right
  setPlat(tiles, 1, 15, 5, 'brick'); // left
  setPlat(tiles, mid - 2, 12, 5, 'brick'); // center pad directly under the hole

  // Clear boss fight space (y=1..5)
  for (let by = 1; by <= 5; by++) {
    for (let bx = 1; bx < width - 1; bx++) {
      tiles[by]![bx] = 'empty';
    }
  }
  tiles[3]![mid] = 'boss';

  return { stage, map, width, height, tiles, questionBuffs, ratSpawns };
}

export function mapKey(stage: number, map: number): string {
  return `v13-s${stage}m${map}`;
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
