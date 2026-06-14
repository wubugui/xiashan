import { motion } from 'framer-motion';
import { Camera, Volume2 } from 'lucide-react';
import { assetUrl } from '@/lib/assets';

interface MessageBubbleProps {
  content: string;
  type: 'text' | 'image' | 'voice' | 'red_packet';
  sender: 'character' | 'player';
  /** 角色头像（character 侧用真头像，缺省退回首字色块） */
  avatarUrl?: string;
  /** 玩家自己的头像（设为我的头像后）：player 侧用真头像，缺省退回「我」色块 */
  playerAvatarUrl?: string | null;
  /** 头像首字回退（角色名首字，不是消息内容首字） */
  fallbackInitial?: string;
  voiceText?: string;
  isNew?: boolean;
}

export default function MessageBubble({
  content,
  type,
  sender,
  avatarUrl,
  playerAvatarUrl,
  fallbackInitial = '',
  voiceText,
  isNew = false,
}: MessageBubbleProps) {
  const isPlayer = sender === 'player';

  // 语音波形条
  const renderVoiceBars = () => {
    const barCount = Math.min(Math.max(Math.floor(parseInt(content) / 2), 3), 12);
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: '3px',
              height: `${Math.random() * 12 + 4}px`,
              backgroundColor: isPlayer ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
            }}
          />
        ))}
      </div>
    );
  };

  const renderContent = () => {
    switch (type) {
      case 'text':
        return <span className="text-sm leading-relaxed">{content}</span>;
      case 'image':
        return (
          <div className="flex h-36 w-48 items-center justify-center rounded-lg bg-gray-700/50">
            <Camera size={32} className="text-white/40" />
          </div>
        );
      case 'voice':
        return (
          <div className="flex items-center gap-2" style={{ minWidth: '80px' }}>
            <Volume2 size={16} className={isPlayer ? 'text-white/70' : 'text-black/50'} />
            {renderVoiceBars()}
            <span className={`text-xs ${isPlayer ? 'text-white/60' : 'text-black/40'}`}>
              {voiceText || `${content}"`}
            </span>
          </div>
        );
      case 'red_packet':
        return (
          <div
            className="flex min-w-[200px] flex-col rounded-lg overflow-hidden"
            style={{ background: '#FA9D3B' }}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-2xl">🧧</span>
              <span className="text-sm font-medium text-white">恭喜发财</span>
            </div>
            <div className="bg-white/20 px-3 py-1.5">
              <span className="text-xs text-white/80">{content || '微信红包'}</span>
            </div>
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 10, scale: 0.95 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`flex ${isPlayer ? 'justify-end' : 'justify-start'} mb-3 px-3`}
    >
      {!isPlayer && (
        avatarUrl ? (
          <img
            src={assetUrl(avatarUrl)}
            alt=""
            className="mr-2 mt-1 h-9 w-9 flex-shrink-0 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="mr-2 mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: '#07C160' }}
          >
            {fallbackInitial}
          </div>
        )
      )}

      <div className="relative max-w-[75%]">
        <div
          className={`rounded-lg px-3 py-2 ${
            type === 'red_packet'
              ? ''
              : isPlayer
                ? 'text-white'
                : 'text-black/90'
          }`}
          style={
            type === 'red_packet'
              ? {}
              : {
                  backgroundColor: isPlayer ? '#07C160' : '#F5F5F5',
                }
          }
        >
          {renderContent()}
        </div>
        {/* 气泡尾巴 */}
        {type !== 'red_packet' && (
          <div
            className={`absolute top-2 h-0 w-0 ${
              isPlayer ? 'right-0 translate-x-1' : 'left-0 -translate-x-1'
            }`}
            style={{
              borderLeft: isPlayer ? '6px solid #07C160' : '6px solid transparent',
              borderRight: isPlayer ? '6px solid transparent' : '6px solid #F5F5F5',
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
            }}
          />
        )}
      </div>

      {isPlayer && (
        playerAvatarUrl ? (
          <img
            src={assetUrl(playerAvatarUrl)}
            alt=""
            className="ml-2 mt-1 h-9 w-9 flex-shrink-0 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="ml-2 mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500 text-xs font-bold text-white"
          >
            我
          </div>
        )
      )}
    </motion.div>
  );
}
