/**
 * 被冷落判定：太久不联系，她会主动找你（按人设的"想你了/最近怎么不理我"）+ 好感轻微变淡。
 * 纯函数，不读写 store；内容在 waifeStates.json 的 reactNeglect。
 * 调用方（打开手机时）按返回的 reactions 落地：addAffinity + addPhoneMessage，并用每日 key 防刷。
 */
import { reactionsOf } from '@/engine/waifeStateAccess';

export interface NeglectInput {
  ownedCharacterIds: string[];
  affinityMap: Record<string, number>;
  /** charId → 最近主动联系的游戏天 */
  lastContact: Record<string, number>;
}

export interface NeglectReaction {
  characterId: string;
  affinityDelta: number;
  message: string;
  days: number;
}

/** 连续多少天没主动联系算"冷落" */
export const NEGLECT_DAYS = 3;
/** 好感低于此值的她不会主动来找（还没在意到那份上） */
export const NEGLECT_MIN_AFFINITY = 15;
/** 每次冷落唤回的好感衰减（温和） */
const NEGLECT_DECAY = -2;

/** 距上次联系过了几个游戏天（from/today 都是 gameDay；脏值/缺失按 0 处理） */
function daysSince(from: number | undefined, today: number): number {
  if (typeof from !== 'number' || !Number.isFinite(from) || !Number.isFinite(today)) return 0;
  return Math.max(0, today - from);
}

export function checkNeglect(input: NeglectInput, today: number, rng: () => number = Math.random): NeglectReaction[] {
  const out: NeglectReaction[] = [];
  for (const id of input.ownedCharacterIds) {
    const aff = input.affinityMap[id] ?? 0;
    if (aff < NEGLECT_MIN_AFFINITY) continue;
    const days = daysSince(input.lastContact[id], today);
    if (days < NEGLECT_DAYS) continue;
    const pool = reactionsOf(id).neglect ?? [];
    const message = pool.length ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] : '';
    out.push({ characterId: id, affinityDelta: NEGLECT_DECAY, message, days });
  }
  return out;
}
