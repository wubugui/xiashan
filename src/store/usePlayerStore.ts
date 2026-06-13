import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '@/lib/safeStorage';
import { getCharacterById } from '@/data/characters';
import { surplusCards, SHARD_VALUE, MAX_STAGE, type Rarity } from '@/engine/bondEngine';

interface OwnedCharacter {
  characterId: string;
  level: number;
  exp: number;
}

interface PhoneMessage {
  id: string;
  characterId: string;
  type: 'wechat' | 'sms';
  content: string;
  timestamp: number;
  read: boolean;
}

interface PhoneCallLog {
  characterId: string;
  type: 'incoming' | 'outgoing' | 'missed';
  duration: number;
  timestamp: number;
}

interface GachaHistoryEntry {
  characterId: string;
  rarity: string;
  timestamp: number;
}

const DEFAULT_TUTORIAL_STEP = import.meta.env.DEV ? -1 : 0;

/** N 个自然日后的日期（'YYYY-MM-DD'），用于缘分 UP / 冷淡的限时计时 */
function dateAfterDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface PlayerState {
  // Tutorial
  /** -1 = 已完成，0 = 未开始，1..N = 进行中（N 见 tutorialFlow.TUTORIAL_TOTAL，强制锁定式引导） */
  tutorialStep: number;
  setTutorialStep: (n: number) => void;

  // Resources
  spiritStones: number;
  reputation: number;
  // Gacha tickets (便利屋系统)
  normalTickets: number;
  /** 统一补给池保底计数（抽到人物时清零） */
  supplyPityCounter: number;
  /** 消消乐提示券（补给池可抽，免费次数用完后消耗） */
  hintTokens: number;
  /** 消消乐当日免费提示使用记录 */
  freeHints: { date: string; used: number };

  // Story progress
  currentChapterId: number;
  currentNodeId: string;
  completedNodes: string[];
  flags: string[];

  // Characters
  ownedCharacters: OwnedCharacter[];
  // 好感独立于持有：未抽到也能积累，抽到后才解锁养成内容（设计文档 6.3）
  affinityMap: Record<string, number>;
  relationshipStages: Record<string, number>;
  // 每日限频记录：key（如 interact:touch:linxia / stage:linxia）→ 'YYYY-MM-DD'
  dailyActions: Record<string, string>;
  /** 累计获得的同角色卡数（首张=1）：关系阶段的「钥匙」门槛 */
  dupeCount: Record<string, number>;
  /** 缘分碎片（引荐系统通货，溢出卡折算所得） */
  bondShards: number;
  /** 缘分 UP 截止日（completedCommission → 限时权重 ×4）：characterId → 'YYYY-MM-DD' 含当日 */
  rateUpUntil: Record<string, string>;
  /** 冷淡截止日（放弃委托 → 限时权重 ×0.25 + 委托不上板）：characterId → 'YYYY-MM-DD' 含当日 */
  coldUntil: Record<string, string>;

  // Gacha
  totalGachaCount: number;
  pityCounter: number;
  gachaHistory: GachaHistoryEntry[];

  // Phone
  phoneMessages: PhoneMessage[];
  phoneCallLog: PhoneCallLog[];
  unreadCounts: { wechat: number; sms: number; call: number };
  triggeredEventIds: string[];

  // Actions
  addSpiritStones: (amount: number) => void;
  addReputation: (amount: number) => void;
  addNormalTickets: (n: number) => void;
  spendNormalTickets: (n: number) => boolean;
  setSupplyPityCounter: (n: number) => void;
  addHintTokens: (n: number) => void;
  /** 消耗一次消消乐提示：优先每日免费(默认3次,陪玩被动可+1)，再扣提示券；都没有返回 'none' */
  consumeMinigameHint: (maxFree?: number) => 'free' | 'token' | 'none';
  /** 理货陪玩搭档 */
  minigameCompanion: string | null;
  setMinigameCompanion: (id: string | null) => void;
  setCurrentNode: (nodeId: string) => void;
  completeNode: (nodeId: string) => void;
  setFlag: (flag: string) => void;
  addCharacter: (characterId: string) => void;
  addAffinity: (characterId: string, amount: number) => void;
  addBondShards: (amount: number) => void;
  /** 把所有角色超出满阶所需（5 张）的溢出信物折算成缘分碎片，返回折得数量 */
  convertSurplusToShards: () => number;
  /** 完成她的委托：缘分 UP 若干自然日（同时解除冷淡） */
  setCharacterRateUp: (characterId: string, days: number) => void;
  /** 放弃她的委托：冷淡若干自然日 */
  setCharacterCold: (characterId: string, days: number) => void;
  advanceRelationshipStage: (characterId: string) => void;
  tryDailyAction: (key: string) => boolean;
  addExp: (characterId: string, amount: number) => void;
  addGachaResult: (characterId: string, rarity: string) => void;
  setPityCounter: (count: number) => void;
  setTotalGachaCount: (count: number) => void;
  addPhoneMessage: (message: PhoneMessage) => void;
  markMessageRead: (id: string) => void;
  addCallLog: (entry: PhoneCallLog) => void;
  addTriggeredEvent: (eventId: string) => void;
  resetGame: () => void;
}

const initialState = {
  tutorialStep: DEFAULT_TUTORIAL_STEP,
  spiritStones: 500,
  reputation: 0,
  normalTickets: 7,
  supplyPityCounter: 0,
  hintTokens: 0,
  freeHints: { date: '', used: 0 },
  minigameCompanion: null as string | null,
  currentChapterId: 1,
  currentNodeId: 'ch1_01',
  completedNodes: [] as string[],
  flags: [] as string[],
  ownedCharacters: [] as OwnedCharacter[],
  affinityMap: {} as Record<string, number>,
  relationshipStages: {} as Record<string, number>,
  dailyActions: {} as Record<string, string>,
  dupeCount: {} as Record<string, number>,
  bondShards: 0,
  rateUpUntil: {} as Record<string, string>,
  coldUntil: {} as Record<string, string>,
  totalGachaCount: 0,
  pityCounter: 0,
  gachaHistory: [] as GachaHistoryEntry[],
  phoneMessages: [] as PhoneMessage[],
  phoneCallLog: [] as PhoneCallLog[],
  unreadCounts: { wechat: 0, sms: 0, call: 0 },
  triggeredEventIds: [] as string[],
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTutorialStep: (n) => set({ tutorialStep: n }),
      addSpiritStones: (amount) => set(s => ({ spiritStones: s.spiritStones + amount })),
      addReputation: (amount) => set(s => ({ reputation: s.reputation + amount })),
      addNormalTickets: (n) => set(s => ({ normalTickets: s.normalTickets + n })),
      setSupplyPityCounter: (n) => set({ supplyPityCounter: n }),
      addHintTokens: (n) => set(s => ({ hintTokens: s.hintTokens + n })),
      setMinigameCompanion: (id) => set({ minigameCompanion: id }),
      consumeMinigameHint: (maxFree = 3) => {
        const today = new Date().toISOString().slice(0, 10);
        const s0 = get();
        const used = s0.freeHints.date === today ? s0.freeHints.used : 0;
        if (used < maxFree) {
          set({ freeHints: { date: today, used: used + 1 } });
          return 'free';
        }
        if (s0.hintTokens > 0) {
          set({ hintTokens: s0.hintTokens - 1 });
          return 'token';
        }
        return 'none';
      },
      spendNormalTickets: (n) => {
        if (get().normalTickets < n) return false;
        set(s => ({ normalTickets: s.normalTickets - n }));
        return true;
      },
      setCurrentNode: (nodeId) => set({ currentNodeId: nodeId }),
      completeNode: (nodeId) => set(s => ({
        completedNodes: s.completedNodes.includes(nodeId) ? s.completedNodes : [...s.completedNodes, nodeId],
      })),
      setFlag: (flag) => set(s => ({
        flags: s.flags.includes(flag) ? s.flags : [...s.flags, flag],
      })),
      addCharacter: (characterId) => set(s => ({
        ownedCharacters: s.ownedCharacters.some(c => c.characterId === characterId)
          ? s.ownedCharacters
          : [...s.ownedCharacters, { characterId, level: 1, exp: 0 }],
        // 重复卡不再是空气：累计计数，作为关系阶段的钥匙门槛
        dupeCount: { ...s.dupeCount, [characterId]: (s.dupeCount[characterId] ?? 0) + 1 },
      })),
      addAffinity: (characterId, amount) => set(s => ({
        affinityMap: {
          ...s.affinityMap,
          [characterId]: Math.max(0, (s.affinityMap[characterId] ?? 0) + amount),
        },
      })),
      addBondShards: (amount) => set(s => ({ bondShards: Math.max(0, s.bondShards + amount) })),
      convertSurplusToShards: () => {
        const s0 = get();
        let gained = 0;
        const dupeCount = { ...s0.dupeCount };
        for (const [id, n] of Object.entries(dupeCount)) {
          const surplus = surplusCards(n);
          if (surplus <= 0) continue;
          const rarity = getCharacterById(id)?.rarity as Rarity | undefined;
          if (!rarity) continue;
          gained += surplus * SHARD_VALUE[rarity];
          dupeCount[id] = MAX_STAGE;
        }
        if (gained > 0) set(s => ({ dupeCount, bondShards: s.bondShards + gained }));
        return gained;
      },
      setCharacterRateUp: (characterId, days) => set(s => {
        const coldUntil = { ...s.coldUntil };
        delete coldUntil[characterId];
        return { rateUpUntil: { ...s.rateUpUntil, [characterId]: dateAfterDays(days) }, coldUntil };
      }),
      setCharacterCold: (characterId, days) => set(s => {
        const rateUpUntil = { ...s.rateUpUntil };
        delete rateUpUntil[characterId];
        return { coldUntil: { ...s.coldUntil, [characterId]: dateAfterDays(days) }, rateUpUntil };
      }),
      advanceRelationshipStage: (characterId) => set(s => ({
        relationshipStages: {
          ...s.relationshipStages,
          [characterId]: (s.relationshipStages[characterId] ?? 0) + 1,
        },
      })),
      tryDailyAction: (key) => {
        const today = new Date().toISOString().slice(0, 10);
        if (get().dailyActions[key] === today) return false;
        set(s => ({ dailyActions: { ...s.dailyActions, [key]: today } }));
        return true;
      },
      // 累加经验并自动连升级（exp 满 level*100 即升一级，溢出转下一级），
      // 让所有经验来源（打热点/交付/重复卡/养成页）共用同一升级口径，调用方无需判断。
      addExp: (characterId, amount) => set(s => ({
        ownedCharacters: s.ownedCharacters.map(c => {
          if (c.characterId !== characterId) return c;
          let level = c.level;
          let exp = c.exp + amount;
          while (exp >= level * 100) { exp -= level * 100; level += 1; }
          return { ...c, level, exp };
        }),
      })),
      addGachaResult: (characterId, rarity) => set(s => ({
        gachaHistory: [...s.gachaHistory, { characterId, rarity, timestamp: Date.now() }],
      })),
      setPityCounter: (count) => set({ pityCounter: count }),
      setTotalGachaCount: (count) => set({ totalGachaCount: count }),
      addPhoneMessage: (message) => set(s => ({
        phoneMessages: [...s.phoneMessages, message],
        unreadCounts: {
          ...s.unreadCounts,
          [message.type]: s.unreadCounts[message.type] + (message.read ? 0 : 1),
        },
      })),
      markMessageRead: (id) => set(s => ({
        phoneMessages: s.phoneMessages.map(m => m.id === id ? { ...m, read: true } : m),
        unreadCounts: {
          ...s.unreadCounts,
          wechat: s.phoneMessages.filter(m => m.type === 'wechat' && !m.read && m.id !== id).length,
          sms: s.phoneMessages.filter(m => m.type === 'sms' && !m.read && m.id !== id).length,
        },
      })),
      addCallLog: (entry) => set(s => ({ phoneCallLog: [...s.phoneCallLog, entry] })),
      addTriggeredEvent: (eventId) => set(s => ({
        triggeredEventIds: s.triggeredEventIds.includes(eventId) ? s.triggeredEventIds : [...s.triggeredEventIds, eventId],
      })),
      resetGame: () => set(initialState),
    }),
    {
      name: 'xiashan-player-store',
      version: 6,
      storage: createJSONStorage(() => safeStorage),
      // 旧版本存档可能缺字段、字段为 null 或类型不符（项目从 AVG 改版而来），
      // 合并时丢弃所有与默认值类型不符的项，避免启动即崩、全页空白。
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        const out: Record<string, unknown> = { ...current };
        const cur = current as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(persisted as Record<string, unknown>)) {
          if (v === null || v === undefined) continue;
          const def = cur[k];
          if (Array.isArray(def) && !Array.isArray(v)) continue;
          if (def !== null && typeof def === 'object' && !Array.isArray(def) && (typeof v !== 'object' || v === null || Array.isArray(v))) continue;
          if (typeof def === 'number' && typeof v !== 'number') continue;
          if (typeof def === 'string' && typeof v !== 'string') continue;
          out[k] = v;
        }
        return out as unknown as PlayerState;
      },
      migrate: (persisted, version) => {
        const state = persisted as Omit<Partial<PlayerState>, 'ownedCharacters'> & {
          ownedCharacters?: { characterId: string; level: number; exp: number; affinity?: number }[];
          personTickets?: number;
          commissionTickets?: number;
        };
        if (version < 6) {
          // 引导系统改版（强制锁定式 19 步）：旧版进行中的引导（1-6）无法续接，重新开始；
          // 已完成（-1）和未开始（0）的存档不受影响
          const s6 = state as typeof state & { tutorialStep?: number };
          if (typeof s6.tutorialStep === 'number' && s6.tutorialStep > 0) {
            s6.tutorialStep = DEFAULT_TUTORIAL_STEP;
          }
        }
        if (version < 5) {
          // 重复卡计数从抽卡历史回放统计（老玩家不亏）；已拥有但无历史记录的保底 1 张
          const s5 = state as typeof state & {
            dupeCount?: Record<string, number>;
            gachaHistory?: { characterId: string }[];
          };
          const dupeCount: Record<string, number> = {};
          for (const entry of s5.gachaHistory ?? []) {
            if (entry?.characterId) dupeCount[entry.characterId] = (dupeCount[entry.characterId] ?? 0) + 1;
          }
          for (const c of s5.ownedCharacters ?? []) {
            if (c?.characterId && !dupeCount[c.characterId]) dupeCount[c.characterId] = 1;
          }
          s5.dupeCount = dupeCount;
          s5.bondShards = typeof state.bondShards === 'number' ? state.bondShards : 0;
          s5.rateUpUntil = {};
          s5.coldUntil = {};
        }
        if (version < 4) {
          // Existing players skip the tutorial; brand-new saves start it
          const s4 = state as typeof state & { tutorialStep?: number };
          if (typeof s4.tutorialStep !== 'number') {
            const hasProgress =
              (Array.isArray(s4.ownedCharacters) && s4.ownedCharacters.length > 0) ||
              (typeof s4.reputation === 'number' && s4.reputation > 0) ||
              (Array.isArray((s4 as { flags?: unknown[] }).flags) && ((s4 as { flags?: unknown[] }).flags ?? []).length > 0) ||
              (Array.isArray((s4 as { completedNodes?: unknown[] }).completedNodes) && ((s4 as { completedNodes?: unknown[] }).completedNodes ?? []).length > 0);
            s4.tutorialStep = hasProgress ? -1 : DEFAULT_TUTORIAL_STEP;
          }
        }
        if (version < 3 && typeof state.commissionTickets === 'number') {
          // 委托券货币已删除（v1.4 委托板取代抽委托），1:1 折成普通券
          state.normalTickets = (state.normalTickets ?? 0) + state.commissionTickets;
          delete state.commissionTickets;
        }
        if (version < 2 && typeof state.personTickets === 'number') {
          // 人物券货币已并入普通券（统一补给池），按 1:2 折算不让老玩家吃亏
          state.normalTickets = (state.normalTickets ?? 0) + state.personTickets * 2;
          delete state.personTickets;
        }
        if (version < 1 && Array.isArray(state.ownedCharacters)) {
          const affinityMap: Record<string, number> = { ...(state.affinityMap ?? {}) };
          state.ownedCharacters = state.ownedCharacters.map(c => {
            const { affinity, ...rest } = c;
            if (typeof affinity === 'number' && affinity > 0) {
              affinityMap[rest.characterId] = (affinityMap[rest.characterId] ?? 0) + affinity;
            }
            return rest;
          });
          state.affinityMap = affinityMap;
          state.relationshipStages = state.relationshipStages ?? {};
          state.dailyActions = state.dailyActions ?? {};
        }
        return state as PlayerState;
      },
    }
  )
);
