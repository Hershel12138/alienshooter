/* ============ 地图：沙地/实验室贴图 / 障碍物 / 血迹 / 出生点 ============ */
"use strict";

/* ---------- 程序化贴图（零外部资源） ---------- */
function makeSandTile() {
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const g = c.getContext("2d");
  // 底色：沙土色（与实验室地面统一）
  g.fillStyle = "#c9a76e";
  g.fillRect(0, 0, 160, 160);
  // 深浅沙色斑（沙丘明暗）
  for (let i = 0; i < 16; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(170,132,80,0.4)" : "rgba(214,180,120,0.4)";
    g.beginPath();
    g.ellipse(rand(0, 160), rand(0, 160), rand(16, 44), rand(10, 30), rand(0, TAU), 0, TAU);
    g.fill();
  }
  // 沙粒
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(120,92,52,0.4)" : "rgba(240,216,160,0.4)";
    g.fillRect(Math.random() * 160, Math.random() * 160, 1.4, 1.4);
  }
  // 干枯草簇（土黄/褐，稀疏）
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * 160, y = Math.random() * 160;
    const h = rand(5, 11);
    const lean = rand(-0.6, 0.6);
    g.strokeStyle = Math.random() < 0.5 ? "rgba(190,160,100,0.75)" : "rgba(150,118,66,0.75)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + lean * 3, y - h * 0.6, x + lean * 5.5, y - h);
    g.stroke();
  }
  // 小石子
  for (let i = 0; i < 14; i++) {
    g.fillStyle = "rgba(122,100,70,0.4)";
    g.beginPath(); g.ellipse(Math.random() * 160, Math.random() * 160, rand(2, 5), rand(1.5, 3.5), rand(0, TAU), 0, TAU); g.fill();
  }
  // 稀疏暗沙斑
  for (let i = 0; i < 16; i++) {
    g.fillStyle = "rgba(110,84,48,0.25)";
    g.beginPath();
    g.ellipse(Math.random() * 160, Math.random() * 160, rand(6, 14), rand(4, 9), rand(0, TAU), 0, TAU);
    g.fill();
  }
  return c;
}

function makeLabTile() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  // 实验室地面：沙土色瓷砖（荒漠基地风格）
  g.fillStyle = "#b8976a";
  g.fillRect(0, 0, 128, 128);
  // 瓷砖 4 格（每格 64）
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const x = tx * 64, y = ty * 64;
      const shade = Math.random();
      g.fillStyle = shade < 0.5 ? "rgba(160,130,84,0.45)" : "rgba(200,168,110,0.4)";
      g.fillRect(x + 2, y + 2, 60, 60);
      // 沙粒
      for (let s = 0; s < 14; s++) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(120,95,58,0.5)" : "rgba(230,205,150,0.5)";
        g.fillRect(x + rand(4, 58), y + rand(4, 58), 1.6, 1.6);
      }
      // 接缝（深沙棕）
      g.strokeStyle = "rgba(92,66,36,0.9)";
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, 62, 62);
      // 陈旧血迹/污渍
      if (Math.random() < 0.6) {
        g.fillStyle = "rgba(120,40,40,0.13)";
        g.beginPath(); g.ellipse(x + rand(10, 54), y + rand(10, 54), rand(6, 14), rand(4, 9), rand(0, TAU), 0, TAU); g.fill();
      }
    }
  }
  // 大网格加强线
  g.strokeStyle = "rgba(80,56,30,0.55)";
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, 127, 127);
  return c;
}

const MapSys = {
  obstacles: [],      // {x,y,w,h,kind,kind2,hp}
  crates: [],         // 交互补给箱 {x,y,kind:'weapon'|'ammo',weaponId,taken}
  spawnPoints: [],
  decal: null,
  decalCtx: null,
  labMode: false,     // 第一关：实验室室内
  sandPattern: null,
  labPattern: null,

  build() {
    this.obstacles = [];
    this.crates = [];
    this.spawnPoints = [];
    const A = CFG.ARENA, W = CFG.WALL;
    this.labMode = LevelSys.n === 1;   // 第一关为实验室

    // 出血迹画布
    this.decal = document.createElement("canvas");
    this.decal.width = A.w;
    this.decal.height = A.h;
    this.decalCtx = this.decal.getContext("2d");

    // 出生点：沿场地边缘均匀分布
    const perSide = 10;
    for (let i = 0; i < perSide; i++) {
      const t = (i + 0.5) / perSide;
      this.spawnPoints.push({ x: W + 40 + t * (A.w - 2 * W - 80), y: W + 30 });
      this.spawnPoints.push({ x: W + 40 + t * (A.w - 2 * W - 80), y: A.h - W - 30 });
      this.spawnPoints.push({ x: W + 30, y: W + 40 + t * (A.h - 2 * W - 80) });
      this.spawnPoints.push({ x: A.w - W - 30, y: W + 40 + t * (A.h - 2 * W - 80) });
    }

    if (this.labMode) this._buildLab();
    else this._buildOutdoor();

    // 交互补给箱：每关 1 武器箱 + 2 弹药箱 + 1 急救箱
    this.crates.push(Object.assign(this._randCratePos(), { kind: "weapon", weaponId: null, taken: false }));
    for (let i = 0; i < 2; i++) {
      this.crates.push(Object.assign(this._randCratePos(), { kind: "ammo", taken: false }));
    }
    this.crates.push(Object.assign(this._randCratePos(), { kind: "health", taken: false }));

    // 静态装饰贴图（画入血迹画布，运行时零开销）
    this._paintDecor();
  },

  /* ---------- 场景装饰（程序化，异形入侵废墟风） ---------- */
  _paintDecor() {
    const g = this.decalCtx;
    if (!g) return;
    if (this.labMode) this._paintLabDecor(g);
    else this._paintOutdoorDecor(g);
  },

  _paintOutdoorDecor(g) {
    const A = CFG.ARENA, W = CFG.WALL;
    const cx0 = A.w / 2, cy0 = A.h / 2, doorX = A.w - W - 60, doorY = A.h / 2;
    const nearSpawn = (x, y, r) => dist(x, y, cx0, cy0) < r || dist(x, y, doorX, doorY) < r;

    // 沙丘明暗带
    for (let i = 0; i < 8; i++) {
      const x = rand(W + 80, A.w - W - 80), y = rand(W + 80, A.h - W - 80);
      if (nearSpawn(x, y, 200)) continue;
      g.fillStyle = Math.random() < 0.5 ? "rgba(214,182,122,0.22)" : "rgba(150,116,70,0.2)";
      g.beginPath(); g.ellipse(x, y, rand(60, 140), rand(30, 70), rand(0, TAU), 0, TAU); g.fill();
    }

    // 碎石堆（沙漠岩石）
    for (let i = 0; i < 40; i++) {
      const x = rand(W + 40, A.w - W - 40), y = rand(W + 40, A.h - W - 40);
      if (nearSpawn(x, y, 180)) continue;
      const n = randi(3, 6);
      g.fillStyle = `rgba(${randi(130, 150)},${randi(112, 130)},${randi(84, 100)},${rand(0.3, 0.6)})`;
      g.beginPath();
      for (let j = 0; j < n; j++) {
        const a = (j / n) * TAU + rand(0, 1);
        const rr = rand(4, 12);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.7;
        if (j === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath(); g.fill();
    }

    // 泥泞车辙（斜穿场地，深沙色）
    g.strokeStyle = "rgba(122,94,58,0.28)";
    g.lineWidth = 26;
    g.beginPath();
    g.moveTo(W + 80, A.h * 0.78);
    g.quadraticCurveTo(A.w * 0.45, A.h * 0.58, A.w - W - 80, A.h * 0.28);
    g.stroke();
    g.strokeStyle = "rgba(150,118,76,0.22)";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(W + 80, A.h * 0.78);
    g.quadraticCurveTo(A.w * 0.45, A.h * 0.58, A.w - W - 80, A.h * 0.28);
    g.stroke();

    // 烧焦痕迹
    for (let i = 0; i < 12; i++) {
      const x = rand(W + 60, A.w - W - 60), y = rand(W + 60, A.h - W - 60);
      if (nearSpawn(x, y, 200)) continue;
      g.fillStyle = "rgba(25,22,20,0.35)";
      g.beginPath(); g.ellipse(x, y, rand(16, 46), rand(12, 34), rand(0, TAU), 0, TAU); g.fill();
      g.fillStyle = "rgba(10,10,10,0.3)";
      g.beginPath(); g.ellipse(x + rand(-6, 6), y + rand(-6, 6), rand(8, 20), rand(6, 14), rand(0, TAU), 0, TAU); g.fill();
    }

    // 异形菌毯（暗红紫蔓延斑）
    for (let i = 0; i < 16; i++) {
      const x = rand(W + 40, A.w - W - 40), y = rand(W + 40, A.h - W - 40);
      if (nearSpawn(x, y, 220)) continue;
      g.fillStyle = `rgba(${randi(60, 80)},${randi(20, 30)},${randi(40, 55)},${rand(0.15, 0.3)})`;
      g.beginPath(); g.ellipse(x, y, rand(20, 60), rand(14, 42), rand(0, TAU), 0, TAU); g.fill();
      for (let j = 0; j < 6; j++) {
        const a = rand(0, TAU), d = rand(8, 30);
        g.strokeStyle = "rgba(120,50,80,0.3)";
        g.lineWidth = rand(1.5, 3);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * d * 0.5, y + Math.sin(a) * d * 0.5, x + Math.cos(a) * d, y + Math.sin(a) * d);
        g.stroke();
      }
    }

    // 异形卵（蛋）
    for (let i = 0; i < 8; i++) {
      const x = rand(W + 120, A.w - W - 120), y = rand(W + 120, A.h - W - 120);
      if (nearSpawn(x, y, 260)) continue;
      const rw = rand(10, 16), rh = rand(14, 20);
      g.fillStyle = "rgba(150,120,90,0.5)";
      g.beginPath(); g.ellipse(x, y, rw, rh, 0, 0, TAU); g.fill();
      g.strokeStyle = "rgba(120,90,60,0.6)";
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y, rw, rh, 0, 0, TAU); g.stroke();
      g.strokeStyle = "rgba(60,40,25,0.7)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, y - rh + 2);
      g.lineTo(x + 4, y - 4);
      g.lineTo(x - 2, y + 2);
      g.stroke();
    }

    // 遇难者骸骨（白骨残骸）
    for (let i = 0; i < 10; i++) {
      const x = rand(W + 80, A.w - W - 80), y = rand(W + 80, A.h - W - 80);
      if (nearSpawn(x, y, 240)) continue;
      g.save(); g.translate(x, y); g.rotate(rand(0, TAU));
      g.lineCap = "round";
      g.strokeStyle = "rgba(226,214,180,0.6)";
      g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(-26, -6); g.quadraticCurveTo(-8, -10, 24, -2); g.stroke();
      g.beginPath(); g.moveTo(-22, 8); g.quadraticCurveTo(-4, 4, 20, 10); g.stroke();
      g.fillStyle = "rgba(226,214,180,0.55)";
      g.beginPath(); g.ellipse(30, 2, 9, 7, 0.3, 0, TAU); g.fill();
      g.fillStyle = "rgba(60,45,30,0.5)";
      g.beginPath(); g.arc(27, 0, 2.2, 0, TAU); g.fill();
      g.beginPath(); g.arc(33, 0, 2.2, 0, TAU); g.fill();
      g.restore();
    }

    // 弹坑（焦黑凹陷）
    for (let i = 0; i < 7; i++) {
      const x = rand(W + 80, A.w - W - 80), y = rand(W + 80, A.h - W - 80);
      if (nearSpawn(x, y, 220)) continue;
      const rw = rand(26, 52), rh = rw * 0.6;
      g.fillStyle = "rgba(70,52,30,0.4)";
      g.beginPath(); g.ellipse(x, y, rw, rh, 0, 0, TAU); g.fill();
      g.fillStyle = "rgba(40,28,16,0.5)";
      g.beginPath(); g.ellipse(x, y, rw * 0.55, rh * 0.55, 0, 0, TAU); g.fill();
      g.strokeStyle = "rgba(220,190,130,0.25)";
      g.lineWidth = 3;
      g.beginPath(); g.ellipse(x, y, rw * 0.92, rh * 0.92, 0, 0, TAU); g.stroke();
    }

    // 金属废料堆（机械残骸）
    for (let i = 0; i < 8; i++) {
      const x = rand(W + 80, A.w - W - 80), y = rand(W + 80, A.h - W - 80);
      if (nearSpawn(x, y, 220)) continue;
      g.save(); g.translate(x, y); g.rotate(rand(0, TAU));
      for (let j = 0; j < randi(3, 5); j++) {
        const px = rand(-20, 20), py = rand(-14, 14);
        g.fillStyle = `rgba(${randi(120, 150)},${randi(122, 150)},${randi(128, 158)},${rand(0.4, 0.7)})`;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + rand(12, 22), py + rand(-8, 8));
        g.lineTo(px + rand(4, 14), py + rand(8, 16));
        g.closePath(); g.fill();
        g.strokeStyle = "rgba(30,30,35,0.5)";
        g.lineWidth = 1.5; g.stroke();
      }
      g.restore();
    }

    // 血迹拖痕（被拖走的痕迹）
    for (let i = 0; i < 6; i++) {
      const x = rand(W + 120, A.w - W - 120), y = rand(W + 120, A.h - W - 120);
      if (nearSpawn(x, y, 240)) continue;
      const a = rand(0, TAU), len = rand(90, 200);
      g.strokeStyle = `rgba(${randi(90, 120)},${randi(18, 30)},${randi(22, 34)},${rand(0.25, 0.45)})`;
      g.lineWidth = rand(8, 14);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
      g.fillStyle = "rgba(110,24,28,0.35)";
      g.beginPath(); g.ellipse(x, y, rand(14, 26), rand(10, 18), 0, 0, TAU); g.fill();
    }

    // 外星尖刺植物
    for (let i = 0; i < 14; i++) {
      const x = rand(W + 60, A.w - W - 60), y = rand(W + 60, A.h - W - 60);
      if (nearSpawn(x, y, 180)) continue;
      const n = randi(4, 7);
      for (let j = 0; j < n; j++) {
        const a = rand(0, TAU), d = rand(4, 10);
        g.strokeStyle = Math.random() < 0.5 ? "rgba(150,90,160,0.6)" : "rgba(110,70,120,0.6)";
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(x + Math.cos(a) * d * 0.3, y + Math.sin(a) * d * 0.3);
        g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d - rand(8, 14));
        g.stroke();
      }
      g.fillStyle = "rgba(120,80,130,0.4)";
      g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
    }

    // 沙袋掩体（堆叠掩体）
    for (let i = 0; i < 5; i++) {
      const x = rand(W + 100, A.w - W - 100), y = rand(W + 100, A.h - W - 100);
      if (nearSpawn(x, y, 260)) continue;
      g.save(); g.translate(x, y); g.rotate(rand(0, TAU));
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          g.fillStyle = `rgba(${randi(150, 168)},${randi(126, 142)},${randi(82, 98)},${rand(0.7, 0.9)})`;
          g.beginPath();
          g.ellipse(col * 20 - 20, row * 10 - 4, 12, 7, 0, 0, TAU);
          g.fill();
          g.strokeStyle = "rgba(90,72,44,0.5)";
          g.lineWidth = 1.4; g.stroke();
        }
      }
      g.restore();
    }

    // 断裂电线杆（倒伏的柱子 + 电线）
    for (let i = 0; i < 4; i++) {
      const x = rand(W + 140, A.w - W - 140), y = rand(W + 140, A.h - W - 140);
      if (nearSpawn(x, y, 280)) continue;
      const a = rand(0, TAU), len = rand(90, 150);
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = "rgba(80,70,58,0.6)";
      g.fillRect(-6, -len, 12, len);
      g.fillStyle = "rgba(110,96,78,0.55)";
      g.fillRect(-6, -len, 4, len);
      g.fillStyle = "rgba(60,52,44,0.7)";
      g.beginPath(); g.moveTo(-6, -len); g.lineTo(6, -len); g.lineTo(3, -len + 12); g.lineTo(-3, -len + 8); g.closePath(); g.fill();
      g.strokeStyle = "rgba(40,40,45,0.5)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(0, -len + 6);
      g.quadraticCurveTo(rand(20, 50), rand(10, 30), rand(40, 80), rand(-10, 10));
      g.stroke();
      g.restore();
    }
  },

  _paintLabDecor(g) {
    const A = CFG.ARENA, W = CFG.WALL;

    // 中央实验区标记
    g.strokeStyle = "rgba(110,80,40,0.16)";
    g.lineWidth = 8;
    g.beginPath(); g.arc(A.w / 2, A.h / 2, 320, 0, TAU); g.stroke();
    g.strokeStyle = "rgba(110,80,40,0.10)";
    g.lineWidth = 3;
    g.beginPath(); g.arc(A.w / 2, A.h / 2, 380, 0, TAU); g.stroke();
    g.fillStyle = "rgba(110,80,40,0.20)";
    g.font = "bold 88px 'Microsoft YaHei', sans-serif";
    g.textAlign = "center";
    g.fillText("实 验 区", A.w / 2, A.h / 2 + 28);
    g.font = "bold 26px 'Microsoft YaHei', sans-serif";
    g.fillText("SECTOR-01", A.w / 2, A.h / 2 + 76);

    // 出口方向箭头
    const ax = A.w - W - 200, ay = A.h / 2;
    g.strokeStyle = "rgba(140,200,140,0.25)";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(ax - 240, ay); g.lineTo(ax + 20, ay); g.stroke();
    g.beginPath();
    g.moveTo(ax + 20, ay);
    g.lineTo(ax - 6, ay - 16);
    g.moveTo(ax + 20, ay);
    g.lineTo(ax - 6, ay + 16);
    g.stroke();

    // 地面污渍 / 陈旧痕迹
    for (let i = 0; i < 30; i++) {
      const x = rand(W + 60, A.w - W - 60), y = rand(W + 60, A.h - W - 60);
      if (dist(x, y, A.w / 2, A.h / 2) < 200) continue;
      g.fillStyle = `rgba(${randi(90, 70)},${randi(72, 52)},${randi(44, 32)},${rand(0.12, 0.28)})`;
      g.beginPath(); g.ellipse(x, y, rand(12, 40), rand(8, 26), rand(0, TAU), 0, TAU); g.fill();
    }

    // 墙根菌毯（异形已渗透实验室）
    for (let i = 0; i < 10; i++) {
      const side = randi(0, 3);
      let x, y;
      if (side === 0) { x = rand(W, A.w - W); y = rand(W, W + 140); }
      else if (side === 1) { x = rand(W, A.w - W); y = rand(A.h - W - 140, A.h - W); }
      else if (side === 2) { x = rand(W, W + 140); y = rand(W, A.h - W); }
      else { x = rand(A.w - W - 140, A.w - W); y = rand(W, A.h - W); }
      g.fillStyle = `rgba(${randi(70, 90)},${randi(25, 35)},${randi(50, 65)},${rand(0.2, 0.4)})`;
      g.beginPath(); g.ellipse(x, y, rand(30, 70), rand(20, 45), rand(0, TAU), 0, TAU); g.fill();
      for (let j = 0; j < 8; j++) {
        const a = rand(0, TAU), d = rand(10, 40);
        g.strokeStyle = "rgba(140,60,95,0.35)";
        g.lineWidth = rand(2, 4);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * d * 0.5, y + Math.sin(a) * d * 0.5, x + Math.cos(a) * d, y + Math.sin(a) * d);
        g.stroke();
      }
    }

    // 地面裂缝
    for (let i = 0; i < 8; i++) {
      let x = rand(W + 60, A.w - W - 60), y = rand(W + 60, A.h - W - 60);
      g.strokeStyle = "rgba(80,58,32,0.55)";
      g.lineWidth = rand(1.5, 3);
      g.beginPath();
      g.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += rand(-30, 30); y += rand(-30, 30);
        g.lineTo(x, y);
      }
      g.stroke();
    }

    // 出口门前地面警示条（黄黑）
    const doorX = A.w - W - 60, doorY = A.h / 2;
    g.save();
    g.translate(doorX - 60, doorY);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 === 0 ? "rgba(201,162,39,0.4)" : "rgba(30,28,24,0.4)";
      g.fillRect(i * 26, -34, 13, 68);
    }
    g.strokeStyle = "rgba(20,18,14,0.5)";
    g.lineWidth = 2; g.strokeRect(-2, -36, 132, 72);
    g.restore();

    // 地面电缆（连接各实验台）
    for (let i = 0; i < 7; i++) {
      const x0 = rand(W + 100, A.w - W - 100), y0 = rand(W + 100, A.h - W - 100);
      if (dist(x0, y0, A.w / 2, A.h / 2) < 240) continue;
      const x1 = x0 + rand(-260, 260), y1 = y0 + rand(-180, 180);
      const mx = (x0 + x1) / 2 + rand(-60, 60), my = (y0 + y1) / 2 + rand(-40, 40);
      g.strokeStyle = "rgba(25,28,34,0.5)";
      g.lineWidth = rand(5, 8);
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
      g.strokeStyle = "rgba(80,140,200,0.25)";
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
    }

    // 培养槽碎玻璃（带残液）
    for (let i = 0; i < 9; i++) {
      const x = rand(W + 80, A.w - W - 80), y = rand(W + 80, A.h - W - 80);
      if (dist(x, y, A.w / 2, A.h / 2) < 220) continue;
      if (dist(x, y, doorX, doorY) < 300) continue;
      g.fillStyle = "rgba(90,180,150,0.25)";
      g.beginPath(); g.ellipse(x, y, rand(16, 30), rand(10, 20), rand(0, TAU), 0, TAU); g.fill();
      for (let j = 0; j < 5; j++) {
        const a = rand(0, TAU), d = rand(4, 22);
        g.fillStyle = "rgba(190,230,255,0.4)";
        g.beginPath();
        g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        g.lineTo(x + Math.cos(a + 0.5) * (d + rand(4, 9)), y + Math.sin(a + 0.5) * (d + rand(4, 9)));
        g.lineTo(x + Math.cos(a + 2.6) * (d + rand(2, 6)), y + Math.sin(a + 2.6) * (d + rand(2, 6)));
        g.closePath(); g.fill();
      }
    }

    // 散落文件（纸）
    for (let i = 0; i < 12; i++) {
      const x = rand(W + 120, A.w - W - 120), y = rand(W + 120, A.h - W - 120);
      if (dist(x, y, A.w / 2, A.h / 2) < 260) continue;
      g.save(); g.translate(x, y); g.rotate(rand(0, TAU));
      g.fillStyle = "rgba(226,220,205,0.5)";
      g.fillRect(-14, -10, 28, 20);
      g.strokeStyle = "rgba(120,110,95,0.5)";
      g.lineWidth = 1.2;
      for (let l = 0; l < 3; l++) {
        g.beginPath(); g.moveTo(-9, -4 + l * 6); g.lineTo(9, -4 + l * 6); g.stroke();
      }
      g.restore();
    }

    // 地面通风口格栅
    for (let i = 0; i < 6; i++) {
      const x = rand(W + 100, A.w - W - 100), y = rand(W + 100, A.h - W - 100);
      if (dist(x, y, A.w / 2, A.h / 2) < 240) continue;
      g.save(); g.translate(x, y); g.rotate(rand(0, TAU));
      g.fillStyle = "rgba(20,22,26,0.55)";
      g.fillRect(-22, -16, 44, 32);
      g.strokeStyle = "rgba(140,150,165,0.3)";
      g.lineWidth = 2;
      for (let s = 0; s < 4; s++) {
        g.beginPath(); g.moveTo(-16, -10 + s * 7); g.lineTo(16, -10 + s * 7); g.stroke();
      }
      g.strokeStyle = "rgba(0,0,0,0.5)";
      g.strokeRect(-22, -16, 44, 32);
      g.restore();
    }

    // 血迹拖痕
    for (let i = 0; i < 6; i++) {
      const x = rand(W + 120, A.w - W - 120), y = rand(W + 120, A.h - W - 120);
      if (dist(x, y, A.w / 2, A.h / 2) < 260) continue;
      const a = rand(0, TAU), len = rand(90, 200);
      g.strokeStyle = `rgba(${randi(100, 130)},${randi(20, 32)},${randi(24, 36)},${rand(0.3, 0.5)})`;
      g.lineWidth = rand(8, 13);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  },

  /* 补给箱随机位置：避开出生点中央与出口门 */
  _randCratePos() {
    const A = CFG.ARENA, W = CFG.WALL;
    const doorX = A.w - W - 60, doorY = A.h / 2;
    for (let i = 0; i < 40; i++) {
      const x = rand(W + 80, A.w - W - 80);
      const y = rand(W + 80, A.h - W - 80);
      if (dist(x, y, A.w / 2, A.h / 2) < 420) continue;
      if (dist(x, y, doorX, doorY) < 400) continue;
      let ok = true;
      for (const c of this.crates) {
        if (dist(x, y, c.x, c.y) < 220) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
    return { x: A.w / 2 + 700, y: A.h / 2 };
  },

  /* 第一关：大实验室（固定布局，出口门 = 实验室大门） */
  _buildLab() {
    const A = CFG.ARENA;
    const cx = A.w / 2, cy = A.h / 2;
    const add = (x, y, w, h, kind2) => {
      this.obstacles.push({ x, y, w, h, kind: "furniture", kind2, hp: Infinity });
    };
    // 中央实验台区（三张长桌）
    add(cx - 330, cy - 40, 250, 64, "table");
    add(cx - 40, cy - 40, 250, 64, "table");
    add(cx + 250, cy - 40, 250, 64, "table");
    // 培养槽（上下两排）
    for (let i = 0; i < 4; i++) add(280 + i * 92, 300, 62, 96, "tank");
    for (let i = 0; i < 4; i++) add(280 + i * 92, A.h - 300 - 96, 62, 96, "tank");
    // 大型仪器（带屏幕）
    add(cx - 300, cy - 270, 96, 86, "machine");
    add(cx + 210, cy - 270, 96, 86, "machine");
    add(cx - 300, cy + 190, 96, 86, "machine");
    add(cx + 210, cy + 190, 96, 86, "machine");
    // 储物柜
    add(430, 430, 140, 56, "cabinet");
    add(430, A.h - 430 - 56, 140, 56, "cabinet");
    // 危险油桶（少量）
    add(cx - 620, cy - 210, 46, 46, "barrel");
    add(cx - 620, cy + 170, 46, 46, "barrel");
  },

  /* 其他关：室外沙地 + 随机箱体 */
  _buildOutdoor() {
    const A = CFG.ARENA, W = CFG.WALL;
    const level = LevelSys.n || 2;
    const tries = 30 + level * 5;
    const placed = [];
    const centerX = A.w / 2, centerY = A.h / 2;
    const doorX = A.w - W - 60, doorY = A.h / 2;
    for (let i = 0; i < tries; i++) {
      const w = choice([38, 52, 66, 88]);
      const h = choice([38, 52, 66, 88]);
      const x = rand(W + 60, A.w - W - 60 - w);
      const y = rand(W + 60, A.h - W - 60 - h);
      if (dist(x + w / 2, y + h / 2, centerX, centerY) < 260) continue;
      if (Math.abs(x + w / 2 - doorX) < 300 && Math.abs(y + h / 2 - doorY) < 300) continue;
      let ok = true;
      for (const o of placed) {
        if (x < o.x + o.w + 34 && x + w + 34 > o.x && y < o.y + o.h + 34 && y + h + 34 > o.y) { ok = false; break; }
      }
      if (!ok) continue;
      const r = Math.random();
      const kind = r < 0.24 ? "barrel" : "crate";
      placed.push({ x, y, w, h, kind, kind2: kind, hp: kind === "barrel" ? 30 : Infinity });
    }
    this.obstacles = placed;
  },

  /* 圆形是否与任何障碍物相交 */
  hitObstacle(x, y, r) {
    for (const o of this.obstacles) {
      if (o.dead) continue;
      if (circleRectDist(x, y, r, o) < 0) return o;
    }
    return null;
  },

  /* 圆形推离障碍物，返回推离向量 */
  resolveCircle(x, y, r) {
    for (const o of this.obstacles) {
      if (o.dead) continue;
      const res = circleRectResolve(x, y, r, o);
      if (res) return res;
    }
    return null;
  },

  /* 油桶受击 */
  damageBarrels(x, y, radius, dmg, g) {
    for (const o of this.obstacles) {
      if (o.kind !== "barrel" && o.kind2 !== "barrel") continue;
      if (o.dead) continue;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      if (dist(x, y, cx, cy) < radius + Math.max(o.w, o.h) / 2) {
        o.hp -= dmg;
        if (o.hp <= 0) {
          o.dead = true;
          worldExplosion(g, cx, cy, 70, 120, "player", "#ff8c42");
          AudioSys.play("explosion");
          g.addShake(10);
          g.particles.push(new Particle(cx, cy, 0, 0, 0.4, 120, "rgba(255,120,50,0.5)", "ring", 0));
        }
      }
    }
  },

  addDecal(x, y, r, color) {
    if (!this.decalCtx) return;
    this.decalCtx.globalAlpha = 0.9;
    this.decalCtx.fillStyle = color;
    this.decalCtx.beginPath();
    this.decalCtx.arc(x + rand(-4, 4), y + rand(-4, 4), r, 0, TAU);
    this.decalCtx.fill();
    this.decalCtx.globalAlpha = 1;
  },

  /* 随机出生点（保证离玩家足够远） */
  pickSpawn(player) {
    const pts = this.spawnPoints.filter(p => dist(p.x, p.y, player.x, player.y) >= CFG.SPAWN_MIN_DIST);
    const pool = pts.length ? pts : this.spawnPoints;
    return choice(pool);
  },

  /* 地面层：沙地/瓷砖贴图 + 网格 + 墙 + 血迹 */
  drawGround(ctx) {
    const A = CFG.ARENA, W = CFG.WALL, WH = CFG.WALL_H;

    // 地板贴图
    if (!this.sandPattern) this.sandPattern = ctx.createPattern(makeSandTile(), "repeat");
    if (!this.labPattern) this.labPattern = ctx.createPattern(makeLabTile(), "repeat");
    ctx.fillStyle = this.labMode ? this.labPattern : this.sandPattern;
    ctx.fillRect(-WH - 20, -WH - 20, A.w + 2 * WH + 40, A.h + 2 * WH + 40);

    if (this.labMode) {
      // 室内：淡网格（引导线）+ 中央区域警示线
      ctx.strokeStyle = "rgba(120,90,50,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= A.w; x += CFG.GRID) { ctx.moveTo(x, 0); ctx.lineTo(x, A.h); }
      for (let y = 0; y <= A.h; y += CFG.GRID) { ctx.moveTo(0, y); ctx.lineTo(A.w, y); }
      ctx.stroke();
      // 黄黑警戒条（沿墙）
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#c9a227";
      ctx.lineWidth = 5;
      ctx.setLineDash([22, 16]);
      ctx.strokeRect(10, 10, A.w - 20, A.h - 20);
      ctx.setLineDash([]);
      ctx.restore();

      // 室内墙：浅色墙面 + 顶面 + 踢脚线
      ctx.fillStyle = "#1a2230";                    // 墙基座
      ctx.fillRect(-WH, -WH, A.w + 2 * WH, A.h + 2 * WH);
      ctx.fillStyle = "#2c3b52";                    // 内壁（浅蓝灰）
      ctx.fillRect(0, 0, A.w, W);
      ctx.fillRect(0, A.h - W, A.w, W);
      ctx.fillRect(0, 0, W, A.h);
      ctx.fillRect(A.w - W, 0, W, A.h);
      ctx.fillStyle = "#3d5478";                    // 墙顶面
      ctx.fillRect(-WH, -WH - WH, A.w + 2 * WH, W + WH);
      ctx.fillRect(-WH, -WH, W + WH, A.h + 2 * WH);
      // 墙裙装饰线
      ctx.fillStyle = "rgba(120,170,255,0.18)";
      ctx.fillRect(0, W - 6, A.w, 4);
      ctx.fillRect(0, A.h - W + 2, A.w, 4);
      // 踢脚线阴影
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, W, A.w, 4);
      ctx.fillRect(0, A.h - W - 4, A.w, 4);
      // 墙面装饰：管线 / 出口标志 / 观察窗 / 海报
      ctx.strokeStyle = "rgba(90,120,160,0.4)";
      ctx.lineWidth = 5;
      // 上墙管线（横）
      ctx.beginPath();
      ctx.moveTo(0, W - 16); ctx.lineTo(A.w, W - 16); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, A.h - W + 18); ctx.lineTo(A.w, A.h - W + 18); ctx.stroke();
      // 竖管
      for (let x = 160; x < A.w; x += 420) {
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, W); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 200, A.h - W); ctx.lineTo(x + 200, A.h); ctx.stroke();
      }
      // 出口标志（发绿）
      ctx.fillStyle = "rgba(60,200,120,0.35)";
      ctx.fillRect(A.w - W - 260, W - 34, 90, 20);
      ctx.fillStyle = "rgba(200,255,220,0.85)";
      ctx.font = "bold 13px 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("EXIT →", A.w - W - 215, W - 20);
      // 观察窗（蓝色玻璃）
      for (let i = 0; i < 5; i++) {
        const wx = 260 + i * 620, wy = (i % 2 === 0) ? W - 42 : A.h - W + 4;
        ctx.fillStyle = "rgba(120,180,255,0.22)";
        ctx.fillRect(wx, wy, 120, 34);
        ctx.strokeStyle = "rgba(160,210,255,0.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, 120, 34);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(wx + 6, wy + 6, 30, 8);
      }
      // 墙上贴纸
      ctx.fillStyle = "rgba(220,220,230,0.16)";
      ctx.fillRect(W + 90, W - 46, 46, 40);
      ctx.fillStyle = "rgba(255,180,80,0.35)";
      ctx.fillRect(W + 102, W - 36, 22, 20);
      ctx.fillStyle = "rgba(220,220,230,0.16)";
      ctx.fillRect(W + 170, A.h - W + 8, 46, 40);
    } else {
      // 室外：淡网格
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= A.w; x += CFG.GRID) { ctx.moveTo(x, 0); ctx.lineTo(x, A.h); }
      for (let y = 0; y <= A.h; y += CFG.GRID) { ctx.moveTo(0, y); ctx.lineTo(A.w, y); }
      ctx.stroke();
      // 沙地外围铁丝网墙
      ctx.fillStyle = "#141b26";
      ctx.fillRect(-WH, -WH, A.w + 2 * WH, A.h + 2 * WH);
      ctx.fillStyle = "#10161f";
      ctx.fillRect(0, 0, A.w, W);
      ctx.fillRect(0, A.h - W, A.w, W);
      ctx.fillRect(0, 0, W, A.h);
      ctx.fillRect(A.w - W, 0, W, A.h);
      ctx.fillStyle = "#2b3c58";
      ctx.fillRect(-WH, -WH - WH, A.w + 2 * WH, W + WH);
      ctx.fillRect(-WH, -WH, W + WH, A.h + 2 * WH);
      // 铁丝网纹
      ctx.strokeStyle = "rgba(140,190,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= A.w; x += 26) { ctx.moveTo(x, 0); ctx.lineTo(x + 10, W); }
      ctx.stroke();
      // 铁丝网栅栏柱 + 顶部倒刺
      ctx.fillStyle = "rgba(70,90,120,0.5)";
      for (let x = 40; x < A.w; x += 220) {
        ctx.fillRect(x, 0, 6, W + 6);
        ctx.fillRect(x + 110, A.h - W - 6, 6, W + 6);
      }
      ctx.strokeStyle = "rgba(70,90,120,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(A.w, 0); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, A.h); ctx.lineTo(A.w, A.h); ctx.stroke();
      // 警告牌（黄黑）
      for (let i = 0; i < 4; i++) {
        const wx = 300 + i * 860, wy = (i % 2 === 0) ? W + 6 : A.h - W - 34;
        ctx.fillStyle = "rgba(210,170,50,0.5)";
        ctx.fillRect(wx, wy, 60, 26);
        ctx.strokeStyle = "rgba(30,30,30,0.6)";
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, 60, 26);
        ctx.fillStyle = "rgba(40,40,40,0.7)";
        ctx.beginPath();
        ctx.moveTo(wx + 30, wy + 5); ctx.lineTo(wx + 42, wy + 18); ctx.lineTo(wx + 18, wy + 18);
        ctx.closePath(); ctx.fill();
      }
    }

    // 血迹
    ctx.drawImage(this.decal, 0, 0);
  },

  /* 单个障碍物（立体绘制，参与深度排序） */
  drawObstacle(ctx, o) {
    const hh = 22;
    const k = o.kind2 || o.kind;
    switch (k) {
      case "barrel": {
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
        ctx.fillStyle = "#7a2c1d";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = "#a83a26";
        ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
        ctx.strokeStyle = "rgba(60,20,10,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, o.y + o.h * 0.35, o.w / 2 - 3, (o.w / 2 - 3) * 0.3, 0, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = "#c94a30";
        ctx.beginPath();
        ctx.ellipse(cx, cy, o.w / 2, o.w * 0.28, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,180,120,0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffe9c9";
        ctx.beginPath();
        ctx.arc(cx, cy, o.w * 0.14, 0, TAU);
        ctx.fill();
        break;
      }
      case "table": {
        // 实验台：台面 + 桌腿 + 仪器
        ctx.fillStyle = "#3a4658";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        // 台面（亮）
        ctx.fillStyle = "#54657d";
        ctx.fillRect(o.x, o.y, o.w, o.h * 0.4);
        // 台面边缘高光
        ctx.fillStyle = "rgba(180,210,255,0.25)";
        ctx.fillRect(o.x, o.y, o.w, 3);
        // 桌腿
        ctx.fillStyle = "#2a3344";
        ctx.fillRect(o.x + 8, o.y + o.h * 0.4, 8, o.h * 0.6);
        ctx.fillRect(o.x + o.w - 16, o.y + o.h * 0.4, 8, o.h * 0.6);
        // 台上的烧瓶
        for (let i = 0; i < 3; i++) {
          const fx = o.x + 18 + i * (o.w / 3);
          ctx.fillStyle = i % 2 ? "rgba(90,200,160,0.75)" : "rgba(200,120,80,0.75)";
          ctx.beginPath();
          ctx.moveTo(fx, o.y + 6); ctx.lineTo(fx + 4, o.y + 6);
          ctx.lineTo(fx + 7, o.y + 16); ctx.lineTo(fx - 3, o.y + 16);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case "tank": {
        // 培养槽：玻璃柜 + 绿色液体 + 气泡 + 框架
        ctx.fillStyle = "#22303f";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = "rgba(60,160,110,0.5)";
        ctx.fillRect(o.x + 5, o.y + o.h * 0.35, o.w - 10, o.h * 0.55);
        ctx.fillStyle = "rgba(140,255,190,0.25)";
        ctx.fillRect(o.x + 5, o.y + o.h * 0.35, o.w - 10, o.h * 0.12);
        // 气泡
        ctx.fillStyle = "rgba(200,255,225,0.6)";
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(o.x + 10 + i * (o.w - 20) / 3, o.y + o.h * (0.4 + (i % 2) * 0.2), 2 + i % 2, 0, TAU);
          ctx.fill();
        }
        // 玻璃框
        ctx.strokeStyle = "#3d5570";
        ctx.lineWidth = 3;
        ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
        ctx.strokeStyle = "rgba(180,220,255,0.35)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(o.x + 5, o.y + 5, o.w - 10, o.h - 10);
        // 顶部接口
        ctx.fillStyle = "#3d5570";
        ctx.fillRect(o.x + o.w / 2 - 6, o.y - 8, 12, 10);
        ctx.fillStyle = "#ff8c42";
        ctx.fillRect(o.x + o.w / 2 - 2, o.y - 11, 4, 5);
        break;
      }
      case "machine": {
        // 大型仪器：机身 + 屏幕 + 指示灯
        ctx.fillStyle = "#2b3547";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = "#39465c";
        ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
        // 屏幕
        ctx.fillStyle = "#0e1a26";
        ctx.fillRect(o.x + 10, o.y + 8, o.w - 20, o.h * 0.42);
        ctx.fillStyle = "rgba(90,220,255,0.5)";
        ctx.fillRect(o.x + 12, o.y + 10, o.w - 24, 3);
        ctx.fillRect(o.x + 12, o.y + 16, (o.w - 24) * 0.6, 3);
        // 指示灯
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = ["#ff5a4d", "#ffd166", "#6fdc6f"][i];
          ctx.beginPath(); ctx.arc(o.x + 14 + i * 14, o.y + o.h - 12, 3.5, 0, TAU); ctx.fill();
        }
        // 管线
        ctx.strokeStyle = "#1c2533";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w - 6, o.y + o.h * 0.3);
        ctx.quadraticCurveTo(o.x + o.w + 8, o.y + o.h * 0.5, o.x + o.w - 2, o.y + o.h - 8);
        ctx.stroke();
        break;
      }
      case "cabinet": {
        // 储物柜
        ctx.fillStyle = "#4a5568";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = "#5b6a80";
        ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
        // 柜门缝
        ctx.strokeStyle = "#39465a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2, o.y + 3); ctx.lineTo(o.x + o.w / 2, o.y + o.h - 3);
        ctx.stroke();
        // 把手
        ctx.fillStyle = "#2a3344";
        ctx.fillRect(o.x + o.w / 2 - 3, o.y + o.h * 0.5 - 5, 6, 10);
        // 顶部装饰
        ctx.fillStyle = "rgba(180,210,255,0.2)";
        ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, 3);
        break;
      }
      default: {
        // 户外板条箱
        ctx.fillStyle = "#1d2839";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = "#33465f";
        ctx.beginPath();
        ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y);
        ctx.lineTo(o.x + o.w, o.y - hh); ctx.lineTo(o.x, o.y - hh);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#232f42";
        ctx.beginPath();
        ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x + o.w + hh, o.y - hh);
        ctx.lineTo(o.x + o.w + hh, o.y - hh + o.h); ctx.lineTo(o.x + o.w, o.y + o.h);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#182231";
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + o.h); ctx.lineTo(o.x + hh, o.y - hh + o.h);
        ctx.lineTo(o.x + o.w + hh, o.y - hh + o.h); ctx.lineTo(o.x + o.w, o.y + o.h);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(140,190,255,0.15)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        break;
      }
    }
  },

  /* 交互补给箱绘制（武器箱黄光? / 弹药箱印当前武器 / 急救箱红十字；被拾取后变为空箱） */
  drawCrate(ctx, c, time, player) {
    const w = 46, h = 34;
    const x = c.x - w / 2, y = c.y - h / 2;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3 + c.x * 0.01);
    const isWeapon = c.kind === "weapon";
    const isAmmo = c.kind === "ammo";
    const isHealth = c.kind === "health";
    const main = isWeapon ? "#c9942a" : isAmmo ? "#4e8c3a" : "#e8e8ee";
    const light = isWeapon ? "255,200,80" : isAmmo ? "120,220,120" : "255,120,110";

    // 光柱（未拾取时）
    if (!c.taken) {
      ctx.fillStyle = `rgba(${light},${0.12 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 8, y + h);
      ctx.lineTo(x + w / 2 + 8, y + h);
      ctx.lineTo(x + w / 2 + 26, y - 58);
      ctx.lineTo(x + w / 2 - 26, y - 58);
      ctx.closePath();
      ctx.fill();
    }

    // 箱体
    ctx.fillStyle = c.taken ? "#3a3f47" : "#5a4630";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c.taken ? "#4a5058" : main;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    // 顶盖
    ctx.fillStyle = c.taken ? "#555c66" : (isWeapon ? "#e0b04a" : isAmmo ? "#5fa84a" : "#f4f4f8");
    ctx.fillRect(x - 3, y - 6, w + 6, 8);
    // 木条
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);

    if (!c.taken) {
      // 图标（光柱中段）
      ctx.save();
      ctx.translate(c.x, c.y - 16);
      ctx.fillStyle = `rgba(${light},${0.5 + 0.4 * pulse})`;
      ctx.beginPath(); ctx.arc(0, 0, 13 + 2 * pulse, 0, TAU); ctx.fill();
      if (isWeapon) {
        ctx.fillStyle = "#20262e";
        ctx.font = "bold 16px 'Microsoft YaHei', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("?", 0, 6);
      } else if (isAmmo) {
        // 印当前武器外形
        if (player) {
          ctx.save();
          ctx.translate(-8, -1);
          ctx.scale(0.6, 0.6);
          drawWeaponShape(ctx, player.curW, 0);
          ctx.restore();
        }
      } else {
        // 急救箱红十字
        ctx.fillStyle = "#e04b3a";
        ctx.fillRect(-6, -3.5, 12, 7);
        ctx.fillRect(-3.5, -6, 7, 12);
      }
      ctx.restore();
    } else {
      // 空箱：盖子掀开
      ctx.save();
      ctx.translate(x + w / 2, y - 6);
      ctx.rotate(-0.5);
      ctx.fillStyle = "#6a6f78";
      ctx.fillRect(-w / 2 - 3, 0, w + 6, 7);
      ctx.restore();
    }
  },
};
