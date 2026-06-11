import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Store, Sparkles, Users, Smartphone, Film, Gamepad2, X } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { characters } from '@/data/characters';
import { REWARDS } from '@/data/rewards';
import { cn } from '@/lib/utils';
import { safeStorage } from '@/lib/safeStorage';

export default function Home() {
  const navigate = useNavigate();
  const spiritStones = usePlayerStore((s) => s.spiritStones);
  const commissionTickets = usePlayerStore((s) => s.commissionTickets);
  const ownedCharacters = usePlayerStore((s) => s.ownedCharacters);
  const addSpiritStones = usePlayerStore((s) => s.addSpiritStones);

  const [showDailyReward, setShowDailyReward] = useState(false);

  const ownedCount = ownedCharacters.length;
  const totalCharacters = characters.length;

  // 每日登录检测
  useEffect(() => {
    const lastClaimDate = safeStorage.getItem('xiashan_daily_claim');
    const today = new Date().toDateString();
    if (lastClaimDate !== today) {
      setShowDailyReward(true);
    }
  }, []);

  const claimDailyReward = () => {
    addSpiritStones(REWARDS.daily_login);
    safeStorage.setItem('xiashan_daily_claim', new Date().toDateString());
    setShowDailyReward(false);
  };

  const quickActions = [
    {
      id: 'shop',
      label: '开始营业',
      icon: Store,
      color: 'from-amber-500 to-amber-700',
      glow: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
      onClick: () => navigate('/shop'),
    },
    {
      id: 'gacha',
      label: '抽卡',
      icon: Sparkles,
      color: 'from-purple-500 to-purple-700',
      glow: 'shadow-[0_0_20px_rgba(147,51,234,0.3)]',
      onClick: () => navigate('/gacha'),
    },
    {
      id: 'collection',
      label: '角色图鉴',
      icon: Users,
      color: 'from-blue-500 to-blue-700',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
      onClick: () => navigate('/collection'),
    },
    {
      id: 'phone',
      label: '手机',
      icon: Smartphone,
      color: 'from-green-500 to-green-700',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',
      onClick: () => navigate('/phone'),
    },
    {
      id: 'videos',
      label: '影像回放',
      icon: Film,
      color: 'from-rose-500 to-rose-700',
      glow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)]',
      onClick: () => navigate('/videos'),
    },
    {
      id: 'minigame',
      label: '小游戏',
      icon: Gamepad2,
      color: 'from-emerald-500 to-teal-700',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
      onClick: () => navigate('/minigame'),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950"
    >
      {/* 城市剪影背景 */}
      <div className="absolute inset-0">
        {/* 天空渐变 */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800" />

        {/* 星星 */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
            className="absolute h-1 w-1 rounded-full bg-white/60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 40}%`,
            }}
          />
        ))}

        {/* 月亮 */}
        <div className="absolute right-[15%] top-[12%] h-16 w-16 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 shadow-[0_0_60px_rgba(251,191,36,0.3)]" />

        {/* 城市剪影 */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 320" className="w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>
            <path
              fill="url(#cityGrad)"
              d="M0,320 L0,200 L60,200 L60,160 L80,160 L80,140 L100,140 L100,200 L140,200 L140,120 L160,120 L160,100 L180,100 L180,120 L200,120 L200,200 L260,200 L260,170 L280,170 L280,150 L300,150 L300,170 L320,170 L320,200 L380,200 L380,80 L400,80 L400,60 L420,60 L420,80 L440,80 L440,200 L500,200 L500,180 L520,180 L520,160 L540,160 L540,180 L560,180 L560,200 L620,200 L620,130 L640,130 L640,110 L660,110 L660,130 L680,130 L680,200 L740,200 L740,90 L760,90 L760,70 L780,70 L780,90 L800,90 L800,200 L860,200 L860,160 L880,160 L880,140 L900,140 L900,160 L920,160 L920,200 L980,200 L980,110 L1000,110 L1000,80 L1020,80 L1020,110 L1040,110 L1040,200 L1100,200 L1100,170 L1120,170 L1120,150 L1140,150 L1140,170 L1160,170 L1160,200 L1220,200 L1220,130 L1240,130 L1240,100 L1260,100 L1260,130 L1280,130 L1280,200 L1340,200 L1340,180 L1360,180 L1360,160 L1380,160 L1380,180 L1400,180 L1400,200 L1440,200 L1440,320 Z"
            />
          </svg>
          {/* 城市灯光 */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10" />
        </div>
      </div>

      {/* 主内容 */}
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 pb-8">
        {/* 游戏标题 */}
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8, type: 'spring', damping: 20 }}
          className="mb-8 text-center"
        >
          <h1
            className={cn(
              'text-5xl font-black tracking-[0.2em] sm:text-6xl',
              'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400',
              'bg-clip-text text-transparent',
              'drop-shadow-[0_0_30px_rgba(251,191,36,0.4)]',
            )}
          >
            二十五时便利屋
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-2 text-sm tracking-widest text-slate-400"
          >
            开在第二十五小时的都市便利屋
          </motion.p>
        </motion.div>

        {/* 当前进度 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className={cn(
            'mb-8 w-full rounded-xl',
            'bg-slate-900/60 backdrop-blur-md',
            'border border-slate-700/30',
            'px-5 py-4',
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">委托券</p>
              <p className="mt-0.5 text-sm font-medium text-amber-400">
                🎫 {commissionTickets} 张可用
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">灵石</p>
              <p className="mt-0.5 text-sm font-bold text-amber-300">
                💎 {spiritStones.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">角色</p>
              <p className="mt-0.5 text-sm font-bold text-blue-300">
                {ownedCount}/{totalCharacters}
              </p>
            </div>
          </div>
        </motion.div>

        {/* 快捷操作按钮 */}
        <div className="grid w-full grid-cols-2 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.id}
                initial={{ y: 30, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.7 + index * 0.1,
                  type: 'spring',
                  damping: 20,
                  stiffness: 200,
                }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={action.onClick}
                className={cn(
                  'group relative overflow-hidden rounded-xl',
                  'bg-slate-900/60 backdrop-blur-md',
                  'border border-slate-700/30',
                  'px-5 py-6',
                  'transition-shadow duration-300',
                  `hover:${action.glow}`,
                )}
              >
                {/* 背景光效 */}
                <div
                  className={cn(
                    'absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                    'bg-gradient-to-br',
                    action.color,
                  )}
                  style={{ opacity: 0.08 }}
                />

                {/* 图标 */}
                <div
                  className={cn(
                    'mb-3 flex h-10 w-10 items-center justify-center rounded-lg',
                    'bg-gradient-to-br',
                    action.color,
                    'shadow-lg',
                  )}
                >
                  <Icon size={20} className="text-white" />
                </div>

                {/* 文字 */}
                <span className="text-base font-bold text-white">{action.label}</span>

                {/* 悬停光晕 */}
                <div
                  className={cn(
                    'absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-30',
                    'bg-gradient-to-br blur-2xl',
                    action.color,
                  )}
                />
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 每日登录奖励弹窗 */}
      <AnimatePresence>
        {showDailyReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDailyReward(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl',
                'bg-slate-900/95 backdrop-blur-xl',
                'border border-amber-500/30',
                'p-6',
                'shadow-[0_0_60px_rgba(251,191,36,0.2)]',
              )}
            >
              {/* 关闭按钮 */}
              <button
                onClick={() => setShowDailyReward(false)}
                className="absolute right-3 top-3 text-slate-500 hover:text-white"
              >
                <X size={18} />
              </button>

              {/* 标题 */}
              <div className="mb-5 text-center">
                <motion.div
                  animate={{
                    textShadow: [
                      '0 0 10px rgba(251,191,36,0.3)',
                      '0 0 30px rgba(251,191,36,0.6)',
                      '0 0 10px rgba(251,191,36,0.3)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-2xl font-black text-amber-400"
                >
                  每日登录奖励
                </motion.div>
                <p className="mt-1 text-xs text-slate-500">每日签到领取灵石</p>
              </div>

              {/* 奖励内容 */}
              <div className="mb-6 flex items-center justify-center gap-3">
                <div
                  className={cn(
                    'flex h-20 w-20 items-center justify-center rounded-2xl',
                    'bg-gradient-to-br from-amber-500/20 to-amber-700/20',
                    'border border-amber-500/30',
                  )}
                >
                  <span className="text-3xl">💎</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-300">灵石 × {REWARDS.daily_login}</p>
                  <p className="text-xs text-slate-500">可用于抽卡和角色升级</p>
                </div>
              </div>

              {/* 领取按钮 */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={claimDailyReward}
                className={cn(
                  'w-full rounded-xl py-3',
                  'bg-gradient-to-r from-amber-500 to-amber-600',
                  'text-base font-bold text-amber-950',
                  'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
                  'hover:from-amber-400 hover:to-amber-500',
                  'transition-all duration-200',
                )}
              >
                领取奖励
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
