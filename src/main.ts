import './styles.css';
import type { RoomPlayer } from './room/roomTypes';
import { createTitleScene } from './scenes/titleScene';
import { createRoomScene }  from './scenes/roomScene';
import { createGameScene }  from './scenes/gameScene';

const container = document.createElement('div');
container.id = 'nyan-container';
document.body.appendChild(container);

// Scale 960×540 to fill the viewport while preserving aspect ratio
function resizeContainer(): void {
  const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540);
  container.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', resizeContainer);
resizeContainer();

let stopCurrent: (() => void) | null = null;

function goTitle() {
  stopCurrent?.();
  container.innerHTML = '';
  stopCurrent = createTitleScene(container, goRoom);
}

function goRoom(code: string, me: RoomPlayer, isCreator: boolean) {
  stopCurrent?.();
  container.innerHTML = '';
  stopCurrent = createRoomScene(container, code, me, isCreator, goGame, goTitle);
}

function goGame() {
  stopCurrent?.();
  container.innerHTML = '';
  stopCurrent = createGameScene(container, goTitle);
}

goTitle();
