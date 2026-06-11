import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, History } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { pullSingle, pullTen, isHeartUp, HEART_UP_WEIGHT } from '@/engine/gachaEngine';
import { GACHA_CONFIG } from '@/data/gachaConfig';
import { characters } from '@/data/characters';
import GachaAnimation from '@/components/GachaAnimation';
import { cn } from '@/lib/utils';

export default function Gacha() {
  const navigate = useNavigate();
  const spiritStones = usePlayerStore((s) => s.spiritStones);
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const pityCounter = usePlayerStore((s) => s.pityCounter);
  const totalGachaCount = usePlayerStore((s) => s.totalGachaCount);
  const gachaHistory = usePlayerStore((s) => s.gachaHistory);
  const addCharacter = usePlayerStore((s) => s.addCharacter);
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);
  const addGachaResult = usePlayerStore((s) => s.addGachaResult);
  const setPityCounter = usePlayerStore((s) => s.setPityCounter);
  const setTotalGachaCount = usePlayerStore((s) => s.setTotalGachaCount);

  const [showAnimation, setShowAnimation] = useState(false);
  const [gachaResults, setGachaResults] = useState<
    { characterId: string; name: string; rarity: 'N' | 'R' | 'SR' | 'SSR'; title: string; isNew: boolean }[]
  >([]);
  const [isTenPull, setIsTenPull] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const pityRemaining = GACHA_CONFIG.pity.SSR - pityCounter;

  const handlePull = useCallback(
    (isTen: boolean) => {
      const cost = isTen ? GACHA_CONFIG.tenCost : GACHA_CONFIG.singleCost;
      if (spiritStones < cost) return;

      addSpiritStones(-cost);
      const ownedIds = ownedCharacters.map((c) => c.characterId);

      if (isTen) {
        const result = pullTen(ownedIds, affinityMap, pityCounter, totalGachaCount);
        const formatted = result.results.map((r) => ({
          characterId: r.character.id,
          name: r.character.name,
          rarity: r.character.rarity,
          title: r.character.title,
          isNew: r.isNew,
        }));

        // 更新 store
        result.results.forEach((r) => {
          addCharacter(r.character.id);
          addGachaResult(r.character.id, r.character.rarity);
        });
        setPityCounter(result.newPity);
        setTotalGachaCount(result.newTotal);

        setGachaResults(formatted);
        setIsTenPull(true);
      } else {
        const result = pullSingle(ownedIds, affinityMap, pityCounter, totalGachaCount);
        const formatted = [
          {
            characterId: result.result.character.id,
            name: result.result.character.name,
            rarity: result.result.character.rarity,
            title: result.result.character.title,
            isNew: result.result.isNew,
          },
        ];

        addCharacter(result.result.character.id);
        addGachaResult(result.result.character.id, result.result.character.rarity);
        setPityCounter(result.newPity);
        setTotalGachaCount(result.newTotal);

        setGachaResults(formatted);
        setIsTenPull(false);
      }

      setShowAnimation(true);
    },
    [spiritStones, ownedCharacters, affinityMap, pityCounter, totalGachaCount, addCharacter, addSpiritStones, addGachaResult, setPityCounter, setTotalGachaCount],
  );

  // 心动 UP：好感已达标但尚未入伙的角色（同稀有度内权重提升）
  const heartUpCharacters = characters.filter((c) =>
    isHeartUp(c.id, ownedCharacters.map((o) => o.characterId), affinityMap),
  );

  const handleAnimationComplete = useCallback(() => {
    setShowAnimation(false);
    setGachaResults([]);
  }, []);

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
            <p className="text-lg font-bold text-purple-300">常驻卡池</p>
            <p className="mt-1 text-xs text-slate-500">缘分天注定</p>
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
            距SSR保底: <span className="font-bold text-amber-400">{pityRemaining}</span> 抽
          </p>
          <p className="mt-1 text-xs text-slate-600">
            已抽 {totalGachaCount} 次
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
                    { label: 'SSR', rate: `${(GACHA_CONFIG.rates.SSR * 100).toFixed(1)}%`, color: 'text-amber-400' },
                    { label: 'SR', rate: `${(GACHA_CONFIG.rates.SR * 100).toFixed(0)}%`, color: 'text-purple-400' },
                    { label: 'R', rate: `${(GACHA_CONFIG.rates.R * 100).toFixed(0)}%`, color: 'text-blue-400' },
                    { label: 'N', rate: `${(GACHA_CONFIG.rates.N * 100).toFixed(0)}%`, color: 'text-slate-400' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${item.color}`}>{item.label}</span>
                      <span className="text-sm text-slate-300">{item.rate}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-slate-600">
                  SSR保底: {GACHA_CONFIG.pity.SSR}抽 | SR保底: {GACHA_CONFIG.pity.SR}抽
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
