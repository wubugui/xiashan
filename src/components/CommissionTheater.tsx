/**
 * 委托剧场 — 接取委托后进入的全屏 AVG 体验。
 * 剧情由「图(graph)」数据驱动：节点 + 边(next)，支持分支 / 汇合 / 多结局。
 * 节点类型：dialogue（对白）/ challenge（出牌三档判定）/ branch（按信任分流）/ ending（结局）。
 * 复用 DialogueBox（打字机对白）与 shopEngine（匹配判定）。
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import DialogueBox from '@/components/DialogueBox';
import { useCssVarFromHeight } from '@/hooks/useCssVarFromHeight';
import { getCharacterById } from '@/data/characters';
import { getLocationById } from '@/data/locations';
import { getGiftCardById } from '@/data/collectibles';
import { isMatch, scoreCard, groupHand } from '@/engine/shopEngine';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useShopStore } from '@/store/useShopStore';
import { playSound } from '@/lib/sound';
import type { Commission, CommissionNode, Line, Mood, ServiceTag, TheaterScene } from '@/data/types';
import type { HandCard } from '@/store/useShopStore';
import { cn } from '@/lib/utils';
import { assetCssBackground, assetUrl } from '@/lib/assets';

type Tier = 'perfect' | 'ok' | 'poor';

const MOOD_STYLE: Record<Mood, { emoji: string; color: string }> = {
  焦虑: { emoji: '😰', color: 'text-red-300' },
  平静: { emoji: '😌', color: 'text-sky-300' },
  感动: { emoji: '🥹', color: 'text-pink-300' },
  信赖: { emoji: '😊', color: 'text-amber-300' },
};

interface Props {
  commission: Commission;
  /** 分幕播放：从 scene.start 播到即将进入 stopBefore 时落幕；缺省播整图 */
  scene?: TheaterScene;
  /** 跨幕累计信任（幕内挑战的信任也会实时写回 shop store） */
  initialTrust?: number;
  /** 结局分水岭（显示用），缺省取 commission.need */
  trustGoal?: number;
  /** 分幕播完（未到结局）时回调 */
  onSceneEnd?: () => void;
  onComplete: (success: boolean) => void;
  onExit: () => void;
  /** 新手引导锁定：挑战只能打匹配卡（✨），禁用其余卡与「凭本事顶上」 */
  tutorialLock?: boolean;
}

export default function CommissionTheater({ commission, scene, initialTrust, trustGoal, onSceneEnd, onComplete, onExit, tutorialLock }: Props) {
  const graph = commission.graph!;
  const nodesById = useMemo(() => {
    const m = new Map<string, CommissionNode>();
    graph.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [graph]);
  const totalChallenges = useMemo(
    () => graph.nodes.filter((n) => n.type === 'challenge').length,
    [graph],
  );

  const clientId = commission.client ?? commission.target;
  const client = getCharacterById(clientId);

  /* ── stores ── */
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const equippedGift = usePlayerStore((s) => s.equippedGift);
  const dailyActions = usePlayerStore((s) => s.dailyActions);
  const tryDailyAction = usePlayerStore((s) => s.tryDailyAction);
  const hand = useShopStore((s) => s.hand);
  const applyDelta = useShopStore((s) => s.applyDelta);
  const consumeHandCard = useShopStore((s) => s.consumeHandCard);
  const addLog = useShopStore((s) => s.addLog);

  /* ── 图遍历状态 ── */
  const [nodeId, setNodeId] = useState(scene?.start ?? graph.start);
  const [lineIndex, setLineIndex] = useState(0);
  /** 出牌后展示的反应：反应对白播完跳转到 next */
  const [reaction, setReaction] = useState<{ lines: Line[]; next: string } | null>(null);
  const [mood, setMood] = useState<Mood>(commission.initialMood ?? '焦虑');
  const [trust, setTrust] = useState(initialTrust ?? 0);
  const [challengesDone, setChallengesDone] = useState(0);
  const [floatTrust, setFloatTrust] = useState<number | null>(null);

  const trustRef = useRef(initialTrust ?? 0); // 供 branch 即时读取最新信任
  const resolving = useRef(false);      // 出牌锁：一幕只结算一次
  /** 出牌面板实测高度 → --theater-panel-h：立绘自适应让位（与 --dlg-h 取大者） */
  const challengePanelRef = useRef<HTMLDivElement>(null);
  useCssVarFromHeight('--theater-panel-h', challengePanelRef);

  const node = nodesById.get(nodeId);

  /* ── 进入节点：解锁出牌；branch 节点立即分流 ── */
  useEffect(() => {
    resolving.current = false;
    const n = nodesById.get(nodeId);
    if (n?.type === 'branch') {
      setReaction(null);
      setLineIndex(0);
      setNodeId(trustRef.current >= n.trustGte ? n.ifTrue : n.ifFalse);
    }
  }, [nodeId, nodesById]);

  /* ── 当前对白序列 ── */
  const currentLines: Line[] = useMemo(() => {
    if (reaction) return reaction.lines;
    if (node?.type === 'dialogue' || node?.type === 'ending') return node.lines;
    return [];
  }, [reaction, node]);

  const inChallenge = node?.type === 'challenge' && reaction === null;

  /* ── 随身信物（礼物卡）：装备吃被动 + 可动用一锤。autoLink 类（如江夏理货卡）不作用于委托 ── */
  const giftInfo = useMemo(() => {
    const g = getGiftCardById(equippedGift);
    return g && g.effect.kind !== 'autoLink' ? g : undefined;
  }, [equippedGift]);
  const giftActiveAvailable = dailyActions['gift_active'] !== new Date().toISOString().slice(0, 10);
  /** 当前挑战类型是否吃信物被动 → 展示用 */
  const giftPassive = giftInfo && node?.type === 'challenge' && isMatch(giftInfo.effect.type, node.need)
    ? giftInfo.effect.passiveTrust : 0;

  /* ── 背景（取当前节点 location） ── */
  const bg = useMemo(() => {
    const locId = node && 'location' in node ? node.location : undefined;
    return locId ? getLocationById(locId)?.bg : undefined;
  }, [node]);

  /* ── 人物卡（已拥有角色） ── */
  const personCards = useMemo(
    () =>
      ownedCharacters
        .map((o) => {
          const c = getCharacterById(o.characterId);
          if (!c) return null;
          return { kind: 'person' as const, id: c.id, name: c.name, serviceType: c.serviceType, level: o.level };
        })
        .filter((x): x is { kind: 'person'; id: string; name: string; serviceType: ServiceTag; level: number } => x !== null),
    [ownedCharacters],
  );

  /* ── 节点跳转（分幕边界拦截）── */
  const advanceTo = useCallback((next: string) => {
    if (scene?.stopBefore && next === scene.stopBefore) {
      onSceneEnd?.();
      return;
    }
    setLineIndex(0);
    setNodeId(next);
  }, [scene, onSceneEnd]);

  /* ── 信任/挑战音效 ── */
  useEffect(() => {
    if (floatTrust !== null && floatTrust > 0) playSound('trust-gain');
  }, [floatTrust]);

  useEffect(() => {
    if (inChallenge) playSound('challenge-appear');
  }, [inChallenge]);

  /* ── 对白推进 ── */
  const handleNext = useCallback(() => {
    playSound('dialog-next');
    if (lineIndex < currentLines.length - 1) {
      setLineIndex((i) => i + 1);
      return;
    }
    // 序列结束 → 沿边跳转
    if (reaction) {
      const nxt = reaction.next;
      setReaction(null);
      advanceTo(nxt);
      return;
    }
    if (node?.type === 'dialogue') {
      advanceTo(node.next);
      return;
    }
    if (node?.type === 'ending') {
      onComplete(node.success);
    }
  }, [lineIndex, currentLines.length, reaction, node, advanceTo, onComplete]);

  /* ── 出牌判定 ── */
  const playChoice = useCallback(
    (card: { kind: 'person'; serviceType: ServiceTag } | HandCard | { kind: 'gift'; serviceType: ServiceTag; activeBonus: number } | null) => {
      if (!node || node.type !== 'challenge') return;
      if (resolving.current) return;

      const isGiftPlay = !!card && card.kind === 'gift';
      // 动用信物每日一次：占用名额失败则忽略本次点击
      if (isGiftPlay && !tryDailyAction('gift_active')) return;
      resolving.current = true;

      let tier: Tier;
      let activeBonus = 0;
      if (!card) tier = 'poor';
      else if (card.kind === 'gift') { tier = 'perfect'; activeBonus = card.activeBonus; }
      else {
        const cardType = card.kind === 'person' ? card.serviceType : card.type;
        tier = isMatch(cardType, node.need) ? 'perfect' : 'ok';
      }
      playSound(isGiftPlay ? 'gacha-ssr' : tier === 'perfect' ? 'card-hit' : tier === 'ok' ? 'btn-confirm' : 'card-miss');
      const outcome = node.outcomes[tier];

      // 仅道具卡(手牌)消耗；人物卡 / 随身信物不消耗
      if (card && card.kind !== 'person' && card.kind !== 'gift') consumeHandCard(card.uid);

      // 随身信物被动：装备的礼物类型匹配本委托时，每次判定额外信任
      const passive = giftInfo && isMatch(giftInfo.effect.type, node.need) ? giftInfo.effect.passiveTrust : 0;
      const gain = outcome.trust + activeBonus + passive;

      const newTrust = trust + gain;
      trustRef.current = newTrust;
      setTrust(newTrust);
      if (gain > 0) applyDelta({ trust: gain });
      if (outcome.repPenalty) applyDelta({ rep: -outcome.repPenalty });
      setMood(outcome.mood);
      setChallengesDone((d) => d + 1);

      if (gain > 0) {
        setFloatTrust(gain);
        setTimeout(() => setFloatTrust(null), 1100);
      }

      const label = tier === 'perfect' ? '完美' : tier === 'ok' ? '还行' : '勉强';
      const note = isGiftPlay ? '（动用信物）' : passive ? `（信物 +${passive}）` : '';
      addLog(
        `【${commission.name}】${node.prompt.slice(0, 12)}… 判定：${label}，信任 +${gain}${note}`,
        tier === 'perfect' ? 'good' : tier === 'poor' ? 'bad' : 'play',
      );

      setReaction({ lines: outcome.lines, next: outcome.next });
      setLineIndex(0);
    },
    [node, trust, applyDelta, consumeHandCard, addLog, commission.name, giftInfo, tryDailyAction],
  );

  /* ── 当前说话人 ── */
  const curLine = currentLines[lineIndex];
  const speakerName = curLine?.speaker ? getCharacterById(curLine.speaker)?.name : undefined;
  const clientSpeaking = curLine?.speaker === clientId;

  const moodS = MOOD_STYLE[mood];
  const goal = trustGoal ?? commission.need;
  const trustPct = Math.min(100, (trust / goal) * 100);
  const fallbackBg = assetCssBackground('url("/bg/scene/street-storefront.jpg") center / cover no-repeat');

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black">
      {/* 背景 */}
      <div
        className="absolute inset-0"
        style={{ background: assetCssBackground(bg) ?? fallbackBg }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

      {/* 顶部 HUD */}
      <div className="absolute left-0 right-0 top-0 z-20 px-4 pt-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded-full bg-rose-500/30 border border-rose-400/40 px-2.5 py-0.5 text-[11px] font-bold text-rose-100">
            委托 · {commission.name}
          </span>
          <span className="text-[10px] text-white/50">
            进度 {Math.min(challengesDone, totalChallenges)}/{totalChallenges}
          </span>
          {/* 引导期不可中途退场：必须看完整幕，保证流程不脱轨 */}
          {!tutorialLock && (
            <button
              onClick={onExit}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
              aria-label="退出委托"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-rose-200 shrink-0">信任 {trust}/{goal}</span>
          <div className="relative h-2 flex-1 rounded-full bg-black/50 overflow-hidden border border-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-400"
              animate={{ width: `${trustPct}%` }}
              transition={{ type: 'spring', damping: 20 }}
            />
          </div>
          <span className={cn('flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-bold shrink-0', moodS.color)}>
            {moodS.emoji} {mood}
          </span>
        </div>
      </div>

      {/* 客户立绘：站在底部 UI（对白框/出牌面板）正上方。
          位置全程用实测高度变量计算（--dlg-h / --theater-panel-h），随平台、字数、面板伸缩自适应；
          不加 key——同一元素平滑过渡明暗，避免重挂载打断渐变导致卡在半透明 */}
      {client && (
        <div
          className="pointer-events-none absolute inset-x-0 top-[10vh] z-10 flex items-end justify-center"
          style={{ bottom: 'calc(max(var(--dlg-h, 0px), var(--theater-panel-h, 0px)) - 6vh)' }}
        >
          {/* 居中由外层 flex 负责——motion 接管 img 的 transform，Tailwind translate 会被覆盖。
              立绘 PNG 底部约 5% 透明留白，故容器多压 6vh 进对白框（被框盖住），保证人物底边不露缝。
              scale 从底部放大，让人物更有存在感且底边更深地扎进框里。 */}
          <motion.img
            src={assetUrl(client.portraitUrl)}
            alt={client.name}
            style={{ transformOrigin: 'bottom center' }}
            animate={{
              opacity: clientSpeaking || inChallenge ? 1 : 0.82,
              scale: clientSpeaking ? 1.12 : 1.08,
              filter: clientSpeaking || inChallenge ? 'brightness(1)' : 'brightness(0.8)',
            }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="max-h-full max-w-[96vw] object-contain object-bottom drop-shadow-2xl"
          />
        </div>
      )}

      {/* 浮动信任反馈 */}
      <AnimatePresence>
        {floatTrust !== null && (
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: 1, y: -60, scale: 1.2 }}
            exit={{ opacity: 0, y: -90 }}
            transition={{ duration: 1 }}
            className="absolute left-1/2 top-1/3 z-30 -translate-x-1/2 text-3xl font-black text-rose-300 drop-shadow-[0_0_12px_rgba(244,114,182,0.8)]"
          >
            信任 +{floatTrust}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 困境出牌面板 */}
      <AnimatePresence>
        {inChallenge && node?.type === 'challenge' && (
          <motion.div
            ref={challengePanelRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute bottom-0 left-0 right-0 z-40 max-h-[64%] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-slate-900/95 backdrop-blur-xl p-4 pb-safe"
          >
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold',
                  node.danger ? 'bg-red-500/25 text-red-300' : 'bg-amber-500/25 text-amber-300',
                )}>
                  {node.danger ? '⚠ 危机' : '抉择'}
                </span>
                {node.need.map((n) => (
                  <span key={n} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">需要: {n}</span>
                ))}
              </div>
              <p className="text-sm font-bold text-white">{node.prompt}</p>
              {giftPassive > 0 && (
                <p className="mt-1 text-[10px] font-medium text-amber-300/85">🎁 随身信物生效中 · 本类型每次判定 +{giftPassive} 信任</p>
              )}
            </div>

            {/* 随身信物：动用一锤（每日一次，引导步骤不打扰） */}
            {giftInfo && giftActiveAvailable && !tutorialLock && (
              <button
                onClick={() => playChoice({ kind: 'gift', serviceType: giftInfo.effect.type, activeBonus: giftInfo.effect.activeBonus })}
                className="mb-2 flex w-full items-center gap-2.5 rounded-xl border-2 border-amber-300/70 bg-gradient-to-r from-amber-500/20 to-amber-400/5 p-2 text-left shadow-[0_0_14px_rgba(251,191,36,0.25)] transition-all active:scale-[0.99]"
              >
                <img src={assetUrl(giftInfo.asset)} alt={giftInfo.name} className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-amber-300/60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-amber-200">动用随身信物 · {giftInfo.name}</p>
                  <p className="text-[10px] text-amber-100/80">必定「完美」，额外信任 +{giftInfo.effect.activeBonus} · 每日一次</p>
                </div>
                <span className="shrink-0 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-amber-950">SSR</span>
              </button>
            )}

            {(() => {
              const matchedExists =
                personCards.some((p) => isMatch(p.serviceType, node.need)) ||
                hand.some((c) => isMatch(c.type, node.need));
              const locked = !!tutorialLock && matchedExists;
              return (
                <>
                  {locked && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1.5">
                      <img
                        src={assetUrl('/characters/face/linxia/smile.png')}
                        alt="江夏"
                        className="pointer-events-none h-10 w-8 shrink-0 select-none rounded object-cover object-top"
                      />
                      <p className="text-[10px] font-bold text-amber-200">江夏：打出带 ✨ 的卡——类型对上，判定才是「完美」！</p>
                    </div>
                  )}
                  <CardTray need={node.need} personCards={personCards} hand={hand} onPlay={playChoice} lockToMatched={locked} />
                  {!locked && (
                    <button
                      onClick={() => playChoice(null)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 active:scale-[0.99] transition-all"
                    >
                      凭本事顶上（不使用卡 · 反馈平平）
                    </button>
                  )}
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 对白框 */}
      {!inChallenge && curLine && (
        <DialogueBox
          speaker={speakerName}
          speakerColor={clientSpeaking ? 'text-rose-300' : 'text-slate-300'}
          text={curLine.text}
          onNext={handleNext}
          onSkipTyping={() => {}}
        />
      )}
    </div>
  );
}

/* ────── 卡牌托盘 ────── */
function CardTray({
  need, personCards, hand, onPlay, lockToMatched,
}: {
  need: ServiceTag[];
  personCards: { kind: 'person'; id: string; name: string; serviceType: ServiceTag; level: number }[];
  hand: HandCard[];
  onPlay: (card: { kind: 'person'; serviceType: ServiceTag; id: string } | HandCard) => void;
  /** 引导锁定：非匹配卡禁用 */
  lockToMatched?: boolean;
}) {
  const sortedPersons = [...personCards].sort(
    (a, b) => scoreCard(b.serviceType, need) - scoreCard(a.serviceType, need),
  );
  // 道具卡按 id 合并显示 ×N，点击仍只消耗一张（onPlay 传代表卡，内部按 uid 移除一张）
  const handGroups = groupHand(hand).sort((a, b) => scoreCard(b.rep.type, need) - scoreCard(a.rep.type, need));
  const hasAny = sortedPersons.length + handGroups.length > 0;

  if (!hasAny) {
    return (
      <p className="rounded-xl border border-white/10 bg-slate-800/60 p-3 text-center text-xs text-slate-400">
        手上没有可用的卡。先去抽卡频道补充人物/技能卡，再回来更有把握。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sortedPersons.length > 0 && (
        <div>
          <p className="text-[10px] text-violet-300 font-bold mb-1.5">人物卡 · 谁来帮她</p>
          <div className="grid grid-cols-2 gap-2">
            {sortedPersons.map((p) => {
              const matched = isMatch(p.serviceType, need);
              const c = getCharacterById(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => onPlay(p)}
                  disabled={lockToMatched && !matched}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border p-2 text-left active:scale-[0.98] transition-all',
                    matched ? 'border-amber-400/60 bg-amber-500/10' : 'border-white/10 bg-slate-800',
                    lockToMatched && !matched && 'opacity-40',
                  )}
                >
                  {c && <img src={assetUrl(c.avatarUrl)} alt={c.name} className="h-8 w-8 rounded-full object-cover shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{matched ? '✨' : ''}{p.name}</p>
                    <p className="text-[10px] text-slate-400">Lv.{p.level} · {p.serviceType}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {handGroups.length > 0 && (
        <div>
          <p className="text-[10px] text-amber-300 font-bold mb-1.5">道具卡 · 用后消耗</p>
          <div className="grid grid-cols-2 gap-2">
            {handGroups.map(({ rep: c, count }) => {
              const matched = isMatch(c.type, need);
              return (
                <button
                  key={c.id}
                  onClick={() => onPlay(c)}
                  disabled={lockToMatched && !matched}
                  className={cn(
                    'rounded-xl border p-2 text-left active:scale-[0.98] transition-all',
                    matched ? 'border-amber-400/60 bg-amber-500/10' : 'border-white/10 bg-slate-800',
                    lockToMatched && !matched && 'opacity-40',
                  )}
                >
                  <p className="text-xs font-bold text-white truncate">
                    {matched ? '✨' : ''}{c.name}{count > 1 && <span className="ml-1 text-amber-300">×{count}</span>}
                  </p>
                  <p className="text-[10px] text-slate-400">{c.type}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
