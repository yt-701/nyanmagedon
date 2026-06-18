import type { KAPLAYCtx } from "kaplay";
import type { GameState } from "../types";
import { createInitialState, playCard, endTurn } from "../cards/gameLogic";
import { CARD_DEFS } from "../cards/cardDefs";

type RGB = [number, number, number];

const N = {
  gold:    [255, 212, 55]  as RGB,
  cyan:    [0,   220, 255] as RGB,
  magenta: [255, 50,  200] as RGB,
  green:   [70,  255, 110] as RGB,
  red:     [255, 60,  80]  as RGB,
  purple:  [160, 80,  255] as RGB,
  white:   [235, 228, 255] as RGB,
  panel:   [8,   5,   20]  as RGB,
  panelBdr:[60,  40,  100] as RGB,
  atkCard: [55,  12,  18]  as RGB,
  defCard: [8,   22,  52]  as RGB,
  utlCard: [12,  38,  18]  as RGB,
  atkTop:  [200, 48,  65]  as RGB,
  defTop:  [38,  128, 200] as RGB,
  utlTop:  [55,  178, 75]  as RGB,
  manaBlue:[40,  100, 220] as RGB,
  hpRed:   [200, 48,  65]  as RGB,
};

export function gameScene(k: KAPLAYCtx) {
  let state: GameState = createInitialState();
  let selectedCard: number | null = null;
  let gameOver = false;
  let t = 0;
  let flashTimer = 0;
  let shakeTimer = 0;

  const W = k.width();
  const H = k.height();
  const GROUND_Y = H - 158;
  const CARD_H = 142;
  const CARD_W = 100;
  const CARD_AREA_Y = H - CARD_H - 10;
  const UI_H = 52;

  // Pre-generate stars (stable positions)
  const stars = Array.from({ length: 130 }, () => ({
    x: Math.random() * W,
    y: Math.random() * GROUND_Y * 0.88,
    r: Math.random() * 1.2 + 0.3,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.7 + 0.3,
  }));

  // Pre-generate ruins (mid-ground)
  const ruins = [
    { x: 30,  w: 28, h: 70,  win: true  },
    { x: 70,  w: 18, h: 105, win: false },
    { x: 98,  w: 44, h: 52,  win: true  },
    { x: 158, w: 22, h: 128, win: true  },
    { x: 196, w: 36, h: 63,  win: false },
    { x: 550, w: 32, h: 82,  win: true  },
    { x: 595, w: 50, h: 58,  win: true  },
    { x: 660, w: 20, h: 118, win: false },
    { x: 700, w: 40, h: 88,  win: true  },
    { x: 760, w: 55, h: 68,  win: true  },
    { x: 835, w: 24, h: 102, win: false },
    { x: 875, w: 58, h: 48,  win: true  },
    { x: 948, w: 28, h: 92,  win: true  },
  ];

  // ─── DRAWING HELPERS ─────────────────────────────────────────────

  function glowCircle(x: number, y: number, r: number, col: RGB, intensity = 1.0) {
    k.drawCircle({ pos: k.vec2(x, y), radius: r * 2.8, color: k.Color.fromArray(col), opacity: 0.04 * intensity });
    k.drawCircle({ pos: k.vec2(x, y), radius: r * 1.9, color: k.Color.fromArray(col), opacity: 0.10 * intensity });
    k.drawCircle({ pos: k.vec2(x, y), radius: r * 1.3, color: k.Color.fromArray(col), opacity: 0.20 * intensity });
    k.drawCircle({ pos: k.vec2(x, y), radius: r,       color: k.Color.fromArray(col) });
  }

  function glowLine(p1: ReturnType<typeof k.vec2>, p2: ReturnType<typeof k.vec2>, col: RGB, w = 2, intensity = 1.0) {
    k.drawLine({ p1, p2, width: w + 4, color: k.Color.fromArray(col), opacity: 0.08 * intensity });
    k.drawLine({ p1, p2, width: w + 2, color: k.Color.fromArray(col), opacity: 0.18 * intensity });
    k.drawLine({ p1, p2, width: w,     color: k.Color.fromArray(col), opacity: 0.9  * intensity });
  }

  function glowRect(x: number, y: number, w: number, h: number, col: RGB, spread = 4) {
    k.drawRect({ pos: k.vec2(x - spread, y - spread), width: w + spread * 2, height: h + spread * 2,
      color: k.Color.fromArray(col), opacity: 0.10, radius: 4 });
    k.drawRect({ pos: k.vec2(x - spread / 2, y - spread / 2), width: w + spread, height: h + spread,
      color: k.Color.fromArray(col), opacity: 0.18, radius: 3 });
    k.drawRect({ pos: k.vec2(x, y), width: w, height: h, color: k.Color.fromArray(col) });
  }

  function drawGradBar(x: number, y: number, w: number, h: number, val: number, max: number, col: RGB, hi: RGB) {
    k.drawRect({ pos: k.vec2(x, y), width: w, height: h, color: k.Color.fromArray([6, 4, 16]), radius: h / 2 });
    const filled = Math.max(0, (val / max) * w);
    if (filled > 1) {
      k.drawRect({ pos: k.vec2(x, y), width: filled, height: h, color: k.Color.fromArray(col), radius: h / 2 });
      k.drawRect({ pos: k.vec2(x + 1, y + 1), width: filled - 2, height: h / 2 - 1,
        color: k.Color.fromArray(hi), opacity: 0.3, radius: (h / 2) - 1 });
      k.drawRect({ pos: k.vec2(x + filled - 3, y + 1), width: 3, height: h - 2,
        color: k.Color.fromArray([255, 255, 255]), opacity: 0.45, radius: 2 });
    }
    k.drawRect({ pos: k.vec2(x, y), width: w, height: h,
      outline: { color: k.Color.fromArray([70, 50, 110]), width: 1 }, radius: h / 2 });
  }

  // ─── BACKGROUND ──────────────────────────────────────────────────

  function drawBackground(sx: number, sy: number) {
    // Sky
    for (let i = 0; i < 22; i++) {
      const f = i / 22;
      k.drawRect({ pos: k.vec2(sx, sy + i * (GROUND_Y / 22)), width: W, height: GROUND_Y / 22 + 1,
        color: k.Color.fromArray([
          Math.floor(4  + f * 16),
          Math.floor(0  + f * 4 ),
          Math.floor(15 + f * 36),
        ] as RGB) });
    }

    // Stars
    for (const s of stars) {
      const b = 0.5 + Math.sin(t * s.speed + s.phase) * 0.5;
      const c = Math.floor(155 + b * 100);
      k.drawCircle({
        pos: k.vec2(sx + s.x, sy + s.y),
        radius: s.r * (0.7 + b * 0.3),
        color: k.Color.fromArray([c, c, Math.min(255, c + 28)] as RGB),
        opacity: 0.3 + b * 0.7,
      });
    }

    // Moon
    const moonX = sx + W * 0.84, moonY = sy + GROUND_Y * 0.18;
    k.drawCircle({ pos: k.vec2(moonX, moonY), radius: 50, color: k.Color.fromArray([200, 180, 110]), opacity: 0.05 });
    k.drawCircle({ pos: k.vec2(moonX, moonY), radius: 40, color: k.Color.fromArray([228, 210, 140]), opacity: 0.09 });
    k.drawCircle({ pos: k.vec2(moonX, moonY), radius: 30, color: k.Color.fromArray([248, 238, 198]) });
    k.drawCircle({ pos: k.vec2(moonX - 8,  moonY - 5 ), radius: 4.5, color: k.Color.fromArray([228, 218, 178]), opacity: 0.75 });
    k.drawCircle({ pos: k.vec2(moonX + 10, moonY + 8 ), radius: 3.5, color: k.Color.fromArray([228, 218, 178]), opacity: 0.75 });
    k.drawCircle({ pos: k.vec2(moonX + 3,  moonY - 12), radius: 3,   color: k.Color.fromArray([228, 218, 178]), opacity: 0.75 });

    // Ruin silhouettes
    for (const r of ruins) {
      const rx = sx + ((r.x - t * 9) % (W + 120) + W + 120) % (W + 120) - 60;
      const ry = sy + GROUND_Y - r.h;
      k.drawRect({ pos: k.vec2(rx, ry), width: r.w, height: r.h + 2, color: k.Color.fromArray([9, 6, 24]) });
      k.drawRect({ pos: k.vec2(rx - 4, ry - 4), width: r.w + 8, height: 5, color: k.Color.fromArray([13, 9, 30]) });
      if (r.win && r.h > 55) {
        for (let wi = 0; wi < Math.floor(r.h / 28); wi++) {
          const lit = Math.sin(t * 0.55 + r.x * 0.08 + wi * 1.4) > 0.35;
          const wc: RGB = lit ? [65, 45, 175] : [16, 10, 42];
          k.drawRect({ pos: k.vec2(rx + 5, ry + 9 + wi * 27), width: 7, height: 10,
            color: k.Color.fromArray(wc), opacity: lit ? 0.92 : 0.3 });
          if (r.w > 24) {
            k.drawRect({ pos: k.vec2(rx + r.w - 12, ry + 9 + wi * 27), width: 7, height: 10,
              color: k.Color.fromArray(wc), opacity: lit ? 0.92 : 0.3 });
          }
        }
      }
    }

    // Ground fill
    k.drawRect({ pos: k.vec2(sx, sy + GROUND_Y), width: W, height: H - GROUND_Y,
      color: k.Color.fromArray([6, 4, 16]) });

    // Synthwave perspective grid
    const vpx = sx + W / 2, vpy = sy + GROUND_Y;
    for (let i = -10; i <= 10; i++) {
      k.drawLine({ p1: k.vec2(vpx + i * 6, vpy), p2: k.vec2(vpx + i * 80, sy + H),
        width: 1, color: k.Color.fromArray([175, 0, 255]), opacity: 0.2 });
    }
    for (let row = 1; row <= 8; row++) {
      const f = (row / 8) ** 1.7;
      const ly = vpy + f * (H - GROUND_Y);
      k.drawLine({ p1: k.vec2(sx, ly), p2: k.vec2(sx + W, ly),
        width: 1, color: k.Color.fromArray([255, 0, 195]), opacity: 0.18 * (1 - f * 0.5) });
    }
    // Horizon glow
    k.drawRect({ pos: k.vec2(sx, sy + GROUND_Y - 2), width: W, height: 3,
      color: k.Color.fromArray([190, 0, 255]), opacity: 0.9 });
    k.drawRect({ pos: k.vec2(sx, sy + GROUND_Y - 7), width: W, height: 6,
      color: k.Color.fromArray([140, 0, 200]), opacity: 0.18 });
  }

  // ─── CAT TANK ────────────────────────────────────────────────────

  function drawCatTank(cx: number, cy: number, sx: number, sy: number) {
    const tx = sx + cx, ty = sy + cy;

    // Tracks
    k.drawRect({ pos: k.vec2(tx - 52, ty + 22), width: 104, height: 16,
      color: k.Color.fromArray([22, 22, 28]), radius: 8 });
    for (let i = 0; i < 10; i++) {
      k.drawRect({ pos: k.vec2(tx - 46 + i * 10, ty + 23), width: 8, height: 14,
        color: k.Color.fromArray([42, 42, 52]), radius: 2 });
    }
    k.drawCircle({ pos: k.vec2(tx - 44, ty + 30), radius: 7, color: k.Color.fromArray([32, 32, 42]) });
    k.drawCircle({ pos: k.vec2(tx + 44, ty + 30), radius: 7, color: k.Color.fromArray([32, 32, 42]) });
    k.drawCircle({ pos: k.vec2(tx,       ty + 32), radius: 5, color: k.Color.fromArray([32, 32, 42]) });
    k.drawRect({ pos: k.vec2(tx - 50, ty + 22), width: 100, height: 3,
      color: k.Color.fromArray([80, 200, 80]), opacity: 0.28, radius: 2 });

    // Hull
    k.drawRect({ pos: k.vec2(tx - 44, ty + 1), width: 88, height: 22,
      color: k.Color.fromArray([0, 0, 0]), opacity: 0.35, radius: 3 });
    k.drawRect({ pos: k.vec2(tx - 44, ty), width: 88, height: 22,
      color: k.Color.fromArray([42, 98, 52]), radius: 4 });
    k.drawRect({ pos: k.vec2(tx - 42, ty + 1), width: 84, height: 6,
      color: k.Color.fromArray([78, 158, 80]), opacity: 0.45, radius: 3 });
    k.drawRect({ pos: k.vec2(tx - 28, ty + 9), width: 18, height: 8,
      color: k.Color.fromArray([32, 76, 44]), radius: 2 });
    k.drawRect({ pos: k.vec2(tx + 6,  ty + 9), width: 18, height: 8,
      color: k.Color.fromArray([32, 76, 44]), radius: 2 });

    // Turret
    k.drawRect({ pos: k.vec2(tx - 25, ty - 21), width: 50, height: 23,
      color: k.Color.fromArray([52, 116, 62]), radius: 5 });
    k.drawRect({ pos: k.vec2(tx - 23, ty - 20), width: 46, height: 6,
      color: k.Color.fromArray([88, 165, 88]), opacity: 0.42, radius: 4 });
    k.drawCircle({ pos: k.vec2(tx - 18, ty - 14), radius: 2.2, color: k.Color.fromArray([28, 66, 38]) });
    k.drawCircle({ pos: k.vec2(tx + 18, ty - 14), radius: 2.2, color: k.Color.fromArray([28, 66, 38]) });

    // Barrel
    k.drawCircle({ pos: k.vec2(tx + 23, ty - 12), radius: 5, color: k.Color.fromArray([38, 86, 48]) });
    k.drawRect({ pos: k.vec2(tx + 23, ty - 15), width: 38, height: 7,
      color: k.Color.fromArray([32, 72, 42]) });
    glowRect(tx + 57, ty - 14, 6, 5, [100, 255, 100] as RGB, 3);

    // Cat head
    const hx = tx, hy = ty - 44;
    k.drawCircle({ pos: k.vec2(hx, hy), radius: 20, color: k.Color.fromArray([0, 0, 0]), opacity: 0.28 });
    k.drawCircle({ pos: k.vec2(hx, hy), radius: 19, color: k.Color.fromArray([255, 184, 88]) });
    k.drawCircle({ pos: k.vec2(hx - 5, hy - 6), radius: 11,
      color: k.Color.fromArray([255, 214, 128]), opacity: 0.32 });

    // Ears
    k.drawTriangle({ p1: k.vec2(hx - 17, hy - 13), p2: k.vec2(hx - 9, hy - 30), p3: k.vec2(hx - 2, hy - 14),
      color: k.Color.fromArray([255, 163, 68]) });
    k.drawTriangle({ p1: k.vec2(hx + 17, hy - 13), p2: k.vec2(hx + 9, hy - 30), p3: k.vec2(hx + 2, hy - 14),
      color: k.Color.fromArray([255, 163, 68]) });
    k.drawTriangle({ p1: k.vec2(hx - 15, hy - 14), p2: k.vec2(hx - 9, hy - 26), p3: k.vec2(hx - 3, hy - 15),
      color: k.Color.fromArray([255, 138, 148]), opacity: 0.72 });
    k.drawTriangle({ p1: k.vec2(hx + 15, hy - 14), p2: k.vec2(hx + 9, hy - 26), p3: k.vec2(hx + 3, hy - 15),
      color: k.Color.fromArray([255, 138, 148]), opacity: 0.72 });

    // Eyes (glowing cyan)
    glowCircle(hx - 7, hy - 3, 4.5, [0, 210, 255] as RGB, 0.75);
    k.drawCircle({ pos: k.vec2(hx - 7, hy - 3), radius: 4.5, color: k.Color.fromArray([28, 198, 238]) });
    k.drawCircle({ pos: k.vec2(hx - 7, hy - 3), radius: 2.5, color: k.Color.fromArray([8, 12, 28]) });
    k.drawCircle({ pos: k.vec2(hx - 5, hy - 5), radius: 1,   color: k.Color.fromArray([255, 255, 255]) });
    glowCircle(hx + 7, hy - 3, 4.5, [0, 210, 255] as RGB, 0.75);
    k.drawCircle({ pos: k.vec2(hx + 7, hy - 3), radius: 4.5, color: k.Color.fromArray([28, 198, 238]) });
    k.drawCircle({ pos: k.vec2(hx + 7, hy - 3), radius: 2.5, color: k.Color.fromArray([8, 12, 28]) });
    k.drawCircle({ pos: k.vec2(hx + 9, hy - 5), radius: 1,   color: k.Color.fromArray([255, 255, 255]) });

    // Nose
    k.drawCircle({ pos: k.vec2(hx, hy + 4), radius: 2.5, color: k.Color.fromArray([255, 95, 115]) });

    // Whiskers
    const wOp = 0.65;
    k.drawLine({ p1: k.vec2(hx - 19, hy + 3), p2: k.vec2(hx - 5, hy + 5), width: 1, color: k.Color.fromArray([255, 240, 200]), opacity: wOp });
    k.drawLine({ p1: k.vec2(hx - 19, hy + 7), p2: k.vec2(hx - 5, hy + 7), width: 1, color: k.Color.fromArray([255, 240, 200]), opacity: wOp });
    k.drawLine({ p1: k.vec2(hx + 19, hy + 3), p2: k.vec2(hx + 5, hy + 5), width: 1, color: k.Color.fromArray([255, 240, 200]), opacity: wOp });
    k.drawLine({ p1: k.vec2(hx + 19, hy + 7), p2: k.vec2(hx + 5, hy + 7), width: 1, color: k.Color.fromArray([255, 240, 200]), opacity: wOp });

    // Pilot visor/helmet
    k.drawRect({ pos: k.vec2(hx - 18, hy - 20), width: 36, height: 14,
      color: k.Color.fromArray([40, 70, 190]), opacity: 0.55, radius: 4 });
    k.drawRect({ pos: k.vec2(hx - 15, hy - 19), width: 30, height: 5,
      color: k.Color.fromArray([90, 130, 255]), opacity: 0.38, radius: 3 });

    // Shield effect
    if (state.player.effects.some(e => e.name === "shield")) {
      const sp = 0.55 + Math.sin(t * 4.5) * 0.45;
      k.drawCircle({ pos: k.vec2(cx + sx, ty - 20), radius: 58,
        color: k.Color.fromArray([0, 150, 255]), opacity: 0.07 * sp });
      k.drawCircle({ pos: k.vec2(cx + sx, ty - 20), radius: 55,
        color: k.Color.fromArray([0, 0, 0]), opacity: 0,
        outline: { color: k.Color.fromArray([0, 200, 255]), width: 2 } });
    }
  }

  // ─── ENEMY ───────────────────────────────────────────────────────

  function drawEnemy(ex: number, ey: number, type: string, hp: number, maxHp: number, idx: number, sx: number, sy: number) {
    const px = sx + ex, py = sy + ey;
    const isBoss = type === "boss";
    const isTank = type === "tank";
    const s  = isBoss ? 1.45 : isTank ? 1.18 : 1.0;
    const bw = Math.floor(58 * s);
    const bh = Math.floor(22 * s);
    const bc: RGB = isBoss ? [115, 18, 18] : isTank ? [78, 58, 16] : [68, 38, 28];

    // Tracks
    k.drawRect({ pos: k.vec2(px - bw * 0.88, py + bh * 1.12), width: bw * 1.76, height: Math.floor(13 * s),
      color: k.Color.fromArray([22, 22, 28]), radius: 5 });
    for (let i = 0; i < 9; i++) {
      k.drawRect({ pos: k.vec2(px - Math.floor(bw * 0.84) + i * Math.floor(bw * 0.23), py + Math.floor(bh * 1.14)),
        width: Math.floor(bw * 0.19), height: Math.floor(11 * s),
        color: k.Color.fromArray([38, 32, 38]), radius: 2 });
    }
    k.drawRect({ pos: k.vec2(px - bw * 0.84, py + bh * 1.12), width: bw * 1.68, height: 2,
      color: k.Color.fromArray([255, 55, 55]), opacity: 0.28, radius: 2 });

    // Hull
    k.drawRect({ pos: k.vec2(px - bw * 0.92, py), width: bw * 1.84, height: bh,
      color: k.Color.fromArray(bc), radius: 3 });
    k.drawRect({ pos: k.vec2(px - bw * 0.9, py + 1), width: bw * 1.8, height: 5,
      color: k.Color.fromArray([bc[0] + 35, bc[1] + 18, bc[2] + 8] as RGB), opacity: 0.38, radius: 2 });

    // Turret
    const tw = Math.floor(42 * s), th = Math.floor(18 * s);
    k.drawRect({ pos: k.vec2(px - tw / 2, py - th), width: tw, height: th,
      color: k.Color.fromArray([bc[0] - 14, bc[1] - 8, bc[2] - 8] as RGB), radius: 4 });
    k.drawRect({ pos: k.vec2(px - tw / 2 + 2, py - th + 1), width: tw - 4, height: 4,
      color: k.Color.fromArray([bc[0] + 18, bc[1] + 8, bc[2] + 4] as RGB), opacity: 0.32, radius: 3 });

    // Barrel (pointing left)
    const barLen = Math.floor(30 * s);
    k.drawRect({ pos: k.vec2(px - tw / 2 - barLen, py - th + 5), width: barLen, height: Math.floor(7 * s),
      color: k.Color.fromArray([48, 28, 22]) });
    glowCircle(px - tw / 2 - barLen, py - th + 9, 4 * s, [255, 55, 55] as RGB, 0.6);

    // Skull head
    const hy = py - th - Math.floor(16 * s);
    if (isBoss) {
      k.drawCircle({ pos: k.vec2(px, hy), radius: 22 * s + 9,
        color: k.Color.fromArray([200, 0, 0]), opacity: 0.07 + Math.sin(t * 3.2 + idx) * 0.035 });
    }
    k.drawCircle({ pos: k.vec2(px, hy), radius: 16 * s, color: k.Color.fromArray([212, 202, 186]) });
    // Sockets
    k.drawCircle({ pos: k.vec2(px - 5 * s, hy - 3 * s), radius: 5 * s, color: k.Color.fromArray([18, 12, 24]) });
    k.drawCircle({ pos: k.vec2(px + 5 * s, hy - 3 * s), radius: 5 * s, color: k.Color.fromArray([18, 12, 24]) });
    // Glowing red eyes
    glowCircle(px - 5 * s, hy - 3 * s, 3 * s, [255, 48, 48] as RGB, 1.1);
    glowCircle(px + 5 * s, hy - 3 * s, 3 * s, [255, 48, 48] as RGB, 1.1);
    // Nose hole
    k.drawCircle({ pos: k.vec2(px, hy + 3 * s), radius: 2 * s, color: k.Color.fromArray([28, 18, 28]) });
    // Teeth
    for (let ti = 0; ti < 4; ti++) {
      k.drawRect({ pos: k.vec2(px - 9 * s + ti * 5 * s, hy + 8 * s),
        width: 4 * s, height: 6 * s, color: k.Color.fromArray([198, 188, 172]) });
    }
    // Crack
    k.drawLine({ p1: k.vec2(px + 3 * s, hy - 13 * s), p2: k.vec2(px + 6 * s, hy),
      width: 1, color: k.Color.fromArray([148, 138, 122]), opacity: 0.55 });

    // Boss extras
    if (isBoss) {
      k.drawLine({ p1: k.vec2(px + 10, py - th - 18), p2: k.vec2(px + 10, py - th - 38),
        width: 2, color: k.Color.fromArray([78, 78, 78]) });
      glowCircle(px + 10, py - th - 39, 4.5, [255, 48, 48] as RGB,
        0.55 + Math.sin(t * 5.5) * 0.45);
      k.drawTriangle({
        p1: k.vec2(px + tw / 2, py - th + 5),
        p2: k.vec2(px + tw / 2 + 14, py - th - 3),
        p3: k.vec2(px + tw / 2 + 2,  py - th + 13),
        color: k.Color.fromArray([98, 28, 28]),
      });
    }

    // HP bar
    const barW = Math.floor(66 * s);
    const barY = py - th - Math.floor(36 * s);
    drawGradBar(px - barW / 2, barY, barW, 7, hp, maxHp, [218, 50, 50], [255, 115, 95]);
    k.drawText({ text: `${hp}`, pos: k.vec2(px, barY - 13), size: 9,
      color: k.Color.fromArray([255, 145, 145]), align: "center" });
  }

  // ─── CARDS ───────────────────────────────────────────────────────

  function drawCard(idx: number, cardId: string, selected: boolean, hovered: boolean, total: number) {
    const spacing = Math.min(CARD_W + 12, (W - 60) / Math.max(total, 1));
    const totalW  = spacing * (total - 1) + CARD_W;
    const startX  = (W - totalW) / 2;
    const lift    = selected ? 26 : hovered ? 13 : 0;
    const cx = startX + idx * spacing;
    const cy = CARD_AREA_Y - lift;

    const def = CARD_DEFS[cardId];
    const canAfford = state.player.mana >= (def?.cost ?? 99);
    const type  = def?.type ?? "utility";
    const tCol: RGB = type === "attack" ? N.atkTop : type === "defense" ? N.defTop : N.utlTop;
    const bgCol: RGB = type === "attack" ? N.atkCard : type === "defense" ? N.defCard : N.utlCard;

    // Outer glow
    if (selected) {
      k.drawRect({ pos: k.vec2(cx - 7, cy - 7), width: CARD_W + 14, height: CARD_H + 14,
        color: k.Color.fromArray(N.gold), opacity: 0.18, radius: 13 });
      k.drawRect({ pos: k.vec2(cx - 4, cy - 4), width: CARD_W + 8, height: CARD_H + 8,
        color: k.Color.fromArray(N.gold), opacity: 0.10, radius: 12 });
    } else if (hovered) {
      k.drawRect({ pos: k.vec2(cx - 4, cy - 4), width: CARD_W + 8, height: CARD_H + 8,
        color: k.Color.fromArray(tCol), opacity: 0.15, radius: 12 });
    }

    // Card body
    k.drawRect({ pos: k.vec2(cx, cy), width: CARD_W, height: CARD_H,
      color: k.Color.fromArray([15, 11, 30]), radius: 10 });

    // Art area
    const artH = Math.floor(CARD_H * 0.52);
    k.drawRect({ pos: k.vec2(cx, cy), width: CARD_W, height: artH,
      color: k.Color.fromArray(bgCol), radius: 10 });
    // Fade at art bottom
    k.drawRect({ pos: k.vec2(cx, cy + artH - 10), width: CARD_W, height: 14,
      color: k.Color.fromArray([15, 11, 30]), opacity: 0.55 });

    // Type icon in art area
    const ix = cx + CARD_W / 2, iy = cy + artH / 2;
    if (type === "attack") {
      glowLine(k.vec2(ix - 12, iy + 13), k.vec2(ix + 13, iy - 13), tCol, 2.5, 0.9);
      k.drawLine({ p1: k.vec2(ix - 13, iy + 13), p2: k.vec2(ix - 4,  iy + 13), width: 3, color: k.Color.fromArray(tCol), opacity: 0.9 });
      k.drawLine({ p1: k.vec2(ix - 13, iy + 13), p2: k.vec2(ix - 13, iy + 4 ), width: 3, color: k.Color.fromArray(tCol), opacity: 0.9 });
      for (let ci = 0; ci < 3; ci++) {
        k.drawLine({ p1: k.vec2(ix - 5 + ci * 5, iy - 15), p2: k.vec2(ix - 3 + ci * 5, iy - 4),
          width: 2, color: k.Color.fromArray(tCol), opacity: 0.7 });
      }
    } else if (type === "defense") {
      k.drawRect({ pos: k.vec2(ix - 11, iy - 15), width: 22, height: 21,
        color: k.Color.fromArray(tCol), opacity: 0.8, radius: 3 });
      k.drawTriangle({ p1: k.vec2(ix - 11, iy + 6), p2: k.vec2(ix + 11, iy + 6), p3: k.vec2(ix, iy + 17),
        color: k.Color.fromArray(tCol), opacity: 0.8 });
      k.drawLine({ p1: k.vec2(ix, iy - 13), p2: k.vec2(ix, iy + 15), width: 2,
        color: k.Color.fromArray([255, 255, 255]), opacity: 0.35 });
      k.drawLine({ p1: k.vec2(ix - 9, iy - 4), p2: k.vec2(ix + 9, iy - 4), width: 2,
        color: k.Color.fromArray([255, 255, 255]), opacity: 0.35 });
    } else {
      k.drawTriangle({ p1: k.vec2(ix + 4, iy - 17), p2: k.vec2(ix - 9, iy + 2),  p3: k.vec2(ix + 2, iy + 2),
        color: k.Color.fromArray(tCol), opacity: 0.9 });
      k.drawTriangle({ p1: k.vec2(ix - 2, iy + 0),  p2: k.vec2(ix + 9, iy + 15), p3: k.vec2(ix - 5, iy + 15),
        color: k.Color.fromArray(tCol), opacity: 0.9 });
    }

    // Can't afford overlay
    if (!canAfford) {
      k.drawRect({ pos: k.vec2(cx, cy), width: CARD_W, height: CARD_H,
        color: k.Color.fromArray([0, 0, 0]), opacity: 0.58, radius: 10 });
    }

    // Border
    const bCol = selected ? N.gold : hovered ? tCol : N.panelBdr;
    const bW   = selected ? 2 : hovered ? 1.5 : 1;
    k.drawRect({ pos: k.vec2(cx, cy), width: CARD_W, height: CARD_H,
      outline: { color: k.Color.fromArray(bCol), width: bW }, radius: 10 });

    // Separator
    k.drawRect({ pos: k.vec2(cx + 5, cy + artH), width: CARD_W - 10, height: 1,
      color: k.Color.fromArray(tCol), opacity: 0.38 });

    // Name
    k.drawText({ text: def?.nameJa ?? cardId,
      pos: k.vec2(cx + CARD_W / 2, cy + artH + 10), size: 10,
      color: k.Color.fromArray(N.white), align: "center" });

    // Description
    k.drawText({ text: def?.description ?? "",
      pos: k.vec2(cx + CARD_W / 2, cy + artH + 30), size: 8,
      color: k.Color.fromArray([152, 142, 195]), align: "center", width: CARD_W - 12 });

    // Cost gem (top-left)
    glowCircle(cx + 13, cy + 13, 11, N.manaBlue, 0.55);
    k.drawCircle({ pos: k.vec2(cx + 13, cy + 13), radius: 11,
      color: k.Color.fromArray([18, 55, 175]) });
    k.drawCircle({ pos: k.vec2(cx + 13, cy + 13), radius: 11,
      color: k.Color.fromArray([0, 0, 0]), opacity: 0,
      outline: { color: k.Color.fromArray([75, 135, 255]), width: 1.5 } });
    k.drawText({ text: String(def?.cost ?? "?"),
      pos: k.vec2(cx + 13, cy + 13), size: 12,
      color: k.Color.fromArray([195, 225, 255]), align: "center" });

    // Type badge (top-right)
    const tLabel = type === "attack" ? "ATK" : type === "defense" ? "DEF" : "UTL";
    k.drawRect({ pos: k.vec2(cx + CARD_W - 31, cy + 3), width: 28, height: 13,
      color: k.Color.fromArray(tCol), opacity: 0.78, radius: 3 });
    k.drawText({ text: tLabel, pos: k.vec2(cx + CARD_W - 17, cy + 9.5), size: 8,
      color: k.Color.fromArray([255, 255, 255]), align: "center" });
  }

  // ─── HUD ─────────────────────────────────────────────────────────

  function drawUI() {
    // Top bar bg
    k.drawRect({ pos: k.vec2(0, 0), width: W, height: UI_H,
      color: k.Color.fromArray([7, 4, 18]), opacity: 0.93 });
    k.drawRect({ pos: k.vec2(0, UI_H - 2), width: W, height: 2,
      color: k.Color.fromArray([100, 0, 200]), opacity: 0.65 });
    k.drawRect({ pos: k.vec2(0, UI_H - 1), width: W, height: 1,
      color: k.Color.fromArray([180, 80, 255]), opacity: 0.35 });

    // HP
    k.drawText({ text: "HP", pos: k.vec2(10, 10), size: 10, color: k.Color.fromArray([255, 95, 115]) });
    drawGradBar(32, 10, 135, 14, state.player.hp, state.player.maxHp, N.hpRed, [255, 118, 118]);
    k.drawText({ text: `${state.player.hp}/${state.player.maxHp}`, pos: k.vec2(174, 11), size: 9,
      color: k.Color.fromArray([255, 138, 148]) });

    // MP
    k.drawText({ text: "MP", pos: k.vec2(10, 30), size: 10, color: k.Color.fromArray([75, 158, 255]) });
    drawGradBar(32, 30, 135, 10, state.player.mana, state.player.maxMana, N.manaBlue, [95, 175, 255]);
    k.drawText({ text: `${state.player.mana}/${state.player.maxMana}`, pos: k.vec2(174, 30), size: 9,
      color: k.Color.fromArray([115, 175, 255]) });

    // Divider
    k.drawRect({ pos: k.vec2(202, 6), width: 1, height: UI_H - 12,
      color: k.Color.fromArray([75, 55, 115]), opacity: 0.55 });

    // Status effects
    let ex = 0;
    for (const eff of state.player.effects) {
      const ec: RGB = eff.name === "shield" ? [0, 178, 255] : [115, 255, 115];
      k.drawRect({ pos: k.vec2(210 + ex * 72, 8), width: 66, height: 18,
        color: k.Color.fromArray(ec), opacity: 0.13, radius: 4 });
      k.drawRect({ pos: k.vec2(210 + ex * 72, 8), width: 66, height: 18,
        outline: { color: k.Color.fromArray(ec), width: 1 }, radius: 4 });
      k.drawText({ text: `${eff.name} ×${eff.duration}`,
        pos: k.vec2(243 + ex * 72, 17), size: 8, color: k.Color.fromArray(ec), align: "center" });
      ex++;
    }

    // Turn (center)
    k.drawText({ text: "TURN", pos: k.vec2(W / 2, 10), size: 9,
      color: k.Color.fromArray([145, 125, 195]), align: "center" });
    k.drawText({ text: `${state.turn}`, pos: k.vec2(W / 2, 28), size: 20,
      color: k.Color.fromArray(N.gold), align: "center" });

    // Score
    k.drawText({ text: "SCORE", pos: k.vec2(W / 2 + 62, 10), size: 9,
      color: k.Color.fromArray([95, 135, 95]) });
    k.drawText({ text: `${state.score}`, pos: k.vec2(W / 2 + 62, 28), size: 14,
      color: k.Color.fromArray(N.green) });

    // End Turn button
    const btnX = W - 120, btnY = 8, btnW = 110, btnH = 36;
    const btnHov = k.mousePos().x >= btnX && k.mousePos().x <= btnX + btnW
                && k.mousePos().y >= btnY && k.mousePos().y <= btnY + btnH;
    if (btnHov) {
      k.drawRect({ pos: k.vec2(btnX - 3, btnY - 3), width: btnW + 6, height: btnH + 6,
        color: k.Color.fromArray(N.gold), opacity: 0.14, radius: 8 });
    }
    k.drawRect({ pos: k.vec2(btnX, btnY), width: btnW, height: btnH,
      color: k.Color.fromArray([28, 13, 55]), radius: 6 });
    k.drawRect({ pos: k.vec2(btnX, btnY), width: btnW, height: btnH,
      outline: { color: k.Color.fromArray(btnHov ? N.gold : [115, 85, 175]), width: btnHov ? 2 : 1 }, radius: 6 });
    k.drawText({ text: "ターン終了", pos: k.vec2(btnX + btnW / 2, btnY + btnH / 2), size: 12,
      color: k.Color.fromArray(btnHov ? N.gold : [195, 175, 255]), align: "center" });

    // Card area panel
    k.drawRect({ pos: k.vec2(0, CARD_AREA_Y - 30), width: W, height: CARD_H + 42,
      color: k.Color.fromArray([4, 2, 13]), opacity: 0.9 });
    k.drawRect({ pos: k.vec2(0, CARD_AREA_Y - 31), width: W, height: 2,
      color: k.Color.fromArray([100, 0, 200]), opacity: 0.48 });
    k.drawRect({ pos: k.vec2(0, CARD_AREA_Y - 29), width: W, height: 1,
      color: k.Color.fromArray([155, 65, 255]), opacity: 0.25 });
    k.drawText({ text: `手札 ${state.hand.length}  デッキ ${state.deck.length}  捨て ${state.discard.length}`,
      pos: k.vec2(12, CARD_AREA_Y - 20), size: 9,
      color: k.Color.fromArray([100, 85, 155]) });
  }

  // ─── HIT DETECTION ───────────────────────────────────────────────

  function getCardAtMouse(mx: number, my: number): number | null {
    const total = state.hand.length;
    if (total === 0) return null;
    const spacing = Math.min(CARD_W + 12, (W - 60) / Math.max(total, 1));
    const totalW  = spacing * (total - 1) + CARD_W;
    const startX  = (W - totalW) / 2;
    for (let i = 0; i < total; i++) {
      const cx = startX + i * spacing;
      if (mx >= cx && mx <= cx + CARD_W && my >= CARD_AREA_Y - 30 && my <= CARD_AREA_Y + CARD_H) {
        return i;
      }
    }
    return null;
  }

  function isEndTurnBtn(mx: number, my: number) {
    return mx >= W - 120 && mx <= W - 10 && my >= 8 && my <= 44;
  }

  // ─── MAIN DRAW LOOP ──────────────────────────────────────────────

  k.onDraw(() => {
    t += k.dt();
    if (shakeTimer > 0) shakeTimer -= k.dt();

    const sx = shakeTimer > 0 ? (Math.random() - 0.5) * 7 : 0;
    const sy = shakeTimer > 0 ? (Math.random() - 0.5) * 5 : 0;

    drawBackground(sx, sy);
    drawCatTank(180, GROUND_Y, sx, sy);

    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      drawEnemy(e.x, GROUND_Y, e.type, e.hp, e.maxHp, i, sx, sy);
    }

    const hover = getCardAtMouse(k.mousePos().x, k.mousePos().y);
    for (let i = 0; i < state.hand.length; i++) {
      drawCard(i, state.hand[i], i === selectedCard, i === hover && i !== selectedCard, state.hand.length);
    }

    drawUI();

    // Card play flash
    if (flashTimer > 0) {
      flashTimer -= k.dt();
      k.drawRect({ pos: k.vec2(0, 0), width: W, height: H,
        color: k.Color.fromArray([255, 255, 255]), opacity: Math.min(flashTimer * 0.8, 0.45) });
    }

    // Game over overlay
    if (gameOver) {
      k.drawRect({ pos: k.vec2(0, 0), width: W, height: H,
        color: k.Color.fromArray([0, 0, 0]), opacity: 0.78 });
      // Glow
      k.drawText({ text: "GAME OVER", pos: k.vec2(W / 2, H / 2 - 42), size: 60,
        color: k.Color.fromArray([160, 0, 0]), align: "center", opacity: 0.28 });
      k.drawText({ text: "GAME OVER", pos: k.vec2(W / 2, H / 2 - 42), size: 52,
        color: k.Color.fromArray([255, 58, 58]), align: "center" });
      k.drawRect({ pos: k.vec2(W / 2 - 105, H / 2 - 4), width: 210, height: 2,
        color: k.Color.fromArray([255, 58, 58]), opacity: 0.5 });
      k.drawText({ text: `SCORE  ${state.score}`, pos: k.vec2(W / 2, H / 2 + 30), size: 28,
        color: k.Color.fromArray(N.gold), align: "center" });
      if (Math.floor(t * 1.4) % 2 === 0) {
        k.drawText({ text: "クリックでリスタート", pos: k.vec2(W / 2, H / 2 + 76), size: 16,
          color: k.Color.fromArray(N.white), align: "center" });
      }
    }
  });

  // ─── INPUT ───────────────────────────────────────────────────────

  k.onClick(() => {
    if (gameOver) {
      state = createInitialState();
      gameOver = false;
      selectedCard = null;
      return;
    }
    const mx = k.mousePos().x, my = k.mousePos().y;

    if (isEndTurnBtn(mx, my)) {
      const prevHp = state.player.hp;
      state = endTurn(state);
      if (state.player.hp < prevHp) shakeTimer = 0.28;
      selectedCard = null;
      if (state.player.hp <= 0) gameOver = true;
      return;
    }

    const cardIdx = getCardAtMouse(mx, my);
    if (cardIdx !== null) {
      if (selectedCard === cardIdx) {
        const prevHp = state.player.hp;
        state = playCard(state, cardIdx);
        if (state.player.hp < prevHp) shakeTimer = 0.15;
        flashTimer = 0.14;
        selectedCard = null;
        if (state.player.hp <= 0) gameOver = true;
      } else {
        selectedCard = cardIdx;
      }
    } else {
      selectedCard = null;
    }
  });
}
