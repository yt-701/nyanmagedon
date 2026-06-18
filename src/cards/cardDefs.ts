import type { CardDef } from "../types";

export const CARD_DEFS: Record<string, CardDef> = {
  gatling_paw: {
    id: "gatling_paw",
    name: "Gatling Paw",
    nameJa: "ガトリングポウ",
    description: "全敵に8ダメージ",
    cost: 2,
    type: "attack",
    effect: ({ enemies, dealDamage }) => {
      enemies.forEach((_, i) => dealDamage(i, 8));
    },
  },
  turbo_boost: {
    id: "turbo_boost",
    name: "Turbo Boost",
    nameJa: "ターボブースト",
    description: "マナ+3、次のカードコスト-1",
    cost: 1,
    type: "utility",
    effect: ({ addMana, addEffect }) => {
      addMana(3);
      addEffect("cost_down", 1);
    },
  },
  nyan_shield: {
    id: "nyan_shield",
    name: "Nyan Shield",
    nameJa: "ニャンシールド",
    description: "3ターンバリア付与",
    cost: 2,
    type: "defense",
    effect: ({ addEffect }) => {
      addEffect("shield", 3);
    },
  },
  catnip_bomb: {
    id: "catnip_bomb",
    name: "Catnip Bomb",
    nameJa: "キャットニップ爆弾",
    description: "単体に20ダメージ、混乱付与",
    cost: 3,
    type: "attack",
    effect: ({ enemies, dealDamage, addEffect }) => {
      if (enemies.length > 0) {
        dealDamage(0, 20);
        addEffect("confused_enemy_0", 2);
      }
    },
  },
  purr_heal: {
    id: "purr_heal",
    name: "Purr Heal",
    nameJa: "ゴロゴロヒール",
    description: "HP15回復",
    cost: 2,
    type: "utility",
    effect: ({ healPlayer }) => {
      healPlayer(15);
    },
  },
  mega_claw: {
    id: "mega_claw",
    name: "Mega Claw",
    nameJa: "メガクロー",
    description: "単体に35ダメージ",
    cost: 4,
    type: "attack",
    effect: ({ enemies, dealDamage }) => {
      if (enemies.length > 0) {
        dealDamage(0, 35);
      }
    },
  },
};

export const STARTER_DECK: string[] = [
  "gatling_paw",
  "gatling_paw",
  "turbo_boost",
  "turbo_boost",
  "nyan_shield",
  "catnip_bomb",
  "purr_heal",
  "mega_claw",
  "gatling_paw",
  "purr_heal",
];
