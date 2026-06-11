import { FaWeixin } from 'react-icons/fa';
import { Phone, MessageSquare, Globe } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { motion } from 'framer-motion';

interface PhoneHomeScreenProps {
  onOpenWeChat: () => void;
  onOpenPhone: () => void;
  onOpenSMS: () => void;
  onOpenBrowser: () => void;
}

const apps = [
  {
    id: 'wechat',
    label: '微信',
    icon: FaWeixin,
    gradient: 'from-green-500 to-green-600',
    countKey: 'wechat' as const,
  },
  {
    id: 'phone',
    label: '电话',
    icon: Phone,
    gradient: 'from-green-400 to-green-600',
    countKey: 'call' as const,
  },
  {
    id: 'sms',
    label: '短信',
    icon: MessageSquare,
    gradient: 'from-blue-400 to-blue-600',
    countKey: 'sms' as const,
  },
  {
    id: 'browser',
    label: '浏览器',
    icon: Globe,
    gradient: 'from-blue-500 to-indigo-500',
    countKey: null,
  },
];

export default function PhoneHomeScreen({
  onOpenWeChat,
  onOpenPhone,
  onOpenSMS,
  onOpenBrowser,
}: PhoneHomeScreenProps) {
  const unreadCounts = usePlayerStore((s) => s.unreadCounts);

  const handleAppClick = (appId: string) => {
    switch (appId) {
      case 'wechat':
        onOpenWeChat();
        break;
      case 'phone':
        onOpenPhone();
        break;
      case 'sms':
        onOpenSMS();
        break;
      case 'browser':
        onOpenBrowser();
        break;
    }
  };

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 40%, #16213e 100%)',
      }}
    >
      {/* 顶部空间 */}
      <div className="flex-shrink-0" style={{ height: '80px' }} />

      {/* App 图标网格 */}
      <div className="flex-1 px-6 pt-4">
        <div className="grid grid-cols-4 gap-y-6">
          {apps.map((app, index) => {
            const Icon = app.icon;
            const badge = app.countKey ? unreadCounts[app.countKey] : 0;

            return (
              <motion.button
                key={app.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.05, type: 'spring', stiffness: 400, damping: 20 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleAppClick(app.id)}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="relative">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-[15px] bg-gradient-to-br ${app.gradient} shadow-lg`}
                  >
                    <Icon size={28} className="text-white" />
                  </div>
                  {badge > 0 && (
                    <div className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1">
                      <span className="text-xs font-bold text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-white/80">{app.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 底部 Dock */}
      <div className="flex-shrink-0 px-4 pb-2">
        <div
          className="flex items-center justify-around rounded-2xl px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
        >
          {apps.slice(0, 4).map((app) => {
            const Icon = app.icon;
            const badge = app.countKey ? unreadCounts[app.countKey] : 0;
            return (
              <button
                key={`dock-${app.id}`}
                onClick={() => handleAppClick(app.id)}
                className="relative"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-[13px] bg-gradient-to-br ${app.gradient}`}
                >
                  <Icon size={24} className="text-white" />
                </div>
                {badge > 0 && (
                  <div className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5">
                    <span className="text-[10px] font-bold text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
