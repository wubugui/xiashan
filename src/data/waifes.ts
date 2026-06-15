/**
 * 「一角色一配置」装载器：收集 src/content/waifes/*.json，铺成既有结构（Character /
 * RomanceArc / 状态 / 反应 / 回复矩阵），供各处按 id 覆盖使用。
 * 加角色 = 在这里 import 一个新配置并加进 CONFIGS，其余不动。
 */
import type { Character } from '@/data/types';
import type { RomanceArc } from '@/data/romanceArcs';
import { type WaifeConfig, configToCharacter } from '@/data/waife';
import suli from '@/content/waifes/suli.json';
import aruo from '@/content/waifes/aruo.json';
import sangluo from '@/content/waifes/sangluo.json';
import aman from '@/content/waifes/aman.json';
import shenzhaoning from '@/content/waifes/shenzhaoning.json';
import murongxue from '@/content/waifes/murongxue.json';
import yunzhiyi from '@/content/waifes/yunzhiyi.json';
import linxia from '@/content/waifes/linxia.json';

// 全部 8 角色已迁入「一角色一配置」（加角色 = 加一个 json 并在此 import）
const CONFIGS: WaifeConfig[] = [suli as WaifeConfig, aruo as WaifeConfig, sangluo as WaifeConfig, aman as WaifeConfig, shenzhaoning as WaifeConfig, murongxue as WaifeConfig, yunzhiyi as WaifeConfig, linxia as WaifeConfig];

const byId = new Map<string, WaifeConfig>(CONFIGS.map((c) => [c.id, c]));

export const configuredIds = new Set<string>(byId.keys());
export function waifeConfig(id: string): WaifeConfig | undefined {
  return byId.get(id);
}

/** 配置铺出的 Character 列表（覆盖旧 characters.json 同 id 项） */
export const waifeConfigCharacters: Character[] = CONFIGS.map(configToCharacter);

/** 配置铺出的恋爱线（覆盖旧 romanceArcs.json 同 id 项） */
export const waifeConfigArcs: RomanceArc[] = CONFIGS.map((c) => ({
  characterId: c.id,
  theme: c.romance.theme,
  beats: c.romance.beats,
}));

export function waifeSignatures(id: string): WaifeConfig['signatures'] | undefined {
  return byId.get(id)?.signatures;
}
export function waifeReactions(id: string): WaifeConfig['reactions'] | undefined {
  return byId.get(id)?.reactions;
}
export function waifeChat(id: string): WaifeConfig['chat'] | undefined {
  return byId.get(id)?.chat;
}
