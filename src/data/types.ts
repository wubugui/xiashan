import type { Condition, Effect } from '@/engine/types';

export type ServiceTag =
  | '流程' | '表达' | '技术' | '安抚' | '补给' | '宠物'
  | '情报' | '观察' | '维修' | '路线' | '恢复' | '万能';

export type CharacterExpression = 'smile' | 'shy' | 'laugh' | 'angry' | 'cry' | 'calm';

export interface Character {
  id: string;
  name: string;
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  title: string;
  description: string;
  element: string;
  serviceType: ServiceTag;
  portraitUrl: string;
  avatarUrl: string;
  expressionUrls?: Partial<Record<CharacterExpression, string>>;
  gachaPortraitUrl?: string;
  gachaBackgroundUrl?: string;
  gachaQuote?: string;
  gachaTags?: string[];
  dialogues: { level: number; text: string }[];
  interactions: { type: 'touch' | 'gift' | 'talk'; response: string; level: number }[];
  effects: { type: 'story' | 'passive'; description: string; value: number; level: number }[];
  phonePersonality: {
    wechatStyle: 'formal' | 'casual' | 'cold' | 'playful' | 'mysterious';
    responseSpeed: 'instant' | 'fast' | 'slow' | 'unpredictable';
    commonPhrases: string[];
  };
}

export interface StoryNode {
  id: string;
  chapterId: number;
  type: 'dialogue' | 'narration' | 'choice' | 'gacha_trigger' | 'face_slap' | 'phone_notify';
  text: string;
  speaker?: string;
  speakerColor?: string;
  backgroundUrl?: string;
  choices?: { text: string; nextNodeId: string; conditions?: Condition[]; effects?: Effect[] }[];
  conditions?: Condition[];
  effects?: Effect[];
  gachaTrigger?: { freePulls: number; requiredRarity?: string };
  faceSlap?: {
    characterId: string;
    enemyName: string;
    enemyLine: string;
    characterLine: string;
    resultText: string;
    effects: Effect[];
  };
  phoneNotify?: { type: 'wechat' | 'call' | 'sms'; characterId: string; eventId: string };
  nextNodeId?: string;
}

export interface StoryChapter {
  id: number;
  title: string;
  description: string;
  backgroundUrl: string;
  startNodeId: string;
  rewards: Effect[];
}

export interface PhoneEvent {
  id: string;
  type: 'wechat' | 'call' | 'sms' | 'browser_push';
  triggerConditions: Condition[];
  characterId?: string;
  messages: {
    sender: 'character' | 'player';
    content: string;
    type: 'text' | 'image' | 'voice' | 'red_packet';
    voiceText?: string;
    delay?: number;
  }[];
  choices?: { text: string; effects: Effect[]; nextMessages?: string[] }[];
  effects?: Effect[];
  nextEventId?: string;
}

export interface GachaConfig {
  singleCost: number;
  tenCost: number;
  rates: Record<'SSR' | 'SR' | 'R' | 'N', number>;
  pity: Record<'SSR' | 'SR', number>;
}

export interface RewardsConfig {
  story_node_complete: number;
  chapter_complete: number;
  daily_login: number;
  face_slap_success: number;
  phone_interaction: number;
  first_time_character: number;
  minigame_clear: number;
}

/* ───── 便利屋系统类型 ───── */

/** 热点事件的即时资源增减 */
export interface SpotDelta {
  time?: number;
  energy?: number;
  money?: number;
  trust?: number;
  rep?: number;
}

/** 场景热点 */
export interface Spot {
  name: string;
  x: number;
  y: number;
  type: 'quest' | 'clue' | 'danger' | 'resource';
  need: ServiceTag[];
  text: string;
  base: SpotDelta;
  /** characterId → 匹配时的特殊台词 */
  special?: Record<string, string>;
}

/** 可选地点 */
export interface GameLocation {
  id: string;
  name: string;
  tags: string[];
  recommend: ServiceTag[];
  bg: string;
  spots: Spot[];
}

/** 委托剧场：客户情绪 */
export type Mood = '焦虑' | '平静' | '感动' | '信赖';

/** 一句对白：speaker 为 characterId，省略则为旁白 */
export interface Line {
  speaker?: string;
  text: string;
}

/* ───── 委托剧场：图（graph）数据驱动 ───── */
/**
 * 剧情是一张有向图：节点(node) + 边(next)。
 * - dialogue：播放对白后跳到 next
 * - challenge：出牌三档判定，每档自带反应对白 + 信任/情绪 + 各自的 next（可分支）
 * - branch：按信任阈值分流（无 UI，进入即跳转）
 * - ending：播放对白后结束，success 决定奖励路径
 */

/** 出牌某一档判定的结果 */
export interface ChallengeOutcome {
  /** 客户反应对白 */
  lines: Line[];
  trust: number;
  mood: Mood;
  /** 危机判定失误时扣口碑 */
  repPenalty?: number;
  /** 反应播完后跳转的节点 id（实现分支/汇合） */
  next: string;
}

export interface DialogueNode {
  id: string;
  type: 'dialogue';
  /** 复用 location 背景（可选） */
  location?: string;
  lines: Line[];
  next: string;
}

export interface ChallengeNode {
  id: string;
  type: 'challenge';
  location?: string;
  prompt: string;
  need: ServiceTag[];
  /** 危机幕：出错有惩罚 */
  danger?: boolean;
  outcomes: {
    perfect: ChallengeOutcome; // 打出匹配卡
    ok: ChallengeOutcome;      // 打出非匹配卡
    poor: ChallengeOutcome;    // 不出牌 / 基础处理
  };
}

export interface BranchNode {
  id: string;
  type: 'branch';
  /** 信任 >= trustGte 走 ifTrue，否则走 ifFalse */
  trustGte: number;
  ifTrue: string;
  ifFalse: string;
}

export interface EndingNode {
  id: string;
  type: 'ending';
  location?: string;
  lines: Line[];
  /** 是否达成委托（决定奖励路径） */
  success: boolean;
}

export type CommissionNode = DialogueNode | ChallengeNode | BranchNode | EndingNode;

export interface CommissionGraph {
  /** 起始节点 id */
  start: string;
  nodes: CommissionNode[];
}

/** 委托（从委托频道抽出） */
export interface Commission {
  id: string;
  name: string;
  rarity: 'R' | 'SR' | 'SSR';
  /** 完成后受益/解锁的角色 characterId */
  target: string;
  /** 达成完成所需信任值（剧场中作分支阈值参考） */
  need: number;
  tags: string[];
  desc: string;
  /** 委托完成后执行的 Effect[] */
  rewardEffects: Effect[];

  /* ── 剧场脚本（可选；有则进入全屏 AVG 剧场） ── */
  /** 客户 characterId（默认取 target） */
  client?: string;
  initialMood?: Mood;
  /** 图数据驱动的剧情 */
  graph?: CommissionGraph;
}

/** 技能/便利/情报一次性卡 */
export interface ServiceCard {
  id: string;
  kind: 'skill' | 'tool' | 'info';
  name: string;
  type: ServiceTag;
  rarity: 'R' | 'SR';
  desc: string;
}
