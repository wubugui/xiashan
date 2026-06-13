import { ChevronLeft } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { assetUrl } from '@/lib/assets';

interface SMSDetailProps {
  characterId: string;
  onBack: () => void;
  /** 嵌入 ContactScreen 时隐藏自带顶栏 */
  hideHeader?: boolean;
  /** 关系够不够：false = 石沉大海（能发，没回音，不涨好感） */
  willReply?: boolean;
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

// 短信定位「更短、更随性」——玩家发起的小问候
const smsReplies: Record<string, string[]> = {
  default: ['在干嘛？', '路上小心', '早点睡', '周末有空吗？'],
};

// 她的短信回应（短、私人、口吻贴人设）
const herSms: Record<string, string[]> = {
  suli: ['刚下播。听到提示音就笑了。', '嗯，你也是。', '夜里别想太多，有我。'],
  aruo: ['哎你猜我在干嘛~等你消息呀！', '收到收到！明天见！', '么么，注意安全！'],
  sangluo: ['在煮今天最后一壶。', '路上慢点，不急。', '周末？给你留位子。'],
  aman: ['在给团子梳毛，它打了个喷嚏。', '好，你也是。', '有空就来，我都在。'],
  shenzhaoning: ['刚收工。难得你先发我。', '嗯，知道了。', '周末……可以。'],
  murongxue: ['在整理素材，看到一条想发你。', '好，路上看手机别走神。', '嗯，约。'],
  yunzhiyi: ['刚送完最后一单！超快的！', '收到！明天见明天见！', '有空有空！去哪都行！'],
  linxia: ['刚到家，正想发你呢。', '你也早点休息呀。', '周末！我看看清单排一下~'],
  default: ['嗯，收到。', '好，你也是。', '改天约。'],
};

export default function SMSDetail({ characterId, onBack, hideHeader = false, willReply = true }: SMSDetailProps) {
  const phoneMessages = usePlayerStore((s) => s.phoneMessages);
  const addPhoneMessage = usePlayerStore((s) => s.addPhoneMessage);
  const markMessageRead = usePlayerStore((s) => s.markMessageRead);
  const addAffinity = usePlayerStore((s) => s.addAffinity);
  const tryDailyAction = usePlayerStore((s) => s.tryDailyAction);
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
      if (!m.read && !m.id.startsWith('player_')) {
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

    // 关系没到位：石沉大海——能发出去，但没回音、不涨好感
    if (!willReply) return;

    // 每日首次短信问候 +2 好感（限频防刷）
    if (tryDailyAction(`sms_chat:${characterId}`)) {
      addAffinity(characterId, 2);
    }

    // 她回应（角色口吻）
    setTimeout(() => {
      const pool = herSms[characterId] || herSms.default;
      const reply = pool[Math.floor(Math.random() * pool.length)];
      const replyId = `char_sms_${Date.now()}`;
      addPhoneMessage({
        id: replyId,
        characterId,
        type: 'sms',
        content: reply,
        timestamp: Date.now(),
        read: true,
      });
      setNewMessageIds((prev) => new Set(prev).add(replyId));
    }, 1200 + Math.random() * 1200);
  };

  const replies = smsReplies[characterId] || smsReplies.default;

  return (
    <div className="flex h-full flex-col" style={{ background: '#000' }}>
      {!hideHeader && (
        <div className="flex items-center px-4 pb-2 pt-2" style={{ background: '#1c1c1e', height: '50px' }}>
          <button onClick={onBack} className="mr-3 flex items-center text-blue-400">
            <ChevronLeft size={22} />
          </button>
          <span className="text-base font-semibold text-white">{character?.name || '未知'}</span>
        </div>
      )}

      {/* 消息区域 */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-white/30">
            {willReply ? '还没有短信——发条问候，她会回你。' : '还没有短信——你可以发，但她也许还不会回。'}
          </p>
        )}
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
                character?.avatarUrl ? (
                  <img src={assetUrl(character.avatarUrl)} alt="" className="mr-2 mt-1 h-8 w-8 flex-shrink-0 rounded-full object-cover" loading="lazy" />
                ) : (
                  <div className="mr-2 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: color }}>
                    {character?.name.charAt(0)}
                  </div>
                )
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
