import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, RotateCcw, Timer, Lightbulb } from 'lucide-react';
import confetti from 'canvas-confetti';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';

/**
 * 便利屋消消乐 — 拖动交换相邻图块，三消或以上播放消除动画并获得灵石。
 * 支持连锁消除、提示、死局自动洗牌。
 * 牌面使用高对比的符号图块（颜色 + 图案双重区分），不再用角色头像。
 */

const ROWS = 8;
const COLS = 6;
const CELL = 52; // px per tile
const REWARD_PER_TILE = 5; // 每消除一块 5 灵石
const DRAG_THRESHOLD = CELL * 0.28; // 拖动距离超过此值才触发交换
const HINT_COOLDOWN = 3; // 提示冷却（秒）
const FREE_HINTS_PER_DAY = 3;

/** 六种图块：颜色 + 图案双重区分，色盲也能靠形状分辨 */
const TILE_STYLES: Record<string, { emoji: string; bg: string; border: string }> = {
  gem:    { emoji: '💎', bg: 'bg-gradient-to-br from-sky-400/80 to-blue-700/80',      border: 'border-sky-200/60' },
  coffee: { emoji: '☕', bg: 'bg-gradient-to-br from-amber-500/80 to-orange-800/80',  border: 'border-amber-200/60' },
  moon:   { emoji: '🌙', bg: 'bg-gradient-to-br from-indigo-400/80 to-violet-800/80', border: 'border-indigo-200/60' },
  cat:    { emoji: '🐱', bg: 'bg-gradient-to-br from-pink-400/80 to-rose-700/80',     border: 'border-pink-200/60' },
  star:   { emoji: '⭐', bg: 'bg-gradient-to-br from-yellow-300/80 to-amber-600/80',  border: 'border-yellow-100/60' },
  mail:   { emoji: '💌', bg: 'bg-gradient-to-br from-emerald-400/80 to-teal-700/80',  border: 'border-emerald-200/60' },
};
const KINDS = Object.keys(TILE_STYLES);

interface Tile { id: number; kind: string }
let UID = 1;
const mkTile = (kind: string): Tile => ({ id: UID++, kind });

/* ───── 工具函数 ───── */

/** 初始化棋盘，避免生成时就存在三连 */
function buildGrid(): Tile[][] {
  const g: Tile[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < COLS; c++) {
      let kind: string;
      let t = 0;
      do {
        kind = KINDS[Math.floor(Math.random() * KINDS.length)];
        t++;
      } while (
        t < 12 &&
        ((c >= 2 && row[c - 1]?.kind === kind && row[c - 2]?.kind === kind) ||
          (r >= 2 && g[r - 1]?.[c]?.kind === kind && g[r - 2]?.[c]?.kind === kind))
      );
      row.push(mkTile(kind));
    }
    g.push(row);
  }
  return g;
}

/** 找到所有满足三连（横 / 竖 ≥ 3）的位置 */
function findMatches(g: Tile[][]): Set<string> {
  const hit = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    let s = 0;
    for (let c = 1; c <= COLS; c++) {
      if (c < COLS && g[r][c].kind === g[r][s].kind) continue;
      if (c - s >= 3) for (let k = s; k < c; k++) hit.add(`${r},${k}`);
      s = c;
    }
  }
  for (let c = 0; c < COLS; c++) {
    let s = 0;
    for (let r = 1; r <= ROWS; r++) {
      if (r < ROWS && g[r][c].kind === g[s][c].kind) continue;
      if (r - s >= 3) for (let k = s; k < r; k++) hit.add(`${k},${c}`);
      s = r;
    }
  }
  return hit;
}

/** 消除指定位置，剩余图块下落，顶部补充新图块 */
function collapse(g: Tile[][], toRemove: Set<string>): Tile[][] {
  const next: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null as unknown as Tile));
  for (let c = 0; c < COLS; c++) {
    const col: Tile[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!toRemove.has(`${r},${c}`)) col.push(g[r][c]);
    }
    for (let r = ROWS - 1; r >= 0; r--) {
      next[r][c] = col.shift() ?? mkTile(KINDS[Math.floor(Math.random() * KINDS.length)]);
    }
  }
  return next;
}

/** 寻找一步可消除的交换（提示 / 死局检测共用） */
function findHint(g: Tile[][]): [number, number, number, number] | null {
  const trySwap = (ar: number, ac: number, br: number, bc: number) => {
    const next = g.map((row) => [...row]);
    [next[ar][ac], next[br][bc]] = [next[br][bc], next[ar][ac]];
    return findMatches(next).size > 0;
  };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS && trySwap(r, c, r, c + 1)) return [r, c, r, c + 1];
      if (r + 1 < ROWS && trySwap(r, c, r + 1, c)) return [r, c, r + 1, c];
    }
  }
  return null;
}

/* ───── 组件 ───── */

export default function LinkGame({ onExit }: { onExit: () => void }) {
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);
  const hintTokens = usePlayerStore((s) => s.hintTokens);
  const freeHints = usePlayerStore((s) => s.freeHints);
  const consumeMinigameHint = usePlayerStore((s) => s.consumeMinigameHint);

  const [grid, setGrid] = useState<Tile[][]>(() => buildGrid());
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [combo, setCombo] = useState(0); // 当前连锁层数（展示用）
  const [hintPair, setHintPair] = useState<Set<string> | null>(null);
  const [hintReadyAt, setHintReadyAt] = useState(0); // 提示冷却截止时间戳
  const [reshuffled, setReshuffled] = useState(false); // 死局洗牌提示
  const [hintNotice, setHintNotice] = useState<string | null>(null);

  const drag = useRef<{ r: number; c: number; x: number; y: number } | null>(null);
  const [dragVisual, setDragVisual] = useState<{ r: number; c: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const hintCooldownLeft = Math.max(0, Math.ceil((hintReadyAt - Date.now()) / 1000));
  const today = new Date().toISOString().slice(0, 10);
  const freeLeft = Math.max(0, FREE_HINTS_PER_DAY - (freeHints.date === today ? freeHints.used : 0));

  /** 死局检测：无可消除一步时自动洗牌 */
  const ensurePlayable = useCallback((g: Tile[][]) => {
    if (findHint(g)) return;
    setReshuffled(true);
    window.setTimeout(() => setReshuffled(false), 1600);
    setGrid(buildGrid());
  }, []);

  /** 连锁消除：检测 → 闪烁动画 → 消除 → 循环 */
  const cascade = useCallback(
    (g: Tile[][], depth: number) => {
      const matches = findMatches(g);
      if (matches.size === 0) {
        setBusy(false);
        setCombo(0);
        ensurePlayable(g);
        return;
      }
      const earned = matches.size * REWARD_PER_TILE * Math.max(1, depth);
      addSpiritStones(earned);
      setScore((s) => s + earned);
      setFlashing(matches);
      setCombo(depth);

      // 触觉 + 彩带反馈（小消小,大消大）
      try { navigator.vibrate?.(depth >= 2 ? 60 : 25); } catch { /* 不支持则忽略 */ }
      confetti({
        particleCount: Math.min(80, matches.size * 6 + depth * 10),
        spread: 60,
        startVelocity: 28,
        origin: { y: 0.55 },
        scalar: 0.8,
      });

      window.setTimeout(() => {
        const next = collapse(g, matches);
        setFlashing(new Set());
        setGrid(next);
        window.setTimeout(() => cascade(next, depth + 1), 110);
      }, 420);
    },
    [addSpiritStones, ensurePlayable],
  );

  /** 尝试交换两个相邻图块 */
  const attemptSwap = useCallback(
    (ar: number, ac: number, br: number, bc: number) => {
      if (busy) return;
      if (br < 0 || br >= ROWS || bc < 0 || bc >= COLS) return;
      setBusy(true);
      setHintPair(null);

      const next = grid.map((row) => [...row]);
      [next[ar][ac], next[br][bc]] = [next[br][bc], next[ar][ac]];

      const matches = findMatches(next);
      if (matches.size === 0) {
        setGrid(next);
        try { navigator.vibrate?.(10); } catch { /* ignore */ }
        window.setTimeout(() => {
          setGrid(grid);
          setBusy(false);
        }, 180);
        return;
      }
      setGrid(next);
      window.setTimeout(() => cascade(next, 1), 80);
    },
    [busy, grid, cascade],
  );

  /** 提示：每日 3 次免费，之后消耗提示券（补给池可抽） */
  const showHint = useCallback(() => {
    if (busy || Date.now() < hintReadyAt) return;
    const hint = findHint(grid);
    if (!hint) {
      ensurePlayable(grid);
      return;
    }
    const source = consumeMinigameHint();
    if (source === 'none') {
      setHintNotice('今日免费提示用完了，提示券也没有了——去「便利屋补给池」抽几张💡吧！');
      window.setTimeout(() => setHintNotice(null), 2600);
      return;
    }
    if (source === 'token') {
      setHintNotice('消耗 1 张提示券 💡');
      window.setTimeout(() => setHintNotice(null), 1600);
    }
    const [r1, c1, r2, c2] = hint;
    setHintPair(new Set([`${r1},${c1}`, `${r2},${c2}`]));
    setHintReadyAt(Date.now() + HINT_COOLDOWN * 1000);
    window.setTimeout(() => setHintPair(null), 2500);
  }, [busy, grid, hintReadyAt, ensurePlayable, consumeMinigameHint]);

  /* ── 拖动事件处理 ── */

  const onPointerDown = (r: number, c: number, e: React.PointerEvent) => {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { r, c, x: e.clientX, y: e.clientY };
    setDragVisual({ r, c, dx: 0, dy: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setDragVisual({ r: drag.current.r, c: drag.current.c, dx, dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    const { r, c } = drag.current;
    drag.current = null;
    setDragVisual(null);

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        attemptSwap(r, c, r, c + (dx > 0 ? 1 : -1));
      } else {
        attemptSwap(r, c, r + (dy > 0 ? 1 : -1), c);
      }
    }
  };

  const newGame = () => {
    setGrid(buildGrid());
    setFlashing(new Set());
    setScore(0);
    setSeconds(0);
    setBusy(false);
    setCombo(0);
    setHintPair(null);
    drag.current = null;
    setDragVisual(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#101827]" style={{ userSelect: 'none' }}>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800" />

      <div className="relative z-10">
        {/* 顶栏 */}
        <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/78 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={onExit}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black tracking-wide text-white">便利屋消消乐</h1>
              <p className="text-xs font-medium text-amber-300">拖动交换相邻图块，三消以上获得灵石</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white">
              <Timer size={14} className="text-amber-300" />
              {mmss}
            </div>
          </div>
        </div>

        {/* 得分 + 提示 + 重开 */}
        <div className="mx-auto flex max-w-md items-center justify-between px-4 pt-3 pb-1 text-xs text-slate-300">
          <span>
            💎 本局 <b className="text-lg font-black text-amber-300">{score}</b> 灵石
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={showHint}
              disabled={busy || hintCooldownLeft > 0}
              className="flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-1.5 font-bold text-amber-300 hover:bg-amber-500/30 disabled:opacity-40"
            >
              <Lightbulb size={13} />
              {hintCooldownLeft > 0 ? `提示 ${hintCooldownLeft}s` : freeLeft > 0 ? `提示 ${freeLeft}/${FREE_HINTS_PER_DAY}` : `提示 💡×${hintTokens}`}
            </button>
            <button
              onClick={newGame}
              className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20"
            >
              <RotateCcw size={13} /> 重开
            </button>
          </div>
        </div>

        {/* 棋盘 */}
        <div
          className="mx-auto mt-2 w-fit touch-none"
          style={{ touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="relative" style={{ width: COLS * CELL, height: ROWS * CELL }}>
            {grid.map((row, r) =>
              row.map((tile, c) => {
                const key = `${r},${c}`;
                const isFlashing = flashing.has(key);
                const isHinted = hintPair?.has(key) ?? false;
                const isDragging = dragVisual?.r === r && dragVisual?.c === c;
                const dx = isDragging ? dragVisual!.dx : 0;
                const dy = isDragging ? dragVisual!.dy : 0;
                const style = TILE_STYLES[tile.kind] ?? TILE_STYLES.gem;

                const isDragTarget =
                  dragVisual !== null &&
                  !isDragging &&
                  (() => {
                    const { r: dr, c: dc, dx: ddx, dy: ddy } = dragVisual;
                    if (Math.abs(ddx) >= Math.abs(ddy)) {
                      return r === dr && c === dc + (ddx > 0 ? 1 : -1);
                    } else {
                      return c === dc && r === dr + (ddy > 0 ? 1 : -1);
                    }
                  })();

                return (
                  <div
                    key={tile.id}
                    onPointerDown={(e) => onPointerDown(r, c, e)}
                    style={{
                      position: 'absolute',
                      left: c * CELL + 2,
                      top: r * CELL + 2,
                      width: CELL - 4,
                      height: CELL - 4,
                      zIndex: isDragging ? 50 : 1,
                      transform: isDragging
                        ? `translate(${dx}px,${dy}px) scale(1.12)`
                        : 'translate(0,0) scale(1)',
                      transition: isDragging ? 'none' : 'transform 0.13s ease',
                      cursor: busy ? 'default' : 'grab',
                      touchAction: 'none',
                    }}
                  >
                    <motion.div
                      animate={
                        isFlashing
                          ? { scale: [1, 1.35, 0], opacity: [1, 1, 0] }
                          : isHinted
                            ? { scale: [1, 1.12, 1] }
                            : { scale: 1, opacity: 1 }
                      }
                      transition={
                        isFlashing
                          ? { duration: 0.38, times: [0, 0.45, 1], ease: 'easeOut' }
                          : isHinted
                            ? { duration: 0.6, repeat: Infinity }
                            : { duration: 0.08 }
                      }
                      className={cn(
                        'flex h-full w-full items-center justify-center rounded-xl border-2',
                        style.bg,
                        isFlashing
                          ? 'border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.9)]'
                          : isHinted
                            ? 'border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.8)]'
                            : isDragging
                              ? 'border-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.5)]'
                              : isDragTarget
                                ? 'border-white/60'
                                : style.border,
                      )}
                    >
                      <span className="pointer-events-none text-2xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]">
                        {style.emoji}
                      </span>
                    </motion.div>
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* 消除/连锁提示 */}
        <AnimatePresence>
          {flashing.size > 0 && (
            <motion.div
              key="flash-label"
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="pointer-events-none fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-amber-500/90 px-6 py-3 text-center shadow-xl backdrop-blur"
            >
              <p className="text-xl font-black text-amber-950">
                {combo >= 2 ? `🔗 连锁 ×${combo}！` : flashing.size >= 9 ? '🔥 超级消除！' : flashing.size >= 6 ? '✨ 大消除！' : '💥 消除！'}
              </p>
              <p className="text-sm font-bold text-amber-900">
                +{flashing.size * REWARD_PER_TILE * Math.max(1, combo)} 灵石{combo >= 2 ? `（连锁 ×${combo} 加成）` : ''}
              </p>
            </motion.div>
          )}
          {hintNotice && (
            <motion.div
              key="hint-notice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none fixed left-1/2 top-[30%] z-50 w-[85%] max-w-xs -translate-x-1/2 rounded-2xl bg-slate-800/95 border border-amber-400/40 px-4 py-3 text-center shadow-xl"
            >
              <p className="text-sm font-bold text-amber-200">{hintNotice}</p>
            </motion.div>
          )}
          {reshuffled && (
            <motion.div
              key="reshuffle-label"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-sky-500/90 px-6 py-3 text-center shadow-xl"
            >
              <p className="text-base font-black text-sky-950">🔀 没有可消除的组合，自动洗牌</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
