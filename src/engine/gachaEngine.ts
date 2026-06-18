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
 * 计时按游戏天（gameDay）：rateUpUntil/coldUntil 存到期 gameDay，当前天 < 该值时有效。
 */
export const RATE_UP_WEIGHT = 4;
export const COLD_WEIGHT = 0.25;
export const RATE_UP_DAYS = 3;
export const COLD_DAYS = 4;

/** 角色与玩家之间的限时关系状态：characterId → 到期 gameDay（当前游戏天 < 该值时仍有效） */
export interface BondState {
  rateUpUntil?: Record<string, number>;
  coldUntil?: Record<string, number>;
}

export function isHeartUp(characterId: string, ownedIds: string[], affinityMap: Record<string, number>): boolean {
  return !ownedIds.includes(characterId) && (affinityMap[characterId] ?? 0) >= HEART_UP_AFFINITY;
}

/** 缘分 UP / 冷淡 DOWN 的权重倍率（同时存在时相乘）。today = 当前游戏天 */
export function bondWeight(characterId: string, bond: BondState | undefined, today: number): number {
  if (!bond) return 1;
  let w = 1;
  if ((bond.rateUpUntil?.[characterId] ?? 0) > today) w *= RATE_UP_WEIGHT;
  if ((bond.coldUntil?.[characterId] ?? 0) > today) w *= COLD_WEIGHT;
  return w;
}

function pickWeighted(pool: Character[], ownedIds: string[], affinityMap: Record<string, number>, bond: BondState | undefined, today: number): Character {
  const weights = pool.map(c =>
    (isHeartUp(c.id, ownedIds, affinityMap) ? HEART_UP_WEIGHT : 1) * bondWeight(c.id, bond, today),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** 该稀有度池里当期处于「缘分 UP」的角色（rateUpUntil 未过期，today = 当前游戏天） */
function activeRateUpInRarity(pool: Character[], bond: BondState | undefined, today: number): Character[] {
  if (!bond?.rateUpUntil) return [];
  return pool.filter(c => (bond.rateUpUntil![c.id] ?? 0) > today);
}

function pickCharacter(rarity: 'SSR' | 'SR' | 'R' | 'N', ownedIds: string[], affinityMap: Record<string, number>, bond: BondState | undefined, today: number): Character {
  const rarityPool = characters.filter(c => c.rarity === rarity);
  const pool = rarityPool.length > 0 ? rarityPool : characters;
  if (pool.length === 0) {
    throw new Error('Gacha character pool is empty.');
  }
  // 定向 UP：命中该稀有度后，若池内有当期 UP 角色，按 rateUpRatio 概率直接给她。
  // 关键：定向只发生在「已掷出的稀有度内」，绝不跨稀有度——被 UP 的 SSR 仍受 SSR 概率门限制，
  // 综合出率永远低于 R，稀有度高低关系不被打破。
  const ups = activeRateUpInRarity(pool, bond, today);
  if (ups.length > 0 && Math.random() < GACHA_CONFIG.supplyPool.rateUpRatio) {
    return ups[Math.floor(Math.random() * ups.length)];
  }
  // 否则优先新角色，再按心动/缘分权重挑
  const newOnes = pool.filter(c => !ownedIds.includes(c.id));
  const poolToPick = newOnes.length > 0 ? newOnes : pool;
  return pickWeighted(poolToPick, ownedIds, affinityMap, bond, today);
}

export function pullSingle(ownedIds: string[], affinityMap: Record<string, number>, pityCounter: number, totalGachaCount: number, bond: BondState | undefined, today: number): { result: GachaResult; newPity: number; newTotal: number } {
  const rarity = rollRarity(pityCounter, totalGachaCount);
  const character = pickCharacter(rarity, ownedIds, affinityMap, bond, today);
  const isNew = !ownedIds.includes(character.id);
  const newPity = rarity === 'SSR' ? 0 : pityCounter + 1;
  return { result: { character, isNew }, newPity, newTotal: totalGachaCount + 1 };
}

export function pullTen(ownedIds: string[], affinityMap: Record<string, number>, pityCounter: number, totalGachaCount: number, bond: BondState | undefined, today: number): { results: GachaResult[]; newPity: number; newTotal: number } {
  const results: GachaResult[] = [];
  let currentPity = pityCounter;
  let currentTotal = totalGachaCount;
  for (let i = 0; i < 10; i++) {
    const pull = pullSingle(ownedIds, affinityMap, currentPity, currentTotal, bond, today);
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
  /** 月光奖励（big 为稀有大袋，给特写） */
  | { kind: 'stones'; amount: number; big: boolean };

/** SSR 软保底：随「连续未出 SSR 的人物出货次数」线性爬升，到大保底必出。 */
export function effectiveSSRRate(ssrCount: number): number {
  const { rates, supplyPool: sp } = GACHA_CONFIG;
  if (ssrCount >= sp.ssrHardPity - 1) return 1;          // 大保底必出
  if (ssrCount < sp.ssrSoftPityStart) return rates.SSR;  // 前期固定低概率（很难出）
  const over = ssrCount - sp.ssrSoftPityStart + 1;
  return Math.min(1, rates.SSR + over * sp.ssrSoftPityStep);
}

/** 命中人物后的稀有度：先按软保底掷 SSR，否则在 SR/R 间按原比例分配。 */
function rollCharacterRarity(ssrCount: number): 'SSR' | 'SR' | 'R' | 'N' {
  if (Math.random() < effectiveSSRRate(ssrCount)) return 'SSR';
  const { SR, R } = GACHA_CONFIG.rates;
  return Math.random() < SR / (SR + R) ? 'SR' : 'R';
}

export function pullSupply(
  ownedIds: string[],
  affinityMap: Record<string, number>,
  pityCounter: number,
  /** 连续未出 SSR 的「人物出货」次数（SSR 软保底计数） */
  ssrCount: number,
  bond: BondState | undefined,
  /** 当前游戏天（gameDay）：缘分UP/冷淡按游戏天判定 */
  today: number,
): { result: SupplyPullResult; newPity: number; newSsrCount: number } {
  const cfg = GACHA_CONFIG.supplyPool;
  const hitCharacter = pityCounter >= cfg.characterPity - 1 || Math.random() < cfg.characterRate;
  if (hitCharacter) {
    const rarity = rollCharacterRarity(ssrCount);
    const character = pickCharacter(rarity, ownedIds, affinityMap, bond, today);
    return {
      result: { kind: 'person', character, isNew: !ownedIds.includes(character.id) },
      newPity: 0,
      newSsrCount: rarity === 'SSR' ? 0 : ssrCount + 1, // 出 SSR 清零软保底，否则累加
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
  // 抽到卡/道具/月光：只按「人物出货次数」累计 SSR 软保底，故 ssrCount 原样回传
  if (chosen === 'hint') return { result: { kind: 'hint' }, newPity, newSsrCount: ssrCount };
  if (chosen === 'stoneSmall') return { result: { kind: 'stones', amount: cfg.stoneAmounts.small, big: false }, newPity, newSsrCount: ssrCount };
  if (chosen === 'stoneLarge') return { result: { kind: 'stones', amount: cfg.stoneAmounts.large, big: true }, newPity, newSsrCount: ssrCount };
  const card = chosen[Math.floor(Math.random() * chosen.length)];
  return { result: { kind: 'card', card }, newPity, newSsrCount: ssrCount };
}
