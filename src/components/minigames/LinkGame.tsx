import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, RotateCcw, Timer } from 'lucide-react';
import { characters } from '@/data/characters';
import { usePlayerStore } from '@/store/usePlayerStore';
import { cn } from '@/lib/utils';

/**
 * 仙缘消消乐 — 拖动交换相邻图块，三消或以上播放消除动画并获得灵石。
 * 支持连锁消除（消除后重新检测，继续消）。
 */

const ROWS = 8;
const COLS = 6;
const CELL = 52; // px per tile
const REWARD_PER_TILE = 5; // 每消除一块 5 灵石
const DRAG_THRESHOLD = CELL * 0.28; // 拖动距离超过此值才触发交换

interface Tile { id: number; kind: string }
let UID = 1;
const mkTile = (kind: string): Tile => ({ id: UID++, kind });

/* ───── 工具函数 ───── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 初始化棋盘，避免生成时就存在三连 */
function buildGrid(kinds: string[]): Tile[][] {
  const g: Tile[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < COLS; c++) {
      let kind: string;
      let t = 0;
      do {
        kind = kinds[Math.floor(Math.random() * kinds.length)];
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
  // 横向
  for (let r = 0; r < ROWS; r++) {
    let s = 0;
    for (let c = 1; c <= COLS; c++) {
      if (c < COLS && g[r][c].kind === g[r][s].kind) continue;
      if (c - s >= 3) for (let k = s; k < c; k++) hit.add(`${r},${k}`);
      s = c;
    }
  }
  // 纵向
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
function collapse(g: Tile[][], toRemove: Set<string>, kinds: string[]): Tile[][] {
  const next: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null as unknown as Tile));
  for (let c = 0; c < COLS; c++) {
    // 收集本列未被消除的图块（从下往上）
    const col: Tile[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!toRemove.has(`${r},${c}`)) col.push(g[r][c]);
    }
    // 从底部填入，顶部补新
    for (let r = ROWS - 1; r >= 0; r--) {
      next[r][c] = col.shift() ?? mkTile(kinds[Math.floor(Math.random() * kinds.length)]);
    }
  }
  return next;
}

/* ───── 组件 ───── */

export default function LinkGame({ onExit }: { onExit: () => void }) {
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);

  // 图案池：优先已拥有角色，不足 5 种则补全
  const kinds = useMemo(() => {
    const owned = ownedCharacters
      .map((o) => characters.find((c) => c.id === o.characterId)?.avatarUrl)
      .filter((u): u is string => Boolean(u));
    const pool = owned.length >= 5 ? owned : characters.map((c) => c.avatarUrl);
    return shuffle(pool).slice(0, 6);
  }, [ownedCharacters]);

  const [grid, setGrid] = useState<Tile[][]>(() => buildGrid(kinds));
  const [flashing, setFlashing] = useState<Set<string>>(new Set()); // 正在播放消除动画的位置
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false); // 动画进行中，禁止操作

  // 拖动状态（ref 避免每帧触发重渲染）
  const drag = useRef<{ r: number; c: number; x: number; y: number } | null>(null);
  // 需要渲染的拖动偏移（用 state 触发重渲染以显示视觉反馈）
  const [dragVisual, setDragVisual] = useState<{ r: number; c: number; dx: number; dy: number } | null>(null);

  // 计时器
  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  /** 连锁消除：检测 → 闪烁动画 → 消除 → 循环 */
  const cascade = useCallback(
    (g: Tile[][]) => {
      const matches = findMatches(g);
      if (matches.size === 0) {
        setBusy(false);
        return;
      }
      const earned = matches.size * REWARD_PER_TILE;
      addSpiritStones(earned);
      setScore((s) => s + earned);
      setFlashing(matches);

      // 闪烁 420ms 后消除，然后继续检测
      window.setTimeout(() => {
        const next = collapse(g, matches, kinds);
        setFlashing(new Set());
        setGrid(next);
        window.setTimeout(() => cascade(next), 80);
      }, 420);
    },
    [kinds, addSpiritStones],
  );

  /** 尝试交换两个相邻图块 */
  const attemptSwap = useCallback(
    (ar: number, ac: number, br: number, bc: number) => {
      if (busy) return;
      if (br < 0 || br >= ROWS || bc < 0 || bc >= COLS) return;
      setBusy(true);

      const next = grid.map((row) => [...row]);
      [next[ar][ac], next[br][bc]] = [next[br][bc], next[ar][ac]];

      const matches = findMatches(next);
      if (matches.size === 0) {
        // 无消除 → 先显示交换，再弹回
        setGrid(next);
        window.setTimeout(() => {
          setGrid(grid);
          setBusy(false);
        }, 180);
        return;
      }
      setGrid(next);
      window.setTimeout(() => cascade(next), 80);
    },
    [busy, grid, cascade],
  );

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
    setGrid(buildGrid(kinds));
    setFlashing(new Set());
    setScore(0);
    setSeconds(0);
    setBusy(false);
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
              <h1 className="text-lg font-black tracking-wide text-white">仙缘消消乐</h1>
              <p className="text-xs font-medium text-amber-300">拖动交换相邻图块，三消以上获得灵石</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-white">
              <Timer size={14} className="text-amber-300" />
              {mmss}
            </div>
          </div>
        </div>

        {/* 得分 + 重开 */}
        <div className="mx-auto flex max-w-md items-center justify-between px-4 pt-3 pb-1 text-xs text-slate-300">
          <span>
            💎 本局 <b className="text-lg font-black text-amber-300">{score}</b> 灵石
          </span>
          <button
            onClick={newGame}
            className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20"
          >
            <RotateCcw size={13} /> 重开
          </button>
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
                const isDragging = dragVisual?.r === r && dragVisual?.c === c;
                const dx = isDragging ? dragVisual!.dx : 0;
                const dy = isDragging ? dragVisual!.dy : 0;

                // 拖动方向的邻居高亮
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
                  // 外层：绝对定位 + 拖动偏移（纯 CSS，不经过 framer-motion）
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
                    {/* 内层：只负责消除动画，不接触拖动 */}
                    <motion.div
                      animate={
                        isFlashing
                          ? { scale: [1, 1.35, 0], opacity: [1, 1, 0] }
                          : { scale: 1, opacity: 1 }
                      }
                      transition={
                        isFlashing
                          ? { duration: 0.38, times: [0, 0.45, 1], ease: 'easeOut' }
                          : { duration: 0.08 }
                      }
                      className={cn(
                        'flex h-full w-full items-center justify-center rounded-xl border p-1',
                        isFlashing
                          ? 'border-amber-300 bg-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.7)]'
                          : isDragging
                            ? 'border-amber-400 bg-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.5)]'
                            : isDragTarget
                              ? 'border-amber-400/60 bg-slate-700/60'
                              : 'border-slate-600/40 bg-slate-800/80',
                      )}
                    >
                      <img
                        src={tile.kind}
                        alt=""
                        className="pointer-events-none h-full w-full rounded-lg object-cover"
                        draggable={false}
                      />
                    </motion.div>
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* 连消提示 */}
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
                {flashing.size >= 9 ? '🔥 超级消除！' : flashing.size >= 6 ? '✨ 大消除！' : '💥 消除！'}
              </p>
              <p className="text-sm font-bold text-amber-900">+{flashing.size * REWARD_PER_TILE} 灵石</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
