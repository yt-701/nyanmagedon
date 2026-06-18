import './styles.css';
import { createTitleScene } from './scenes/titleScene';
import { createGameScene } from './scenes/gameScene';

const container = document.createElement('div');
container.id = 'nyan-container';
document.body.appendChild(container);

let stopCurrent: (() => void) | null = null;

function goTitle() {
  stopCurrent?.();
  container.innerHTML = '';
  stopCurrent = createTitleScene(container, goGame);
}

function goGame() {
  stopCurrent?.();
  container.innerHTML = '';
  stopCurrent = createGameScene(container, goTitle);
}

goTitle();
