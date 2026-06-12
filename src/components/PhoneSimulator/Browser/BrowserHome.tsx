import { ChevronLeft, Search } from 'lucide-react';
import { useMemo } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useShopStore } from '@/store/useShopStore';
import { generateBrowserNews } from '@/engine/browserNewsEngine';

interface BrowserHomeProps {
  onOpenPage: (url: string) => void;
  onBack: () => void;
}

const TAG_COLORS: Record<string, string> = {
  同城: 'bg-red-500/20 text-red-400',
  热搜: 'bg-orange-500/20 text-orange-400',
  夜话: 'bg-indigo-500/20 text-indigo-400',
  街角: 'bg-emerald-500/20 text-emerald-400',
  校园: 'bg-sky-500/20 text-sky-400',
  职场: 'bg-amber-500/20 text-amber-400',
  传说: 'bg-purple-500/20 text-purple-400',
  民生: 'bg-teal-500/20 text-teal-400',
};

export default function BrowserHome({ onOpenPage, onBack }: BrowserHomeProps) {
  const affinityMap = usePlayerStore(s => s.affinityMap);
  const ownedCharacters = usePlayerStore(s => s.ownedCharacters);
  const flags = usePlayerStore(s => s.flags);
  const board = useShopStore(s => s.board);
  const commission = useShopStore(s => s.commission);
  const routes = useShopStore(s => s.routes);

  const newsItems = useMemo(
    () => generateBrowserNews({
      boardIds: board,
      acceptedCommissionId: commission?.id ?? null,
      routeLocationIds: routes.map(l => l.id),
      affinityMap,
      ownedCharacterIds: ownedCharacters.map(c => c.characterId),
      flags,
    }),
    [board, commission, routes, affinityMap, ownedCharacters, flags],
  );

  return (
    <div className="flex h-full flex-col" style={{ background: '#1c1c1e' }}>
      {/* 地址栏 */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-2">
        <button onClick={onBack} className="text-blue-400">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 flex items-center gap-2 rounded-lg bg-[#2c2c2e] px-3 py-1.5">
          <span className="text-xs text-white/30">🔒</span>
          <span className="text-xs text-white/40">citynews.local</span>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 rounded-xl bg-[#2c2c2e] px-4 py-3">
          <Search size={16} className="text-white/30" />
          <span className="text-sm text-white/30">搜索或输入网址</span>
        </div>
      </div>

      {/* 新闻列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <h3 className="mb-3 text-xs font-semibold text-white/40 uppercase tracking-wider">今日城事</h3>
        <div className="space-y-3">
          {newsItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpenPage(item.id)}
              className="w-full rounded-xl bg-[#2c2c2e] p-3 text-left transition-colors active:bg-[#3c3c3e]"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TAG_COLORS[item.tag] ?? 'bg-red-500/20 text-red-400'}`}>
                  {item.tag}
                </span>
                <span className="text-[10px] text-white/30">{item.time}</span>
              </div>
              <h4 className="text-sm font-medium text-white/90 line-clamp-2">
                {item.title}
              </h4>
              <p className="mt-1 text-xs text-white/40 line-clamp-2">
                {item.summary}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
