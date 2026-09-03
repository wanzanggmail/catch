/** Design-doc physics scaled to Phaser pixels (×50). Y+ is down in Phaser. */
export const PHYSICS = {
  gravity: 990,
  moveSpeed: 275,
  jumpForce: 600,
  airControlFactor: 0.75,
  maxFallSpeed: 750,
  friction: 0.85,
  variableJumpCut: 0.45,
  coyoteTimeMs: 80,
  jumpBufferMs: 100,
} as const;

export const GAME = {
  width: 480,
  height: 854,
  tileSize: 32,
  mapWidthTiles: 15,
  /** Vertical maps are tall */
  mapHeightTiles: 80,
  playerHp: 3,
  bossHp: 5,
  buffDurationMs: 8000,
  cloudTriggerMs: 1500,
  cloudRespawnMs: 3000,
  checkpointGracePx: 40,
} as const;

export const EVOLUTION = {
  1: {
    name: 'Kitty',
    label: '아기 고양이',
    speedMul: 1,
    jumpMul: 1,
    color: 0xf4a261,
    wallJump: false,
    doubleJump: false,
    glide: false,
  },
  2: {
    name: 'Warrior',
    label: '닌자 고양이',
    speedMul: 1.15,
    jumpMul: 1.1,
    color: 0xe76f51,
    wallJump: true,
    doubleJump: false,
    glide: false,
  },
  3: {
    name: 'Eagle',
    label: '독수리 고양이',
    speedMul: 1.2,
    jumpMul: 1.15,
    color: 0x2a9d8f,
    wallJump: true,
    doubleJump: true,
    glide: true,
  },
} as const;

export type EvolutionStage = 1 | 2 | 3;

export function evolutionForStageClear(highestStageCleared: number): EvolutionStage {
  if (highestStageCleared >= 4) return 3; // cleared stage 5+ unlocks form 3; stage 3-4 clear → form 2
  if (highestStageCleared >= 2) return 2;
  return 1;
}

/** Evolution by current playing stage (design: Stage 1-2 / 3-4 / 5-6) */
export function evolutionForPlayingStage(stage: number): EvolutionStage {
  if (stage >= 5) return 3;
  if (stage >= 3) return 2;
  return 1;
}

export const BUFF_TYPES = ['speed', 'jump', 'shield', 'power'] as const;
export type BuffType = (typeof BUFF_TYPES)[number];

export const STAGES = 6;
export const MAPS_PER_STAGE = 5;
export const SAVE_SLOTS = 3;
