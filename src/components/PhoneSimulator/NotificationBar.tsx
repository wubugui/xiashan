import { motion } from 'framer-motion';
import { FaWeixin } from 'react-icons/fa';
import { Phone, MessageSquare } from 'lucide-react';
import { getCharacterById } from '@/data/characters';
import { useEffect } from 'react';

interface NotificationBarProps {
  type: 'wechat' | 'call' | 'sms';
  characterId: string;
  message: string;
  onDismiss: () => void;
  onClick: () => void;
}

const avatarColors: Record<string, string> = {
  suli: '#4FC3F7',
  chujinghong: '#AB47BC',
  sujinli: '#7E57C2',
  aruo: '#66BB6A',
  huapi: '#EC407A',
  sangluo: '#5C6BC0',
  aman: '#FF7043',
  shenzhaoning: '#FFA726',
  peiyanzhi: '#26A69A',
  zhoulei: '#EF5350',
  murongxue: '#42A5F5',
  yunzhiyi: '#8D6E63',
  linxia: '#FFCA28',
  jinmantang: '#FFD54F',
  wanjia: '#78909C',
  youhun: '#B0BEC5',
  lurenjia: '#90A4AE',
  xiaogui: '#CE93D8',
};

export default function NotificationBar({
  type,
  characterId,
  message,
  onDismiss,
  onClick,
}: NotificationBarProps) {
  const character = getCharacterById(characterId);
  const color = avatarColors[characterId] || '#999';

  // 3秒后自动消失
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getIcon = () => {
    switch (type) {
      case 'wechat':
        return <FaWeixin size={14} className="text-white" />;
      case 'call':
        return <Phone size={14} className="text-white" />;
      case 'sms':
        return <MessageSquare size={14} className="text-white" />;
    }
  };

  const getAppName = () => {
    switch (type) {
      case 'wechat':
        return '微信';
      case 'call':
        return '电话';
      case 'sms':
        return '短信';
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'wechat':
        return '#07C160';
      case 'call':
        return '#4CAF50';
      case 'sms':
        return '#2196F3';
    }
  };

  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      onClick={onClick}
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)', width: 'min(360px, 92vw)' }}
      className="fixed left-1/2 z-[9999] -translate-x-1/2 cursor-pointer"
    >
      <div
        className="rounded-2xl p-3 shadow-2xl"
        style={{
          background: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div className="flex items-start gap-3">
          {/* 应用图标 */}
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: getIconBg() }}
          >
            {getIcon()}
          </div>

          {/* 内容 */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/80">{getAppName()}</span>
              <span className="text-xs text-white/30">·</span>
              <span className="text-xs text-white/30">现在</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-sm font-medium text-white">
                {character?.name || '未知'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-white/50">{message}</p>
          </div>

          {/* 头像 */}
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {character?.name.charAt(0) || '?'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
