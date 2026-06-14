/**
 * 「把自己头像设成某个老婆的照片」——高博弈结算（纯函数，不读写 store）。
 * - 选中的她：到位(好感≥60 或 已确认心意=她) → 甜蜜暴击 + 大推进；
 *   没到位 → 85% 大幅变淡+反感，15% 小幅+受宠若惊。
 * - 其他好感≥30 的老婆：吃醋，掉好感 + 疏远/询问。
 * 反应以「她的下一条微信」形式发出（调用方 addPhoneMessage 落地）。
 */
import content from '@/content/waifeStates.json';

const states = (content as {
  states: Record<string, { reactSweet?: string[]; reactReject?: string[]; reactFlattered?: string[]; reactJealous?: string[] }>;
}).states;

export interface AvatarFalloutInput {
  chosenId: string;
  affinityMap: Record<string, number>;
  ownedCharacterIds: string[];
  xinyiTarget: string | null;
}

export type FalloutKind = 'sweet' | 'reject' | 'flattered' | 'jealous';

export interface FalloutReaction {
  characterId: string;
  affinityDelta: number;
  /** 她下一条会发来的微信（空串=该角色没配反应台词，调用方跳过发消息） */
  message: string;
  kind: FalloutKind;
}

/** 到位阈值：好感够暧昧 */
export const SWEET_AFFINITY = 60;
/** 其他老婆吃醋阈值 */
export const JEALOUS_AFFINITY = 30;
const DELTA: Record<FalloutKind, number> = { sweet: 15, reject: -20, flattered: 5, jealous: -10 };

function pick(arr: string[] | undefined, roll: number): string {
  if (!arr || arr.length === 0) return '';
  return arr[Math.min(arr.length - 1, Math.floor(roll * arr.length))];
}

/** rng 注入便于测试；默认 Math.random */
export function resolveAvatarFallout(input: AvatarFalloutInput, rng: () => number = Math.random): FalloutReaction[] {
  const { chosenId, affinityMap, ownedCharacterIds, xinyiTarget } = input;
  const out: FalloutReaction[] = [];
  const inPlace = (affinityMap[chosenId] ?? 0) >= SWEET_AFFINITY || xinyiTarget === chosenId;
  const s = states[chosenId] ?? {};

  if (inPlace) {
    out.push({ characterId: chosenId, affinityDelta: DELTA.sweet, message: pick(s.reactSweet, rng()), kind: 'sweet' });
  } else if (rng() < 0.15) {
    out.push({ characterId: chosenId, affinityDelta: DELTA.flattered, message: pick(s.reactFlattered, rng()), kind: 'flattered' });
  } else {
    out.push({ characterId: chosenId, affinityDelta: DELTA.reject, message: pick(s.reactReject, rng()), kind: 'reject' });
  }

  // 其他好感够高的老婆吃醋（按 id 顺序，稳定）
  for (const id of ownedCharacterIds) {
    if (id === chosenId) continue;
    if ((affinityMap[id] ?? 0) < JEALOUS_AFFINITY) continue;
    const js = states[id] ?? {};
    out.push({ characterId: id, affinityDelta: DELTA.jealous, message: pick(js.reactJealous, rng()), kind: 'jealous' });
  }
  return out;
}
