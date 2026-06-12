/**
 * 缘分系统纯逻辑引擎（无 DOM/React/store 依赖）
 *
 * 经济三层速度差（设计约定，不可拉平）：
 *   抽卡（快，随机主通道）→ 缘分 UP（中，概率辅助）→ 缘分碎片兑换（极慢，兜底地板）
 * 碎片汇率按稀有度陡峭分层：用刷低稀有度溢出卡攒出一张 SSR 需要数百张，
 * 它是「脸黑到极致的保险」，不是稳定产出通道——稀有就是稀有。
 */
export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

/** 溢出卡折算成缘分碎片的价值（按被折卡的稀有度） */
export const SHARD_VALUE: Record<Rarity, number> = { N: 1, R: 3, SR: 10, SSR: 30 };

/** 兑换一张指定角色信物卡所需碎片（按目标稀有度） */
export const CARD_COST: Record<Rarity, number> = { N: 20, R: 60, SR: 240, SSR: 800 };

/** 引荐人资格：关系阶段需达到「深夜长谈」（第 3 阶）——她愿意替你作保 */
export const REFERRER_MIN_STAGE = 3;

/** 满阶（终极形态）阶数；第 N 阶需要累计 N 张信物卡（卡数 + 好感双门槛） */
export const MAX_STAGE = 5;

/** 推进到第 stage 阶所需的累计信物卡数 */
export function dupesNeededForStage(stage: number): number {
  return stage;
}

/** 超出满阶所需（5 张）的溢出卡数——可安全折碎片，永不破坏阶段门槛 */
export function surplusCards(dupes: number): number {
  return Math.max(0, dupes - MAX_STAGE);
}

/** 一批角色的溢出卡折算总碎片 */
export function surplusShardsTotal(
  dupeCount: Record<string, number>,
  rarityOf: (characterId: string) => Rarity | undefined,
): number {
  let total = 0;
  for (const [id, n] of Object.entries(dupeCount)) {
    const rarity = rarityOf(id);
    if (!rarity) continue;
    total += surplusCards(n) * SHARD_VALUE[rarity];
  }
  return total;
}
