/**
 * 环境感：就算你没冷落她，关系够近的她也会"偶尔主动找你"——分享日常 / 突然想你。
 * 让手机即使在你很上心时也有生活气。每天至多一条（调用方用每日 key 限频）。
 * 纯函数，不读写 store；内容在 waifeStates.json 的 reactAmbient。
 */
import { NEGLECT_DAYS } from '@/engine/neglect';
import { reactionsOf } from '@/engine/waifeStateAccess';

export interface AmbientInput {
  ownedCharacterIds: string[];
  affinityMap: Record<string, number>;
  /** charId → 最近主动联系的游戏天 */
  lastContact: Record<string, number>;
}

export interface AmbientReaction {
  characterId: string;
  message: string;
}

/** 好感够这个值的她才会主动分享日常 */
export const AMBIENT_MIN_AFFINITY = 30;
/** 触发概率（每天结算一次）：偶尔，不打扰 */
const AMBIENT_CHANCE = 0.5;

/** 距上次联系过了几个游戏天（from/today 都是 gameDay；脏值/缺失按 0 处理） */
function daysSince(from: number | undefined, today: number): number {
  if (typeof from !== 'number' || !Number.isFinite(from) || !Number.isFinite(today)) return 0;
  return Math.max(0, today - from);
}

/** 掷一次：可能返回一条某个近况老婆的主动消息，否则 null */
export function rollAmbient(input: AmbientInput, today: number, rng: () => number = Math.random): AmbientReaction | null {
  // 资格：好感够 + 最近有联系（没被冷落——冷落由 neglect 单独处理，不重叠）
  const eligible = input.ownedCharacterIds.filter((id) => {
    if ((input.affinityMap[id] ?? 0) < AMBIENT_MIN_AFFINITY) return false;
    if (daysSince(input.lastContact[id], today) >= NEGLECT_DAYS) return false;
    return (reactionsOf(id).ambient?.length ?? 0) > 0;
  });
  if (eligible.length === 0) return null;
  if (rng() >= AMBIENT_CHANCE) return null;
  // 好感越高越可能是她（加权挑一个）
  const weights = eligible.map((id) => input.affinityMap[id] ?? 0);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  let chosen = eligible[eligible.length - 1];
  for (let i = 0; i < eligible.length; i++) {
    r -= weights[i];
    if (r < 0) { chosen = eligible[i]; break; }
  }
  const pool = reactionsOf(chosen).ambient ?? [];
  const message = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return { characterId: chosen, message };
}
