import { GACHA_CONFIG } from '../data/gachaConfig';
import { characters, Character } from '../data/characters';

export interface GachaResult {
  character: Character;
  isNew: boolean;
}

function rollRarity(pityCounter: number, totalGachaCount: number): 'SSR' | 'SR' | 'R' | 'N' {
  // SSR pity at 60
  if (pityCounter >= GACHA_CONFIG.pity.SSR - 1) return 'SSR';
  // SR pity at 10 (since last SR+)
  const sinceLastSR = totalGachaCount % GACHA_CONFIG.pity.SR;
  if (sinceLastSR >= GACHA_CONFIG.pity.SR - 1) {
    // guaranteed SR+, small chance of SSR
    if (Math.random() < GACHA_CONFIG.rates.SSR / (GACHA_CONFIG.rates.SSR + GACHA_CONFIG.rates.SR)) return 'SSR';
    return 'SR';
  }

  const roll = Math.random();
  let cumulative = 0;
  for (const [rarity, rate] of Object.entries(GACHA_CONFIG.rates)) {
    cumulative += rate;
    if (roll < cumulative) return rarity as 'SSR' | 'SR' | 'R' | 'N';
  }
  return 'N';
}

// 心动 UP：好感攒到阈值但还没抽到的角色，同稀有度内权重提升（设计文档 6.3）
export const HEART_UP_AFFINITY = 40;
export const HEART_UP_WEIGHT = 4;

export function isHeartUp(characterId: string, ownedIds: string[], affinityMap: Record<string, number>): boolean {
  return !ownedIds.includes(characterId) && (affinityMap[characterId] ?? 0) >= HEART_UP_AFFINITY;
}

function pickWeighted(pool: Character[], ownedIds: string[], affinityMap: Record<string, number>): Character {
  const weights = pool.map(c => (isHeartUp(c.id, ownedIds, affinityMap) ? HEART_UP_WEIGHT : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function pickCharacter(rarity: 'SSR' | 'SR' | 'R' | 'N', ownedIds: string[], affinityMap: Record<string, number>): Character {
  const rarityPool = characters.filter(c => c.rarity === rarity);
  const pool = rarityPool.length > 0 ? rarityPool : characters;
  if (pool.length === 0) {
    throw new Error('Gacha character pool is empty.');
  }
  // Prefer new characters
  const newOnes = pool.filter(c => !ownedIds.includes(c.id));
  const poolToPick = newOnes.length > 0 ? newOnes : pool;
  return pickWeighted(poolToPick, ownedIds, affinityMap);
}

export function pullSingle(ownedIds: string[], affinityMap: Record<string, number>, pityCounter: number, totalGachaCount: number): { result: GachaResult; newPity: number; newTotal: number } {
  const rarity = rollRarity(pityCounter, totalGachaCount);
  const character = pickCharacter(rarity, ownedIds, affinityMap);
  const isNew = !ownedIds.includes(character.id);
  const newPity = rarity === 'SSR' ? 0 : pityCounter + 1;
  return { result: { character, isNew }, newPity, newTotal: totalGachaCount + 1 };
}

export function pullTen(ownedIds: string[], affinityMap: Record<string, number>, pityCounter: number, totalGachaCount: number): { results: GachaResult[]; newPity: number; newTotal: number } {
  const results: GachaResult[] = [];
  let currentPity = pityCounter;
  let currentTotal = totalGachaCount;
  for (let i = 0; i < 10; i++) {
    const pull = pullSingle(ownedIds, affinityMap, currentPity, currentTotal);
    results.push(pull.result);
    currentPity = pull.newPity;
    currentTotal = pull.newTotal;
    ownedIds = [...ownedIds, pull.result.character.id]; // update for next pull
  }
  return { results, newPity: currentPity, newTotal: currentTotal };
}
