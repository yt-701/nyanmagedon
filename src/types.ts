export type CardId =
  | "gatling_paw"
  | "turbo_boost"
  | "nyan_shield"
  | "catnip_bomb"
  | "purr_heal"
  | "mega_claw";

export interface CardDef {
  id: CardId;
  name: string;
  nameJa: string;
  description: string;
  cost: number;
  type: "attack" | "defense" | "utility";
  effect: (ctx: CardEffectContext) => void;
}

export interface CardEffectContext {
  player: PlayerState;
  enemies: EnemyState[];
  addMana: (amount: number) => void;
  dealDamage: (targetIndex: number, amount: number) => void;
  healPlayer: (amount: number) => void;
  addEffect: (name: string, duration: number) => void;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  effects: StatusEffect[];
  x: number;
  y: number;
}

export interface EnemyState {
  id: string;
  hp: number;
  maxHp: number;
  atk: number;
  x: number;
  y: number;
  type: "grunt" | "tank" | "boss";
  effects: StatusEffect[];
}

export interface StatusEffect {
  name: string;
  duration: number;
}

export interface GameState {
  player: PlayerState;
  enemies: EnemyState[];
  hand: CardId[];
  deck: CardId[];
  discard: CardId[];
  turn: number;
  phase: "player" | "enemy" | "draw";
  score: number;
}
