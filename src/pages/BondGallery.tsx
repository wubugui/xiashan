/**
 * 缘分图鉴 · 游戏的主线面板
 * 八位主要角色（委托人）的形态进度一览：信物（卡数）+ 温度（好感）双门槛，
 * 终点是每个人的终极形态（满阶）。同时是缘分碎片的中枢：
 * 溢出信物在这里沉淀为缘分，再经「引荐/牵线」流向还没毕业的线。
 */
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { characters, getCharacterById } from '@/data/characters';
import { commissions } from '@/data/commissions';
import { getRelationshipStages, getStageInfo } from '@/data/relationship';
import {
  CARD_COST, REFERRER_MIN_STAGE, MAX_STAGE, surplusCards, surplusShardsTotal, type Rarity,
} from '@/engine/bondEngine';
import referralsData from '@/content/referrals.json';
import GachaAnimation from '@/components/GachaAnimation';
import PageBackdrop from '@/components/PageBackdrop';
import { SCENE_BACKDROPS } from '@/lib/pageBackdrops';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/lib/assets';
import { playSound } from '@/lib/sound';

const rarityColor: Record<string, string> = {
  SSR: 'text-yellow-300', SR: 'text-purple-300', R: 'text-slate-300', N: 'text-slate-400',
};
const rarityOrder: Record<string, number> = { SSR: 0, SR: 1, R: 2, N: 3 };

interface Referrals {
  defaultIntro: { referrer: string; target: string };
  referrerIntros: Record<string, string>;
  repeatLines: string[];
  pairOverrides: Record<string, { referrer: string; target: string }>;
}
const referrals = referralsData as unknown as Referrals;

function fillTemplate(tpl: string, referrerName: string, targetName: string): string {
  return tpl.split('{referrer}').join(referrerName).split('{target}').join(targetName);
}

export default function BondGallery() {
  const navigate = useNavigate();
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const relationshipStages = usePlayerStore((s) => s.relationshipStages);
  const dupeCount = usePlayerStore((s) => s.dupeCount);
  const bondShards = usePlayerStore((s) => s.bondShards);
  const rateUpUntil = usePlayerStore((s) => s.rateUpUntil);
  const coldUntil = usePlayerStore((s) => s.coldUntil);
  const triggeredEventIds = usePlayerStore((s) => s.triggeredEventIds);
  const addBondShards = usePlayerStore((s) => s.addBondShards);
  const convertSurplusToShards = usePlayerStore((s) => s.convertSurplusToShards);
  const addCharacter = usePlayerStore((s) => s.addCharacter);
  const addGachaResult = usePlayerStore((s) => s.addGachaResult);
  const addTriggeredEvent = usePlayerStore((s) => s.addTriggeredEvent);
  const addPhoneMessage = usePlayerStore((s) => s.addPhoneMessage);

  /** 引荐弹窗：目标角色 id */
  const [referTarget, setReferTarget] = useState<string | null>(null);
  /** 选中的引荐人 */
  const [referrerId, setReferrerId] = useState<string | null>(null);
  /** 信物揭示动画 */
  const [revealResult, setRevealResult] = useState<{ characterId: string; name: string; rarity: Rarity; title: string; isNew: boolean } | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const ownedIds = useMemo(() => ownedCharacters.map(o => o.characterId), [ownedCharacters]);

  /** 主要角色（委托人）优先展示，组内按稀有度排序 */
  const sortedCharacters = useMemo(() => {
    const mains = new Set(commissions.map(c => c.target));
    return [...characters].sort((a, b) => {
      const am = mains.has(a.id) ? 0 : 1;
      const bm = mains.has(b.id) ? 0 : 1;
      if (am !== bm) return am - bm;
      return (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9);
    });
  }, []);

  const totalSurplusShards = useMemo(
    () => surplusShardsTotal(dupeCount, id => getCharacterById(id)?.rarity as Rarity | undefined),
    [dupeCount],
  );

  /** 有资格作保的引荐人：已拥有且关系达「深夜长谈」级 */
  const eligibleReferrers = useMemo(
    () => ownedIds.filter(id => (relationshipStages[id] ?? 0) >= REFERRER_MIN_STAGE),
    [ownedIds, relationshipStages],
  );

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2200);
  }

  const handleConvert = () => {
    const gained = convertSurplusToShards();
    if (gained > 0) {
      playSound('gacha-item');
      toast(`与她们的回忆沉淀为缘分 ✦+${gained}`);
    }
  };

  const handleRefer = () => {
    if (!referTarget || !referrerId) return;
    const target = getCharacterById(referTarget);
    const referrer = getCharacterById(referrerId);
    if (!target || !referrer) return;
    const cost = CARD_COST[target.rarity as Rarity];
    if (bondShards < cost) return;

    const wasOwned = ownedIds.includes(target.id);
    addBondShards(-cost);
    addCharacter(target.id);
    addGachaResult(target.id, target.rarity);

    // 首次引荐（每对组合一次）：手机消息事件链——她接纳了你，而不是你买到了她
    const pairKey = `referral_${referrer.id}_${target.id}`;
    if (!triggeredEventIds.includes(pairKey)) {
      addTriggeredEvent(pairKey);
      const pair = referrals.pairOverrides[`${referrer.id}:${target.id}`];
      const introR = pair?.referrer ?? referrals.referrerIntros[referrer.id] ?? referrals.defaultIntro.referrer;
      const introT = pair?.target ?? referrals.defaultIntro.target;
      const now = Date.now();
      addPhoneMessage({
        id: `${pairKey}_r_${now}`, characterId: referrer.id, type: 'wechat',
        content: fillTemplate(introR, referrer.name, target.name), timestamp: now, read: false,
      });
      addPhoneMessage({
        id: `${pairKey}_t_${now}`, characterId: target.id, type: 'wechat',
        content: fillTemplate(introT, referrer.name, target.name), timestamp: now + 1, read: false,
      });
    } else {
      const line = referrals.repeatLines[Math.floor(Math.random() * referrals.repeatLines.length)];
      toast(`${referrer.name}：${line}`);
    }

    playSound('commission-accept');
    setReferTarget(null);
    setReferrerId(null);
    setRevealResult({
      characterId: target.id,
      name: target.name,
      rarity: target.rarity as Rarity,
      title: target.title,
      isNew: !wasOwned,
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050914] pb-nav">
      <PageBackdrop
        image={SCENE_BACKDROPS.street.image}
        mobileImage={SCENE_BACKDROPS.street.mobileImage}
        position={SCENE_BACKDROPS.street.position}
        overlayClassName="from-slate-950/60 via-slate-950/70 to-slate-950/90"
      />

      <div className="relative z-10">
        {/* 顶栏 */}
        <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
              aria-label="返回"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black tracking-wide text-white">缘分图鉴</h1>
              <p className="text-xs text-slate-400">信物是钥匙，好感是温度——终点是她们的终极形态</p>
            </div>
            <span className="rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-sm font-black text-pink-300">
              ✦ {bondShards}
            </span>
          </div>
        </div>

        {/* 溢出沉淀 */}
        {totalSurplusShards > 0 && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-pink-400/30 bg-pink-500/10 px-3 py-2.5">
            <p className="text-xs text-pink-200">
              有些信物已经多到装不下了——可以沉淀为缘分 <b>✦{totalSurplusShards}</b>
            </p>
            <button
              onClick={handleConvert}
              className="shrink-0 rounded-lg bg-gradient-to-r from-pink-500 to-rose-600 px-3 py-1.5 text-xs font-black text-white active:scale-95 transition-all"
            >
              <Sparkles size={11} className="inline -mt-0.5 mr-0.5" />沉淀
            </button>
          </div>
        )}

        {/* 角色列表 */}
        <div className="space-y-2.5 px-4 pt-3">
          {sortedCharacters.map(char => {
            const owned = ownedIds.includes(char.id);
            const dupes = dupeCount[char.id] ?? 0;
            const affinity = affinityMap[char.id] ?? 0;
            const stage = relationshipStages[char.id] ?? 0;
            const stages = getRelationshipStages(char.id);
            const stageName = getStageInfo(char.id, stage)?.name ?? (owned ? '初识' : '未相遇');
            const maxed = stage >= stages.length;
            const isRateUp = (rateUpUntil[char.id] ?? '') >= today;
            const isCold = (coldUntil[char.id] ?? '') >= today;
            const cost = CARD_COST[char.rarity as Rarity];
            const surplus = surplusCards(dupes);
            const canRefer = eligibleReferrers.some(id => id !== char.id);
            const cardFull = dupes >= MAX_STAGE;

            return (
              <div key={char.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => navigate(`/character/${char.id}`)} className="shrink-0">
                    <img
                      src={assetUrl(char.avatarUrl)}
                      alt={char.name}
                      className={cn('h-12 w-12 rounded-full object-cover border-2', owned ? 'border-pink-400/50' : 'border-white/10 grayscale opacity-60')}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-black text-white">{char.name}</span>
                      <span className={cn('text-[10px] font-bold', rarityColor[char.rarity])}>{char.rarity}</span>
                      {isRateUp && <span className="rounded bg-pink-500/30 px-1 py-0.5 text-[9px] font-bold text-pink-200">缘分UP</span>}
                      {isCold && <span className="rounded bg-sky-500/20 px-1 py-0.5 text-[9px] font-bold text-sky-300">冷淡中</span>}
                      {maxed && <span className="rounded bg-yellow-500/25 px-1 py-0.5 text-[9px] font-bold text-yellow-200">终极形态</span>}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {stageName} · 形态 {stage}/{stages.length}{owned ? ` · 好感 ${affinity}` : affinity > 0 ? ` · 好感 ${affinity}（未相遇）` : ''}
                    </p>
                    {/* 信物点位：满阶需 5 张 */}
                    <p className="mt-0.5 text-[11px] tracking-wider">
                      {Array.from({ length: MAX_STAGE }, (_, i) => (
                        <span key={i}>{i < Math.min(dupes, MAX_STAGE) ? '💌' : '🖤'}</span>
                      ))}
                      {surplus > 0 && <span className="ml-1 text-[9px] text-pink-300">+{surplus} 溢出</span>}
                    </p>
                  </div>
                  {/* 引荐/牵线 */}
                  <div className="shrink-0 text-right">
                    <button
                      onClick={() => { setReferTarget(char.id); setReferrerId(null); }}
                      disabled={cardFull || !canRefer || bondShards < cost}
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all active:scale-95',
                        cardFull || !canRefer || bondShards < cost
                          ? 'bg-slate-800/60 text-slate-500'
                          : 'bg-gradient-to-r from-pink-500 to-rose-600 text-white',
                      )}
                    >
                      {cardFull ? '信物已集满' : owned ? '请人牵线' : '请人引荐'}
                    </button>
                    <p className="mt-1 text-[9px] text-slate-500">心意 ✦{cost}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {eligibleReferrers.length === 0 && (
          <p className="mx-4 mt-3 rounded-lg bg-slate-800/40 px-3 py-2 text-xs leading-relaxed text-slate-500">
            还没有人愿意替你作保。把任意一位的关系推进到「深夜长谈」（第 {REFERRER_MIN_STAGE} 阶），她就能为你引荐别人。
          </p>
        )}
      </div>

      {/* 引荐确认弹窗：选择引荐人 */}
      <AnimatePresence>
        {referTarget && (() => {
          const target = getCharacterById(referTarget);
          if (!target) return null;
          const cost = CARD_COST[target.rarity as Rarity];
          const candidates = eligibleReferrers.filter(id => id !== referTarget);
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 backdrop-blur-sm px-4 pb-6"
              onClick={() => setReferTarget(null)}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-pink-400/30 bg-slate-900 p-4"
              >
                <h2 className="mb-1 text-base font-black text-white">
                  {ownedIds.includes(target.id) ? `请谁替你给${target.name}捎信物？` : `请谁替你引荐${target.name}？`}
                </h2>
                <p className="mb-3 text-xs text-slate-400">需要的心意：✦{cost}（持有 ✦{bondShards}）</p>
                <div className="mb-3 space-y-1.5 max-h-52 overflow-y-auto">
                  {candidates.map(id => {
                    const c = getCharacterById(id);
                    if (!c) return null;
                    return (
                      <button
                        key={id}
                        onClick={() => setReferrerId(id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-all',
                          referrerId === id ? 'border-pink-400/60 bg-pink-500/10' : 'border-white/10 bg-slate-800/60 hover:bg-slate-800',
                        )}
                      >
                        <img src={assetUrl(c.avatarUrl)} alt={c.name} className="h-9 w-9 rounded-full object-cover" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">{c.name}</p>
                          <p className="text-[10px] text-slate-400">{getStageInfo(id, relationshipStages[id] ?? 0)?.name ?? ''}</p>
                        </div>
                        {referrerId === id && <span className="ml-auto text-pink-300">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setReferTarget(null)}
                    className="flex-1 rounded-xl border border-white/10 bg-slate-800 py-2.5 text-sm font-bold text-slate-300"
                  >
                    再想想
                  </button>
                  <button
                    onClick={handleRefer}
                    disabled={!referrerId || bondShards < cost}
                    className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 py-2.5 text-sm font-black text-white disabled:opacity-40"
                  >
                    拜托她了
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* 信物揭示（复用抽卡演出） */}
      {revealResult && (
        <GachaAnimation
          results={[revealResult]}
          isTenPull={false}
          onComplete={() => setRevealResult(null)}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed above-nav left-1/2 z-50 -translate-x-1/2 w-max max-w-[85vw] rounded-xl bg-slate-800 border border-white/10 px-4 py-2 text-sm text-white shadow-xl"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
