import type { SkillId } from './gameTypes';

export interface SkillDef {
  id:          SkillId;
  nameJa:      string;
  description: string;
  emoji:       string;
  type:        'move' | 'attack' | 'defense' | 'special';
}

export const SKILL_DEFS: Record<SkillId, SkillDef> = {
  boost_engine: {
    id: 'boost_engine', nameJa: 'ブーストエンジン',
    description: 'エネルギーを60回復',
    emoji: '⚡', type: 'move',
  },
  ap_round: {
    id: 'ap_round', nameJa: '徹甲弾',
    description: '次の砲撃ダメージ×1.5',
    emoji: '🎯', type: 'attack',
  },
  repair_kit: {
    id: 'repair_kit', nameJa: '修理キット',
    description: 'HPを30回復',
    emoji: '🔧', type: 'defense',
  },
  smoke_screen: {
    id: 'smoke_screen', nameJa: 'スモークスクリーン',
    description: '次に受ける砲弾を無効化',
    emoji: '💨', type: 'defense',
  },
  teleport: {
    id: 'teleport', nameJa: 'テレポート',
    description: 'ランダムな位置に瞬間移動',
    emoji: '✨', type: 'special',
  },
  bounce_shot: {
    id: 'bounce_shot', nameJa: 'バウンドショット',
    description: '地面で1回バウンドする砲弾',
    emoji: '🔄', type: 'attack',
  },
  energy_drain: {
    id: 'energy_drain', nameJa: 'エネルギードレイン',
    description: '相手のエネルギーを半分にする',
    emoji: '🔋', type: 'special',
  },
};

export const STARTER_HAND: SkillId[] = ['boost_engine', 'repair_kit', 'ap_round'];
