/**
 * 角色收藏物品:她的表情/立绘/剧情短篇,全靠刷主流程解锁(好感档位/信物/等级/关系阶段)。
 * 表情立绘从角色现有资源 + 标准解锁阶梯生成;CG 短篇来自 videos.json(按 id 前缀归属)。
 * 解锁条件复用 conditionEngine。
 */
import type { Character, ServiceTag } from '@/data/types';
import type { Condition } from '@/engine/types';
import { videos } from '@/data/videos';
import { characters } from '@/data/characters';
import content from '@/content/collectibles.json';

export type CollectibleKind = 'gift' | 'expr' | 'portrait' | 'cg';

export type CollectibleTier = 1 | 2 | 3;

/** 礼物卡的实际作用 */
export interface GiftEffect {
  /** 效果名（印在卡面上） */
  name: string;
  /** 生效的委托类型（= 该角色服务类型） */
  type: ServiceTag;
  /**
   * 效果种类：
   * - 'trust'（默认）：装备吃被动 + 委托/热点里动用一锤（必定完美 + 信任）
   * - 'autoLink'：在「理货」小游戏里动用，自动连消若干秒（不作用于委托）
   */
  kind?: 'trust' | 'autoLink';
  /** autoLink：自动连消持续秒数 */
  durationSec?: number;
  /** 装备时：匹配类型委托每次判定额外信任（trust 用） */
  passiveTrust: number;
  /** 动用时：必定「完美」并额外加的信任（trust 用） */
  activeBonus: number;
  passive: string;
  active: string;
}

export interface CollectibleViewer {
  title: string;
  image?: string;
  paragraphs: string[];
}

export interface Collectible {
  id: string;
  kind: CollectibleKind;
  name: string;
  /** 图片资源路径(缩略图) */
  asset: string;
  /** 解锁条件(空 = 拥有即解) */
  unlock: Condition[];
  /** 锁着时的指引:怎么刷到 */
  hint: string;
  /** 礼物层级:越高越私密 */
  tier?: CollectibleTier;
  /** 层级名 */
  tierName?: string;
  /** 礼物卡的实际作用（仅 kind==='gift'） */
  effect?: GiftEffect;
  /** 礼物氛围文案：寓意 / 私密度 */
  summary?: string;
  intimacy?: string;
  /** 解锁后点开可回看的图文详情 */
  viewer?: CollectibleViewer;
}

interface GiftConfig {
  id: string;
  name: string;
  asset: string;
  tier: CollectibleTier;
  summary: string;
  intimacy: string;
  effect: GiftEffect;
}

const giftContent = content as { gifts: Record<string, GiftConfig[]> };

const GIFT_TIER_UNLOCK_STAGE: Record<CollectibleTier, number> = {
  1: 1,
  2: 3,
  3: 5,
};

const GIFT_TIER_NAME: Record<CollectibleTier, string> = {
  1: '日常关照',
  2: '只给你的偏心',
  3: '贴身私物',
};

function giftHint(tier: CollectibleTier): string {
  const stage = GIFT_TIER_UNLOCK_STAGE[tier];
  if (tier === 1) return `关系到第 ${stage} 阶，她才会送出第一件礼物`;
  if (tier === 2) return `关系到第 ${stage} 阶，才会收到只给你的偏心`;
  return `关系到第 ${stage} 阶，才会交出贴身私物`;
}

/** 表情解锁阶梯(按好感档位) */
const EXPR_LADDER: { key: 'calm' | 'smile' | 'shy' | 'laugh' | 'cry' | 'angry'; name: string; affinity: number }[] = [
  { key: 'calm', name: '平静', affinity: 0 },
  { key: 'smile', name: '微笑', affinity: 20 },
  { key: 'shy', name: '害羞', affinity: 40 },
  { key: 'laugh', name: '大笑', affinity: 60 },
  { key: 'cry', name: '哭泣', affinity: 90 },
  { key: 'angry', name: '生气', affinity: 120 },
];

/** 把 CG 的解锁条件翻成一句"怎么刷到"的指引(不剧透内容) */
function cgHint(conds?: Condition[]): string {
  for (const c of conds ?? []) {
    if (c.type === 'relationship_stage') return c.minStage >= 5 ? '关系到满阶' : `关系到第 ${c.minStage} 阶`;
    if (c.type === 'flag_set') return '完成她的专属委托';
  }
  return '推进剧情解锁';
}

/** 生成该角色的收藏清单 */
export function getCollectibles(character: Character): Collectible[] {
  const id = character.id;
  const out: Collectible[] = [];

  // 专属礼物:按关系亲密度递进。一层=日常关照,二层=只给你的偏心,三层=贴身私物。
  // 渲染成 SSR 道具卡（GiftCard），效果可装备吃被动 + 委托里动用，不再走静态查看器。
  for (const gift of giftContent.gifts[id] ?? []) {
    const minStage = GIFT_TIER_UNLOCK_STAGE[gift.tier];
    const tierName = GIFT_TIER_NAME[gift.tier];
    out.push({
      id: `gift_${gift.id}`,
      kind: 'gift',
      name: gift.name,
      asset: gift.asset,
      unlock: [{ type: 'relationship_stage', characterId: id, minStage }],
      hint: giftHint(gift.tier),
      tier: gift.tier,
      tierName,
      effect: gift.effect,
      summary: gift.summary,
      intimacy: gift.intimacy,
    });
  }

  // 表情:按好感阶梯
  for (const e of EXPR_LADDER) {
    const asset = character.expressionUrls?.[e.key];
    if (!asset) continue;
    out.push({
      id: `expr_${e.key}`,
      kind: 'expr',
      name: e.name,
      asset,
      unlock: e.affinity > 0 ? [{ type: 'affinity', characterId: id, minValue: e.affinity }] : [],
      hint: e.affinity > 0 ? `好感到 ${e.affinity}` : '抽到她即可',
    });
  }

  // 立绘:初见(拥有即解) / 绽放(信物2张) / 专属场景(Lv.10)
  if (character.portraitUrl) {
    out.push({ id: 'portrait_default', kind: 'portrait', name: '初见立绘', asset: character.portraitUrl, unlock: [], hint: '抽到她即可' });
  }
  if (character.gachaPortraitUrl) {
    out.push({ id: 'portrait_gacha', kind: 'portrait', name: '绽放立绘', asset: character.gachaPortraitUrl, unlock: [{ type: 'dupes_at_least', characterId: id, minCount: 2 }], hint: '集到她的第 2 张卡' });
  }
  if (character.gachaBackgroundUrl) {
    out.push({ id: 'portrait_scene', kind: 'portrait', name: '专属场景', asset: character.gachaBackgroundUrl, unlock: [{ type: 'character_level', characterId: id, minLevel: 10 }], hint: '培养到 Lv.10' });
  }

  // CG 短篇:她的剧情影像(来自 videos.json,按 id 前缀 `{角色id}_` 归属;解锁条件沿用各自的)
  for (const v of videos) {
    if (!v.story || !v.id.startsWith(`${id}_`)) continue;
    const subtitle = v.title.includes('·') ? v.title.split('·').slice(1).join('·').trim() : v.title;
    out.push({
      id: `cg_${v.id}`,
      kind: 'cg',
      name: subtitle,
      asset: v.story.image ?? character.portraitUrl ?? '',
      unlock: v.unlockConditions ?? [],
      hint: cgHint(v.unlockConditions),
      viewer: { title: v.title, image: v.story.image, paragraphs: v.story.paragraphs },
    });
  }

  return out;
}

/* ────── 礼物卡全局检索（委托剧场据随身信物 id 反查效果/归属）────── */

export interface GiftCardInfo {
  /** 收藏物 id（gift_xxx），即随身信物存档键 */
  id: string;
  characterId: string;
  characterName: string;
  name: string;
  asset: string;
  tier: CollectibleTier;
  tierName: string;
  summary: string;
  intimacy: string;
  effect: GiftEffect;
  /** 解锁条件（关系阶段） */
  unlock: Condition[];
}

let GIFT_INDEX: Map<string, GiftCardInfo> | null = null;

function buildGiftIndex(): Map<string, GiftCardInfo> {
  const m = new Map<string, GiftCardInfo>();
  for (const [cid, gifts] of Object.entries(giftContent.gifts)) {
    const ch = characters.find((c) => c.id === cid);
    for (const g of gifts) {
      m.set(`gift_${g.id}`, {
        id: `gift_${g.id}`,
        characterId: cid,
        characterName: ch?.name ?? cid,
        name: g.name,
        asset: g.asset,
        tier: g.tier,
        tierName: GIFT_TIER_NAME[g.tier],
        summary: g.summary,
        intimacy: g.intimacy,
        effect: g.effect,
        unlock: [{ type: 'relationship_stage', characterId: cid, minStage: GIFT_TIER_UNLOCK_STAGE[g.tier] }],
      });
    }
  }
  return m;
}

export function getGiftCardById(collectibleId: string | null | undefined): GiftCardInfo | undefined {
  if (!collectibleId) return undefined;
  GIFT_INDEX ??= buildGiftIndex();
  return GIFT_INDEX.get(collectibleId);
}
