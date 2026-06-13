/**
 * 角色收藏物品:她的表情/立绘,全靠刷主流程解锁(好感档位/信物/等级)。
 * 从角色现有资源 + 标准解锁阶梯生成,无需逐角色手写。解锁条件复用 conditionEngine。
 */
import type { Character } from '@/data/types';
import type { Condition } from '@/engine/types';

export type CollectibleKind = 'expr' | 'portrait';

export interface Collectible {
  id: string;
  kind: CollectibleKind;
  name: string;
  /** 图片资源路径 */
  asset: string;
  /** 解锁条件(空 = 拥有即解) */
  unlock: Condition[];
  /** 锁着时的指引:怎么刷到 */
  hint: string;
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

/** 生成该角色的收藏清单 */
export function getCollectibles(character: Character): Collectible[] {
  const id = character.id;
  const out: Collectible[] = [];

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

  return out;
}
