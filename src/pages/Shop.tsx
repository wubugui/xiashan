/**
 * 都市便利屋 · 分池抽卡 主界面
 * 移动端竖屏布局，复用 GachaAnimation。
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, RefreshCw, MapPin, ClipboardList, Package, ScrollText,
  Users,
} from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useShopStore, checkFail } from '@/store/useShopStore';
import { getCharacterById } from '@/data/characters';
import { commissions } from '@/data/commissions';
import { GACHA_CONFIG } from '@/data/gachaConfig';
import { pullSupply, RATE_UP_DAYS } from '@/engine/gachaEngine';
import {
  isMatch, scoreCard, resolveSpot, hitsRequirement, applyCommissionRewards,
  fatigueFromDelta, coffeeRelief, FATIGUE_TIRED, FATIGUE_EXHAUSTED, FATIGUE_MAX, COFFEE_COST,
} from '@/engine/shopEngine';
import { getSideJobById } from '@/data/sideJobs';
import { checkPhoneEvents } from '@/engine/phoneScheduler';
import GachaAnimation from '@/components/GachaAnimation';
import CommissionTheater from '@/components/CommissionTheater';
import TutorialDirector, { TutorialSpotlight } from '@/components/TutorialDirector';
import {
  TUTORIAL_STEPS, TUTORIAL_TOTAL, TUTORIAL_SIDE_JOB, TUTORIAL_DRAW_CARD, TUTORIAL_START,
  type TutorialCtx,
} from '@/lib/tutorialFlow';
import { allServiceCards } from '@/data/serviceCards';
import ResetSaveButton from '@/components/ResetSaveButton';
import SupplyReveal, { type RevealItem } from '@/components/SupplyReveal';
import { useCssVarFromHeight } from '@/hooks/useCssVarFromHeight';
import PageBackdrop from '@/components/PageBackdrop';
import type { Commission, CommissionObjective, GameLocation, Spot } from '@/data/types';
import { backdropForLocation, SCENE_BACKDROPS } from '@/lib/pageBackdrops';

/** GachaAnimation 内部格式（与 engine 的 GachaResult 不同） */
interface AnimGachaResult {
  characterId: string;
  name: string;
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  title: string;
  isNew: boolean;
}
import type { HandCard } from '@/store/useShopStore';
import type { PersonCard } from '@/engine/shopEngine';
import { cn } from '@/lib/utils';
import { assetCssBackground, assetUrl } from '@/lib/assets';
import { playSound, isSoundEnabled, setSoundEnabled } from '@/lib/sound';

/* ────── 常量 ────── */
const POOL_CONFIG = [
  { id: 'board',  label: '今日待办', sub: '接单·执行·交付', cost: '免费接单', color: 'from-rose-500 to-pink-700', icon: ClipboardList },
  { id: 'supply', label: '便利屋补给', sub: '人物·技能·便利·情报', cost: '消耗 1 普通券', color: 'from-violet-500 to-purple-700', icon: Users },
] as const;

type PoolId = (typeof POOL_CONFIG)[number]['id'];
type ActiveTab = 'map' | 'commission' | 'hand' | 'log';

/* ────── 工具函数 ────── */
function kindName(kind: string) {
  return { skill: '技能卡', tool: '便利卡', info: '情报卡', person: '人物卡', commission: '委托卡' }[kind] ?? '卡';
}

function rarityColor(rarity: string) {
  if (rarity === 'SSR') return 'text-yellow-300';
  if (rarity === 'SR') return 'text-purple-300';
  return 'text-slate-300';
}

function dispatchAvailablePhoneEvents(addLog?: (text: string, cls?: 'good' | 'bad' | 'draw' | 'play' | '') => void) {
  const store = usePlayerStore.getState();
  const events = checkPhoneEvents({
    spiritStones: store.spiritStones,
    reputation: store.reputation,
    ownedCharacters: store.ownedCharacters,
    affinityMap: store.affinityMap,
    relationshipStages: store.relationshipStages,
    completedNodes: store.completedNodes,
    flags: store.flags,
    triggeredEventIds: store.triggeredEventIds,
  });

  for (const event of events) {
    if (!event.characterId) continue;
    const timestamp = Date.now();
    const messageType = event.type === 'sms' ? 'sms' : 'wechat';

    store.addTriggeredEvent(event.id);
    if (event.type === 'call') {
      store.addCallLog({
        characterId: event.characterId,
        type: 'incoming',
        duration: 0,
        timestamp,
      });
    }

    event.messages.forEach((message, index) => {
      store.addPhoneMessage({
        id: `${event.id}_${index}_${timestamp}`,
        characterId: event.characterId!,
        type: messageType,
        content: message.content,
        timestamp: timestamp + index,
        read: false,
      });
    });

    if (event.effects?.length) {
      applyCommissionRewards(event.effects);
    }
  }

  if (events.length > 0) {
    addLog?.(`手机收到 ${events.length} 条新事件。`, 'good');
  }
}

/* ────── 子组件：状态条 ────── */
function StatusBar({
  fatigue, rep, money, trust, commissionNeed,
  normalTickets,
}: {
  fatigue: number; rep: number; money: number;
  trust: number; commissionNeed: number;
  normalTickets: number;
}) {
  const pct = commissionNeed > 0 ? Math.min(100, (trust / commissionNeed) * 100) : 0;
  const fatigueState = fatigue >= FATIGUE_EXHAUSTED ? '透支' : fatigue >= FATIGUE_TIRED ? '疲惫' : '';
  return (
    <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl px-3 py-2 text-xs">
      {/* 资源行 */}
      <div className="flex gap-2 flex-wrap mb-1.5">
        {[
          { label: '📣口碑', val: rep, warn: rep <= 1 },
          { label: '💴资金', val: money, warn: false },
          { label: '🎫券', val: normalTickets, warn: false },
        ].map(({ label, val, warn }) => (
          <span key={label} className={cn('rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-bold', warn ? 'text-red-400' : 'text-slate-200')}>
            {label} <b>{val}</b>
          </span>
        ))}
      </div>
      {/* 疲劳仪表 */}
      <div className="flex items-center gap-2 mb-1">
        <span className={cn(
          'shrink-0 font-bold',
          fatigue >= FATIGUE_EXHAUSTED ? 'text-red-400' : fatigue >= FATIGUE_TIRED ? 'text-amber-300' : 'text-slate-400',
        )}>
          😪疲劳 {fatigue}/100{fatigueState && ` · ${fatigueState}`}
        </span>
        <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              fatigue >= FATIGUE_EXHAUSTED ? 'bg-gradient-to-r from-red-500 to-rose-600'
                : fatigue >= FATIGUE_TIRED ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                : 'bg-gradient-to-r from-emerald-400 to-teal-500',
            )}
            style={{ width: `${Math.min(100, fatigue)}%` }}
          />
        </div>
      </div>
      {/* 信任进度条 */}
      {commissionNeed > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-slate-400 shrink-0">信任 {trust}/{commissionNeed}</span>
          <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ────── 子组件：当前目标条（常驻导航：始终告诉玩家下一步去哪、做什么） ────── */
function GoalBar({
  commission, trust, commissionNeed, objectives, objectivesDone, nextObjective, commissionReady, gameOver,
  loc, sideJobs,
}: {
  commission: Commission | null; trust: number; commissionNeed: number;
  objectives: { id: string }[]; objectivesDone: string[];
  nextObjective: CommissionObjective | null; commissionReady: boolean; gameOver: boolean;
  loc: GameLocation | null; sideJobs: { id: string; done: boolean }[];
}) {
  if (gameOver) return null;

  /* 身处地点时：列出「本地能推进」的委托子目标与顺手单 */
  if (loc) {
    const localObjectives = (commission?.objectives ?? []).filter(
      o => !objectivesDone.includes(o.id) && (!o.locTag || loc.tags.includes(o.locTag)),
    );
    const localJobs = sideJobs
      .filter(j => !j.done)
      .map(j => getSideJobById(j.id))
      .filter((t): t is NonNullable<ReturnType<typeof getSideJobById>> => !!t)
      .filter(t => !t.locTag || loc.tags.includes(t.locTag));
    if (localObjectives.length > 0 || localJobs.length > 0) {
      return (
        <div className="mx-3 mt-2 mb-0.5 space-y-0.5 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">📍 本地能推进</p>
          {localObjectives.map(o => (
            <p key={o.id} className="text-xs font-medium text-amber-200">
              📋 {o.desc}——在匹配热点打出 {o.need.join('/')} 卡
            </p>
          ))}
          {localJobs.map(t => (
            <p key={t.id} className="text-xs font-medium text-emerald-200">
              🧾 {t.title}——打出 {t.need.join('/')} 卡
            </p>
          ))}
        </div>
      );
    }
    if (commission && (commission.objectives?.length ?? 0) > 0) {
      return (
        <div className="mx-3 mt-2 mb-0.5 rounded-lg border border-slate-600/40 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-300">
          📍 这里没有委托相关目标——处理热点攒信任，或「完成当前地点」换地方
        </div>
      );
    }
    return null;
  }

  if (!commission) {
    return (
      <div className="mx-3 mt-2 mb-0.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 animate-pulse">
        ▶ 前往「委托」Tab接单，开始今日任务
      </div>
    );
  }
  if (commissionReady) {
    return (
      <div className="mx-3 mt-2 mb-0.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 animate-pulse">
        ✅ 目标达成！在「委托」Tab点击「交付委托」
      </div>
    );
  }
  if (objectives.length > 0 && nextObjective) {
    return (
      <div className="mx-3 mt-2 mb-0.5 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-1.5 text-xs font-medium text-amber-200">
        📋 【{commission.name}】{objectivesDone.length}/{objectives.length} · 下一步：{nextObjective.desc}——
        {nextObjective.locTag ? `去【${nextObjective.locTag}】类地点` : '任意地点'}打出 {nextObjective.need.join('/')} 卡
      </div>
    );
  }
  return (
    <div className="mx-3 mt-2 mb-0.5 rounded-lg border border-slate-600/40 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-300">
      📍 处理地点热点、积累信任 {trust}/{commissionNeed}，达标后交付
    </div>
  );
}

/* ────── 主组件 ────── */
export default function Shop() {
  const navigate = useNavigate();

  /* ── Stores ── */
  const playerStore = usePlayerStore();
  const shopStore = useShopStore();

  const {
    fatigue, rep, money, trust, coffees, commission, isRevisit, loc, routes, done, hand, log, gameOver,
    board, objectivesDone, sideJobs, pendingScene, lastCardType,
    startDay, startTutorialDay, refreshRoutes, acceptCommission, abandonCommission, clearCommission,
    completeObjective, completeSideJob, noteCommissionFocus,
    setPendingScene, chooseLocation, leaveLocation, addHandCard, consumeHandCard,
    applyDelta, markSpotDone, finishLocation, buyCoffee, addLog, setGameOver, resetDay,
    setLastCardType,
  } = shopStore;

  const {
    ownedCharacters, affinityMap, supplyPityCounter,
    normalTickets, flags, rateUpUntil, coldUntil,
    spendNormalTickets, setSupplyPityCounter,
    addNormalTickets, addAffinity, setCharacterRateUp,
    addGachaResult, addCharacter,
    addSpiritStones, addReputation, addHintTokens,
    tutorialStep, setTutorialStep,
  } = playerStore;

  /* ── 本地 UI 状态 ── */
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [currentEvent, setCurrentEvent] = useState<{ spot: Spot; spotIndex: number; locId: string } | null>(null);
  const [gachaResults, setGachaResults] = useState<AnimGachaResult[]>([]);
  const [showGacha, setShowGacha] = useState(false);
  const [endDayResult, setEndDayResult] = useState<'success' | 'fail' | null>(null);
  /** 刚了结的委托名（清空槽位后结算弹窗仍需展示） */
  const [completedName, setCompletedName] = useState<string | null>(null);
  /** 放弃委托确认弹窗 */
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showTheater, setShowTheater] = useState(false);
  const [handledThisLocation, setHandledThisLocation] = useState(false);
  /** 补给池非人物出货的开箱演出（人物走全屏 GachaAnimation） */
  const [revealItem, setRevealItem] = useState<RevealItem | null>(null);
  const drawCooldownUntilRef = useRef(0);
  /** 地图 NPC 闲聊气泡 */
  const [npcTalk, setNpcTalk] = useState<{ name: string; emoji: string; line: string } | null>(null);
  /** 底部操作条实测高度 → --bar-h（浮层/内容留白据此自动适配） */
  const actionBarRef = useRef<HTMLDivElement>(null);
  useCssVarFromHeight('--bar-h', actionBarRef);

  /* ── 初始化 ── */
  const isNew = routes.length === 0 && !gameOver && commission === null && fatigue === 0;
  const commissionNeed = commission?.need ?? 0;
  const objectives = commission?.objectives ?? [];
  const allObjectivesDone = objectives.length > 0 && objectives.every(o => objectivesDone.includes(o.id));
  /** 有子目标的委托：结局分水岭 = need+5（统一信任口径）；交付条件 = 全部子目标完成 */
  const gateGoal = commission ? commission.need + (objectives.length > 0 ? 5 : 0) : 0;
  const commissionReady = !!commission && (objectives.length > 0 ? allObjectivesDone : trust >= commissionNeed);
  /** 下一个未完成子目标（GoalBar 导航用） */
  const nextObjective = objectives.find(o => !objectivesDone.includes(o.id)) ?? null;
  /** 未完成子目标的限定地点标签（路线「委托相关」徽标用） */
  const pendingTags = objectives.filter(o => !objectivesDone.includes(o.id) && o.locTag).map(o => o.locTag!);

  /* ────── 新手引导：强制锁定式流程（江夏全程解说，玩家只能点亮起的目标） ────── */
  const tutorialActive = tutorialStep > 0 && tutorialStep <= TUTORIAL_TOTAL;
  const tutStep = tutorialActive ? TUTORIAL_STEPS[tutorialStep - 1] : null;
  const tutCtx: TutorialCtx = {
    activeTab,
    commissionId: commission?.id ?? null,
    objectivesDone,
    locId: loc?.id ?? null,
    eventOpen: currentEvent !== null,
    sideJobPetDone: sideJobs.some(j => j.id === TUTORIAL_SIDE_JOB && j.done),
    hasPhoneCard: hand.some(c => c.id === TUTORIAL_DRAW_CARD),
    interviewDelivered: flags.includes('commission_interview_done') && !commission,
  };
  /** 引导浮层让位于全屏演出（剧场分幕 / 补给开箱 / 抽卡动画 / 结算弹窗） */
  const tutorialOverlayHidden = !!pendingScene || showTheater || !!revealItem || showGacha || !!endDayResult;
  const drawBusy = showGacha || gachaResults.length > 0 || !!revealItem;

  const lastAdvancedRef = useRef(0);
  const advanceTutorial = useCallback(() => {
    if (!tutorialActive || !tutStep) return;
    if (lastAdvancedRef.current === tutorialStep) return; // 防同一步重复推进（StrictMode/连续渲染）
    lastAdvancedRef.current = tutorialStep;
    if (tutStep.reward?.stones) {
      addSpiritStones(tutStep.reward.stones);
      addLog(`🎁 江夏的谢礼:灵石 +${tutStep.reward.stones}。`, 'good');
    }
    setTutorialStep(tutorialStep + 1);
  }, [tutorialActive, tutStep, tutorialStep, addSpiritStones, addLog, setTutorialStep]);

  // 条件满足自动推进。谓词只读存档态，刷新页面后可从断点续接
  useEffect(() => {
    if (!tutorialActive || !tutStep?.until) return;
    if (tutStep.until(tutCtx)) advanceTutorial();
  });

  // 引导按钮（全屏对白 / 带按钮的聚光步骤）
  const handleTutorialButton = useCallback(() => {
    if (!tutStep) return;
    if (tutStep.id === 'celebrate') {
      // 终幕：江夏正式入伙——直接发角色，跳过抽卡随机性
      const linxiaChar = getCharacterById('linxia');
      if (linxiaChar) {
        addCharacter('linxia');
        addGachaResult('linxia', 'R');
        const animResult: AnimGachaResult = {
          characterId: 'linxia',
          name: linxiaChar.name,
          rarity: 'R' as const,
          title: linxiaChar.title,
          isNew: true,
        };
        setGachaResults([animResult]);
        setShowGacha(true);
      } else {
        setTutorialStep(-1);
        setEndDayResult('success');
        setGameOver(true);
      }
      return;
    }
    advanceTutorial();
  }, [tutStep, advanceTutorial, addCharacter, addGachaResult, setTutorialStep, setGameOver]);

  /* ────── 抽卡 ────── */
  const handleDraw = useCallback((pool: PoolId) => {
    if (drawBusy || Date.now() < drawCooldownUntilRef.current) return;
    if (gameOver) return toast('今日已结束。');

    if (pool === 'board') {
      setActiveTab('commission');
      return;
    } else if (pool === 'supply') {
      // 引导教学抽卡：固定出货 SR 万能卡【临时人脉电话】，补上剧本里故意缺失的「流程」需求
      if (tutorialActive && tutStep?.id === 'supply_draw') {
        if (!spendNormalTickets(1)) return toast('普通券不足。');
        drawCooldownUntilRef.current = Date.now() + 700;
        const phone = allServiceCards.find(c => c.id === TUTORIAL_DRAW_CARD);
        if (phone) {
          addHandCard(phone);
          playSound('gacha-item');
          addLog(`便利屋补给：✨ 稀有出货！便利卡【${phone.name}】（${phone.type} · ${phone.rarity}）。`, 'good');
          setRevealItem({
            tier: 'rare',
            icon: '🧰',
            name: phone.name,
            sub: `${phone.type} · ${phone.rarity}`,
            desc: phone.desc,
            pityRemain: GACHA_CONFIG.supplyPool.characterPity - supplyPityCounter,
          });
        }
        return;
      }
      if (!spendNormalTickets(1)) return toast('普通券不足。');
      drawCooldownUntilRef.current = Date.now() + 700;
      const ownedIds = ownedCharacters.map(o => o.characterId);
      const { result, newPity } = pullSupply(ownedIds, affinityMap, supplyPityCounter, { rateUpUntil, coldUntil });
      setSupplyPityCounter(newPity);
      if (result.kind === 'person') {
        addCharacter(result.character.id);
        addGachaResult(result.character.id, result.character.rarity);
        // 入伙演出：抽到邂逅期已攒好感的角色，出货时承认此前积累（设计文档 6.3）
        if (result.isNew && (affinityMap[result.character.id] ?? 0) > 0) {
          addLog(`【${result.character.name}】握住你的手："那几次委托……我都记得。"她正式加入二十五时便利屋。`, 'good');
        }
        const animResult: AnimGachaResult = {
          characterId: result.character.id,
          name: result.character.name,
          rarity: result.character.rarity,
          title: result.character.title,
          isNew: result.isNew,
        };
        setGachaResults([animResult]);
        setShowGacha(true);
        addLog(`便利屋补给：✨ ${result.isNew ? '人物出货' : '重复人物'}【${result.character.name}】！`, 'good');
      } else {
        const remain = GACHA_CONFIG.supplyPool.characterPity - newPity;
        playSound('gacha-item');
        if (result.kind === 'hint') {
          addHintTokens(1);
          addLog(`便利屋补给：抽到【消消乐提示券】×1。距人物保底还剩 ${remain} 抽。`, 'draw');
          setRevealItem({ tier: 'normal', icon: '💡', name: '消消乐提示券', sub: '道具 ×1', desc: '消消乐每日免费提示用完后，消耗 1 张继续获得提示。', pityRemain: remain });
        } else if (result.kind === 'stones') {
          addSpiritStones(result.amount);
          addLog(`便利屋补给：${result.big ? '✨ 稀有出货！【灵石大袋】' : '抽到【灵石小包】'} +${result.amount} 灵石。距人物保底还剩 ${remain} 抽。`, result.big ? 'good' : 'draw');
          setRevealItem({
            tier: result.big ? 'rare' : 'normal',
            icon: result.big ? '💎' : '💰',
            name: result.big ? '灵石大袋' : '灵石小包',
            sub: `+${result.amount} 灵石`,
            desc: result.big ? '沉甸甸的一袋——今天的运气都花在这了？不，人物保底还在走！' : '零花钱到账，攒着抽卡或培养角色。',
            pityRemain: remain,
          });
        } else {
          addHandCard(result.card);
          addLog(`便利屋补给：抽到【${result.card.name}】（${result.card.type}）。距人物保底还剩 ${remain} 抽。`, 'draw');
          setRevealItem({
            tier: result.card.rarity === 'SR' ? 'rare' : 'normal',
            icon: result.card.kind === 'skill' ? '⚡' : result.card.kind === 'tool' ? '🧰' : '📡',
            name: result.card.name,
            sub: `${result.card.type} · ${result.card.rarity}`,
            desc: result.card.desc,
            pityRemain: remain,
          });
        }
      }
    }
  }, [drawBusy, gameOver, tutorialActive, tutStep, spendNormalTickets, ownedCharacters, affinityMap, supplyPityCounter, rateUpUntil, coldUntil, setSupplyPityCounter, addCharacter, addGachaResult, addHandCard, addHintTokens, addSpiritStones, addLog]);

  const closeRevealItem = useCallback(() => {
    drawCooldownUntilRef.current = Date.now() + 700;
    setRevealItem(null);
  }, []);

  const handleGachaComplete = useCallback(() => {
    drawCooldownUntilRef.current = Date.now() + 900;
    setShowGacha(false);
    setGachaResults([]);
    // 引导终幕：江夏入伙演出结束 → 引导完成，结算当日
    if (tutorialActive) {
      setTutorialStep(-1);
      setEndDayResult('success');
      setGameOver(true);
    }
  }, [tutorialActive, setTutorialStep, setGameOver]);

  /* ────── 热点点击 ────── */
  const handleSpotClick = useCallback((spot: Spot, spotIndex: number) => {
    if (!loc) return;
    if (done[loc.id]?.[spotIndex]) return toast('这个热点已经处理过了。');
    playSound('spot-open');
    setCurrentEvent({ spot, spotIndex, locId: loc.id });
    setActiveTab('map'); // 确保弹窗在地图 tab 上显示
  }, [loc, done]);

  /* ────── 事件结算 ────── */
  const handleResolve = useCallback((card: (HandCard & { kind: 'skill' | 'tool' | 'info' }) | PersonCard | null) => {
    if (!currentEvent || !loc) return;
    const { spot, spotIndex, locId } = currentEvent;

    const { text, cls, delta, combo } = resolveSpot(spot, card, lastCardType);

    // 音效反馈
    if (!card) playSound('card-miss');
    else if (combo) playSound('combo');
    else {
      const cType = card.kind === 'person' ? card.serviceType : (card as HandCard).type;
      playSound(spot.need.includes(cType) ? 'card-hit' : 'card-miss');
    }

    // 消耗一次性手牌
    if (card && card.kind !== 'person') {
      consumeHandCard((card as HandCard).uid);
      addLog(`消耗${kindName(card.kind)}【${card.name}】。`, 'play');
    }

    // 情报卡"城市情报"刷新路线
    if (card && card.kind === 'info' && card.name === '城市情报') {
      refreshRoutes();
    }

    // 疲惫状态：信任收益减半（向上取整）
    if (fatigue >= FATIGUE_TIRED && (delta.trust ?? 0) > 1) {
      delta.trust = Math.ceil((delta.trust ?? 0) / 2);
    }

    applyDelta(delta);
    markSpotDone(locId, spotIndex);
    setHandledThisLocation(true);
    addLog(text, cls);
    if (combo) {
      const cardType = card!.kind === 'person' ? card!.serviceType : (card as HandCard).type;
      addLog(`🔗 连携！连续两次打出【${cardType}】，信任额外 +1。`, 'good');
    }
    setLastCardType(card ? (card.kind === 'person' ? card.serviceType : (card as HandCard).type) : null);

    // 子目标 / 顺手单命中判定：在匹配热点上打出要求 type 的卡
    let objectiveHit = false;
    if (card) {
      const cardType = card.kind === 'person' ? card.serviceType : (card as HandCard).type;
      if (commission?.objectives) {
        for (const obj of commission.objectives) {
          if (objectivesDone.includes(obj.id)) continue;
          if (hitsRequirement(obj, cardType, spot, loc.tags)) {
            completeObjective(obj.id); // 入队该子目标的剧场幕
            objectiveHit = true;
            break;
          }
        }
      }
      for (const sj of sideJobs) {
        if (sj.done) continue;
        const tpl = getSideJobById(sj.id);
        if (tpl && hitsRequirement(tpl, cardType, spot, loc.tags)) {
          completeSideJob(sj.id);
          if (tpl.reward.money) applyDelta({ money: tpl.reward.money });
          if (tpl.reward.normalTickets) addNormalTickets(tpl.reward.normalTickets);
          if (tpl.reward.spiritStones) addSpiritStones(tpl.reward.spiritStones);
          addLog(`🧾 顺手单完成【${tpl.title}】:${tpl.doneText}`, 'good');
          break;
        }
      }
    }

    setCurrentEvent(null);

    // 委托催促埋点：连续干别的事，她会发消息来问
    noteCommissionFocus(objectiveHit);

    // 检查强制打烊
    const newState = {
      fatigue: Math.min(FATIGUE_MAX, fatigue + fatigueFromDelta(delta)),
      rep: Math.max(0, rep + (delta.rep ?? 0)),
    };
    if (checkFail(newState)) {
      setGameOver(true);
      addLog('🌙 强制打烊：疲劳爆表或口碑见底。委托进度已保留。', 'bad');
      setEndDayResult('fail');
    }
  }, [currentEvent, loc, commission, objectivesDone, sideJobs, fatigue, rep, lastCardType,
    consumeHandCard, applyDelta, markSpotDone, completeObjective, completeSideJob, noteCommissionFocus,
    addNormalTickets, addSpiritStones, addLog, refreshRoutes, setGameOver, setLastCardType]);

  /* ────── 冒险解法（危险热点）：不出牌，付出更多资源换高信任 ────── */
  const handleRisk = useCallback(() => {
    if (!currentEvent || !loc || !currentEvent.spot.risk) return;
    const { spot, spotIndex, locId } = currentEvent;
    const risk = spot.risk!;

    playSound('risk');
    // 疲惫状态：冒险解法的信任收益同样减半
    const riskDelta = { ...risk.delta };
    if (fatigue >= FATIGUE_TIRED && (riskDelta.trust ?? 0) > 1) {
      riskDelta.trust = Math.ceil((riskDelta.trust ?? 0) / 2);
    }
    applyDelta(riskDelta);
    markSpotDone(locId, spotIndex);
    setHandledThisLocation(true);
    setLastCardType(null);
    addLog(`⚡ ${spot.name}：${risk.text}`, (riskDelta.trust ?? 0) > 0 ? 'good' : 'bad');
    setCurrentEvent(null);

    const newState = {
      fatigue: Math.min(FATIGUE_MAX, fatigue + fatigueFromDelta(riskDelta)),
      rep: Math.max(0, rep + (riskDelta.rep ?? 0)),
    };
    if (checkFail(newState)) {
      setGameOver(true);
      addLog('🌙 强制打烊：疲劳爆表或口碑见底。委托进度已保留。', 'bad');
      setEndDayResult('fail');
    }
  }, [currentEvent, loc, fatigue, rep, applyDelta, markSpotDone, setLastCardType, addLog, setGameOver]);

  /* ────── 结束当天 ────── */
  const handleEndDay = useCallback(() => {
    // 子目标制委托只能通过「交付」(剧场结局)完成；endDay 兜底视为未交付
    const legacySuccess = !!commission && !commission.objectives?.length && trust >= commission.need;
    if (legacySuccess && commission) {
      setCompletedName(commission.name);
      applyCommissionRewards(commission.rewardEffects);
      addNormalTickets(4);
      addReputation(1);
      setCharacterRateUp(commission.target, RATE_UP_DAYS);
      dispatchAvailablePhoneEvents(addLog);
      addLog(`今日完成：【${commission.name}】。奖励：普通券+4，口碑+1，缘分UP。`, 'good');
      clearCommission();
      setEndDayResult('success');
    } else {
      // 锁单制：未交付不再逾期作废，进度保留到明天
      if (commission) {
        addLog(`委托【${commission.name}】今日未交付——进度已保留，明天接着为她奔走。`, '');
      }
      addNormalTickets(1);
      addLog('今日打烊。补偿普通券 +1。', '');
      setEndDayResult('fail');
    }
    setGameOver(true);
  }, [commission, trust, addNormalTickets, addReputation, setCharacterRateUp, clearCommission, addLog, setGameOver]);

  /* ────── 完成地点 ────── */
  const handleFinishLocation = useCallback(() => {
    if (gameOver) return;
    if (!loc) return toast('先选择地点。');
    // 全部热点已处理过（含此前来过这个地点的情况）时允许直接离开，避免卡死
    const allSpotsDone = loc.spots.every((_, i) => done[loc.id]?.[i]);
    if (!handledThisLocation && !allSpotsDone) return toast('至少处理一个热点，或点「换地点」退回路线选择。');
    playSound('location-done');
    finishLocation();
    setHandledThisLocation(false);
    checkAndFail();
  }, [gameOver, loc, done, handledThisLocation, finishLocation]);

  /* ────── 委托剧场结算 ────── */
  const handleTheaterComplete = useCallback((ok: boolean) => {
    setShowTheater(false);
    setPendingScene(null);
    if (!commission) return;
    setCompletedName(commission.name);
    if (ok) {
      if (isRevisit) {
        // 回访单：奖励递减（防券/口碑通胀），但缘分 UP 照常刷新
        addNormalTickets(1);
        applyDelta({ money: 10 });
        addAffinity(commission.target, 2);
        setCharacterRateUp(commission.target, RATE_UP_DAYS);
        addLog(`回访交付：【${commission.name}】。普通券+1，资金+10，好感+2，缘分UP——这几天更容易遇到她。`, 'good');
      } else {
        // 好感写入独立 affinityMap，无需持有；入伙只走补给池抽卡（设计文档 6.3）
        applyCommissionRewards(commission.rewardEffects);
        addNormalTickets(4);
        addReputation(1);
        setCharacterRateUp(commission.target, RATE_UP_DAYS);
        dispatchAvailablePhoneEvents(addLog);
        addLog(`委托交付：【${commission.name}】。奖励：普通券+4，口碑+1，缘分UP——这几天更容易遇到她。`, 'good');
      }
      playSound('commission-success');
      clearCommission();
      // 引导期：不结束当天——交付完成被流程谓词捕获后，自动进入江夏入伙庆典步
      if (tutorialActive) return;
      setEndDayResult('success');
    } else {
      addNormalTickets(1);
      playSound('commission-fail');
      addLog(`委托收尾不顺：【${commission.name}】。她还是谢了你，但结局差了点意思。补偿普通券 +1。`, 'bad');
      clearCommission();
      setEndDayResult('fail');
    }
    setGameOver(true);
  }, [commission, isRevisit, setPendingScene, addNormalTickets, addReputation, addAffinity, setCharacterRateUp, applyDelta, clearCommission, addLog, setGameOver, tutorialActive]);

  /* ────── Toast ────── */
  const [toastMsg, setToastMsg] = useState('');
  function toast(msg: string) {
    playSound('toast');
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 1800);
  }

  /* ────── 人物卡列表（已拥有角色） ────── */
  const personCards: PersonCard[] = ownedCharacters
    .map(o => {
      const c = getCharacterById(o.characterId);
      if (!c) return null;
      return { kind: 'person' as const, id: c.id, name: c.name, serviceType: c.serviceType, level: o.level };
    })
    .filter((x): x is PersonCard => x !== null);
  const pageBackdrop = backdropForLocation(loc?.id);

  /* ─────────────────────── RENDER ─────────────────────── */

  /* 开始界面（tutorialStep === 0 时强制显示：无论局内残留什么状态，引导都从干净一天开始） */
  if (isNew || tutorialStep === 0) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-[#050914] px-6">
        <PageBackdrop
          image={SCENE_BACKDROPS.street.image}
          mobileImage={SCENE_BACKDROPS.street.mobileImage}
          position={SCENE_BACKDROPS.street.position}
          overlayClassName="from-slate-950/30 via-slate-950/60 to-slate-950/90"
        />
        <div className="relative z-10 text-center">
          <h1 className="text-3xl font-black text-amber-300 mb-2">二十五时便利屋</h1>
          <p className="text-slate-400 text-sm">开在一天的第二十五小时 · 专收时间表漏掉的麻烦</p>
        </div>
        <button
          data-tut="btn-start-day"
          onClick={() => {
            if (tutorialStep === 0) {
              startTutorialDay();
              setTutorialStep(1);
            } else {
              startDay();
            }
            setHandledThisLocation(false);
            setActiveTab('map');
          }}
          className="relative z-10 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-10 py-4 text-lg font-black text-amber-950 shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:from-amber-400"
        >
          {tutorialStep === 0 ? '开始营业（新手引导）' : '开始营业'}
        </button>
        <button onClick={() => navigate('/')} className="relative z-10 text-slate-400 text-sm">返回首页</button>
        {/* 引导未开始：锁定开始营业按钮 */}
        {tutorialStep === 0 && (
          <TutorialSpotlight
            targetKey="btn-start-day"
            lines={TUTORIAL_START.lines}
            expression={TUTORIAL_START.expression}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050914] pb-chrome">
      <PageBackdrop
        image={pageBackdrop.image}
        mobileImage={pageBackdrop.mobileImage}
        position={pageBackdrop.position}
        overlayClassName="from-slate-950/50 via-slate-950/70 to-slate-950/90"
      />

      <div className="relative z-10">
        {/* 顶栏 */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
          <button
            onClick={() => navigate('/')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="flex-1 font-black text-white text-base">二十五时便利屋</h1>
          <button
            onClick={() => { const n = !soundOn; setSoundOn(n); setSoundEnabled(n); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 text-sm"
            aria-label={soundOn ? '静音' : '开启音效'}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <ResetSaveButton compact />
          {gameOver && (
            <button
              onClick={() => { resetDay(); setEndDayResult(null); setHandledThisLocation(false); setActiveTab('map'); }}
              className="flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/30"
            >
              <RefreshCw size={12} /> 新一天
            </button>
          )}
        </div>

        {/* 状态条 */}
        <StatusBar
          fatigue={fatigue} rep={rep} money={money}
          trust={trust}
          commissionNeed={gateGoal}
          normalTickets={normalTickets}
        />

        {/* 当前目标提示（引导期也显示——教学会引导玩家认识它） */}
        <GoalBar
          commission={commission}
          trust={trust}
          commissionNeed={commissionNeed}
          objectives={objectives}
          objectivesDone={objectivesDone}
          nextObjective={nextObjective}
          commissionReady={commissionReady}
          gameOver={gameOver}
          loc={loc}
          sideJobs={sideJobs}
        />

        {/* 今日待办 + 便利屋补给 */}
        <div className="px-3 pt-2 pb-2">
          <div className="grid grid-cols-2 gap-2">
            {POOL_CONFIG.map(pool => {
              const Icon = pool.icon;
              const pityRemain = GACHA_CONFIG.supplyPool.characterPity - supplyPityCounter;
              const isBoardPulse = pool.id === 'board' && !commission && !gameOver;
              return (
                <button
                  key={pool.id}
                  data-tut={pool.id === 'supply' ? 'btn-supply' : 'btn-board'}
	                  onClick={() => handleDraw(pool.id)}
	                  disabled={gameOver || drawBusy}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border bg-slate-900/60 py-2.5 px-3 text-left',
                    'disabled:opacity-40 hover:border-white/20 active:scale-95 transition-all',
                    isBoardPulse ? 'border-rose-400/60 shadow-[0_0_12px_rgba(251,113,133,0.3)] animate-pulse' : 'border-white/10',
                  )}
                >
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow', pool.color)}>
                    <Icon size={17} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white leading-tight">{pool.label}</p>
                    <p className="text-[9px] text-slate-500 leading-tight">{pool.sub}</p>
                    <p className="text-[9px] text-slate-400 leading-tight">
                      {pool.cost.replace('消耗 ', '')}
                      {pool.id === 'supply' && (
                        <span className="text-pink-300"> · 保底 {pityRemain} 抽</span>
                      )}
                      {pool.id === 'board' && !commission && (
                        <span className="text-rose-300"> · {board.length} 单待接</span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 导航 */}
        <div className="flex border-b border-white/10 mx-3">
          {([
            { id: 'map', label: '地图', icon: MapPin },
            { id: 'commission', label: '委托', icon: ClipboardList },
            { id: 'hand', label: '卡包', icon: Package },
            { id: 'log', label: '日志', icon: ScrollText },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-tut={`tab-${id}`}
              onClick={() => { playSound('tab-switch'); setActiveTab(id); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold transition-colors',
                activeTab === id ? 'text-amber-300 border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300',
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <div className="px-3 pt-3">

          {/* ── 地图 Tab ── */}
          {activeTab === 'map' && (
            <div className="space-y-3">
              {!loc ? (
                /* 路线选择 */
                <>
                  <p className="text-xs text-slate-400">选择前往的地点（疲劳见底前可以一直跑）：</p>
                  {routes.map(l => {
                    const isCommissionSpot = pendingTags.length > 0 && l.tags.some(t => pendingTags.includes(t));
                    return (
                      <button
                        key={l.id}
                        data-tut={`route-${l.id}`}
                        onClick={() => { if (!gameOver) { playSound('route-select'); chooseLocation(l); setHandledThisLocation(false); } }}
                        disabled={gameOver}
                        className={cn(
                          'w-full rounded-xl border bg-slate-900/60 p-3 text-left',
                          'active:scale-[0.99] transition-all disabled:opacity-40',
                          isCommissionSpot
                            ? 'border-rose-400/50 shadow-[0_0_10px_rgba(251,113,133,0.2)] hover:border-rose-300/70'
                            : 'border-white/10 hover:border-amber-400/40',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-bold text-white text-sm">
                            {l.name}
                            {isCommissionSpot && <span className="ml-1.5 rounded bg-rose-500/30 px-1 py-0.5 text-[9px] font-bold text-rose-200">📍 委托相关</span>}
                          </span>
                          <span className="text-[10px] text-amber-300 shrink-0">{l.recommend.join(' / ')}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {l.tags.map(t => (
                            <span key={t} className="rounded-full bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">{t}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                  {!gameOver && (
                    <button
                      onClick={() => {
                        if (fatigue >= FATIGUE_MAX - 4) return toast('累得不想再多走一步了。');
                        playSound('route-select');
                        applyDelta({ fatigue: 4 });
                        refreshRoutes();
                        addLog('🔄 花力气重新打听了一圈，换了一批落脚点。疲劳 +4。');
                      }}
                      className="w-full rounded-xl border border-dashed border-white/20 bg-slate-900/40 py-2.5 text-xs font-bold text-slate-400 hover:border-amber-400/40 hover:text-amber-300 active:scale-[0.99] transition-all"
                    >
                      🔄 重新打听（换一批地点 · 疲劳 +4）
                    </button>
                  )}
                  {gameOver && (
                    <p className="text-center text-sm text-slate-500 py-4">今日已结束。点击"新一天"重新开始。</p>
                  )}
                </>
              ) : (
                /* 场景 + 热点 */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="font-black text-white text-base">{loc.name}</h2>
                      <div className="flex gap-1 mt-0.5">
                        {loc.recommend.map(r => (
                          <span key={r} className="rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-[10px] text-amber-300">{r}</span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{loc.tags.join(' · ')}</span>
                  </div>

                  {/* 场景热点区域（沉浸式：装饰 + NPC + 语义化热点标记） */}
                  <div
                    className="relative rounded-2xl overflow-hidden border border-white/10"
                    style={{ height: 300, background: assetCssBackground(loc.bg) }}
                  >
                    {/* 氛围层 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-3 pointer-events-none">
                      <span className="text-lg font-black text-white/90 drop-shadow">{loc.name}</span>
                      <span className="text-[10px] text-white/50">{loc.tags.join(' · ')}</span>
                    </div>

                    {/* 场景装饰（纯演出） */}
                    {loc.scenery?.map((d, i) => (
                      <span
                        key={`deco-${i}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 opacity-50 pointer-events-none select-none"
                        style={{ left: `${d.x}%`, top: `${d.y}%`, fontSize: d.size ?? 22 }}
                      >
                        {d.emoji}
                      </span>
                    ))}

                    {/* 路人 NPC：点击闲聊（不影响规则） */}
                    {loc.npcs?.map((npc, i) => (
                      <button
                        key={`npc-${i}`}
                        onClick={() => setNpcTalk({
                          name: npc.name,
                          emoji: npc.emoji,
                          line: npc.lines[Math.floor(Math.random() * npc.lines.length)],
                        })}
                        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-xl opacity-80 transition-transform hover:scale-125 active:scale-95"
                        style={{ left: `${npc.x}%`, top: `${npc.y}%` }}
                        title={npc.name}
                      >
                        {npc.emoji}
                      </button>
                    ))}

                    {/* 热点标记：图标 + 名称牌 */}
                    {loc.spots.map((spot, i) => {
                      const isDone = done[loc.id]?.[i] ?? false;
                      return (
                        <button
                          key={i}
                          data-tut={`spot-${loc.id}-${i}`}
                          onClick={() => handleSpotClick(spot, i)}
                          disabled={isDone || gameOver}
                          className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
                          style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                        >
                          <span
                            className={cn(
                              'flex h-11 w-11 items-center justify-center rounded-full border-2 text-lg shadow-lg transition-all',
                              isDone
                                ? 'border-emerald-400/50 bg-emerald-500/20 opacity-60'
                                : spot.type === 'danger'
                                  ? 'border-red-300 bg-red-500/40 shadow-[0_0_18px_rgba(239,68,68,0.6)] animate-pulse'
                                  : spot.type === 'quest'
                                    ? 'border-pink-300 bg-pink-500/40 shadow-[0_0_18px_rgba(244,114,182,0.6)] animate-pulse'
                                    : 'border-cyan-300 bg-cyan-500/40 shadow-[0_0_18px_rgba(34,211,238,0.6)] animate-pulse',
                            )}
                          >
                            {isDone ? '✓' : spot.icon ?? '❗'}
                          </span>
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm',
                            isDone ? 'bg-black/40 text-emerald-300/70 line-through' : 'bg-black/60 text-white shadow',
                          )}>
                            {spot.name}
                          </span>
                        </button>
                      );
                    })}

                    {/* NPC 闲聊气泡 */}
                    <AnimatePresence>
                      {npcTalk && (
                        <motion.div
                          key={npcTalk.name + npcTalk.line}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setNpcTalk(null)}
                          className="absolute inset-x-3 bottom-3 z-30 rounded-xl border border-white/20 bg-black/80 px-3 py-2.5 backdrop-blur"
                        >
                          <p className="text-[10px] font-bold text-amber-300">{npcTalk.emoji} {npcTalk.name}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-200">{npcTalk.line}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 委托 Tab ── */}
          {activeTab === 'commission' && (
            <div>
              {!commission ? (
                /* ── 委托板：今日 3 选 1 ── */
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-400">今日委托板——选一单接下,她在等你:</p>
                  {board.length === 0 && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center">
                      <p className="text-sm text-slate-400">今日委托板已空</p>
                      <p className="text-xs text-slate-500">先开始营业,委托板每天更新</p>
                    </div>
                  )}
                  {board.map(id => {
                    const c = commissions.find(x => x.id === id);
                    if (!c) return null;
                    const isRevisitItem = flags.includes(`commission_${id}_done`);
                    const targetChar = getCharacterById(c.target);
                    return (
                      <div key={id} className={cn(
                        'rounded-xl border p-3',
                        isRevisitItem ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5',
                      )}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {targetChar && <img src={assetUrl(targetChar.avatarUrl)} alt={targetChar.name} className="h-8 w-8 rounded-full object-cover shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm font-black text-white truncate">
                                {c.name}
                                {isRevisitItem && <span className="ml-1.5 rounded bg-emerald-500/30 px-1 py-0.5 text-[9px] font-bold text-emerald-200">回访</span>}
                              </p>
                              <p className="text-[10px] text-slate-400">{targetChar?.name} · 子目标 ×{c.objectives?.length ?? 0}</p>
                            </div>
                          </div>
                          <span className={cn('text-xs font-bold shrink-0', rarityColor(c.rarity))}>{c.rarity}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{c.desc}</p>
                        <button
                          data-tut={`btn-accept-${id}`}
                          onClick={() => { if (!gameOver) { playSound('commission-accept'); acceptCommission(id); } }}
                          disabled={gameOver || fatigue >= FATIGUE_EXHAUSTED}
                          className={cn(
                            'w-full rounded-lg py-2 text-xs font-black text-white disabled:opacity-40 active:scale-[0.99] transition-all',
                            isRevisitItem ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-rose-500 to-pink-600',
                          )}
                        >
                          {fatigue >= FATIGUE_EXHAUSTED
                            ? '太累了，先休息再接单'
                            : isRevisitItem ? '再帮她一次（回访单 · 奖励递减）' : '接单'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-rose-500/40 bg-gradient-to-br from-rose-500/10 to-pink-500/5 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-black text-white text-sm">{commission.name}</h3>
                    <span className={cn('text-xs font-bold shrink-0', rarityColor(commission.rarity))}>{commission.rarity}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{commission.desc}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {commission.tags.map(t => (
                      <span key={t} className="rounded-full bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">{t}</span>
                    ))}
                  </div>
                  {/* 信任进度 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-400">信任进度</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-400 transition-all duration-500"
                        style={{ width: `${commissionNeed > 0 ? Math.min(100, (trust / commissionNeed) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-rose-300">{trust}/{commissionNeed}</span>
                  </div>
                  {/* 目标角色 */}
                  {(() => {
                    const targetChar = getCharacterById(commission.target);
                    return targetChar ? (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                        <img src={assetUrl(targetChar.avatarUrl)} alt={targetChar.name} className="h-8 w-8 rounded-full object-cover" />
                        <div>
                          <p className="text-xs font-bold text-white">{targetChar.name}</p>
                          <p className="text-[10px] text-slate-400">{targetChar.title}</p>
                        </div>
                        <span className="ml-auto text-[10px] rounded-full bg-slate-700 px-2 py-0.5 text-amber-300">{targetChar.serviceType}</span>
                      </div>
                    ) : null;
                  })()}

                  {/* 子目标清单 */}
                  {objectives.length > 0 && (
                    <div data-tut="objectives-list" className="mt-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">子目标 {objectivesDone.length}/{objectives.length}</p>
                      {objectives.map(o => {
                        const isDone = objectivesDone.includes(o.id);
                        return (
                          <div key={o.id} className={cn(
                            'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
                            isDone ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-white/5 border border-white/10',
                          )}>
                            <span className="shrink-0">{isDone ? '✅' : '⬜'}</span>
                            <div className="min-w-0">
                              <p className={cn('font-bold', isDone ? 'text-emerald-300 line-through' : 'text-white')}>{o.desc}</p>
                              {!isDone && (
                                <p className="text-[10px] text-slate-400">
                                  {o.locTag ? `在【${o.locTag}】类地点` : '任意地点'}打出 {o.need.join('/')} 卡（匹配热点）
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 交付 CTA */}
                  {commission.graph && commission.graph.nodes.length > 0 ? (
                    <button
                      data-tut="btn-deliver"
                      onClick={() => {
                        // 回访单无回访幕时不进剧场，直接结算交付
                        if (isRevisit && !commission.replayScene) handleTheaterComplete(true);
                        else setShowTheater(true);
                      }}
                      disabled={gameOver || !commissionReady}
                      className="mt-3 w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3 text-sm font-black text-white shadow-[0_0_24px_rgba(244,63,94,0.35)] hover:from-rose-400 disabled:opacity-40 active:scale-[0.99] transition-all"
                    >
                      {objectives.length > 0
                        ? (commissionReady ? (isRevisit ? '▶ 交付回访单' : '▶ 交付委托') : `完成全部子目标后交付（${objectivesDone.length}/${objectives.length}）`)
                        : (commissionReady ? '▶ 进入委托现场' : `信任达标后进入现场（${trust}/${commissionNeed}）`)}
                    </button>
                  ) : (
                    <p className="mt-3 text-center text-[10px] text-slate-500">（本委托剧本制作中，敬请期待）</p>
                  )}
                  <p className="mt-2 text-center text-[10px] text-slate-500">
                    提示：信任影响交付结局的好坏（{trust}/{gateGoal}），子目标决定能否交付。委托永不过期，进度跨天保留。
                  </p>
                  {/* 放弃委托：唯一的失败途径（教学期隐藏，防卡新手引导） */}
                  {!gameOver && !tutorialActive && (
                    <button
                      onClick={() => setShowAbandonConfirm(true)}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800/60 py-2 text-[11px] font-bold text-slate-400 hover:bg-slate-700/60 active:scale-[0.99] transition-all"
                    >
                      ✕ 放弃委托（她会失望的）
                    </button>
                  )}
                </div>
              )}

              {/* ── 顺手单 ── */}
              {sideJobs.length > 0 && (
                <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">顺手单 · 跑图途中顺手完成</p>
                  <div className="space-y-1.5">
                    {sideJobs.map(sj => {
                      const tpl = getSideJobById(sj.id);
                      if (!tpl) return null;
                      return (
                        <div key={sj.id} className={cn(
                          'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
                          sj.done ? 'bg-emerald-500/10' : 'bg-white/5',
                        )}>
                          <span className="shrink-0">{sj.done ? '✅' : '🧾'}</span>
                          <div className="min-w-0">
                            <p className={cn('font-bold', sj.done ? 'text-emerald-300 line-through' : 'text-slate-200')}>{tpl.title}</p>
                            {!sj.done && (
                              <p className="text-[10px] text-slate-500">
                                {tpl.text} {tpl.locTag ? `【${tpl.locTag}】地点` : '任意地点'} {tpl.need.join('/')} 卡 ·
                                奖励 {tpl.reward.money ? `资金+${tpl.reward.money}` : ''}{tpl.reward.normalTickets ? `普通券+${tpl.reward.normalTickets}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 卡包 Tab ── */}
          {activeTab === 'hand' && (
            <div className="space-y-4">
              {/* 人物卡 */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">人物卡 · 持续可用</p>
                {personCards.length === 0 ? (
                  <p className="text-xs text-slate-500">从【人物频道】抽卡获得角色</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {personCards.map(p => (
                      <div key={p.id} className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          {(() => {
                            const c = getCharacterById(p.id);
                            return c ? <img src={assetUrl(c.avatarUrl)} alt={c.name} className="h-7 w-7 rounded-full object-cover" /> : null;
                          })()}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">Lv.{p.level} {p.name}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300">{p.serviceType}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* 消耗卡 */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">手牌 · 使用后消耗</p>
                {hand.length === 0 ? (
                  <p className="text-xs text-slate-500">从技能/便利/情报频道抽卡</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {hand.map(c => (
                      <div
                        key={c.uid}
                        className={cn(
                          'rounded-xl border p-3',
                          c.kind === 'skill' ? 'border-amber-500/30 bg-amber-500/10' :
                          c.kind === 'tool'  ? 'border-cyan-500/30 bg-cyan-500/10' :
                                               'border-emerald-500/30 bg-emerald-500/10',
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">{c.name}</span>
                          <span className={cn('text-[10px] font-bold', rarityColor(c.rarity))}>{c.rarity}</span>
                        </div>
                        <div className="flex gap-1 mb-1">
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">{kindName(c.kind)}</span>
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">{c.type}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">{c.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 日志 Tab ── */}
          {activeTab === 'log' && (
            <div className="space-y-1.5">
              {log.length === 0 ? (
                <p className="text-xs text-slate-500">暂无记录</p>
              ) : log.map((entry, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg border p-2 text-xs',
                    entry.cls === 'good' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200' :
                    entry.cls === 'bad'  ? 'border-red-500/30 bg-red-500/5 text-red-200' :
                    entry.cls === 'draw' ? 'border-amber-500/30 bg-amber-500/5 text-amber-200' :
                    entry.cls === 'play' ? 'border-cyan-500/30 bg-cyan-500/5 text-cyan-200' :
                                           'border-white/10 bg-white/5 text-slate-300',
                  )}
                >
                  {entry.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 底部操作区 ── */}
      <div ref={actionBarRef} style={{ bottom: 'var(--nav-h, 0px)' }} className="fixed left-0 right-0 z-50 border-t border-white/10 bg-slate-950/95 backdrop-blur-xl px-3 py-2 flex flex-wrap gap-2">
        {loc && (
          <>
            {!handledThisLocation && (
              <button
                onClick={() => { leaveLocation(); setHandledThisLocation(false); }}
                disabled={gameOver}
                className="rounded-xl bg-slate-800 border border-white/10 px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              >
                ↩ 换地点
              </button>
            )}
            <button
              data-tut="btn-finish-location"
              onClick={handleFinishLocation}
              disabled={gameOver}
              className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-sm font-black text-amber-950 disabled:opacity-40"
            >
              ✅ 完成当前地点
            </button>
          </>
        )}
        {(() => {
          const today = new Date().toISOString().slice(0, 10);
          const nextRelief = coffeeRelief(coffees.date === today ? coffees.n : 0);
          return (
            <button
              onClick={() => {
                if (money < COFFEE_COST) return toast(`资金不足，咖啡 ${COFFEE_COST} 块一杯。`);
                const relief = buyCoffee();
                if (relief > 0) toast(`☕ 咕嘟咕嘟……疲劳 -${relief}（资金 -${COFFEE_COST}）`);
              }}
              disabled={gameOver || money < COFFEE_COST || nextRelief === 0}
              className="rounded-xl bg-slate-800 border border-white/10 px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              {nextRelief > 0 ? `☕ 买咖啡（疲劳 -${nextRelief}）` : '☕ 今天喝不下了'}
            </button>
          );
        })()}
        {!gameOver && (
          <button
            onClick={handleEndDay}
            className={cn('rounded-xl bg-indigo-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-indigo-600', !loc && 'flex-1')}
          >
            🌙 打烊休息
          </button>
        )}
      </div>

      {/* ── 事件弹窗 ── */}
      <AnimatePresence>
        {currentEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm px-3 pb-3"
            onClick={() => setCurrentEvent(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border border-white/10 p-4 shadow-2xl"
            >
              {/* 热点信息 */}
              <div className="mb-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-black text-white text-base">{currentEvent.spot.name}</h3>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    currentEvent.spot.type === 'danger' ? 'bg-red-500/20 text-red-300' :
                    currentEvent.spot.type === 'quest' ? 'bg-pink-500/20 text-pink-300' :
                    'bg-cyan-500/20 text-cyan-300',
                  )}>
                    {currentEvent.spot.type}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-2">{currentEvent.spot.text}</p>
                <div className="flex gap-1 flex-wrap mb-1.5">
                  {currentEvent.spot.need.map(n => (
                    <span key={n} className="rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-[10px] text-amber-300">推荐: {n}</span>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500">打出与推荐类型匹配的卡（黄色高亮）可获得额外信任</p>
              </div>

              {/* 普通处理 */}
              <div className="mb-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">普通处理</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleResolve(null)}
                    className="rounded-xl border border-white/10 bg-slate-800 p-3 text-left hover:bg-slate-700 active:scale-[0.98] transition-all"
                  >
                    <p className="text-xs font-bold text-white mb-1">直接处理</p>
                    <p className="text-[10px] text-slate-400">不使用卡，成本高、反馈平。</p>
                  </button>
                  <button
                    onClick={() => setCurrentEvent(null)}
                    className="rounded-xl border border-white/10 bg-slate-800 p-3 text-left hover:bg-slate-700 active:scale-[0.98] transition-all"
                  >
                    <p className="text-xs font-bold text-white mb-1">暂不处理</p>
                    <p className="text-[10px] text-slate-400">关闭面板，稍后再来。</p>
                  </button>
                </div>
                {currentEvent.spot.risk && (
                  <button
                    onClick={handleRisk}
                    className="mt-2 w-full rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-left hover:bg-red-500/20 active:scale-[0.98] transition-all"
                  >
                    <p className="text-xs font-bold text-red-300 mb-1">⚡ {currentEvent.spot.risk.label}</p>
                    <p className="text-[10px] text-slate-400">
                      {(() => {
                        const d = currentEvent.spot.risk!.delta;
                        const f = fatigueFromDelta(d);
                        const labels = { trust: '信任', rep: '口碑', money: '资金' } as const;
                        return [
                          f !== 0 ? `疲劳${f > 0 ? '+' : ''}${f}` : '',
                          ...(Object.keys(labels) as (keyof typeof labels)[])
                            .map(k => d[k] ? `${labels[k]}${(d[k] as number) > 0 ? '+' : ''}${d[k]}` : ''),
                        ].filter(Boolean).join('，');
                      })()}
                    </p>
                  </button>
                )}
              </div>

              {/* 卡牌分组 */}
              {[
                { title: '人物卡：谁来帮我', cards: personCards, isPerson: true },
                { title: '技能卡：怎么解决', cards: hand.filter(c => c.kind === 'skill'), isPerson: false },
                { title: '便利卡：快速改局', cards: hand.filter(c => c.kind === 'tool'), isPerson: false },
                { title: '情报卡：提前知道', cards: hand.filter(c => c.kind === 'info'), isPerson: false },
              ].map(({ title, cards, isPerson }) => (
                <div key={title} className="mb-3">
                  <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-1.5">{title}</p>
                  {cards.length === 0 ? (
                    <p className="text-[10px] text-slate-500 pl-1">暂无该类卡。</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {[...cards].sort((a, b) => {
                        const aType = isPerson ? (a as PersonCard).serviceType : (a as HandCard).type;
                        const bType = isPerson ? (b as PersonCard).serviceType : (b as HandCard).type;
                        return scoreCard(bType, currentEvent.spot.need) - scoreCard(aType, currentEvent.spot.need);
                      }).map(card => {
                        const cardType = isPerson ? (card as PersonCard).serviceType : (card as HandCard).type;
                        const matched = isMatch(cardType, currentEvent.spot.need);
                        return (
                          <button
                            key={isPerson ? (card as PersonCard).id : (card as HandCard).uid}
                            data-tut={isPerson ? undefined : `card-${(card as HandCard).id}`}
                            onClick={() => {
                              if (isPerson) handleResolve(card as PersonCard);
                              else handleResolve(card as HandCard & { kind: 'skill' | 'tool' | 'info' });
                            }}
                            className={cn(
                              'rounded-xl border p-2.5 text-left active:scale-[0.98] transition-all',
                              matched
                                ? 'border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/15'
                                : 'border-white/10 bg-slate-800 hover:bg-slate-700',
                            )}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-xs font-bold text-white truncate">
                                {matched ? '✨ ' : ''}{isPerson ? (card as PersonCard).name : (card as HandCard).name}
                              </span>
                              {!isPerson && (
                                <span className={cn('text-[10px] font-bold shrink-0', rarityColor((card as HandCard).rarity))}>
                                  {(card as HandCard).rarity}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 mb-1">
                              <span className="rounded-full bg-white/10 px-1 py-0.5 text-[9px] text-slate-300">
                                {cardType}
                              </span>
                              {isPerson && (
                                <span className="rounded-full bg-white/10 px-1 py-0.5 text-[9px] text-slate-300">
                                  Lv.{(card as PersonCard).level}
                                </span>
                              )}
                            </div>
                            {!isPerson && (
                              <p className="text-[9px] text-slate-400 line-clamp-2">{(card as HandCard).desc}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 放弃委托确认弹窗 ── */}
      <AnimatePresence>
        {showAbandonConfirm && commission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
            onClick={() => setShowAbandonConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 22 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-red-500/40 bg-slate-900 p-5 text-center shadow-[0_0_60px_rgba(239,68,68,0.2)]"
            >
              <div className="text-3xl mb-2">💔</div>
              <h2 className="text-base font-black text-white mb-1.5">真的要放弃【{commission.name}】？</h2>
              <p className="text-xs text-slate-400 mb-4">
                {(() => {
                  const owned = ownedCharacters.some(o => o.characterId === commission.target);
                  const targetChar = getCharacterById(commission.target);
                  const name = targetChar?.name ?? '她';
                  if (owned) return `${name}会很失望：好感下降，且一段时间内不会再发委托给你。`;
                  if (commission.rarity === 'SR' || commission.rarity === 'SSR') return `放${name}鸽子的消息会传开：一段时间内你将更难遇到她（出现率下降），她的委托也不会上板。`;
                  return '放了客人鸽子，口碑会受损（-1）。';
                })()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAbandonConfirm(false)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-2.5 text-sm font-black text-white"
                >
                  继续做下去
                </button>
                <button
                  onClick={() => { abandonCommission(); setShowAbandonConfirm(false); toast('委托已放弃。'); }}
                  className="flex-1 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/20"
                >
                  放弃委托
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 结算弹窗 ── */}
      <AnimatePresence>
        {endDayResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 22 }}
              className={cn(
                'w-full max-w-sm rounded-2xl border p-6 text-center',
                endDayResult === 'success'
                  ? 'border-amber-500/40 bg-slate-900 shadow-[0_0_60px_rgba(251,191,36,0.2)]'
                  : 'border-red-500/40 bg-slate-900 shadow-[0_0_60px_rgba(239,68,68,0.2)]',
              )}
            >
              <div className="text-4xl mb-3">{endDayResult === 'success' ? '🎉' : commission ? '🌙' : '😔'}</div>
              <h2 className="text-xl font-black text-white mb-2">
                {endDayResult === 'success' ? '委托完成！' : '今日打烊'}
              </h2>
              {endDayResult === 'success' && completedName && (
                <p className="text-sm text-slate-400 mb-4">
                  【{completedName}】已完成，角色好感度提升，相关视频已解锁。
                </p>
              )}
              {endDayResult === 'fail' && (
                <p className="text-sm text-slate-400 mb-4">
                  {commission
                    ? `委托【${commission.name}】进度已保留——明天接着为她奔走，她等你。`
                    : '明天再加油吧。'}
                </p>
              )}
              <button
                onClick={() => { setEndDayResult(null); setCompletedName(null); resetDay(); setHandledThisLocation(false); setActiveTab('map'); }}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-black text-amber-950"
              >
                开始新的一天
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 抽卡动画 ── */}
      {/* ── 补给开箱演出（非人物出货） ── */}
      <AnimatePresence>
        {revealItem && <SupplyReveal item={revealItem} onClose={closeRevealItem} />}
      </AnimatePresence>

      {showGacha && gachaResults.length > 0 && (
        <GachaAnimation
          results={gachaResults}
          isTenPull={false}
          onComplete={handleGachaComplete}
        />
      )}

      {/* ── 委托剧场（分幕：接单开场/子目标幕；交付：结局幕） ── */}
      {commission && commission.graph && commission.graph.nodes.length > 0 && (pendingScene || showTheater) && (
        <CommissionTheater
          key={pendingScene ? `scene-${pendingScene.start}` : 'final'}
          commission={commission}
          scene={pendingScene ?? (isRevisit ? commission.replayScene : commission.finalScene)}
          initialTrust={trust}
          trustGoal={gateGoal}
          onSceneEnd={() => setPendingScene(null)}
          onComplete={handleTheaterComplete}
          onExit={() => { setPendingScene(null); setShowTheater(false); }}
          tutorialLock={tutorialActive}
        />
      )}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed above-chrome left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-800 border border-white/10 px-4 py-2 text-sm text-white shadow-xl"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 新手引导导演（全屏演出期间让位） ── */}
      {tutorialActive && tutStep && !tutorialOverlayHidden && (
        <TutorialDirector step={tutStep} ctx={tutCtx} onButton={handleTutorialButton} />
      )}
    </div>
  );

  /* ── 检查强制打烊（在改变疲劳/口碑的操作后调用） ── */
  function checkAndFail() {
    // 状态更新是异步的，延迟一帧检查
    setTimeout(() => {
      const s = useShopStore.getState();
      if (checkFail(s) && !s.gameOver) {
        s.setGameOver(true);
        s.addLog('🌙 强制打烊：疲劳爆表或口碑见底。委托进度已保留。', 'bad');
        setEndDayResult('fail');
      }
    }, 0);
  }
}
