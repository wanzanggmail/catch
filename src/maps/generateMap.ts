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
  // Playable height: room to climb without feeling endless
  const height = 56 + stage * 2 + map;
  const seed = stage * 7919 + map * 104729 + 7;
  const rnd = mulberry32(seed);
  const tiles = emptyGrid(width, height);
  const questionBuffs: Record<string, BuffType> = {};
  const ratSpawns: RatSpawn[] = [];

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
    else if (stage >= 5 && roll < 0.05) kind = 'line';
    else if (roll < 0.34) kind = 'question';

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

    // Small 1-hit rats on many platforms (skip spawn-adjacent first ledge)
    if (platIndex >= 1 && platW >= 3 && kind !== 'cloud' && rnd() < 0.55) {
      const rx = x + Math.floor(platW / 2);
      ratSpawns.push({
        x: rx,
        y: y - 1,
        left: x,
        right: x + platW - 1,
      });
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

  // Boss arena + enterable cave hole at the end of the climb
  const mid = Math.floor(width / 2);
  const holeLeft = mid - 1;
  const holeRight = mid + 1; // 3-tile wide hole

  // Clear any leftover climb platforms that might clog the shaft
  for (let cy = 7; cy <= 14; cy++) {
    for (let cx = 1; cx < width - 1; cx++) {
      const t = tiles[cy]![cx];
      if (t === 'brick' || t === 'question' || t === 'cloud' || t === 'line' || t === 'checkpoint') {
        tiles[cy]![cx] = 'empty';
      }
    }
  }
  // Drop rats that would spawn in the cleared zone
  for (let i = ratSpawns.length - 1; i >= 0; i--) {
    const r = ratSpawns[i]!;
    if (r.y >= 6 && r.y <= 15) ratSpawns.splice(i, 1);
  }

  // Thick cave roof (y=8..9) with a passage in the center
  for (let x = 1; x < width - 1; x++) {
    const inHole = x >= holeLeft && x <= holeRight;
    tiles[8]![x] = inHole ? 'empty' : 'cave';
    tiles[9]![x] = inHole ? 'empty' : 'cave';
  }

  // Hole mouth at y=10 — dark opening you climb into (no collision)
  for (let x = 1; x < width - 1; x++) {
    const inHole = x >= holeLeft && x <= holeRight;
    tiles[10]![x] = inHole ? 'hole' : 'cave';
  }
  // Cave lip framing the mouth
  tiles[10]![holeLeft - 1] = 'cave';
  tiles[10]![holeRight + 1] = 'cave';
  tiles[11]![holeLeft - 1] = 'cave';
  tiles[11]![holeRight + 1] = 'cave';

  // Arena floor above the hole (y=7) — solid except the hole gap
  for (let x = 1; x < width - 1; x++) {
    const inHole = x >= holeLeft && x <= holeRight;
    tiles[7]![x] = inHole ? 'hole' : 'brick';
  }

  // Landing pads inside the arena after climbing through
  setPlat(tiles, 1, 6, 3, 'brick');
  setPlat(tiles, width - 4, 6, 3, 'brick');

  // Approach platforms leading up into the hole
  setPlat(tiles, mid - 2, 13, 5, 'brick');
  setPlat(tiles, 2, 16, 4, 'brick');
  setPlat(tiles, width - 6, 16, 4, 'brick');
  setPlat(tiles, mid - 3, 19, 3, 'brick');

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
  return `v7-s${stage}m${map}`;
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
