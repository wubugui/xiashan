/**
 * 便利屋纯逻辑引擎（无 DOM/React 依赖）
 * 所有函数都是纯函数，可单独测试。
 */
import type { ServiceTag, GameLocation, Spot, ServiceCard, SpotDelta, Commission } from '@/data/types';
import type { Effect } from '@/engine/types';
import { usePlayerStore } from '@/store/usePlayerStore';

/* ─────────────── 匹配系统 ─────────────── */

/** 卡牌类型是否匹配热点需求 */
export function isMatch(cardType: ServiceTag, spotNeeds: ServiceTag[]): boolean {
  return cardType === '万能' || spotNeeds.includes(cardType);
}

/** 卡牌排序权重（高 = 更优先显示） */
export function scoreCard(cardType: ServiceTag, spotNeeds: ServiceTag[]): number {
  if (cardType === '万能') return 100;
  return isMatch(cardType, spotNeeds) ? 10 : 0;
}

/* ─────────────── 资源增减 ─────────────── */

/** 匹配时降低资源消耗（负值 +1，不超过 0） */
export function reduceCost(eff: SpotDelta): SpotDelta {
  const r = { ...eff };
  if ((r.time ?? 0) < 0) r.time = Math.min(0, (r.time ?? 0) + 1);
  if ((r.energy ?? 0) < 0) r.energy = Math.min(0, (r.energy ?? 0) + 1);
  if ((r.rep ?? 0) < 0) r.rep = 0;
  if ((r.money ?? 0) < 0) r.money = Math.min(0, (r.money ?? 0) + 1);
  return r;
}

/* ─────────────── 随机工具 ─────────────── */

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 从地点列表随机取 count 个路线 */
export function rollRoutes(allLocations: GameLocation[], count = 3): GameLocation[] {
  return [...allLocations].sort(() => Math.random() - 0.5).slice(0, count);
}

/* ─────────────── 事件结算 ─────────────── */

export type PersonCard = {
  kind: 'person';
  id: string;
  name: string;
  serviceType: ServiceTag;
  level: number;
};

export type PlayedCard = (ServiceCard & { uid: number }) | PersonCard;

/**
 * 结算一次热点事件，返回文字描述 + 日志样式 + 资源增减。
 * 纯函数，不修改任何状态。
 */
export function resolveSpot(
  spot: Spot,
  card: PlayedCard | null,
): { text: string; cls: 'good' | 'bad'; delta: SpotDelta } {
  let delta: SpotDelta = { ...spot.base };
  let text = `${spot.name}：${spot.text}`;
  const baseCls: 'good' | 'bad' = spot.type === 'danger' ? 'bad' : 'good';

  if (!card) {
    return { text, cls: baseCls, delta };
  }

  /* ── 人物卡 ── */
  if (card.kind === 'person') {
    const matched = isMatch(card.serviceType, spot.need);
    const bonus = Math.max(0, card.level - 1);
    if (matched) {
      delta = reduceCost(delta);
      delta.trust = (delta.trust ?? 0) + 3 + bonus;
      if (card.serviceType === '表达' || card.serviceType === '宠物') delta.rep = (delta.rep ?? 0) + 1;
      if (card.serviceType === '补给') delta.money = (delta.money ?? 0) + 2;
      if (card.serviceType === '安抚') delta.energy = (delta.energy ?? 0) + 1;
      const specialText = spot.special?.[card.id];
      text = specialText ?? `${card.name}用自己的专长处理了这个麻烦。`;
    } else {
      delta.trust = (delta.trust ?? 0) + 1;
      text = `${card.name}不是最优解，但仍然帮你补了一点进度。`;
    }
    return { text, cls: 'good', delta };
  }

  /* ── 技能卡 ── */
  if (card.kind === 'skill') {
    const matched = isMatch(card.type, spot.need);
    if (matched) {
      delta = reduceCost(delta);
      delta.trust = (delta.trust ?? 0) + 3;
      if (card.type === '维修') delta.rep = Math.max(0, delta.rep ?? 0);
      if (card.type === '技术') delta.time = Math.max(0, delta.time ?? 0);
      if (card.type === '安抚') delta.energy = (delta.energy ?? 0) + 1;
      if (card.type === '宠物') delta.trust = (delta.trust ?? 0) + 1;
      text = `打出【${card.name}】，快速解决麻烦。`;
    } else {
      delta.trust = (delta.trust ?? 0) + 1;
      text = `打出【${card.name}】，不完全对口但有帮助。`;
    }
    return { text, cls: 'good', delta };
  }

  /* ── 便利卡 ── */
  if (card.kind === 'tool') {
    if (card.name === '临时人脉电话') {
      delta = reduceCost(delta);
      delta.trust = (delta.trust ?? 0) + 5;
      delta.rep = (delta.rep ?? 0) + 1;
      text = '打出【临时人脉电话】，对方态度立刻变了：抱歉，是我们流程有误。';
    } else if (card.name === '共享单车') {
      delta.time = (delta.time ?? 0) + 1;
      delta.trust = (delta.trust ?? 0) + 1;
      text = '打出【共享单车】，节省大量跑腿时间。';
    } else if (card.name === '咖啡券') {
      delta.energy = (delta.energy ?? 0) + 3;
      text = '打出【咖啡券】，强行撑过这段杂事。';
    }
    return { text, cls: 'good', delta };
  }

  /* ── 情报卡 ── */
  if (card.kind === 'info') {
    if (card.name === '热点提示') {
      delta = reduceCost(delta);
      delta.trust = (delta.trust ?? 0) + 2;
      text = '打出【热点提示】，提前找到了关键点。';
    } else if (card.name === '风险预警') {
      delta = reduceCost(delta);
      delta.rep = Math.max(0, delta.rep ?? 0);
      text = '打出【风险预警】，避免了最差后果。';
    } else if (card.name === '城市情报') {
      delta.trust = (delta.trust ?? 0) + 1;
      text = '打出【城市情报】，刷新路线并确认推荐卡型。';
    }
    return { text, cls: 'good', delta };
  }

  return { text, cls: baseCls, delta };
}

/* ─────────────── 委托完成结算 ─────────────── */

/**
 * 把委托的 rewardEffects 直接写入 usePlayerStore。
 * 在 Shop.tsx 中于 endDay 时调用。
 */
export function applyCommissionRewards(effects: Effect[]): void {
  const store = usePlayerStore.getState();
  for (const eff of effects) {
    switch (eff.type) {
      case 'add_spirit_stones': store.addSpiritStones(eff.value); break;
      case 'add_reputation': store.addReputation(eff.value); break;
      case 'add_affinity': store.addAffinity(eff.characterId, eff.value); break;
      case 'add_exp': store.addExp(eff.characterId, eff.value); break;
      case 'set_flag': store.setFlag(eff.flag); break;
    }
  }
}
