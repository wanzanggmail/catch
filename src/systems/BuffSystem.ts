import { BUFF_TYPES, GAME, type BuffType } from '../game/config';

export interface ActiveBuff {
  type: BuffType;
  expiresAt: number; // timestamp ms, Infinity for shield / instant skipped
  charges?: number;
}

/** Weighted pick so rare items still appear often enough. */
function pickWeightedBuff(exclude?: BuffType): BuffType {
  const pool = BUFF_TYPES.filter((t) => t !== exclude);
  const weights: Record<BuffType, number> = {
    speed: 3,
    jump: 3,
    shield: 2,
    power: 2,
    heal: 3,
    feather: 2,
    haste: 2,
  };
  let total = 0;
  for (const t of pool) total += weights[t];
  let r = Math.random() * total;
  for (const t of pool) {
    r -= weights[t];
    if (r <= 0) return t;
  }
  return pool[pool.length - 1]!;
}

export class BuffSystem {
  private active: ActiveBuff[] = [];
  private lastGranted: BuffType | null = null;

  clear(): void {
    this.active = [];
    this.lastGranted = null;
  }

  grant(type: BuffType, now: number): void {
    this.lastGranted = type;
    if (type === 'heal') {
      // Instant — no duration entry
      return;
    }
    if (type === 'shield') {
      this.active = this.active.filter((b) => b.type !== 'shield');
      this.active.push({ type: 'shield', expiresAt: Infinity, charges: 1 });
      return;
    }
    this.active = this.active.filter((b) => b.type !== type);
    this.active.push({ type, expiresAt: now + GAME.buffDurationMs });
  }

  grantRandom(now: number): BuffType {
    // Avoid repeating the same item twice in a row when possible
    const type = pickWeightedBuff(this.lastGranted ?? undefined);
    this.grant(type, now);
    return type;
  }

  tick(now: number): void {
    this.active = this.active.filter(
      (b) => b.type === 'shield' || b.expiresAt > now,
    );
  }

  has(type: BuffType): boolean {
    return this.active.some((b) => b.type === type);
  }

  speedMul(): number {
    let m = 1;
    if (this.has('speed')) m *= 1.4;
    if (this.has('haste')) m *= 1.2;
    return m;
  }

  jumpMul(): number {
    return this.has('jump') ? 1.3 : 1;
  }

  powerMul(): number {
    return this.has('power') ? 2 : 1;
  }

  attackCooldownMul(): number {
    return this.has('haste') ? 0.55 : 1;
  }

  canGlide(): boolean {
    return this.has('feather');
  }

  /** Returns true if damage was absorbed by shield. */
  tryAbsorbHit(): boolean {
    const shield = this.active.find((b) => b.type === 'shield');
    if (!shield) return false;
    shield.charges = (shield.charges ?? 1) - 1;
    if ((shield.charges ?? 0) <= 0) {
      this.active = this.active.filter((b) => b !== shield);
    }
    return true;
  }

  list(): ActiveBuff[] {
    return [...this.active];
  }
}
