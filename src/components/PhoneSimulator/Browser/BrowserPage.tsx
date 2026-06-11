import { ChevronLeft } from 'lucide-react';

interface BrowserPageProps {
  url: string;
  onBack: () => void;
}

const pageData: Record<string, { title: string; date: string; content: string[] }> = {
  'https://citynews.local/urban-legend-metro': {
    title: '都市传说：深夜地铁末班车上的神秘乘客',
    date: '2026年6月7日',
    content: [
      '近日，多位市民向本报反映，在末班地铁上遭遇了令人毛骨悚然的经历。',
      '据目击者描述，每晚23:47分的末班地铁上，总会出现一位身穿白色古装的女子。她面容模糊，始终低头不语，坐在车厢最角落的位置。',
      '更令人不安的是，多位乘客表示，当列车到达终点站时，这位神秘乘客便凭空消失，仿佛从未存在过。',
      '地铁运营方对此表示"暂无监控记录"，但有网友发现，该时段的监控录像确实存在一段约3分钟的空白。',
      '目前，此事仍在调查中。建议市民尽量避免独自乘坐末班地铁。',
    ],
  },
  'https://citynews.local/flying-neighbor': {
    title: '修仙者下山？某小区住户称邻居会飞',
    date: '2026年6月6日',
    content: [
      '城东翠湖小区近日爆出惊人消息——多位住户反映，顶层住户疑似拥有"飞行"能力。',
      '据住在楼下的张女士描述，她多次在深夜看到顶层阳台外有人影悬浮，"那个人就那样飘在空中，像是在打坐一样。"',
      '物业表示已多次上门查看，但每次敲门都无人应答。更诡异的是，该户的水电费账单显示为零。',
      '有住户尝试在楼顶安装摄像头，但第二天发现摄像头已被人用黑色胶带封住。',
      '目前，社区已向相关部门反映此事，等待进一步调查。',
    ],
  },
  'https://citynews.local/haunted-hospital': {
    title: '灵异事件频发！废弃医院深夜传出歌声',
    date: '2026年6月5日',
    content: [
      '城北废弃医院连续一周在凌晨两点传出女子歌声，附近居民彻夜难眠。',
      '据居民描述，歌声凄美婉转，像是在吟唱某种古老的曲调，"不像任何我听过的歌，但莫名地让人想哭。"',
      '有胆大的年轻人曾试图进入医院探查，但均表示"走到门口就浑身发冷，迈不动步子"。',
      '更令人不安的是，有居民在歌声停止后，在医院门口发现了一束新鲜的白色花朵，但附近并无花店。',
      '专家推测可能是声学现象，但无法解释花朵的来源。建议市民远离该区域。',
    ],
  },
  'https://citynews.local/youmingsi-exposed': {
    title: '神秘组织"幽冥司"被曝真实存在？',
    date: '2026年6月4日',
    content: [
      '近日，有网友在社交平台爆料称，传说中的"幽冥司"并非虚构，而是真实存在的特殊机构。',
      '据该网友描述，幽冥司是一个专门处理"超自然事件"的秘密组织，其历史可追溯至数百年前。',
      '爆料中还提到，幽冥司的成员被称为"司命官"，他们拥有普通人无法理解的能力，能够"窥探生死"。',
      '虽然该爆料很快被删除，但截图已在网络上广泛传播。有自称"知情人士"的网友证实了部分内容。',
      '官方对此未作回应。但记者注意到，近年来多起"灵异事件"的调查结果均被列为机密。',
    ],
  },
  'https://citynews.local/spirit-stone-trade': {
    title: '古董店老板：有人用灵石买走了千年法器',
    date: '2026年6月2日',
    content: [
      '城中古董街一家店铺老板向本报透露了一件匪夷所思的交易。',
      '据老板描述，上周三深夜，一位蒙面顾客来到店里，用一枚"会发光的石头"换走了一把据称有千年历史的古剑。',
      '"那石头拿在手里是温热的，而且确实在发光，不是反光。我这辈子没见过那种东西。"老板如是说。',
      '更令人震惊的是，老板声称当那位顾客拿起古剑时，剑身竟然发出了嗡鸣声，"像是剑在回应它的主人"。',
      '目前，该古剑已被列为失踪文物。警方正在调查此事，但老板坚称"那不是普通人，那是个修仙者"。',
    ],
  },
};

export default function BrowserPage({ url, onBack }: BrowserPageProps) {
  const page = pageData[url] || {
    title: '页面未找到',
    date: '',
    content: ['该页面不存在或已被删除。'],
  };

  return (
    <div className="flex h-full flex-col" style={{ background: '#1c1c1e' }}>
      {/* 地址栏 */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-2">
        <button onClick={onBack} className="text-blue-400">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 flex items-center gap-2 rounded-lg bg-[#2c2c2e] px-3 py-1.5">
          <span className="text-xs text-white/30">🔒</span>
          <span className="flex-1 truncate text-xs text-white/50">{url}</span>
        </div>
      </div>

      {/* 文章内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h1 className="text-lg font-bold text-white/90 leading-snug">
          {page.title}
        </h1>
        {page.date && (
          <p className="mt-2 text-xs text-white/30">{page.date} · 都市传说新闻网</p>
        )}
        <div className="mt-4 space-y-3">
          {page.content.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-white/60">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
