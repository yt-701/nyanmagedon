import type { GameEvent } from './gameTypes';

export class GameChannel {
  private ch: BroadcastChannel;
  private myId: string;
  private listeners: ((e: GameEvent) => void)[] = [];

  constructor(roomCode: string, myId: string) {
    this.myId = myId;
    this.ch = new BroadcastChannel(`nyanmagedon-battle:${roomCode}`);
    this.ch.onmessage = (evt) => {
      const payload = evt.data as GameEvent & { _from: string };
      if (payload._from === this.myId) return;
      this.listeners.forEach(fn => fn(payload));
    };
  }

  send(event: GameEvent): void {
    this.ch.postMessage({ ...event, _from: this.myId });
  }

  onEvent(fn: (e: GameEvent) => void): void {
    this.listeners.push(fn);
  }

  destroy(): void {
    try { this.ch.close(); } catch { /* ignore */ }
  }
}
