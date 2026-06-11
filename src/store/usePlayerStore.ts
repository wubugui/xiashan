import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '@/lib/safeStorage';

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

interface PlayerState {
  // Resources
  spiritStones: number;
  reputation: number;
  // Gacha tickets (便利屋系统)
  normalTickets: number;
  /** 统一补给池保底计数（抽到人物时清零） */
  supplyPityCounter: number;

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
  setCurrentNode: (nodeId: string) => void;
  completeNode: (nodeId: string) => void;
  setFlag: (flag: string) => void;
  addCharacter: (characterId: string) => void;
  addAffinity: (characterId: string, amount: number) => void;
  advanceRelationshipStage: (characterId: string) => void;
  tryDailyAction: (key: string) => boolean;
  addExp: (characterId: string, amount: number) => void;
  levelUpCharacter: (characterId: string) => void;
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
  spiritStones: 500,
  reputation: 0,
  normalTickets: 7,
  supplyPityCounter: 0,
  currentChapterId: 1,
  currentNodeId: 'ch1_01',
  completedNodes: [] as string[],
  flags: [] as string[],
  ownedCharacters: [] as OwnedCharacter[],
  affinityMap: {} as Record<string, number>,
  relationshipStages: {} as Record<string, number>,
  dailyActions: {} as Record<string, string>,
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

      addSpiritStones: (amount) => set(s => ({ spiritStones: s.spiritStones + amount })),
      addReputation: (amount) => set(s => ({ reputation: s.reputation + amount })),
      addNormalTickets: (n) => set(s => ({ normalTickets: s.normalTickets + n })),
      setSupplyPityCounter: (n) => set({ supplyPityCounter: n }),
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
      })),
      addAffinity: (characterId, amount) => set(s => ({
        affinityMap: {
          ...s.affinityMap,
          [characterId]: (s.affinityMap[characterId] ?? 0) + amount,
        },
      })),
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
      addExp: (characterId, amount) => set(s => ({
        ownedCharacters: s.ownedCharacters.map(c =>
          c.characterId === characterId ? { ...c, exp: c.exp + amount } : c
        ),
      })),
      levelUpCharacter: (characterId) => set(s => ({
        ownedCharacters: s.ownedCharacters.map(c =>
          c.characterId === characterId ? { ...c, level: c.level + 1, exp: 0 } : c
        ),
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
      version: 3,
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
