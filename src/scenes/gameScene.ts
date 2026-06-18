import type { GameState } from "../types";
import { createInitialState, playCard, endTurn } from "../cards/gameLogic";
import { CARD_DEFS } from "../cards/cardDefs";

interface Star { x: number; y: number; r: number; phase: number; speed: number }
interface Ruin { x: number; w: number; h: number }

const CARD_EMOJI: Record<string, string> = { attack: "🐾", defense: "🔮", utility: "✨" };

// ── Canvas helpers ──────────────────────────────────────────────────

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color; ctx.shadowBlur = blur;
}
function noGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
}

// ── Background ──────────────────────────────────────────────────────

function drawBg(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  GROUND_Y: number, t: number, stars: Star[], ruins: Ruin[], scrollX: number,
) {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0,    '#070012');
  sky.addColorStop(0.28, '#1a0533');
  sky.addColorStop(0.55, '#6b21a8');
  sky.addColorStop(0.78, '#be185d');
  sky.addColorStop(0.92, '#f97316');
  sky.addColorStop(1,    '#fde68a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // Stars
  for (const s of stars) {
    const b = 0.5 + Math.sin(t * s.speed + s.phase) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.25 + b * 0.75;
    ctx.fillStyle = `hsl(240,50%,${Math.floor(76 + b * 24)}%)`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (0.7 + b * 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Moon
  const mx = W * 0.84, my = GROUND_Y * 0.2;
  ctx.save();
  glow(ctx, 'rgba(253,230,138,0.45)', 28);
  ctx.fillStyle = 'rgba(253,230,138,0.06)';
  ctx.beginPath(); ctx.arc(mx, my, 46, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
  const mg = ctx.createRadialGradient(mx - 4, my - 7, 0, mx, my, 29);
  mg.addColorStop(0, '#fffbeb'); mg.addColorStop(0.6, '#fef3c7'); mg.addColorStop(1, '#fde68a');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(mx, my, 29, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(mx - 9, my - 5,  4.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 11, my + 8,  3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 3,  my - 12, 3,   0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Ruin silhouettes
  ctx.fillStyle = 'rgba(10,4,26,0.82)';
  for (const r of ruins) {
    const rx = ((r.x - scrollX * 0.4) % (W + 120) + W + 120) % (W + 120) - 60;
    const ry = GROUND_Y - r.h;
    ctx.beginPath();
    ctx.roundRect(rx, ry, r.w, r.h + 2, [3, 3, 0, 0]);
    ctx.fill();
  }

  // Ground fill
  const gg = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  gg.addColorStop(0, '#1c1040'); gg.addColorStop(1, '#08061a');
  ctx.fillStyle = gg;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Horizon line with pink glow
  ctx.save();
  glow(ctx, '#ec4899', 10);
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(0, GROUND_Y - 1, W, 2);
  noGlow(ctx);
  ctx.fillStyle = 'rgba(236,72,153,0.22)';
  ctx.fillRect(0, GROUND_Y - 7, W, 7);
  ctx.restore();

  // Perspective grid
  ctx.save();
  ctx.strokeStyle = 'rgba(168,85,247,0.18)';
  ctx.lineWidth = 1;
  const vpx = W / 2;
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath(); ctx.moveTo(vpx + i * 6, GROUND_Y); ctx.lineTo(vpx + i * 75, H); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(236,72,153,0.15)';
  for (let row = 1; row <= 7; row++) {
    const f = (row / 7) ** 1.7;
    const ly = GROUND_Y + f * (H - GROUND_Y);
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
  }
  ctx.restore();
}

// ── Cat tank ────────────────────────────────────────────────────────

function drawCatTank(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, hasShield: boolean) {
  ctx.save();

  // === TRACKS ===
  ctx.fillStyle = '#111827';
  ctx.beginPath(); ctx.roundRect(cx - 52, cy + 19, 104, 16, 8); ctx.fill();
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = '#374151';
    ctx.beginPath(); ctx.roundRect(cx - 44 + i * 11, cy + 20, 9, 14, 2); ctx.fill();
  }
  // track glow
  ctx.save();
  glow(ctx, '#22c55e', 7);
  ctx.fillStyle = 'rgba(34,197,94,0.3)';
  ctx.fillRect(cx - 50, cy + 19, 100, 2);
  noGlow(ctx);
  ctx.restore();

  // === HULL ===
  const hullG = ctx.createLinearGradient(0, cy, 0, cy + 22);
  hullG.addColorStop(0, '#4ade80'); hullG.addColorStop(1, '#16a34a');
  ctx.fillStyle = hullG;
  ctx.beginPath(); ctx.roundRect(cx - 44, cy, 88, 22, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.roundRect(cx - 42, cy + 1, 84, 6, 3); ctx.fill();
  ctx.fillStyle = '#15803d';
  ctx.beginPath(); ctx.roundRect(cx - 28, cy + 9, 18, 8, 2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx + 6, cy + 9, 18, 8, 2); ctx.fill();

  // === TURRET ===
  const turrG = ctx.createLinearGradient(0, cy - 22, 0, cy);
  turrG.addColorStop(0, '#86efac'); turrG.addColorStop(1, '#22c55e');
  ctx.fillStyle = turrG;
  ctx.beginPath(); ctx.roundRect(cx - 23, cy - 22, 46, 23, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.roundRect(cx - 21, cy - 21, 42, 6, 4); ctx.fill();

  // === BARREL ===
  ctx.fillStyle = '#15803d';
  ctx.beginPath(); ctx.roundRect(cx + 21, cy - 14, 38, 8, 4); ctx.fill();
  ctx.save();
  glow(ctx, '#4ade80', 14);
  ctx.fillStyle = '#bbf7d0';
  ctx.beginPath(); ctx.arc(cx + 59, cy - 10, 5, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
  ctx.restore();

  // === CAT HEAD ===
  const hx = cx - 2, hy = cy - 50;
  const headR = 26;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(hx + 3, hy + 5, headR, headR * 0.65, 0, 0, Math.PI * 2); ctx.fill();

  // Head gradient
  const headG = ctx.createRadialGradient(hx - 7, hy - 9, 0, hx, hy, headR);
  headG.addColorStop(0, '#fde68a');
  headG.addColorStop(0.55, '#f97316');
  headG.addColorStop(1, '#ea580c');
  ctx.fillStyle = headG;
  ctx.beginPath(); ctx.arc(hx, hy, headR, 0, Math.PI * 2); ctx.fill();

  // Ears
  ctx.fillStyle = '#f97316';
  ctx.beginPath(); ctx.moveTo(hx - 20, hy - 18); ctx.lineTo(hx - 10, hy - 40); ctx.lineTo(hx - 2, hy - 18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 20, hy - 18); ctx.lineTo(hx + 10, hy - 40); ctx.lineTo(hx + 2, hy - 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fda4af';
  ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(hx - 17, hy - 19); ctx.lineTo(hx - 10, hy - 33); ctx.lineTo(hx - 4, hy - 19); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 17, hy - 19); ctx.lineTo(hx + 10, hy - 33); ctx.lineTo(hx + 4, hy - 19); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  // Eyes (large, glowing cyan)
  const eyeY = hy - 4;
  const drawEye = (ex: number) => {
    ctx.save();
    glow(ctx, '#06b6d4', 14);
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath(); ctx.ellipse(ex, eyeY, 7, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.ellipse(ex, eyeY, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex + 2, eyeY - 3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  drawEye(hx - 9); drawEye(hx + 9);

  // Nose
  ctx.fillStyle = '#fda4af';
  ctx.beginPath(); ctx.ellipse(hx, hy + 7, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();

  // Mouth
  ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx - 5, hy + 11); ctx.quadraticCurveTo(hx, hy + 15, hx + 5, hy + 11); ctx.stroke();

  // Whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(hx - 27, hy + 4); ctx.lineTo(hx - 8, hy + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx - 27, hy + 9); ctx.lineTo(hx - 8, hy + 9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 27, hy + 4); ctx.lineTo(hx + 8, hy + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx + 27, hy + 9); ctx.lineTo(hx + 8, hy + 9); ctx.stroke();

  // Pilot helmet
  const helmG = ctx.createLinearGradient(0, hy - 34, 0, hy - 18);
  helmG.addColorStop(0, '#e2e8f0'); helmG.addColorStop(1, '#94a3b8');
  ctx.fillStyle = helmG;
  ctx.beginPath(); ctx.roundRect(hx - 22, hy - 34, 44, 17, 6); ctx.fill();
  ctx.fillStyle = 'rgba(14,165,233,0.4)';
  ctx.beginPath(); ctx.roundRect(hx - 18, hy - 32, 36, 11, 4); ctx.fill();

  // Shield effect
  if (hasShield) {
    const sp = 0.6 + Math.sin(t * 5) * 0.4;
    ctx.save();
    glow(ctx, 'rgba(56,189,248,0.9)', 20);
    ctx.strokeStyle = `rgba(56,189,248,${sp * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy - 20, 60, 0, Math.PI * 2); ctx.stroke();
    noGlow(ctx);
    ctx.fillStyle = `rgba(56,189,248,${sp * 0.06})`;
    ctx.beginPath(); ctx.arc(cx, cy - 20, 60, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ── Enemy ────────────────────────────────────────────────────────────

function drawEnemy(ctx: CanvasRenderingContext2D, ex: number, ey: number, type: string, t: number, idx: number) {
  const isBoss = type === 'boss', isTank = type === 'tank';
  const s = isBoss ? 1.45 : isTank ? 1.2 : 1;
  ctx.save();

  // Tracks
  ctx.fillStyle = '#1f2937';
  ctx.beginPath(); ctx.roundRect(ex - 38 * s, ey + 18 * s, 76 * s, 13 * s, 6 * s); ctx.fill();
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = '#374151';
    ctx.beginPath(); ctx.roundRect(ex - 32 * s + i * 10 * s, ey + 19 * s, 8 * s, 11 * s, 2); ctx.fill();
  }
  ctx.save();
  glow(ctx, '#ef4444', 6);
  ctx.fillStyle = 'rgba(239,68,68,0.3)';
  ctx.fillRect(ex - 36 * s, ey + 18 * s, 72 * s, 2);
  noGlow(ctx);
  ctx.restore();

  // Hull
  const hullCol = isBoss ? ['#dc2626','#7f1d1d'] : isTank ? ['#7e22ce','#4c1d95'] : ['#dc2626','#991b1b'];
  const hg = ctx.createLinearGradient(0, ey, 0, ey + 20 * s);
  hg.addColorStop(0, hullCol[0]); hg.addColorStop(1, hullCol[1]);
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.roundRect(ex - 36 * s, ey, 72 * s, 20 * s, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath(); ctx.roundRect(ex - 34 * s, ey + 1, 68 * s, 5 * s, 2); ctx.fill();

  // Turret
  ctx.fillStyle = hullCol[1];
  ctx.beginPath(); ctx.roundRect(ex - 20 * s, ey - 18 * s, 40 * s, 19 * s, 4); ctx.fill();

  // Barrel (pointing left)
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.roundRect(ex - 44 * s, ey - 13 * s, 24 * s, 8 * s, 3); ctx.fill();
  ctx.save();
  glow(ctx, '#ef4444', 12);
  ctx.fillStyle = '#fca5a5';
  ctx.beginPath(); ctx.arc(ex - 44 * s, ey - 9 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
  ctx.restore();

  // Skull head
  const sx = ex, sy = ey - 18 * s - 17 * s;
  const sr = 16 * s;

  if (isBoss) {
    ctx.save();
    glow(ctx, 'rgba(239,68,68,0.8)', 22);
    ctx.fillStyle = `rgba(239,68,68,${0.07 + Math.sin(t * 3.5 + idx) * 0.04})`;
    ctx.beginPath(); ctx.arc(sx, sy, sr + 12, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.restore();
  }

  const skg = ctx.createRadialGradient(sx - 3, sy - 4, 0, sx, sy, sr);
  skg.addColorStop(0, '#f9fafb'); skg.addColorStop(0.7, '#e5e7eb'); skg.addColorStop(1, '#d1d5db');
  ctx.fillStyle = skg;
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

  // Eye sockets
  ctx.fillStyle = '#111827';
  ctx.beginPath(); ctx.ellipse(sx - 5.5 * s, sy - 3 * s, 5 * s, 5.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + 5.5 * s, sy - 3 * s, 5 * s, 5.5 * s, 0, 0, Math.PI * 2); ctx.fill();

  // Glowing eyes
  const eyeFlicker = 0.75 + Math.sin(t * 9 + idx * 2.1) * 0.25;
  const eyeGlowCol = isTank ? '#a855f7' : '#ef4444';
  const eyeCol     = isTank ? '#d8b4fe' : '#fca5a5';
  ctx.save();
  glow(ctx, eyeGlowCol, 10);
  ctx.fillStyle = eyeCol;
  ctx.globalAlpha = eyeFlicker;
  ctx.beginPath(); ctx.arc(sx - 5.5 * s, sy - 3 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + 5.5 * s, sy - 3 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = '#fef9c3'; ctx.globalAlpha = eyeFlicker * 0.7;
  ctx.beginPath(); ctx.arc(sx - 5.5 * s, sy - 3 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + 5.5 * s, sy - 3 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Nose hole
  ctx.fillStyle = '#374151';
  ctx.beginPath(); ctx.arc(sx, sy + 3.5 * s, 2 * s, 0, Math.PI * 2); ctx.fill();

  // Teeth
  ctx.fillStyle = '#f5f5f5';
  for (let ti = 0; ti < 4; ti++) {
    ctx.beginPath(); ctx.roundRect(sx - 9 * s + ti * 5 * s, sy + 8 * s, 4 * s, 7 * s, [0, 0, 2, 2]); ctx.fill();
  }
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(sx - 9 * s, sy + 8 * s, 18 * s, 3);

  // Boss extras
  if (isBoss) {
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx + 10, ey - 18 * s - 20); ctx.lineTo(sx + 10, ey - 18 * s - 40); ctx.stroke();
    ctx.save();
    glow(ctx, '#ef4444', 14);
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath(); ctx.arc(sx + 10, ey - 18 * s - 41, 5, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.restore();
  }

  ctx.restore();
}

// ── HP bar on canvas ─────────────────────────────────────────────────

function drawCanvasHpBar(ctx: CanvasRenderingContext2D, ex: number, ey: number, type: string, hp: number, maxHp: number) {
  const isBoss = type === 'boss', isTank = type === 'tank';
  const s = isBoss ? 1.45 : isTank ? 1.2 : 1;
  const bw = 68 * s;
  const barY = ey - 18 * s - 17 * s - 16 * s - 22;
  const bx = ex - bw / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.roundRect(bx, barY, bw, 7, 3.5); ctx.fill();

  const pct = Math.max(0, hp / maxHp);
  if (pct > 0) {
    const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    fg.addColorStop(0, '#ef4444'); fg.addColorStop(1, '#f87171');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.roundRect(bx, barY, bw * pct, 7, 3.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.roundRect(bx, barY, bw * pct, 3, 3.5); ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,200,200,0.85)';
  ctx.font = `bold 9px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${hp}`, ex, barY - 4);
}

// ── HTML UI builders ─────────────────────────────────────────────────

function buildHud(container: HTMLElement): HTMLElement {
  const hud = document.createElement('div');
  hud.id = 'nyan-hud';
  hud.innerHTML = `
    <div class="nyan-stat">
      <span class="nyan-stat-label">HP</span>
      <div class="nyan-bar-wrap"><div id="hp-fill" class="nyan-bar-fill hp-fill" style="width:100%"></div></div>
      <span class="nyan-stat-value" id="hp-val">100/100</span>
    </div>
    <div class="nyan-stat">
      <span class="nyan-stat-label">MP</span>
      <div class="nyan-bar-wrap"><div id="mp-fill" class="nyan-bar-fill mp-fill" style="width:100%"></div></div>
      <span class="nyan-stat-value" id="mp-val">3/3</span>
    </div>
    <div class="nyan-divider"></div>
    <div id="nyan-effects" class="nyan-effects"></div>
    <div class="nyan-turn-block">
      <div class="nyan-turn-num" id="turn-num">1</div>
      <div class="nyan-turn-lbl">TURN</div>
    </div>
    <div class="nyan-divider"></div>
    <div class="nyan-score-block">
      <div class="nyan-score-num" id="score-num">0</div>
      <div class="nyan-score-lbl">SCORE</div>
    </div>
    <button id="nyan-end-turn">ターン終了</button>
  `;
  container.appendChild(hud);
  return hud;
}

function buildCardArea(container: HTMLElement): HTMLElement {
  const area = document.createElement('div');
  area.id = 'nyan-card-area';
  area.innerHTML = `
    <div class="nyan-ca-header" id="nyan-ca-info">手札 0枚 / デッキ 0枚</div>
    <div class="nyan-cards-row" id="nyan-cards-row"></div>
  `;
  container.appendChild(area);
  return area;
}

function buildFlash(container: HTMLElement): HTMLElement {
  const flash = document.createElement('div');
  flash.id = 'nyan-flash';
  container.appendChild(flash);
  return flash;
}

function updateHud(state: GameState): void {
  const hp = document.getElementById('hp-fill');
  const mp = document.getElementById('mp-fill');
  const hv = document.getElementById('hp-val');
  const mv = document.getElementById('mp-val');
  const tn = document.getElementById('turn-num');
  const sc = document.getElementById('score-num');
  const fx = document.getElementById('nyan-effects');
  if (hp) hp.style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
  if (mp) mp.style.width = `${(state.player.mana / state.player.maxMana) * 100}%`;
  if (hv) hv.textContent = `${state.player.hp}/${state.player.maxHp}`;
  if (mv) mv.textContent = `${state.player.mana}/${state.player.maxMana}`;
  if (tn) tn.textContent = `${state.turn}`;
  if (sc) sc.textContent = `${state.score}`;
  if (fx) {
    fx.innerHTML = state.player.effects.map(e =>
      `<span class="nyan-chip ${e.name === 'shield' ? 'chip-shield' : 'chip-other'}">${e.name} ×${e.duration}</span>`
    ).join('');
  }
}

function renderCards(
  state: GameState,
  selectedCard: number | null,
  onCardClick: (i: number) => void,
): void {
  const row = document.getElementById('nyan-cards-row');
  const info = document.getElementById('nyan-ca-info');
  if (!row) return;
  if (info) info.textContent = `手札 ${state.hand.length}枚 / デッキ ${state.deck.length}枚 / 捨て ${state.discard.length}枚`;

  // Only re-render if count or selection changed
  const key = `${state.hand.join(',')}_${selectedCard}_${state.player.mana}`;
  if (row.dataset.key === key) return;
  row.dataset.key = key;

  row.innerHTML = '';
  for (let i = 0; i < state.hand.length; i++) {
    const cardId = state.hand[i];
    const def = CARD_DEFS[cardId];
    const canAfford = state.player.mana >= (def?.cost ?? 99);
    const isSelected = i === selectedCard;
    const type = def?.type ?? 'utility';

    const card = document.createElement('div');
    card.className = [
      'nyan-card',
      isSelected ? 'selected' : '',
      !canAfford ? 'cant-afford' : '',
    ].filter(Boolean).join(' ');

    card.innerHTML = `
      <div class="nyan-card-art ${type}">${CARD_EMOJI[type] ?? '✨'}</div>
      <div class="nyan-card-body">
        <div class="nyan-card-name">${def?.nameJa ?? cardId}</div>
        <div class="nyan-card-desc">${def?.description ?? ''}</div>
      </div>
      <div class="nyan-card-cost">${def?.cost ?? '?'}</div>
    `;

    const captured = i;
    card.addEventListener('click', () => onCardClick(captured));
    row.appendChild(card);
  }
}

// ── Game over overlay ────────────────────────────────────────────────

function showGameOver(container: HTMLElement, score: number, onRestart: () => void): () => void {
  const el = document.createElement('div');
  el.id = 'nyan-gameover';
  el.innerHTML = `
    <div class="nyan-go-title">GAME OVER</div>
    <div class="nyan-go-score">SCORE  ${score}</div>
    <button class="nyan-go-restart" id="nyan-go-restart">もう一度プレイ</button>
  `;
  container.appendChild(el);
  (el.querySelector('#nyan-go-restart') as HTMLButtonElement).onclick = onRestart;
  return () => el.remove();
}

// ── Scene ────────────────────────────────────────────────────────────

export function createGameScene(container: HTMLElement, onTitle: () => void): () => void {
  const W = 960, H = 540;
  const GROUND_Y = 345;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  buildHud(container);
  buildCardArea(container);
  const flashEl = buildFlash(container);

  let state: GameState = createInitialState();
  let selectedCard: number | null = null;
  let gameOver = false;
  let hideGameOver: (() => void) | null = null;
  let t = 0, scrollX = 0, lastTime = 0, rafId = 0;

  const stars: Star[] = Array.from({ length: 110 }, () => ({
    x: Math.random() * W, y: Math.random() * GROUND_Y * 0.88,
    r: Math.random() * 1.2 + 0.3,
    phase: Math.random() * Math.PI * 2, speed: Math.random() * 0.7 + 0.3,
  }));
  const ruins: Ruin[] = [
    { x: 32,  w: 28, h: 72  }, { x: 72,  w: 18, h: 108 }, { x: 98,  w: 44, h: 54  },
    { x: 156, w: 22, h: 118 }, { x: 196, w: 36, h: 63  }, { x: 548, w: 32, h: 82  },
    { x: 594, w: 50, h: 58  }, { x: 658, w: 20, h: 115 }, { x: 698, w: 40, h: 88  },
    { x: 760, w: 55, h: 66  }, { x: 836, w: 24, h: 102 }, { x: 876, w: 58, h: 48  },
    { x: 948, w: 28, h: 90  },
  ];

  function flash() {
    flashEl.style.background = 'rgba(255,255,255,0.5)';
    setTimeout(() => { flashEl.style.background = 'rgba(255,255,255,0)'; }, 80);
  }

  function triggerGameOver() {
    gameOver = true;
    hideGameOver = showGameOver(container, state.score, () => {
      hideGameOver?.();
      state = createInitialState();
      gameOver = false;
      selectedCard = null;
    });
  }

  function handleCardClick(idx: number) {
    if (gameOver) return;
    if (selectedCard === idx) {
      state = playCard(state, idx);
      flash();
      selectedCard = null;
      if (state.player.hp <= 0) triggerGameOver();
    } else {
      selectedCard = idx;
    }
  }

  (document.getElementById('nyan-end-turn') as HTMLButtonElement).onclick = () => {
    if (gameOver) return;
    state = endTurn(state);
    selectedCard = null;
    if (state.player.hp <= 0) triggerGameOver();
  };

  function draw(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    t += dt;
    scrollX += dt * 18;

    ctx.clearRect(0, 0, W, H);
    drawBg(ctx, W, H, GROUND_Y, t, stars, ruins, scrollX);
    drawCatTank(ctx, 175, GROUND_Y, t, state.player.effects.some(e => e.name === 'shield'));
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      drawEnemy(ctx, e.x, GROUND_Y, e.type, t, i);
      drawCanvasHpBar(ctx, e.x, GROUND_Y, e.type, e.hp, e.maxHp);
    }

    if (!gameOver) {
      updateHud(state);
      renderCards(state, selectedCard, handleCardClick);
    }

    rafId = requestAnimationFrame(draw);
  }

  rafId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(rafId);
    canvas.remove();
    document.getElementById('nyan-hud')?.remove();
    document.getElementById('nyan-card-area')?.remove();
    document.getElementById('nyan-flash')?.remove();
    document.getElementById('nyan-gameover')?.remove();
    onTitle;
  };
}
