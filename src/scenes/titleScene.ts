import { CARD_DEFS } from '../cards/cardDefs';

interface Star { x: number; y: number; r: number; phase: number; speed: number }
interface Ruin { x: number; w: number; h: number }

const CARD_EMOJI: Record<string, string> = { attack: '🐾', defense: '🔮', utility: '✨' };
const TYPE_LABEL: Record<string, string> = { attack: 'アタック', defense: 'ディフェンス', utility: 'ユーティリティ' };

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color; ctx.shadowBlur = blur;
}
function noGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
}

function drawTitleBg(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  t: number, stars: Star[], ruins: Ruin[],
) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0,    '#070012');
  sky.addColorStop(0.22, '#1a0533');
  sky.addColorStop(0.48, '#6b21a8');
  sky.addColorStop(0.70, '#be185d');
  sky.addColorStop(0.87, '#f97316');
  sky.addColorStop(1,    '#fde68a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (const s of stars) {
    const b = 0.5 + Math.sin(t * s.speed + s.phase) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.3 + b * 0.7;
    ctx.fillStyle = `hsl(240,50%,${Math.floor(78 + b * 22)}%)`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (0.7 + b * 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const mx = W * 0.82, my = H * 0.2;
  ctx.save();
  glow(ctx, 'rgba(253,230,138,0.5)', 32);
  ctx.fillStyle = 'rgba(253,230,138,0.07)';
  ctx.beginPath(); ctx.arc(mx, my, 52, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
  const moonGrad = ctx.createRadialGradient(mx - 5, my - 8, 0, mx, my, 34);
  moonGrad.addColorStop(0, '#fffbeb');
  moonGrad.addColorStop(0.6, '#fef3c7');
  moonGrad.addColorStop(1, '#fde68a');
  ctx.fillStyle = moonGrad;
  ctx.beginPath(); ctx.arc(mx, my, 34, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(mx - 11, my - 6,  5.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 13, my + 10,  4,   0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 3,  my - 14,  3,   0, Math.PI * 2); ctx.fill();
  ctx.restore();

  const groundY = H - 115;
  ctx.fillStyle = 'rgba(10,4,26,0.82)';
  for (const r of ruins) {
    const rx = ((r.x - t * 9) % (W + 120) + W + 120) % (W + 120) - 60;
    const ry = groundY - r.h;
    ctx.beginPath();
    ctx.roundRect(rx, ry, r.w, r.h + 2, [3, 3, 0, 0]);
    ctx.fill();
  }

  const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
  groundGrad.addColorStop(0, '#1c1040');
  groundGrad.addColorStop(1, '#0a0620');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, W, H - groundY);

  ctx.save();
  glow(ctx, '#ec4899', 10);
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(0, groundY - 1, W, 2);
  noGlow(ctx);
  ctx.fillStyle = 'rgba(236,72,153,0.25)';
  ctx.fillRect(0, groundY - 7, W, 7);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(168,85,247,0.2)';
  ctx.lineWidth = 1;
  const vpx = W / 2;
  for (let i = -9; i <= 9; i++) {
    ctx.beginPath(); ctx.moveTo(vpx + i * 6, groundY); ctx.lineTo(vpx + i * 78, H); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(236,72,153,0.18)';
  for (let row = 1; row <= 7; row++) {
    const f = (row / 7) ** 1.6;
    const ly = groundY + f * (H - groundY);
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
  }
  ctx.restore();
}

// ── Room code generator ──────────────────────────────────────────────

function genRoomCode(): string {
  return Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
  ).join('');
}

// ── Modal builders ───────────────────────────────────────────────────

function makeModal(container: HTMLElement, content: string): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'nt-overlay';
  overlay.innerHTML = `<div class="nt-modal">${content}</div>`;
  container.appendChild(overlay);
  // Click backdrop to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  return overlay;
}

function openCreateRoom(container: HTMLElement, onStart: () => void): void {
  const code = genRoomCode();
  const overlay = makeModal(container, `
    <button class="nt-close" aria-label="close">✕</button>
    <div class="nt-modal-icon">🏠</div>
    <h2 class="nt-modal-title">ルーム作成</h2>
    <p class="nt-modal-desc">あなたのルームコードを友達にシェアしよう！</p>
    <div class="nt-room-code-display">
      <span class="nt-code-label">ROOM CODE</span>
      <span class="nt-code-value" id="nt-code">${code}</span>
      <button class="nt-copy-btn" id="nt-copy-btn" title="コピー">📋</button>
    </div>
    <p class="nt-modal-note">※ 現在はシングルプレイヤーモードで開始します</p>
    <div class="nt-modal-actions">
      <button class="nt-action-btn nt-action-btn--primary" id="nt-create-start">
        ゲームスタート ▶
      </button>
    </div>
  `);

  overlay.querySelector('.nt-close')!.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#nt-create-start')!.addEventListener('click', () => {
    overlay.remove();
    onStart();
  });
  overlay.querySelector('#nt-copy-btn')!.addEventListener('click', async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    const btn = overlay.querySelector('#nt-copy-btn') as HTMLButtonElement;
    btn.textContent = '✅'; setTimeout(() => { btn.textContent = '📋'; }, 1200);
  });
}

function openJoinRoom(container: HTMLElement, onStart: () => void): void {
  const overlay = makeModal(container, `
    <button class="nt-close" aria-label="close">✕</button>
    <div class="nt-modal-icon">🚪</div>
    <h2 class="nt-modal-title">ルーム参加</h2>
    <p class="nt-modal-desc">ルームコードを入力してください</p>
    <div class="nt-room-input-wrap">
      <input
        class="nt-room-input"
        id="nt-room-input"
        maxlength="6"
        placeholder="例: ABC123"
        autocomplete="off"
        spellcheck="false"
      />
    </div>
    <p class="nt-input-hint" id="nt-input-hint">6文字のコードを入力</p>
    <p class="nt-modal-note">※ 現在はシングルプレイヤーモードで参加します</p>
    <div class="nt-modal-actions">
      <button class="nt-action-btn nt-action-btn--secondary" id="nt-join-start" disabled>
        参加する ▶
      </button>
    </div>
  `);

  const input = overlay.querySelector('#nt-room-input') as HTMLInputElement;
  const btn   = overlay.querySelector('#nt-join-start') as HTMLButtonElement;
  const hint  = overlay.querySelector('#nt-input-hint') as HTMLElement;

  input.addEventListener('input', () => {
    const v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    input.value = v;
    btn.disabled = v.length < 6;
    hint.textContent = v.length < 6 ? `${v.length} / 6 文字` : '✓ 入力完了！';
    hint.style.color = v.length === 6 ? '#4ade80' : '';
  });

  overlay.querySelector('.nt-close')!.addEventListener('click', () => overlay.remove());
  btn.addEventListener('click', () => {
    overlay.remove();
    onStart();
  });

  setTimeout(() => input.focus(), 80);
}

function openSkillList(container: HTMLElement): void {
  const cards = Object.values(CARD_DEFS);
  const cardHtml = cards.map(c => `
    <div class="nt-skill-card">
      <div class="nt-skill-art ${c.type}">${CARD_EMOJI[c.type] ?? '✨'}</div>
      <div class="nt-skill-body">
        <div class="nt-skill-header">
          <span class="nt-skill-name">${c.nameJa}</span>
          <span class="nt-skill-type-badge nt-badge--${c.type}">${TYPE_LABEL[c.type] ?? c.type}</span>
        </div>
        <p class="nt-skill-desc">${c.description}</p>
        <div class="nt-skill-cost">
          <span class="nt-cost-gem"></span>
          <span>コスト ${c.cost}</span>
        </div>
      </div>
    </div>
  `).join('');

  const overlay = makeModal(container, `
    <button class="nt-close" aria-label="close">✕</button>
    <div class="nt-modal-icon">📋</div>
    <h2 class="nt-modal-title">スキル一覧</h2>
    <p class="nt-modal-desc">現在使用できるカード — 全 ${cards.length} 種</p>
    <div class="nt-skill-grid">${cardHtml}</div>
  `);

  overlay.querySelector('.nt-close')!.addEventListener('click', () => overlay.remove());
}

// ── Title scene ──────────────────────────────────────────────────────

export function createTitleScene(container: HTMLElement, onStart: () => void): () => void {
  const W = 960, H = 540;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const ui = document.createElement('div');
  ui.id = 'nyan-title-ui';
  ui.innerHTML = `
    <div class="nt-header">
      <h1 class="nyan-game-title">NYANMAGEDON</h1>
      <p class="nyan-title-sub">ねこ戦車の世紀末カードバトル</p>
    </div>

    <nav class="nt-menu">
      <button class="nt-menu-btn nt-menu-btn--create" id="nt-btn-create">
        <span class="nt-btn-icon">🏠</span>
        <span class="nt-btn-content">
          <span class="nt-btn-label">ルーム作成</span>
          <span class="nt-btn-sub">新しいゲームをはじめる</span>
        </span>
        <span class="nt-btn-arrow">›</span>
      </button>

      <button class="nt-menu-btn nt-menu-btn--join" id="nt-btn-join">
        <span class="nt-btn-icon">🚪</span>
        <span class="nt-btn-content">
          <span class="nt-btn-label">ルーム参加</span>
          <span class="nt-btn-sub">コードで部屋に入る</span>
        </span>
        <span class="nt-btn-arrow">›</span>
      </button>

      <button class="nt-menu-btn nt-menu-btn--skills" id="nt-btn-skills">
        <span class="nt-btn-icon">📋</span>
        <span class="nt-btn-content">
          <span class="nt-btn-label">スキル一覧</span>
          <span class="nt-btn-sub">全カードを確認する</span>
        </span>
        <span class="nt-btn-arrow">›</span>
      </button>
    </nav>

    <p class="nyan-hint">カードを選んでクリック → もう一度クリックで発動</p>
  `;
  container.appendChild(ui);

  ui.querySelector('#nt-btn-create')!.addEventListener('click', () => openCreateRoom(container, onStart));
  ui.querySelector('#nt-btn-join')!.addEventListener('click',   () => openJoinRoom(container, onStart));
  ui.querySelector('#nt-btn-skills')!.addEventListener('click', () => openSkillList(container));

  const stars: Star[] = Array.from({ length: 180 }, () => ({
    x: Math.random() * W, y: Math.random() * H * 0.75,
    r: Math.random() * 1.5 + 0.3,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.8 + 0.3,
  }));
  const ruins: Ruin[] = [
    { x: 30,  w: 30, h: 85  }, { x: 72,  w: 20, h: 120 }, { x: 100, w: 48, h: 58  },
    { x: 160, w: 22, h: 115 }, { x: 195, w: 36, h: 65  }, { x: 555, w: 32, h: 80  },
    { x: 600, w: 50, h: 62  }, { x: 665, w: 20, h: 120 }, { x: 700, w: 40, h: 88  },
    { x: 762, w: 55, h: 68  }, { x: 838, w: 24, h: 105 }, { x: 878, w: 58, h: 50  },
    { x: 950, w: 28, h: 92  },
  ];

  let t = 0, lastTime = 0, rafId = 0;
  function draw(now: number) {
    t += Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    drawTitleBg(ctx, W, H, t, stars, ruins);
    rafId = requestAnimationFrame(draw);
  }
  rafId = requestAnimationFrame(draw);

  return () => { cancelAnimationFrame(rafId); canvas.remove(); ui.remove(); };
}
