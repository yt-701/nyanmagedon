import type { BattleState, TankState, TurnPhase, Projectile } from './gameTypes';
import type { GameStartInfo } from './gameTypes';
import { STARTER_HAND } from './skillDefs';

// ── Constants ─────────────────────────────────────────────────────────
export const GROUND_Y         = 380;  // y coordinate of ground surface
export const FIELD_MIN_X      = 80;
export const FIELD_MAX_X      = 880;
export const MOVE_SPEED       = 48;   // px/s during hold (1/4 of original 190)
export const ENERGY_DRAIN_RATE = 55;  // energy/s while moving
export const TANK_HIT_W       = 12;  // half-width of tank hitbox (1/4 of original 48)
export const TANK_HIT_TOP     = 23;  // how far above GROUND_Y the hitbox extends (1/4 of 90)
export const GRAVITY           = 680;  // px/s²
export const MAX_SPEED         = 700;  // px/s at power=1
export const BARREL_ROOT_LOCAL = 21;   // unscaled barrel root x offset from tank center
export const BARREL_LEN_LOCAL  = 38;   // unscaled barrel length
export const TANK_SCALE        = 0.25; // visual scale factor

// ── Initial state ─────────────────────────────────────────────────────

export const CPU_PLAYER_ID = '__cpu__';

export function createInitialState(info: GameStartInfo): BattleState {
  const p1 = info.fighters[0];
  // Solo/debug: create a dummy CPU opponent when only 1 fighter
  const p2raw = info.fighters[1] ?? {
    id: CPU_PLAYER_ID, name: 'CPU', role: 'fighter' as const,
    joinedAt: Date.now(), isHost: false, avatar: '🤖',
  };

  const mkTank = (p: { id: string; name: string }, x: number, facing: 1 | -1): TankState => ({
    playerId: p.id, name: p.name,
    x, hp: 100, maxHp: 100,
    energy: 300, maxEnergy: 300,
    facing,
    hand: [...STARTER_HAND],
    effects: [],
  });

  const tanks: Record<string, TankState> = {
    [p1.id]:   mkTank(p1,   170,  1),
    [p2raw.id]: mkTank(p2raw, 790, -1),
  };
  return {
    tanks,
    playerOrder: [p1.id, p2raw.id],
    activeIdx: 0,
    phase: 'pre_shot',
    turn: 1,
    projectile: null,
    log: ['バトルスタート！'],
    winner: null,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

export function activeId(state: BattleState): string {
  return state.playerOrder[state.activeIdx];
}
export function opponentId(state: BattleState): string {
  return state.playerOrder[1 - state.activeIdx];
}

function updateTank(state: BattleState, id: string, patch: Partial<TankState>): BattleState {
  return { ...state, tanks: { ...state.tanks, [id]: { ...state.tanks[id], ...patch } } };
}

function log(state: BattleState, msg: string): BattleState {
  return { ...state, log: [...state.log.slice(-19), msg] };
}

// ── Move (continuous, call each frame while button is held) ──────────

export function applyMoveContinuous(
  state: BattleState, direction: 'left' | 'right', dt: number,
): BattleState | null {
  const id   = activeId(state);
  const tank = state.tanks[id];
  if (!tank || tank.energy <= 0 || state.phase !== 'pre_shot') return null;

  const energyCost = ENERGY_DRAIN_RATE * dt;
  const actualCost = Math.min(energyCost, tank.energy);
  const frac       = actualCost / ENERGY_DRAIN_RATE;
  const dx         = (direction === 'right' ? 1 : -1) * MOVE_SPEED * frac;
  const newX       = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, tank.x + dx));
  const newEnergy  = Math.max(0, tank.energy - actualCost);

  return updateTank(state, id, { x: newX, energy: newEnergy });
}

// ── Facing change ─────────────────────────────────────────────────────

export function applyFacingChange(state: BattleState): BattleState {
  const id   = activeId(state);
  const tank = state.tanks[id];
  if (!tank || state.phase !== 'pre_shot') return state;
  const newFacing = (tank.facing === 1 ? -1 : 1) as 1 | -1;
  let s = updateTank(state, id, { facing: newFacing });
  s = log(s, `${tank.name} が向きを変えた`);
  return s;
}

// ── Shoot ────────────────────────────────────────────────────────────

export function barrelTipScreen(tank: TankState, angle: number): { x: number; y: number } {
  const f = tank.facing;
  return {
    x: tank.x + f * (BARREL_ROOT_LOCAL + BARREL_LEN_LOCAL * Math.cos(angle)) * TANK_SCALE,
    y: GROUND_Y - (14 + BARREL_LEN_LOCAL * Math.sin(angle)) * TANK_SCALE,
  };
}

export function calcShot(
  tank: TankState, power: number, angle: number, canBounce: boolean,
): Projectile {
  const speed = 200 + power * MAX_SPEED;
  const vx    = speed * Math.cos(angle) * tank.facing;
  const vy    = -speed * Math.sin(angle);
  const tip   = barrelTipScreen(tank, angle);
  return { x: tip.x, y: tip.y, vx, vy, canBounce, bounced: false, power };
}

export function applyFire(state: BattleState, power: number, angle: number): BattleState {
  const id   = activeId(state);
  const tank = state.tanks[id];
  const hasBounce = tank.effects.some(e => e.type === 'bounce');
  const proj  = calcShot(tank, power, angle, hasBounce);
  // Consume bounce effect
  const effects = hasBounce
    ? tank.effects.filter(e => e.type !== 'bounce')
    : tank.effects;
  let s = updateTank(state, id, { effects });
  s = { ...s, projectile: proj, phase: 'animating' };
  s = log(s, `${tank.name} が砲撃！ パワー ${Math.round(power * 100)}%`);
  return s;
}

// ── Projectile tick ───────────────────────────────────────────────────

export interface HitResult {
  targetId: string;
  damage:   number;
  missed:   boolean;
}

export function tickProjectile(
  state: BattleState, dt: number,
): { state: BattleState; hit: HitResult | null } {
  const p = state.projectile;
  if (!p) return { state, hit: null };

  let nx = p.x + p.vx * dt;
  let ny = p.y + p.vy * dt;
  let nvy = p.vy + GRAVITY * dt;
  let bounced = p.bounced;

  // Ground bounce (only if bounce_shot effect active and not yet bounced)
  if (ny >= GROUND_Y && p.canBounce && !bounced) {
    ny  = GROUND_Y;
    nvy = -Math.abs(nvy) * 0.6;
    bounced = true;
  }

  // Out of bounds (ground after bounce, or off sides)
  const outOfBounds = ny > GROUND_Y + 20 || nx < -60 || nx > 1020;

  // Hit check against opponent tank
  const oppId   = opponentId(state);
  const oppTank = state.tanks[oppId];
  const hitTop  = GROUND_Y - TANK_HIT_TOP;
  const inBox   =
    Math.abs(nx - oppTank.x) < TANK_HIT_W &&
    ny > hitTop && ny < GROUND_Y + 5;

  if (inBox) {
    // Check smoke screen
    const hasSmoke = oppTank.effects.some(e => e.type === 'smoke');
    const activeT  = state.tanks[activeId(state)];
    const hasAP    = activeT.effects.some(e => e.type === 'ap_round');
    let damage     = Math.round(p.power * 50);
    if (hasAP) damage = Math.round(damage * 1.5);

    // Consume effects
    let s = state;
    if (hasSmoke) {
      const newEffects = oppTank.effects.filter(e => e.type !== 'smoke');
      s = updateTank(s, oppId, { effects: newEffects });
    }
    const apEffects = activeT.effects.filter(e => e.type !== 'ap_round');
    s = updateTank(s, activeId(s), { effects: apEffects });
    s = { ...s, projectile: null, phase: 'post_shot' };
    return { state: s, hit: { targetId: oppId, damage, missed: hasSmoke } };
  }

  if (outOfBounds) {
    const s = { ...state, projectile: null, phase: 'post_shot' as TurnPhase };
    return { state: s, hit: null };
  }

  return {
    state: { ...state, projectile: { ...p, x: nx, y: ny, vy: nvy, bounced } },
    hit: null,
  };
}

export function applyDamage(state: BattleState, hit: HitResult): BattleState {
  const target = state.tanks[hit.targetId];
  if (!target) return state;
  const newHp  = Math.max(0, target.hp - (hit.missed ? 0 : hit.damage));
  let s = updateTank(state, hit.targetId, { hp: newHp });

  if (hit.missed) {
    s = log(s, `${target.name} のスモークスクリーンが砲弾を無効化！`);
  } else {
    s = log(s, `${target.name} に ${hit.damage} ダメージ！  残りHP ${newHp}`);
  }

  if (newHp <= 0) {
    const winner = activeId(state);
    s = { ...s, phase: 'game_over', winner };
    s = log(s, `${state.tanks[winner].name} の勝利！🎉`);
  }
  return s;
}

// ── Skill use ─────────────────────────────────────────────────────────

export function applyUseSkill(state: BattleState, handIdx: number): BattleState | null {
  const id   = activeId(state);
  const tank = state.tanks[id];
  if (!tank || state.phase !== 'pre_shot') return null;

  const skillId = tank.hand[handIdx];
  if (!skillId) return null;

  const newHand = tank.hand.filter((_, i) => i !== handIdx);
  let s = updateTank(state, id, { hand: newHand });

  switch (skillId) {
    case 'boost_engine':
      s = updateTank(s, id, { energy: Math.min(tank.maxEnergy, tank.energy + 60) });
      s = log(s, `${tank.name} がブーストエンジン発動！ エネルギー+60`);
      break;
    case 'ap_round': {
      const effects = [...tank.effects.filter(e => e.type !== 'ap_round'), { type: 'ap_round' as const, turnsLeft: 1 }];
      s = updateTank(s, id, { effects });
      s = log(s, `${tank.name} が徹甲弾装填！ 次の砲撃1.5倍`);
      break;
    }
    case 'repair_kit':
      s = updateTank(s, id, { hp: Math.min(tank.maxHp, tank.hp + 30) });
      s = log(s, `${tank.name} が修理！ HP+30`);
      break;
    case 'smoke_screen': {
      const effects = [...tank.effects.filter(e => e.type !== 'smoke'), { type: 'smoke' as const, turnsLeft: 1 }];
      s = updateTank(s, id, { effects });
      s = log(s, `${tank.name} がスモーク展開！ 次の砲弾を無効化`);
      break;
    }
    case 'teleport': {
      const newX = Math.round(FIELD_MIN_X + Math.random() * (FIELD_MAX_X - FIELD_MIN_X));
      s = updateTank(s, id, { x: newX });
      s = log(s, `${tank.name} がテレポート！`);
      break;
    }
    case 'bounce_shot': {
      const effects = [...tank.effects.filter(e => e.type !== 'bounce'), { type: 'bounce' as const, turnsLeft: 1 }];
      s = updateTank(s, id, { effects });
      s = log(s, `${tank.name} がバウンドショット装填！`);
      break;
    }
    case 'energy_drain': {
      const oppId = opponentId(state);
      const opp   = s.tanks[oppId];
      const newE  = Math.floor(opp.energy / 2);
      s = updateTank(s, oppId, { energy: newE });
      s = log(s, `${tank.name} がエネルギードレイン！ 相手エネルギー${opp.energy}→${newE}`);
      break;
    }
  }
  return s;
}

// ── End turn ──────────────────────────────────────────────────────────

export function applyEndTurn(state: BattleState): BattleState {
  const nextIdx  = 1 - state.activeIdx;
  const nextId   = state.playerOrder[nextIdx];
  const nextTank = state.tanks[nextId];

  // Tick effects
  const tickEffects = (tank: TankState): TankState => ({
    ...tank,
    effects: tank.effects
      .map(e => ({ ...e, turnsLeft: e.turnsLeft - 1 }))
      .filter(e => e.turnsLeft > 0),
  });

  const tanks: Record<string, TankState> = {};
  for (const [id, tank] of Object.entries(state.tanks)) {
    tanks[id] = tickEffects(tank);
  }
  // Restore next player's energy
  tanks[nextId] = { ...tanks[nextId], energy: nextTank.maxEnergy };

  const newTurn = nextIdx === 0 ? state.turn + 1 : state.turn;
  let s: BattleState = { ...state, tanks, activeIdx: nextIdx, phase: 'pre_shot', turn: newTurn, projectile: null };
  s = log(s, `ターン${s.turn} — ${s.tanks[nextId].name} のターン`);
  return s;
}

