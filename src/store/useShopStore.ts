/**
 * 便利屋 · 局内状态（每日一局，非持久化，但可断点续局）
 * 持久资产（角色/灵石/票）仍在 usePlayerStore。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '@/lib/safeStorage';
import { commissions } from '@/data/commissions';
import type { Commission, GameLocation, ServiceCard, TheaterScene } from '@/data/types';
import { sideJobs as allSideJobs } from '@/data/sideJobs';
import { usePlayerStore } from '@/store/usePlayerStore';
import { locations as allLocations } from '@/data/locations';
import { rollRoutes } from '@/engine/shopEngine';

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
  time: number;
  energy: number;
  rep: number;
  money: number;
  trust: number;
  step: number;

  /* ── 进程 ── */
  commission: Commission | null;
  loc: GameLocation | null;
  routes: GameLocation[];
  /* ── 委托板（v1.4）── */
  /** 今日可接委托 id（含逾期单） */
  board: string[];
  /** 逾期委托：失败后次日可重接，最多拖 2 天 */
  overdue: { id: string; daysLeft: number } | null;
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

  /* ── Actions ── */
  startDay: () => void;
  refreshRoutes: () => void;
  acceptCommission: (id: string) => void;
  completeObjective: (objectiveId: string) => void;
  completeSideJob: (id: string) => void;
  setPendingScene: (scene: TheaterScene | null) => void;
  setOverdue: (o: { id: string; daysLeft: number } | null) => void;
  setCommission: (c: Commission) => void;
  chooseLocation: (loc: GameLocation) => void;
  /** 退回路线选择（不消耗路段，路线不重掷） */
  leaveLocation: () => void;
  addHandCard: (card: ServiceCard) => void;
  consumeHandCard: (uid: number) => void;
  applyDelta: (delta: Partial<{ time: number; energy: number; money: number; trust: number; rep: number }>) => void;
  markSpotDone: (locId: string, spotIndex: number) => void;
  finishLocation: () => 'continue' | 'end_day';
  normalAdvance: () => void;
  addLog: (text: string, cls?: LogEntry['cls']) => void;
  setGameOver: (over: boolean) => void;
  resetDay: () => void;
}

const INITIAL: Omit<ShopState, keyof { [K in keyof ShopState as ShopState[K] extends (...args: never[]) => unknown ? K : never]: unknown }> = {
  time: 13,
  energy: 8,
  rep: 5,
  money: 20,
  trust: 0,
  step: 1,
  commission: null,
  loc: null,
  routes: [],
  board: [],
  overdue: null,
  objectivesDone: [],
  sideJobs: [],
  pendingScene: null,
  done: {},
  hand: [],
  log: [],
  gameOver: false,
};

let _uid = 1;

/** 掷今日委托板：逾期单优先,其余从未完成的委托里随机补满 3 张 */
function rollBoard(overdue: { id: string; daysLeft: number } | null): string[] {
  const doneFlags = usePlayerStore.getState().flags;
  const isDone = (id: string) => doneFlags.includes(`commission_${id}_done`);
  const fresh = commissions.filter(c => !isDone(c.id) && c.id !== overdue?.id).map(c => c.id);
  const fallback = commissions.filter(c => isDone(c.id) && c.id !== overdue?.id).map(c => c.id);
  const shuffled = [...fresh].sort(() => Math.random() - 0.5);
  const board: string[] = overdue ? [overdue.id] : [];
  for (const id of shuffled) {
    if (board.length >= 3) break;
    board.push(id);
  }
  for (const id of [...fallback].sort(() => Math.random() - 0.5)) {
    if (board.length >= 3) break;
    board.push(id);
  }
  return board;
}

function rollSideJobs(): { id: string; done: boolean }[] {
  return [...allSideJobs].sort(() => Math.random() - 0.5).slice(0, 2).map(j => ({ id: j.id, done: false }));
}

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      startDay: () => {
        const routes = rollRoutes(allLocations);
        // 逾期单跨天衰减:每开新一天 daysLeft-1,归零作废
        const prevOverdue = get().overdue;
        const overdue = prevOverdue && prevOverdue.daysLeft > 1
          ? { ...prevOverdue, daysLeft: prevOverdue.daysLeft - 1 }
          : prevOverdue && prevOverdue.daysLeft === 1 ? prevOverdue : null;
        const board = rollBoard(overdue);
        set({ ...INITIAL, routes, overdue, board, sideJobs: rollSideJobs(), done: {}, hand: [], log: [], gameOver: false });
        get().addLog('开始营业:委托板已更新,顺手单已挂出。', 'good');
      },

      refreshRoutes: () => set({ routes: rollRoutes(allLocations) }),

      setCommission: (c) => set({ commission: c, trust: 0 }),

      acceptCommission: (id) => {
        const c = commissions.find(x => x.id === id);
        if (!c) return;
        const s0 = get();
        const isOverdue = s0.overdue?.id === id;
        set({
          commission: c,
          trust: 0,
          objectivesDone: [],
          board: s0.board.filter(b => b !== id),
          pendingScene: c.introScene ?? null,
          rep: isOverdue ? Math.max(0, s0.rep - 1) : s0.rep,
        });
        get().addLog(isOverdue
          ? `重接逾期委托【${c.name}】,口碑 -1。这次别再让她等了。`
          : `接下委托【${c.name}】。${c.desc}`, isOverdue ? 'bad' : 'good');
      },

      completeObjective: (objectiveId) => {
        const s0 = get();
        const obj = s0.commission?.objectives?.find(o => o.id === objectiveId);
        if (!obj || s0.objectivesDone.includes(objectiveId)) return;
        set({
          objectivesDone: [...s0.objectivesDone, objectiveId],
          trust: s0.trust + obj.trust,
          pendingScene: obj.scene,
        });
        get().addLog(`✅ 子目标完成:${obj.desc}。信任 +${obj.trust}。`, 'good');
      },

      completeSideJob: (id) => {
        const s0 = get();
        if (!s0.sideJobs.some(j => j.id === id && !j.done)) return;
        set({ sideJobs: s0.sideJobs.map(j => j.id === id ? { ...j, done: true } : j) });
      },

      setPendingScene: (scene) => set({ pendingScene: scene }),
      setOverdue: (o) => set({ overdue: o }),

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

      applyDelta: (delta) =>
        set(s => ({
          time: Math.max(0, s.time + (delta.time ?? 0)),
          energy: Math.max(0, s.energy + (delta.energy ?? 0)),
          money: Math.max(0, s.money + (delta.money ?? 0)),
          trust: Math.max(0, s.trust + (delta.trust ?? 0)),
          rep: Math.max(0, s.rep + (delta.rep ?? 0)),
        })),

      markSpotDone: (locId, spotIndex) =>
        set(s => ({
          done: {
            ...s.done,
            [locId]: { ...(s.done[locId] ?? {}), [spotIndex]: true },
          },
        })),

      finishLocation: () => {
        const s = get();
        const newStep = s.step + 1;
        const newTime = Math.max(0, s.time - 1);
        const newEnergy = Math.max(0, s.energy - 1);
        if (newStep > 5) {
          set({ step: newStep, time: newTime, energy: newEnergy, loc: null });
          return 'end_day';
        }
        set({
          step: newStep,
          time: newTime,
          energy: newEnergy,
          loc: null,
          routes: rollRoutes(allLocations),
        });
        get().addLog('离开当前地点，进入下一段路线。');
        return 'continue';
      },

      normalAdvance: () => {
        const s = get();
        if (!s.commission) {
          set(prev => ({
            time: Math.max(0, prev.time - 1),
            energy: Math.max(0, prev.energy - 1),
            money: prev.money + 2,
          }));
          get().addLog('普通跑腿：资金 +2，时间 -1，精力 -1。');
        } else {
          set(prev => ({
            time: Math.max(0, prev.time - 2),
            energy: Math.max(0, prev.energy - 1),
            trust: prev.trust + 1,
          }));
          get().addLog('普通推进：信任 +1，时间 -2，精力 -1。');
        }
      },

      addLog: (text, cls = '') =>
        set(s => ({ log: [{ text, cls: cls ?? '' }, ...s.log].slice(0, 30) as LogEntry[] })),

      setGameOver: (over) => set({ gameOver: over }),

      resetDay: () => {
        const routes = rollRoutes(allLocations);
        set({ ...INITIAL, routes });
      },
    }),
    {
      name: 'xiashan-shop-store',
      version: 2,
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
  for (const key of ['time', 'energy', 'rep', 'money', 'trust', 'step'] as const) {
    if (s[key] !== undefined && typeof s[key] !== 'number') return false;
  }
  return true;
}

/** 检查局内资源耗尽 → 返回是否失败 */
export function checkFail(s: Pick<ShopState, 'time' | 'energy' | 'rep'>): boolean {
  return s.time <= 0 || s.energy <= 0 || s.rep <= 0;
}
