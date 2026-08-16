/* ============ 启动入口 ============ */
"use strict";

(function boot() {
  // 首次交互时初始化音频并启动主菜单 BGM
  const initAudio = () => {
    AudioSys.init();
    AudioSys.resume();
    if (AudioSys.ctx) AudioSys.startMusic("menu");
    window.removeEventListener("pointerdown", initAudio);
    window.removeEventListener("keydown", initAudio);
  };
  window.addEventListener("pointerdown", initAudio);
  window.addEventListener("keydown", initAudio);

  Input.init();
  CodexStore.load();

  const game = new Game(document.getElementById("game"));
  window.game = game; // 便于调试

  Scenes.init(game);
  Scenes.show("menu", true);
  game.start();
})();
