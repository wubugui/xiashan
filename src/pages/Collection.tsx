import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { characters, getCharacterById } from '@/data/characters';
import { GACHA_CONFIG } from '@/data/gachaConfig';
import CharacterCard from '@/components/CharacterCard';
import { cn } from '@/lib/utils';
import PageBackdrop from '@/components/PageBackdrop';
import { SCENE_BACKDROPS } from '@/lib/pageBackdrops';

type RarityFilter = '全部' | 'SSR' | 'SR' | 'R' | 'N';

export default function Collection() {
  const navigate = useNavigate();
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const [activeFilter, setActiveFilter] = useState<RarityFilter>('全部');

  const filters: RarityFilter[] = ['全部', 'SSR', 'SR', 'R', 'N'];

  const ownedList = useMemo(() => {
    return ownedCharacters
      .map((oc) => {
        const char = getCharacterById(oc.characterId);
        if (!char) return null;
        return { ...char, level: oc.level, affinity: affinityMap[oc.characterId] ?? 0 };
      })
      .filter(Boolean) as (typeof characters[number] & { level: number; affinity: number })[];
  }, [ownedCharacters, affinityMap]);

  const filteredList = useMemo(() => {
    if (activeFilter === '全部') return ownedList;
    return ownedList.filter((c) => c.rarity === activeFilter);
  }, [ownedList, activeFilter]);

  const ownedByRarity = useMemo(() => {
    return ownedList.reduce<Record<string, number>>((acc, char) => {
      acc[char.rarity] = (acc[char.rarity] || 0) + 1;
      return acc;
    }, {});
  }, [ownedList]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050914] pb-nav">
      <PageBackdrop
        image={SCENE_BACKDROPS.street.image}
        mobileImage={SCENE_BACKDROPS.street.mobileImage}
        position={SCENE_BACKDROPS.street.position}
        overlayClassName="from-slate-950/60 via-slate-950/70 to-slate-950/90"
      />

      <div className="relative z-10">
        <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/78 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
              aria-label="返回"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black tracking-wide text-white">角色图鉴</h1>
              <p className="text-xs font-medium text-emerald-300">
                已收集 {ownedCharacters.length}/{characters.length} · SSR {ownedByRarity.SSR || 0} · SR {ownedByRarity.SR || 0}
              </p>
            </div>
            <button
              onClick={() => navigate('/bonds')}
              className="shrink-0 rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-300 hover:bg-pink-500/20"
            >
              💌 缘分图鉴
            </button>
          </div>

          <div className="px-4 pb-3">
            <div className="mb-3 rounded-sm border border-white/10 bg-slate-900/70 px-3 py-2 text-center text-sm font-bold text-white shadow-inner">
              召唤概率：
              <span className="text-amber-300"> SSR {(GACHA_CONFIG.rates.SSR * 100).toFixed(1)}%</span>
              <span className="text-purple-300"> SR {(GACHA_CONFIG.rates.SR * 100).toFixed(0)}%</span>
              <span className="text-blue-300"> R {(GACHA_CONFIG.rates.R * 100).toFixed(0)}%</span>
              <span className="text-slate-300"> N {(GACHA_CONFIG.rates.N * 100).toFixed(0)}%</span>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {filters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={cn(
                    'shrink-0 rounded-sm border px-4 py-1.5 text-sm font-black transition-colors',
                    activeFilter === filter
                      ? 'border-amber-300 bg-amber-300 text-slate-950'
                      : 'border-white/15 bg-slate-900/75 text-slate-200 hover:bg-slate-800',
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pt-4">
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-slate-950/55 py-20">
              <div className="mb-4 text-5xl opacity-30">人</div>
              <p className="text-sm text-slate-400">
                {activeFilter === '全部' ? '暂无角色，去抽卡获取吧' : `暂无 ${activeFilter} 角色`}
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                <AnimatePresence>
                  {filteredList.map((char, index) => (
                    <motion.div
                      key={char.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.025, 0.25), duration: 0.22 }}
                    >
                      <CharacterCard
                        characterId={char.id}
                        name={char.name}
                        title={char.title}
                        rarity={char.rarity}
                        level={char.level}
                        onClick={() => navigate(`/character/${char.id}`)}
                        size="md"
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
