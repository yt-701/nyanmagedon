import type { KAPLAYCtx } from "kaplay";

interface Star { x: number; y: number; r: number; phase: number; speed: number }

export function titleScene(k: KAPLAYCtx) {
  const W = k.width();
  const H = k.height();
  let t = 0;

  const stars: Star[] = Array.from({ length: 200 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.78,
    r: Math.random() * 1.5 + 0.3,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.8 + 0.3,
  }));

  const ruins = [
    { x: 0,   w: 35, h: 85,  win: true  },
    { x: 45,  w: 20, h: 120, win: false },
    { x: 75,  w: 50, h: 55,  win: true  },
    { x: 140, w: 22, h: 110, win: true  },
    { x: 175, w: 40, h: 70,  win: false },
    { x: 680, w: 45, h: 95,  win: true  },
    { x: 740, w: 25, h: 130, win: false },
    { x: 780, w: 55, h: 65,  win: true  },
    { x: 855, w: 28, h: 105, win: true  },
    { x: 900, w: 55, h: 80,  win: false },
  ];

  k.onDraw(() => {
    t += k.dt();

    // === SKY GRADIENT ===
    for (let i = 0; i < 20; i++) {
      const f = i / 20;
      k.drawRect({
        pos: k.vec2(0, i * (H / 20)),
        width: W, height: H / 20 + 1,
        color: k.Color.fromArray([
          Math.floor(4 + f * 18),
          Math.floor(0 + f * 5),
          Math.floor(16 + f * 38),
        ] as [number, number, number]),
      });
    }

    // === NEBULA BLOBS ===
    const nebulae: { x: number; y: number; r: number; col: [number, number, number] }[] = [
      { x: W * 0.18, y: H * 0.18, r: 110, col: [70, 15, 110] },
      { x: W * 0.78, y: H * 0.12, r: 90,  col: [15, 50, 110] },
      { x: W * 0.50, y: H * 0.32, r: 140, col: [55, 0,  95 ] },
    ];
    for (const n of nebulae) {
      for (let layer = 4; layer >= 0; layer--) {
        k.drawCircle({ pos: k.vec2(n.x, n.y), radius: n.r * (1 + layer * 0.7),
          color: k.Color.fromArray(n.col), opacity: 0.03 + layer * 0.005 });
      }
    }

    // === STARS ===
    for (const s of stars) {
      const b = 0.5 + Math.sin(t * s.speed + s.phase) * 0.5;
      const c = Math.floor(160 + b * 95);
      k.drawCircle({
        pos: k.vec2(s.x, s.y),
        radius: s.r * (0.7 + b * 0.3),
        color: k.Color.fromArray([c, c, Math.min(255, c + 30)] as [number, number, number]),
        opacity: 0.35 + b * 0.65,
      });
    }

    // === MOON ===
    const mx = W * 0.82, my = H * 0.2;
    k.drawCircle({ pos: k.vec2(mx, my), radius: 62, color: k.Color.fromArray([200, 180, 110]), opacity: 0.05 });
    k.drawCircle({ pos: k.vec2(mx, my), radius: 50, color: k.Color.fromArray([225, 205, 135]), opacity: 0.09 });
    k.drawCircle({ pos: k.vec2(mx, my), radius: 40, color: k.Color.fromArray([248, 238, 200]) });
    k.drawCircle({ pos: k.vec2(mx - 11, my - 7), radius: 6,  color: k.Color.fromArray([228, 218, 180]), opacity: 0.8 });
    k.drawCircle({ pos: k.vec2(mx + 14, my + 11), radius: 5, color: k.Color.fromArray([228, 218, 180]), opacity: 0.8 });
    k.drawCircle({ pos: k.vec2(mx + 4, my - 16), radius: 3.5, color: k.Color.fromArray([228, 218, 180]), opacity: 0.8 });
    // Subtle shadow phase
    k.drawCircle({ pos: k.vec2(mx + 14, my), radius: 38, color: k.Color.fromArray([4, 0, 18]), opacity: 0.12 });

    // === RUINS SILHOUETTE ===
    const ruinBaseY = H - 118;
    for (const r of ruins) {
      const ry = ruinBaseY - r.h;
      k.drawRect({ pos: k.vec2(r.x, ry), width: r.w, height: r.h + 2, color: k.Color.fromArray([10, 6, 26]) });
      k.drawRect({ pos: k.vec2(r.x - 4, ry - 4), width: r.w + 8, height: 5, color: k.Color.fromArray([14, 9, 32]) });
      if (r.win && r.h > 60) {
        for (let wi = 0; wi < Math.floor(r.h / 28); wi++) {
          const lit = Math.sin(t * 0.6 + r.x * 0.1 + wi * 1.3) > 0.4;
          const wc: [number, number, number] = lit ? [70, 50, 180] : [18, 12, 45];
          k.drawRect({ pos: k.vec2(r.x + 5, ry + 8 + wi * 26), width: 7, height: 10,
            color: k.Color.fromArray(wc), opacity: lit ? 0.9 : 0.35 });
          if (r.w > 25) {
            k.drawRect({ pos: k.vec2(r.x + r.w - 12, ry + 8 + wi * 26), width: 7, height: 10,
              color: k.Color.fromArray(wc), opacity: lit ? 0.9 : 0.35 });
          }
        }
      }
    }

    // === GROUND ===
    k.drawRect({ pos: k.vec2(0, H - 118), width: W, height: 118, color: k.Color.fromArray([6, 4, 18]) });

    // Synthwave grid
    const gy = H - 118;
    for (let i = -9; i <= 9; i++) {
      k.drawLine({ p1: k.vec2(W / 2 + i * 8, gy), p2: k.vec2(W / 2 + i * 75, H),
        width: 1, color: k.Color.fromArray([180, 0, 255]), opacity: 0.22 });
    }
    for (let row = 1; row <= 7; row++) {
      const f = (row / 7) ** 1.6;
      const lineY = gy + f * 118;
      k.drawLine({ p1: k.vec2(0, lineY), p2: k.vec2(W, lineY),
        width: 1, color: k.Color.fromArray([255, 0, 200]), opacity: 0.18 * (1 - f * 0.4) });
    }
    // Horizon glow
    k.drawRect({ pos: k.vec2(0, gy - 1), width: W, height: 2, color: k.Color.fromArray([180, 0, 255]), opacity: 0.85 });
    k.drawRect({ pos: k.vec2(0, gy - 4), width: W, height: 4, color: k.Color.fromArray([140, 0, 200]), opacity: 0.18 });

    // === TITLE ===
    const pulse = 1 + Math.sin(t * 1.8) * 0.014;
    const tsz = 56 * pulse;
    // Chromatic aberration
    k.drawText({ text: "NYANMAGEDON", pos: k.vec2(W / 2 - 3, H * 0.37),
      size: tsz, color: k.Color.fromArray([255, 0, 80]), align: "center", opacity: 0.35 });
    k.drawText({ text: "NYANMAGEDON", pos: k.vec2(W / 2 + 3, H * 0.37),
      size: tsz, color: k.Color.fromArray([0, 200, 255]), align: "center", opacity: 0.35 });
    // Glow bloom
    k.drawText({ text: "NYANMAGEDON", pos: k.vec2(W / 2, H * 0.37),
      size: tsz + 6, color: k.Color.fromArray([255, 180, 50]), align: "center", opacity: 0.12 });
    // Main
    k.drawText({ text: "NYANMAGEDON", pos: k.vec2(W / 2, H * 0.37),
      size: tsz, color: k.Color.fromArray([255, 212, 60]), align: "center" });

    // Separator
    const lg = 0.5 + Math.sin(t * 2.2) * 0.35;
    k.drawRect({ pos: k.vec2(W / 2 - 170, H * 0.37 + 40), width: 340, height: 1,
      color: k.Color.fromArray([200, 80, 255]), opacity: lg * 0.45 });
    k.drawRect({ pos: k.vec2(W / 2 - 100, H * 0.37 + 41), width: 200, height: 2,
      color: k.Color.fromArray([220, 120, 255]), opacity: lg });

    // Subtitle
    k.drawText({ text: "ねこ戦車の世紀末カードバトル",
      pos: k.vec2(W / 2, H * 0.37 + 58), size: 17,
      color: k.Color.fromArray([140, 215, 255]), align: "center" });

    // START PROMPT
    const bp = 0.65 + Math.sin(t * 3.2) * 0.35;
    if (Math.floor(t * 1.4) % 2 === 0) {
      k.drawRect({ pos: k.vec2(W / 2 - 120, H * 0.62 - 16), width: 240, height: 30,
        color: k.Color.fromArray([200, 0, 255]), opacity: bp * 0.1, radius: 5 });
      k.drawText({ text: "▶  クリックしてスタート  ◀",
        pos: k.vec2(W / 2, H * 0.62), size: 18,
        color: k.Color.fromArray([255, 80, 255]), align: "center", opacity: bp });
    }

    // Hint
    k.drawText({ text: "カードを選んでクリック → もう一度クリックで発動",
      pos: k.vec2(W / 2, H - 32), size: 11,
      color: k.Color.fromArray([90, 80, 140]), align: "center" });

    k.drawText({ text: "v0.1", pos: k.vec2(W - 14, H - 16), size: 9,
      color: k.Color.fromArray([55, 45, 85]), align: "right" });
  });

  k.onClick(() => k.go("game"));
}
