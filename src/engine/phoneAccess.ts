/**
 * 手机通讯权限：随养成递进解锁——抽到她=微信，关系升温=短信，亲密=电话。
 * 门槛复用 relationship 阶段阈值，叙事对位：
 * 阶段2「她开始主动找你」→ 短信；阶段3「深夜长谈」→ 电话。
 */
import { getRelationshipStages } from '@/data/relationship';

/** 0=未拥有(陌生人) 1=微信 2=短信 3=电话 */
export type CommsTier = 0 | 1 | 2 | 3;

export const TIER_LABEL: Record<1 | 2 | 3, string> = { 1: '微信', 2: '短信', 3: '电话' };

function stageThreshold(characterId: string, stage: number): number {
  return getRelationshipStages(characterId).find((s) => s.stage === stage)?.threshold ?? Infinity;
}

/** 短信解锁所需好感（关系阶段2「她开始主动找你」） */
export function smsThreshold(characterId: string): number {
  return stageThreshold(characterId, 2);
}

/** 电话解锁所需好感（关系阶段3「深夜长谈」） */
export function callThreshold(characterId: string): number {
  return stageThreshold(characterId, 3);
}

/** 当前可用的最高通讯层级 */
export function commsTier(characterId: string, owned: boolean, affinity: number): CommsTier {
  if (!owned) return 0;
  if (affinity >= callThreshold(characterId)) return 3;
  if (affinity >= smsThreshold(characterId)) return 2;
  return 1;
}

/** 距下一层解锁还差多少好感（已满级返回 null） */
export function nextUnlock(characterId: string, tier: CommsTier, affinity: number): { label: string; remain: number } | null {
  if (tier === 1) return { label: '短信', remain: Math.max(0, smsThreshold(characterId) - affinity) };
  if (tier === 2) return { label: '电话', remain: Math.max(0, callThreshold(characterId) - affinity) };
  return null;
}
