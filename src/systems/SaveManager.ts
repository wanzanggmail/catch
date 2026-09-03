import type { BuffType, EvolutionStage } from '../game/config';
import { SAVE_SLOTS, STAGES, MAPS_PER_STAGE, evolutionForPlayingStage } from '../game/config';

export interface SlotData {
  unlockedStage: number; // 1-based, highest unlocked stage
  unlockedMap: Record<number, number>; // stage -> highest unlocked map (1-based)
  clearedMaps: string[]; // "stage-map" keys
  highestStageCleared: number;
  inventoryBuffs: BuffType[];
}

export interface SaveFile {
  version: 1;
  slots: (SlotData | null)[];
}

const STORAGE_KEY = 'catch-save-v1';

function emptySlot(): SlotData {
  return {
    unlockedStage: 1,
    unlockedMap: { 1: 1 },
    clearedMaps: [],
    highestStageCleared: 0,
    inventoryBuffs: [],
  };
}

function normalizeSlot(slot: SlotData): SlotData {
  slot.unlockedStage = Math.max(1, Math.min(STAGES, slot.unlockedStage || 1));
  if (!slot.unlockedMap) slot.unlockedMap = { 1: 1 };
  if ((slot.unlockedMap[1] ?? 0) < 1) slot.unlockedMap[1] = 1;
  if (!slot.clearedMaps) slot.clearedMaps = [];
  if (!slot.inventoryBuffs) slot.inventoryBuffs = [];
  slot.highestStageCleared = Math.max(0, slot.highestStageCleared || 0);
  return slot;
}

function defaultSave(): SaveFile {
  return {
    version: 1,
    slots: Array.from({ length: SAVE_SLOTS }, () => null),
  };
}

export class SaveManager {
  private data: SaveFile;
  activeSlotIndex: number | null = null;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveFile {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw) as SaveFile;
      if (parsed.version !== 1 || !Array.isArray(parsed.slots)) return defaultSave();
      while (parsed.slots.length < SAVE_SLOTS) parsed.slots.push(null);
      parsed.slots = parsed.slots.map((s) => (s ? normalizeSlot(s) : null));
      return parsed;
    } catch {
      return defaultSave();
    }
  }

  persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  getSlot(index: number): SlotData | null {
    return this.data.slots[index] ?? null;
  }

  createSlot(index: number): SlotData {
    const slot = normalizeSlot(emptySlot());
    this.data.slots[index] = slot;
    this.persist();
    return slot;
  }

  deleteSlot(index: number): void {
    this.data.slots[index] = null;
    this.persist();
  }

  selectSlot(index: number): SlotData {
    let slot = this.getSlot(index);
    if (!slot) slot = this.createSlot(index);
    this.activeSlotIndex = index;
    return slot;
  }

  getActive(): SlotData {
    if (this.activeSlotIndex === null) throw new Error('No active save slot');
    const slot = this.getSlot(this.activeSlotIndex);
    if (!slot) throw new Error('Active slot missing');
    return slot;
  }

  evolution(): EvolutionStage {
    const slot = this.getActive();
    return evolutionForPlayingStage(
      Math.min(STAGES, Math.max(1, slot.unlockedStage)),
    );
  }

  markCleared(stage: number, map: number): void {
    const slot = this.getActive();
    const key = `${stage}-${map}`;
    if (!slot.clearedMaps.includes(key)) slot.clearedMaps.push(key);

    if (map >= MAPS_PER_STAGE) {
      slot.highestStageCleared = Math.max(slot.highestStageCleared, stage);
      if (stage < STAGES) {
        slot.unlockedStage = Math.max(slot.unlockedStage, stage + 1);
        slot.unlockedMap[stage + 1] = Math.max(slot.unlockedMap[stage + 1] ?? 1, 1);
      }
    } else {
      slot.unlockedMap[stage] = Math.max(slot.unlockedMap[stage] ?? 1, map + 1);
    }
    this.persist();
  }

  isMapUnlocked(stage: number, map: number): boolean {
    const slot = this.getActive();
    if (stage > slot.unlockedStage) return false;
    return map <= (slot.unlockedMap[stage] ?? 1);
  }

  addInventoryBuff(buff: BuffType): void {
    const slot = this.getActive();
    if (slot.inventoryBuffs.length < 3) {
      slot.inventoryBuffs.push(buff);
      this.persist();
    }
  }

  consumeInventoryBuff(): BuffType | null {
    const slot = this.getActive();
    const buff = slot.inventoryBuffs.shift() ?? null;
    if (buff) this.persist();
    return buff;
  }

  /** Difficulty coefficient for session (slot index + progress). */
  difficultyFactor(): number {
    const slot = this.getActive();
    const slotBias = (this.activeSlotIndex ?? 0) * 0.05;
    const progress = slot.highestStageCleared * 0.04;
    return 1 + slotBias + progress;
  }
}

export const saveManager = new SaveManager();
