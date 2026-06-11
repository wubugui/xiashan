/**
 * 便利屋 · 局内状态（每日一局，非持久化，但可断点续局）
 * 持久资产（角色/灵石/票）仍在 usePlayerStore。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Commission, GameLocation, ServiceCard, Spot } from '@/data/types';
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
  /** locId → spotIndex → done */
  done: Record<string, Record<number, boolean>>;
  /** 手牌（技能/便利/情报，可消耗） */
  hand: HandCard[];
  log: LogEntry[];
  gameOver: boolean;

  /* ── Actions ── */
  startDay: () => void;
  refreshRoutes: () => void;
  setCommission: (c: Commission) => void;
  chooseLocation: (loc: GameLocation) => void;
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
  done: {},
  hand: [],
  log: [],
  gameOver: false,
};

let _uid = 1;

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      startDay: () => {
        const routes = rollRoutes(allLocations);
        set({ ...INITIAL, routes, done: {}, hand: [], log: [], gameOver: false });
        get().addLog('开始营业：委托、人脉、技能、便利、情报各有不同价值。', 'good');
      },

      refreshRoutes: () => set({ routes: rollRoutes(allLocations) }),

      setCommission: (c) => set({ commission: c, trust: 0 }),

      chooseLocation: (loc) =>
        set(s => ({
          loc,
          done: { ...s.done, [loc.id]: s.done[loc.id] ?? {} },
        })),

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
    { name: 'xiashan-shop-store' }
  )
);

/** 检查局内资源耗尽 → 返回是否失败 */
export function checkFail(s: Pick<ShopState, 'time' | 'energy' | 'rep'>): boolean {
  return s.time <= 0 || s.energy <= 0 || s.rep <= 0;
}
