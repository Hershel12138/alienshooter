/* ============ 关卡系统：怪物持续从四面八方刷新，击杀达标过关 ============ */
"use strict";

const LevelSys = {
  n: 0,                 // 当前关卡（1 起）
  state: "idle",        // idle | active | clear
  killTarget: 0,        // 本关目标击杀数
  pool: [],             // 类型权重池
  spawnTimer: 0,
  bossSpawned: false,
  door: { x: 0, y: 0 }, // 出口门位置（本关）

  startRun() {
    this.n = 0;
    this.state = "idle";
    this.pool = [];
  },

  /* 出口门：固定在地图右边界中央 */
  _doorPos() {
    return { x: CFG.ARENA.w - CFG.WALL - 60, y: CFG.ARENA.h / 2 };
  },

  startLevel(g) {
    this.n++;
    const def = CFG.LEVELS[this.n - 1];
    this.door = this._doorPos();
    this.state = "active";
    this.killTarget = def.count;
    this.spawnTimer = 0.6;
    this.bossSpawned = false;
    this.clearTimer = undefined;
    g.levelKills = 0;

    // 类型权重池
    this.pool = [];
    for (const [type, w] of def.enemies) {
      for (let i = 0; i < w; i++) this.pool.push(type);
    }

    // 开场先涌一波
    this._spawnWave(g, 8 + this.n * 2);

    // 横幅
    g.banner("第 " + this.n + " 关 · " + def.name, "#8fd3ff", 3.2);
    g.addSubtitle(def.desc, "#9fb4cc", 5.5);
    if (def.boss) {
      g.banner("☠ 首领预警：" + CFG.ENEMIES[def.boss].name, "#ff5a4d", 3.0, 1.4);
      AudioSys.play("boss");
      g.addShake(14);
    } else {
      AudioSys.play("wave");
    }
  },

  _pickType() {
    return choice(this.pool) || "drone";
  },

  /* 场上敌人数量上限（性能 + 场面控制） */
  maxAlive() {
    return 24 + this.n * 4;
  },

  /* 刷新间隔：随击杀进度加快 */
  _interval(g) {
    const prog = Math.min(1, g.levelKills / Math.max(1, this.killTarget));
    return lerp(1.15, 0.5, prog) / (1 + this.n * 0.02);
  },

  /* 从四面八方（地图四周出生点）刷新一波 */
  _spawnWave(g, count) {
    const maxAlive = this.maxAlive();
    count = Math.max(1, Math.min(count, maxAlive - g.enemies.length));
    for (let i = 0; i < count; i++) {
      const sp = MapSys.pickSpawn(g.player);
      g.spawnEnemy(this._pickType(), sp.x, sp.y, this.n);
    }
  },

  update(dt, g) {
    if (this.state !== "active") return;
    const def = CFG.LEVELS[this.n - 1];

    // 持续刷新：未达标时不断涌入
    if (g.levelKills < this.killTarget) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this._interval(g);
        const waveSize = 2 + Math.floor(this.n / 2) + (Math.random() < 0.3 ? 3 : 0);
        this._spawnWave(g, waveSize);
      }
    }

    // Boss 关：击杀过半后首领现身
    if (def.boss && !this.bossSpawned && g.levelKills >= Math.floor(this.killTarget * 0.45)) {
      this.bossSpawned = true;
      const sp = MapSys.pickSpawn(g.player);
      g.spawnEnemy(def.boss, sp.x, sp.y, this.n);
      g.banner("☠ " + CFG.ENEMIES[def.boss].name + " 出现了！", "#ff5a4d", 2.8);
      AudioSys.play("boss");
      g.addShake(14);
    }

    // 防卡死：目标达标后若有零星敌人长时间清不掉（可能卡进障碍间隙），传送到玩家附近
    if (g.levelKills >= this.killTarget && g.enemies.length > 0 && g.enemies.length <= 3) {
      if (this.clearTimer === undefined) this.clearTimer = 8;
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this.clearTimer = 8;
        for (const e of g.enemies) {
          const a = rand(0, TAU);
          e.x = g.player.x + Math.cos(a) * rand(260, 420);
          e.y = g.player.y + Math.sin(a) * rand(260, 420);
          e.vx = 0; e.vy = 0;
          g.addText(e.x, e.y - 24, "⚠ 传送到你身边！", "#ff8a7d", 13);
        }
        g.addShake(6);
        AudioSys.play("boss");
      }
    } else {
      this.clearTimer = undefined;
    }

    // 完成判定：击杀达标 + （Boss 关需击杀 Boss）+ 场上清空
    const bossOk = !def.boss || (this.bossSpawned && !g.boss);
    if (g.levelKills >= this.killTarget && bossOk && g.enemies.length === 0) {
      this.state = "clear";
      g.onLevelClear();
    }
  },

  /* 玩家是否站在出口门上（本关已清除时可用） */
  playerAtDoor(g) {
    const p = g.player;
    return dist(p.x, p.y, this.door.x, this.door.y) < 70;
  },
};
