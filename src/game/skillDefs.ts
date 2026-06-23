import type { SkillId } from './gameTypes';

export interface SkillDef {
  id:          SkillId;
  nameJa:      string;
  description: string;
  emoji:       string;
}

export const SKILL_DEFS: Record<SkillId, SkillDef> = {
  shot_nyan: {
    id: 'shot_nyan', nameJa: 'ショットニャン',
    description: '3発同時発射（ダメージ×0.75）',
    emoji: '🔱',
  },
  penetrate_nyan: {
    id: 'penetrate_nyan', nameJa: '貫通ニャン',
    description: '地形を貫通する弾（爆発なし）',
    emoji: '💠',
  },
  explo_nyan: {
    id: 'explo_nyan', nameJa: 'エクスプローニャン',
    description: '爆発2倍・最低保証ダメージあり',
    emoji: '💥',
  },
};

export const SKILL_POOL: SkillId[] = ['shot_nyan', 'penetrate_nyan', 'explo_nyan'];
