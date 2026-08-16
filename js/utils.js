/* ============ 工具函数 ============ */
"use strict";

const TAU = Math.PI * 2;

function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.hypot(dx, dy); }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

/* 颜色明暗：amt > 0 提亮（混白），amt < 0 压暗（乘系数） */
function shadeColor(hex, amt) {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16) || 0;
  let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; gg += (255 - gg) * amt; b += (255 - b) * amt;
  } else {
    const k = 1 + amt;
    r *= k; gg *= k; b *= k;
  }
  return "rgb(" + Math.round(r) + "," + Math.round(gg) + "," + Math.round(b) + ")";
}

/* 圆 vs 矩形的最近点距离 */
function circleRectDist(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return dist(cx, cy, nx, ny) - r;
}

/* 圆 vs 矩形碰撞（返回推离向量） */
function circleRectResolve(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  let dx = cx - nx, dy = cy - ny;
  const d = Math.hypot(dx, dy);
  if (d >= r) return null;
  if (d < 0.0001) {
    // 圆心在矩形内部：推到最近的边
    const left = cx - rect.x, right = rect.x + rect.w - cx;
    const top = cy - rect.y, bottom = rect.y + rect.h - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: -(r + left), y: 0 };
    if (m === right) return { x: r + right, y: 0 };
    if (m === top) return { x: 0, y: -(r + top) };
    return { x: 0, y: r + bottom };
  }
  const push = r - d;
  return { x: (dx / d) * push, y: (dy / d) * push };
}

/* 文本辅助 */
function padNum(n, len) { return String(n).padStart(len, "0"); }

/* 简易深拷贝 */
function clone(v) { return JSON.parse(JSON.stringify(v)); }
