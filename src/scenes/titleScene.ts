import type { KAPLAYCtx } from "kaplay";

export function titleScene(k: KAPLAYCtx) {
  const W = k.width();
  const H = k.height();
  let t = 0;

  k.onDraw(() => {
    t += k.dt();

    // Background
    for (let i = 0; i < 8; i++) {
      const frac = i / 8;
      k.drawRect({
        pos: k.vec2(0, i * (H / 8)),
        width: W,
        height: H / 8 + 1,
        color: k.Color.fromArray([Math.floor(10 + frac * 20), Math.floor(5 + frac * 10), Math.floor(30 + frac * 30)] as [number, number, number]),
      });
    }

    // Pulsing title
    const pulse = 1 + Math.sin(t * 2) * 0.03;
    k.drawText({
      text: "NYANMAGEDON",
      pos: k.vec2(W / 2, H / 2 - 80),
      size: 52 * pulse,
      color: k.Color.fromArray([255, 200, 60]),
      align: "center",
    });

    k.drawText({
      text: "ねこ戦車の世紀末カードバトル",
      pos: k.vec2(W / 2, H / 2 - 20),
      size: 18,
      color: k.Color.fromArray([200, 180, 255]),
      align: "center",
    });

    // Blink
    if (Math.floor(t * 2) % 2 === 0) {
      k.drawText({
        text: "クリックしてスタート",
        pos: k.vec2(W / 2, H / 2 + 60),
        size: 20,
        color: k.Color.fromArray([255, 255, 255]),
        align: "center",
      });
    }

    k.drawText({
      text: "カードを選んでクリック → もう一度クリックで発動",
      pos: k.vec2(W / 2, H - 40),
      size: 12,
      color: k.Color.fromArray([120, 110, 160]),
      align: "center",
    });
  });

  k.onClick(() => {
    k.go("game");
  });
}
