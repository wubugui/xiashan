import content from '@/content/romanceArcs.json';
import type { Condition } from '@/engine/types';
import { waifeConfigArcs, configuredIds } from '@/data/waifes';

export type RomancePhase = '共事' | '熟络' | '暧昧' | '告白门' | '深耕' | '终幕';

/** 一句对白：有 speaker(角色 id) = 她说；无 speaker = 旁白 */
export interface RomanceLine {
  speaker?: string;
  text: string;
}

export interface RomanceChoiceOption {
  text: string;
  /** 隐藏「默契」增量 */
  momo: number;
  /** 她的反应对白 */
  reaction: RomanceLine[];
  /** 仅告白门:选它 = 确认心意(过门 + 排他锁定);不选则留在门前可重来 */
  gateConfirm?: boolean;
}

export interface RomanceScene {
  /** 背景地点（复用 locations 的 bg） */
  location?: string;
  lines: RomanceLine[];
  choice?: { prompt: string; options: RomanceChoiceOption[] };
}

export interface RomanceReward {
  /** 好感（写回主流程数值） */
  affinity?: number;
  /** 推进关系阶段 */
  advanceStage?: boolean;
  /** 解锁档案/CG 的 flag */
  unlockFlag?: string;
  /** 她发来的微信 */
  wechat?: string;
}

export interface RomanceBeat {
  id: string;
  phase: RomancePhase;
  title: string;
  /** 锁着时显示的指引（怎么挣到，不剧透内容） */
  guide: string;
  /** 解锁条件（复用 conditionEngine） */
  trigger: Condition[];
  /** 确认心意门 */
  isGate?: boolean;
  scene: RomanceScene;
  reward?: RomanceReward;
}

export interface RomanceArc {
  characterId: string;
  theme: string;
  beats: RomanceBeat[];
}

// 「一角色一配置」的角色用配置里的恋爱线覆盖旧 romanceArcs.json 同 id 项
const legacyArcs = (content as { arcs: RomanceArc[] }).arcs.filter((a) => !configuredIds.has(a.characterId));
const arcs: RomanceArc[] = [...waifeConfigArcs, ...legacyArcs];

export function getRomanceArc(characterId: string): RomanceArc | undefined {
  return arcs.find((a) => a.characterId === characterId);
}

export function hasRomanceArc(characterId: string): boolean {
  return arcs.some((a) => a.characterId === characterId);
}
