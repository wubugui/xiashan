/**
 * 都市便利屋 · 分池抽卡 主界面
 * 移动端竖屏布局，复用 GachaAnimation。
 */
import { useState, useCallback } from 'react';
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
import { pullSupply } from '@/engine/gachaEngine';
import { isMatch, scoreCard, resolveSpot, hitsRequirement, applyCommissionRewards } from '@/engine/shopEngine';
import { getSideJobById } from '@/data/sideJobs';
import { checkPhoneEvents } from '@/engine/phoneScheduler';
import GachaAnimation from '@/components/GachaAnimation';
import CommissionTheater from '@/components/CommissionTheater';
import ResetSaveButton from '@/components/ResetSaveButton';
import type { Spot } from '@/data/types';

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

/* ────── 常量 ────── */
const POOL_CONFIG = [
  { id: 'board',  label: '委托板', sub: '今日 3 选 1 接单', cost: '免费接单', color: 'from-rose-500 to-pink-700', icon: ClipboardList },
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
  time, energy, rep, money, trust, step, commissionNeed,
  normalTickets,
}: {
  time: number; energy: number; rep: number; money: number;
  trust: number; step: number; commissionNeed: number;
  normalTickets: number;
}) {
  const pct = commissionNeed > 0 ? Math.min(100, (trust / commissionNeed) * 100) : 0;
  return (
    <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl px-3 py-2 text-xs">
      {/* 资源行 */}
      <div className="flex gap-2 flex-wrap mb-1.5">
        {[
          { label: '⏱', val: time, warn: time <= 3 },
          { label: '⚡', val: energy, warn: energy <= 2 },
          { label: '📣', val: rep, warn: rep <= 1 },
          { label: '💴', val: money },
          { label: '🎫普', val: normalTickets },
        ].map(({ label, val, warn }) => (
          <span key={label} className={cn('rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-bold', warn ? 'text-red-400' : 'text-slate-200')}>
            {label} <b>{val}</b>
          </span>
        ))}
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-bold text-slate-200">
          路线 <b>{Math.min(step, 5)}</b>/5
        </span>
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

/* ────── 主组件 ────── */
export default function Shop() {
  const navigate = useNavigate();

  /* ── Stores ── */
  const playerStore = usePlayerStore();
  const shopStore = useShopStore();

  const {
    time, energy, rep, money, trust, step, commission, loc, routes, done, hand, log, gameOver,
    board, overdue, objectivesDone, sideJobs, pendingScene,
    startDay, refreshRoutes, acceptCommission, completeObjective, completeSideJob,
    setPendingScene, setOverdue, chooseLocation, addHandCard, consumeHandCard,
    applyDelta, markSpotDone, finishLocation, normalAdvance, addLog, setGameOver, resetDay,
  } = shopStore;

  const {
    ownedCharacters, affinityMap, supplyPityCounter,
    normalTickets,
    spendNormalTickets, setSupplyPityCounter,
    addNormalTickets,
    addGachaResult, addCharacter,
    addSpiritStones, addReputation,
  } = playerStore;

  /* ── 本地 UI 状态 ── */
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [currentEvent, setCurrentEvent] = useState<{ spot: Spot; spotIndex: number; locId: string } | null>(null);
  const [gachaResults, setGachaResults] = useState<AnimGachaResult[]>([]);
  const [showGacha, setShowGacha] = useState(false);
  const [endDayResult, setEndDayResult] = useState<'success' | 'fail' | null>(null);
  const [showTheater, setShowTheater] = useState(false);
  const [handledThisLocation, setHandledThisLocation] = useState(false);

  /* ── 初始化 ── */
  const isNew = routes.length === 0 && !gameOver && commission === null && step === 1 && time === 13;
  const commissionNeed = commission?.need ?? 0;
  const objectives = commission?.objectives ?? [];
  const allObjectivesDone = objectives.length > 0 && objectives.every(o => objectivesDone.includes(o.id));
  /** 有子目标的委托：结局分水岭 = need+5（统一信任口径）；交付条件 = 全部子目标完成 */
  const gateGoal = commission ? commission.need + (objectives.length > 0 ? 5 : 0) : 0;
  const commissionReady = !!commission && (objectives.length > 0 ? allObjectivesDone : trust >= commissionNeed);

  /* ────── 抽卡 ────── */
  const handleDraw = useCallback((pool: PoolId) => {
    if (gameOver) return toast('今日已结束。');

    if (pool === 'board') {
      setActiveTab('commission');
      return;
    } else if (pool === 'supply') {
      if (!spendNormalTickets(1)) return toast('普通券不足。');
      const ownedIds = ownedCharacters.map(o => o.characterId);
      const { result, newPity } = pullSupply(ownedIds, affinityMap, supplyPityCounter);
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
        addHandCard(result.card);
        const remain = GACHA_CONFIG.supplyPool.characterPity - newPity;
        addLog(`便利屋补给：抽到【${result.card.name}】（${result.card.type}）。距人物保底还剩 ${remain} 抽。`, 'draw');
      }
    }
  }, [gameOver, spendNormalTickets, ownedCharacters, affinityMap, supplyPityCounter, setSupplyPityCounter, addCharacter, addGachaResult, addHandCard, addLog]);

  /* ────── 热点点击 ────── */
  const handleSpotClick = useCallback((spot: Spot, spotIndex: number) => {
    if (!loc) return;
    if (done[loc.id]?.[spotIndex]) return toast('这个热点已经处理过了。');
    setCurrentEvent({ spot, spotIndex, locId: loc.id });
    setActiveTab('map'); // 确保弹窗在地图 tab 上显示
  }, [loc, done]);

  /* ────── 事件结算 ────── */
  const handleResolve = useCallback((card: (HandCard & { kind: 'skill' | 'tool' | 'info' }) | PersonCard | null) => {
    if (!currentEvent || !loc) return;
    const { spot, spotIndex, locId } = currentEvent;

    const { text, cls, delta } = resolveSpot(spot, card);

    // 消耗一次性手牌
    if (card && card.kind !== 'person') {
      consumeHandCard((card as HandCard).uid);
      addLog(`消耗${kindName(card.kind)}【${card.name}】。`, 'play');
    }

    // 情报卡"城市情报"刷新路线
    if (card && card.kind === 'info' && card.name === '城市情报') {
      refreshRoutes();
    }

    applyDelta(delta);
    markSpotDone(locId, spotIndex);
    setHandledThisLocation(true);
    addLog(text, cls);

    // 子目标 / 顺手单命中判定：在匹配热点上打出要求 type 的卡
    if (card) {
      const cardType = card.kind === 'person' ? card.serviceType : (card as HandCard).type;
      if (commission?.objectives) {
        for (const obj of commission.objectives) {
          if (objectivesDone.includes(obj.id)) continue;
          if (hitsRequirement(obj, cardType, spot, loc.tags)) {
            completeObjective(obj.id); // 入队该子目标的剧场幕
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

    // 检查失败
    const newState = {
      time: Math.max(0, time + (delta.time ?? 0)),
      energy: Math.max(0, energy + (delta.energy ?? 0)),
      rep: Math.max(0, rep + (delta.rep ?? 0)),
    };
    if (checkFail(newState)) {
      setGameOver(true);
      addLog('今日失败：时间、精力或口碑耗尽。', 'bad');
      setEndDayResult('fail');
    }
  }, [currentEvent, loc, commission, objectivesDone, sideJobs, time, energy, rep,
    consumeHandCard, applyDelta, markSpotDone, completeObjective, completeSideJob,
    addNormalTickets, addSpiritStones, addLog, refreshRoutes, setGameOver]);

  /* ────── 结束当天 ────── */
  const handleEndDay = useCallback(() => {
    // 子目标制委托只能通过「交付」(剧场结局)完成；endDay 兜底视为未交付
    const legacySuccess = !!commission && !commission.objectives?.length && trust >= commission.need;
    if (legacySuccess && commission) {
      applyCommissionRewards(commission.rewardEffects);
      addNormalTickets(4);
      addReputation(1);
      dispatchAvailablePhoneEvents(addLog);
      addLog(`今日完成：【${commission.name}】。奖励：普通券+4，口碑+1。`, 'good');
      setEndDayResult('success');
    } else {
      if (commission) {
        setOverdue({ id: commission.id, daysLeft: 2 });
        addLog(`委托【${commission.name}】今日未交付，转入逾期——明日委托板可重接（口碑 -1）。`, 'bad');
      }
      addNormalTickets(1);
      addLog('今日结束。补偿普通券 +1。', 'bad');
      setEndDayResult('fail');
    }
    setGameOver(true);
  }, [commission, trust, addNormalTickets, addReputation, setOverdue, addLog, setGameOver]);

  /* ────── 完成地点 ────── */
  const handleFinishLocation = useCallback(() => {
    if (gameOver) return;
    if (!loc) return toast('先选择地点。');
    if (!handledThisLocation) return toast('至少处理一个热点后才能完成当前地点。');
    const result = finishLocation();
    setHandledThisLocation(false);
    if (result === 'end_day') handleEndDay();
  }, [gameOver, loc, handledThisLocation, finishLocation, handleEndDay]);

  /* ────── 委托剧场结算 ────── */
  const handleTheaterComplete = useCallback((ok: boolean) => {
    setShowTheater(false);
    setPendingScene(null);
    if (!commission) return;
    if (overdue?.id === commission.id) setOverdue(null); // 逾期单已了结
    if (ok) {
      // 好感写入独立 affinityMap，无需持有；入伙只走补给池抽卡（设计文档 6.3）
      applyCommissionRewards(commission.rewardEffects);
      addNormalTickets(4);
      addReputation(1);
      dispatchAvailablePhoneEvents(addLog);
      addLog(`委托交付：【${commission.name}】。奖励：普通券+4，口碑+1，相关影像已解锁。`, 'good');
      setEndDayResult('success');
    } else {
      addNormalTickets(1);
      addLog(`委托收尾不顺：【${commission.name}】。她还是谢了你，但结局差了点意思。补偿普通券 +1。`, 'bad');
      setEndDayResult('fail');
    }
    setGameOver(true);
  }, [commission, overdue, setOverdue, setPendingScene, addNormalTickets, addReputation, addLog, setGameOver]);

  /* ────── Toast ────── */
  const [toastMsg, setToastMsg] = useState('');
  function toast(msg: string) {
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

  /* ─────────────────────── RENDER ─────────────────────── */

  /* 开始界面 */
  if (isNew) {
    return (
      <div className="min-h-screen bg-[#080b12] flex flex-col items-center justify-center px-6 gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-black text-amber-300 mb-2">二十五时便利屋</h1>
          <p className="text-slate-400 text-sm">开在一天的第二十五小时 · 专收时间表漏掉的麻烦</p>
        </div>
        <button
          onClick={() => { startDay(); setHandledThisLocation(false); setActiveTab('map'); }}
          className="rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-10 py-4 text-lg font-black text-amber-950 shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:from-amber-400"
        >
          开始营业
        </button>
        <button onClick={() => navigate('/')} className="text-slate-500 text-sm">返回首页</button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080b12] pb-32">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 pointer-events-none" />

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
          time={time} energy={energy} rep={rep} money={money}
          trust={trust} step={step}
          commissionNeed={gateGoal}
          normalTickets={normalTickets}
        />

        {/* 抽卡频道 */}
        <div className="px-3 pt-3 pb-2">
          <p className="text-[10px] text-slate-500 mb-1.5 font-medium uppercase tracking-wider">抽卡频道</p>
          <div className="grid grid-cols-2 gap-2">
            {POOL_CONFIG.map(pool => {
              const Icon = pool.icon;
              const pityRemain = GACHA_CONFIG.supplyPool.characterPity - supplyPityCounter;
              return (
                <button
                  key={pool.id}
                  onClick={() => handleDraw(pool.id)}
                  disabled={gameOver}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-900/60 py-2.5 px-3 text-left',
                    'disabled:opacity-40 hover:border-white/20 active:scale-95 transition-all',
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
              onClick={() => setActiveTab(id)}
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
                  <p className="text-xs text-slate-400">选择前往的地点（共 5 段路线）：</p>
                  {routes.map(l => (
                    <button
                      key={l.id}
                      onClick={() => { if (!gameOver) { chooseLocation(l); setHandledThisLocation(false); } }}
                      disabled={gameOver}
                      className={cn(
                        'w-full rounded-xl border border-white/10 bg-slate-900/60 p-3 text-left',
                        'hover:border-amber-400/40 active:scale-[0.99] transition-all disabled:opacity-40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-bold text-white text-sm">{l.name}</span>
                        <span className="text-[10px] text-amber-300 shrink-0">{l.recommend.join(' / ')}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {l.tags.map(t => (
                          <span key={t} className="rounded-full bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">{t}</span>
                        ))}
                      </div>
                    </button>
                  ))}
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

                  {/* 场景热点区域 */}
                  <div
                    className="relative rounded-2xl overflow-hidden border border-white/10"
                    style={{ height: 220, background: assetCssBackground(loc.bg) }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    <span className="absolute left-4 top-3 text-lg font-black text-white/90 z-10 drop-shadow">{loc.name}</span>
                    {loc.spots.map((spot, i) => {
                      const isDone = done[loc.id]?.[i] ?? false;
                      return (
                        <button
                          key={i}
                          onClick={() => handleSpotClick(spot, i)}
                          disabled={isDone || gameOver}
                          className={cn(
                            'absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full',
                            'border-2 font-black text-white text-sm shadow-lg transition-all',
                            isDone
                              ? 'border-emerald-400/50 bg-emerald-500/20 opacity-50'
                              : spot.type === 'danger'
                                ? 'border-red-300 bg-red-500/30 shadow-[0_0_16px_rgba(239,68,68,0.5)] animate-pulse'
                                : spot.type === 'quest'
                                  ? 'border-pink-300 bg-pink-500/30 shadow-[0_0_16px_rgba(244,114,182,0.5)] animate-pulse'
                                  : 'border-cyan-300 bg-cyan-500/30 shadow-[0_0_16px_rgba(34,211,238,0.5)] animate-pulse',
                          )}
                          style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                        >
                          {isDone ? '✓' : i + 1}
                        </button>
                      );
                    })}
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
                    const isOverdue = overdue?.id === id;
                    const targetChar = getCharacterById(c.target);
                    return (
                      <div key={id} className={cn(
                        'rounded-xl border p-3',
                        isOverdue ? 'border-amber-500/50 bg-amber-500/10' : 'border-rose-500/30 bg-rose-500/5',
                      )}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {targetChar && <img src={assetUrl(targetChar.avatarUrl)} alt={targetChar.name} className="h-8 w-8 rounded-full object-cover shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm font-black text-white truncate">
                                {c.name}
                                {isOverdue && <span className="ml-1.5 rounded bg-amber-500/30 px-1 py-0.5 text-[9px] font-bold text-amber-200">逾期 {overdue!.daysLeft} 天</span>}
                              </p>
                              <p className="text-[10px] text-slate-400">{targetChar?.name} · 子目标 ×{c.objectives?.length ?? 0}</p>
                            </div>
                          </div>
                          <span className={cn('text-xs font-bold shrink-0', rarityColor(c.rarity))}>{c.rarity}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{c.desc}</p>
                        <button
                          onClick={() => { if (!gameOver) acceptCommission(id); }}
                          disabled={gameOver}
                          className="w-full rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 py-2 text-xs font-black text-white disabled:opacity-40 active:scale-[0.99] transition-all"
                        >
                          {isOverdue ? '重接此单（口碑 -1）' : '接单'}
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
                    <div className="mt-3 space-y-1.5">
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
                      onClick={() => setShowTheater(true)}
                      disabled={gameOver || !commissionReady}
                      className="mt-3 w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3 text-sm font-black text-white shadow-[0_0_24px_rgba(244,63,94,0.35)] hover:from-rose-400 disabled:opacity-40 active:scale-[0.99] transition-all"
                    >
                      {objectives.length > 0
                        ? (commissionReady ? '▶ 交付委托' : `完成全部子目标后交付（${objectivesDone.length}/${objectives.length}）`)
                        : (commissionReady ? '▶ 进入委托现场' : `信任达标后进入现场（${trust}/${commissionNeed}）`)}
                    </button>
                  ) : (
                    <p className="mt-3 text-center text-[10px] text-slate-500">（本委托剧本制作中，敬请期待）</p>
                  )}
                  <p className="mt-2 text-center text-[10px] text-slate-500">
                    提示：信任影响交付结局的好坏（{trust}/{gateGoal}），子目标决定能否交付。
                  </p>
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
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-slate-950/95 backdrop-blur-xl px-3 py-2 flex flex-wrap gap-2">
        {loc ? (
          <button
            onClick={handleFinishLocation}
            disabled={gameOver}
            className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-sm font-black text-amber-950 disabled:opacity-40"
          >
            ✅ 完成当前地点
          </button>
        ) : (
          !gameOver && (
            <button
              onClick={() => { normalAdvance(); checkAndFail(); }}
              className="flex-1 rounded-xl bg-slate-800 border border-white/10 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              普通推进
            </button>
          )
        )}
        <button
          onClick={() => { if (money >= 5) { applyDelta({ money: -5, energy: 2 }); addLog('买咖啡：精力 +2，资金 -5。', 'good'); } else toast('资金不足。'); }}
          disabled={gameOver || money < 5}
          className="rounded-xl bg-slate-800 border border-white/10 px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40"
        >
          ☕ 买咖啡
        </button>
        {!gameOver && step > 5 && (
          <button onClick={handleEndDay} className="rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-bold text-white">
            结束今日
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
                <div className="flex gap-1 flex-wrap">
                  {currentEvent.spot.need.map(n => (
                    <span key={n} className="rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-[10px] text-amber-300">推荐: {n}</span>
                  ))}
                </div>
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
              <div className="text-4xl mb-3">{endDayResult === 'success' ? '🎉' : '😔'}</div>
              <h2 className="text-xl font-black text-white mb-2">
                {endDayResult === 'success' ? '委托完成！' : '今日结束'}
              </h2>
              {endDayResult === 'success' && commission && (
                <p className="text-sm text-slate-400 mb-4">
                  【{commission.name}】已完成，角色好感度提升，相关视频已解锁。
                </p>
              )}
              {endDayResult === 'fail' && (
                <p className="text-sm text-slate-400 mb-4">委托未完成，明天再努力吧。</p>
              )}
              <button
                onClick={() => { setEndDayResult(null); resetDay(); setHandledThisLocation(false); setActiveTab('map'); }}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-black text-amber-950"
              >
                开始新的一天
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 抽卡动画 ── */}
      {showGacha && gachaResults.length > 0 && (
        <GachaAnimation
          results={gachaResults}
          isTenPull={false}
          onComplete={() => { setShowGacha(false); setGachaResults([]); }}
        />
      )}

      {/* ── 委托剧场（分幕：接单开场/子目标幕；交付：结局幕） ── */}
      {commission && commission.graph && commission.graph.nodes.length > 0 && (pendingScene || showTheater) && (
        <CommissionTheater
          key={pendingScene ? `scene-${pendingScene.start}` : 'final'}
          commission={commission}
          scene={pendingScene ?? commission.finalScene}
          initialTrust={trust}
          trustGoal={gateGoal}
          onSceneEnd={() => setPendingScene(null)}
          onComplete={handleTheaterComplete}
          onExit={() => { setPendingScene(null); setShowTheater(false); }}
        />
      )}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-800 border border-white/10 px-4 py-2 text-sm text-white shadow-xl"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  /* ── 检查失败（在 normalAdvance 后调用） ── */
  function checkAndFail() {
    // 状态更新是异步的，延迟一帧检查
    setTimeout(() => {
      const s = useShopStore.getState();
      if (checkFail(s) && !s.gameOver) {
        s.setGameOver(true);
        s.addLog('今日失败：时间、精力或口碑耗尽。', 'bad');
        setEndDayResult('fail');
      }
    }, 0);
  }
}
