import relationshipData from '../content/relationship.json';

export interface RelationshipStage {
  stage: number;
  name: string;
  threshold: number;
  text: string;
}

const defaultStages = relationshipData.defaultStages as RelationshipStage[];
const overrides = relationshipData.overrides as Record<string, RelationshipStage[]>;

/** 角色的关系阶段表（有覆写用覆写，否则用默认五阶） */
export function getRelationshipStages(characterId: string): RelationshipStage[] {
  return overrides[characterId] ?? defaultStages;
}

/** 当前阶段信息（stage 从 0 开始，0 = 尚未推进任何阶段） */
export function getStageInfo(characterId: string, stage: number): RelationshipStage | undefined {
  return getRelationshipStages(characterId).find(s => s.stage === stage);
}

/** 下一阶段（已满阶返回 undefined） */
export function getNextStage(characterId: string, currentStage: number): RelationshipStage | undefined {
  return getRelationshipStages(characterId).find(s => s.stage === currentStage + 1);
}
