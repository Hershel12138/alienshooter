/* ============ 输入系统 ============ */
"use strict";

const Input = {
  keys: new Set(),        // 当前按住的键
  pressed: new Set(),     // 本帧新按下的键
  mouse: { x: 0, y: 0, down: false, rdown: false },
  mousePressed: false,
  mouseRPressed: false,
  wheel: 0,

  init() {
    window.addEventListener("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
      if (!e.repeat && !this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => { this.keys.delete(e.code); });
    window.addEventListener("mousemove", (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mousePressed = true; }
      if (e.button === 2) { this.mouse.rdown = true; this.mouseRPressed = true; }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    window.addEventListener("wheel", (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", () => { this.keys.clear(); this.pressed.clear(); this.mouse.down = false; this.mouse.rdown = false; });
  },

  down(code) { return this.keys.has(code); },
  wasPressed(code) { return this.pressed.has(code); },

  /* 每帧结束调用，清空“本帧按下”记录 */
  endFrame() { this.pressed.clear(); this.mousePressed = false; this.mouseRPressed = false; this.wheel = 0; },
};
