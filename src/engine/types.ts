export type Condition =
  | { type: 'has_character'; characterId: string }
  | { type: 'character_level'; characterId: string; minLevel: number }
  | { type: 'reputation'; minValue: number }
  | { type: 'affinity'; characterId: string; minValue: number }
  | { type: 'relationship_stage'; characterId: string; minStage: number }
  | { type: 'dupes_at_least'; characterId: string; minCount: number }
  | { type: 'chapter_complete'; chapterId: number }
  | { type: 'node_complete'; nodeId: string }
  | { type: 'flag_set'; flag: string }
  | { type: 'spirit_stones'; minValue: number }
  | { type: 'random'; chance: number };

export type Effect =
  | { type: 'add_spirit_stones'; value: number }
  | { type: 'add_reputation'; value: number }
  | { type: 'add_affinity'; characterId: string; value: number }
  | { type: 'add_exp'; characterId: string; value: number }
  | { type: 'set_flag'; flag: string }
  | { type: 'unlock_chapter'; chapterId: number }
  | { type: 'trigger_phone_event'; eventId: string }
  | { type: 'trigger_face_slap'; faceSlapId: string };
