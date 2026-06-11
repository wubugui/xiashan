import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OwnedCharacter {
  characterId: string;
  level: number;
  exp: number;
  affinity: number;
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
  commissionTickets: number;
  personTickets: number;
  normalTickets: number;

  // Story progress
  currentChapterId: number;
  currentNodeId: string;
  completedNodes: string[];
  flags: string[];

  // Characters
  ownedCharacters: OwnedCharacter[];

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
  addCommissionTickets: (n: number) => void;
  addPersonTickets: (n: number) => void;
  addNormalTickets: (n: number) => void;
  spendCommissionTicket: () => boolean;
  spendPersonTicket: () => boolean;
  spendNormalTickets: (n: number) => boolean;
  setCurrentNode: (nodeId: string) => void;
  completeNode: (nodeId: string) => void;
  setFlag: (flag: string) => void;
  addCharacter: (characterId: string) => void;
  addAffinity: (characterId: string, amount: number) => void;
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
  commissionTickets: 2,
  personTickets: 2,
  normalTickets: 5,
  currentChapterId: 1,
  currentNodeId: 'ch1_01',
  completedNodes: [] as string[],
  flags: [] as string[],
  ownedCharacters: [] as OwnedCharacter[],
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
      addCommissionTickets: (n) => set(s => ({ commissionTickets: s.commissionTickets + n })),
      addPersonTickets: (n) => set(s => ({ personTickets: s.personTickets + n })),
      addNormalTickets: (n) => set(s => ({ normalTickets: s.normalTickets + n })),
      spendCommissionTicket: () => {
        if (get().commissionTickets < 1) return false;
        set(s => ({ commissionTickets: s.commissionTickets - 1 }));
        return true;
      },
      spendPersonTicket: () => {
        if (get().personTickets < 1) return false;
        set(s => ({ personTickets: s.personTickets - 1 }));
        return true;
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
          : [...s.ownedCharacters, { characterId, level: 1, exp: 0, affinity: 0 }],
      })),
      addAffinity: (characterId, amount) => set(s => ({
        ownedCharacters: s.ownedCharacters.map(c =>
          c.characterId === characterId ? { ...c, affinity: c.affinity + amount } : c
        ),
      })),
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
    { name: 'xiashan-player-store' }
  )
);
