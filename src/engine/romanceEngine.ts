/**
 * 心动/恋爱线引擎（纯函数，不读写 store）。
 * beats 顺序解锁：只有「当前进度 == 该节点序号」且「trigger 满足」时才可进。
 * 详见 docs/恋爱线设计-心动系统.md
 */
import { getRomanceArc, type RomanceBeat } from '@/data/romanceArcs';
import { evaluateAll } from '@/engine/conditionEngine';

export type BeatStatus = 'done' | 'available' | 'locked';

/** conditionEngine 需要的状态快照（由调用方从 store 组装） */
export interface RomanceCondState {
  spiritStones: number;
  reputation: number;
  ownedCharacters: { characterId: string; level: number }[];
  affinityMap: Record<string, number>;
  relationshipStages: Record<string, number>;
  completedNodes: string[];
  flags: string[];
  dupeCount?: Record<string, number>;
}

/** 某节点当前状态：已完成 / 可进 / 锁住 */
export function beatStatus(
  characterId: string,
  beatIndex: number,
  progress: number,
  state: RomanceCondState,
): BeatStatus {
  if (beatIndex < progress) return 'done';
  if (beatIndex > progress) return 'locked';
  // 正好是下一个待解锁节点：trigger 满足才可进
  const arc = getRomanceArc(characterId);
  const beat = arc?.beats[beatIndex];
  if (!beat) return 'locked';
  return evaluateAll(beat.trigger, state) ? 'available' : 'locked';
}

/** 当前"下一个"待进节点（已全部走完返回 null） */
export function nextBeat(characterId: string, progress: number): RomanceBeat | null {
  const arc = getRomanceArc(characterId);
  if (!arc) return null;
  return arc.beats[progress] ?? null;
}

/** 当前"下一个"节点是否已可进 */
export function nextBeatAvailable(characterId: string, progress: number, state: RomanceCondState): boolean {
  return beatStatus(characterId, progress, progress, state) === 'available';
}

/** arc 是否已全部走完 */
export function isArcComplete(characterId: string, progress: number): boolean {
  const arc = getRomanceArc(characterId);
  return !!arc && progress >= arc.beats.length;
}
