import type { BattleState, GameStartInfo, TankState, Projectile } from '../game/gameTypes';
import {
  GROUND_Y, GRAVITY, BARREL_ROOT_LOCAL, BARREL_LEN_LOCAL, TANK_SCALE,
  createInitialState, opponentId, CPU_PLAYER_ID, getTerrainY,
  applyMoveContinuous, applyFacingChange, applyFire, applyUseSkill, applyEndTurn,
  tickProjectile, applyDamage,
} from '../game/battleLogic';
import { SKILL_DEFS } from '../game/skillDefs';
import { GameChannel } from '../game/gameChannel';

// ── Drawing helpers ──────────────────────────────────────────────────

const W = 960, H = 540;

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color; ctx.shadowBlur = blur;
}
function noGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
}

// ── Star path helper ──────────────────────────────────────────────────

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else         ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

// ── Background ────────────────────────────────────────────────────────

function drawBg(ctx: CanvasRenderingContext2D, t: number) {
  // Vivid pop sky
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0,   '#5b21b6');
  sky.addColorStop(0.3, '#db2777');
  sky.addColorStop(0.7, '#ea580c');
  sky.addColorStop(1,   '#fbbf24');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // Underground
  const gg = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  gg.addColorStop(0, '#78350f'); gg.addColorStop(1, '#1c0803');
  ctx.fillStyle = gg;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Scrolling clouds
  const cloudData: { x: number; y: number; s: number }[] = [
    { x: 120, y: 55, s: 1.0 }, { x: 340, y: 85, s: 0.7 },
    { x: 580, y: 45, s: 1.2 }, { x: 800, y: 75, s: 0.85 }, { x: 1060, y: 60, s: 0.95 },
  ];
  for (const c of cloudData) {
    const cx = ((c.x - t * 12) % (W + 200) + W + 200) % (W + 200) - 100;
    const r  = 28 * c.s;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx,           c.y,           r,        0, Math.PI * 2);
    ctx.arc(cx + r * 0.8, c.y - r * 0.4, r * 0.75, 0, Math.PI * 2);
    ctx.arc(cx - r * 0.7, c.y - r * 0.3, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Floating decorative stars
  const starData = [
    { x: 60,  y: 28 }, { x: 220, y: 18 }, { x: 450, y: 62 },
    { x: 630, y: 22 }, { x: 760, y: 58 }, { x: 915, y: 32 },
  ];
  ctx.fillStyle = '#fde047';
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 2;
  for (const s of starData) {
    const sy = s.y + Math.sin(t * 0.9 + s.x * 0.04) * 4;
    starPath(ctx, s.x, sy, 10, 5, 5);
    ctx.fill();
    ctx.stroke();
  }
}

// ── Terrain drawing ───────────────────────────────────────────────────

function drawTerrain(ctx: CanvasRenderingContext2D, terrain: number[]) {
  ctx.save();

  // Filled polygon — earthy brown
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, terrain[0]);
  for (let x = 1; x < terrain.length; x++) ctx.lineTo(x, terrain[x]);
  ctx.lineTo(960, H);
  ctx.closePath();

  let minY = H;
  for (const y of terrain) if (y < minY) minY = y;
  const grad = ctx.createLinearGradient(0, minY, 0, H);
  grad.addColorStop(0,   '#92400e');
  grad.addColorStop(0.4, '#78350f');
  grad.addColorStop(1,   '#1c0803');
  ctx.fillStyle = grad;
  ctx.fill();

  // Dark base outline
  ctx.strokeStyle = '#1c0803';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, terrain[0]);
  for (let x = 1; x < terrain.length; x++) ctx.lineTo(x, terrain[x]);
  ctx.stroke();

  // Bright grass strip on top
  ctx.strokeStyle = '#84cc16';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, terrain[0]);
  for (let x = 1; x < terrain.length; x++) ctx.lineTo(x, terrain[x]);
  ctx.stroke();

  ctx.restore();
}

// ── Tank drawing ──────────────────────────────────────────────────────

function drawTank(ctx: CanvasRenderingContext2D, cx: number, t: number, tank: TankState, isActive: boolean, groundY: number, terrain: number[], barrelAngle?: number) {
  const S = 0.25;
  // Slope angle: sample terrain ±13px (≈ half tank width in screen coords)
  const dy_dx = (getTerrainY(terrain, cx + 13) - getTerrainY(terrain, cx - 13)) / 26;
  const slopeAngle = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, Math.atan(dy_dx)));

  ctx.save();
  ctx.translate(cx, groundY);
  ctx.rotate(slopeAngle); // tilt tank body with slope
  ctx.scale(S, S);

  // Active glow ring
  if (isActive) {
    ctx.save();
    glow(ctx, 'rgba(251,191,36,0.7)', 22);
    ctx.strokeStyle = `rgba(251,191,36,${0.5 + Math.sin(t * 4) * 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, -18, 70, 40, 0, 0, Math.PI * 2); ctx.stroke();
    noGlow(ctx);
    ctx.restore();
  }

  // Tracks
  ctx.fillStyle = '#111827';
  ctx.beginPath(); ctx.roundRect(-52, 19, 104, 16, 8); ctx.fill();
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = '#374151';
    ctx.beginPath(); ctx.roundRect(-44 + i * 11, 20, 9, 14, 2); ctx.fill();
  }
  ctx.save();
  glow(ctx, '#22c55e', 7);
  ctx.fillStyle = 'rgba(34,197,94,0.3)';
  ctx.fillRect(-50, 19, 100, 2);
  noGlow(ctx);
  ctx.restore();

  // Hull
  const hg = ctx.createLinearGradient(0, 0, 0, 22);
  hg.addColorStop(0, '#4ade80'); hg.addColorStop(1, '#16a34a');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.roundRect(-44, 0, 88, 22, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.roundRect(-42, 1, 84, 6, 3); ctx.fill();

  // Turret
  const tg = ctx.createLinearGradient(0, -22, 0, 0);
  tg.addColorStop(0, '#86efac'); tg.addColorStop(1, '#22c55e');
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.roundRect(-23, -22, 46, 23, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.roundRect(-21, -21, 42, 6, 4); ctx.fill();

  // Barrel — angle is body-relative; no compensation (barrel follows tank tilt)
  const f = tank.facing;
  const bAngle = barrelAngle ?? Math.PI / 5;
  ctx.save();
  ctx.translate(f * 21, -14);          // barrel root
  ctx.rotate(-bAngle * f);             // elevate relative to tank body
  ctx.fillStyle = '#15803d';
  ctx.beginPath(); ctx.roundRect(f > 0 ? 0 : -38, -4, 38, 8, 4); ctx.fill();
  ctx.save();
  glow(ctx, '#4ade80', 14);
  ctx.fillStyle = '#bbf7d0';
  ctx.beginPath(); ctx.arc(f * 38, 0, 5, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
  ctx.restore();
  ctx.restore();

  // Cat head (local coords: hx=-2, hy=-50)
  const hx = -2, hy = -50;
  const headG = ctx.createRadialGradient(hx - 7, hy - 9, 0, hx, hy, 26);
  headG.addColorStop(0, '#fde68a'); headG.addColorStop(0.55, '#f97316'); headG.addColorStop(1, '#ea580c');
  ctx.fillStyle = headG;
  ctx.beginPath(); ctx.arc(hx, hy, 26, 0, Math.PI * 2); ctx.fill();

  // Ears
  ctx.fillStyle = '#f97316';
  ctx.beginPath(); ctx.moveTo(hx - 20, hy - 18); ctx.lineTo(hx - 10, hy - 40); ctx.lineTo(hx - 2, hy - 18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 20, hy - 18); ctx.lineTo(hx + 10, hy - 40); ctx.lineTo(hx + 2, hy - 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fda4af'; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(hx - 17, hy - 19); ctx.lineTo(hx - 10, hy - 33); ctx.lineTo(hx - 4, hy - 19); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 17, hy - 19); ctx.lineTo(hx + 10, hy - 33); ctx.lineTo(hx + 4, hy - 19); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  // Eyes
  [hx - 9, hx + 9].forEach(ex => {
    ctx.save();
    glow(ctx, '#06b6d4', 14);
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath(); ctx.ellipse(ex, hy - 4, 7, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.ellipse(ex, hy - 4, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex + 2, hy - 7, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // Nose & mouth
  ctx.fillStyle = '#fda4af';
  ctx.beginPath(); ctx.ellipse(hx, hy + 7, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx - 5, hy + 11); ctx.quadraticCurveTo(hx, hy + 15, hx + 5, hy + 11); ctx.stroke();

  // Helmet
  const helmG = ctx.createLinearGradient(0, hy - 34, 0, hy - 17);
  helmG.addColorStop(0, '#e2e8f0'); helmG.addColorStop(1, '#94a3b8');
  ctx.fillStyle = helmG;
  ctx.beginPath(); ctx.roundRect(hx - 22, hy - 34, 44, 17, 6); ctx.fill();
  ctx.fillStyle = 'rgba(14,165,233,0.4)';
  ctx.beginPath(); ctx.roundRect(hx - 18, hy - 32, 36, 11, 4); ctx.fill();

  // Big explosion effect indicator
  if (tank.effects.some(e => e.type === 'big_explosion')) {
    ctx.save();
    glow(ctx, 'rgba(251,191,36,0.8)', 18);
    ctx.strokeStyle = `rgba(251,191,36,${0.4 + Math.sin(t * 5) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -20, 68, 0, Math.PI * 2); ctx.stroke();
    noGlow(ctx);
    ctx.restore();
  }

  ctx.restore();
}

// ── HP bar on canvas ──────────────────────────────────────────────────

function drawTankHpBar(ctx: CanvasRenderingContext2D, cx: number, tank: TankState, groundY: number) {
  const by = groundY - 36, bw = 80;
  const bx = cx - bw / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, 7, 3.5); ctx.fill();
  const pct = tank.hp / tank.maxHp;
  if (pct > 0) {
    const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    fg.addColorStop(0, '#ef4444'); fg.addColorStop(1, '#f87171');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.roundRect(bx, by, bw * pct, 7, 3.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw * pct, 3, 3.5); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,230,230,0.9)';
  ctx.font = 'bold 9px system-ui,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`${tank.hp}/${tank.maxHp}`, cx, by - 4);
}

// ── Energy bar (above active tank) ───────────────────────────────────

function drawEnergyBar(ctx: CanvasRenderingContext2D, cx: number, energy: number, maxEnergy: number, groundY: number) {
  const by = groundY - 50, bw = 64;
  const bx = cx - bw / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, 5, 2.5); ctx.fill();
  const pct = energy / maxEnergy;
  const eg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  eg.addColorStop(0, '#fbbf24'); eg.addColorStop(1, '#f59e0b');
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.roundRect(bx, by, bw * pct, 5, 2.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,100,0.8)';
  ctx.font = '8px system-ui,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`⚡ ${(energy / maxEnergy * 100).toFixed(1)}`, cx, by - 3);
}

// ── Power meter (above active tank when charging) ─────────────────────

function drawPowerMeter(ctx: CanvasRenderingContext2D, cx: number, powerValue: number, groundY: number) {
  const by = groundY - 66, bw = 80;
  const bx = cx - bw / 2;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath(); ctx.roundRect(bx - 4, by - 14, bw + 8, 20, 4); ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, 8, 4); ctx.fill();

  // Color gradient based on power
  const r = Math.round(255 * powerValue);
  const g = Math.round(255 * (1 - powerValue * 0.7));
  const col = `rgb(${r},${g},0)`;
  ctx.save();
  glow(ctx, col, 14);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.roundRect(bx, by, bw * powerValue, 8, 4); ctx.fill();
  noGlow(ctx);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`POWER  ${Math.round(powerValue * 100)}%`, cx, by - 2);
}

// ── Trajectory guide (shown during charging phase) ────────────────────

const GUIDE_DOTS     = 10;
const GUIDE_SIM_SECS = 0.18; // very short — direction indicator only
const GUIDE_SPEED    = 350;  // fixed display speed, independent of power

function drawChargingGuide(
  ctx: CanvasRenderingContext2D,
  tank: TankState,
  _power: number,
  angle: number,
  terrain: number[],
) {
  const f        = tank.facing;
  const groundY  = getTerrainY(terrain, tank.x);
  const dy_dx    = (getTerrainY(terrain, tank.x + 13) - getTerrainY(terrain, tank.x - 13)) / 26;
  const slopeAng = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, Math.atan(dy_dx)));
  const worldAngle = angle - slopeAng * f; // body-relative → world angle
  const bx = tank.x + f * (BARREL_ROOT_LOCAL + BARREL_LEN_LOCAL * Math.cos(worldAngle)) * TANK_SCALE;
  const by = groundY - (14 + BARREL_LEN_LOCAL * Math.sin(worldAngle)) * TANK_SCALE;
  const vx = GUIDE_SPEED * Math.cos(worldAngle) * f;
  const vy = -GUIDE_SPEED * Math.sin(worldAngle);

  ctx.save();
  for (let i = 0; i < GUIDE_DOTS; i++) {
    const simT = (i / (GUIDE_DOTS - 1)) * GUIDE_SIM_SECS;
    const px = bx + vx * simT;
    const py = by + vy * simT + 0.5 * GRAVITY * simT * simT;
    if (py > getTerrainY(terrain, px) || px < 0 || px > W) break;

    const alpha = 0.85 * (1 - i / GUIDE_DOTS);
    const r     = Math.max(0.7, 3 - i * 0.1);
    ctx.save();
    glow(ctx, `rgba(6,182,212,${alpha * 0.6})`, 7);
    ctx.fillStyle = `rgba(165,243,252,${alpha})`;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.restore();
  }
  ctx.restore();
}

// ── Projectile ────────────────────────────────────────────────────────

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, _t: number) {
  ctx.save();
  ctx.fillStyle = '#1c1917';
  ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(p.x - 1.5, p.y - 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── Explosion ─────────────────────────────────────────────────────────

interface Explosion { x: number; y: number; age: number }

function drawExplosion(ctx: CanvasRenderingContext2D, ex: Explosion) {
  const f    = 1 - ex.age;
  const size = ex.age * 68;

  ctx.save();
  ctx.translate(ex.x, ex.y);
  ctx.rotate(ex.age * 1.8);

  // Outer spiky burst
  starPath(ctx, 0, 0, size, size * 0.44, 9);
  ctx.fillStyle = `rgba(251,191,36,${f * 0.95})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(28,8,0,${f * 0.85})`;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner white flash
  starPath(ctx, 0, 0, size * 0.5, size * 0.22, 9);
  ctx.fillStyle = `rgba(255,250,220,${f})`;
  ctx.fill();

  ctx.restore();
}

// ── HTML UI builders ──────────────────────────────────────────────────

function buildTopBar(container: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.id = 'bt-topbar';
  el.innerHTML = `
    <div class="bt-player bt-player--left" id="bt-p1-info">
      <span class="bt-p-name" id="bt-p1-name">P1</span>
      <div class="bt-hp-wrap"><div class="bt-hp-fill" id="bt-p1-hp" style="width:100%"></div></div>
      <span class="bt-hp-text" id="bt-p1-hp-txt">100/100</span>
    </div>
    <div class="bt-turn-block">
      <div class="bt-turn-label" id="bt-turn-label">TURN 1</div>
      <div class="bt-phase-label" id="bt-phase-label">バトルスタート！</div>
    </div>
    <div class="bt-player bt-player--right" id="bt-p2-info">
      <span class="bt-hp-text" id="bt-p2-hp-txt">100/100</span>
      <div class="bt-hp-wrap"><div class="bt-hp-fill" id="bt-p2-hp" style="width:100%"></div></div>
      <span class="bt-p-name" id="bt-p2-name">P2</span>
    </div>
  `;
  container.appendChild(el);
  return el;
}

function buildBottomBar(container: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.id = 'bt-bottom';
  el.innerHTML = `
    <!-- pre_shot panel -->
    <div id="bt-panel-normal" class="bt-panel">
      <div class="bt-energy-row">
        <span class="bt-energy-icon">⚡</span>
        <div class="bt-energy-track"><div class="bt-energy-bar" id="bt-energy-bar" style="width:100%"></div></div>
        <span class="bt-energy-txt" id="bt-energy-txt">100</span>
      </div>
      <div class="bt-action-row">
        <button class="bt-btn bt-btn--move" id="bt-left">◀ 左移動</button>
        <button class="bt-btn bt-btn--move" id="bt-right">右移動 ▶</button>
        <button class="bt-btn bt-btn--face" id="bt-face">↩ 向き変更</button>
        <button class="bt-btn bt-btn--shoot" id="bt-shoot">🎯 砲撃</button>
        <div class="bt-skills-row" id="bt-skills"></div>
        <button class="bt-btn bt-btn--end" id="bt-end-turn">ターン終了</button>
      </div>
    </div>
    <!-- charging panel -->
    <div id="bt-panel-charge" class="bt-panel" style="display:none">
      <div class="bt-charge-controls">
        <div class="bt-power-row">
          <span class="bt-power-lbl">POWER</span>
          <div class="bt-power-track">
            <div class="bt-power-fill" id="bt-power-fill" style="width:0%"></div>
            <span class="bt-power-pct" id="bt-power-pct">0%</span>
          </div>
        </div>
        <div class="bt-angle-row">
          <button class="bt-btn bt-btn--angle" id="bt-angle-up">▲</button>
          <span class="bt-angle-val" id="bt-angle-val">45°</span>
          <button class="bt-btn bt-btn--angle" id="bt-angle-down">▼</button>
        </div>
      </div>
      <div class="bt-action-row bt-action-row--center">
        <button class="bt-btn bt-btn--cancel" id="bt-cancel">✕ キャンセル</button>
        <button class="bt-btn bt-btn--fire" id="bt-fire">💥 発射！</button>
      </div>
    </div>
    <!-- post_shot / waiting panel -->
    <div id="bt-panel-post" class="bt-panel" style="display:none">
      <span class="bt-wait-msg" id="bt-wait-msg">ターンを終了してください</span>
      <button class="bt-btn bt-btn--end bt-btn--big" id="bt-end-turn2">ターン終了 ▶</button>
    </div>
    <!-- waiting panel -->
    <div id="bt-panel-wait" class="bt-panel" style="display:none">
      <span class="bt-wait-msg">相手のターン中...</span>
    </div>
  `;
  container.appendChild(el);
  return el;
}

// ── UI update ─────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  pre_shot:  '移動・スキル・砲撃',
  charging:  'パワーをためろ！',
  animating: '飛翔中...',
  post_shot: 'ターン終了へ',
  waiting:   '相手のターン',
  game_over: 'ゲーム終了',
};

function updateUI(
  state: BattleState,
  myPlayerId: string,
  powerValue: number,
  isMyTurn: boolean,
  selectedCards: number[],
  onToggleSkill: (i: number) => void,
) {
  const [p1id, p2id] = state.playerOrder;
  const p1 = state.tanks[p1id], p2 = state.tanks[p2id];

  // Top bar
  const set = (id: string, v: string) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const setW = (id: string, w: string) => { const el = document.getElementById(id) as HTMLElement | null; if (el) el.style.width = w; };

  set('bt-p1-name', p1.name);
  set('bt-p2-name', p2.name);
  set('bt-p1-hp-txt', `${p1.hp}/${p1.maxHp}`);
  set('bt-p2-hp-txt', `${p2.hp}/${p2.maxHp}`);
  setW('bt-p1-hp', `${p1.hp / p1.maxHp * 100}%`);
  setW('bt-p2-hp', `${p2.hp / p2.maxHp * 100}%`);
  set('bt-turn-label', `TURN ${state.turn}`);
  set('bt-phase-label', PHASE_LABEL[state.phase] ?? state.phase);

  // Highlight active player
  document.getElementById('bt-p1-info')?.classList.toggle('bt-player--active', state.activeIdx === 0);
  document.getElementById('bt-p2-info')?.classList.toggle('bt-player--active', state.activeIdx === 1);

  // Bottom panels
  const showPanel = (id: string) => {
    ['bt-panel-normal','bt-panel-charge','bt-panel-post','bt-panel-wait']
      .forEach(p => { const el = document.getElementById(p); if (el) el.style.display = p === id ? 'flex' : 'none'; });
  };

  if (!isMyTurn || state.phase === 'animating') {
    showPanel('bt-panel-wait');
    return;
  }

  if (state.phase === 'game_over') {
    showPanel('bt-panel-wait');
    set('bt-wait-msg', state.winner === myPlayerId ? '🎉 あなたの勝利！' : '💀 敗北...');
    return;
  }

  const myTank = state.tanks[myPlayerId];
  if (!myTank) return;

  if (state.phase === 'pre_shot') {
    showPanel('bt-panel-normal');
    // Energy bar
    setW('bt-energy-bar', `${myTank.energy / myTank.maxEnergy * 100}%`);
    set('bt-energy-txt', `${(myTank.energy / myTank.maxEnergy * 100).toFixed(1)}/100`);
    // Disable move buttons if no energy
    const canMove = myTank.energy > 0.5;
    (document.getElementById('bt-left')  as HTMLButtonElement).disabled = !canMove;
    (document.getElementById('bt-right') as HTMLButtonElement).disabled = !canMove;
    // Skills
    renderSkills(myTank.hand, selectedCards, onToggleSkill);
  } else if (state.phase === 'charging') {
    showPanel('bt-panel-charge');
    const pct = Math.round(powerValue * 100);
    setW('bt-power-fill', `${pct}%`);
    set('bt-power-pct', `${pct}%`);
    // Color the power fill
    const r = Math.round(255 * powerValue);
    const g = Math.round(255 * (1 - powerValue * 0.7));
    const fill = document.getElementById('bt-power-fill') as HTMLElement | null;
    if (fill) fill.style.background = `rgb(${r},${g},0)`;
  } else if (state.phase === 'post_shot') {
    showPanel('bt-panel-post');
  }
}

function renderSkills(hand: string[], selected: number[], onToggle: (i: number) => void) {
  const row = document.getElementById('bt-skills');
  if (!row) return;
  row.innerHTML = hand.map((sid, idx) => {
    const def = SKILL_DEFS[sid as keyof typeof SKILL_DEFS];
    if (!def) return '';
    const active = selected.includes(idx);
    return `<button class="bt-skill-card${active ? ' bt-skill-card--active' : ''}" data-idx="${idx}" title="${def.description}">
        <span class="bt-skill-emoji">${def.emoji}</span>
        <span class="bt-skill-name">${def.nameJa}</span>
      </button>`;
  }).join('');
  row.querySelectorAll<HTMLElement>('.bt-skill-card').forEach(btn => {
    btn.addEventListener('click', () => onToggle(Number(btn.dataset.idx)));
  });
}

// ── Game over overlay ─────────────────────────────────────────────────

function showGameOver(container: HTMLElement, won: boolean, onBack: () => void): void {
  const el = document.createElement('div');
  el.id = 'bt-gameover';
  el.innerHTML = `
    <div class="bt-go-title">${won ? '🎉 VICTORY!' : '💀 DEFEAT'}</div>
    <div class="bt-go-sub">${won ? 'あなたの勝利！' : '相手の勝利...'}</div>
    <button class="bt-go-btn" id="bt-go-btn">タイトルへ戻る</button>
  `;
  container.appendChild(el);
  (el.querySelector('#bt-go-btn') as HTMLButtonElement).onclick = onBack;
}

// ── Scene entry ───────────────────────────────────────────────────────

export function createBattleScene(
  container: HTMLElement,
  info: GameStartInfo,
  onEnd: () => void,
): () => void {
  // Canvas
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  buildTopBar(container);
  buildBottomBar(container);

  // Game state
  let state: BattleState = createInitialState(info);
  info.fighters.findIndex(f => f.id === info.myPlayerId);
  const ANGLE_DEFAULT = Math.PI / 4;      // 45°
  const ANGLE_MIN     = Math.PI / 12;     // 15°
  const ANGLE_MAX     = Math.PI * 5 / 12; // 75°

  const ANGLE_RATE = Math.PI / 3; // radians/s for continuous adjustment (60°/s)

  let powerVal      = 0;
  let barrelAngle   = ANGLE_DEFAULT;
  let selectedCards: number[] = [];
  let movingDir: 'left' | 'right' | null = null;
  let lastMoveSend = 0;
  let angleDir: 'up' | 'down' | null = null;
  let t         = 0, lastTime = 0, rafId = 0;
  const explosions: Explosion[] = [];

  // Game channel
  const channel = new GameChannel(info.roomCode, info.myPlayerId);

  const hasCpu = info.fighters.length < 2;

  function isMyTurn(): boolean {
    return state.playerOrder[state.activeIdx] === info.myPlayerId;
  }

  // CPU auto-end-turn: when CPU's turn starts, wait 1.5s then end it
  let cpuTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleCpuTurn() {
    if (!hasCpu) return;
    const activePlayer = state.playerOrder[state.activeIdx];
    if (activePlayer !== CPU_PLAYER_ID) return;
    if (cpuTimer) clearTimeout(cpuTimer);
    cpuTimer = setTimeout(() => {
      if (state.playerOrder[state.activeIdx] === CPU_PLAYER_ID && state.phase === 'pre_shot') {
        state = applyEndTurn(state);
      }
      cpuTimer = null;
    }, 1500);
  }

  // ── Receive events from opponent ──────────────────────────────────
  channel.onEvent(evt => {
    if (evt.type === 'MOVE') {
      const oppId = opponentId(state);
      state = { ...state, tanks: { ...state.tanks, [oppId]: { ...state.tanks[oppId], x: evt.newX, energy: evt.newEnergy } } };
    } else if (evt.type === 'FIRE') {
      state = { ...state, projectiles: evt.projectiles, phase: 'animating' };
    } else if (evt.type === 'USE_SKILL') {
      state = evt.resultState;
    } else if (evt.type === 'END_TURN') {
      state = evt.resultState;
    } else if (evt.type === 'SYNC') {
      state = evt.state;
    }
  });

  // ── Action handlers ───────────────────────────────────────────────
  function onFacingChange() {
    if (!isMyTurn() || state.phase !== 'pre_shot') return;
    state = applyFacingChange(state);
    channel.send({ type: 'SYNC', state });
  }

  function onShoot() {
    if (!isMyTurn() || state.phase !== 'pre_shot') return;
    // Apply selected skill cards before entering charging phase
    for (const idx of [...selectedCards].sort((a, b) => b - a)) {
      const next = applyUseSkill(state, idx);
      if (!next) continue;
      channel.send({ type: 'USE_SKILL', handIdx: idx, resultState: next });
      state = next;
    }
    selectedCards = [];
    state = { ...state, phase: 'charging' };
  }

  function updateAngleDisplay() {
    const el = document.getElementById('bt-angle-val');
    if (el) el.textContent = `${Math.round(barrelAngle * 180 / Math.PI)}°`;
  }

  function startAngle(dir: 'up' | 'down') {
    if (!isMyTurn() || state.phase !== 'charging') return;
    angleDir = dir;
  }
  function stopAngle() { angleDir = null; }

  function onFire() {
    if (!isMyTurn() || state.phase !== 'charging') return;
    const next = applyFire(state, powerVal, barrelAngle);
    if (next.projectiles.length === 0) return;
    channel.send({ type: 'FIRE', projectiles: next.projectiles });
    state = next;
  }

  function onCancel() {
    if (!isMyTurn() || state.phase !== 'charging') return;
    state = { ...state, phase: 'pre_shot' };
  }


  function onEndTurn() {
    if (!isMyTurn() || (state.phase !== 'pre_shot' && state.phase !== 'post_shot')) return;
    selectedCards = [];
    const next = applyEndTurn(state);
    channel.send({ type: 'END_TURN', resultState: next });
    state = next;
    scheduleCpuTurn();
  }

  // Move buttons: hold to move continuously
  function startMove(dir: 'left' | 'right') {
    if (!isMyTurn() || state.phase !== 'pre_shot') return;
    movingDir = dir;
    lastMoveSend = 0;
  }
  function stopMove() {
    if (!movingDir) return;
    // Sync final position on release
    const tank = state.tanks[info.myPlayerId];
    if (tank) channel.send({ type: 'MOVE', newX: tank.x, newEnergy: tank.energy });
    movingDir = null;
  }

  const leftBtn  = document.getElementById('bt-left');
  const rightBtn = document.getElementById('bt-right');
  leftBtn?.addEventListener('pointerdown',  (e) => { e.preventDefault(); startMove('left'); });
  rightBtn?.addEventListener('pointerdown', (e) => { e.preventDefault(); startMove('right'); });
  // Release anywhere stops movement
  document.addEventListener('pointerup',     stopMove);
  document.addEventListener('pointercancel', stopMove);
  document.addEventListener('pointerup',     stopAngle);
  document.addEventListener('pointercancel', stopAngle);

  document.getElementById('bt-face')?.addEventListener('click', onFacingChange);
  document.getElementById('bt-shoot')?.addEventListener('click', onShoot);
  document.getElementById('bt-angle-up')?.addEventListener('pointerdown',   (e) => { e.preventDefault(); startAngle('up'); });
  document.getElementById('bt-angle-down')?.addEventListener('pointerdown', (e) => { e.preventDefault(); startAngle('down'); });
  document.getElementById('bt-fire')?.addEventListener('click', onFire);
  document.getElementById('bt-cancel')?.addEventListener('click', onCancel);
  document.getElementById('bt-end-turn')?.addEventListener('click', onEndTurn);
  document.getElementById('bt-end-turn2')?.addEventListener('click', onEndTurn);

  function toggleSkill(idx: number) {
    if (!isMyTurn() || state.phase !== 'pre_shot') return;
    const pos = selectedCards.indexOf(idx);
    if (pos >= 0) selectedCards.splice(pos, 1);
    else selectedCards.push(idx);
    // no cache to invalidate — renderSkills re-renders every frame
  }

  // ── Game loop ─────────────────────────────────────────────────────
  let gameOverShown = false;

  function frame(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    t += dt;

    // Power meter oscillation (local, 0.8 Hz)
    if (state.phase === 'charging' && isMyTurn()) {
      powerVal = (Math.sin(t * Math.PI * 1.6) + 1) / 2;
    }

    // Continuous angle adjustment while button held
    if (angleDir && isMyTurn() && state.phase === 'charging') {
      const delta = (angleDir === 'up' ? 1 : -1) * ANGLE_RATE * dt;
      barrelAngle = Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, barrelAngle + delta));
      updateAngleDisplay();
    }

    // Continuous movement while button held
    if (movingDir && isMyTurn() && state.phase === 'pre_shot') {
      const next = applyMoveContinuous(state, movingDir, dt);
      if (next) {
        state = next;
        // Throttle: sync position every 50 ms
        if (now - lastMoveSend >= 50) {
          const tank = state.tanks[info.myPlayerId];
          channel.send({ type: 'MOVE', newX: tank.x, newEnergy: tank.energy });
          lastMoveSend = now;
        }
      } else {
        // Energy ran out — stop and sync final position
        const tank = state.tanks[info.myPlayerId];
        channel.send({ type: 'MOVE', newX: tank.x, newEnergy: tank.energy });
        movingDir = null;
      }
    }

    // Projectile physics
    if (state.phase === 'animating' && state.projectiles.length > 0) {
      const { state: next, hit, newExplosions } = tickProjectile(state, dt);
      if (hit) {
        state = applyDamage(next, hit);
      } else {
        state = next;
      }
      newExplosions.forEach(e => explosions.push({ x: e.x, y: e.y, age: 0 }));
    }

    // Tick explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].age += dt * 1.2;
      if (explosions[i].age >= 1) explosions.splice(i, 1);
    }

    // Draw
    ctx.clearRect(0, 0, W, H);
    drawBg(ctx, t);
    drawTerrain(ctx, state.terrain);

    const [p1id, p2id] = state.playerOrder;
    const p1 = state.tanks[p1id], p2 = state.tanks[p2id];
    const p1gy = getTerrainY(state.terrain, p1.x);
    const p2gy = getTerrainY(state.terrain, p2.x);
    const myAngle = isMyTurn() && state.phase === 'charging' ? barrelAngle : undefined;
    drawTank(ctx, p1.x, t, p1, state.activeIdx === 0, p1gy, state.terrain, info.myPlayerId === p1id ? myAngle : undefined);
    drawTank(ctx, p2.x, t, p2, state.activeIdx === 1, p2gy, state.terrain, info.myPlayerId === p2id ? myAngle : undefined);
    drawTankHpBar(ctx, p1.x, p1, p1gy);
    drawTankHpBar(ctx, p2.x, p2, p2gy);

    // Energy / power above active tank (only for local player when it's their turn)
    if (isMyTurn()) {
      const myTank = state.tanks[info.myPlayerId];
      if (myTank) {
        const myGY = getTerrainY(state.terrain, myTank.x);
        if (state.phase === 'pre_shot') {
          drawEnergyBar(ctx, myTank.x, myTank.energy, myTank.maxEnergy, myGY);
        } else if (state.phase === 'charging') {
          drawEnergyBar(ctx, myTank.x, myTank.energy, myTank.maxEnergy, myGY);
          drawPowerMeter(ctx, myTank.x, powerVal, myGY);
          drawChargingGuide(ctx, myTank, powerVal, barrelAngle, state.terrain);
        }
      }
    }

    state.projectiles.forEach(p => drawProjectile(ctx, p, t));
    explosions.forEach(e => drawExplosion(ctx, e));

    updateUI(state, info.myPlayerId, powerVal, isMyTurn(), selectedCards, toggleSkill);

    // Game over
    if (state.phase === 'game_over' && !gameOverShown) {
      gameOverShown = true;
      setTimeout(() => showGameOver(container, state.winner === info.myPlayerId, onEnd), 800);
    }

    rafId = requestAnimationFrame(frame);
  }

  lastTime = performance.now();
  rafId = requestAnimationFrame(frame);

  // Kick off CPU turn if game starts on CPU's turn (shouldn't happen, but safety)
  scheduleCpuTurn();

  return () => {
    cancelAnimationFrame(rafId);
    if (cpuTimer) clearTimeout(cpuTimer);
    document.removeEventListener('pointerup',     stopMove);
    document.removeEventListener('pointercancel', stopMove);
    document.removeEventListener('pointerup',     stopAngle);
    document.removeEventListener('pointercancel', stopAngle);
    channel.destroy();
    canvas.remove();
    document.getElementById('bt-topbar')?.remove();
    document.getElementById('bt-bottom')?.remove();
    document.getElementById('bt-gameover')?.remove();
  };
}
