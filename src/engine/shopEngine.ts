/**
 * 便利屋纯逻辑引擎（无 DOM/React 依赖）
 * 所有函数都是纯函数，可单独测试。
 */
import type { ServiceTag, GameLocation, Spot, ServiceCard, SpotDelta } from '@/data/types';
import type { Effect } from '@/engine/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';

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

/* ─────────────── 疲劳系统 ───────────────
 * 单一仪表替代旧的「时间 13 点 + 路段 1-5 + 精力 8」三时钟：
 * 内容数据（locations.json 等）仍用 time/energy 表达消耗，运行时统一折算成疲劳，
 * 旧内容无需迁移。一天的体力预算 ≈ 13×4 + 8×6 = 100。
 */
export const FATIGUE_MAX = 100;
/** 疲惫线：信任收益减半 */
export const FATIGUE_TIRED = 60;
/** 透支线：不能接新委托 */
export const FATIGUE_EXHAUSTED = 85;
const FATIGUE_PER_TIME = 4;
const FATIGUE_PER_ENERGY = 6;
/** 同一自然日内咖啡效果递减：-20 → -12 → -6 → 无效 */
export const COFFEE_RELIEFS = [20, 12, 6];
export const COFFEE_COST = 5;

/** 把内容数据的 time/energy 消耗折算成疲劳增量（正值 = 更累） */
export function fatigueFromDelta(d: { time?: number; energy?: number; fatigue?: number }): number {
  return (d.fatigue ?? 0) - (d.time ?? 0) * FATIGUE_PER_TIME - (d.energy ?? 0) * FATIGUE_PER_ENERGY;
}

/** 今天第 n+1 杯咖啡能缓解多少疲劳（0 = 喝不下了） */
export function coffeeRelief(n: number): number {
  return COFFEE_RELIEFS[n] ?? 0;
}

/* ─────────────── 角色养成 ───────────────
 * 养成与主循环挂钩：用她的卡干活、为她交付委托、重复抽到她，都会喂经验。
 * 升级解锁/强化她的 passive 特质（character.effects），让「培养」真正影响战力。
 */
/** 经验来源：人物卡命中匹配热点 / 命中不匹配热点 / 委托交付 / 重复抽到同一角色 */
export const EXP_HIT_MATCHED = 10;
export const EXP_HIT_PLAIN = 4;
export const EXP_DELIVERY = 60;
export const EXP_DUPE = 40;
/** 升一级所需经验（与 usePlayerStore.addExp 的自动升级同口径，避免两处漂移） */
export function expForLevel(level: number): number {
  return level * 100;
}
/** 等级里程碑：达到后该角色 passive 特质加成翻倍（「精通」，给升级一个明确目标） */
export const TRAIT_MILESTONE_LEVEL = 10;

/** 该角色 passive effect 的解锁等级（无 passive 返回 null）。passive 数据驱动特质加成。 */
export function personPassiveLevel(characterId: string): number | null {
  const passive = getCharacterById(characterId)?.effects.find(e => e.type === 'passive');
  return passive ? passive.level : null;
}

/** 在匹配热点上施加角色 passive 特质加成（effect 描述的兑现）。
 *  按 serviceType 给额外资源；达到里程碑等级后翻倍。直接修改传入的 delta。 */
function applyPersonTrait(delta: SpotDelta, serviceType: ServiceTag, level: number): void {
  const mult = level >= TRAIT_MILESTONE_LEVEL ? 2 : 1;
  if (serviceType === '表达' || serviceType === '宠物') {
    delta.rep = (delta.rep ?? 0) + 1 * mult;
  } else if (serviceType === '安抚') {
    delta.energy = (delta.energy ?? 0) + 1 * mult;
  } else if (serviceType === '补给') {
    delta.money = (delta.money ?? 0) + 2 * mult;
  } else if (serviceType === '流程' || serviceType === '情报') {
    // 减免行动成本：再 reduceCost 一次（里程碑则两次）
    for (let i = 0; i < mult; i++) Object.assign(delta, reduceCost(delta));
  }
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

/** 从地点列表随机取 count 个路线。
 *  mustTags：委托未完成子目标的 locTag——保底掷出至少一个匹配地点，
 *  消灭「接了单却一直刷不到目标地点」的纯运气墙。 */
export function rollRoutes(allLocations: GameLocation[], count = 3, mustTags: string[] = []): GameLocation[] {
  const shuffled = [...allLocations].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);
  if (mustTags.length > 0 && !picked.some(l => l.tags.some(t => mustTags.includes(t)))) {
    const candidate = shuffled.slice(count).find(l => l.tags.some(t => mustTags.includes(t)));
    if (candidate) picked[picked.length - 1] = candidate;
  }
  return picked;
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
 * lastCardType：上一个热点打出的卡类型；同类型连打且命中时触发连携（信任+1）。
 */
export function resolveSpot(
  spot: Spot,
  card: PlayedCard | null,
  lastCardType?: ServiceTag | null,
): { text: string; cls: 'good' | 'bad'; delta: SpotDelta; combo: boolean } {
  const res = resolveSpotBase(spot, card);
  if (card) {
    const cardType = card.kind === 'person' ? card.serviceType : card.type;
    if (lastCardType && cardType === lastCardType && isMatch(cardType, spot.need)) {
      res.delta.trust = (res.delta.trust ?? 0) + 1;
      return { ...res, combo: true };
    }
  }
  return { ...res, combo: false };
}

function resolveSpotBase(
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
      // 特质资源加成由角色 passive effect 驱动：达到 effect.level 激活，里程碑等级翻倍
      const passiveLv = personPassiveLevel(card.id);
      if (passiveLv !== null && card.level >= passiveLv) {
        applyPersonTrait(delta, card.serviceType, card.level);
      }
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

/* ─────────────── 子目标 / 顺手单命中判定（v1.4） ───────────────
 * 规则：在「匹配热点」上打出 type 命中要求的卡（万能卡视为命中一切），
 * 且地点带有要求的标签（未限定则任意地点）。
 */
export function hitsRequirement(
  req: { need: ServiceTag[]; locTag?: string },
  cardType: ServiceTag,
  spot: { need: ServiceTag[] },
  locTags: string[],
): boolean {
  if (!isMatch(cardType, spot.need)) return false;
  if (cardType !== '万能' && !req.need.includes(cardType)) return false;
  if (req.locTag && !locTags.includes(req.locTag)) return false;
  return true;
}

/* ─────────────── 手牌按身份聚合（展示用） ───────────────
 * 同种消耗卡（同 id）合并为一组，记 count 与代表实例 rep；保序、不改原数组。
 * 纯展示工具：消费仍用 rep 的 uid 走 consumeHandCard，一次只去掉一张。
 * 用泛型避免 engine 反向依赖 store 的 HandCard 类型。
 */
export interface CardGroup<T> { rep: T; count: number; }
export function groupHand<T extends { id: string }>(cards: T[]): CardGroup<T>[] {
  const byId = new Map<string, CardGroup<T>>();
  for (const c of cards) {
    const g = byId.get(c.id);
    if (g) g.count += 1;
    else byId.set(c.id, { rep: c, count: 1 });
  }
  return [...byId.values()];
}
