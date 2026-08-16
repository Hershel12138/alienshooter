/* ============ 游戏主类：主循环 / 斜视角渲染 / 关卡状态 ============ */
"use strict";

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = 0; this.h = 0;

    this.mode = "menu";      // menu | story | run
    this.state = "menu";     // menu | story | run | dying | winning | pause | gameover | victory
    this.settings = { volume: 0.7, sfx: true, difficulty: "normal", shake: true, dmgNums: true };
    this.diff = CFG.DIFFICULTY.normal;
    // 开发者模式（由 Scenes.loadDev 从 localStorage 载入）
    this.dev = { invincible: false, infiniteAmmo: false, allWeapons: false, speedX2: false };

    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.grenades = [];
    this.pickups = [];
    this.particles = [];
    this.boss = null;
    this.time = 0;
    this.kills = 0;
    this.levelKills = 0;
    this.score = 0;
    this.deathT = 0;
    this.winT = 0;

    this.cam = { x: CFG.ARENA.w / 2, y: CFG.ARENA.h / 2 };
    this.shake = 0;
    this.bannerMsg = { text: "", color: "#fff", t: 0, dur: 0 };
    this.subtitleMsg = { text: "", t: 0, dur: 0 };
    this.hintT = 0;   // 开局操作提示剩余时间
    this.mouseWorld = { x: CFG.ARENA.w / 2, y: CFG.ARENA.h / 2 };
    this.lastTs = 0;
    this.ambient = { stars: [], embers: [], t: 0 };

    this._buildAmbient();
    this.resize();
    window.addEventListener("resize", () => this.resize());

    // 窗口失焦自动暂停，避免战斗中挂机死亡
    this._onBlur = () => {
      if (this.state === "run") this.pause();
    };
    window.addEventListener("blur", this._onBlur);
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
  }

  _buildAmbient() {
    for (let i = 0; i < 90; i++) {
      this.ambient.stars.push({ x: Math.random(), y: Math.random(), s: rand(0.6, 2.2), tw: rand(0, TAU) });
    }
    for (let i = 0; i < 26; i++) {
      this.ambient.embers.push({ x: Math.random(), y: Math.random(), v: rand(8, 26), s: rand(1, 3.4), a: rand(0.15, 0.5) });
    }
  }

  /* ==================== 主循环 ==================== */
  start() {
    const loop = (ts) => {
      const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0.016);
      this.lastTs = ts;
      this.update(dt);
      this.render();
      Input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ==================== 更新 ==================== */
  update(dt) {
    this.ambient.t += dt;
    const inRun = ["run", "dying", "winning", "pause", "gameover", "victory"].includes(this.state);

    if (!inRun) {
      // 菜单 / 剧情：环境背景
      for (const e of this.ambient.embers) {
        e.y -= (e.v * dt) / this.h;
        e.x += Math.sin(this.ambient.t + e.y * 9) * dt * 0.01;
        if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
      }
      return;
    }

    // ---- 游戏世界 ----
    if (this.state === "run" || this.state === "dying" || this.state === "winning") {
      const p = this.player;
      this.time += dt;
      this.mouseWorld.x = this.cam.x + (Input.mouse.x - this.w / 2);
      this.mouseWorld.y = this.cam.y + (Input.mouse.y - this.h / 2);

      // 暂停
      if (this.state === "run" && Input.wasPressed("Escape")) this.pause();

      p.update(dt, this);

      // 关卡逻辑
      if (this.state === "run" && !p.dead) {
        LevelSys.update(dt, this);
        // 走到出口门 → 进入下一关
        if (LevelSys.state === "clear" && LevelSys.playerAtDoor(this)) {
          this.enterNextLevel();
        }
      }

      // 敌人
      for (const e of this.enemies) e.update(dt, this);
      this._separateEnemies();

      // 子弹
      for (const b of this.bullets) b.update(dt, this);
      for (const b of this.ebullets) b.update(dt, this);
      for (const gd of this.grenades) gd.update(dt, this);
      for (const pk of this.pickups) pk.update(dt, this);
      for (const pt of this.particles) pt.update(dt);
      this._updateCrates();

      // 清理
      this.enemies = this.enemies.filter(e => !e.dead);
      this.bullets = this.bullets.filter(b => !b.dead);
      this.ebullets = this.ebullets.filter(b => !b.dead);
      this.grenades = this.grenades.filter(gd => !gd.dead);
      this.pickups = this.pickups.filter(pk => !pk.dead);
      this.particles = this.particles.filter(pt => !pt.dead);
      if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
      if (this.boss && this.boss.dead) this.boss = null;

      // 死亡演出
      if (this.state === "dying") {
        this.deathT -= dt;
        if (this.deathT <= 0) {
          this.state = "gameover";
          CodexStore.onRunEnd(LevelSys.n, this.score, this.kills);
          Scenes.showGameover(this._stats());
        }
      }

      // 胜利演出
      if (this.state === "winning") {
        this.winT -= dt;
        if (this.winT <= 0) {
          this.state = "victory";
          CodexStore.onRunEnd(CFG.LEVELS.length, this.score, this.kills);
          Scenes.showVictory(this._stats());
          // 通关黑屏演出：地球升起 + “你已拯救地球”
          Cinema.play();
          AudioSys.play("cinema");
        }
      }

      // 镜头
      const k = Math.min(1, dt * 5);
      this.cam.x = lerp(this.cam.x, p.x, k);
      this.cam.y = lerp(this.cam.y, p.y, k);
      const vw = this.w, vh = this.h;
      const A = CFG.ARENA;
      this.cam.x = A.w > vw ? clamp(this.cam.x, vw / 2, A.w - vw / 2) : A.w / 2;
      this.cam.y = A.h > vh ? clamp(this.cam.y, vh / 2, A.h - vh / 2) : A.h / 2;
    }

    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.bannerMsg.t > 0) this.bannerMsg.t -= dt;
    if (this.subtitleMsg.t > 0) this.subtitleMsg.t -= dt;
    if (this.hintT > 0) this.hintT -= dt;

    // 暂停状态下按 Esc 恢复
    if (this.state === "pause" && Input.wasPressed("Escape")) this.resume();
  }

  _separateEnemies() {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i], b = es[j];
        const rr = a.r + b.r;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (rr - d) / d * 0.5;
          const pxa = dx * push, pya = dy * push;
          const aw = a.kind === "boss" ? 0.08 : 1;
          const bw = b.kind === "boss" ? 0.08 : 1;
          a.x -= pxa * aw; a.y -= pya * aw;
          b.x += pxa * bw; b.y += pya * bw;
        }
      }
    }
  }

  /* ==================== 流程控制 ==================== */
  startRun() {
    MapSys.build();
    LevelSys.startRun();
    CodexStore.load();
    this.diff = CFG.DIFFICULTY[this.settings.difficulty] || CFG.DIFFICULTY.normal;
    Scenes.stopStoryTyping();

    this.player = new Player(this);
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.grenades = [];
    this.pickups = [];
    this.particles = [];
    this.boss = null;
    this.time = 0;
    this.kills = 0;
    this.levelKills = 0;
    this.score = 0;
    this.deathT = 0;
    this.winT = 0;
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.shake = 0;

    this.mode = "run";
    this.state = "run";
    this.hintT = 8.5;   // 开局操作提示
    this._hideAllScenes();
    if (this.dev.allWeapons) this.grantAllWeapons();
    LevelSys.startLevel(this);
    AudioSys.stopMusic();   // 开始游戏后不再播放音乐
  }

  /* 开发者：解锁全部武器（满弹药 + 图鉴记录） */
  grantAllWeapons() {
    const p = this.player;
    if (!p) return;
    for (const id of Object.keys(CFG.WEAPONS)) p.addWeapon(id, this);
  }

  /* 开发者：立即通关当前关卡（补足击杀数 + 清场 + 开门）
     支持对局中（run）与暂停中（pause，ESC 菜单 → 开发者面板）调用 */
  devSkipLevel() {
    if (this.state !== "run" && this.state !== "pause") return;
    if (LevelSys.state === "clear") {
      this.banner("出口门已开启 → 走到门旁进入下一关", "#8fd3ff", 2);
      return;
    }
    const def = CFG.LEVELS[LevelSys.n - 1];
    this.levelKills = def.count;
    LevelSys.bossSpawned = true;
    for (const e of this.enemies) e.dead = true;
    if (this.boss) this.boss.dead = true;
    this.boss = null;
    LevelSys.state = "clear";
    this.onLevelClear();
    this.addShake(6);
  }

  pause() {
    if (this.state !== "run") return;
    this.state = "pause";
    // 关键：清掉本帧的 Esc，否则 update() 末尾的“恢复”检查会在同一帧立刻 resume
    Input.pressed.delete("Escape");
    const st = document.getElementById("pause-stats");
    if (st) {
      st.innerHTML = `第 ${LevelSys.n} 关 · 击杀 ${this.kills} · 得分 ${this.score} · HP ${Math.max(0, Math.ceil(this.player.hp))}/${this.player.maxHp}`;
    }
    Scenes.show("pause");
    AudioSys.play("click");
  }

  resume() {
    this.state = "run";
    this._hideAllScenes();
    AudioSys.play("click");
  }

  toMenu() {
    this.mode = "menu";
    this.state = "menu";
    this._hideAllScenes();
    Scenes.show("menu", true);
    AudioSys.startMusic("menu");
  }

  _hideAllScenes() {
    const ids = ["menu", "story", "codex", "settings", "pause", "gameover", "victory", "dev"];
    for (const id of ids) {
      const el = document.getElementById("scene-" + id);
      if (el) el.classList.add("hidden");
    }
  }

  onPlayerDeath() {
    this.state = "dying";
    this.deathT = 1.6;
    const p = this.player;
    worldExplosion(this, p.x, p.y, 0, 90, "enemy", "#ff6b35");
    this.addShake(20);
    AudioSys.play("explosion");
  }

  /* 关卡清除：补给 + 开门 */
  onLevelClear() {
    const p = this.player;
    p.heal(Math.round(p.maxHp * CFG.LEVEL_CLEAR.healPct));
    for (const wid of p.weapons) {
      const max = CFG.WEAPONS[wid].ammo;
      if (max !== Infinity) p.ammo[wid] = Math.min(max, p.ammo[wid] + Math.round(max * CFG.LEVEL_CLEAR.ammoPct));
    }
    p.grenadeCd = 0;
    const bonus = CFG.LEVEL_CLEAR.scoreBonus + LevelSys.n * 50;
    this.score += bonus;
    this.banner("第 " + LevelSys.n + " 关完成 · 出口门已开启 →", "#6fdc6f", 2.8);
    this.addSubtitle("生命 +" + Math.round(p.maxHp * CFG.LEVEL_CLEAR.healPct) + " · 弹药补给 · 得分 +" + bonus, "#9fe8b8", 4);
    AudioSys.play("clear");
  }

  enterNextLevel() {
    // 清场转场 + 重新生成新关卡地图（障碍数量随关卡递增）
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.grenades = [];
    this.pickups = [];
    this.particles = [];
    this.boss = null;
    if (LevelSys.n >= CFG.LEVELS.length) {
      this.onVictory();
      return;
    }
    MapSys.build();
    LevelSys.startLevel(this);
  }

  onVictory() {
    this.state = "winning";
    this.winT = 2.4;
    AudioSys.stopMusic();   // 通关：静默后接入黑屏演出
    this.banner("☠ 蜂巢核心已被摧毁 ☠", "#ffe08a", 4.5);
    this.addSubtitle("任务完成——人类记住了你是怎么死的。", "#cfe4ff", 4.5);
    // 金色庆祝粒子
    const p = this.player;
    for (let i = 0; i < 90; i++) {
      const a = rand(0, TAU);
      const spd = rand(40, 320);
      this.particles.push(new Particle(p.x, p.y, Math.cos(a) * spd, Math.sin(a) * spd, rand(0.6, 1.6), rand(2, 5), choice(["#ffd166", "#ffb84d", "#fff3c4", "#ff8c42"]), "dot", 0));
    }
    this.particles.push(new Particle(p.x, p.y, 0, 0, 1.2, 160, "rgba(255,200,80,0.5)", "ring", 0));
    this.addShake(10);
    AudioSys.play("victory");
  }

  spawnEnemy(type, x, y, level) {
    if (x == null) {
      const sp = MapSys.pickSpawn(this.player);
      x = sp.x; y = sp.y;
    }
    const e = new Enemy(type, x, y, level || LevelSys.n, this);
    this.enemies.push(e);
    if (e.kind === "boss") this.boss = e;
    // 出生特效（怪物从四面八方涌出可见）
    this.particles.push(new Particle(x, y, 0, 0, 0.5, 28, "rgba(255,70,50,0.4)", "ring", 0));
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU);
      this.particles.push(new Particle(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 0, -rand(30, 80), rand(0.4, 0.7), 3, "rgba(255,120,70,0.6)", "dot", 0));
    }
  }

  _stats() {
    const m = Math.floor(this.time / 60), s = Math.floor(this.time % 60);
    const hpPct = this.player ? this.player.hp / this.player.maxHp : 0;
    return {
      level: LevelSys.n,
      kills: this.kills,
      score: this.score,
      time: `${padNum(m, 2)}:${padNum(s, 2)}`,
      hpPct,
      total: CFG.LEVELS.length,
    };
  }

  /* 补给箱交互：武器箱解锁新武器，弹药箱补充弹药（已满不消耗） */
  _updateCrates() {
    const p = this.player;
    if (!p) return;
    for (const c of MapSys.crates) {
      if (c.taken) continue;
      if (dist(p.x, p.y, c.x, c.y) < 48) {
        if (c.kind === "weapon") {
          const avail = Object.keys(CFG.WEAPONS).filter(w => !p.weapons.includes(w));
          if (avail.length) {
            const wid = choice(avail);
            p.addWeapon(wid, this);
            // 获得武器演出
            for (let i = 0; i < 26; i++) {
              const a = rand(0, TAU), spd = rand(40, 260);
              this.particles.push(new Particle(c.x, c.y, Math.cos(a) * spd, Math.sin(a) * spd, rand(0.5, 1.2), rand(2, 5), choice(["#ffd166", "#ffe08a", "#fff"]), "dot", 0));
            }
            this.particles.push(new Particle(c.x, c.y, 0, 0, 0.6, 60, "rgba(255,200,80,0.5)", "ring", 0));
            this.addText(c.x, c.y - 40, "获得武器：" + CFG.WEAPONS[wid].name, "#ffe08a", 17);
            AudioSys.play("levelup");
            this.addShake(6);
            c.taken = true;
          } else {
            // 武器已齐 → 改为弹药
            if (this._giveAmmoAll()) {
              c.taken = true;
              this.addText(c.x, c.y - 40, "弹药补给", "#8fd3ff", 15);
              AudioSys.play("ammo");
            } else {
              this.addText(p.x, p.y - 22, "弹药已满", "#9fb4cc", 13);
            }
          }
        } else if (c.kind === "ammo") {
          if (this._giveAmmoAll()) {
            c.taken = true;
            this.addText(c.x, c.y - 40, "弹药补给", "#8fd3ff", 15);
            AudioSys.play("ammo");
          } else {
            this.addText(p.x, p.y - 22, "弹药已满", "#9fb4cc", 13);
          }
        } else {
          // 急救箱：回血 30%（已满则提示一次，不消耗）
          if (p.hp < p.maxHp) {
            p.heal(Math.round(p.maxHp * 0.3));
            c.taken = true;
            this.addText(c.x, c.y - 40, "生命 +30%", "#6fdc6f", 16);
            AudioSys.play("health");
          } else {
            this.addText(p.x, p.y - 22, "生命已满", "#9fb4cc", 13);
          }
        }
      }
    }
  }

  /* 为所有已拥有武器补弹 40% 上限，返回是否补到 */
  _giveAmmoAll() {
    const p = this.player;
    let gained = false;
    for (const wid of p.weapons) {
      const max = CFG.WEAPONS[wid].ammo;
      if (max !== Infinity && p.ammo[wid] < max) {
        p.ammo[wid] = Math.min(max, p.ammo[wid] + Math.round(max * 0.4));
        gained = true;
      }
    }
    return gained;
  }

  /* ==================== 特效辅助 ==================== */
  addText(x, y, text, color, size) {
    this.particles.push(new Particle(x, y, 0, -46, 0.9, size || 13, color, "text", text));
  }

  addShake(v) {
    if (!this.settings.shake) return;
    this.shake = Math.min(26, this.shake + v);
  }

  banner(text, color, dur) {
    this.bannerMsg = { text, color, t: dur, dur };
  }

  addSubtitle(text, color, dur) {
    this.subtitleMsg = { text, color: color || "#9fb4cc", t: dur, dur };
  }

  /* ==================== 渲染 ==================== */
  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (this.mode !== "run") {
      this._renderAmbient(ctx);
      ctx.restore();
      return;
    }

    // ---- 世界 ----
    ctx.save();
    const sx = this.shake > 0 ? rand(-this.shake, this.shake) : 0;
    const sy = this.shake > 0 ? rand(-this.shake, this.shake) : 0;
    ctx.translate(this.w / 2 - this.cam.x + sx, this.h / 2 - this.cam.y + sy);

    // 地面层（地板 / 网格 / 立体墙 / 血迹）
    MapSys.drawGround(ctx);

    // 出口门（背景层）
    this._drawDoor(ctx);

    // 深度排序渲染（斜视角：y 大的画在前面）
    const list = [];
    for (const pk of this.pickups) {
      list.push({ y: pk.y, draw: () => pk.draw(ctx, this) });
    }
    for (const c of MapSys.crates) {
      list.push({ y: c.y + 12, draw: () => MapSys.drawCrate(ctx, c, this.time, this.player) });
    }
    for (const e of this.enemies) {
      list.push({ y: e.y, draw: () => e.draw(ctx, this) });
    }
    if (this.player && !this.player.dead) {
      list.push({ y: this.player.y, draw: () => this._drawPlayer(ctx) });
    } else if (this.player) {
      list.push({ y: this.player.y, draw: () => this._drawPlayerCorpse(ctx) });
    }
    for (const o of MapSys.obstacles) {
      if (o.dead) continue;
      list.push({ y: o.y + o.h, draw: () => MapSys.drawObstacle(ctx, o) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const item of list) item.draw();

    // 弹道（顶层）
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath(); ctx.arc(b.x - b.vx * 0.014, b.y - b.vy * 0.014, b.r * 0.5, 0, TAU); ctx.fill();
    }
    for (const b of this.ebullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
    for (const gd of this.grenades) {
      ctx.fillStyle = "#3a4a2c";
      ctx.beginPath(); ctx.arc(gd.x, gd.y, 6, 0, TAU); ctx.fill();
    }

    // 粒子（世界层）
    for (const pt of this.particles) {
      if (pt.kind !== "text") pt.draw(ctx);
    }

    // 瞄准准星
    if (this.player && !this.player.dead) {
      const mx = this.mouseWorld.x, my = this.mouseWorld.y;
      ctx.strokeStyle = "rgba(255,120,80,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx - 9, my); ctx.lineTo(mx - 4, my);
      ctx.moveTo(mx + 4, my); ctx.lineTo(mx + 9, my);
      ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my - 4);
      ctx.moveTo(mx, my + 4); ctx.lineTo(mx, my + 9);
      ctx.stroke();
    }

    // 文字粒子（最顶层，屏幕空间在 restore 后画？保持在世界上层即可）
    for (const pt of this.particles) {
      if (pt.kind === "text") pt.draw(ctx);
    }

    ctx.restore();

    // ---- HUD ----
    this._renderHUD(ctx);
    ctx.restore();
  }

  /* ==================== 出口门（实验室风格双开大门） ==================== */
  _drawDoor(ctx) {
    const d = LevelSys.door;
    const clear = LevelSys.state === "clear";
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 4);
    const w = 132, hh = 96;

    ctx.save();
    ctx.translate(d.x, d.y);
    // 门柱
    ctx.fillStyle = "#2c3b52";
    ctx.fillRect(-w / 2 - 16, -hh / 2 - 22, 16, hh + 44);
    ctx.fillRect(w / 2, -hh / 2 - 22, 16, hh + 44);
    ctx.fillStyle = "#3d5478";
    ctx.fillRect(-w / 2 - 16, -hh / 2 - 22, 16, 10);
    ctx.fillRect(w / 2, -hh / 2 - 22, 16, 10);
    // 横梁
    ctx.fillStyle = "#33465f";
    ctx.fillRect(-w / 2 - 16, -hh / 2 - 32, w + 32, 12);
    ctx.fillStyle = "#4a6388";
    ctx.fillRect(-w / 2 - 16, -hh / 2 - 32, w + 32, 4);
    // 双开扇
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = clear ? `rgba(120,255,180,${0.3 + pulse * 0.25})` : "#5a6b80";
      ctx.fillRect(sgn > 0 ? 2 : -w / 2, -hh / 2, w / 2 - 2, hh);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sgn > 0 ? 2 : -w / 2, -hh / 2, w / 2 - 2, hh);
      // 观察窗
      ctx.fillStyle = clear ? "rgba(200,255,220,0.5)" : "rgba(150,190,230,0.35)";
      ctx.fillRect(sgn > 0 ? w / 2 - 46 : -w / 2 + 24, -hh / 2 + 18, 22, 44);
    }
    // 中缝
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -hh / 2); ctx.lineTo(0, hh / 2); ctx.stroke();
    // 门头警示灯
    ctx.fillStyle = clear ? `rgba(140,255,190,${pulse})` : "rgba(255,60,40,0.85)";
    ctx.beginPath(); ctx.arc(0, -hh / 2 - 40, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = clear ? `rgba(140,255,190,${pulse * 0.3})` : "rgba(255,60,40,0.25)";
    ctx.beginPath(); ctx.arc(0, -hh / 2 - 40, 15, 0, TAU); ctx.fill();
    // 状态文字
    ctx.font = "bold 14px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = clear ? "#b8ffd4" : "#8a9bb0";
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    const label = clear ? "▶ 出口" : "已封锁";
    ctx.strokeText(label, 0, hh / 2 + 38);
    ctx.fillText(label, 0, hh / 2 + 38);
    // 通关后：门上方漂浮箭头 + 文字提示下一区域
    if (clear) {
      const bobY = Math.sin(this.time * 4.5) * 5;
      ctx.fillStyle = "#8dffc0";
      ctx.beginPath();
      ctx.moveTo(0, -hh / 2 - 62 + bobY);
      ctx.lineTo(-11, -hh / 2 - 80 + bobY);
      ctx.lineTo(11, -hh / 2 - 80 + bobY);
      ctx.closePath(); ctx.fill();
      ctx.font = "bold 13px 'Microsoft YaHei', sans-serif";
      ctx.fillStyle = "#8dffc0";
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.lineWidth = 3;
      ctx.strokeText("下一区域 →", 0, -hh / 2 - 88 + bobY);
      ctx.fillText("下一区域 →", 0, -hh / 2 - 88 + bobY);
    }
    ctx.restore();
  }

  /* ==================== 玩家：2.5D 角色（待机静止 / 四肢行走 / 双枪） ==================== */
  _drawPlayer(ctx) {
    const p = this.player;
    const flash = p.invulnT > 0 && Math.floor(p.invulnT * 12) % 2 === 0;

    // 投影（光从左上照来，影子落右下，不在脚下）
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(p.x + 9, p.y + 12, 14, 6.5, 0, 0, TAU);
    ctx.fill();

    // 朝向：按水平分量翻转侧身；枪口精确瞄准
    const aim = p.angle;
    const flip = Math.cos(aim) < 0 ? -1 : 1;
    const gunAng = Math.atan2(Math.sin(aim), flip * Math.cos(aim));
    const gx = Math.cos(gunAng), gy = Math.sin(gunAng);
    const pxv = Math.cos(gunAng + Math.PI / 2), pyv = Math.sin(gunAng + Math.PI / 2);

    // 行走相位（待机 = 0，完全静止）
    const legSwing = p.moving ? Math.sin(p.bobT * 2.2) : 0;
    const bodyBob = p.moving ? Math.abs(Math.cos(p.bobT * 2.2)) * 1.6 : 0;

    ctx.save();
    ctx.translate(p.x, p.y - bodyBob);
    ctx.scale(flip, 1);
    ctx.lineCap = "round";
    ctx.globalAlpha = flash ? 0.55 : 1;

    // ---- 双腿（大腿 + 小腿 + 靴子） ----
    for (const [sgn, sw] of [[1, legSwing], [-1, -legSwing]]) {
      const kneeX = sgn * 3 + sw * 4.5;
      const kneeY = -2;
      const footX = sgn * 2.5 + sw * 6.5;
      ctx.strokeStyle = "#c8d6e8";
      ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.moveTo(sgn * 2, -10); ctx.lineTo(kneeX, kneeY); ctx.stroke();
      ctx.strokeStyle = "#9fb4cc";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, 8); ctx.stroke();
      // 靴子
      ctx.fillStyle = "#5b6a80";
      ctx.beginPath();
      ctx.ellipse(footX + sgn * 3, 9.5, 6, 3.4, 0, 0, TAU);
      ctx.fill();
    }

    // ---- 躯干（护甲，侧身有厚度） ----
    ctx.fillStyle = "#3f6ea5";
    ctx.beginPath();
    ctx.moveTo(-7, -12);
    ctx.quadraticCurveTo(-9, -4, -5, 2);
    ctx.lineTo(6, 2);
    ctx.quadraticCurveTo(9, -4, 7, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#27435f";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 背部护甲板
    ctx.fillStyle = "#2c4f7c";
    ctx.beginPath();
    ctx.moveTo(-7, -12);
    ctx.quadraticCurveTo(-8, -6, -6, 0);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-3, -12);
    ctx.closePath();
    ctx.fill();
    // 胸甲高光
    ctx.fillStyle = "rgba(160,210,255,0.22)";
    ctx.beginPath();
    ctx.ellipse(1, -6, 4.5, 5, -0.2, 0, TAU);
    ctx.fill();

    // ---- 头（头盔 + 面罩，面朝枪口方向） ----
    ctx.fillStyle = "#5b8fc7";
    ctx.beginPath(); ctx.arc(2, -19, 6.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#2c4a6b";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#9fd4ff";
    ctx.beginPath(); ctx.arc(5, -19, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.arc(5.8, -20, 1.4, 0, TAU); ctx.fill();
    ctx.fillStyle = "#3a5a80";
    ctx.beginPath();
    ctx.arc(0, -21.5, 5, 0.6 * Math.PI, 1.6 * Math.PI);
    ctx.lineTo(0, -19.5);
    ctx.fill();

    // ---- 手臂 + 武器（朝向精确瞄准角，双手抓握自然；开火时枪身后坐踢起） ----
    const shX = 3, shY = -9;   // 肩
    const recoil = p.recoilT;
    const def = CFG.WEAPONS[p.curW];
    // 后坐踢枪角：绕持枪手旋转，视觉上枪口上挑（flip 补偿镜像）
    const kick = recoil * 0.16 * flip;
    if (p.curW === "pistol") {
      // 双枪：左右手各一把，交替位置
      for (const sgn of [1, -1]) {
        const handX = shX + gx * 9 - pxv * 3.6 * sgn - gx * recoil * 2;
        const handY = shY + gy * 9 - pyv * 3.6 * sgn - gy * recoil * 2;
        ctx.strokeStyle = "#c8d6e8";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(handX, handY); ctx.stroke();
        ctx.save();
        ctx.translate(handX, handY);
        ctx.rotate(gunAng);
        ctx.rotate(-kick);
        // 手枪（枪口朝 +x，后坐时整体后收 + 上挑）
        ctx.fillStyle = "#39465a";
        ctx.fillRect(1 - recoil * 1.5, -3, 11, 5);
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(9 + recoil * 3, -3, 6, 6);
        ctx.fillStyle = "#2a3545";
        ctx.fillRect(3 - recoil * 1.5, 2, 4, 6);
        // 手（抓住握把）
        ctx.fillStyle = "#d9c8a8";
        ctx.beginPath(); ctx.arc(5 - recoil * 1.5, 4.5, 3.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // 单武器：双手握持，手抓在握把/枪托处
      const handX = shX + gx * 8.5 - gx * recoil * 2;
      const handY = shY + gy * 8.5 - gy * recoil * 2;
      ctx.strokeStyle = "#c8d6e8";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(handX, handY); ctx.stroke();
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(gunAng);
      ctx.rotate(-kick);
      drawWeaponShape(ctx, p.curW, recoil);
      // 后手（握把处，随枪后坐）
      ctx.fillStyle = "#d9c8a8";
      ctx.beginPath(); ctx.arc(-1 - recoil * 1.5, 1.5, 3.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // 冲刺光环
    if (p.dashT > 0) {
      ctx.strokeStyle = "rgba(120,220,255,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x + 9, p.y + 12, 17, 8, 0, 0, TAU); ctx.stroke();
    }
  }

  _drawPlayerCorpse(ctx) {
    const p = this.player;
    // 投影
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(p.x + 9, p.y + 12, 13, 6, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#8a9bb0";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    // 倒下的身体（仰面/侧倒）
    ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 2); ctx.lineTo(p.x + 8, p.y + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x - 5, p.y + 3); ctx.lineTo(p.x + 5, p.y - 3); ctx.stroke();
    // 断开的枪
    ctx.fillStyle = "#39465a";
    ctx.fillRect(p.x - 14, p.y + 3, 8, 4);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(p.x - 7, p.y + 3.5, 3, 3);
    // 头盔
    ctx.fillStyle = "#4a6d94";
    ctx.beginPath(); ctx.arc(p.x + 9, p.y + 2, 5, 0, TAU); ctx.fill();
  }

  /* 菜单环境背景 */
  _renderAmbient(ctx) {
    const w = this.w, h = this.h;
    const t = this.ambient.t;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#070a10");
    g.addColorStop(0.6, "#0b0f18");
    g.addColorStop(1, "#120a0e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 远景星球（右上）
    const pw = w * 0.15, px = w * 0.82, py = h * 0.2;
    const pg = ctx.createRadialGradient(px - pw * 0.3, py - pw * 0.3, pw * 0.1, px, py, pw);
    pg.addColorStop(0, "#2a3550");
    pg.addColorStop(1, "#0c101c");
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(px, py, pw, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(160,120,80,0.22)";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(px, py, pw * 1.55, pw * 0.4, -0.4, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1;
    const rg = ctx.createRadialGradient(px, py, pw * 0.8, px, py, pw * 1.7);
    rg.addColorStop(0, "rgba(150,95,50,0.12)");
    rg.addColorStop(1, "rgba(150,95,50,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(px - pw * 1.7, py - pw * 1.7, pw * 3.4, pw * 3.4);

    for (const s of this.ambient.stars) {
      const a = 0.35 + 0.4 * Math.sin(t * 1.7 + s.tw);
      ctx.fillStyle = `rgba(200,220,255,${a})`;
      ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
    }

    // 流星（每 7 秒划过一颗）
    const shT = t % 7;
    if (shT < 1.1) {
      const p = shT / 1.1;
      const sx = w * (0.08 + p * 0.72);
      const sy = h * (0.04 + p * 0.34);
      const len = w * 0.13;
      ctx.strokeStyle = `rgba(220,240,255,${0.7 * (1 - p)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - len * 0.28, sy + len * 0.12); ctx.stroke();
      ctx.lineWidth = 1;
    }

    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const fx = (0.3 + 0.4 * Math.sin(t * 0.12 + i * 2.1)) * w;
      const fy = (0.25 + 0.5 * Math.cos(t * 0.09 + i * 1.7)) * h;
      const r = (0.35 + 0.1 * Math.sin(t * 0.2 + i)) * Math.min(w, h);
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
      fg.addColorStop(0, "rgba(160,30,20,0.10)");
      fg.addColorStop(1, "rgba(160,30,20,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(fx - r, fy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "source-over";

    for (const e of this.ambient.embers) {
      ctx.fillStyle = `rgba(255,120,60,${e.a * (0.5 + 0.5 * Math.sin(t * 3 + e.x * 40))})`;
      ctx.beginPath(); ctx.arc(e.x * w, e.y * h, e.s, 0, TAU); ctx.fill();
    }
  }

  /* ==================== HUD ==================== */
  _renderHUD(ctx) {
    const p = this.player;
    if (!p) return;
    const w = this.w;

    // 开发者模式角标
    const devOn = this.dev && (this.dev.invincible || this.dev.infiniteAmmo || this.dev.allWeapons || this.dev.speedX2);
    if (devOn) {
      ctx.textAlign = "left";
      ctx.font = "bold 12px 'Microsoft YaHei', sans-serif";
      ctx.fillStyle = "rgba(255,106,61,0.95)";
      ctx.fillText("⚒ 开发者模式", 16, this.h - 64);
    }

    // ---------- 左上：生命 ----------
    const hpW = 250, hpX = 16, hpY = 16;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(hpX - 3, hpY - 3, hpW + 6, 22);
    const hpPct = clamp(p.hp / p.maxHp, 0, 1);
    ctx.fillStyle = hpPct > 0.5 ? "#5fbf5f" : hpPct > 0.25 ? "#e8b23a" : "#e04b3a";
    ctx.fillRect(hpX, hpY, hpW * hpPct, 16);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.strokeRect(hpX - 0.5, hpY - 0.5, hpW + 1, 17);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`HP ${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`, hpX + hpW / 2, hpY + 12.5);

    const cdY = hpY + 30;
    this._cdBar(ctx, hpX, cdY, 116, "冲刺", p.dashCd, CFG.PLAYER.dashCd, "#7fd0ff");
    this._cdBar(ctx, hpX + 126, cdY, 116, "手雷", p.grenadeCd, CFG.PLAYER.grenadeCd, "#ffb84d");

    // ---------- 右上：关卡信息 ----------
    ctx.textAlign = "right";
    ctx.font = "bold 17px 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = "#cfe4ff";
    const lv = CFG.LEVELS[LevelSys.n - 1];
    ctx.fillText(`第 ${LevelSys.n} / ${CFG.LEVELS.length} 关${lv ? " · " + lv.name : ""}`, w - 18, 34);
    ctx.font = "13px 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = "#ff9e7d";
    ctx.fillText(`目标 ${Math.min(this.levelKills, LevelSys.killTarget)} / ${LevelSys.killTarget}`, w - 18, 54);
    ctx.fillStyle = "#ffd166";
    ctx.fillText(`得分 ${this.score}`, w - 18, 72);
    ctx.fillStyle = "#9fb4cc";
    ctx.fillText(`击杀 ${this.kills}`, w - 18, 90);

    // ---------- 底部中央：关卡进度 ----------
    const dotN = CFG.LEVELS.length;
    const gap = 26, dotX0 = (w - gap * (dotN - 1)) / 2, dotY = this.h - 34;
    for (let i = 0; i < dotN; i++) {
      const dx = dotX0 + i * gap;
      if (i + 1 < LevelSys.n) { ctx.fillStyle = "#5fbf5f"; }
      else if (i + 1 === LevelSys.n) { ctx.fillStyle = "#ffb84d"; ctx.beginPath(); ctx.arc(dx, dotY, 7, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,184,77,0.25)"; ctx.beginPath(); ctx.arc(dx, dotY, 11, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = "rgba(160,180,210,0.25)"; }
      if (i + 1 !== LevelSys.n) { ctx.beginPath(); ctx.arc(dx, dotY, 5, 0, TAU); ctx.fill(); }
    }

    // ---------- 左下：武器 ----------
    const def = CFG.WEAPONS[p.curW];
    ctx.textAlign = "left";
    ctx.font = "bold 20px 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(def.name, 16, this.h - 30);
    ctx.font = "bold 15px 'Microsoft YaHei', sans-serif";
    const ammoTxt = p.ammo[p.curW] === Infinity ? "∞" : `${p.ammo[p.curW]} / ${p.ammoMax}`;
    ctx.fillStyle = p.ammo[p.curW] <= 0 ? "#ff5a4d" : "#ffd166";
    ctx.fillText(ammoTxt, 16, this.h - 10);

    // 武器槽位（未获得的武器显示 ???）
    ctx.font = "12px 'Microsoft YaHei', sans-serif";
    let sx = 130;
    const allWeapons = Object.keys(CFG.WEAPONS);
    for (let i = 0; i < allWeapons.length; i++) {
      const wid = allWeapons[i];
      const owned = p.weapons.includes(wid);
      const isCur = wid === p.curW;
      ctx.fillStyle = isCur ? "rgba(127,208,255,0.35)" : "rgba(0,0,0,0.45)";
      ctx.fillRect(sx, this.h - 34, 76, 26);
      ctx.strokeStyle = isCur ? "#7fd0ff" : "rgba(255,255,255,0.2)";
      ctx.strokeRect(sx + 0.5, this.h - 33.5, 75, 25);
      ctx.fillStyle = isCur ? "#fff" : "#9fb4cc";
      ctx.textAlign = "left";
      ctx.fillText(`${i + 1}`, sx + 6, this.h - 16);
      ctx.fillText(owned ? CFG.WEAPONS[wid].name : "???", sx + 22, this.h - 16);
      sx += 84;
    }

    // ---------- Boss 血条 ----------
    if (this.boss && !this.boss.dead) {
      const bw = 420, bx = (w - bw) / 2, by = 16;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(bx - 3, by - 3, bw + 6, 26);
      const bp = clamp(this.boss.hp / this.boss.maxHp, 0, 1);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(bx, by, bw * bp, 20);
      ctx.strokeStyle = "rgba(255,120,100,0.5)";
      ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, 21);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`☠ ${this.boss.def.name}  ${Math.max(0, Math.ceil(this.boss.hp))}`, w / 2, by + 14.5);
    }

    // ---------- Boss 方位指示器 ----------
    this._renderBossIndicator(ctx);

    // ---------- 通关后出口门方位指示器 ----------
    this._renderDoorIndicator(ctx);

    // ---------- 开局操作提示 ----------
    if (this.hintT > 0) {
      const a = clamp(this.hintT / 1.2, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = "15px 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#e8f1fb";
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.lineWidth = 4;
      const hint = "WASD 移动 · 左键射击 · 右键手雷 · 空格冲刺 · 1-7 切换武器 · 清空敌人后进入出口门 · Esc 暂停";
      ctx.strokeText(hint, w / 2, this.h - 60);
      ctx.fillText(hint, w / 2, this.h - 60);
      ctx.globalAlpha = 1;
    }

    // ---------- 横幅 ----------
    if (this.bannerMsg.t > 0) {
      const b = this.bannerMsg;
      const a = clamp(Math.min(b.t, b.dur - b.t) / 0.35, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = "bold 32px 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 6;
      ctx.strokeText(b.text, w / 2, this.h * 0.3);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, w / 2, this.h * 0.3);
      ctx.globalAlpha = 1;
    }

    // ---------- 副标题 ----------
    if (this.subtitleMsg.t > 0) {
      const s = this.subtitleMsg;
      const a = clamp(Math.min(s.t, s.dur - s.t) / 0.4, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = "15px 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 4;
      ctx.strokeText(s.text, w / 2, this.h * 0.3 + 30);
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, w / 2, this.h * 0.3 + 30);
      ctx.globalAlpha = 1;
    }
  }

  /* Boss 方位指示器：屏幕边缘箭头 */
  _renderBossIndicator(ctx) {
    const b = this.boss;
    if (!b || b.dead) return;
    const sx = this.w / 2 + (b.x - this.cam.x);
    const sy = this.h / 2 + (b.y - this.cam.y);
    const onScreen = sx > -10 && sx < this.w + 10 && sy > -10 && sy < this.h + 10;
    if (onScreen) {
      // 屏幕内：头顶骷髅标记
      ctx.font = "bold 15px 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ff5a4d";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeText("☠", sx, sy - b.r - 12);
      ctx.fillText("☠", sx, sy - b.r - 12);
      return;
    }
    // 屏幕外：边缘红箭头
    const ang = Math.atan2(sy - this.h / 2, sx - this.w / 2);
    const ex = clamp(sx, 34, this.w - 34);
    const ey = clamp(sy, 40, this.h - 40);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = "rgba(255,60,60,0.95)";
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-9, -11); ctx.lineTo(-9, 11);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = "bold 13px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff8a7d";
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText("☠ " + b.def.name, ex, ey - 22);
    ctx.fillText("☠ " + b.def.name, ex, ey - 22);
  }

  /* 通关后出口门方位指示器：屏幕边缘绿色箭头指向下一关入口 */
  _renderDoorIndicator(ctx) {
    if (LevelSys.state !== "clear") return;
    const d = LevelSys.door;
    const sx = this.w / 2 + (d.x - this.cam.x);
    const sy = this.h / 2 + (d.y - this.cam.y);
    const onScreen = sx > -20 && sx < this.w + 20 && sy > -20 && sy < this.h + 20;
    if (onScreen) return;   // 屏幕内由门上的漂浮箭头提示
    const ang = Math.atan2(sy - this.h / 2, sx - this.w / 2);
    const ex = clamp(sx, 34, this.w - 34);
    const ey = clamp(sy, 40, this.h - 40);
    const pulse = 0.7 + 0.3 * Math.sin(this.time * 6);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#5fe08a";
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-8, -12); ctx.lineTo(-8, 12);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.font = "bold 13px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#8dffc0";
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 3;
    ctx.strokeText("▶ 出口 → 下一区域", ex, ey - 24);
    ctx.fillText("▶ 出口 → 下一区域", ex, ey - 24);
  }

  _cdBar(ctx, x, y, w, label, cd, max, color) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - 2, y - 2, w + 4, 14);
    const pct = clamp(1 - cd / Math.max(0.001, max), 0, 1);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * pct, 10);
    ctx.fillStyle = "#dfe9f5";
    ctx.font = "11px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label + (cd > 0 ? ` ${cd.toFixed(1)}s` : " ✓"), x + 2, y + 9.5);
  }
}

/* 武器外形绘制（斜视角下按类型区分，光从左上照来） */
function drawWeaponShape(ctx, id, recoil) {
  ctx.lineCap = "round";
  const c = CFG.WEAPONS[id].color;
  switch (id) {
    case "pistol": {
      ctx.fillStyle = "#39465a";
      ctx.fillRect(2, -3, 14, 6);
      ctx.fillStyle = c;
      ctx.fillRect(13 + recoil * 3, -2.5, 5, 5);
      ctx.fillStyle = "#2a3545";
      ctx.fillRect(4, 3, 5, 7);
      break;
    }
    case "shotgun": {
      ctx.fillStyle = "#4a3b26";
      ctx.fillRect(2, -4.5, 18, 5);
      ctx.fillRect(2, 0.5, 18, 5);
      ctx.fillStyle = c;
      ctx.fillRect(18 + recoil * 3, -5, 5, 11);
      ctx.fillStyle = "#5c4a30";
      ctx.fillRect(6, -2.5, 4, 8);
      ctx.fillStyle = "#3a2c1c";
      ctx.fillRect(-1, -1.5, 4, 8);
      break;
    }
    case "smg": {
      ctx.fillStyle = "#333f52";
      ctx.fillRect(2, -3, 16, 5);
      ctx.fillStyle = c;
      ctx.fillRect(16 + recoil * 3, -3, 5, 5);
      ctx.fillStyle = "#242e3d";
      ctx.fillRect(7, 2, 4, 8);
      ctx.fillStyle = "#39465a";
      ctx.fillRect(-2, -3, 4, 6);
      break;
    }
    case "rifle": {
      ctx.fillStyle = "#2f3d52";
      ctx.fillRect(2, -3, 20, 5);
      ctx.fillStyle = c;
      ctx.fillRect(20 + recoil * 3, -3.5, 5, 6);
      ctx.fillStyle = "#242e3d";
      ctx.fillRect(8, 2, 4, 8);
      ctx.fillStyle = "#39465a";
      ctx.fillRect(-3, -3, 5, 6);
      ctx.fillStyle = "#55677f";
      ctx.fillRect(10, -7.5, 7, 4);
      ctx.fillStyle = "#9fd4ff";
      ctx.fillRect(13, -7, 2, 3);
      break;
    }
    case "plasma": {
      ctx.fillStyle = "#4a3d6b";
      ctx.fillRect(2, -4, 16, 8);
      ctx.fillStyle = c;
      ctx.fillRect(16 + recoil * 3, -5, 6, 10);
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(6, -4); ctx.lineTo(8, 4);
      ctx.moveTo(10, -4); ctx.lineTo(12, 4);
      ctx.moveTo(14, -4); ctx.lineTo(16, 4);
      ctx.stroke();
      ctx.fillStyle = "#2f2845";
      ctx.fillRect(0, -2, 4, 4);
      break;
    }
    case "flamer": {
      ctx.fillStyle = "#45403a";
      ctx.fillRect(2, -3.5, 14, 7);
      ctx.fillStyle = c;
      ctx.fillRect(14 + recoil * 3, -3.5, 7, 7);
      ctx.fillStyle = "#7a4a2a";
      ctx.beginPath(); ctx.arc(-5, 5, 6.5, 0, TAU); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(-5, 5, 2.5, 0, TAU); ctx.fill();
      break;
    }
    case "minigun": {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = "#39465a";
        ctx.fillRect(2, -5.5 + i * 4, 16, 3);
      }
      ctx.fillStyle = c;
      ctx.fillRect(16 + recoil * 3, -6, 6, 13);
      ctx.fillStyle = "#242e3d";
      ctx.fillRect(-3, -3, 6, 6);
      break;
    }
  }
}
