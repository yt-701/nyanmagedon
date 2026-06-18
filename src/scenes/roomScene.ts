import type { RoomState, RoomPlayer, PlayerRole } from '../room/roomTypes';
import { RoomManager } from '../room/roomManager';
import { getAvatar } from '../room/utils';

const MAX_FIGHTERS  = 6;
const MAX_SPECTATORS = 6;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Player card ──────────────────────────────────────────────────────

function playerCardHtml(
  p: RoomPlayer,
  isMe: boolean,
  targetRole: PlayerRole,
  switchDisabled: boolean,
): string {
  const switchLabel = targetRole === 'spectator' ? '👁&nbsp;観戦へ' : '⚔️&nbsp;対戦へ';
  const disabledAttr = switchDisabled ? 'disabled title="対戦者は満員です（6/6）"' : '';
  return `
    <div class="nr-card${isMe ? ' nr-card--me' : ''}">
      <span class="nr-card-avatar">${getAvatar(p.id)}</span>
      <div class="nr-card-info">
        <span class="nr-card-name">${esc(p.name)}${isMe ? ' <span class="nr-you-tag">あなた</span>' : ''}</span>
        ${p.isHost ? '<span class="nr-host-tag">★ HOST</span>' : ''}
      </div>
      ${isMe
        ? `<button class="nr-switch" data-to="${targetRole}" ${disabledAttr}>${switchLabel}</button>`
        : ''}
    </div>
  `;
}

function emptySlotHtml(n: number): string {
  return Array.from({ length: n }, () =>
    '<div class="nr-empty-slot"><span>空き</span></div>'
  ).join('');
}

// ── Render ────────────────────────────────────────────────────────────

function render(state: RoomState, myId: string, mgr: RoomManager): void {
  const all       = Object.values(state.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const fighters  = all.filter(p => p.role === 'fighter');
  const spectators= all.filter(p => p.role === 'spectator');
  const total     = all.length;
  const myPlayer  = state.players[myId];
  const iAmHost   = myPlayer?.isHost ?? false;
  const myRole    = myPlayer?.role ?? 'spectator';

  // Top bar counts
  const pcEl = document.getElementById('nr-player-count');
  if (pcEl) pcEl.textContent = `参加中 ${total}/12人`;

  // Fighter column
  const fCnt  = document.getElementById('nr-fighter-cnt');
  const fList = document.getElementById('nr-fighter-list');
  if (fCnt)  fCnt.textContent  = `${fighters.length}/6`;
  if (fList) {
    fList.innerHTML = fighters.map(p =>
      playerCardHtml(p, p.id === myId, 'spectator', false)
    ).join('') + emptySlotHtml(Math.max(0, MAX_FIGHTERS - fighters.length));
  }

  // Spectator column
  const sCnt  = document.getElementById('nr-spec-cnt');
  const sList = document.getElementById('nr-spec-list');
  if (sCnt)  sCnt.textContent  = `${spectators.length}/6`;
  if (sList) {
    const fightersFull = fighters.length >= MAX_FIGHTERS;
    sList.innerHTML = spectators.map(p =>
      playerCardHtml(p, p.id === myId, 'fighter', fightersFull)
    ).join('') + emptySlotHtml(Math.max(0, MAX_SPECTATORS - spectators.length));
  }

  // My role indicator chip
  const myChip = document.getElementById('nr-my-role');
  if (myChip) {
    myChip.textContent = myRole === 'fighter' ? '⚔️ 対戦者として参加中' : '👁 観戦者として参加中';
    myChip.className = `nr-my-role nr-my-role--${myRole}`;
  }

  // Bottom bar
  const startBtn  = document.getElementById('nr-start-btn') as HTMLButtonElement | null;
  const statusMsg = document.getElementById('nr-status-msg');
  if (iAmHost) {
    startBtn?.style.setProperty('display', 'flex');
    if (statusMsg) statusMsg.style.display = 'none';
    if (startBtn) {
      const hasEnough = fighters.length >= 1;
      startBtn.disabled = !hasEnough;
      startBtn.title = hasEnough ? '' : '対戦者が最低1人必要です';
    }
  } else {
    startBtn?.style.setProperty('display', 'none');
    if (statusMsg) {
      statusMsg.style.display = 'block';
      statusMsg.textContent = `ホストがゲームを開始するまでお待ちください  (対戦者 ${fighters.length}人)`;
    }
  }

  // Wire up switch buttons (re-attach after innerHTML replace)
  document.querySelectorAll('.nr-switch').forEach(btn => {
    btn.addEventListener('click', () => {
      const role = (btn as HTMLElement).dataset.to as PlayerRole;
      mgr.changeRole(role);
    }, { once: true });
  });
}

// ── Scene entry ───────────────────────────────────────────────────────

export function createRoomScene(
  container: HTMLElement,
  code: string,
  me: RoomPlayer,
  isCreator: boolean,
  onGameStart: () => void,
  onLeave: () => void,
): () => void {
  const root = document.createElement('div');
  root.id = 'nr-room';
  root.innerHTML = `
    <div id="nr-topbar">
      <span class="nr-logo">🐱&nbsp;NYANMAGEDON</span>
      <div class="nr-tb-sep"></div>
      <div class="nr-code-wrap">
        <span class="nr-code-lbl">ROOM</span>
        <span class="nr-code-val">${code}</span>
        <button class="nr-copy-mini" id="nr-copy-btn" title="コードをコピー">📋</button>
      </div>
      <span class="nr-player-count" id="nr-player-count">参加中 1/12人</span>
      <button class="nr-leave-btn" id="nr-leave-btn">← 退出する</button>
    </div>

    <div id="nr-main">
      <div class="nr-col">
        <div class="nr-col-head nr-col-head--fighter">
          <span>⚔️ 対戦者</span>
          <span class="nr-col-cnt" id="nr-fighter-cnt">0/6</span>
        </div>
        <div class="nr-player-list" id="nr-fighter-list"></div>
      </div>

      <div class="nr-col-sep"></div>

      <div class="nr-col">
        <div class="nr-col-head nr-col-head--spec">
          <span>👁 観戦者</span>
          <span class="nr-col-cnt" id="nr-spec-cnt">0/6</span>
        </div>
        <div class="nr-player-list" id="nr-spec-list"></div>
      </div>
    </div>

    <div id="nr-bottom">
      <span id="nr-my-role" class="nr-my-role"></span>
      <span class="nr-status-msg" id="nr-status-msg"></span>
      <button class="nr-start-btn" id="nr-start-btn" style="display:none">
        ⚔️&nbsp;ゲームスタート ▶
      </button>
    </div>
  `;
  container.appendChild(root);

  const mgr = new RoomManager(code, me, isCreator);
  mgr.onChange(s => render(s, me.id, mgr));
  mgr.onStart(onGameStart);

  // Initial render
  render(mgr.state, me.id, mgr);

  // Top-bar buttons
  (document.getElementById('nr-leave-btn') as HTMLButtonElement).onclick = () => {
    mgr.destroy();
    onLeave();
  };

  (document.getElementById('nr-copy-btn') as HTMLButtonElement).onclick = async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    const btn = document.getElementById('nr-copy-btn') as HTMLButtonElement;
    btn.textContent = '✅';
    setTimeout(() => { btn.textContent = '📋'; }, 1400);
  };

  (document.getElementById('nr-start-btn') as HTMLButtonElement).onclick = () => mgr.startGame();

  return () => {
    mgr.destroy();
    root.remove();
  };
}
