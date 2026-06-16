/**
 * 约会场景收藏：public/bg/gacha 下的角色场景图，做成可收集的「约会回忆」。
 * 主动约她（手机联系人页）按顺序解锁；解锁后在「心动名册」看大图、读故事、设为她的主页背景。
 * 数据走 scenes.json（加场景 = 加数据）。下划线开头的废弃图不在此列。
 */
import content from '@/content/scenes.json';

export interface DateScene {
  id: string;
  image: string;
  /** 锁定态剪影；缺省时 UI 用模糊原图 */
  silhouette?: string;
  title: string;
  /** 解锁时的「这次约会去了哪」一句 */
  dateHook: string;
  story: string[];
}

const SCENES = (content as { scenes: Record<string, DateScene[]> }).scenes;

/** 该角色的场景列表（顺序即解锁顺序） */
export function getScenes(characterId: string): DateScene[] {
  return SCENES[characterId] ?? [];
}

let INDEX: Map<string, DateScene> | null = null;
function buildIndex(): Map<string, DateScene> {
  const m = new Map<string, DateScene>();
  for (const list of Object.values(SCENES)) for (const s of list) m.set(s.id, s);
  return m;
}
export function getSceneById(id: string): DateScene | undefined {
  INDEX ??= buildIndex();
  return INDEX.get(id);
}

/** 该角色下一个待解锁的场景（按顺序取第一个未解锁的）；都解锁了返回 null */
export function nextLockedScene(characterId: string, unlocked: string[]): DateScene | null {
  const set = new Set(unlocked);
  for (const s of getScenes(characterId)) if (!set.has(s.id)) return s;
  return null;
}
