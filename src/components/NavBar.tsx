import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useCssVarFromHeight } from '@/hooks/useCssVarFromHeight';
import { Store, Sparkles, Users, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadCount: number;
}

const tabs = [
  { id: 'shop', label: '营业', icon: Store },
  { id: 'gacha', label: '抽奖', icon: Sparkles },
  { id: 'collection', label: '图鉴', icon: Users },
  { id: 'phone', label: '手机', icon: Smartphone },
] as const;

export default function NavBar({ activeTab, onTabChange, unreadCount }: NavBarProps) {
  const navRef = useRef<HTMLElement>(null);
  useCssVarFromHeight('--nav-h', navRef);

  return (
    <nav
      ref={navRef}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-slate-900/90 backdrop-blur-xl',
        'border-t border-slate-700/50',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-1',
                'transition-colors duration-200',
                isActive ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {/* 激活光晕 */}
              {isActive && (
                <motion.div
                  layoutId="navGlow"
                  className="absolute -top-1 h-12 w-12 rounded-full bg-amber-400/10 blur-md"
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                />
              )}

              {/* 图标 */}
              <div className="relative">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-all duration-200',
                    isActive && 'drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]',
                  )}
                />

                {/* 手机未读角标 */}
                {tab.id === 'phone' && unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      'absolute -right-2 -top-1.5 flex items-center justify-center',
                      'min-w-[16px] rounded-full px-1',
                      'bg-red-500 text-[10px] font-bold text-white',
                    )}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.span>
                )}
              </div>

              {/* 标签文字 */}
              <span className="text-[10px] font-medium">{tab.label}</span>

              {/* 激活指示条 */}
              {isActive && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute -top-px left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-amber-400"
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
