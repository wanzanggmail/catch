import { GAME, PHYSICS } from '../game/config';

export type SideBlocks = 1 | 3 | 5;

const STORAGE_KEY = 'catch-side-blocks';

/**
 * Air horizontal speed so a full held jump travels about N tiles sideways.
 * airTime ≈ 2 * jumpForce / gravity
 */
export function airMoveSpeedForBlocks(blocks: SideBlocks): number {
  const distancePx = blocks * GAME.tileSize;
  const airTime = (2 * PHYSICS.jumpForce) / PHYSICS.gravity;
  return (distancePx / Math.max(0.2, airTime)) * 1.08;
}

export class SideJumpSettings {
  blocks: SideBlocks = 3;

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('catch-jump-blocks');
      const n = Number(raw);
      if (n === 1 || n === 3 || n === 5) this.blocks = n;
    } catch {
      /* ignore */
    }
  }

  setBlocks(blocks: SideBlocks): void {
    this.blocks = blocks;
    try {
      localStorage.setItem(STORAGE_KEY, String(blocks));
    } catch {
      /* ignore */
    }
  }

  airMoveSpeed(): number {
    return airMoveSpeedForBlocks(this.blocks);
  }
}

export const sideJumpSettings = new SideJumpSettings();
