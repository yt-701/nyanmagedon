import type { KAPLAYCtx } from "kaplay";
import type { GameState } from "../types";
import { createInitialState, playCard, endTurn } from "../cards/gameLogic";
import { CARD_DEFS } from "../cards/cardDefs";

const COLORS = {
  bg: [15, 10, 25] as [number, number, number],
  ground: [40, 30, 20] as [number, number, number],
  sky: [20, 15, 40] as [number, number, number],
  ui: [30, 25, 50] as [number, number, number],
  card: [50, 40, 80] as [number, number, number],
  cardHover: [80, 60, 120] as [number, number, number],
  hp: [200, 50, 50] as [number, number, number],
  mana: [50, 100, 200] as [number, number, number],
  attack: [200, 80, 80] as [number, number, number],
  defense: [80, 150, 200] as [number, number, number],
  utility: [150, 200, 80] as [number, number, number],
  text: [240, 230, 255] as [number, number, number],
  gold: [255, 210, 60] as [number, number, number],
};

export function gameScene(k: KAPLAYCtx) {
  let state: GameState = createInitialState();
  let selectedCard: number | null = null;
  let gameOver = false;
  let scrollX = 0;

  const W = k.width();
  const H = k.height();
  const CARD_H = 120;
  const CARD_W = 90;
  const CARD_AREA_Y = H - CARD_H - 16;
  const UI_BAR_H = 48;

  // --- drawing helpers ---

  function drawBar(x: number, y: number, w: number, h: number, val: number, max: number, col: [number, number, number]) {
    k.drawRect({ pos: k.vec2(x, y), width: w, height: h, color: k.Color.fromArray([20, 20, 20]) });
    k.drawRect({ pos: k.vec2(x, y), width: w * (val / max), height: h, color: k.Color.fromArray(col) });
    k.drawRect({ pos: k.vec2(x, y), width: w, height: h, outline: { color: k.Color.fromArray([100, 100, 100]), width: 1 } });
  }

  function drawCatTank(x: number, y: number, facing: number = 1) {
    // Tank body
    k.drawRect({ pos: k.vec2(x - 35, y), width: 70, height: 28, color: k.Color.fromArray([80, 120, 60]), radius: 4 });
    // Turret
    k.drawRect({ pos: k.vec2(x - 18 * facing, y - 22), width: 36, height: 20, color: k.Color.fromArray([60, 100, 50]), radius: 4 });
    // Barrel
    k.drawRect({ pos: k.vec2(x + (facing > 0 ? 18 : -42), y - 16), width: 24, height: 7, color: k.Color.fromArray([50, 80, 40]) });
    // Tracks
    k.drawRect({ pos: k.vec2(x - 38, y + 22), width: 76, height: 10, color: k.Color.fromArray([40, 40, 40]), radius: 3 });
    // Cat head on top
    k.drawCircle({ pos: k.vec2(x, y - 32), radius: 16, color: k.Color.fromArray([255, 180, 80]) });
    // Ears
    k.drawTriangle({
      p1: k.vec2(x - 14, y - 42),
      p2: k.vec2(x - 5, y - 52),
      p3: k.vec2(x + 4, y - 38),
      color: k.Color.fromArray([255, 150, 60]),
    });
    k.drawTriangle({
      p1: k.vec2(x + 14, y - 42),
      p2: k.vec2(x + 5, y - 52),
      p3: k.vec2(x - 4, y - 38),
      color: k.Color.fromArray([255, 150, 60]),
    });
    // Eyes
    k.drawCircle({ pos: k.vec2(x - 6 * facing, y - 34), radius: 3, color: k.Color.fromArray([30, 20, 10]) });
    k.drawCircle({ pos: k.vec2(x + 6 * facing, y - 34), radius: 3, color: k.Color.fromArray([30, 20, 10]) });
    // Nose
    k.drawCircle({ pos: k.vec2(x, y - 29), radius: 2, color: k.Color.fromArray([255, 100, 100]) });
  }

  function drawEnemy(x: number, y: number, type: string, hp: number, maxHp: number) {
    const col: [number, number, number] = type === "boss" ? [180, 30, 30] : type === "tank" ? [100, 80, 30] : [120, 60, 40];
    // Enemy vehicle
    k.drawRect({ pos: k.vec2(x - 30, y), width: 60, height: 24, color: k.Color.fromArray(col), radius: 3 });
    k.drawRect({ pos: k.vec2(x - 20, y - 18), width: 40, height: 18, color: k.Color.fromArray([col[0] - 20, col[1] - 10, col[2] - 10] as [number, number, number]), radius: 3 });
    k.drawRect({ pos: k.vec2(x - 40, y + 20), width: 80, height: 8, color: k.Color.fromArray([30, 30, 30]), radius: 2 });
    // Skull face
    k.drawCircle({ pos: k.vec2(x, y - 28), radius: 14, color: k.Color.fromArray([230, 220, 200]) });
    k.drawCircle({ pos: k.vec2(x - 5, y - 31), radius: 4, color: k.Color.fromArray([20, 20, 20]) });
    k.drawCircle({ pos: k.vec2(x + 5, y - 31), radius: 4, color: k.Color.fromArray([20, 20, 20]) });
    // HP bar above
    drawBar(x - 30, y - 50, 60, 6, hp, maxHp, [200, 50, 50]);
  }

  function drawCard(index: number, cardId: string, isSelected: boolean, totalCards: number) {
    const spacing = Math.min(CARD_W + 12, (W - 120) / totalCards);
    const totalW = spacing * (totalCards - 1) + CARD_W;
    const startX = (W - totalW) / 2;
    const cx = startX + index * spacing;
    const cy = CARD_AREA_Y + (isSelected ? -16 : 0);

    const def = CARD_DEFS[cardId];
    const canAfford = state.player.mana >= (def?.cost ?? 99);
    const typeCol: [number, number, number] =
      def?.type === "attack" ? COLORS.attack :
      def?.type === "defense" ? COLORS.defense :
      COLORS.utility;

    // Card background
    k.drawRect({
      pos: k.vec2(cx, cy),
      width: CARD_W,
      height: CARD_H,
      color: k.Color.fromArray(isSelected ? COLORS.cardHover : COLORS.card),
      radius: 8,
    });
    if (!canAfford) {
      k.drawRect({ pos: k.vec2(cx, cy), width: CARD_W, height: CARD_H, color: k.Color.fromArray([0, 0, 0]), opacity: 0.5, radius: 8 });
    }
    // Type stripe
    k.drawRect({ pos: k.vec2(cx, cy), width: CARD_W, height: 8, color: k.Color.fromArray(typeCol), radius: 8 });
    // Border
    k.drawRect({
      pos: k.vec2(cx, cy),
      width: CARD_W,
      height: CARD_H,
      outline: { color: k.Color.fromArray(isSelected ? COLORS.gold : [80, 70, 100]), width: isSelected ? 2 : 1 },
      radius: 8,
    });
    // Card name
    k.drawText({
      text: def?.nameJa ?? cardId,
      pos: k.vec2(cx + CARD_W / 2, cy + 22),
      size: 10,
      color: k.Color.fromArray(COLORS.text),
      align: "center",
    });
    // Description
    k.drawText({
      text: def?.description ?? "",
      pos: k.vec2(cx + CARD_W / 2, cy + 55),
      size: 9,
      color: k.Color.fromArray([180, 170, 210]),
      align: "center",
      width: CARD_W - 12,
    });
    // Cost gem
    k.drawCircle({ pos: k.vec2(cx + CARD_W - 14, cy + 14), radius: 11, color: k.Color.fromArray(COLORS.mana) });
    k.drawText({
      text: String(def?.cost ?? "?"),
      pos: k.vec2(cx + CARD_W - 14, cy + 14),
      size: 12,
      color: k.Color.fromArray([255, 255, 255]),
      align: "center",
    });
  }

  function drawUI() {
    // Top bar
    k.drawRect({ pos: k.vec2(0, 0), width: W, height: UI_BAR_H, color: k.Color.fromArray(COLORS.ui) });

    // Player HP
    k.drawText({ text: "HP", pos: k.vec2(10, 10), size: 12, color: k.Color.fromArray(COLORS.text) });
    drawBar(35, 12, 120, 14, state.player.hp, state.player.maxHp, COLORS.hp);
    k.drawText({ text: `${state.player.hp}/${state.player.maxHp}`, pos: k.vec2(162, 12), size: 10, color: k.Color.fromArray(COLORS.text) });

    // Player Mana
    k.drawText({ text: "MP", pos: k.vec2(10, 28), size: 12, color: k.Color.fromArray(COLORS.text) });
    drawBar(35, 30, 120, 10, state.player.mana, state.player.maxMana, COLORS.mana);
    k.drawText({ text: `${state.player.mana}/${state.player.maxMana}`, pos: k.vec2(162, 28), size: 10, color: k.Color.fromArray(COLORS.text) });

    // Turn & score
    k.drawText({ text: `TURN ${state.turn}`, pos: k.vec2(W / 2, 14), size: 14, color: k.Color.fromArray(COLORS.gold), align: "center" });
    k.drawText({ text: `SCORE: ${state.score}`, pos: k.vec2(W / 2, 30), size: 11, color: k.Color.fromArray(COLORS.text), align: "center" });

    // Effects
    let efx = 0;
    for (const eff of state.player.effects) {
      k.drawText({ text: `[${eff.name} ${eff.duration}]`, pos: k.vec2(290 + efx * 90, 12), size: 9, color: k.Color.fromArray([180, 240, 180]) });
      efx++;
    }

    // End turn button
    const btnX = W - 110;
    const btnY = 8;
    k.drawRect({ pos: k.vec2(btnX, btnY), width: 100, height: 32, color: k.Color.fromArray([60, 40, 90]), radius: 6 });
    k.drawRect({ pos: k.vec2(btnX, btnY), width: 100, height: 32, outline: { color: k.Color.fromArray(COLORS.gold), width: 1 }, radius: 6 });
    k.drawText({ text: "ターン終了", pos: k.vec2(btnX + 50, btnY + 16), size: 11, color: k.Color.fromArray(COLORS.gold), align: "center" });

    // Card area background
    k.drawRect({ pos: k.vec2(0, CARD_AREA_Y - 20), width: W, height: CARD_H + 36, color: k.Color.fromArray([10, 8, 20]), opacity: 0.85 });
    k.drawText({ text: `手札 ${state.hand.length}枚 / デッキ ${state.deck.length}枚`, pos: k.vec2(10, CARD_AREA_Y - 14), size: 9, color: k.Color.fromArray([120, 110, 160]) });
  }

  function drawBackground() {
    // Sky gradient via rects
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      k.drawRect({
        pos: k.vec2(0, i * (H / 8)),
        width: W,
        height: H / 8 + 1,
        color: k.Color.fromArray([Math.floor(10 + t * 30), Math.floor(5 + t * 15), Math.floor(30 + t * 20)] as [number, number, number]),
      });
    }

    // Scrolling ruins
    const ruinOffsets = [0, 150, 300, 500, 700, 900];
    for (const off of ruinOffsets) {
      const rx = ((off - scrollX * 0.3) % W + W) % W;
      const rh = 60 + (off % 3) * 40;
      k.drawRect({ pos: k.vec2(rx, H - 100 - rh), width: 30, height: rh, color: k.Color.fromArray([40, 35, 30]) });
      k.drawRect({ pos: k.vec2(rx - 10, H - 100 - rh), width: 50, height: 8, color: k.Color.fromArray([50, 45, 40]) });
    }

    // Ground
    k.drawRect({ pos: k.vec2(0, H - 100), width: W, height: 100, color: k.Color.fromArray([35, 28, 18]) });
    k.drawRect({ pos: k.vec2(0, H - 100), width: W, height: 4, color: k.Color.fromArray([80, 60, 30]) });
  }

  function getCardAtMouse(mx: number, my: number): number | null {
    const totalCards = state.hand.length;
    if (totalCards === 0) return null;
    const spacing = Math.min(CARD_W + 12, (W - 120) / totalCards);
    const totalW = spacing * (totalCards - 1) + CARD_W;
    const startX = (W - totalW) / 2;
    for (let i = 0; i < totalCards; i++) {
      const cx = startX + i * spacing;
      const cy = CARD_AREA_Y;
      if (mx >= cx && mx <= cx + CARD_W && my >= cy - 20 && my <= cy + CARD_H) {
        return i;
      }
    }
    return null;
  }

  function isEndTurnBtn(mx: number, my: number) {
    return mx >= W - 110 && mx <= W - 10 && my >= 8 && my <= 40;
  }

  // --- main draw loop ---
  k.onDraw(() => {
    drawBackground();
    scrollX += 0.5;

    // Draw player tank
    drawCatTank(200, H - 140);

    // Draw enemies
    for (const enemy of state.enemies) {
      drawEnemy(enemy.x, H - 140, enemy.type, enemy.hp, enemy.maxHp);
    }

    // Draw cards
    const hover = getCardAtMouse(k.mousePos().x, k.mousePos().y);
    for (let i = 0; i < state.hand.length; i++) {
      drawCard(i, state.hand[i], i === selectedCard || i === hover, state.hand.length);
    }

    drawUI();

    if (gameOver) {
      k.drawRect({ pos: k.vec2(0, 0), width: W, height: H, color: k.Color.fromArray([0, 0, 0]), opacity: 0.7 });
      k.drawText({ text: "GAME OVER", pos: k.vec2(W / 2, H / 2 - 30), size: 48, color: k.Color.fromArray([255, 50, 50]), align: "center" });
      k.drawText({ text: `SCORE: ${state.score}`, pos: k.vec2(W / 2, H / 2 + 30), size: 24, color: k.Color.fromArray(COLORS.gold), align: "center" });
      k.drawText({ text: "クリックでリスタート", pos: k.vec2(W / 2, H / 2 + 70), size: 16, color: k.Color.fromArray(COLORS.text), align: "center" });
    }
  });

  // --- input ---
  k.onClick(() => {
    if (gameOver) {
      state = createInitialState();
      gameOver = false;
      selectedCard = null;
      return;
    }

    const mx = k.mousePos().x;
    const my = k.mousePos().y;

    if (isEndTurnBtn(mx, my)) {
      state = endTurn(state);
      selectedCard = null;
      if (state.player.hp <= 0) gameOver = true;
      return;
    }

    const cardIdx = getCardAtMouse(mx, my);
    if (cardIdx !== null) {
      if (selectedCard === cardIdx) {
        state = playCard(state, cardIdx);
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
