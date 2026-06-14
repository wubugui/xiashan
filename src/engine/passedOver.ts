/**
 * 确认心意（告白门过门、xinyiTarget 锁定）后，其他对你有好感的老婆不该默默被锁——
 * 她们会发来一条得体的"被错过/退场"消息（按人设，有的洒脱有的强忍）。
 * 纯函数，不读写 store；内容在 waifeStates.json 的 reactPassedOver。
 */
import { reactionsOf } from '@/engine/waifeStateAccess';

export interface PassedOverInput {
  chosenId: string;
  ownedCharacterIds: string[];
  affinityMap: Record<string, number>;
}

export interface PassedOverReaction {
  characterId: string;
  message: string;
}

/** 好感够这个值才会"被错过"——没感觉的不会发 */
export const PASSED_OVER_MIN_AFFINITY = 30;

export function passedOverReactions(input: PassedOverInput, rng: () => number = Math.random): PassedOverReaction[] {
  const out: PassedOverReaction[] = [];
  for (const id of input.ownedCharacterIds) {
    if (id === input.chosenId) continue;
    if ((input.affinityMap[id] ?? 0) < PASSED_OVER_MIN_AFFINITY) continue;
    const pool = reactionsOf(id).passedOver ?? [];
    if (!pool.length) continue;
    out.push({ characterId: id, message: pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] });
  }
  return out;
}
