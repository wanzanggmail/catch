import { BUFF_TYPES, GAME, type BuffType } from '../game/config';

export interface ActiveBuff {
  type: BuffType;
  expiresAt: number; // timestamp ms, Infinity for shield
  charges?: number;
}

export class BuffSystem {
  private active: ActiveBuff[] = [];

  clear(): void {
    this.active = [];
  }

  grant(type: BuffType, now: number): void {
    if (type === 'shield') {
      this.active = this.active.filter((b) => b.type !== 'shield');
      this.active.push({ type: 'shield', expiresAt: Infinity, charges: 1 });
      return;
    }
    this.active = this.active.filter((b) => b.type !== type);
    this.active.push({ type, expiresAt: now + GAME.buffDurationMs });
  }

  grantRandom(now: number): BuffType {
    const type = BUFF_TYPES[Math.floor(Math.random() * BUFF_TYPES.length)]!;
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
    return this.has('speed') ? 1.4 : 1;
  }

  jumpMul(): number {
    return this.has('jump') ? 1.3 : 1;
  }

  powerMul(): number {
    return this.has('power') ? 2 : 1;
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
