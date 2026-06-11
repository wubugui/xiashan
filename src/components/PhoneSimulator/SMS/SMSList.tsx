import { ChevronLeft } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { useMemo } from 'react';

interface SMSListProps {
  onOpenChat: (characterId: string) => void;
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

export default function SMSList({ onOpenChat, onBack }: SMSListProps) {
  const phoneMessages = usePlayerStore((s) => s.phoneMessages);

  const smsGroups = useMemo(() => {
    const smsMessages = phoneMessages.filter((m) => m.type === 'sms');
    const groups: Record<string, typeof smsMessages> = {};
    smsMessages.forEach((msg) => {
      if (!groups[msg.characterId]) {
        groups[msg.characterId] = [];
      }
      groups[msg.characterId].push(msg);
    });
    return Object.entries(groups)
      .map(([characterId, messages]) => ({
        characterId,
        messages: messages.sort((a, b) => a.timestamp - b.timestamp),
        lastMessage: messages[messages.length - 1],
        unreadCount: messages.filter((m) => !m.read).length,
      }))
      .sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
  }, [phoneMessages]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="flex h-full flex-col bg-black">
      {/* Header */}
      <div className="flex items-center px-4 pb-2 pt-2" style={{ background: '#1c1c1e', height: '50px' }}>
        <button onClick={onBack} className="mr-3 flex items-center text-blue-400">
          <ChevronLeft size={22} />
        </button>
        <span className="text-base font-semibold text-white">短信</span>
      </div>

      {/* 短信列表 */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#000' }}>
        {smsGroups.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-white/30">
            暂无短信
          </div>
        ) : (
          smsGroups.map((group) => {
            const character = getCharacterById(group.characterId);
            if (!character) return null;
            const color = avatarColors[group.characterId] || '#999';

            return (
              <button
                key={group.characterId}
                onClick={() => onOpenChat(group.characterId)}
                className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors active:bg-white/5"
              >
                {/* 头像 */}
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {character.name.charAt(0)}
                </div>

                {/* 内容 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{character.name}</span>
                    <span className="text-xs text-white/40">
                      {formatTime(group.lastMessage.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-white/50">
                    {group.lastMessage.content}
                  </p>
                </div>

                {/* 未读角标 */}
                {group.unreadCount > 0 && (
                  <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1">
                    <span className="text-[10px] font-bold text-white">
                      {group.unreadCount > 99 ? '99+' : group.unreadCount}
                    </span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
