/**
 * 30 base map layouts (Stage 1~6 × Map 1~5).
 * Maps are generated procedurally from stage/map seed — same seed = same layout.
 * Save slots apply progress/difficulty on top of these base layouts.
 */
import { STAGES, MAPS_PER_STAGE } from '../game/config';
import { allMapDefs, generateMap, mapKey, type MapDef } from './generateMap';

export { generateMap, mapKey, allMapDefs, type MapDef, type TileKind } from './generateMap';

const MAP_REGISTRY: Map<string, MapDef> = new Map();

export function getMapDef(stage: number, map: number): MapDef {
  const key = mapKey(stage, map);
  let def = MAP_REGISTRY.get(key);
  if (!def) {
    def = generateMap(stage, map);
    MAP_REGISTRY.set(key, def);
  }
  return def;
}

export function listAllMapKeys(): string[] {
  const keys: string[] = [];
  for (let s = 1; s <= STAGES; s++) {
    for (let m = 1; m <= MAPS_PER_STAGE; m++) {
      keys.push(mapKey(s, m));
    }
  }
  return keys;
}

/** Warm cache — all 30 base maps */
export function preloadAllMaps(): MapDef[] {
  return allMapDefs().map((def) => {
    MAP_REGISTRY.set(mapKey(def.stage, def.map), def);
    return def;
  });
}
