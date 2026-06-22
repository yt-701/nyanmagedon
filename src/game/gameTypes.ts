import type { RoomPlayer } from '../room/roomTypes';

export type TurnPhase =
  | 'pre_shot'   // can move / use skill / start charging
  | 'charging'   // power meter oscillating; fire or cancel
  | 'animating'  // projectile in flight
  | 'post_shot'  // can only end turn
  | 'waiting'    // opponent's turn (local player is passive)
  | 'game_over';

export type SkillId =
  | 'boost_engine'
  | 'ap_round'
  | 'repair_kit'
  | 'smoke_screen'
  | 'teleport'
  | 'bounce_shot'
  | 'energy_drain';

export type EffectType = 'ap_round' | 'smoke' | 'bounce';

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
  x:         number;
  y:         number;
  vx:        number;
  vy:        number;
  canBounce: boolean; // bounce_shot effect active
  bounced:   boolean; // true after first bounce occurred
  power:     number;  // stored for damage calc
}

export interface TerrainPoint { x: number; y: number; }

export interface BattleState {
  tanks:        Record<string, TankState>; // keyed by playerId
  playerOrder:  string[];                  // [p1Id, p2Id]
  activeIdx:    number;                    // 0 or 1
  phase:        TurnPhase;
  turn:         number;
  projectile:   Projectile | null;
  log:          string[];
  winner:       string | null;
  terrain:      TerrainPoint[];
}

export interface GameStartInfo {
  roomCode:   string;
  myPlayerId: string;
  fighters:   RoomPlayer[]; // [0]=P1 left, [1]=P2 right
}

export type GameEvent =
  | { type: 'MOVE';      newX: number; newEnergy: number }
  | { type: 'FIRE';      vx: number; vy: number; startX: number; startY: number; power: number; bounce: boolean }
  | { type: 'USE_SKILL'; handIdx: number; resultState: BattleState }
  | { type: 'END_TURN';  resultState: BattleState }
  | { type: 'SYNC';      state: BattleState };
