import { Component, type ReactNode } from 'react';
import { clearLocalSaveAndReload } from '@/lib/saveReset';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 全局错误兜底：任何页面崩溃时给出可操作的恢复界面，
 * 而不是留给玩家一块空白屏（常见诱因：跨版本的旧 localStorage 存档）。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  handleReload = () => {
    window.location.hash = '#/';
    window.location.reload();
  };

  handleReset = () => {
    clearLocalSaveAndReload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-8 text-center">
        <p className="text-3xl">🌙</p>
        <h1 className="text-lg font-bold text-white">二十五时打了个盹</h1>
        <p className="text-xs leading-relaxed text-slate-400">
          页面出了点问题。通常是旧版本的本地存档不兼容导致的，
          重置存档即可恢复（会清空本地进度）。
        </p>
        <p className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-slate-600">
          {this.state.error.message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={this.handleReload}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white"
          >
            刷新重试
          </button>
          <button
            onClick={this.handleReset}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white"
          >
            重置存档
          </button>
        </div>
      </div>
    );
  }
}
