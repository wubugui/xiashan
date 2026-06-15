import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';
import { playSound } from '@/lib/sound';
import PageBackdrop from '@/components/PageBackdrop';
import { SCENE_BACKDROPS } from '@/lib/pageBackdrops';

/**
 * 推箱寻宝 — 把货箱📦推到月光位🌙，全部到位即通关、夺月光。
 * 关卡用字符图：# 墙 / @ 玩家 / $ 货箱 / . 月光位 / 空格地面。每关每日首通给全额月光。
 */
const LEVELS: string[][] = [
  ['#######', '#@ $ .#', '#######'],
  ['########', '#@ $  .#', '#  $  .#', '########'],
  ['######', '#.  .#', '#    #', '#$  $#', '#@   #', '######'],
];

type Pt = { r: number; c: number };
const key = (r: number, c: number) => `${r},${c}`;

interface Level { walls: Set<string>; targets: Set<string>; boxes: Set<string>; player: Pt; rows: number; cols: number }

function parse(map: string[]): Level {
  const walls = new Set<string>(), targets = new Set<string>(), boxes = new Set<string>();
  let player: Pt = { r: 0, c: 0 };
  map.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === '#') walls.add(key(r, c));
      else if (ch === '.') targets.add(key(r, c));
      else if (ch === '$') boxes.add(key(r, c));
      else if (ch === '@') player = { r, c };
    });
  });
  return { walls, targets, boxes, player, rows: map.length, cols: Math.max(...map.map((l) => l.length)) };
}

export default function SokobanGame({ onExit }: { onExit: () => void }) {
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);
  const tryDailyAction = usePlayerStore((s) => s.tryDailyAction);

  const [idx, setIdx] = useState(0);
  const [lv, setLv] = useState<Level>(() => parse(LEVELS[0]));
  const [cleared, setCleared] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = (i: number) => { setIdx(i); setLv(parse(LEVELS[i])); setCleared(false); setNotice(null); };

  const move = useCallback((dr: number, dc: number) => {
    setLv((prev) => {
      if (cleared) return prev;
      const { r, c } = prev.player;
      const nr = r + dr, nc = c + dc;
      if (prev.walls.has(key(nr, nc))) return prev;
      const boxes = new Set(prev.boxes);
      if (boxes.has(key(nr, nc))) {
        const br = nr + dr, bc = nc + dc;
        if (prev.walls.has(key(br, bc)) || boxes.has(key(br, bc))) return prev; // 推不动
        boxes.delete(key(nr, nc));
        boxes.add(key(br, bc));
        playSound('btn-confirm');
      }
      const next = { ...prev, boxes, player: { r: nr, c: nc } };
      const win = [...next.targets].every((t) => next.boxes.has(t));
      if (win) {
        setCleared(true);
        playSound('stage-up');
        confetti({ particleCount: 90, spread: 60, origin: { y: 0.6 } });
        const last = idx === LEVELS.length - 1;
        const base = tryDailyAction(`sokoban_lv:${idx}`) ? 40 : 5;
        const bonus = last && tryDailyAction('sokoban_all') ? 80 : 0;
        addSpiritStones(base + bonus);
        if (last) { setAllDone(true); setNotice(`三关全通！月光 +${base + bonus} 🌙`); }
        else setNotice(`第 ${idx + 1} 关通关！月光 +${base}`);
      }
      return next;
    });
  }, [cleared, idx, addSpiritStones, tryDailyAction]);

  // 键盘方向键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (m[e.key]) { e.preventDefault(); move(...m[e.key]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  const cellChar = (r: number, c: number) => {
    const k = key(r, c);
    if (lv.walls.has(k)) return 'wall';
    const isTarget = lv.targets.has(k), isBox = lv.boxes.has(k), isPlayer = lv.player.r === r && lv.player.c === c;
    if (isBox) return isTarget ? 'box-ok' : 'box';
    if (isPlayer) return 'player';
    if (isTarget) return 'target';
    return 'floor';
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050914] pb-nav">
      <PageBackdrop
        image={SCENE_BACKDROPS.store.image}
        mobileImage={SCENE_BACKDROPS.store.mobileImage}
        position={SCENE_BACKDROPS.store.position}
        overlayClassName="from-slate-950/55 via-slate-950/72 to-slate-950/92"
      />
      <div className="relative z-10">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-slate-950/78 px-4 py-3 backdrop-blur-xl">
          <button onClick={onExit} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20" aria-label="返回">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black tracking-wide text-white">📦 推箱寻宝</h1>
            <p className="text-xs font-medium text-sky-300">把货箱推到月光位 · 第 {idx + 1}/{LEVELS.length} 关</p>
          </div>
          <button onClick={() => load(idx)} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/20">
            <RotateCcw size={13} /> 重来
          </button>
        </div>

        {/* 棋盘 */}
        <div className="mx-auto max-w-md px-4 pt-6">
          <div className="mx-auto w-fit rounded-2xl border border-white/10 bg-slate-900/70 p-2">
            {Array.from({ length: lv.rows }).map((_, r) => (
              <div key={r} className="flex">
                {Array.from({ length: lv.cols }).map((_, c) => {
                  const t = cellChar(r, c);
                  return (
                    <div
                      key={c}
                      className={cn(
                        'flex h-11 w-11 items-center justify-center text-2xl',
                        t === 'wall' && 'rounded-[3px] bg-slate-700/80',
                        t !== 'wall' && 'rounded-[3px] bg-slate-800/30',
                      )}
                    >
                      {t === 'player' && '🧑'}
                      {t === 'box' && '📦'}
                      {t === 'box-ok' && '✅'}
                      {t === 'target' && '🌙'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 方向键 */}
        <div className="mx-auto mt-7 w-fit">
          <div className="flex justify-center">
            <Dpad icon={ArrowUp} onClick={() => move(-1, 0)} />
          </div>
          <div className="flex justify-center gap-2">
            <Dpad icon={ArrowLeft} onClick={() => move(0, -1)} />
            <Dpad icon={ArrowDown} onClick={() => move(1, 0)} />
            <Dpad icon={ArrowRight} onClick={() => move(0, 1)} />
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-white/45">手机点方向键，电脑可用 ↑↓←→</p>
      </div>

      {/* 通关提示 */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-x-0 z-[120] flex justify-center px-4" style={{ bottom: 'calc(var(--nav-h, 0px) + 24px)' }}
          >
            <div className="flex items-center gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 shadow-xl ring-1 ring-sky-400/30">
              <span className="text-sm font-bold text-sky-100">{notice}</span>
              {allDone ? (
                <button onClick={() => load(0)} className="shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-black text-white">从头再来</button>
              ) : (
                <button onClick={() => load(idx + 1)} className="shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-black text-white">下一关 →</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Dpad({ icon: Icon, onClick }: { icon: typeof ArrowUp; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="m-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white/85 ring-1 ring-white/15 transition-all active:scale-90 active:bg-white/20"
    >
      <Icon size={24} />
    </button>
  );
}
