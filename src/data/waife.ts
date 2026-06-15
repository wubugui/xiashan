/**
 * 「一角色一配置」架构：每个角色的全部数据集中在 src/content/waifes/<id>.json。
 * 加角色 = 加一个配置文件，其余代码不动（loader 在 waifes.ts 把配置铺成
 * Character / RomanceArc / 状态 / 回复矩阵，按 id 覆盖到既有结构上）。
 *
 * 跨角色状态相互影响（吃醋/退场/冷落…）不写进单个角色配置——角色只声明
 * 「我作为某个事件角色时怎么反应」（reactions/signatures by role），
 * 由中央社交引擎（avatarFallout / passedOver / neglect / ambient）算出谁担任什么角色后，
 * 回到各自配置取反应台词。这样角色配置永远不引用别的角色，加角色即自动参与社交。
 */
import type { Character, CharacterExpression, ServiceTag } from '@/data/types';
import type { RomanceBeat } from '@/data/romanceArcs';

export type ChatIntent = 'greet' | 'care' | 'flirt' | 'invite';
export type AffinityTier = '生疏' | '熟络' | '亲密';
export type ChatChannel = 'wechat' | 'sms';
/** 一天的时段（按真实时钟），让签名/状态跟着她的作息走 */
export type TimeBucket = '清晨' | '上午' | '午后' | '夜晚' | '深夜';

/** 一格回复：数组随机取一句；空数组 [] = 她不回（已读不回） */
export type ReplyCell = string[];

export interface WaifeConfig {
  id: string;
  identity: {
    name: string;
    rarity: Character['rarity'];
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
    gachaVoiceUrls?: string[];
  };
  phone: {
    wechatStyle: Character['phonePersonality']['wechatStyle'];
    responseSpeed: Character['phonePersonality']['responseSpeed'];
    commonPhrases: string[];
    /** 默认人设签名 */
    signature: string;
    /** 她的睡眠时段 [起,止)（24h）：这段时间给她发消息，她在睡，回复迷糊/已读 */
    sleepHours?: [number, number];
  };
  dialogues: { level: number; text: string }[];
  interactions: { type: 'touch' | 'gift' | 'talk'; response: string; level: number }[];
  effects: { type: 'story' | 'passive'; description: string; value: number; level: number }[];
  romance: { theme: string; beats: RomanceBeat[] };
  /**
   * 签名：大部分是她自己的生活(life，按日轮换、与游戏无关)，感情只在平常里偶尔冒头。
   * - life: 生活签名池——可是扁平数组，也可按时段分桶(随她的作息变，半夜/白天看到不同的她)
   * - feeling: 暧昧期偶尔泄露的心事(按概率冒出，珍贵)
   * - lover: 确认心意后偶尔出现的恋人签名
   * - chosen/jealous: 头像博弈事件的即时覆盖
   */
  signatures: {
    life: string[] | Partial<Record<TimeBucket, string[]>>;
    feeling?: string[]; lover?: string[]; chosen?: string[]; jealous?: string[];
  };
  /** 她在睡眠时段收到消息时的迷糊回复（不分意图；空/无则已读不回） */
  asleep?: { wechat?: string[]; sms?: string[] };
  /** 约她且她答应后（亲密档），过一会儿她会主动发来的"后续"（确认/期待这次约） */
  inviteFollowup?: { wechat?: string[]; sms?: string[] };
  /** 事件角色反应（被设头像/别人被设/被冷落/主动找你/被错过…），中央引擎按角色取用 */
  reactions: {
    sweet?: string[]; reject?: string[]; flattered?: string[]; jealous?: string[];
    neglect?: string[]; ambient?: string[]; passedOver?: string[];
  };
  /** 联系人对话回复：玩家意图 × 好感层 → 她的回应（[] = 已读不回）。有人味、贴人设 */
  chat: Record<ChatChannel, Partial<Record<ChatIntent, Partial<Record<AffinityTier, ReplyCell>>>>>;
}

/** 配置 → Character（铺给 getCharacterById 等既有消费方） */
export function configToCharacter(cfg: WaifeConfig): Character {
  return {
    id: cfg.id,
    ...cfg.identity,
    dialogues: cfg.dialogues,
    interactions: cfg.interactions,
    effects: cfg.effects,
    phonePersonality: {
      wechatStyle: cfg.phone.wechatStyle,
      responseSpeed: cfg.phone.responseSpeed,
      commonPhrases: cfg.phone.commonPhrases,
      signature: cfg.phone.signature,
    },
  };
}
