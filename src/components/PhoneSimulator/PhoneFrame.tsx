import { motion } from 'framer-motion';
import { Wifi, Battery, Signal, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PhoneFrameProps {
  children: React.ReactNode;
  onClose: () => void;
}

export default function PhoneFrame({ children, onClose }: PhoneFrameProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="relative mx-auto flex flex-col"
      style={{
        width: '375px',
        height: '812px',
        borderRadius: '44px',
        background: '#000',
        border: '3px solid #333',
        boxShadow: '0 0 0 2px #1a1a1a, 0 25px 80px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
      >
        <X size={14} />
      </button>

      {/* 刘海 */}
      <div className="relative z-20 flex items-center justify-center pt-0">
        <div
          className="absolute top-0 left-1/2 z-10 -translate-x-1/2"
          style={{
            width: '150px',
            height: '30px',
            background: '#000',
            borderRadius: '0 0 18px 18px',
          }}
        />
      </div>

      {/* 状态栏 */}
      <div className="relative z-10 flex items-center justify-between px-8 pt-3 pb-1" style={{ height: '44px' }}>
        <span className="text-xs font-semibold text-white">{timeStr}</span>
        <div className="flex items-center gap-1.5">
          <Signal size={12} className="text-white" />
          <Wifi size={12} className="text-white" />
          <div className="flex items-center gap-0.5">
            <Battery size={14} className="text-white" />
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden bg-black">
        {children}
      </div>

      {/* 底部 Home Indicator */}
      <div className="flex items-center justify-center pb-2 pt-1" style={{ height: '34px' }}>
        <div
          className="rounded-full bg-white/30"
          style={{ width: '134px', height: '5px' }}
        />
      </div>
    </motion.div>
  );
}
