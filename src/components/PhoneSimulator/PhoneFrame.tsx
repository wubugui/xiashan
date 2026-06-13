import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PhoneFrameProps {
  children: React.ReactNode;
  onClose: () => void;
}

/**
 * 手机外壳——只表达「这是个手机」的最小意象，不模拟拟真外观。
 * 高度自适应视口（min(86dvh, 760px)）保证永远一屏装下，框本身不溢出滚动；
 * 删掉刘海/信号/wifi/电量等纯装饰，省下的高度全部留给功能。
 */
export default function PhoneFrame({ children, onClose }: PhoneFrameProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      className="relative mx-auto flex flex-col overflow-hidden"
      style={{
        width: 'min(92vw, 390px)',
        height: 'min(86dvh, 760px)',
        borderRadius: '32px',
        background: '#000',
        border: '3px solid #2a2a2e',
        boxShadow: '0 22px 70px rgba(0,0,0,0.7)',
      }}
    >
      {/* 极简状态栏：只留时间 + 关闭 */}
      <div className="relative z-20 flex items-center justify-between px-5 py-2">
        <span className="text-xs font-semibold text-white/90">{time}</span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="关闭手机"
        >
          <X size={13} />
        </button>
      </div>

      {/* 内容区：内部组件自己滚动，外壳不溢出 */}
      <div className="min-h-0 flex-1 overflow-hidden bg-black">
        {children}
      </div>
    </motion.div>
  );
}
