import { ChevronLeft, MoreVertical } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import MessageBubble from './MessageBubble';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assetUrl } from '@/lib/assets';

interface ChatDetailProps {
  characterId: string;
  onBack: () => void;
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

// 模拟回复选项
const quickReplies: Record<string, string[]> = {
  suli: ['宗主，我回来了。', '我没事。', '……知道了。'],
  chujinghong: ['你才无聊。', '哼。', '有本事来比试。'],
  sujinli: ['你看到什么了？', '我不信命。', '……'],
  aruo: ['师姐！', '我想你了~', '又来捉弄我？'],
  huapi: ['你到底是谁？', '哪张脸都是你。', '……'],
  sangluo: ['别睡了！', '起来吃饭了。', '……'],
  aman: ['师姐好~', '没人欺负我啦。', '嘻嘻~'],
  default: ['嗯。', '好的。', '知道了。'],
};

export default function ChatDetail({ characterId, onBack }: ChatDetailProps) {
  const phoneMessages = usePlayerStore((s) => s.phoneMessages);
  const addPhoneMessage = usePlayerStore((s) => s.addPhoneMessage);
  const markMessageRead = usePlayerStore((s) => s.markMessageRead);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());

  const character = getCharacterById(characterId);
  const color = avatarColors[characterId] || '#999';

  // 获取当前角色的微信消息
  const messages = phoneMessages
    .filter((m) => m.type === 'wechat' && m.characterId === characterId)
    .sort((a, b) => a.timestamp - b.timestamp);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isTyping]);

  // 标记消息已读
  useEffect(() => {
    messages.forEach((m) => {
      if (!m.read) {
        markMessageRead(m.id);
      }
    });
  }, [messages, markMessageRead]);

  const handleQuickReply = (text: string) => {
    const playerId = `player_${Date.now()}`;
    addPhoneMessage({
      id: playerId,
      characterId,
      type: 'wechat',
      content: text,
      timestamp: Date.now(),
      read: true,
    });
    setNewMessageIds((prev) => new Set(prev).add(playerId));

    // 模拟角色正在输入
    setIsTyping(true);
    const delay = 1000 + Math.random() * 2000;
    setTimeout(() => {
      setIsTyping(false);
      const phrases = character?.phonePersonality.commonPhrases || ['……'];
      const reply = phrases[Math.floor(Math.random() * phrases.length)];
      const replyId = `char_${Date.now()}`;
      addPhoneMessage({
        id: replyId,
        characterId,
        type: 'wechat',
        content: reply,
        timestamp: Date.now(),
        read: false,
      });
      setNewMessageIds((prev) => new Set(prev).add(replyId));
    }, delay);
  };

  const replies = quickReplies[characterId] || quickReplies.default;

  return (
    <div className="flex h-full flex-col" style={{ background: '#EDEDED' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pb-2 pt-2"
        style={{ background: '#EDEDED', height: '50px' }}
      >
        <button onClick={onBack} className="flex items-center text-black/70">
          <ChevronLeft size={22} />
        </button>
        <span className="text-base font-semibold text-black">
          {character?.name || '未知'}
        </span>
        <MoreVertical size={20} className="text-black/40" />
      </div>

      {/* 消息区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            content={msg.content}
            type="text"
            sender="character"
            isNew={newMessageIds.has(msg.id)}
          />
        ))}

        {/* 正在输入指示器 */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-4 py-2"
            >
              {character?.avatarUrl ? (
                <img
                  src={assetUrl(character.avatarUrl)}
                  alt={character.name}
                  className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {character?.name.charAt(0)}
                </div>
              )}
              <div className="rounded-lg bg-white px-3 py-2">
                <div className="flex items-center gap-1">
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                    className="h-1.5 w-1.5 rounded-full bg-black/30"
                  />
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="h-1.5 w-1.5 rounded-full bg-black/30"
                  />
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="h-1.5 w-1.5 rounded-full bg-black/30"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 快捷回复 + 输入区域 */}
      <div style={{ background: '#F7F7F7' }}>
        {/* 快捷回复按钮 */}
        <div className="flex gap-2 overflow-x-auto px-3 py-2">
          {replies.map((reply, i) => (
            <button
              key={i}
              onClick={() => handleQuickReply(reply)}
              className="flex-shrink-0 rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/70 transition-colors active:bg-black/5"
            >
              {reply}
            </button>
          ))}
        </div>

        {/* 输入栏 */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <div className="flex-1 rounded-md bg-white px-3 py-2 text-sm text-black/30">
            输入消息...
          </div>
          <button className="rounded-md bg-white px-3 py-2 text-sm text-black/50">发送</button>
        </div>
      </div>
    </div>
  );
}
