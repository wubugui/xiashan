import { ChevronLeft } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { getCharacterById } from '@/data/characters';
import { useMemo } from 'react';

interface ChatListProps {
  onOpenChat: (characterId: string) => void;
  onBack: () => void;
}

// 角色头像颜色映射
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

export default function ChatList({ onOpenChat, onBack }: ChatListProps) {
  const phoneMessages = usePlayerStore((s) => s.phoneMessages);

  // 按 characterId 分组微信消息
  const chatGroups = useMemo(() => {
    const wechatMessages = phoneMessages.filter((m) => m.type === 'wechat');
    const groups: Record<string, typeof wechatMessages> = {};
    wechatMessages.forEach((msg) => {
      if (!groups[msg.characterId]) {
        groups[msg.characterId] = [];
      }
      groups[msg.characterId].push(msg);
    });
    // 按最新消息时间排序
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
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return '昨天';
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="flex h-full flex-col bg-black">
      {/* Header */}
      <div
        className="flex items-center px-4 pb-2 pt-2"
        style={{ background: '#EDEDED', height: '50px' }}
      >
        <button onClick={onBack} className="mr-3 flex items-center text-black/70">
          <ChevronLeft size={22} />
        </button>
        <span className="text-base font-semibold text-black">微信</span>
      </div>

      {/* 搜索栏 */}
      <div className="px-3 pb-2 pt-2" style={{ background: '#EDEDED' }}>
        <div className="rounded-md bg-white/60 px-3 py-1.5 text-center text-xs text-black/40">
          搜索
        </div>
      </div>

      {/* 聊天列表 */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#EDEDED' }}>
        {chatGroups.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-black/30">
            暂无聊天记录
          </div>
        ) : (
          chatGroups.map((group) => {
            const character = getCharacterById(group.characterId);
            if (!character) return null;
            const color = avatarColors[group.characterId] || '#999';

            return (
              <button
                key={group.characterId}
                onClick={() => onOpenChat(group.characterId)}
                className="flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition-colors active:bg-black/5"
                style={{ background: '#EDEDED' }}
              >
                {character.avatarUrl ? (
                  <img
                    src={character.avatarUrl}
                    alt={character.name}
                    className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-base font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {character.name.charAt(0)}
                  </div>
                )}

                {/* 内容 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-black">{character.name}</span>
                    <span className="text-xs text-black/40">
                      {formatTime(group.lastMessage.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-black/50">
                    {group.lastMessage.content}
                  </p>
                </div>

                {/* 未读角标 */}
                {group.unreadCount > 0 && (
                  <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1">
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
