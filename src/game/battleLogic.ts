import type { BattleState, TankState, TurnPhase, Projectile, SkillId, Tree, FloatingPlatform } from './gameTypes';
import type { GameStartInfo } from './gameTypes';
import { SKILL_POOL } from './skillDefs';

// ── Constants ─────────────────────────────────────────────────────────
export const GROUND_Y         = 380;  // y coordinate of ground surface
export const VOID_Y           = 444;  // void boundary (top of bottom UI = 540 - 96)
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

// Returns the highest surface (lowest Y) at x: terrain or platform top
export function getEffectiveY(terrain: number[], platforms: FloatingPlatform[], x: number): number {
  let y = getTerrainY(terrain, x);
  const xi = Math.round(x);
  for (const p of platforms) {
    if (xi >= p.x && xi <= p.x + p.w) {
      const surf = p.surface[xi - p.x];
      if (surf < y) y = surf;
    }
  }
  return y;
}

function getPlatformSurfaceAt(p: FloatingPlatform, x: number): number {
  const xi = Math.round(x);
  if (xi < p.x || xi > p.x + p.w) return Infinity;
  return p.surface[xi - p.x];
}

// Carve into a platform's surface array (like carveCircle but for platform surface)
function carvePlatformSurface(p: FloatingPlatform, cx: number, cy: number, r: number): FloatingPlatform {
  const r2 = r * r;
  const x0 = Math.max(p.x, Math.ceil(cx - r));
  const x1 = Math.min(p.x + p.w, Math.floor(cx + r));
  if (x0 > x1) return p;
  const surf = [...p.surface];
  for (let x = x0; x <= x1; x++) {
    const dx = x - cx;
    const newY = cy + Math.sqrt(r2 - dx * dx);
    const i = x - p.x;
    if (newY > surf[i]) surf[i] = Math.min(newY, VOID_Y);
  }
  return { ...p, surface: surf };
}

// Narrow tunnel carve for penetrating bullets: only columns where bullet is actually underground
function tunnelPlatformSurface(p: FloatingPlatform, cx: number, cy: number, r: number): FloatingPlatform {
  const r2 = r * r;
  const x0 = Math.max(p.x, Math.ceil(cx - r));
  const x1 = Math.min(p.x + p.w, Math.floor(cx + r));
  if (x0 > x1) return p;
  const surf = [...p.surface];
  for (let x = x0; x <= x1; x++) {
    const i = x - p.x;
    if (cy < surf[i]) continue; // bullet above platform surface at this column
    const dx = x - cx;
    const newY = cy + Math.sqrt(r2 - dx * dx);
    if (newY > surf[i]) surf[i] = Math.min(newY, VOID_Y);
  }
  return { ...p, surface: surf };
}

function generateTrees(terrain: number[], rng: () => number): Tree[] {
  const count = Math.floor(rng() * 4); // 0–3
  const trees: Tree[] = [];
  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      const x = 140 + Math.floor(rng() * 680); // avoid spawn zones
      if (Math.abs(x - 170) < 70 || Math.abs(x - 790) < 70) continue;
      if (trees.some(t => Math.abs(t.x - x) < 90)) continue;
      const baseY = getTerrainY(terrain, x);
      if (baseY >= VOID_Y - 10) continue; // don't place on nearly-void terrain
      trees.push({ x, baseY, trunkHalfW: 5, height: 42 + Math.floor(rng() * 28), destroyed: false });
      placed = true;
    }
  }
  return trees;
}

function generatePlatforms(rng: () => number): FloatingPlatform[] {
  const count = Math.floor(rng() * 3); // 0–2
  const platforms: FloatingPlatform[] = [];
  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 20 && !placed; attempt++) {
      const w = 80 + Math.floor(rng() * 90);
      const x = 80 + Math.floor(rng() * (800 - w));
      const y = 160 + Math.floor(rng() * 140); // float above terrain
      const h = 20 + Math.floor(rng() * 14);
      if (platforms.some(p => x < p.x + p.w + 40 && x + w > p.x - 40)) continue;
      platforms.push({ x, y, w, h, surface: new Array<number>(w + 1).fill(y) });
      placed = true;
    }
  }
  return platforms;
}

function carveCircle(terrain: number[], cx: number, cy: number, r: number): void {
  const r2 = r * r;
  const x0 = Math.max(0,   Math.ceil(cx - r));
  const x1 = Math.min(960, Math.floor(cx + r));
  for (let x = x0; x <= x1; x++) {
    const dx  = x - cx;
    const newY = cy + Math.sqrt(r2 - dx * dx);
    if (newY > terrain[x]) terrain[x] = Math.min(newY, VOID_Y);
  }
}

// Tunnel carve: only carves columns where bullet is at or below the terrain surface
function carveTunnel(terrain: number[], cx: number, cy: number, r: number): void {
  const r2 = r * r;
  const x0 = Math.max(0, Math.ceil(cx - r));
  const x1 = Math.min(960, Math.floor(cx + r));
  for (let x = x0; x <= x1; x++) {
    if (cy < terrain[x]) continue; // bullet above surface at this column — skip
    const dx   = x - cx;
    const newY = cy + Math.sqrt(r2 - dx * dx);
    if (newY > terrain[x]) terrain[x] = Math.min(newY, VOID_Y);
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
  const mapSeed = hashStr(info.fighters.map(f => f.id).join(''));
  const terrain  = generateTerrain(mapSeed);
  const mapRng   = seededRng(mapSeed ^ 0xdeadbeef);
  const trees    = generateTrees(terrain, mapRng);
  const platforms = generatePlatforms(mapRng);
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
    trees,
    platforms,
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
  const currentY  = getEffectiveY(state.terrain, state.platforms, tank.x);
  const aheadY    = getEffectiveY(state.terrain, state.platforms, tank.x + dxSign * 4);
  // Positive = uphill in movement direction (canvas Y decreases = higher on screen)
  const uphillSlope = (currentY - aheadY) / 4;

  if (uphillSlope > SLOPE_BLOCK_TAN) return null; // too steep, blocked

  const energyCost = ENERGY_DRAIN_RATE * dt;
  const actualCost = Math.min(energyCost, tank.energy);
  const frac       = actualCost / ENERGY_DRAIN_RATE;
  const dx         = dxSign * MOVE_SPEED * frac;
  const newX       = Math.max(FIELD_MIN_X, Math.min(FIELD_MAX_X, tank.x + dx));

  // Check tree collision
  for (const tree of state.trees) {
    if (tree.destroyed) continue;
    if (newX + TANK_HIT_W > tree.x - tree.trunkHalfW &&
        newX - TANK_HIT_W < tree.x + tree.trunkHalfW) {
      return null; // blocked by tree trunk
    }
  }

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
): { state: BattleState; hit: HitResult | null; newExplosions: { x: number; y: number }[]; voidKills: string[] } {
  if (state.projectiles.length === 0) return { state, hit: null, newExplosions: [], voidKills: [] };

  const oppId   = opponentId(state);
  const oppTank = state.tanks[oppId];
  const oppGY   = getEffectiveY(state.terrain, state.platforms, oppTank.x);

  let terrain   = state.terrain;
  let trees     = state.trees;
  let platforms = state.platforms;
  let firstHit: HitResult | null = null;
  const remaining: Projectile[] = [];
  const newExplosions: { x: number; y: number }[] = [];

  // Helper: destroy trees within explosion radius
  function blastTrees(ex: number, ey: number, r: number): void {
    trees = trees.map(tree => {
      if (tree.destroyed) return tree;
      const dx = tree.x - ex, dy = tree.baseY - ey;
      return Math.sqrt(dx * dx + dy * dy) < r + tree.height * 0.5
        ? { ...tree, destroyed: true } : tree;
    });
  }

  // Helper: carve platform surfaces within explosion radius
  function blastPlatforms(ex: number, ey: number, r: number): void {
    platforms = platforms.map(p => carvePlatformSurface(p, ex, ey, r));
  }

  for (const p of state.projectiles) {
    const nx  = p.x + p.vx * dt;
    const ny  = p.y + p.vy * dt;
    const nvy = p.vy + GRAVITY * dt;
    const tY  = getTerrainY(terrain, nx);

    // Direct tank hit
    const hitTop = oppGY - TANK_HIT_TOP;
    const inBox  = Math.abs(nx - oppTank.x) < TANK_HIT_W && ny > hitTop && ny < oppGY + 5;
    if (inBox && firstHit === null) {
      let damage = Math.round(30 * p.damageMult);
      if (p.bigExplosion) damage = Math.max(15, damage);
      const explR = p.bigExplosion ? 56 : 28;
      terrain = applyExplosion(terrain, nx, oppGY, explR);
      blastTrees(nx, oppGY, explR);
      blastPlatforms(nx, oppGY, explR);
      newExplosions.push({ x: nx, y: oppGY });
      firstHit = { targetId: oppId, damage, missed: false };
      continue;
    }

    // Tree hit
    if (!p.penetrating) {
      const hitTree = trees.find(tree => {
        if (tree.destroyed) return false;
        const canopyR = tree.height * 0.4;
        return Math.abs(nx - tree.x) < canopyR && ny > tree.baseY - tree.height && ny < tree.baseY;
      });
      if (hitTree) {
        const explR = p.bigExplosion ? 60 : 30;
        terrain = applyExplosion(terrain, nx, ny, explR);
        blastTrees(nx, ny, explR);
        blastPlatforms(nx, ny, explR);
        newExplosions.push({ x: nx, y: ny });
        if (firstHit === null) {
          const dx   = oppTank.x - nx;
          const dy   = oppGY - ny;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < explR) {
            const t = 1 - dist / explR;
            let splash = Math.round((5 + t * 20) * p.damageMult);
            if (p.bigExplosion) splash = Math.max(15, splash);
            firstHit = { targetId: oppId, damage: splash, missed: false };
          }
        }
        continue;
      }
    }

    // Floating platform collision (use per-column surface)
    const hitPlatform = !p.penetrating && platforms.find(
      pl => nx >= pl.x && nx <= pl.x + pl.w &&
            ny > getPlatformSurfaceAt(pl, nx) && p.y <= getPlatformSurfaceAt(pl, nx) + 4,
    );
    if (hitPlatform) {
      const explR = p.bigExplosion ? 60 : 30;
      const impY  = getPlatformSurfaceAt(hitPlatform, nx);
      blastTrees(nx, impY, explR);
      blastPlatforms(nx, impY, explR);
      newExplosions.push({ x: nx, y: impY });
      if (firstHit === null) {
        const dx   = oppTank.x - nx;
        const dy   = oppGY - impY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < explR) {
          const t = 1 - dist / explR;
          let splash = Math.round((5 + t * 20) * p.damageMult);
          if (p.bigExplosion) splash = Math.max(15, splash);
          firstHit = { targetId: oppId, damage: splash, missed: false };
        }
      }
      continue;
    }

    // Penetrating: carve terrain + platforms while underground
    if (p.penetrating && ny > tY - 2) {
      const r = p.bigExplosion ? 18 : 10;
      const next2 = terrain.slice();
      carveTunnel(next2, nx, ny, r);
      terrain = next2;
      // Also tunnel through platforms
      platforms = platforms.map(pl => {
        const surf = getPlatformSurfaceAt(pl, nx);
        if (surf === Infinity || ny < surf) return pl;
        return tunnelPlatformSurface(pl, nx, ny, r);
      });
    }

    const outOfBounds = nx < -60 || nx > 1020 || ny >= VOID_Y;
    const hitGround   = !p.penetrating && ny > tY + 5;

    if (outOfBounds || hitGround) {
      if (hitGround) {
        const explR = p.bigExplosion ? 60 : 30;
        const impY  = getTerrainY(terrain, nx);
        terrain = applyExplosion(terrain, nx, impY, explR);
        blastTrees(nx, impY, explR);
        blastPlatforms(nx, impY, explR);
        newExplosions.push({ x: nx, y: ny });
        // Splash damage if opponent is within explosion radius
        if (firstHit === null) {
          const dx   = oppTank.x - nx;
          const dy   = oppGY - impY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < explR) {
            const t = 1 - dist / explR;
            let splash = Math.round((5 + t * 20) * p.damageMult);
            if (p.bigExplosion) splash = Math.max(15, splash);
            firstHit = { targetId: oppId, damage: splash, missed: false };
          }
        }
      }
      continue;
    }

    remaining.push({ ...p, x: nx, y: ny, vy: nvy });
  }

  // Void kills: check effective surface (terrain + platforms) for each tank
  const voidKills: string[] = [];
  for (const pid of state.playerOrder) {
    const tank = state.tanks[pid];
    if (tank && tank.hp > 0 && getEffectiveY(terrain, state.platforms, tank.x) >= VOID_Y) {
      voidKills.push(pid);
    }
  }

  const done  = remaining.length === 0;
  const phase = done ? 'post_shot' as TurnPhase : state.phase;
  return {
    state: { ...state, projectiles: remaining, terrain, trees, platforms, phase },
    hit: firstHit,
    newExplosions,
    voidKills,
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

