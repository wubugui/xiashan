/**
 * 新手引导流程定义（强制锁定式）
 *
 * 台词在 src/content/tutorialScript.json（每句带 id，供配音挂载）；
 * 本文件只定义每一步的「机制」：锁定哪个元素、何时自动推进、推进时发什么奖励。
 *
 * 设计原则：
 * - until 谓词只依赖持久化 store 状态 + 少量页面状态（ctx），刷新页面后可无损续接；
 * - target 是动态函数：同一步内根据界面状态切换锁定目标（如「先切 Tab 再点按钮」）；
 * - 玩家全程只能点亮起的目标，其余区域被遮罩拦截。
 */
import script from '@/content/tutorialScript.json';

/** 引导谓词所需的界面/存档快照（由 Shop.tsx 组装） */
export interface TutorialCtx {
  activeTab: string;
  commissionId: string | null;
  objectivesDone: string[];
  locId: string | null;
  /** 热点事件弹窗是否打开 */
  eventOpen: boolean;
  sideJobPetDone: boolean;
  /** 手牌中是否已有「临时人脉电话」（教学补给抽卡的固定出货） */
  hasPhoneCard: boolean;
  /** interview 已交付（flag 已写入且委托槽已清空） */
  interviewDelivered: boolean;
}

export interface TutorialLine {
  id: string;
  text: string;
}

export interface TutorialStep {
  id: string;
  /** modal = 全屏江夏对白（只能点按钮）；spot = 聚光灯锁定目标元素 */
  kind: 'modal' | 'spot';
  /** 江夏立绘表情（/characters/face/linxia/{expression}.png） */
  expression: string;
  /** 有按钮 → 点按钮推进；无按钮 → until 条件满足自动推进 */
  button?: string;
  lines: TutorialLine[];
  /** 聚光灯目标：返回 data-tut 标识 */
  target?: (ctx: TutorialCtx) => string;
  /** 自动推进条件 */
  until?: (ctx: TutorialCtx) => boolean;
  /** 推进离开本步时发放的奖励 */
  reward?: { stones?: number };
}

/** 教学固定卡组：精确覆盖全程所有热点与剧场挑战，故意不含「流程/万能」卡（缺卡教学点） */
export const TUTORIAL_DECK = ['bike', 'search', 'speech', 'hint', 'snack', 'calm', 'risk'];
/** 教学顺手单（公寓楼 · 宠物 · 奖励普通券，衔接补给抽卡教学） */
export const TUTORIAL_SIDE_JOB = 'sj_pet';
/** 教学补给抽卡固定出货：SR 万能卡，补上缺失的「流程」需求 */
export const TUTORIAL_DRAW_CARD = 'phone';
/** 教学第一阶段路线（补登记完成前） / 第二阶段路线 */
export const TUTORIAL_ROUTES_EARLY = ['subway', 'apartment', 'office'];
export const TUTORIAL_ROUTES_LATE = ['rooftop', 'apartment', 'store'];

type FlowMeta = Pick<TutorialStep, 'target' | 'until' | 'reward'>;

const FLOW: Record<string, FlowMeta> = {
  welcome: {},
  trouble: {},
  accept: {
    target: c => (c.activeTab !== 'commission' ? 'tab-commission' : 'btn-accept-interview'),
    until: c => c.commissionId === 'interview',
  },
  objectives: {
    target: () => 'objectives-list',
  },
  goto_map: {
    target: c => (c.activeTab !== 'map' ? 'tab-map' : 'route-subway'),
    until: c => c.locId === 'subway',
  },
  first_action: {
    target: c => (c.eventOpen ? 'card-search' : 'spot-subway-1'),
    until: c => c.objectivesDone.includes('find_bag'),
    reward: { stones: 100 },
  },
  lack_card: {},
  leave_subway: {
    target: () => 'btn-finish-location',
    until: c => c.locId === null,
  },
  goto_apartment: {
    target: () => 'route-apartment',
    until: c => c.locId === 'apartment',
  },
  do_side_job: {
    target: c => (c.eventOpen ? 'card-snack' : 'spot-apartment-0'),
    until: c => c.sideJobPetDone,
  },
  supply_draw: {
    target: () => 'btn-supply',
    until: c => c.hasPhoneCard,
  },
  leave_apartment: {
    target: () => 'btn-finish-location',
    until: c => c.locId === null,
  },
  goto_office: {
    target: () => 'route-office',
    until: c => c.locId === 'office',
  },
  register: {
    target: c => (c.eventOpen ? 'card-phone' : 'spot-office-0'),
    until: c => c.objectivesDone.includes('register'),
    reward: { stones: 100 },
  },
  leave_office: {
    target: () => 'btn-finish-location',
    until: c => c.locId === null,
  },
  goto_rooftop: {
    target: () => 'route-rooftop',
    until: c => c.locId === 'rooftop',
  },
  calm_her: {
    target: c => (c.eventOpen ? 'card-calm' : 'spot-rooftop-0'),
    until: c => c.objectivesDone.includes('calm_her'),
    reward: { stones: 100 },
  },
  deliver: {
    target: c => (c.activeTab !== 'commission' ? 'tab-commission' : 'btn-deliver'),
    until: c => c.interviewDelivered,
  },
  celebrate: {},
};

interface ScriptStep {
  id: string;
  kind: 'modal' | 'spot';
  expression: string;
  button?: string;
  lines: TutorialLine[];
}

interface ScriptShape {
  nudges: TutorialLine[];
  home: { entry: { expression: string; lines: TutorialLine[] }; resume: { expression: string; lines: TutorialLine[] } };
  start: { expression: string; lines: TutorialLine[] };
  steps: ScriptStep[];
}

const data = script as unknown as ScriptShape;

export const TUTORIAL_STEPS: TutorialStep[] = data.steps.map(s => ({ ...s, ...FLOW[s.id] }));
export const TUTORIAL_TOTAL = TUTORIAL_STEPS.length;
/** 入伙庆典步（最后一步）的 tutorialStep 值 */
export const TUTORIAL_CELEBRATE_STEP = TUTORIAL_TOTAL;

export const TUTORIAL_HOME_ENTRY = data.home.entry;
export const TUTORIAL_HOME_RESUME = data.home.resume;
export const TUTORIAL_START = data.start;
/** 玩家点到引导目标之外时，江夏的提醒语（轮换播放，带 id 供配音） */
export const TUTORIAL_NUDGES = data.nudges;
