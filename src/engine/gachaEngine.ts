import { GACHA_CONFIG } from '../data/gachaConfig';
import { characters, Character } from '../data/characters';
import { allSkills, allTools, allInfos } from '../data/serviceCards';
import type { ServiceCard } from '../data/types';

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

/* ── 缘分 UP / 冷淡 DOWN：委托行为对出现概率的限时影响 ──
 * 完成她的委托 → 缘分 UP（更容易遇到她）；放弃她的委托 → 冷淡 DOWN（她躲着你）。
 * 计时挂自然日（与 tryDailyAction 同口径），到期自动失效。
 */
export const RATE_UP_WEIGHT = 4;
export const COLD_WEIGHT = 0.25;
export const RATE_UP_DAYS = 3;
export const COLD_DAYS = 4;

/** 角色与玩家之间的限时关系状态：characterId → 'YYYY-MM-DD'（含当日有效） */
export interface BondState {
  rateUpUntil?: Record<string, string>;
  coldUntil?: Record<string, string>;
}

export function isHeartUp(characterId: string, ownedIds: string[], affinityMap: Record<string, number>): boolean {
  return !ownedIds.includes(characterId) && (affinityMap[characterId] ?? 0) >= HEART_UP_AFFINITY;
}

/** 缘分 UP / 冷淡 DOWN 的权重倍率（同时存在时相乘） */
export function bondWeight(characterId: string, bond?: BondState, today = new Date().toISOString().slice(0, 10)): number {
  if (!bond) return 1;
  let w = 1;
  if ((bond.rateUpUntil?.[characterId] ?? '') >= today) w *= RATE_UP_WEIGHT;
  if ((bond.coldUntil?.[characterId] ?? '') >= today) w *= COLD_WEIGHT;
  return w;
}

function pickWeighted(pool: Character[], ownedIds: string[], affinityMap: Record<string, number>, bond?: BondState): Character {
  const weights = pool.map(c =>
    (isHeartUp(c.id, ownedIds, affinityMap) ? HEART_UP_WEIGHT : 1) * bondWeight(c.id, bond),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function pickCharacter(rarity: 'SSR' | 'SR' | 'R' | 'N', ownedIds: string[], affinityMap: Record<string, number>, bond?: BondState): Character {
  const rarityPool = characters.filter(c => c.rarity === rarity);
  const pool = rarityPool.length > 0 ? rarityPool : characters;
  if (pool.length === 0) {
    throw new Error('Gacha character pool is empty.');
  }
  // Prefer new characters
  const newOnes = pool.filter(c => !ownedIds.includes(c.id));
  const poolToPick = newOnes.length > 0 ? newOnes : pool;
  return pickWeighted(poolToPick, ownedIds, affinityMap, bond);
}

export function pullSingle(ownedIds: string[], affinityMap: Record<string, number>, pityCounter: number, totalGachaCount: number, bond?: BondState): { result: GachaResult; newPity: number; newTotal: number } {
  const rarity = rollRarity(pityCounter, totalGachaCount);
  const character = pickCharacter(rarity, ownedIds, affinityMap, bond);
  const isNew = !ownedIds.includes(character.id);
  const newPity = rarity === 'SSR' ? 0 : pityCounter + 1;
  return { result: { character, isNew }, newPity, newTotal: totalGachaCount + 1 };
}

export function pullTen(ownedIds: string[], affinityMap: Record<string, number>, pityCounter: number, totalGachaCount: number, bond?: BondState): { results: GachaResult[]; newPity: number; newTotal: number } {
  const results: GachaResult[] = [];
  let currentPity = pityCounter;
  let currentTotal = totalGachaCount;
  for (let i = 0; i < 10; i++) {
    const pull = pullSingle(ownedIds, affinityMap, currentPity, currentTotal, bond);
    results.push(pull.result);
    currentPity = pull.newPity;
    currentTotal = pull.newTotal;
    ownedIds = [...ownedIds, pull.result.character.id]; // update for next pull
  }
  return { results, newPity: currentPity, newTotal: currentTotal };
}

/* ─────────────── 便利屋统一补给池 ───────────────
 * 人物(低概率+硬保底) + 技能/便利/情报(常规产出)合并为一个池。
 * 人物出货时沿用稀有度概率与心动UP权重；保底计数只被人物重置。
 */
export type SupplyPullResult =
  | { kind: 'person'; character: Character; isNew: boolean }
  | { kind: 'card'; card: ServiceCard }
  /** 消消乐提示券（计数道具，不进手牌） */
  | { kind: 'hint' }
  /** 灵石奖励（big 为稀有大袋，给特写） */
  | { kind: 'stones'; amount: number; big: boolean };

function rollCharacterRarity(): 'SSR' | 'SR' | 'R' | 'N' {
  const roll = Math.random();
  let cumulative = 0;
  for (const [rarity, rate] of Object.entries(GACHA_CONFIG.rates)) {
    cumulative += rate;
    if (roll < cumulative) return rarity as 'SSR' | 'SR' | 'R' | 'N';
  }
  return 'R';
}

export function pullSupply(
  ownedIds: string[],
  affinityMap: Record<string, number>,
  pityCounter: number,
  bond?: BondState,
): { result: SupplyPullResult; newPity: number } {
  const cfg = GACHA_CONFIG.supplyPool;
  const hitCharacter = pityCounter >= cfg.characterPity - 1 || Math.random() < cfg.characterRate;
  if (hitCharacter) {
    const rarity = rollCharacterRarity();
    const character = pickCharacter(rarity, ownedIds, affinityMap, bond);
    return {
      result: { kind: 'person', character, isNew: !ownedIds.includes(character.id) },
      newPity: 0,
    };
  }
  type Outcome = ServiceCard[] | 'hint' | 'stoneSmall' | 'stoneLarge';
  const pools: [number, Outcome][] = [
    [cfg.cardWeights.skill, allSkills],
    [cfg.cardWeights.tool, allTools],
    [cfg.cardWeights.info, allInfos],
    [cfg.cardWeights.hint, 'hint'],
    [cfg.cardWeights.stoneSmall, 'stoneSmall'],
    [cfg.cardWeights.stoneLarge, 'stoneLarge'],
  ];
  const total = pools.reduce((a, [w]) => a + w, 0);
  let roll = Math.random() * total;
  let chosen: Outcome = pools[pools.length - 1][1];
  for (const [w, pool] of pools) {
    roll -= w;
    if (roll < 0) { chosen = pool; break; }
  }
  const newPity = pityCounter + 1;
  if (chosen === 'hint') return { result: { kind: 'hint' }, newPity };
  if (chosen === 'stoneSmall') return { result: { kind: 'stones', amount: cfg.stoneAmounts.small, big: false }, newPity };
  if (chosen === 'stoneLarge') return { result: { kind: 'stones', amount: cfg.stoneAmounts.large, big: true }, newPity };
  const card = chosen[Math.floor(Math.random() * chosen.length)];
  return { result: { kind: 'card', card }, newPity };
}
