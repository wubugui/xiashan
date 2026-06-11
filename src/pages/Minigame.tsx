import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Grid3x3, Puzzle, Boxes, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import LinkGame from '@/components/minigames/LinkGame';
import { cn } from '@/lib/utils';

/**
 * 小游戏中心。新增一个小游戏 = 往 GAMES 里加一行配置 + 一个组件，
 * 不动其它代码。reward 由各小游戏自行发放（见 LinkGame）。
 */
type GameDef = {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  ready: boolean;
};

const GAMES: GameDef[] = [
  { id: 'link', name: '仙缘消消乐', desc: '拖动交换相邻图块，三消获得灵石', icon: Grid3x3, color: 'from-amber-500 to-amber-700', ready: true },
  { id: 'puzzle', name: '立绘拼图', desc: '拼好即可欣赏角色立绘', icon: Puzzle, color: 'from-rose-500 to-rose-700', ready: false },
  { id: 'sokoban', name: '推箱寻宝', desc: '推动机关，闯关夺灵石', icon: Boxes, color: 'from-blue-500 to-blue-700', ready: false },
];

export default function Minigame() {
  const navigate = useNavigate();
  const spiritStones = usePlayerStore((s) => s.spiritStones);
  const [active, setActive] = useState<string | null>(null);

  if (active === 'link') return <LinkGame onExit={() => setActive(null)} />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#101827] pb-24">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800" />

      <div className="relative z-10">
        <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/78 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate('/')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
              aria-label="返回"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black tracking-wide text-white">小游戏</h1>
              <p className="text-xs font-medium text-amber-300">玩游戏赚灵石，用于抽卡与养成</p>
            </div>
            <div className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-amber-300">
              💎 {spiritStones.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-md px-4 pt-4">
          <div className="grid grid-cols-1 gap-3">
            {GAMES.map((g, i) => {
              const Icon = g.icon;
              return (
                <motion.button
                  key={g.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={g.ready ? { scale: 1.02 } : undefined}
                  whileTap={g.ready ? { scale: 0.98 } : undefined}
                  onClick={() => g.ready && setActive(g.id)}
                  className={cn(
                    'group relative flex items-center gap-4 overflow-hidden rounded-xl border border-slate-700/30 bg-slate-900/60 p-4 text-left backdrop-blur-md transition-shadow',
                    g.ready ? 'hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]' : 'cursor-not-allowed opacity-50 grayscale',
                  )}
                >
                  <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-lg', g.color)}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-white">{g.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{g.ready ? g.desc : '敬请期待'}</p>
                  </div>
                  {!g.ready && <Lock size={16} className="shrink-0 text-slate-500" />}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
