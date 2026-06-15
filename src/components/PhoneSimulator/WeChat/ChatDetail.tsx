import { ChevronLeft, MoreVertical } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { replyTo, replyTier, type ChatIntent } from '@/engine/chatReply';
import { waifeConfig } from '@/data/waifes';
import MessageBubble from './MessageBubble';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assetUrl } from '@/lib/assets';

interface ChatDetailProps {
  characterId: string;
  onBack: () => void;
  /** 嵌入 ContactScreen 时隐藏自带顶栏（由外层统一渲染） */
  hideHeader?: boolean;
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

// 玩家可点的快捷回复（玩家口吻，通用且暖）
const playerReplies: { text: string; intent: ChatIntent }[] = [
  { text: '在的，怎么了？', intent: 'greet' },
  { text: '辛苦啦，注意休息', intent: 'care' },
  { text: '想你了', intent: 'flirt' },
  { text: '改天约你出来', intent: 'invite' },
];

export default function ChatDetail({ characterId, onBack, hideHeader = false }: ChatDetailProps) {
  const phoneMessages = usePlayerStore((s) => s.phoneMessages);
  const addPhoneMessage = usePlayerStore((s) => s.addPhoneMessage);
  const markMessageRead = usePlayerStore((s) => s.markMessageRead);
  const addAffinity = usePlayerStore((s) => s.addAffinity);
  const tryDailyAction = usePlayerStore((s) => s.tryDailyAction);
  const markContact = usePlayerStore((s) => s.markContact);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());

  const displayAvatar = usePlayerStore((s) => s.displayAvatar);
  const playerAvatarUrl = usePlayerStore((s) => s.playerAvatarUrl);
  const affinityMap = usePlayerStore((s) => s.affinityMap);
  const xinyiTarget = usePlayerStore((s) => s.xinyiTarget);
  const character = getCharacterById(characterId);
  const avatarSrc = displayAvatar[characterId] || character?.avatarUrl;
  const color = avatarColors[characterId] || '#999';

  const messages = phoneMessages
    .filter((m) => m.type === 'wechat' && m.characterId === characterId)
    .sort((a, b) => a.timestamp - b.timestamp);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isTyping]);

  useEffect(() => {
    messages.forEach((m) => {
      if (!m.read && !m.id.startsWith('player_')) {
        markMessageRead(m.id);
      }
    });
  }, [messages, markMessageRead]);

  const handleQuickReply = (text: string, intent: ChatIntent) => {
    if (isTyping) return;
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
    markContact(characterId); // 主动联系，刷新被冷落计时

    // 每日首次主动聊天 +2 好感（看手机是「有用的事」，限频防刷）
    if (tryDailyAction(`wechat_chat:${characterId}`)) {
      addAffinity(characterId, 2);
    }

    // 她回应：按「意图×好感层」取，可能已读不回
    const reply = replyTo(characterId, 'wechat', intent, affinityMap[characterId] ?? 0, xinyiTarget === characterId, new Date().getHours());
    if (reply === null) return; // 已读不回——她没回应（关系/语境不到 / 在睡）
    setIsTyping(true);
    const delay = 900 + Math.random() * 1500;
    setTimeout(() => {
      setIsTyping(false);
      const replyId = `char_${Date.now()}`;
      addPhoneMessage({
        id: replyId,
        characterId,
        type: 'wechat',
        content: reply,
        timestamp: Date.now(),
        read: true,
      });
      setNewMessageIds((prev) => new Set(prev).add(replyId));

      // 约她且她答应了（亲密档）→ 过一会儿主动发来后续，约这件事不再"说完就完"
      const accepted = intent === 'invite' && replyTier(affinityMap[characterId] ?? 0, xinyiTarget === characterId) === '亲密';
      const followups = waifeConfig(characterId)?.inviteFollowup?.wechat;
      if (accepted && followups && followups.length) {
        const fu = followups[Math.floor(Math.random() * followups.length)];
        const fuId = `invitefu_${characterId}_${Date.now()}`;
        setTimeout(() => {
          addPhoneMessage({ id: fuId, characterId, type: 'wechat', content: fu, timestamp: Date.now(), read: false });
          setNewMessageIds((prev) => new Set(prev).add(fuId));
        }, 4000 + Math.random() * 3000);
      }
    }, delay);
  };

  return (
    <div className="flex h-full flex-col" style={{ background: '#EDEDED' }}>
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 pb-2 pt-2" style={{ background: '#EDEDED', height: '50px' }}>
          <button onClick={onBack} className="flex items-center text-black/70">
            <ChevronLeft size={22} />
          </button>
          <span className="text-base font-semibold text-black">{character?.name || '未知'}</span>
          <MoreVertical size={20} className="text-black/40" />
        </div>
      )}

      {/* 消息区域 */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-3">
        {messages.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-black/30">
            还没有聊过天——发条消息，她会回你的。
          </p>
        )}
        {messages.map((msg) => {
          const isPlayer = msg.id.startsWith('player_');
          return (
            <MessageBubble
              key={msg.id}
              content={msg.content}
              type="text"
              sender={isPlayer ? 'player' : 'character'}
              avatarUrl={isPlayer ? undefined : avatarSrc}
              playerAvatarUrl={isPlayer ? playerAvatarUrl : undefined}
              fallbackInitial={character?.name.charAt(0) ?? ''}
              isNew={newMessageIds.has(msg.id)}
            />
          );
        })}

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
                <img src={assetUrl(avatarSrc)} alt={character.name} className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: color }}>
                  {character?.name.charAt(0)}
                </div>
              )}
              <div className="rounded-lg bg-white px-3 py-2">
                <div className="flex items-center gap-1">
                  {[0, 0.2, 0.4].map((d) => (
                    <motion.span
                      key={d}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1, delay: d }}
                      className="h-1.5 w-1.5 rounded-full bg-black/30"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 玩家快捷回复 */}
      <div style={{ background: '#F7F7F7' }}>
        <div className="flex gap-2 overflow-x-auto px-3 py-2">
          {playerReplies.map((reply) => (
            <button
              key={reply.text}
              onClick={() => handleQuickReply(reply.text, reply.intent)}
              disabled={isTyping}
              className="flex-shrink-0 rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/70 transition-colors active:bg-black/5 disabled:opacity-40"
            >
              {reply.text}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <div className="flex-1 rounded-md bg-white px-3 py-2 text-sm text-black/30">点上面的快捷回复…</div>
          <button className="rounded-md bg-white px-3 py-2 text-sm text-black/50">发送</button>
        </div>
      </div>
    </div>
  );
}
