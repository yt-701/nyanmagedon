interface Star { x: number; y: number; r: number; phase: number; speed: number }
interface Ruin { x: number; w: number; h: number }

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
  // Sky gradient — deep purple → pink → orange sunset
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0,    '#070012');
  sky.addColorStop(0.22, '#1a0533');
  sky.addColorStop(0.48, '#6b21a8');
  sky.addColorStop(0.70, '#be185d');
  sky.addColorStop(0.87, '#f97316');
  sky.addColorStop(1,    '#fde68a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars
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

  // Moon
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

  // Ruin silhouettes
  const groundY = H - 115;
  ctx.fillStyle = 'rgba(10,4,26,0.82)';
  for (const r of ruins) {
    const rx = ((r.x - t * 9) % (W + 120) + W + 120) % (W + 120) - 60;
    const ry = groundY - r.h;
    ctx.beginPath();
    ctx.roundRect(rx, ry, r.w, r.h + 2, [3, 3, 0, 0]);
    ctx.fill();
  }

  // Ground fill
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
  groundGrad.addColorStop(0, '#1c1040');
  groundGrad.addColorStop(1, '#0a0620');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, W, H - groundY);

  // Horizon glow
  ctx.save();
  glow(ctx, '#ec4899', 10);
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(0, groundY - 1, W, 2);
  noGlow(ctx);
  ctx.fillStyle = 'rgba(236,72,153,0.25)';
  ctx.fillRect(0, groundY - 7, W, 7);
  ctx.restore();

  // Perspective grid
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

export function createTitleScene(container: HTMLElement, onStart: () => void): () => void {
  const W = 960, H = 540;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const ui = document.createElement('div');
  ui.id = 'nyan-title-ui';
  ui.innerHTML = `
    <h1 class="nyan-game-title">NYANMAGEDON</h1>
    <p class="nyan-title-sub">ねこ戦車の世紀末カードバトル</p>
    <button class="nyan-start-btn" id="nyan-start-btn">▶  クリックしてスタート</button>
    <p class="nyan-hint">カードを選んでクリック → もう一度クリックで発動</p>
  `;
  container.appendChild(ui);
  (ui.querySelector('#nyan-start-btn') as HTMLButtonElement).onclick = onStart;

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
