import type { RoomPlayer } from '../room/roomTypes';

export type TurnPhase =
  | 'pre_shot'   // can move / use skill / start charging
  | 'charging'   // power meter oscillating; fire or cancel
  | 'animating'  // projectile in flight
  | 'post_shot'  // can only end turn
  | 'waiting'    // opponent's turn (local player is passive)
  | 'game_over';

export type SkillId = 'shot_nyan' | 'penetrate_nyan' | 'explo_nyan';

export type EffectType = 'triple_shot' | 'penetrate' | 'big_explosion';

export interface ActiveEffect {
  type:      EffectType;
  turnsLeft: number;
}

export interface TankState {
  playerId:  string;
  name:      string;
  x:         number;   // center x on field (80–880)
  hp:        number;
  maxHp:     number;
  energy:    number;
  maxEnergy: number;
  facing:    1 | -1;   // 1 = right, −1 = left
  hand:      SkillId[];
  effects:   ActiveEffect[];
}

export interface Projectile {
  x:           number;
  y:           number;
  vx:          number;
  vy:          number;
  power:       number;
  penetrating: boolean; // passes through terrain
  bigExplosion: boolean; // 2x explosion radius
  damageMult:  number;  // damage multiplier (1 = normal, 0.75 = triple shot)
}

export interface Tree {
  x:           number;   // center x
  baseY:       number;   // terrain surface Y at tree's x (bottom of trunk)
  trunkHalfW:  number;   // collision half-width (~5 px)
  height:      number;   // total visual height
  destroyed:   boolean;
}

export interface FloatingPlatform {
  x: number;  // left edge
  y: number;  // top surface y (landing surface)
  w: number;  // width
  h: number;  // visual thickness
}

export interface BattleState {
  tanks:       Record<string, TankState>; // keyed by playerId
  playerOrder: string[];                  // [p1Id, p2Id]
  activeIdx:   number;                    // 0 or 1
  phase:       TurnPhase;
  turn:        number;
  projectiles: Projectile[];              // all in-flight projectiles
  log:         string[];
  winner:      string | null;
  terrain:     number[]; // terrain[x] = surface Y at pixel x (0–960)
  trees:       Tree[];
  platforms:   FloatingPlatform[];
}

export interface GameStartInfo {
  roomCode:   string;
  myPlayerId: string;
  fighters:   RoomPlayer[]; // [0]=P1 left, [1]=P2 right
}

export type GameEvent =
  | { type: 'MOVE';      newX: number; newEnergy: number }
  | { type: 'FIRE';      projectiles: Projectile[] }
  | { type: 'USE_SKILL'; handIdx: number; resultState: BattleState }
  | { type: 'END_TURN';  resultState: BattleState }
  | { type: 'SYNC';      state: BattleState };
