import { GAME, PHYSICS } from '../game/config';

export type JumpBlocks = 1 | 3 | 5;

const STORAGE_KEY = 'catch-jump-blocks';
const OPTIONS: JumpBlocks[] = [1, 3, 5];

/**
 * Jump apex height for N tiles under constant gravity:
 * h = v^2 / (2g)  →  v = sqrt(2gh)
 * Slight bonus so a full jump reliably clears N tiles with body size.
 */
export function jumpVelocityForBlocks(blocks: JumpBlocks): number {
  const heightPx = blocks * GAME.tileSize + 10;
  return Math.sqrt(2 * PHYSICS.gravity * heightPx);
}

export class JumpSettings {
  blocks: JumpBlocks = 3;

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const n = Number(raw);
      if (n === 1 || n === 3 || n === 5) this.blocks = n;
    } catch {
      /* ignore */
    }
  }

  setBlocks(blocks: JumpBlocks): void {
    this.blocks = blocks;
    try {
      localStorage.setItem(STORAGE_KEY, String(blocks));
    } catch {
      /* ignore */
    }
  }

  cycle(): JumpBlocks {
    const i = OPTIONS.indexOf(this.blocks);
    const next = OPTIONS[(i + 1) % OPTIONS.length]!;
    this.setBlocks(next);
    return next;
  }

  jumpForce(): number {
    return jumpVelocityForBlocks(this.blocks);
  }
}

export const jumpSettings = new JumpSettings();
