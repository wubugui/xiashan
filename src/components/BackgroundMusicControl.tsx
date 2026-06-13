import { useEffect, useState } from 'react';
import { Music2, Volume2, VolumeX } from 'lucide-react';
import {
  getBackgroundMusicState,
  subscribeBackgroundMusic,
  toggleBackgroundMusic,
} from '@/lib/backgroundMusic';
import { cn } from '@/lib/utils';

export default function BackgroundMusicControl() {
  const [state, setState] = useState(getBackgroundMusicState);

  useEffect(() => subscribeBackgroundMusic(() => setState(getBackgroundMusicState())), []);

  const active = state.enabled && !state.pausedBySystem;
  const label = state.enabled
    ? state.pausedBySystem ? '背景音乐自动暂停' : '背景音乐已开启'
    : '背景音乐已关闭';

  return (
    <div
      className="fixed z-50"
      style={{
        right: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
        bottom: 'calc(var(--nav-h, 0px) + var(--bar-h, 0px) + env(safe-area-inset-bottom, 0px) + 0.875rem)',
      }}
    >
      <button
        type="button"
        onClick={toggleBackgroundMusic}
        className={cn(
          'group relative flex h-11 w-11 items-center justify-center rounded-full',
          'border border-white/15 bg-slate-950/55 text-white shadow-lg shadow-black/25 backdrop-blur-xl',
          'transition-colors hover:bg-slate-900/75',
          state.enabled ? 'text-amber-200' : 'text-slate-400',
        )}
        aria-label={label}
      >
        {state.enabled ? (
          active ? <Volume2 size={18} /> : <Music2 size={18} />
        ) : (
          <VolumeX size={18} />
        )}
        <span
          className={cn(
            'pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-md',
            'border border-white/10 bg-slate-950/90 px-2 py-1 text-xs font-medium text-slate-100',
            'opacity-0 shadow-lg shadow-black/25 transition-opacity group-hover:opacity-100',
          )}
        >
          {label}
        </span>
      </button>
    </div>
  );
}
