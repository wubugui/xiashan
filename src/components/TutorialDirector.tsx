/**
 * 新手引导导演 — 强制锁定式引导的渲染层。
 *
 * 两种形态：
 * - modal：全屏江夏对白（z-[200]），玩家只能点按钮推进；
 * - spot：聚光灯（z-[160]~[162]）——四块遮罩把目标元素之外的整个屏幕全部挡住，
 *   只留一个可点击的「洞」，配江夏气泡解说。目标通过 data-tut 属性定位，
 *   随滚动/布局变化实时跟踪（rAF 轮询 getBoundingClientRect）。
 *
 * 台词每句带稳定 id（tutorialScript.json），后续语音按 id 挂载即可。
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/lib/assets';
import { playSound } from '@/lib/sound';
import { TUTORIAL_NUDGES } from '@/lib/tutorialFlow';
import type { TutorialCtx, TutorialLine, TutorialStep } from '@/lib/tutorialFlow';

const PAD = 6;

function linxiaFace(expression: string) {
  return `/characters/face/linxia/${expression}.png`;
}

/* ────── 聚光灯（可独立复用：Home 入口、开始营业按钮也用它） ────── */
export function TutorialSpotlight({
  targetKey, lines, expression, button, onButton,
}: {
  targetKey: string | null;
  lines: TutorialLine[];
  expression: string;
  button?: string;
  onButton?: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const scrolledKey = useRef<string | null>(null);
  /** 乱点提醒：玩家点到目标之外时，江夏出声（轮换提醒语 + 气泡抖动） */
  const [nudge, setNudge] = useState<{ line: TutorialLine; key: number } | null>(null);
  const nudgeCount = useRef(0);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleStray = () => {
    const line = TUTORIAL_NUDGES[nudgeCount.current % TUTORIAL_NUDGES.length];
    nudgeCount.current += 1;
    playSound('card-miss');
    setNudge({ line, key: nudgeCount.current });
    clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudge(null), 2600);
  };

  useEffect(() => () => clearTimeout(nudgeTimer.current), []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = targetKey ? document.querySelector(`[data-tut="${targetKey}"]`) : null;
      if (el) {
        if (scrolledKey.current !== targetKey) {
          scrolledKey.current = targetKey;
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        const r = el.getBoundingClientRect();
        setRect(prev =>
          prev &&
          Math.abs(prev.top - r.top) < 1 && Math.abs(prev.left - r.left) < 1 &&
          Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
            ? prev : r,
        );
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetKey]);

  const hole = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        right: rect.right + PAD,
        bottom: rect.bottom + PAD,
      }
    : null;

  /** 目标在屏幕下半区 → 气泡贴顶；否则贴底 */
  const bubbleOnTop = !hole || (hole.top + hole.bottom) / 2 > window.innerHeight / 2;

  return (
    <>
      {/* 拦截层：近乎透明——环境保持可见，目标之外的点击被拦截并触发江夏提醒 */}
      {hole ? (
        <>
          <div onClick={handleStray} className="fixed left-0 right-0 top-0 z-[160] bg-black/15" style={{ height: hole.top }} />
          <div onClick={handleStray} className="fixed left-0 right-0 bottom-0 z-[160] bg-black/15" style={{ top: hole.bottom }} />
          <div onClick={handleStray} className="fixed left-0 z-[160] bg-black/15" style={{ top: hole.top, height: hole.bottom - hole.top, width: hole.left }} />
          <div onClick={handleStray} className="fixed right-0 z-[160] bg-black/15" style={{ top: hole.top, height: hole.bottom - hole.top, left: hole.right }} />
          {/* 目标光圈：环境不压暗，靠它把下一步圈出来 */}
          <div
            className="fixed z-[161] rounded-xl border-[3px] border-amber-400 animate-pulse pointer-events-none"
            style={{
              top: hole.top, left: hole.left, width: hole.right - hole.left, height: hole.bottom - hole.top,
              boxShadow: '0 0 0 4px rgba(251,191,36,0.25), 0 0 28px rgba(251,191,36,0.85), inset 0 0 18px rgba(251,191,36,0.25)',
            }}
          />
        </>
      ) : (
        <div onClick={handleStray} className="fixed inset-0 z-[160] bg-black/15" />
      )}

      {/* 江夏解说气泡（乱点时抖动并插一句提醒） */}
      <motion.div
        key={`${targetKey}-${bubbleOnTop}`}
        initial={{ opacity: 0, y: bubbleOnTop ? -8 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed left-3 right-3 z-[162]"
        style={bubbleOnTop ? { top: 'max(0.75rem, env(safe-area-inset-top))' } : { bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <motion.div
          key={nudge?.key ?? 'calm'}
          animate={nudge ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className={`mx-auto max-w-md rounded-2xl border bg-slate-900/95 backdrop-blur-xl p-3 shadow-2xl ${nudge ? 'border-amber-400' : 'border-amber-400/40'}`}
        >
          <div className="flex gap-2.5">
            {/* 无框大半身像：独占左列、只向气泡外侧溢出——永远不侵入右列的文字和按钮 */}
            <img
              src={assetUrl(linxiaFace(nudge ? 'angry' : expression))}
              alt="江夏"
              className={cn(
                'pointer-events-none h-32 w-20 shrink-0 select-none object-cover object-top drop-shadow-[0_8px_18px_rgba(0,0,0,0.65)]',
                bubbleOnTop ? 'self-end -mb-9 -ml-1' : 'self-start -mt-12 -ml-1',
              )}
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-wide text-amber-300 mb-0.5">江夏</p>
              {nudge ? (
                <p key={nudge.line.id} className="text-xs font-bold leading-relaxed text-amber-200">{nudge.line.text}</p>
              ) : (
                lines.map(line => (
                  <p key={line.id} className="text-xs leading-relaxed text-slate-100 mb-1 last:mb-0">{line.text}</p>
                ))
              )}
              {button && onButton && (
                <button
                  onClick={() => { playSound('tutorial-next'); onButton(); }}
                  className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 text-sm font-black text-amber-950 shadow-[0_0_16px_rgba(251,191,36,0.3)] active:scale-[0.99] transition-all"
                >
                  {button}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

/* ────── 全屏对白（modal 步骤） ────── */
function TutorialModal({ step, onButton }: { step: TutorialStep; onButton: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-end bg-black/80 backdrop-blur-sm"
    >
      <img
        src={assetUrl(linxiaFace(step.expression))}
        alt="江夏"
        className="relative z-10 h-64 w-auto object-contain drop-shadow-2xl pointer-events-none select-none"
      />
      <div className="relative z-10 w-full bg-slate-900/98 border-t border-white/10 px-5 pt-4 pb-8">
        <p className="text-[11px] font-bold text-amber-300 mb-2 tracking-wide">江夏</p>
        {step.lines.map(line => (
          <p key={line.id} className="text-sm leading-relaxed text-slate-100 mb-1.5">{line.text}</p>
        ))}
        <button
          onClick={() => { playSound('tutorial-next'); onButton(); }}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-sm font-black text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
        >
          {step.button ?? '继续'}
        </button>
      </div>
    </motion.div>
  );
}

/* ────── 导演：按步骤形态分发 ────── */
export default function TutorialDirector({
  step, ctx, onButton,
}: {
  step: TutorialStep;
  ctx: TutorialCtx;
  onButton: () => void;
}) {
  if (step.kind === 'modal') {
    return <TutorialModal step={step} onButton={onButton} />;
  }
  return (
    <TutorialSpotlight
      targetKey={step.target ? step.target(ctx) : null}
      lines={step.lines}
      expression={step.expression}
      button={step.button}
      onButton={step.button ? onButton : undefined}
    />
  );
}
