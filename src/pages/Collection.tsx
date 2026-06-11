import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { characters, getCharacterById } from '@/data/characters';
import { GACHA_CONFIG } from '@/data/gachaConfig';
import CharacterCard from '@/components/CharacterCard';
import { cn } from '@/lib/utils';

type RarityFilter = '全部' | 'SSR' | 'SR' | 'R' | 'N';

export default function Collection() {
  const navigate = useNavigate();
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const [activeFilter, setActiveFilter] = useState<RarityFilter>('全部');

  const filters: RarityFilter[] = ['全部', 'SSR', 'SR', 'R', 'N'];

  const ownedList = useMemo(() => {
    return ownedCharacters
      .map((oc) => {
        const char = getCharacterById(oc.characterId);
        if (!char) return null;
        return { ...char, level: oc.level, affinity: oc.affinity };
      })
      .filter(Boolean) as (typeof characters[number] & { level: number; affinity: number })[];
  }, [ownedCharacters]);

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
    <div className="relative min-h-screen overflow-hidden bg-[#101827] pb-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(168,85,247,0.22),transparent_34%),linear-gradient(120deg,#0f172a_0%,#1f2937_48%,#cbd5e1_49%,#e5e7eb_100%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute -right-16 top-0 h-28 w-[40vw] -skew-x-[28deg] bg-fuchsia-500/55" />
      <div className="absolute -left-14 top-24 h-24 w-[22vw] -skew-x-[28deg] bg-purple-500/55" />
      <div className="absolute -bottom-20 right-0 h-48 w-[64vw] -skew-x-[24deg] bg-fuchsia-500/55" />

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
