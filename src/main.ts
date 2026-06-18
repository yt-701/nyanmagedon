import kaplay from "kaplay";
import { titleScene } from "./scenes/titleScene";
import { gameScene } from "./scenes/gameScene";

const k = kaplay({
  width: 960,
  height: 540,
  letterbox: true,
  background: [10, 8, 20],
});

k.scene("title", () => titleScene(k));
k.scene("game", () => gameScene(k));

k.go("title");
