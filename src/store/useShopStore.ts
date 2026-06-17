/**
 * 便利屋 · 局内状态（每日一局，非持久化，但可断点续局）
 * 持久资产（角色/月光/票）仍在 usePlayerStore。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '@/lib/safeStorage';
import { commissions } from '@/data/commissions';
import type { Commission, GameLocation, ServiceCard, ServiceTag, TheaterScene } from '@/data/types';
import { sideJobs as allSideJobs } from '@/data/sideJobs';
import { usePlayerStore } from '@/store/usePlayerStore';
import { locations as allLocations } from '@/data/locations';
import { getCharacterById } from '@/data/characters';
import {
  rollRoutes, fatigueFromDelta, coffeeRelief,
  FATIGUE_MAX, FATIGUE_TIRED, FATIGUE_EXHAUSTED, COFFEE_COST,
} from '@/engine/shopEngine';
import { COLD_DAYS } from '@/engine/gachaEngine';
import { allServiceCards } from '@/data/serviceCards';
import {
  TUTORIAL_DECK, TUTORIAL_SIDE_JOB, TUTORIAL_ROUTES_EARLY, TUTORIAL_ROUTES_LATE,
} from '@/lib/tutorialFlow';

export interface HandCard extends ServiceCard {
  /** 唯一实例 id，用于消耗时精准移除 */
  uid: number;
}

export interface LogEntry {
  text: string;
  cls: 'good' | 'bad' | 'draw' | 'play' | '';
}

interface ShopState {
  /* ── 局内资源 ── */
  /** 疲劳（0-100）：唯一的体力仪表。60+ 疲惫（信任减半），85+ 透支（接不了新单），100 强制打烊 */
  fatigue: number;
  rep: number;
  money: number;
  trust: number;
  /** 今日咖啡杯数（同一自然日内效果递减） */
  coffees: { date: string; n: number };

  /* ── 进程 ── */
  /** 当前接取的委托：锁单制——永不过期、进度跨天保留，只能交付或主动放弃 */
  commission: Commission | null;
  /** 是否为回访单（该委托已完成过且重接）：剧场走精简模式、奖励递减 */
  isRevisit: boolean;
  loc: GameLocation | null;
  routes: GameLocation[];
  /* ── 委托板（v1.4）── */
  /** 今日可接委托 id */
  board: string[];
  /** 已完成子目标 id */
  objectivesDone: string[];
  /** 今日顺手单 */
  sideJobs: { id: string; done: boolean }[];
  /** 待播放的剧场分幕（接单开场/子目标完成时入队） */
  pendingScene: TheaterScene | null;
  /** locId → spotIndex → done */
  done: Record<string, Record<number, boolean>>;
  /** 手牌（技能/便利/情报，可消耗） */
  hand: HandCard[];
  log: LogEntry[];
  gameOver: boolean;
  /** 上一个热点打出的卡类型（连携判定用，跨地点保留、当日有效） */
  lastCardType: ServiceTag | null;
  /** 今日已读浏览器情报的委托 id：接单时初始信任 +2 */
  intel: string[];
  /** 连续未推进委托子目标的行动次数（攒到 3 次触发委托人手机轻催促） */
  offTask: number;

  /* ── Actions ── */
  startDay: () => void;
  /** 新手引导开局：清空局内状态 + 固定路线/委托板/顺手单/卡组（确定性流程，禁止随机） */
  startTutorialDay: () => void;
  refreshRoutes: () => void;
  acceptCommission: (id: string) => void;
  /** 主动放弃当前委托：唯一的委托失败途径，按目标角色稀有度/持有分层惩罚 */
  abandonCommission: () => void;
  /** 委托了结（交付成功或收尾失败后）：清空委托槽位 */
  clearCommission: () => void;
  completeObjective: (objectiveId: string) => void;
  completeSideJob: (id: string) => void;
  setPendingScene: (scene: TheaterScene | null) => void;
  setCommission: (c: Commission) => void;
  chooseLocation: (loc: GameLocation) => void;
  /** 退回路线选择（不消耗路段，路线不重掷） */
  leaveLocation: () => void;
  addHandCard: (card: ServiceCard) => void;
  consumeHandCard: (uid: number) => void;
  setLastCardType: (t: ServiceTag | null) => void;
  grantIntel: (commissionId: string) => void;
  /** 资源增减：内容数据中的 time/energy 消耗自动折算为疲劳 */
  applyDelta: (delta: Partial<{ time: number; energy: number; fatigue: number; money: number; trust: number; rep: number }>) => void;
  markSpotDone: (locId: string, spotIndex: number) => void;
  finishLocation: () => void;
  /** 买咖啡缓解疲劳（同一自然日递减），返回本杯缓解量（0 = 今天喝不下了/钱不够） */
  buyCoffee: () => number;
  /** 热点结算后记录本次行动是否推进了委托子目标（驱动手机轻催促） */
  noteCommissionFocus: (hit: boolean) => void;
  addLog: (text: string, cls?: LogEntry['cls']) => void;
  setGameOver: (over: boolean) => void;
  resetDay: () => void;
}

const INITIAL: Omit<ShopState, keyof { [K in keyof ShopState as ShopState[K] extends (...args: never[]) => unknown ? K : never]: unknown }> = {
  fatigue: 0,
  rep: 5,
  money: 20,
  trust: 0,
  coffees: { date: '', n: 0 },
  commission: null,
  isRevisit: false,
  loc: null,
  routes: [],
  board: [],
  objectivesDone: [],
  sideJobs: [],
  pendingScene: null,
  done: {},
  hand: [],
  log: [],
  gameOver: false,
  lastCardType: null,
  intel: [],
  offTask: 0,
};

let _uid = 1;

/** 委托板稀有度权重：目标手感 ≈ SSR 20% · SR 25% · R 55%（非SSR 共 80%，R 比 SR 常见）。
 *  委托稀有度已与角色稀有度对齐（见 commissions.json / characters.json）。调这里即可改手感。 */
const BOARD_RARITY_WEIGHT: Record<string, number> = { N: 1, R: 1, SR: 0.9, SSR: 0.7 };

/** 按权重洗牌：Efraimidis-Spirakis 加权随机（key = random^(1/weight)，取 key 最大者）。 */
function weightedShuffle(ids: string[]): string[] {
  const weightOf = (id: string) =>
    BOARD_RARITY_WEIGHT[commissions.find(c => c.id === id)?.rarity ?? 'SR'] ?? 2.5;
  return ids
    .map(id => ({ id, key: Math.pow(Math.random(), 1 / weightOf(id)) }))
    .sort((a, b) => b.key - a.key)
    .map(x => x.id);
}

/** 掷今日委托板：未完成的委托优先按稀有度加权补满 3 张，余位用已完成的回访单填充。
 *  冷淡期角色（被放弃过委托）的单不上板——她暂时不想见你。
 *  兜底：若冷淡期把所有人都筛没了，放宽冷淡限制，保证委托板永远有单可接——否则一直放弃会把板刷空、游戏锁死。 */
function rollBoard(forced: string[] = [], excludeId?: string): string[] {
  const player = usePlayerStore.getState();
  const isDone = (id: string) => player.flags.includes(`commission_${id}_done`);
  const today = new Date().toISOString().slice(0, 10);
  const isCold = (c: { target: string }) => (player.coldUntil[c.target] ?? '') >= today;
  const board: string[] = [...forced.filter(f => !isDone(f))];
  const excluded = new Set(forced);
  // 进行中的委托不再上板（否则看着像「没刷新」，还会重复接）
  if (excludeId) excluded.add(excludeId);

  // 用给定委托池补满空位：未完成的按稀有度加权优先，余位用已完成的回访单填充
  const fill = (pool: typeof commissions) => {
    const fresh = pool.filter(c => !isDone(c.id)).map(c => c.id);
    const revisit = pool.filter(c => isDone(c.id)).map(c => c.id);
    for (const id of weightedShuffle(fresh)) { if (board.length >= 3) return; board.push(id); }
    for (const id of weightedShuffle(revisit)) { if (board.length >= 3) return; board.push(id); }
  };

  // 正常池：排除进行中/forced + 冷淡期角色
  fill(commissions.filter(c => !excluded.has(c.id) && !isCold(c)));
  // 兜底：正常池被冷淡期清空时，忽略冷淡再补一次——总有人需要你，永远不锁死
  if (board.length === 0) fill(commissions.filter(c => !excluded.has(c.id)));
  return board;
}

function rollSideJobs(): { id: string; done: boolean }[] {
  return [...allSideJobs].sort(() => Math.random() - 0.5).slice(0, 2).map(j => ({ id: j.id, done: false }));
}

/** 当前委托还差的子目标限定地点标签（路线保底掷取用） */
function pendingLocTags(commission: Commission | null, objectivesDone: string[]): string[] {
  if (!commission?.objectives) return [];
  return commission.objectives
    .filter(o => !objectivesDone.includes(o.id) && o.locTag)
    .map(o => o.locTag!);
}

/** 新手引导是否进行中（引导期内路线/委托板/顺手单全部固定） */
function isTutorialActive(): boolean {
  return usePlayerStore.getState().tutorialStep > 0;
}

/** 教学固定路线：补登记完成前后两套（后半段把她等你的天台掷出来） */
function tutorialRoutes(objectivesDone: string[]): GameLocation[] {
  const ids = objectivesDone.includes('register') ? TUTORIAL_ROUTES_LATE : TUTORIAL_ROUTES_EARLY;
  return ids
    .map(id => allLocations.find(l => l.id === id))
    .filter((l): l is GameLocation => !!l);
}

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      startDay: () => {
        const s0 = get();
        const tutorial = isTutorialActive();
        const routes = tutorial
          ? tutorialRoutes(s0.objectivesDone)
          : rollRoutes(allLocations, 3, pendingLocTags(s0.commission, s0.objectivesDone));
        // 引导期委托板只挂「面试」一单，顺手单只挂教学单（流程确定性）
        const board = tutorial ? (s0.commission ? [] : ['interview']) : rollBoard([], s0.commission?.id);
        const sideJobs = tutorial
          ? (s0.sideJobs.length ? s0.sideJobs : [{ id: TUTORIAL_SIDE_JOB, done: false }])
          : rollSideJobs();
        // 跨天保留：手牌（持有资产）+ 进行中委托（锁单制：进度不清零，干不完明天继续）
        // 咖啡杯数挂真实自然日，休息不重置（防「打烊刷咖啡」）
        set({
          ...INITIAL, routes, board, sideJobs, done: {},
          hand: s0.hand, log: [], gameOver: false,
          coffees: s0.coffees,
          commission: s0.commission, isRevisit: s0.isRevisit,
          trust: s0.commission ? s0.trust : 0,
          objectivesDone: s0.commission ? s0.objectivesDone : [],
        });
        if (s0.commission) {
          get().addLog(`开始营业。委托【${s0.commission.name}】进度已保留——接着为她奔走吧。`, 'good');
        } else {
          get().addLog('开始营业:委托板已更新,顺手单已挂出。', 'good');
        }
      },

      startTutorialDay: () => {
        const hand = TUTORIAL_DECK
          .map(id => allServiceCards.find(c => c.id === id))
          .filter((c): c is ServiceCard => !!c)
          .map(c => ({ ...c, uid: _uid++ }));
        set({
          ...INITIAL,
          routes: tutorialRoutes([]),
          board: ['interview'],
          sideJobs: [{ id: TUTORIAL_SIDE_JOB, done: false }],
          hand,
        });
        get().addLog('深夜开张:江夏会全程带你跑完第一单。', 'good');
      },

      refreshRoutes: () => set(s => ({
        routes: isTutorialActive()
          ? tutorialRoutes(s.objectivesDone)
          : rollRoutes(allLocations, 3, pendingLocTags(s.commission, s.objectivesDone)),
      })),

      setCommission: (c) => set({ commission: c, isRevisit: false, trust: 0, objectivesDone: [] }),

      acceptCommission: (id) => {
        const c = commissions.find(x => x.id === id);
        if (!c) return;
        const s0 = get();
        if (s0.commission) return; // 锁单制：先了结手上的委托
        if (s0.fatigue >= FATIGUE_EXHAUSTED) {
          get().addLog('🥴 你已经累得睁不开眼，没法对新委托负责——先休息吧。', 'bad');
          return;
        }
        const hasIntel = s0.intel.includes(id);
        // 回访单：该委托已完成过——精简剧场（不播开场/子目标幕），奖励递减
        const isRevisit = usePlayerStore.getState().flags.includes(`commission_${id}_done`);
        set({
          commission: c,
          isRevisit,
          trust: hasIntel ? 2 : 0,
          objectivesDone: [],
          board: s0.board.filter(b => b !== id),
          pendingScene: isRevisit ? null : (c.introScene ?? null),
        });
        get().addLog(isRevisit
          ? `接下回访单【${c.name}】。她又想起了你——这次轻车熟路。`
          : `接下委托【${c.name}】。${c.desc}`, 'good');
        if (hasIntel) get().addLog('📰 你看过今早的新闻，对情况心里有数。初始信任 +2。', 'good');
      },

      abandonCommission: () => {
        const s0 = get();
        const c = s0.commission;
        if (!c) return;
        const player = usePlayerStore.getState();
        const owned = player.ownedCharacters.some(o => o.characterId === c.target);
        const rare = c.rarity === 'SR' || c.rarity === 'SSR';
        set({ commission: null, isRevisit: false, trust: 0, objectivesDone: [], pendingScene: null });
        get().addLog(`你放弃了委托【${c.name}】。`, 'bad');
        if (owned) {
          // 已拥有：直接打感情线，冷淡期内回访单不上板
          player.addAffinity(c.target, -5);
          player.setCharacterCold(c.target, COLD_DAYS);
          get().addLog(`她知道了。好感 -5，接下来 ${COLD_DAYS} 天她不会再发委托给你。`, 'bad');
        } else if (rare) {
          // 未拥有的稀有角色：冷淡 DOWN——一段时间内更难在补给池遇到她
          player.setCharacterCold(c.target, COLD_DAYS);
          get().addLog(`消息传开了。接下来 ${COLD_DAYS} 天，你更难遇到她（出现率下降）。`, 'bad');
        } else {
          set(prev => ({ rep: Math.max(0, prev.rep - 1) }));
          get().addLog('放了客人鸽子，口碑 -1。', 'bad');
        }
        // 放弃后重掷委托板：被放弃的人(已进冷淡)不再上板，换一批新委托
        if (!isTutorialActive()) {
          set({ board: rollBoard() });
          get().addLog('委托板已重新刷新——换一批人来找你。', '');
        }
      },

      clearCommission: () =>
        set({ commission: null, isRevisit: false, trust: 0, objectivesDone: [], pendingScene: null }),

      completeObjective: (objectiveId) => {
        const s0 = get();
        const obj = s0.commission?.objectives?.find(o => o.id === objectiveId);
        if (!obj || s0.objectivesDone.includes(objectiveId)) return;
        set({
          objectivesDone: [...s0.objectivesDone, objectiveId],
          trust: s0.trust + obj.trust,
          // 回访单精简模式：子目标不重播剧场幕
          pendingScene: s0.isRevisit ? s0.pendingScene : obj.scene,
        });
        get().addLog(`✅ 子目标完成:${obj.desc}。信任 +${obj.trust}。`, 'good');
      },

      completeSideJob: (id) => {
        const s0 = get();
        if (!s0.sideJobs.some(j => j.id === id && !j.done)) return;
        set({ sideJobs: s0.sideJobs.map(j => j.id === id ? { ...j, done: true } : j) });
      },

      setPendingScene: (scene) => set({ pendingScene: scene }),

      chooseLocation: (loc) =>
        set(s => ({
          loc,
          done: { ...s.done, [loc.id]: s.done[loc.id] ?? {} },
        })),

      leaveLocation: () => set({ loc: null }),

      addHandCard: (card) =>
        set(s => ({ hand: [...s.hand, { ...card, uid: _uid++ }] })),

      consumeHandCard: (uid) =>
        set(s => ({ hand: s.hand.filter(c => c.uid !== uid) })),

      setLastCardType: (t) => set({ lastCardType: t }),

      grantIntel: (commissionId) =>
        set(s => ({ intel: s.intel.includes(commissionId) ? s.intel : [...s.intel, commissionId] })),

      applyDelta: (delta) => {
        const before = get().fatigue;
        const after = Math.min(FATIGUE_MAX, Math.max(0, before + fatigueFromDelta(delta)));
        set(s => ({
          fatigue: after,
          money: Math.max(0, s.money + (delta.money ?? 0)),
          trust: Math.max(0, s.trust + (delta.trust ?? 0)),
          rep: Math.max(0, s.rep + (delta.rep ?? 0)),
        }));
        // 跨过疲劳阈值时给一次叙事提示（软惩罚要让玩家知道发生了什么）
        if (before < FATIGUE_TIRED && after >= FATIGUE_TIRED) {
          get().addLog('😮‍💨 你开始觉得累了——疲惫状态：信任收益减半。来杯咖啡，或者早点打烊。', 'bad');
        }
        if (before < FATIGUE_EXHAUSTED && after >= FATIGUE_EXHAUSTED) {
          get().addLog('🥴 强弩之末——透支状态：接不了新委托了。再硬撑就要累垮。', 'bad');
        }
      },

      markSpotDone: (locId, spotIndex) =>
        set(s => ({
          done: {
            ...s.done,
            [locId]: { ...(s.done[locId] ?? {}), [spotIndex]: true },
          },
        })),

      finishLocation: () => {
        const s = get();
        set({
          loc: null,
          routes: isTutorialActive()
            ? tutorialRoutes(s.objectivesDone)
            : rollRoutes(allLocations, 3, pendingLocTags(s.commission, s.objectivesDone)),
        });
        get().applyDelta({ fatigue: 10 });
        get().addLog('离开当前地点，进入下一段路线。疲劳 +10。');
      },

      buyCoffee: () => {
        const s = get();
        const today = new Date().toISOString().slice(0, 10);
        const n = s.coffees.date === today ? s.coffees.n : 0;
        const relief = coffeeRelief(n);
        if (relief === 0 || s.money < COFFEE_COST) return 0;
        set(prev => ({
          money: prev.money - COFFEE_COST,
          fatigue: Math.max(0, prev.fatigue - relief),
          coffees: { date: today, n: n + 1 },
        }));
        const next = coffeeRelief(n + 1);
        get().addLog(`☕ 买咖啡：疲劳 -${relief}，资金 -${COFFEE_COST}。${next > 0 ? `（再喝效果会变差：下一杯 -${next}）` : '（今天喝到头了，再喝只剩心悸）'}`, 'good');
        return relief;
      },

      noteCommissionFocus: (hit) => {
        const s0 = get();
        const c = s0.commission;
        // 没有子目标的委托不催（任何热点都算在为她攒信任）
        if (!c || !c.objectives?.length) return;
        if (hit) {
          if (s0.offTask !== 0) set({ offTask: 0 });
          return;
        }
        const n = s0.offTask + 1;
        if (n < 3) {
          set({ offTask: n });
          return;
        }
        set({ offTask: 0 });
        // 轻催促：纯叙事提醒，不扣数值；每委托每自然日最多一次
        const player = usePlayerStore.getState();
        if (!player.tryDailyAction(`nudge:${c.id}`)) return;
        const clientId = c.client ?? c.target;
        const who = getCharacterById(clientId)?.name ?? '她';
        player.addPhoneMessage({
          id: `nudge_${c.id}_${Date.now()}`,
          characterId: clientId,
          type: 'wechat',
          content: '那个……不着急的！就是想问问，事情还顺利吗？我在的，随时找我。',
          timestamp: Date.now(),
          read: false,
        });
        get().addLog(`📱 ${who}发来消息，小心翼翼地问起委托【${c.name}】的进展——她在等你。`, '');
      },

      addLog: (text, cls = '') =>
        set(s => ({ log: [{ text, cls: cls ?? '' }, ...s.log].slice(0, 30) as LogEntry[] })),

      setGameOver: (over) => set({ gameOver: over }),

      // 与 startDay 同口径：委托板/顺手单每天必须重掷，否则次日板上无单可接
      // 打烊→新的一天：推进游戏天 + 清空每日限频（推进关系/聊天好感/互动等重置），再起新局
      resetDay: () => { usePlayerStore.getState().advanceGameDay(); get().startDay(); },
    }),
    {
      name: 'xiashan-shop-store',
      version: 4,
      storage: createJSONStorage(() => safeStorage),
      // 局内存档是当天一局的断点，跨版本恢复价值低、风险高（整对象快照随内容结构漂移）。
      // 旧版本（version < 1）一律作废重开一天。
      migrate: () => ({ ...INITIAL }),
      // 即使版本一致，恢复前也校验结构：损坏的存档宁可丢弃，不能让 Shop 渲染崩溃。
      merge: (persisted, current) => {
        if (!isValidShopSnapshot(persisted)) return current;
        const snapshot = { ...(persisted as Partial<ShopState>) };
        if (snapshot.commission) {
          snapshot.commission = commissions.find((c) => c.id === snapshot.commission?.id) ?? null;
        }
        const latestLocation = (loc: GameLocation | null | undefined) =>
          loc ? (allLocations.find((l) => l.id === loc.id) ?? loc) : null;
        snapshot.loc = latestLocation(snapshot.loc);
        if (snapshot.routes) {
          snapshot.routes = snapshot.routes
            .map(latestLocation)
            .filter((loc): loc is GameLocation => !!loc);
        }
        return { ...current, ...snapshot };
      },
    }
  )
);

function isValidShopSnapshot(p: unknown): boolean {
  if (!p || typeof p !== 'object') return false;
  const s = p as Record<string, unknown>;
  const isLoc = (l: unknown) =>
    !!l && typeof l === 'object' && Array.isArray((l as { spots?: unknown }).spots);
  if (s.routes !== undefined && (!Array.isArray(s.routes) || !s.routes.every(isLoc))) return false;
  if (s.loc !== undefined && s.loc !== null && !isLoc(s.loc)) return false;
  if (s.hand !== undefined && !Array.isArray(s.hand)) return false;
  if (s.log !== undefined && !Array.isArray(s.log)) return false;
  if (s.board !== undefined && (!Array.isArray(s.board) || !s.board.every(b => typeof b === 'string'))) return false;
  if (s.objectivesDone !== undefined && !Array.isArray(s.objectivesDone)) return false;
  if (s.sideJobs !== undefined && !Array.isArray(s.sideJobs)) return false;
  if (s.commission !== undefined && s.commission !== null) {
    const c = s.commission as Record<string, unknown>;
    if (typeof c.need !== 'number' || typeof c.id !== 'string') return false;
  }
  for (const key of ['fatigue', 'rep', 'money', 'trust'] as const) {
    if (s[key] !== undefined && typeof s[key] !== 'number') return false;
  }
  return true;
}

/** 检查局内资源耗尽 → 返回是否被迫打烊（疲劳爆表或口碑见底） */
export function checkFail(s: Pick<ShopState, 'fatigue' | 'rep'>): boolean {
  return s.fatigue >= FATIGUE_MAX || s.rep <= 0;
}
