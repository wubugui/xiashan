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
import { getCharacterById } from '@/data/characters';
import { getLocationById } from '@/data/locations';
import { isMatch, scoreCard } from '@/engine/shopEngine';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useShopStore } from '@/store/useShopStore';
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
}

export default function CommissionTheater({ commission, scene, initialTrust, trustGoal, onSceneEnd, onComplete, onExit }: Props) {
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

  /* ── 对白推进 ── */
  const handleNext = useCallback(() => {
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
    (card: { kind: 'person'; serviceType: ServiceTag } | HandCard | null) => {
      if (!node || node.type !== 'challenge') return;
      if (resolving.current) return;
      resolving.current = true;

      let tier: Tier;
      if (!card) tier = 'poor';
      else {
        const cardType = card.kind === 'person' ? card.serviceType : card.type;
        tier = isMatch(cardType, node.need) ? 'perfect' : 'ok';
      }
      const outcome = node.outcomes[tier];

      if (card && card.kind !== 'person') consumeHandCard(card.uid);

      const newTrust = trust + outcome.trust;
      trustRef.current = newTrust;
      setTrust(newTrust);
      if (outcome.trust > 0) applyDelta({ trust: outcome.trust });
      if (outcome.repPenalty) applyDelta({ rep: -outcome.repPenalty });
      setMood(outcome.mood);
      setChallengesDone((d) => d + 1);

      if (outcome.trust > 0) {
        setFloatTrust(outcome.trust);
        setTimeout(() => setFloatTrust(null), 1100);
      }

      const label = tier === 'perfect' ? '完美' : tier === 'ok' ? '还行' : '勉强';
      addLog(
        `【${commission.name}】${node.prompt.slice(0, 12)}… 判定：${label}，信任 +${outcome.trust}`,
        tier === 'perfect' ? 'good' : tier === 'poor' ? 'bad' : 'play',
      );

      setReaction({ lines: outcome.lines, next: outcome.next });
      setLineIndex(0);
    },
    [node, trust, applyDelta, consumeHandCard, addLog, commission.name],
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
          <button
            onClick={onExit}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
            aria-label="退出委托"
          >
            <X size={15} />
          </button>
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

      {/* 客户立绘 */}
      {client && (
        <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
          <motion.img
            key={clientSpeaking ? 'active' : 'idle'}
            src={assetUrl(client.portraitUrl)}
            alt={client.name}
            animate={{
              opacity: clientSpeaking || inChallenge ? 1 : 0.6,
              scale: clientSpeaking ? 1 : 0.97,
              filter: clientSpeaking ? 'brightness(1)' : 'brightness(0.7)',
            }}
            transition={{ duration: 0.4 }}
            className="max-h-[72%] w-auto object-contain drop-shadow-2xl"
            style={{ marginBottom: inChallenge ? '38%' : '24%' }}
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
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
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
            </div>

            <CardTray need={node.need} personCards={personCards} hand={hand} onPlay={playChoice} />

            <button
              onClick={() => playChoice(null)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 active:scale-[0.99] transition-all"
            >
              凭本事顶上（不使用卡 · 反馈平平）
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 对白框 */}
      {!inChallenge && curLine && (
        <DialogueBox
          key={`${nodeId}-${reaction ? 'r' : 'n'}-${lineIndex}`}
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
  need, personCards, hand, onPlay,
}: {
  need: ServiceTag[];
  personCards: { kind: 'person'; id: string; name: string; serviceType: ServiceTag; level: number }[];
  hand: HandCard[];
  onPlay: (card: { kind: 'person'; serviceType: ServiceTag; id: string } | HandCard) => void;
}) {
  const sortedPersons = [...personCards].sort(
    (a, b) => scoreCard(b.serviceType, need) - scoreCard(a.serviceType, need),
  );
  const sortedHand = [...hand].sort((a, b) => scoreCard(b.type, need) - scoreCard(a.type, need));
  const hasAny = sortedPersons.length + sortedHand.length > 0;

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
                  className={cn(
                    'flex items-center gap-2 rounded-xl border p-2 text-left active:scale-[0.98] transition-all',
                    matched ? 'border-amber-400/60 bg-amber-500/10' : 'border-white/10 bg-slate-800',
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
      {sortedHand.length > 0 && (
        <div>
          <p className="text-[10px] text-amber-300 font-bold mb-1.5">道具卡 · 用后消耗</p>
          <div className="grid grid-cols-2 gap-2">
            {sortedHand.map((c) => {
              const matched = isMatch(c.type, need);
              return (
                <button
                  key={c.uid}
                  onClick={() => onPlay(c)}
                  className={cn(
                    'rounded-xl border p-2 text-left active:scale-[0.98] transition-all',
                    matched ? 'border-amber-400/60 bg-amber-500/10' : 'border-white/10 bg-slate-800',
                  )}
                >
                  <p className="text-xs font-bold text-white truncate">{matched ? '✨' : ''}{c.name}</p>
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
