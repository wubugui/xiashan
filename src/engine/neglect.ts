/**
 * 被冷落判定：太久不联系，她会主动找你（按人设的"想你了/最近怎么不理我"）+ 好感轻微变淡。
 * 纯函数，不读写 store；内容在 waifeStates.json 的 reactNeglect。
 * 调用方（打开手机时）按返回的 reactions 落地：addAffinity + addPhoneMessage，并用每日 key 防刷。
 */
import { reactionsOf } from '@/engine/waifeStateAccess';

export interface NeglectInput {
  ownedCharacterIds: string[];
  affinityMap: Record<string, number>;
  lastContact: Record<string, string>;
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

function daysSince(fromISO: string | undefined, today: string): number {
  if (!fromISO) return 0;
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function checkNeglect(input: NeglectInput, today: string, rng: () => number = Math.random): NeglectReaction[] {
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
