export type PlayerRole = 'fighter' | 'spectator';
export type RoomStatus  = 'waiting' | 'playing';

export interface RoomPlayer {
  id:       string;
  name:     string;
  role:     PlayerRole;
  joinedAt: number;
  isHost:   boolean;
  avatar:   string;
}

export interface RoomState {
  code:        string;
  status:      RoomStatus;
  players:     Record<string, RoomPlayer>;
  maxFighters: number;
  maxTotal:    number;
}

export type RoomEvent =
  | { type: 'JOIN';         player:   RoomPlayer }
  | { type: 'LEAVE';        playerId: string }
  | { type: 'ROLE_CHANGE';  playerId: string; role: PlayerRole }
  | { type: 'SYNC_REQUEST'; from:     string;  player: RoomPlayer }
  | { type: 'SYNC';         fromId:   string;  state:  RoomState }
  | { type: 'START' };
