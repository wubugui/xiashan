import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, History } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useShopStore } from '@/store/useShopStore';
import { pullSupply, isHeartUp, HEART_UP_WEIGHT } from '@/engine/gachaEngine';
import { GACHA_CONFIG } from '@/data/gachaConfig';
import { characters } from '@/data/characters';
import GachaAnimation from '@/components/GachaAnimation';
import { cn } from '@/lib/utils';

export default function Gacha() {
  const navigate = useNavigate();
  const spiritStones = usePlayerStore((s) => s.spiritStones);
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const supplyPityCounter = usePlayerStore((s) => s.supplyPityCounter);
  const gachaHistory = usePlayerStore((s) => s.gachaHistory);
  const addCharacter = usePlayerStore((s) => s.addCharacter);
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);
  const addGachaResult = usePlayerStore((s) => s.addGachaResult);
  const setSupplyPityCounter = usePlayerStore((s) => s.setSupplyPityCounter);
  const addHandCard = useShopStore((s) => s.addHandCard);
  const addHintTokens = usePlayerStore((s) => s.addHintTokens);

  const [showAnimation, setShowAnimation] = useState(false);
  const [gachaResults, setGachaResults] = useState<
    { characterId: string; name: string; rarity: 'N' | 'R' | 'SR' | 'SSR'; title: string; isNew: boolean }[]
  >([]);
  const [isTenPull, setIsTenPull] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  /** 本次抽到的消耗卡/道具汇总（人物动画播完后展示） */
  const [cardResults, setCardResults] = useState<{ name: string; type: string; rarity: string; kind: string }[] | null>(null);

  const pityRemaining = GACHA_CONFIG.supplyPool.characterPity - supplyPityCounter;

  const handlePull = useCallback(
    (isTen: boolean) => {
      const cost = isTen ? GACHA_CONFIG.tenCost : GACHA_CONFIG.singleCost;
      if (spiritStones < cost) return;

      addSpiritStones(-cost);
      // 与店内「便利屋补给」同一卡池、同一保底计数
      let ownedIds = ownedCharacters.map((c) => c.characterId);
      let pity = supplyPityCounter;
      const persons: { characterId: string; name: string; rarity: 'N' | 'R' | 'SR' | 'SSR'; title: string; isNew: boolean }[] = [];
      const cards: { name: string; type: string; rarity: string; kind: string }[] = [];

      for (let i = 0; i < (isTen ? 10 : 1); i++) {
        const { result, newPity } = pullSupply(ownedIds, affinityMap, pity);
        pity = newPity;
        if (result.kind === 'person') {
          addCharacter(result.character.id);
          addGachaResult(result.character.id, result.character.rarity);
          ownedIds = [...ownedIds, result.character.id];
          persons.push({
            characterId: result.character.id,
            name: result.character.name,
            rarity: result.character.rarity,
            title: result.character.title,
            isNew: result.isNew,
          });
        } else if (result.kind === 'hint') {
          addHintTokens(1);
          cards.push({ name: '消消乐提示券', type: '道具', rarity: 'R', kind: 'hint' });
        } else {
          addHandCard(result.card);
          cards.push({ name: result.card.name, type: result.card.type, rarity: result.card.rarity, kind: result.card.kind });
        }
      }
      setSupplyPityCounter(pity);

      if (persons.length > 0) {
        setGachaResults(persons);
        setIsTenPull(persons.length > 1);
        setShowAnimation(true);
        // 卡片汇总等人物动画播完再弹
        setCardResults(cards.length > 0 ? cards : null);
      } else {
        setCardResults(cards);
      }
    },
    [spiritStones, ownedCharacters, affinityMap, supplyPityCounter, addCharacter, addSpiritStones, addGachaResult, setSupplyPityCounter, addHandCard, addHintTokens],
  );

  // 心动 UP：好感已达标但尚未入伙的角色（同稀有度内权重提升）
  const heartUpCharacters = characters.filter((c) =>
    isHeartUp(c.id, ownedCharacters.map((o) => o.characterId), affinityMap),
  );

  const handleAnimationComplete = useCallback(() => {
    setShowAnimation(false);
    setGachaResults([]);
  }, []);

  const cardKindIcon = (kind: string) => (kind === 'skill' ? '⚡' : kind === 'tool' ? '🧰' : kind === 'hint' ? '💡' : '📡');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex min-h-screen flex-col items-center overflow-hidden bg-slate-950"
    >
      {/* 浮动粒子背景 */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [100, -20],
              x: [0, (Math.random() - 0.5) * 100],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: 'linear',
            }}
            className={cn(
              'absolute rounded-full',
              i % 3 === 0
                ? 'h-1.5 w-1.5 bg-amber-400/40'
                : i % 3 === 1
                  ? 'h-1 w-1 bg-purple-400/30'
                  : 'h-2 w-2 bg-blue-400/20',
            )}
            style={{
              left: `${Math.random() * 100}%`,
              bottom: '-5%',
            }}
          />
        ))}
      </div>

      {/* 顶部导航 */}
      <div className="relative z-10 flex w-full items-center px-4 pt-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 rounded-full bg-slate-800/60 px-3 py-1.5 backdrop-blur-sm">
          <span className="text-sm">💎</span>
          <span className="text-sm font-bold text-amber-300">{spiritStones.toLocaleString()}</span>
        </div>
      </div>

      {/* 中央展示区 */}
      <div className="relative z-10 mt-8 flex flex-1 flex-col items-center justify-center px-6">
        {/* 卡池展示 */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 30px rgba(147,51,234,0.2), 0 0 60px rgba(251,191,36,0.1)',
              '0 0 50px rgba(147,51,234,0.4), 0 0 80px rgba(251,191,36,0.2)',
              '0 0 30px rgba(147,51,234,0.2), 0 0 60px rgba(251,191,36,0.1)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className={cn(
            'relative mb-6 flex h-52 w-52 items-center justify-center rounded-2xl',
            'bg-gradient-to-br from-purple-900/60 to-slate-900/80',
            'border border-purple-500/30',
            'backdrop-blur-sm',
          )}
        >
          <div className="text-center">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="mb-3 text-4xl"
            >
              ✦
            </motion.div>
            <p className="text-lg font-bold text-purple-300">便利屋补给池</p>
            <p className="mt-1 text-xs text-slate-500">人物 · 技能 · 便利 · 情报</p>
          </div>

          {/* 装饰环 */}
          <motion.div
            animate={{ rotate: [0, -360] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-2 rounded-xl border border-dashed border-purple-500/20"
          />
        </motion.div>

        {/* 保底计数 */}
        <div className="mb-4 text-center">
          <p className="text-sm text-slate-400">
            距人物保底: <span className="font-bold text-amber-400">{pityRemaining}</span> 抽
          </p>
          <p className="mt-1 text-xs text-slate-600">
            人物概率 {(GACHA_CONFIG.supplyPool.characterRate * 100).toFixed(0)}% · 与店内补给池共享保底
          </p>
        </div>

        {/* 心动 UP 提示 */}
        {heartUpCharacters.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5 px-4">
            <span className="text-xs font-bold text-pink-400">💗 心动UP×{HEART_UP_WEIGHT}</span>
            {heartUpCharacters.map((c) => (
              <span
                key={c.id}
                className="rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-xs text-pink-300"
              >
                {c.name}
              </span>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRates(!showRates)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2',
              'bg-slate-800/60 text-xs text-slate-400',
              'border border-slate-700/30',
              'hover:bg-slate-700/60 hover:text-white',
              'transition-colors duration-200',
            )}
          >
            <Info size={14} />
            概率
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2',
              'bg-slate-800/60 text-xs text-slate-400',
              'border border-slate-700/30',
              'hover:bg-slate-700/60 hover:text-white',
              'transition-colors duration-200',
            )}
          >
            <History size={14} />
            记录
          </button>
        </div>

        {/* 概率展示 */}
        <AnimatePresence>
          {showRates && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 w-full max-w-xs overflow-hidden"
            >
              <div className="rounded-xl bg-slate-800/60 p-4 backdrop-blur-sm">
                <p className="mb-2 text-xs font-bold text-slate-400">抽取概率</p>
                <div className="space-y-2">
                  {[
                    { label: '人物卡', rate: `${(GACHA_CONFIG.supplyPool.characterRate * 100).toFixed(0)}%`, color: 'text-pink-400' },
                    { label: '技能卡', rate: `${GACHA_CONFIG.supplyPool.cardWeights.skill}%`, color: 'text-amber-400' },
                    { label: '便利卡', rate: `${GACHA_CONFIG.supplyPool.cardWeights.tool}%`, color: 'text-cyan-400' },
                    { label: '情报卡', rate: `${GACHA_CONFIG.supplyPool.cardWeights.info}%`, color: 'text-emerald-400' },
                    { label: '提示券', rate: `${GACHA_CONFIG.supplyPool.cardWeights.hint}%`, color: 'text-yellow-300' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${item.color}`}>{item.label}</span>
                      <span className="text-sm text-slate-300">{item.rate}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-slate-600">
                  人物硬保底: {GACHA_CONFIG.supplyPool.characterPity} 抽必出 · 人物稀有度 SSR {(GACHA_CONFIG.rates.SSR * 100).toFixed(0)}% / SR {(GACHA_CONFIG.rates.SR * 100).toFixed(0)}% / R {(GACHA_CONFIG.rates.R * 100).toFixed(0)}%
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 抽卡记录 */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 w-full max-w-xs overflow-hidden"
            >
              <div className="max-h-40 overflow-y-auto rounded-xl bg-slate-800/60 p-4 backdrop-blur-sm">
                <p className="mb-2 text-xs font-bold text-slate-400">抽卡记录</p>
                {gachaHistory.length === 0 ? (
                  <p className="text-xs text-slate-600">暂无记录</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...gachaHistory].reverse().slice(0, 20).map((entry, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span
                          className={
                            entry.rarity === 'SSR'
                              ? 'font-bold text-amber-400'
                              : entry.rarity === 'SR'
                                ? 'font-bold text-purple-400'
                                : entry.rarity === 'R'
                                  ? 'text-blue-400'
                                  : 'text-slate-500'
                          }
                        >
                          {entry.rarity}
                        </span>
                        <span className="text-slate-400">
                          {new Date(entry.timestamp).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部抽卡按钮 */}
      <div className="relative z-10 w-full px-6 pb-24 pt-4">
        <div className="flex gap-4">
          {/* 单抽 */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handlePull(false)}
            disabled={spiritStones < GACHA_CONFIG.singleCost}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-xl py-4',
              'bg-gradient-to-r from-slate-700 to-slate-800',
              'border border-slate-600/50',
              'text-white',
              'shadow-lg',
              'transition-all duration-200',
              spiritStones < GACHA_CONFIG.singleCost && 'cursor-not-allowed opacity-50',
            )}
          >
            <span className="text-base font-bold">单抽</span>
            <span className="flex items-center gap-1 text-xs text-amber-300">
              💎 {GACHA_CONFIG.singleCost}
            </span>
          </motion.button>

          {/* 十连 */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handlePull(true)}
            disabled={spiritStones < GACHA_CONFIG.tenCost}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-xl py-4',
              'bg-gradient-to-r from-purple-600 to-purple-700',
              'border border-purple-500/50',
              'text-white',
              'shadow-[0_0_20px_rgba(147,51,234,0.3)]',
              'transition-all duration-200',
              spiritStones < GACHA_CONFIG.tenCost && 'cursor-not-allowed opacity-50',
            )}
          >
            <span className="text-base font-bold">十连</span>
            <span className="flex items-center gap-1 text-xs text-amber-300">
              💎 {GACHA_CONFIG.tenCost}
            </span>
          </motion.button>
        </div>
      </div>

      {/* 消耗卡汇总弹窗 */}
      <AnimatePresence>
        {cardResults && !showAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm"
            onClick={() => setCardResults(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-4 shadow-2xl"
            >
              <p className="mb-3 text-center text-sm font-black text-white">📦 补给到货 ×{cardResults.length}</p>
              <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
                {cardResults.map((c, i) => (
                  <div key={i} className={cn(
                    'rounded-xl border p-2.5',
                    c.rarity === 'SR' ? 'border-purple-400/50 bg-purple-500/10' : 'border-white/10 bg-white/5',
                  )}>
                    <div className="flex items-center gap-1.5">
                      <span>{cardKindIcon(c.kind)}</span>
                      <p className="truncate text-xs font-bold text-white">{c.name}</p>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">{c.type} · <span className={c.rarity === 'SR' ? 'text-purple-300' : 'text-slate-400'}>{c.rarity}</span></p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-[10px] font-bold text-pink-300">💗 距人物保底还剩 {pityRemaining} 抽</p>
              <button
                onClick={() => setCardResults(null)}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 py-2.5 text-sm font-black text-white"
              >
                收下
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 抽卡动画覆盖层 */}
      <AnimatePresence>
        {showAnimation && gachaResults.length > 0 && (
          <GachaAnimation
            results={gachaResults}
            isTenPull={isTenPull}
            onComplete={handleAnimationComplete}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
