import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Shuffle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById, type Character } from '@/data/characters';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/sound';
import { assetUrl } from '@/lib/assets';
import PageBackdrop from '@/components/PageBackdrop';
import { SCENE_BACKDROPS } from '@/lib/pageBackdrops';

/**
 * 立绘拼图 — 点两块交换的 3×3 拼图，拼好即赏她的立绘并得月光。
 * 拼图素材取自已拥有角色的立绘；可切换拼谁。每日首次拼成给全额月光，之后少量补偿。
 */
const N = 3;

/** 打乱成一个非完成态的排列 */
function shuffled(): number[] {
  const a = Array.from({ length: N * N }, (_, i) => i);
  do {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  } while (a.every((v, i) => v === i));
  return a;
}

export default function PuzzleGame({ onExit }: { onExit: () => void }) {
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);
  const tryDailyAction = usePlayerStore((s) => s.tryDailyAction);

  const pool: Character[] = (() => {
    const owned = ownedCharacters
      .map((o) => getCharacterById(o.characterId))
      .filter((c): c is Character => !!c);
    return owned.length ? owned : [getCharacterById('suli')].filter((c): c is Character => !!c);
  })();

  const [charId, setCharId] = useState(pool[0]?.id ?? 'suli');
  const char = getCharacterById(charId) ?? pool[0];
  const img = char?.gachaBackgroundUrl || char?.portraitUrl || '';

  const [order, setOrder] = useState<number[]>(() => shuffled());
  const [sel, setSel] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const restart = (cid = charId) => {
    setCharId(cid);
    setOrder(shuffled());
    setSel(null);
    setSolved(false);
    setNotice(null);
  };

  const finish = () => {
    setSolved(true);
    playSound('stage-up');
    confetti({ particleCount: 120, spread: 72, origin: { y: 0.6 } });
    const full = tryDailyAction('minigame_puzzle');
    const reward = full ? 120 : 20;
    addSpiritStones(reward);
    setNotice(full ? `拼好啦！月光 +${reward}` : `又拼好啦~月光 +${reward}（今天的奖励领过咯）`);
  };

  const tap = (pos: number) => {
    if (solved) return;
    playSound('btn-confirm');
    if (sel === null) { setSel(pos); return; }
    if (sel === pos) { setSel(null); return; }
    const next = [...order];
    [next[sel], next[pos]] = [next[pos], next[sel]];
    setSel(null);
    setOrder(next);
    if (next.every((v, i) => v === i)) finish();
  };

  /** 第 piece 块在原图中的背景定位（3×3 → 0/50/100%） */
  const pieceStyle = (piece: number) => {
    const col = piece % N;
    const row = Math.floor(piece / N);
    return {
      backgroundImage: `url("${assetUrl(img)}")`,
      backgroundSize: `${N * 100}% ${N * 100}%`,
      backgroundPosition: `${(col / (N - 1)) * 100}% ${(row / (N - 1)) * 100}%`,
    };
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050914] pb-nav">
      <PageBackdrop
        image={SCENE_BACKDROPS.studio.image}
        mobileImage={SCENE_BACKDROPS.studio.mobileImage}
        position={SCENE_BACKDROPS.studio.position}
        overlayClassName="from-slate-950/60 via-slate-950/75 to-slate-950/92"
      />
      <div className="relative z-10">
        {/* 顶栏 */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-slate-950/78 px-4 py-3 backdrop-blur-xl">
          <button onClick={onExit} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20" aria-label="返回">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black tracking-wide text-white">🧩 立绘拼图</h1>
            <p className="text-xs font-medium text-rose-300">拼好就能看清她，还能换月光</p>
          </div>
          <button onClick={() => restart()} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/20">
            <Shuffle size={13} /> 打乱
          </button>
        </div>

        {/* 选择拼谁 */}
        {pool.length > 1 && (
          <div className="mx-auto max-w-md px-4 pt-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pool.map((c) => (
                <button
                  key={c.id}
                  onClick={() => restart(c.id)}
                  className={cn('shrink-0 overflow-hidden rounded-full ring-2 transition-all', c.id === charId ? 'ring-rose-400' : 'ring-white/10 opacity-60')}
                >
                  <img src={assetUrl(c.avatarUrl)} alt={c.name} className="h-9 w-9 object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 拼图盘 */}
        <div className="mx-auto max-w-md px-4 pt-4">
          <div className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
            {solved ? (
              <motion.img
                initial={{ opacity: 0.4, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                src={assetUrl(img)}
                alt={char?.name}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-[2px] p-[2px]">
                {order.map((piece, pos) => (
                  <button
                    key={pos}
                    onClick={() => tap(pos)}
                    className={cn(
                      'relative overflow-hidden rounded-[3px] bg-cover transition-all active:scale-95',
                      sel === pos ? 'ring-2 ring-rose-400 z-10 scale-[0.97]' : 'ring-0',
                    )}
                    style={pieceStyle(piece)}
                  >
                    {sel === pos && <span className="absolute inset-0 bg-rose-400/20" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-xs text-white/55">
            {solved ? `${char?.name} · ${char?.title}` : sel === null ? '点一块，再点另一块，交换位置' : '再点一块和它交换'}
          </p>
        </div>
      </div>

      {/* 完成提示 */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-x-0 z-[120] flex justify-center px-4" style={{ bottom: 'calc(var(--nav-h, 0px) + 24px)' }}
          >
            <div className="flex items-center gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 shadow-xl ring-1 ring-rose-400/30">
              <span className="text-sm font-bold text-rose-100">{notice}</span>
              <button onClick={() => restart()} className="shrink-0 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-black text-white">再来一张</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
