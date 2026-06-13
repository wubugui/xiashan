import { ChevronLeft } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface SMSDetailProps {
  characterId: string;
  onBack: () => void;
}

const avatarColors: Record<string, string> = {
  suli: '#4FC3F7',
  aruo: '#66BB6A',
  sangluo: '#5C6BC0',
  aman: '#FF7043',
  shenzhaoning: '#FFA726',
  murongxue: '#42A5F5',
  yunzhiyi: '#8D6E63',
  linxia: '#FFCA28',
};

const smsReplies: Record<string, string[]> = {
  suli: ['收到。', '我知道了。', '……'],
  aruo: ['好呀！', '哈哈', '师姐最棒了！'],
  default: ['好的', '收到', '嗯'],
};

export default function SMSDetail({ characterId, onBack }: SMSDetailProps) {
  const phoneMessages = usePlayerStore((s) => s.phoneMessages);
  const addPhoneMessage = usePlayerStore((s) => s.addPhoneMessage);
  const markMessageRead = usePlayerStore((s) => s.markMessageRead);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());

  const character = getCharacterById(characterId);
  const color = avatarColors[characterId] || '#999';

  const messages = phoneMessages
    .filter((m) => m.type === 'sms' && m.characterId === characterId)
    .sort((a, b) => a.timestamp - b.timestamp);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    messages.forEach((m) => {
      if (!m.read) {
        markMessageRead(m.id);
      }
    });
  }, [messages, markMessageRead]);

  const handleReply = (text: string) => {
    const msgId = `player_sms_${Date.now()}`;
    addPhoneMessage({
      id: msgId,
      characterId,
      type: 'sms',
      content: text,
      timestamp: Date.now(),
      read: true,
    });
    setNewMessageIds((prev) => new Set(prev).add(msgId));

    // 模拟回复
    setTimeout(() => {
      const phrases = character?.phonePersonality.commonPhrases || ['……'];
      const reply = phrases[Math.floor(Math.random() * phrases.length)];
      const replyId = `char_sms_${Date.now()}`;
      addPhoneMessage({
        id: replyId,
        characterId,
        type: 'sms',
        content: reply,
        timestamp: Date.now(),
        read: false,
      });
      setNewMessageIds((prev) => new Set(prev).add(replyId));
    }, 1500 + Math.random() * 1500);
  };

  const replies = smsReplies[characterId] || smsReplies.default;

  return (
    <div className="flex h-full flex-col" style={{ background: '#000' }}>
      {/* Header */}
      <div className="flex items-center px-4 pb-2 pt-2" style={{ background: '#1c1c1e', height: '50px' }}>
        <button onClick={onBack} className="mr-3 flex items-center text-blue-400">
          <ChevronLeft size={22} />
        </button>
        <span className="text-base font-semibold text-white">
          {character?.name || '未知'}
        </span>
      </div>

      {/* 消息区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.map((msg) => {
          const isPlayer = msg.id.startsWith('player_');
          return (
            <motion.div
              key={msg.id}
              initial={newMessageIds.has(msg.id) ? { opacity: 0, y: 10, scale: 0.95 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`mb-2.5 flex ${isPlayer ? 'justify-end' : 'justify-start'}`}
            >
              {!isPlayer && (
                <div
                  className="mr-2 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {character?.name.charAt(0)}
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                  isPlayer
                    ? 'rounded-tr-sm bg-blue-500 text-white'
                    : 'rounded-tl-sm bg-[#2c2c2e] text-white'
                }`}
              >
                <span className="text-sm leading-relaxed">{msg.content}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 回复按钮 */}
      <div style={{ background: '#1c1c1e' }}>
        <div className="flex gap-2 overflow-x-auto px-3 py-2">
          {replies.map((reply, i) => (
            <button
              key={i}
              onClick={() => handleReply(reply)}
              className="flex-shrink-0 rounded-full bg-blue-500/20 px-3 py-1.5 text-xs text-blue-400 transition-colors active:bg-blue-500/30"
            >
              {reply}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <div className="flex-1 rounded-full bg-[#2c2c2e] px-4 py-2 text-sm text-white/30">
            输入短信...
          </div>
          <button className="rounded-full bg-blue-500 px-4 py-2 text-sm text-white">发送</button>
        </div>
      </div>
    </div>
  );
}
