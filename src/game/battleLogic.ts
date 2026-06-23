import type { BattleState, TankState, TurnPhase, Projectile, SkillId } from './gameTypes';
import type { GameStartInfo } from './gameTypes';
import { SKILL_POOL } from './skillDefs';

// ── Constants ─────────────────────────────────────────────────────────
export const GROUND_Y         = 380;  // y coordinate of ground surface
export const FIELD_MIN_X      = 80;
export const FIELD_MAX_X      = 880;
export const MOVE_SPEED       = 48;   // px/s during hold (1/4 of original 190)
export const ENERGY_DRAIN_RATE = 55;  // energy/s while moving
export const TANK_HIT_W       = 12;  // half-width of tank hitbox (1/4 of original 48)
export const TANK_HIT_TOP     = 23;  // how far above GROUND_Y the hitbox extends (1/4 of 90)
export const GRAVITY           = 680;  // px/s²
export const MAX_SPEED         = 350;  // px/s at power=1 (half of original 700)
export const BARREL_ROOT_LOCAL = 21;   // unscaled barrel root x offset from tank center
export const BARREL_LEN_LOCAL  = 38;   // unscaled barrel length
export const TANK_SCALE        = 0.25; // visual scale factor

// ── Terrain ───────────────────────────────────────────────────────────

function seededRng(seed: number): () => number {
  let s = (seed | 0) >>> 0;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}
function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function generateTerrain(seed: number): number[] {
  const r = seededRng(seed);
  const B = GROUND_Y, TOP = 245;
  const sparse = [
    { x: 0,   y: B },
    { x: 80,  y: B },
    { x: 190, y: B - r() * 25 },
    { x: 310, y: B - (55 + r() * 85) },
    { x: 420, y: TOP + r() * (B - TOP - 70) },
    { x: 480, y: B - r() * 60 },
    { x: 560, y: TOP + r() * (B - TOP - 70) },
    { x: 660, y: B - (55 + r() * 85) },
    { x: 770, y: B - r() * 25 },
    { x: 880, y: B },
    { x: 960, y: B },
  ];
  const terrain = new Array<number>(961).fill(B);
  for (let i = 0; i < sparse.length - 1; i++) {
    const p0 = sparse[i], p1 = sparse[i + 1];
    for (let x = Math.round(p0.x); x <= Math.round(p1.x); x++) {
      const t = (x - p0.x) / (p1.x - p0.x);
      terrain[x] = p0.y + t * (p1.y - p0.y);
    }
  }
  return terrain;
}

export function getTerrainY(terrain: number[], x: number): number {
  return terrain[Math.max(0, Math.min(960, Math.round(x)))];
}

function carveCircle(terrain: number[], cx: number, cy: number, r: number): void {
  const r2 = r * r;
  const x0 = Math.max(0,   Math.ceil(cx - r));
  const x1 = Math.min(960, Math.floor(cx + r));
  for (let x = x0; x <= x1; x++) {
    const dx  = x - cx;
    const newY = cy + Math.sqrt(r2 - dx * dx);
    if (newY > terrain[x]) terrain[x] = Math.min(newY, 522);
  }
}

export function applyExplosion(terrain: number[], hitX: number, hitY: number, radius: number): number[] {
  const next = terrain.slice();
  // Seed with impact coords for determinism across both tabs
  const rng  = seededRng(Math.round(hitX * 73 + hitY * 31));

  // Main crater
  carveCircle(next, hitX, hitY, radius * 0.82);

  // 3–5 satellite craters for irregular edges
  const count = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const offsetX = (rng() - 0.5) * radius * 1.3;
    const offsetY = rng() * radius * 0.35;
    const subR    = radius * (0.28 + rng() * 0.32);
    carveCircle(next, hitX + offsetX, hitY + offsetY, subR);
  }

  return next;
}

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
    hand: [...SKILL_POOL] as SkillId[],
    effects: [],
  });

  const tanks: Record<string, TankState> = {
    [p1.id]:   mkTank(p1,   170,  1),
    [p2raw.id]: mkTank(p2raw, 790, -1),
  };
  const terrain = generateTerrain(hashStr(info.fighters.map(f => f.id).join('')));
  return {
    tanks,
    playerOrder: [p1.id, p2raw.id],
    activeIdx: 0,
    phase: 'pre_shot',
    turn: 1,
    projectiles: [],
    log: ['バトルスタート！'],
    winner: null,
    terrain,
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

const SLOPE_BLOCK_TAN = Math.tan(60 * Math.PI / 180); // ≈ 1.73 (60° slope)

export function applyMoveContinuous(
  state: BattleState, direction: 'left' | 'right', dt: number,
): BattleState | null {
  const id   = activeId(state);
  const tank = state.tanks[id];
  if (!tank || tank.energy <= 0 || state.phase !== 'pre_shot') return null;

  const dxSign    = direction === 'right' ? 1 : -1;
  const currentY  = getTerrainY(state.terrain, tank.x);
  const aheadY    = getTerrainY(state.terrain, tank.x + dxSign * 4);
  // Positive = uphill in movement direction (canvas Y decreases = higher on screen)
  const uphillSlope = (currentY - aheadY) / 4;

  if (uphillSlope > SLOPE_BLOCK_TAN) return null; // too steep, blocked

  const energyCost = ENERGY_DRAIN_RATE * dt;
  const actualCost = Math.min(energyCost, tank.energy);
  const frac       = actualCost / ENERGY_DRAIN_RATE;
  const dx         = dxSign * MOVE_SPEED * frac;
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

export function barrelTipScreen(tank: TankState, angle: number, terrain: number[]): { x: number; y: number } {
  const f = tank.facing;
  const groundY = getTerrainY(terrain, tank.x);
  return {
    x: tank.x + f * (BARREL_ROOT_LOCAL + BARREL_LEN_LOCAL * Math.cos(angle)) * TANK_SCALE,
    y: groundY - (14 + BARREL_LEN_LOCAL * Math.sin(angle)) * TANK_SCALE,
  };
}

function calcShot(
  tank: TankState, power: number, angle: number, terrain: number[],
  penetrating: boolean, bigExplosion: boolean, damageMult: number,
): Projectile {
  const dy_dx    = (getTerrainY(terrain, tank.x + 13) - getTerrainY(terrain, tank.x - 13)) / 26;
  const slopeAng = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, Math.atan(dy_dx)));
  const worldAngle = angle - slopeAng * tank.facing;
  const speed = (100 + power * MAX_SPEED) * 1.25;
  const tip   = barrelTipScreen(tank, worldAngle, terrain);
  return {
    x: tip.x, y: tip.y,
    vx: speed * Math.cos(worldAngle) * tank.facing,
    vy: -speed * Math.sin(worldAngle),
    power, penetrating, bigExplosion, damageMult,
  };
}

export function applyFire(state: BattleState, power: number, angle: number): BattleState {
  const id   = activeId(state);
  const tank = state.tanks[id];

  const hasTriple  = tank.effects.some(e => e.type === 'triple_shot');
  const hasPen     = tank.effects.some(e => e.type === 'penetrate');
  const hasBig     = tank.effects.some(e => e.type === 'big_explosion');
  const damageMult = hasTriple ? 0.75 : 1;

  const angles = hasTriple
    ? [angle - 8 * Math.PI / 180, angle, angle + 8 * Math.PI / 180]
    : [angle];

  const projectiles = angles.map(a =>
    calcShot(tank, power, a, state.terrain, hasPen, hasBig, damageMult),
  );

  const effects = tank.effects.filter(
    e => e.type !== 'triple_shot' && e.type !== 'penetrate' && e.type !== 'big_explosion',
  );
  let s = updateTank(state, id, { effects });
  s = { ...s, projectiles, phase: 'animating' };

  const tags = [hasTriple && '3連射', hasPen && '貫通', hasBig && '大爆発'].filter(Boolean).join('＋');
  s = log(s, `${tank.name} が砲撃！ パワー ${Math.round(power * 100)}%${tags ? ` [${tags}]` : ''}`);
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
): { state: BattleState; hit: HitResult | null; newExplosions: { x: number; y: number }[] } {
  if (state.projectiles.length === 0) return { state, hit: null, newExplosions: [] };

  const oppId   = opponentId(state);
  const oppTank = state.tanks[oppId];
  const oppGY   = getTerrainY(state.terrain, oppTank.x);

  let terrain   = state.terrain;
  let firstHit: HitResult | null = null;
  const remaining: Projectile[] = [];
  const newExplosions: { x: number; y: number }[] = [];

  for (const p of state.projectiles) {
    const nx  = p.x + p.vx * dt;
    const ny  = p.y + p.vy * dt;
    const nvy = p.vy + GRAVITY * dt;
    const tY  = getTerrainY(terrain, nx);

    // Tank hit
    const hitTop = oppGY - TANK_HIT_TOP;
    const inBox  = Math.abs(nx - oppTank.x) < TANK_HIT_W && ny > hitTop && ny < oppGY + 5;
    if (inBox && firstHit === null) {
      let damage = Math.round(p.power * 25 * p.damageMult);
      if (p.bigExplosion) damage = Math.max(15, damage);
      const explR = p.bigExplosion ? 56 : 28;
      terrain = applyExplosion(terrain, nx, oppGY, explR);
      newExplosions.push({ x: nx, y: oppGY });
      firstHit = { targetId: oppId, damage, missed: false };
      continue;
    }

    const outOfBounds = nx < -60 || nx > 1020;
    const hitGround   = !p.penetrating && ny > tY + 5;

    if (outOfBounds || hitGround) {
      if (hitGround) {
        const explR = p.bigExplosion ? 60 : 30;
        const impY  = getTerrainY(terrain, nx);
        terrain = applyExplosion(terrain, nx, impY, explR);
        newExplosions.push({ x: nx, y: ny });
      }
      continue;
    }

    remaining.push({ ...p, x: nx, y: ny, vy: nvy });
  }

  const done  = remaining.length === 0;
  const phase = done ? 'post_shot' as TurnPhase : state.phase;
  return {
    state: { ...state, projectiles: remaining, terrain, phase },
    hit: firstHit,
    newExplosions,
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
    case 'shot_nyan': {
      const effects = [...tank.effects, { type: 'triple_shot' as const, turnsLeft: 1 }];
      s = updateTank(s, id, { effects });
      s = log(s, `${tank.name} がショットニャン！ 次の砲撃が3連射に`);
      break;
    }
    case 'penetrate_nyan': {
      const effects = [...tank.effects, { type: 'penetrate' as const, turnsLeft: 1 }];
      s = updateTank(s, id, { effects });
      s = log(s, `${tank.name} が貫通ニャン！ 次の砲弾が地形を貫通`);
      break;
    }
    case 'explo_nyan': {
      const effects = [...tank.effects, { type: 'big_explosion' as const, turnsLeft: 1 }];
      s = updateTank(s, id, { effects });
      s = log(s, `${tank.name} がエクスプローニャン！ 次の爆発が2倍`);
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
  // Restore next player's energy and deal 3 fresh skill cards
  tanks[nextId] = { ...tanks[nextId], energy: nextTank.maxEnergy, hand: [...SKILL_POOL] as SkillId[] };

  const newTurn = nextIdx === 0 ? state.turn + 1 : state.turn;
  let s: BattleState = { ...state, tanks, activeIdx: nextIdx, phase: 'pre_shot', turn: newTurn, projectiles: [] };
  s = log(s, `ターン${s.turn} — ${s.tanks[nextId].name} のターン`);
  return s;
}

