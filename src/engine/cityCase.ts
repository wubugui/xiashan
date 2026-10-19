/**
 * 都市交叉事件样板：凌晨一点的纸箱。
 * 纯叙事数据与规则，不访问 React / Zustand。
 * 事件节点通过 flags 持久化，与现有委托、抽卡、存档兼容。
 */
export type CityClueId = 'receipt' | 'camera' | 'voicemail';
export type CityTheoryId = 'theft' | 'publicity' | 'rescue';
export type CityOutcomeId = 'publish' | 'verify' | 'settle';

export const CASE_ID = 'midnight_parcel';
export const CASE_DONE_FLAG = 'city_midnight_parcel_done';

export interface CityClue {
  id: CityClueId;
  title: string;
  eyebrow: string;
  preview: string;
  lines: string[];
  helper?: { characterId: string; text: string };
}

export const CITY_CLUES: CityClue[] = [
  {
    id: 'receipt',
    title: '被撕掉一角的签收单',
    eyebrow: '柜台 · 实物',
    preview: '签收人写的是一个已经搬走的住户。',
    lines: [
      '纸箱是零点四十一分从三号楼取走的，但签收栏写着一位两个月前就搬走的住户。',
      '单子边角被撕掉了。箱体侧面还有一排细小透气孔，不像普通快递。',
      '一个问题出现了：谁把它放在公共走廊，又为什么写一个不存在的收件人？',
    ],
    helper: {
      characterId: 'shenzhaoning',
      text: '祁宁看过签收单：这个名字在旧住户名单里。她可以调取脱敏的交接记录，但不会私自公开住户信息。',
    },
  },
  {
    id: 'camera',
    title: '缺少七秒的监控',
    eyebrow: '大楼 · 录像',
    preview: '网传的监控视频，在最关键的地方断了。',
    lines: [
      '网络视频只有二十秒。小满抱起纸箱的镜头之后，恰好少了七秒。',
      '原始画面的墙面反光里，隐约能看见另一个人站在楼梯口，并非小满独自行动。',
      '短片能证明她抱走箱子，却无法证明箱子里是什么，更不能证明她为什么要拿。',
    ],
    helper: {
      characterId: 'murongxue',
      text: '沈疏桐对照画面时间码，发现转发视频被二次剪辑。她愿意核实原件，却不会替你隐瞒有价值的事实。',
    },
  },
  {
    id: 'voicemail',
    title: '一条没有发出的语音',
    eyebrow: '小满手机 · 录音草稿',
    preview: '对方反复让她不要说出楼层。',
    lines: [
      '语音里传来许念的声音：「送到了，呼吸很弱，但已经暖过来了。」',
      '「千万别把楼层说出去。那家人本来就不想让邻居知道这回事。」',
      '小满承认纸箱里是一只被遗弃的幼猫；她请求你不要曝光原住户的门牌，因为那样许念的救助点也可能被卷入争执。',
    ],
    helper: {
      characterId: 'aman',
      text: '许念认得这段录音，也认得小满送来的小猫。她能证明动物已获救，但不愿意公开无关住户的信息。',
    },
  },
];

export const CITY_THEORIES: { id: CityTheoryId; title: string; explanation: string }[] = [
  { id: 'theft', title: '小满真的顺手偷了快递', explanation: '把镜头里看到的行为当作了全部事实。' },
  { id: 'publicity', title: '这是她们合谋制造的直播噱头', explanation: '怀疑流量操作，但手里的证据还不足以支持。' },
  { id: 'rescue', title: '小满是在帮忙转移被遗弃的活物', explanation: '箱体透气孔、缺失画面与语音都指向这一点。' },
];

export interface CityOutcome {
  id: CityOutcomeId;
  title: string;
  sub: string;
  story: string[];
  changes: { characterId: string; affinity: number; message: string }[];
  normalTickets: number;
  spiritStones: number;
}

export const CITY_OUTCOMES: Record<CityOutcomeId, CityOutcome> = {
  publish: {
    id: 'publish',
    title: '把原片公开',
    sub: '最快的澄清，也是最不受控的传播',
    story: [
      '完整录像上传后，小满被骂的那段视频迅速失去说服力。新的讨论却开始追查纸箱来自哪一户。',
      '祁宁要求你撤下能够辨认门牌的信息。小满终于可以继续跑单，却不肯看第二遍那些评论。',
      '第二天，沈疏桐发来一张截图：最早传播剪辑视频的账号，正准备删除它。',
    ],
    changes: [
      { characterId: 'yunzhiyi', affinity: 8, message: '我知道你是想帮我。可是那只猫的主人现在也被扒出来了……这算解决了吗？' },
      { characterId: 'shenzhaoning', affinity: -6, message: '小满的事情需要澄清，但你公开的原片涉及其他住户隐私。以后请先和我确认边界。' },
      { characterId: 'murongxue', affinity: 2, message: '发视频的账号开始删帖了。我截了档，事情还没结束。' },
    ],
    normalTickets: 2,
    spiritStones: 60,
  },
  verify: {
    id: 'verify',
    title: '提交脱敏的完整证据',
    sub: '保护当事人，但必须付出等待的代价',
    story: [
      '你和祁宁整理出不含住户身份的交接记录，沈疏桐完成事实核验。说明送到配送站时，天已经亮了。',
      '纠正通报终于发出，小满恢复接单，但停工两天让她错过了一次转正考核。',
      '她没有像往常那样立刻笑起来，只说：「我知道你尽力了。可我还是有点不甘心。」',
    ],
    changes: [
      { characterId: 'yunzhiyi', affinity: 4, message: '站里让我回去上班了。但转正评估错过了。你别道歉，我知道你不是故意拖着的。' },
      { characterId: 'shenzhaoning', affinity: 7, message: '脱敏记录已经备案。做得稳妥。只是程序走完，需要有人承担等待。' },
      { characterId: 'murongxue', affinity: 5, message: '我把报道拆成了两篇：一篇澄清小满，一篇追问谁剪了那七秒。后面那篇，还缺证据。' },
    ],
    normalTickets: 3,
    spiritStones: 80,
  },
  settle: {
    id: 'settle',
    title: '先让争议安静下来',
    sub: '保住隐私，也放弃立刻还她清白',
    story: [
      '你联系配送站与物业，双方同意内部调查，网传视频暂时没有新的回应。',
      '幼猫被安置下来，小满却仍在停单。她嘴上说无所谓，第二天也没有来便利屋。',
      '深夜，祁宁发来一句话：「事情压下去了，不代表事情解决了。」',
    ],
    changes: [
      { characterId: 'yunzhiyi', affinity: -5, message: '原来这就是你说的办法啊。至少猫没事。别来接我，我想一个人走走。' },
      { characterId: 'shenzhaoning', affinity: 2, message: '物业这边暂时停止传播监控。以后还是需要一次正式说明。' },
      { characterId: 'murongxue', affinity: -2, message: '我尊重你不想扩大的决定。但我会自己查那七秒，不会把这件事当没发生。' },
    ],
    normalTickets: 2,
    spiritStones: 60,
  },
};

export const clueFlag = (id: CityClueId): string => `city_midnight_parcel_clue_${id}`;
export const theoryFlag = (id: CityTheoryId): string => `city_midnight_parcel_theory_${id}`;
export const outcomeFlag = (id: CityOutcomeId): string => `city_midnight_parcel_outcome_${id}`;

export function foundClues(flags: string[]): CityClueId[] {
  return CITY_CLUES.filter(c => flags.includes(clueFlag(c.id))).map(c => c.id);
}

export function chosenTheory(flags: string[]): CityTheoryId | null {
  return CITY_THEORIES.find(t => flags.includes(theoryFlag(t.id)))?.id ?? null;
}

export function chosenOutcome(flags: string[]): CityOutcomeId | null {
  return (Object.keys(CITY_OUTCOMES) as CityOutcomeId[]).find(id => flags.includes(outcomeFlag(id))) ?? null;
}

/**
 * 没有角色卡也能得到完整真相，但必须查看全部三份证据。
 * 已抽到祁宁 / 沈疏桐，可在两份关键材料后协助走正式核实渠道。
 * 角色提供额外解法，不阻断基础剧情。
 */
export function canVerify(flags: string[], ownedIds: string[]): boolean {
  if (chosenTheory(flags) !== 'rescue') return false;
  if (foundClues(flags).length === CITY_CLUES.length) return true;
  const hasOfficialAid = ownedIds.includes('shenzhaoning') && flags.includes(clueFlag('receipt'));
  const hasReportingAid = ownedIds.includes('murongxue') && flags.includes(clueFlag('camera'));
  return foundClues(flags).length >= 2 && (hasOfficialAid || hasReportingAid);
}

export function availableOutcomes(flags: string[], ownedIds: string[]): CityOutcomeId[] {
  if (!chosenTheory(flags)) return [];
  return canVerify(flags, ownedIds) ? ['publish', 'verify', 'settle'] : ['publish', 'settle'];
}

export function caseStage(flags: string[]): 'investigation' | 'theory' | 'decision' | 'ending' {
  if (flags.includes(CASE_DONE_FLAG)) return 'ending';
  if (chosenTheory(flags)) return 'decision';
  if (foundClues(flags).length >= 2) return 'theory';
  return 'investigation';
}
