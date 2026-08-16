/* ============ 场景系统（DOM 界面） ============ */
"use strict";

/* ============ 通关黑屏演出（地球 + 你已拯救地球） ============ */
const Cinema = {
  el: null, cv: null, ctx2d: null,
  raf: 0, t0: 0, dur: 5.4, done: null,
  stars: [], finished: false,
  _safeTimer: null,

  play(onDone) {
    this.done = onDone || null;
    this.finished = false;
    this.el = document.getElementById("cinema");
    this.cv = document.getElementById("cinema-canvas");
    this.ctx2d = this.cv && this.cv.getContext ? this.cv.getContext("2d") : null;
    if (!this.el) { if (this.done) this.done(); return; }

    this.el.classList.remove("hidden");
    this.cv.width = window.innerWidth || 1280;
    this.cv.height = window.innerHeight || 720;

    this.stars = [];
    for (let i = 0; i < 170; i++) {
      this.stars.push({
        x: Math.random(), y: Math.random(),
        s: Math.random() * 1.7 + 0.4,
        tw: Math.random() * 6.28, sp: 0.015 + Math.random() * 0.05,
      });
    }
    const big = document.getElementById("cinema-big");
    const sub = document.getElementById("cinema-sub");
    const stamp = this.el.querySelector ? this.el.querySelector(".cinema-stamp") : null;
    if (big) big.textContent = "";
    if (sub) { sub.textContent = ""; sub.classList.remove("show"); }
    if (stamp) stamp.classList.remove("show");

    this.el.style.opacity = "0";
    requestAnimationFrame(() => { if (this.el) this.el.style.opacity = "1"; });

    this.t0 = performance.now();
    this._onSkip = () => this._finish(true);
    window.addEventListener("pointerdown", this._onSkip);
    window.addEventListener("keydown", this._onSkip);
    this._safeTimer = setTimeout(() => this._finish(true), (this.dur + 1) * 1000);
    this._tick();
  },

  _tick() {
    if (this.finished) return;
    const t = (performance.now() - this.t0) / 1000;
    this._draw(t);
    // 文字时间轴
    if (t > 0.8) this._typeBig(t, 0.8, 2.3, "你 已 拯 救 地 球");
    if (t >= 2.1) {
      const sub = document.getElementById("cinema-sub");
      if (sub && !sub.classList.contains("show")) { sub.textContent = "蜂巢核心已被摧毁 · 人类重获新生"; sub.classList.add("show"); }
      const stamp = this.el && this.el.querySelector ? this.el.querySelector(".cinema-stamp") : null;
      if (stamp && !stamp.classList.contains("show")) stamp.classList.add("show");
    }
    if (t >= this.dur) { this._finish(false); return; }
    this.raf = requestAnimationFrame(() => this._tick());
  },

  _typeBig(t, tStart, tEnd, text) {
    const big = document.getElementById("cinema-big");
    if (!big) return;
    const p = Math.max(0, Math.min(1, (t - tStart) / (tEnd - tStart)));
    big.textContent = text.slice(0, Math.floor(p * text.length));
  },

  _draw(t) {
    const ctx = this.ctx2d;
    if (!ctx) return;
    const w = this.cv.width, h = this.cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // 星空漂移
    for (const s of this.stars) {
      const sx = ((s.x - t * s.sp) % 1 + 1) % 1;
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.4 + s.tw));
      ctx.fillStyle = "#cfe4ff";
      ctx.fillRect(sx * w, s.y * h, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // 地球
    const R = Math.min(w, h) * 0.17;
    const cx = w / 2, cy = h / 2;
    const appear = Math.max(0, Math.min(1, (t - 0.2) / 1.15));
    const er = R * (0.55 + 0.45 * appear);
    if (appear > 0) {
      // 大气光晕
      const glow = ctx.createRadialGradient(cx, cy, er * 0.5, cx, cy, er * 2.1);
      glow.addColorStop(0, "rgba(90,170,255,0.38)");
      glow.addColorStop(0.55, "rgba(60,120,220,0.10)");
      glow.addColorStop(1, "rgba(60,120,220,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - er * 2.2, cy - er * 2.2, er * 4.4, er * 4.4);
      // 出现脉冲环
      if (t < 1.5) {
        const ringP = (t - 0.2) / 1.3;
        ctx.strokeStyle = `rgba(140,200,255,${0.5 * (1 - ringP)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, er * (1 + ringP * 1.4), 0, TAU); ctx.stroke();
        ctx.lineWidth = 1;
      }
      // 球体
      const grad = ctx.createRadialGradient(cx - er * 0.35, cy - er * 0.4, er * 0.1, cx, cy, er);
      grad.addColorStop(0, "#7cc0ff");
      grad.addColorStop(0.55, "#2e6fd8");
      grad.addColorStop(1, "#0d2a5e");
      ctx.beginPath(); ctx.arc(cx, cy, er, 0, TAU);
      ctx.fillStyle = grad; ctx.fill();
      // 大陆（伪旋转滚动）
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, er, 0, TAU); ctx.clip();
      const rot = t * 0.10;
      const land = ["#3fae5a", "#2f8f4a", "#57c26b"];
      const blobs = [
        { ox: 0.25, oy: -0.20, r: 0.30, s: 0.9 },
        { ox: -0.30, oy: 0.15, r: 0.38, s: 1.2 },
        { ox: 0.05, oy: 0.38, r: 0.28, s: 1.0 },
      ];
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const lx = (((b.ox + rot * b.s) % 1) + 1) % 1;
        const px = cx + (lx - 0.5) * 2 * er;
        const py = cy + b.oy * er * 1.7;
        ctx.fillStyle = land[i];
        ctx.beginPath();
        ctx.ellipse(px, py, b.r * er, b.r * er * 0.55, 0, 0, TAU);
        ctx.fill();
      }
      // 云带
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      for (let i = 0; i < 3; i++) {
        const cx2 = cx + Math.sin(t * 0.08 + i * 2) * er * 0.8;
        const cy2 = cy + (i - 1) * er * 0.45;
        ctx.beginPath(); ctx.ellipse(cx2, cy2, er * 0.5, er * 0.12, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // 高光
      const hl = ctx.createRadialGradient(cx - er * 0.4, cy - er * 0.5, 0, cx - er * 0.4, cy - er * 0.5, er * 1.15);
      hl.addColorStop(0, "rgba(255,255,255,0.30)");
      hl.addColorStop(0.5, "rgba(255,255,255,0.05)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hl;
      ctx.beginPath(); ctx.arc(cx, cy, er, 0, TAU); ctx.fill();
    }
  },

  _finish(forced) {
    if (this.finished) return;
    this.finished = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    clearTimeout(this._safeTimer);
    window.removeEventListener("pointerdown", this._onSkip);
    window.removeEventListener("keydown", this._onSkip);
    const el = this.el;
    if (el) {
      el.style.opacity = "0";
      setTimeout(() => { if (el) el.classList.add("hidden"); }, 500);
    }
    const done = this.done;
    this.done = null;
    if (done) setTimeout(done, 250);
  },
};

const Scenes = {
  game: null,
  storyIdx: 0,
  toastTimer: null,
  storyTypeTimer: null,   // 剧情打字机定时器
  storyFull: "",
  storyCharIdx: 0,
  devReturn: "menu",      // 开发者模式面板返回目标：menu | pause

  init(game) {
    this.game = game;

    // ===== 主菜单 =====
    document.querySelectorAll("#scene-menu .menu-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.action;
        AudioSys.play("click");
        if (act === "single") this.showStory();
        else if (act === "multi") this.toast("多人模式尚未开放，敬请期待！");
        else if (act === "codex") { this.show("codex"); this.renderCodex("enemy"); }
        else if (act === "settings") { this.show("settings"); this.renderSettings(); }
        else if (act === "dev") { this.devReturn = "menu"; this.show("dev"); this.renderDev(); }
      });
    });

    // ===== 剧情 =====
    document.getElementById("story-next").addEventListener("click", () => {
      AudioSys.play("click");
      this.nextStorySlide();
    });
    document.getElementById("story-skip").addEventListener("click", () => {
      AudioSys.play("click");
      this.stopStoryTyping();
      game.startRun();
    });

    // ===== 图鉴 =====
    document.querySelectorAll("#codex-tabs .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        AudioSys.play("click");
        document.querySelectorAll("#codex-tabs .tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.renderCodex(tab.dataset.tab);
      });
    });
    document.getElementById("codex-back").addEventListener("click", () => {
      AudioSys.play("click");
      this.show("menu");
    });

    // ===== 设置 =====
    const vol = document.getElementById("set-volume");
    const volVal = document.getElementById("set-volume-val");
    vol.addEventListener("input", () => {
      const v = Number(vol.value) / 100;
      volVal.textContent = Math.round(v * 100) + "%";
      game.settings.volume = v;
      AudioSys.setVolume(v);
      this.saveSettings();
    });
    const toggle = (id, key) => {
      const el = document.getElementById(id);
      el.addEventListener("click", () => {
        game.settings[key] = !game.settings[key];
        el.dataset.on = game.settings[key] ? "true" : "false";
        el.textContent = game.settings[key] ? "开" : "关";
        if (key === "sfx") {
          AudioSys.enabled = game.settings.sfx;
          if (game.settings.sfx) AudioSys.startMusic();
          else AudioSys.stopMusic();
        }
        AudioSys.play("click");
        this.saveSettings();
      });
    };
    toggle("set-sfx", "sfx");
    toggle("set-shake", "shake");
    toggle("set-dmg", "dmgNums");
    document.querySelectorAll("#set-diff .seg button, #set-diff button").forEach(btn => {
      btn.addEventListener("click", () => {
        AudioSys.play("click");
        document.querySelectorAll("#set-diff button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        game.settings.difficulty = btn.dataset.v;
        this.saveSettings();
      });
    });
    document.getElementById("set-reset-codex").addEventListener("click", () => {
      AudioSys.play("click");
      CodexStore.reset();
      this.toast("图鉴进度已重置");
    });
    document.getElementById("set-back").addEventListener("click", () => {
      AudioSys.play("click");
      this.show("menu");
    });

    // ===== 开发者模式 =====
    const devToggle = (id, key) => {
      const el = document.getElementById(id);
      el.addEventListener("click", () => {
        AudioSys.play("click");
        game.dev[key] = !game.dev[key];
        el.dataset.on = game.dev[key] ? "true" : "false";
        el.textContent = game.dev[key] ? "开" : "关";
        if (key === "allWeapons" && game.dev.allWeapons) game.grantAllWeapons();
        this.saveDev();
      });
    };
    devToggle("dev-invincible", "invincible");
    devToggle("dev-ammo", "infiniteAmmo");
    devToggle("dev-weapons", "allWeapons");
    devToggle("dev-speed", "speedX2");
    document.getElementById("dev-skip").addEventListener("click", () => {
      AudioSys.play("click");
      if (game.state === "run" || game.state === "pause") {
        const fromPause = game.state === "pause";
        game.devSkipLevel();
        this.toast("已通关当前关卡，走到出口门进入下一关");
        // 从暂停菜单跳关：直接回到游戏画面，立刻看到出口箭头
        if (fromPause) game.resume();
      } else {
        this.toast("请先开始游戏再使用跳关");
      }
    });
    document.getElementById("dev-back").addEventListener("click", () => {
      AudioSys.play("click");
      if (this.devReturn === "pause") this.show("pause");
      else this.show("menu");
    });

    // ===== 暂停 / 结算 / 胜利 =====
    document.querySelectorAll("#scene-pause .menu-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        AudioSys.play("click");
        const act = btn.dataset.action;
        if (act === "resume") game.resume();
        else if (act === "restart") game.startRun();
        else if (act === "dev") { this.devReturn = "pause"; this.show("dev"); this.renderDev(); }
        else if (act === "quit") game.toMenu();
      });
    });
    document.querySelectorAll("#scene-gameover .menu-btn, #scene-victory .menu-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        AudioSys.play("click");
        const act = btn.dataset.action;
        if (act === "retry") game.startRun();
        else if (act === "quit") game.toMenu();
      });
    });

    this.loadSettings();
    this.loadDev();
  },

  /* ---------- 开发者模式存取 ---------- */
  loadDev() {
    const def = { invincible: false, infiniteAmmo: false, allWeapons: false, speedX2: false };
    let d = def;
    try {
      const raw = localStorage.getItem("asr_dev_v1");
      if (raw) d = Object.assign({}, def, JSON.parse(raw));
    } catch (e) {}
    this.game.dev = d;
    this.renderDev();
  },

  saveDev() {
    try { localStorage.setItem("asr_dev_v1", JSON.stringify(this.game.dev)); } catch (e) {}
  },

  renderDev() {
    const d = this.game.dev;
    if (!d) return;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.dataset.on = v ? "true" : "false";
      el.textContent = v ? "开" : "关";
    };
    set("dev-invincible", d.invincible);
    set("dev-ammo", d.infiniteAmmo);
    set("dev-weapons", d.allWeapons);
    set("dev-speed", d.speedX2);
  },

  /* ---------- 设置存取 ---------- */
  loadSettings() {
    let s = { volume: 0.7, sfx: true, difficulty: "normal", shake: true, dmgNums: true };
    try {
      const raw = localStorage.getItem("asr_settings_v1");
      if (raw) s = Object.assign(s, JSON.parse(raw));
    } catch (e) {}
    const g = this.game;
    g.settings = s;
    AudioSys.setVolume(s.volume);
    AudioSys.enabled = s.sfx;
    document.getElementById("set-volume").value = Math.round(s.volume * 100);
    document.getElementById("set-volume-val").textContent = Math.round(s.volume * 100) + "%";
    const sfx = document.getElementById("set-sfx");
    sfx.dataset.on = s.sfx ? "true" : "false"; sfx.textContent = s.sfx ? "开" : "关";
    const shake = document.getElementById("set-shake");
    shake.dataset.on = s.shake ? "true" : "false"; shake.textContent = s.shake ? "开" : "关";
    const dmg = document.getElementById("set-dmg");
    dmg.dataset.on = s.dmgNums ? "true" : "false"; dmg.textContent = s.dmgNums ? "开" : "关";
    document.querySelectorAll("#set-diff button").forEach(b => b.classList.toggle("active", b.dataset.v === s.difficulty));
  },

  saveSettings() {
    try { localStorage.setItem("asr_settings_v1", JSON.stringify(this.game.settings)); } catch (e) {}
  },

  /* ---------- 场景切换 ---------- */
  show(name, withIntro) {
    const ids = ["menu", "story", "codex", "settings", "pause", "gameover", "victory", "dev"];
    for (const id of ids) {
      document.getElementById("scene-" + id).classList.toggle("hidden", id !== name);
    }
    // 主菜单场景时显示环境背景，其余（游戏内）不遮挡画布的游戏画面
    if (name === "menu") {
      this.game.mode = "menu";
      this.updateMenuBest();
      if (withIntro) this.playIntro();
    } else if (name === "story") this.game.mode = "story";
    else if (["codex", "settings"].includes(name)) this.game.mode = "menu";
  },

  /* ---------- 魂斗罗风格入场动画 ---------- */
  _introDone: null,
  _introTimer: null,
  _introSkip: null,

  playIntro() {
    const el = document.getElementById("intro");
    if (!el) return;
    const wrap = document.querySelector ? document.querySelector(".menu-wrap") : null;
    if (wrap) wrap.classList.remove("ready");
    // 重播放（display:none → flex 会重触发 CSS 动画）
    el.classList.remove("hidden", "out");
    const finish = () => {
      if (this._introDone) { const d = this._introDone; this._introDone = null; d(); }
    };
    this._introDone = () => {
      window.removeEventListener("pointerdown", this._introSkip);
      window.removeEventListener("keydown", this._introSkip);
      el.classList.add("out");
      setTimeout(() => {
        el.classList.add("hidden");
        if (wrap) wrap.classList.add("ready");
      }, 550);
    };
    clearTimeout(this._introTimer);
    this._introTimer = setTimeout(finish, 3600);
    this._introSkip = finish;
    window.addEventListener("pointerdown", this._introSkip);
    window.addEventListener("keydown", this._introSkip);
  },

  _skipIntro() {
    clearTimeout(this._introTimer);
    if (this._introDone) { const d = this._introDone; this._introDone = null; d(); }
    window.removeEventListener("pointerdown", this._introSkip);
    window.removeEventListener("keydown", this._introSkip);
  },

  /* 主菜单最佳战绩 */
  updateMenuBest() {
    const el = document.getElementById("menu-best");
    if (!el) return;
    const b = CodexStore.load().best;
    const lv = b.level || b.wave || 0;
    el.innerHTML = lv > 0
      ? `最佳战绩：第 ${lv} 关 · 得分 ${b.score} · 击杀 ${b.kills}`
      : "尚无战绩记录——开始你的第一战吧";
  },

  /* ---------- 剧情 ---------- */
  showStory() {
    this.storyIdx = 0;
    this.show("story");
    this.renderStorySlide();
    this.game.mode = "story";
  },

  stopStoryTyping() {
    if (this.storyTypeTimer) {
      clearInterval(this.storyTypeTimer);
      this.storyTypeTimer = null;
    }
  },

  renderStorySlide() {
    this.stopStoryTyping();
    const s = STORY_SLIDES[this.storyIdx];
    const el = document.getElementById("story-slide");
    const title = `<div class="slide-title">${s.title}</div>`;
    this.storyFull = s.body.map(p => `<p>${p}</p>`).join("");
    this.storyCharIdx = 0;
    el.innerHTML = title + `<div class="slide-body"></div>`;

    // 打字机动画（逐字显示正文）
    const bodyEl = el.querySelector ? el.querySelector(".slide-body") : null;
    if (!bodyEl) {
      el.innerHTML = title + `<div class="slide-body">${this.storyFull}</div>`;
    } else {
      this.storyTypeTimer = setInterval(() => {
        this.storyCharIdx = Math.min(this.storyFull.length, this.storyCharIdx + 2);
        bodyEl.innerHTML = this.storyFull.slice(0, this.storyCharIdx)
          + (this.storyCharIdx < this.storyFull.length ? '<span class="caret">▌</span>' : "");
        if (this.storyCharIdx >= this.storyFull.length) this.stopStoryTyping();
      }, 22);
    }

    document.getElementById("story-progress").textContent = `${this.storyIdx + 1} / ${STORY_SLIDES.length}`;
    const next = document.getElementById("story-next");
    next.textContent = this.storyIdx >= STORY_SLIDES.length - 1 ? "开始行动 ▶" : "下一页 ▶";
  },

  nextStorySlide() {
    // 正文还在打字：点击直接显示全文
    if (this.storyTypeTimer) {
      this.stopStoryTyping();
      const bodyEl = document.getElementById("story-slide").querySelector
        ? document.getElementById("story-slide").querySelector(".slide-body") : null;
      if (bodyEl) bodyEl.innerHTML = this.storyFull;
      return;
    }
    if (this.storyIdx < STORY_SLIDES.length - 1) {
      this.storyIdx++;
      this.renderStorySlide();
    } else {
      this.game.startRun();
    }
  },

  /* ---------- 图鉴 ---------- */
  renderCodex(tab) {
    const box = document.getElementById("codex-content");
    const data = CodexStore.load();
    let html = "";

    if (tab === "enemy") {
      html = '<div class="cx-grid">';
      for (const e of CODEX.enemies) {
        const unlocked = data.kills[e.id] > 0;
        const kills = data.kills[e.id] || 0;
        html += `<div class="cx-card${unlocked ? "" : " locked"}">
          <div class="cx-name">${unlocked ? e.name : "？？？"}</div>
          <div class="cx-sub">${unlocked ? "已遭遇" : "尚未遭遇 · 击败后解锁"}</div>
          <div class="cx-desc">${unlocked ? e.desc : "该异形个体尚未被记录。只有活着回来的人，才能把它写进图鉴。"}</div>
          <div class="cx-stats">${unlocked ? e.stats.map(s => `<span>${s}</span>`).join("") : ""}</div>
          <div class="cx-meta">${unlocked ? `击杀数：${kills}` : ""}</div>
        </div>`;
      }
      html += "</div>";
    } else if (tab === "weapon") {
      // 武器需从地图武器箱获得（双枪初始自带）
      html = '<div class="cx-grid">';
      for (const w of CODEX.weapons) {
        const unlocked = w.id === "pistol" || data.weapons[w.id];
        html += `<div class="cx-card${unlocked ? "" : " locked"}">
          <div class="cx-name">${unlocked ? w.name : "？？？"}</div>
          <div class="cx-sub">${unlocked ? (w.id === "pistol" ? "初始装备" : "已通过武器箱获得") : "尚未获得 · 从地图武器箱中获取"}</div>
          <div class="cx-desc">${unlocked ? w.desc : "这件武器还没有被记录。在战斗中打开地图上的武器箱，才能解锁图鉴条目。"}</div>
          <div class="cx-stats">${unlocked ? w.stats.map(s => `<span>${s}</span>`).join("") : ""}</div>
        </div>`;
      }
      html += "</div>";
    } else if (tab === "level") {
      html = "";
      CFG.LEVELS.forEach((lv, i) => {
        const def = CFG.LEVELS[i];
        const list = def.enemies.map(([t]) => CFG.ENEMIES[t].name).join("、");
        html += `<div class="lore-block">
          <div class="lore-title">第 ${i + 1} 关 · ${lv.name}${def.boss ? "　☠ 首领：" + CFG.ENEMIES[def.boss].name : ""}</div>
          <div class="lore-text">${lv.desc}</div>
          <div class="cx-meta" style="margin-top:6px;font-size:12.5px;color:#8fd3ff;">目标：击杀 ${lv.count} 只 · 出没类型：${list}</div>
        </div>`;
      });
    } else if (tab === "lore") {
      for (const l of CODEX.lore) {
        html += `<div class="lore-block"><div class="lore-title">${l.title}</div><div class="lore-text">${l.text}</div></div>`;
      }
    }
    box.innerHTML = html;
  },

  /* ---------- 设置 ---------- */
  renderSettings() {
    // 由 loadSettings 处理；这里确保难度高亮正确
    const s = this.game.settings;
    document.querySelectorAll("#set-diff button").forEach(b => b.classList.toggle("active", b.dataset.v === s.difficulty));
  },

  /* ---------- 结算 ---------- */
  showGameover(stats) {
    document.getElementById("over-stats").innerHTML = this.statHtml(stats, false);
    this.show("gameover");
    AudioSys.play("gameover");
  },

  showVictory(stats) {
    document.getElementById("victory-stats").innerHTML = this.statHtml(stats, true);
    this.show("victory");
  },

  statHtml(s, isVictory) {
    const best = CodexStore.load().best;
    const bestLv = best.level || best.wave || 0;
    let html = `
      <div class="st">抵达关卡<b>${s.level} / ${s.total}</b></div>
      <div class="st">击杀异形<b>${s.kills}</b></div>
      <div class="st">最终得分<b>${s.score}</b></div>
      <div class="st">通关用时<b>${s.time}</b></div>
      <div class="st">历史最佳关卡<b>${bestLv}</b></div>`;
    if (isVictory) {
      // 评级：按剩余生命
      let grade = "C", gcol = "#ff8a7d", gtxt = "勉强存活——蜂巢记住了你";
      if (s.hpPct >= 0.7) { grade = "S"; gcol = "#ffe08a"; gtxt = "近乎无损的完美行动！"; }
      else if (s.hpPct >= 0.4) { grade = "A"; gcol = "#8fd3ff"; gtxt = "干净利落，堪称老兵。"; }
      else if (s.hpPct >= 0.1) { grade = "B"; gcol = "#6fdc6f"; gtxt = "伤痕累累，但任务完成了。"; }
      html += `<div class="st" style="grid-column:1/-1;text-align:center;">作战评级<b style="color:${gcol};font-size:34px;">${grade}</b><span style="display:block;font-size:13px;color:#9fb4cc;">${gtxt}</span></div>`;
    }
    return html;
  },

  /* ---------- Toast ---------- */
  toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
  },
};
