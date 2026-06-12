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
  /** 便利屋统一补给池（人物+技能+便利+情报） */
  supplyPool: {
    cost: number;
    characterRate: number;
    characterPity: number;
    cardWeights: { skill: number; tool: number; info: number; hint: number; stoneSmall: number; stoneLarge: number };
    stoneAmounts: { small: number; large: number };
  };
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
  /** 地图标记图标（emoji） */
  icon?: string;
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
  /** 场景装饰元素（纯演出） */
  scenery?: { emoji: string; x: number; y: number; size?: number }[];
  /** 无关 NPC：可点击对话的氛围角色（纯演出，不影响规则） */
  npcs?: LocationNpc[];
}

export interface LocationNpc {
  name: string;
  emoji: string;
  x: number;
  y: number;
  lines: string[];
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

  /* ── 子目标制（v1.4）：有 objectives 则交付条件 = 全部子目标完成 ── */
  objectives?: CommissionObjective[];
  /** 接单时播放的开场幕 */
  introScene?: TheaterScene;
  /** 交付时播放的结局幕（跑到 ending 为止） */
  finalScene?: TheaterScene;
}

/** 剧场分幕：从 start 播到即将进入 stopBefore 时落幕；无 stopBefore 则播到结局 */
export interface TheaterScene {
  start: string;
  stopBefore?: string;
}

export interface CommissionObjective {
  id: string;
  desc: string;
  /** 用这些 type 的卡在匹配热点上打出即算完成 */
  need: ServiceTag[];
  /** 限定地点标签（location.tags 含此标签）；缺省则任意地点 */
  locTag?: string;
  /** 完成奖励信任 */
  trust: number;
  /** 完成后播放的剧场幕 */
  scene: TheaterScene;
}

/** 顺手单：通用模板小委托（sideJobs.json） */
export interface SideJob {
  id: string;
  title: string;
  text: string;
  need: ServiceTag[];
  locTag?: string;
  reward: { money?: number; normalTickets?: number; spiritStones?: number };
  doneText: string;
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
