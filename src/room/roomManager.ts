import type { RoomState, RoomPlayer, RoomEvent, PlayerRole } from './roomTypes';

export class RoomManager {
  private ch: BroadcastChannel;
  private _state: RoomState;
  readonly myId: string;
  private changeListeners: ((s: RoomState) => void)[] = [];
  private startListeners: (() => void)[] = [];

  constructor(code: string, me: RoomPlayer, isCreator: boolean) {
    this.myId = me.id;
    this._state = {
      code,
      status: 'waiting',
      players: { [me.id]: me },
      maxFighters: 6,
      maxTotal: 12,
    };

    this.ch = new BroadcastChannel(`nyanmagedon:${code}`);
    this.ch.onmessage = (e) => this.handle(e.data as RoomEvent);

    if (isCreator) {
      // Announce presence; any lurking tab will respond with SYNC
      this.emit({ type: 'JOIN', player: me });
    } else {
      // Request full state from existing members
      this.emit({ type: 'SYNC_REQUEST', from: me.id, player: me });
    }

    window.addEventListener('beforeunload', () => this.leave(), { once: true });
  }

  // ── Accessors ────────────────────────────────────────────────────
  get state(): RoomState { return this._state; }

  onChange(fn: (s: RoomState) => void): void { this.changeListeners.push(fn); }
  onStart(fn: () => void): void              { this.startListeners.push(fn); }

  // ── Internal ──────────────────────────────────────────────────────
  private emit(event: RoomEvent): void {
    this.ch.postMessage(event);
  }

  private snap(): RoomState {
    return { ...this._state, players: { ...this._state.players } };
  }

  private notify(): void {
    const s = this.snap();
    this.changeListeners.forEach(fn => fn(s));
  }

  private handle(event: RoomEvent): void {
    switch (event.type) {
      case 'JOIN': {
        if (!this._state.players[event.player.id]) {
          this._state.players[event.player.id] = event.player;
          this.notify();
          // Help new joiner discover us
          this.emit({ type: 'SYNC', fromId: this.myId, state: this.snap() });
        }
        break;
      }
      case 'LEAVE': {
        if (this._state.players[event.playerId]) {
          delete this._state.players[event.playerId];
          this.notify();
        }
        break;
      }
      case 'ROLE_CHANGE': {
        const p = this._state.players[event.playerId];
        if (!p) break;
        // Guard fighter cap
        if (event.role === 'fighter') {
          const occupied = Object.values(this._state.players)
            .filter(x => x.role === 'fighter' && x.id !== event.playerId).length;
          if (occupied >= this._state.maxFighters) break;
        }
        this._state.players[event.playerId] = { ...p, role: event.role };
        this.notify();
        break;
      }
      case 'SYNC_REQUEST': {
        if (event.from === this.myId) break;
        // Add the requester if unknown, then share full state
        if (!this._state.players[event.from]) {
          this._state.players[event.player.id] = event.player;
          this.notify();
        }
        this.emit({ type: 'SYNC', fromId: this.myId, state: this.snap() });
        break;
      }
      case 'SYNC': {
        if (event.fromId === this.myId) break;
        let changed = false;
        for (const [id, p] of Object.entries(event.state.players)) {
          if (!this._state.players[id]) {
            this._state.players[id] = p;
            changed = true;
          }
        }
        if (changed) this.notify();
        break;
      }
      case 'START': {
        this._state.status = 'playing';
        this.startListeners.forEach(fn => fn());
        break;
      }
    }
  }

  // ── Public actions ────────────────────────────────────────────────
  changeRole(role: PlayerRole): boolean {
    const me = this._state.players[this.myId];
    if (!me || me.role === role) return false;

    if (role === 'fighter') {
      const occupied = Object.values(this._state.players)
        .filter(p => p.role === 'fighter').length;
      if (occupied >= this._state.maxFighters) return false;
    }

    this._state.players[this.myId] = { ...me, role };
    this.emit({ type: 'ROLE_CHANGE', playerId: this.myId, role });
    this.notify();
    return true;
  }

  startGame(): void {
    const me = this._state.players[this.myId];
    if (!me?.isHost) return;
    this._state.status = 'playing';
    this.emit({ type: 'START' });
    this.startListeners.forEach(fn => fn());
  }

  leave(): void {
    try {
      this.emit({ type: 'LEAVE', playerId: this.myId });
      this.ch.close();
    } catch { /* ignore */ }
  }

  destroy(): void { this.leave(); }
}
