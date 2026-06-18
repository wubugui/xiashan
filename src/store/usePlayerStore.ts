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

// 缘分 UP / 冷淡 / 被冷落计时一律按游戏天（gameDay）算，不碰真实时间——见 setCharacterRateUp/Cold、markContact。

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
  /** SSR 软保底计数：连续未出 SSR 的「人物出货」次数（出 SSR 清零） */
  ssrPersonCount: number;
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
  /** 随身信物：当前装备的礼物卡 id（gift_xxx），吃被动 + 委托里可动用，全局仅一枚 */
  equippedGift: string | null;
  /** 已动用过的信物 id（gift_xxx）：信物「动用」整局仅一次，用过即永久消耗 */
  usedGifts: string[];
  /** 已解锁的约会场景收藏 id（scene_xxx）：主动约她按顺序解锁 */
  unlockedScenes: string[];
  /** 玩家为每个角色选定的主页背景（来自已解锁场景）：charId → 图片路径 */
  characterBg: Record<string, string>;
  // 每日限频记录：key（如 interact:touch:linxia / stage:linxia）→ 当时的游戏天号
  // 注意：「每日」= 游戏内一天（打烊推进），不是真实日历日；打烊→新一天会清空本表。
  dailyActions: Record<string, string>;
  /** 游戏内天数（打烊休息推进，从第 1 天起）：每日限频按它重置，而非真实日期 */
  gameDay: number;
  /** 累计获得的同角色卡数（首张=1）：关系阶段的「钥匙」门槛 */
  dupeCount: Record<string, number>;
  /** 缘分碎片（引荐系统通货，溢出卡折算所得） */
  bondShards: number;
  /** 心动系统：每个角色已走到第几个恋爱节点（== 下一个待解锁节点序号） */
  romanceProgress: Record<string, number>;
  /** 确认心意的对象（排他锁定）：null = 还没确认 */
  xinyiTarget: string | null;
  /** 隐藏「默契」值：恋爱节点选项喂养，分支她的反应 */
  momo: Record<string, number>;
  /** 设为展示：玩家为每个角色选定的专属页主视觉（收藏里解锁后可设）：charId → 资源路径 */
  displayPortrait: Record<string, string>;
  /** 设为头像：玩家为每个角色选定的手机头像（收藏里解锁的表情）：charId → 资源路径 */
  displayAvatar: Record<string, string>;
  /** 玩家自己的头像（可设成某个老婆的照片，高博弈）：资源路径，null = 默认「我」 */
  playerAvatarUrl: string | null;
  /** 玩家头像取自哪个老婆（驱动她的甜蜜/反感、别人吃醋）：charId，null = 默认 */
  playerAvatarSource: string | null;
  /** 最近一次主动联系她的游戏天（charId → gameDay）：被冷落判定用 */
  lastContact: Record<string, number>;
  /** 玩家最近看过的她的签名（charId → 签名原文）：判定"她的状态有没有新变化"用 */
  signatureSeen: Record<string, string>;
  /** 缘分 UP 截止游戏天（completedCommission → 限时权重 ×4）：characterId → 到期 gameDay（当前天 < 该值时有效） */
  rateUpUntil: Record<string, number>;
  /** 冷淡截止游戏天（放弃委托 → 限时权重 ×0.25 + 委托不上板）：characterId → 到期 gameDay（当前天 < 该值时有效） */
  coldUntil: Record<string, number>;

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
  setSsrPersonCount: (n: number) => void;
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
  /** 装备/卸下随身信物（传 null 卸下） */
  setEquippedGift: (giftId: string | null) => void;
  /** 动用信物（整局一次，永久消耗） */
  markGiftUsed: (giftId: string) => void;
  /** 解锁一个约会场景收藏 */
  unlockScene: (sceneId: string) => void;
  /** 设为某角色的主页背景（传 null 还原默认） */
  setCharacterBg: (characterId: string, image: string | null) => void;
  /** 心动系统：推进一个恋爱节点（进度 +1） */
  advanceRomance: (characterId: string) => void;
  /** 确认心意（排他锁定对象） */
  setXinyiTarget: (characterId: string) => void;
  /** 累加隐藏默契值 */
  addMomo: (characterId: string, amount: number) => void;
  /** 设为展示：把某张已解锁立绘设为她专属页主视觉 */
  setDisplayPortrait: (characterId: string, asset: string) => void;
  /** 设为头像：把某张已解锁表情设为她的手机头像 */
  setDisplayAvatar: (characterId: string, asset: string) => void;
  /** 设为我的头像：把某张图设为玩家自己的头像（sourceCharId = 取自哪个老婆，可 null） */
  setPlayerAvatar: (asset: string, sourceCharId: string | null) => void;
  /** 记一次主动联系（聊天/短信/通话）：刷新被冷落计时 */
  markContact: (characterId: string) => void;
  /** 记下玩家已看过她当前的签名（点进她的联系人即视为看过） */
  markSignatureSeen: (characterId: string, signature: string) => void;
  tryDailyAction: (key: string) => boolean;
  /** 打烊→新的一天：游戏天 +1，并清空当日限频记录（推进关系/聊天好感/互动等全部重置） */
  advanceGameDay: () => void;
  addExp: (characterId: string, amount: number) => void;
  addGachaResult: (characterId: string, rarity: string) => void;
  setPityCounter: (count: number) => void;
  setTotalGachaCount: (count: number) => void;
  addPhoneMessage: (message: PhoneMessage) => void;
  markMessageRead: (id: string) => void;
  /** 打开联系人：把该角色的全部消息标记已读（红点彻底清除） */
  markContactRead: (characterId: string) => void;
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
  ssrPersonCount: 0,
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
  equippedGift: null as string | null,
  usedGifts: [] as string[],
  unlockedScenes: [] as string[],
  characterBg: {} as Record<string, string>,
  dailyActions: {} as Record<string, string>,
  gameDay: 1,
  dupeCount: {} as Record<string, number>,
  bondShards: 0,
  romanceProgress: {} as Record<string, number>,
  xinyiTarget: null as string | null,
  momo: {} as Record<string, number>,
  displayPortrait: {} as Record<string, string>,
  displayAvatar: {} as Record<string, string>,
  playerAvatarUrl: null as string | null,
  playerAvatarSource: null as string | null,
  lastContact: {} as Record<string, number>,
  signatureSeen: {} as Record<string, string>,
  rateUpUntil: {} as Record<string, number>,
  coldUntil: {} as Record<string, number>,
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
      setSsrPersonCount: (n) => set({ ssrPersonCount: n }),
      addHintTokens: (n) => set(s => ({ hintTokens: s.hintTokens + n })),
      setMinigameCompanion: (id) => set({ minigameCompanion: id }),
      consumeMinigameHint: (maxFree = 3) => {
        const today = String(get().gameDay);
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
        // 刚抽到：记为今天（游戏天）联系过，避免一抽到就被判定"冷落"
        lastContact: s.lastContact[characterId] ? s.lastContact : { ...s.lastContact, [characterId]: s.gameDay },
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
        return { rateUpUntil: { ...s.rateUpUntil, [characterId]: s.gameDay + days }, coldUntil };
      }),
      setCharacterCold: (characterId, days) => set(s => {
        const rateUpUntil = { ...s.rateUpUntil };
        delete rateUpUntil[characterId];
        return { coldUntil: { ...s.coldUntil, [characterId]: s.gameDay + days }, rateUpUntil };
      }),
      setEquippedGift: (giftId) => set({ equippedGift: giftId }),

      markGiftUsed: (giftId) => set(s => ({
        usedGifts: s.usedGifts.includes(giftId) ? s.usedGifts : [...s.usedGifts, giftId],
      })),

      unlockScene: (sceneId) => set(s => ({
        unlockedScenes: s.unlockedScenes.includes(sceneId) ? s.unlockedScenes : [...s.unlockedScenes, sceneId],
      })),

      setCharacterBg: (characterId, image) => set(s => {
        const next = { ...s.characterBg };
        if (image) next[characterId] = image; else delete next[characterId];
        return { characterBg: next };
      }),

      advanceRelationshipStage: (characterId) => set(s => ({
        relationshipStages: {
          ...s.relationshipStages,
          [characterId]: (s.relationshipStages[characterId] ?? 0) + 1,
        },
      })),
      advanceRomance: (characterId) => set(s => ({
        romanceProgress: {
          ...s.romanceProgress,
          [characterId]: (s.romanceProgress[characterId] ?? 0) + 1,
        },
      })),
      setXinyiTarget: (characterId) => set({ xinyiTarget: characterId }),
      addMomo: (characterId, amount) => set(s => ({
        momo: { ...s.momo, [characterId]: (s.momo[characterId] ?? 0) + amount },
      })),
      setDisplayPortrait: (characterId, asset) => set(s => ({
        displayPortrait: { ...s.displayPortrait, [characterId]: asset },
      })),
      setDisplayAvatar: (characterId, asset) => set(s => ({
        displayAvatar: { ...s.displayAvatar, [characterId]: asset },
      })),
      setPlayerAvatar: (asset, sourceCharId) => set({ playerAvatarUrl: asset, playerAvatarSource: sourceCharId }),
      markContact: (characterId) => set(s => ({ lastContact: { ...s.lastContact, [characterId]: s.gameDay } })),
      markSignatureSeen: (characterId, signature) => set(s => (s.signatureSeen[characterId] === signature ? s : ({ signatureSeen: { ...s.signatureSeen, [characterId]: signature } }))),
      tryDailyAction: (key) => {
        // 「每日」= 游戏内一天（打烊推进），不是真实日历日——打烊到第二天即重置
        const day = String(get().gameDay);
        if (get().dailyActions[key] === day) return false;
        set(s => ({ dailyActions: { ...s.dailyActions, [key]: day } }));
        return true;
      },
      // 打烊推进游戏天：清掉按游戏天记的每日限频；freeHints 也按游戏天键，换天自动失效，无需在此重置
      advanceGameDay: () => set(s => ({ gameDay: s.gameDay + 1, dailyActions: {} })),
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
      markMessageRead: (id) => set(s => {
        const phoneMessages = s.phoneMessages.map(m => m.id === id ? { ...m, read: true } : m);
        return {
          phoneMessages,
          unreadCounts: {
            wechat: phoneMessages.filter(m => m.type === 'wechat' && !m.read).length,
            sms: phoneMessages.filter(m => m.type === 'sms' && !m.read).length,
            call: 0,
          },
        };
      }),
      // 打开某个联系人即视为读完她的全部消息（微信+短信+一切）——红点彻底清掉，
      // 不再因为没点进「短信」tab 而残留未读。
      markContactRead: (characterId) => set(s => {
        const phoneMessages = s.phoneMessages.map(m => m.characterId === characterId ? { ...m, read: true } : m);
        return {
          phoneMessages,
          unreadCounts: {
            wechat: phoneMessages.filter(m => m.type === 'wechat' && !m.read).length,
            sms: phoneMessages.filter(m => m.type === 'sms' && !m.read).length,
            call: 0,
          },
        };
      }),
      addCallLog: (entry) => set(s => ({ phoneCallLog: [...s.phoneCallLog, entry] })),
      addTriggeredEvent: (eventId) => set(s => ({
        triggeredEventIds: s.triggeredEventIds.includes(eventId) ? s.triggeredEventIds : [...s.triggeredEventIds, eventId],
      })),
      resetGame: () => set(initialState),
    }),
    {
      name: 'xiashan-player-store',
      version: 18,
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
        if (version < 18) {
          // 缘分UP/冷淡/被冷落计时改为按游戏天(gameDay)记，旧值是真实日期字符串、口径不兼容——直接清空重来
          const s18 = state as typeof state & { coldUntil?: unknown; rateUpUntil?: unknown; lastContact?: unknown; freeHints?: unknown };
          s18.coldUntil = {};
          s18.rateUpUntil = {};
          s18.lastContact = {};
          s18.freeHints = { date: '', used: 0 };
        }
        if (version < 17) {
          // 约会场景收藏 + 自定义主页背景：老存档默认空
          const s17 = state as typeof state & { unlockedScenes?: string[]; characterBg?: Record<string, string> };
          s17.unlockedScenes = s17.unlockedScenes ?? [];
          s17.characterBg = s17.characterBg ?? {};
        }
        if (version < 16) {
          // 游戏天计数 + 每日限频改按游戏天：老存档从第 1 天起、清掉按真实日期记的旧限频
          const s16 = state as typeof state & { gameDay?: number; dailyActions?: Record<string, string> };
          s16.gameDay = s16.gameDay ?? 1;
          s16.dailyActions = {};
        }
        if (version < 15) {
          // 信物「整局一次」消耗记录：老存档默认空
          const s15 = state as typeof state & { usedGifts?: string[] };
          s15.usedGifts = s15.usedGifts ?? [];
        }
        if (version < 14) {
          // 随身信物（礼物卡）新增字段：老存档默认未装备
          const s14 = state as typeof state & { equippedGift?: string | null };
          s14.equippedGift = s14.equippedGift ?? null;
        }
        if (version < 13) {
          // SSR 软保底计数新增字段：老存档从 0 起算
          const s13 = state as typeof state & { ssrPersonCount?: number };
          s13.ssrPersonCount = s13.ssrPersonCount ?? 0;
        }
        if (version < 12) {
          // 签名已读追踪新增字段：老存档补空（首次都视作"有新变化"，正好引导玩家去看）
          const s12 = state as typeof state & { signatureSeen?: Record<string, string> };
          s12.signatureSeen = s12.signatureSeen ?? {};
        }
        if (version < 11) {
          // 被冷落计时改按游戏天：已拥有的角色都从当前游戏天起算，避免老存档一开就被判定冷落
          const s11 = state as typeof state & { lastContact?: Record<string, number>; ownedCharacters?: { characterId: string }[]; gameDay?: number };
          const day = s11.gameDay ?? 1;
          const lc: Record<string, number> = { ...(s11.lastContact ?? {}) };
          for (const c of s11.ownedCharacters ?? []) {
            if (c?.characterId && !lc[c.characterId]) lc[c.characterId] = day;
          }
          s11.lastContact = lc;
        }
        if (version < 10) {
          // 玩家头像博弈新增字段：老存档补默认
          const s10 = state as typeof state & { playerAvatarUrl?: string | null; playerAvatarSource?: string | null };
          s10.playerAvatarUrl = s10.playerAvatarUrl ?? null;
          s10.playerAvatarSource = s10.playerAvatarSource ?? null;
        }
        if (version < 9) {
          // 设为头像新增字段：老存档补空对象（merge 也会兜底）
          const s9 = state as typeof state & { displayAvatar?: Record<string, string> };
          s9.displayAvatar = s9.displayAvatar ?? {};
        }
        if (version < 8) {
          // 设为展示新增字段：老存档补空对象（merge 也会兜底）
          const s8 = state as typeof state & { displayPortrait?: Record<string, string> };
          s8.displayPortrait = s8.displayPortrait ?? {};
        }
        if (version < 7) {
          // 心动系统新增字段：老存档补空，merge 也会兜底（这里显式置，稳妥）
          const s7 = state as typeof state & { romanceProgress?: Record<string, number>; xinyiTarget?: string | null; momo?: Record<string, number> };
          s7.romanceProgress = s7.romanceProgress ?? {};
          s7.xinyiTarget = s7.xinyiTarget ?? null;
          s7.momo = s7.momo ?? {};
        }
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
