import type { GameState, EnemyState, CardId } from "../types";
import { CARD_DEFS, STARTER_DECK } from "./cardDefs";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createInitialState(): GameState {
  const deck = shuffle([...STARTER_DECK]) as CardId[];
  const hand = deck.splice(0, 5) as CardId[];
  return {
    player: {
      hp: 100,
      maxHp: 100,
      mana: 3,
      maxMana: 3,
      effects: [],
      x: 200,
      y: 300,
    },
    enemies: createWave(1),
    hand,
    deck,
    discard: [],
    turn: 1,
    phase: "player",
    score: 0,
  };
}

function createWave(wave: number): EnemyState[] {
  const count = Math.min(1 + Math.floor(wave / 2), 3);
  return Array.from({ length: count }, (_, i) => ({
    id: `enemy_${wave}_${i}`,
    hp: 30 + wave * 10,
    maxHp: 30 + wave * 10,
    atk: 5 + wave * 2,
    x: 700 + i * 120,
    y: 300,
    type: wave % 5 === 0 ? "boss" : wave % 3 === 0 ? "tank" : "grunt",
    effects: [],
  }));
}

export function playCard(state: GameState, cardIndex: number): GameState {
  const cardId = state.hand[cardIndex];
  const def = CARD_DEFS[cardId];
  if (!def || state.player.mana < def.cost) return state;

  const next: GameState = JSON.parse(JSON.stringify(state));
  next.player.mana -= def.cost;
  next.hand.splice(cardIndex, 1);
  next.discard.push(cardId);

  def.effect({
    player: next.player,
    enemies: next.enemies,
    addMana: (n) => { next.player.mana = Math.min(next.player.mana + n, next.player.maxMana); },
    dealDamage: (i, dmg) => {
      if (next.enemies[i]) {
        next.enemies[i].hp = Math.max(0, next.enemies[i].hp - dmg);
        if (next.enemies[i].hp === 0) {
          next.score += 100;
        }
      }
    },
    healPlayer: (n) => { next.player.hp = Math.min(next.player.hp + n, next.player.maxHp); },
    addEffect: (name, duration) => { next.player.effects.push({ name, duration }); },
  });

  next.enemies = next.enemies.filter((e) => e.hp > 0);
  return next;
}

export function endTurn(state: GameState): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state));

  // Enemy attacks
  for (const enemy of next.enemies) {
    const hasShield = next.player.effects.some((e) => e.name === "shield");
    if (!hasShield) {
      next.player.hp = Math.max(0, next.player.hp - enemy.atk);
    }
  }

  // Tick effects
  next.player.effects = next.player.effects
    .map((e) => ({ ...e, duration: e.duration - 1 }))
    .filter((e) => e.duration > 0);

  // Refill mana and draw cards
  next.player.mana = next.player.maxMana;
  next.turn += 1;

  // Draw up to 5 cards
  const drawCount = 5 - next.hand.length;
  for (let i = 0; i < drawCount; i++) {
    if (next.deck.length === 0) {
      next.deck = shuffle(next.discard);
      next.discard = [];
    }
    if (next.deck.length > 0) {
      next.hand.push(next.deck.shift()!);
    }
  }

  // Spawn new wave if all enemies defeated
  if (next.enemies.length === 0) {
    next.enemies = createWave(next.turn);
  }

  return next;
}
