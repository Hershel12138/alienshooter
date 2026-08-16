/* ============ 实体：玩家 / 子弹 / 敌人 / 拾取物 / 粒子 ============ */
"use strict";

/* ==================== 玩家 ==================== */
class Player {
  constructor(g) {
    const P = CFG.PLAYER;
    this.x = CFG.ARENA.w / 2;
    this.y = CFG.ARENA.h / 2;
    this.vx = 0; this.vy = 0;
    this.angle = 0;
    this.radius = P.radius;
    this.hp = P.hp;
    this.maxHp = P.hp;

    // 初始只有双枪，其余武器需从地图武器箱获取
    this.weapons = ["pistol"];
    this.curW = "pistol";
    this.ammo = { pistol: Infinity };
    this.lastFire = -99;
    this.recoilT = 0;

    this.invulnT = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashDirX = 1; this.dashDirY = 0;
    this.grenadeCd = 0;
    this.dead = false;
    this.moving = false;
    this.bobT = 0;
  }

  get ammoMax() {
    const m = CFG.WEAPONS[this.curW].ammo;
    return m === Infinity ? Infinity : m;
  }

  update(dt, g) {
    if (this.dead) return;
    this.invulnT -= dt;
    this.dashCd -= dt;
    this.grenadeCd -= dt;
    this.recoilT = Math.max(0, this.recoilT - dt * 8);

    // 移动
    let mx = 0, my = 0;
    if (Input.down("KeyW") || Input.down("ArrowUp")) my -= 1;
    if (Input.down("KeyS") || Input.down("ArrowDown")) my += 1;
    if (Input.down("KeyA") || Input.down("ArrowLeft")) mx -= 1;
    if (Input.down("KeyD") || Input.down("ArrowRight")) mx += 1;
    this.moving = (mx !== 0 || my !== 0);
    // 行走动画相位：只在移动时前进（待机完全静止）
    if (this.moving) this.bobT += dt * 10;
    if (this.moving) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
      this.dashDirX = mx; this.dashDirY = my;
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDirX * CFG.PLAYER.dashSpeed * (g.dev && g.dev.speedX2 ? 1.5 : 1);
      this.vy = this.dashDirY * CFG.PLAYER.dashSpeed * (g.dev && g.dev.speedX2 ? 1.5 : 1);
      if (Math.random() < 0.7) {
        g.particles.push(new Particle(this.x + rand(-6, 6), this.y + rand(-6, 6), 0, 0, 0.25, 10, "rgba(120,220,255,0.35)", "dot", 0));
      }
    } else {
      const spd = CFG.PLAYER.speed * (g.dev && g.dev.speedX2 ? 2 : 1);
      this.vx = mx * spd;
      this.vy = my * spd;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 边界
    const w = CFG.WALL + this.radius;
    this.x = clamp(this.x, w, CFG.ARENA.w - w);
    this.y = clamp(this.y, w, CFG.ARENA.h - w);
    // 障碍物
    const res = MapSys.resolveCircle(this.x, this.y, this.radius);
    if (res) { this.x += res.x; this.y += res.y; }

    // 瞄准
    this.angle = angleTo(this.x, this.y, g.mouseWorld.x, g.mouseWorld.y);

    // 自然恢复（简单难度）
    if (g.diff.playerRegen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + g.diff.playerRegen * dt);
    }

    // 武器切换
    if (Input.wheel !== 0) {
      const idx = this.weapons.indexOf(this.curW);
      const n = this.weapons.length;
      this.curW = this.weapons[((idx + Input.wheel) % n + n) % n];
      AudioSys.play("click");
    }
    for (let i = 0; i < 7; i++) {
      if (Input.wasPressed("Digit" + (i + 1)) && this.weapons[i]) {
        this.curW = this.weapons[i];
        AudioSys.play("click");
      }
    }

    // 开发者：无限弹药（每帧补满，UI 始终显示满）
    if (g.dev && g.dev.infiniteAmmo) {
      for (const wid of this.weapons) {
        const m = CFG.WEAPONS[wid].ammo;
        this.ammo[wid] = m === Infinity ? Infinity : m;
      }
    }

    // 射击
    this.tryShoot(g);

    // 手雷
    if (Input.mouse.rdown && this.grenadeCd <= 0) {
      this.grenadeCd = CFG.PLAYER.grenadeCd;
      g.grenades.push(new Grenade(this.x, this.y, g.mouseWorld.x, g.mouseWorld.y));
      AudioSys.play("click");
    }

    // 冲刺
    if (Input.wasPressed("Space") && this.dashCd <= 0) {
      this.dashT = CFG.PLAYER.dashTime;
      this.dashCd = CFG.PLAYER.dashCd;
      if (!this.moving) { this.dashDirX = Math.cos(this.angle); this.dashDirY = Math.sin(this.angle); }
    }
  }

  tryShoot(g) {
    if (!Input.mouse.down || this.dead) return;
    const def = CFG.WEAPONS[this.curW];
    const rate = def.rate;
    if (g.time - this.lastFire < 1 / rate) return;
    if (this.ammo[this.curW] <= 0) {
      // 弹药耗尽：自动切换到有弹药的武器
      const fallback = this.weapons.find(w => w !== this.curW && this.ammo[w] > 0) || "pistol";
      if (fallback !== this.curW) {
        this.curW = fallback;
        if (g.time - this.lastFire > 0.6) {
          g.addText(this.x, this.y - 32, "弹药耗尽 → " + CFG.WEAPONS[fallback].name, "#ff9e7d", 13);
          AudioSys.play("click");
        }
      }
      return;
    }

    this.lastFire = g.time;
    if (this.ammo[this.curW] !== Infinity) this.ammo[this.curW]--;

    const muzzle = this.radius + 12 + this.recoilT * 6;
    this.recoilT = def.recoil;
    // 高射速武器（加特林/冲锋枪/火焰喷射器）震动大幅衰减，避免屏幕狂抖
    const shakeMul = def.rate > 9 ? 0.3 : 1;
    g.addShake(def.recoil * 1.6 * shakeMul);

    if (def.dual) {
      // 双枪：左右手各开一枪，枪口在身体两侧
      for (const side of [-1, 1]) {
        const handX = this.x + Math.cos(this.angle) * 7 - Math.sin(this.angle) * 7 * side;
        const handY = this.y + Math.sin(this.angle) * 7 + Math.cos(this.angle) * 7 * side;
        const mxx = this.x + Math.cos(this.angle) * (this.radius + 14) - Math.sin(this.angle) * 7 * side;
        const myy = this.y + Math.sin(this.angle) * (this.radius + 14) + Math.cos(this.angle) * 7 * side;
        const a = this.angle + side * 0.035;
        g.bullets.push(new Bullet(handX, handY, a, def.dmg, {
          speed: def.speed, pierce: def.pierce, r: 3.5, color: def.color, aoe: 0, dot: 0, dotTime: 0, life: 1.05,
        }, g));
        g.particles.push(new Particle(mxx, myy, Math.cos(a) * 70, Math.sin(a) * 70, 0.07, 8, def.color, "dot", 0));
      }
      return;
    }

    const pellets = def.pellets;
    for (let i = 0; i < pellets; i++) {
      const t = pellets === 1 ? 0 : (i / (pellets - 1) - 0.5);
      const a = this.angle + def.spread * rand(-1, 1) + t * 0.06;
      const life = def.range ? def.range / def.speed : 1.1;
      const sx = this.x + Math.cos(this.angle) * 4;
      const sy = this.y + Math.sin(this.angle) * 4;
      g.bullets.push(new Bullet(
        sx, sy, a, def.dmg, {
          speed: def.speed, pierce: def.pierce, r: def.aoe ? 6 : 4,
          color: def.color, aoe: def.aoe || 0, dot: def.dot, dotTime: def.dotTime, life,
        }, g
      ));
    }

    const mxx = this.x + Math.cos(this.angle) * muzzle;
    const myy = this.y + Math.sin(this.angle) * muzzle;
    const flash = new Particle(mxx, myy, Math.cos(this.angle) * 60, Math.sin(this.angle) * 60, 0.08, 10, def.color, "dot", 0);
    g.particles.push(flash);
    AudioSys.play(def.sound);
  }

  takeDamage(d, g, srcX, srcY) {
    if (g.dev && g.dev.invincible) return;
    if (this.invulnT > 0 || this.dashT > 0 || this.dead) return;
    this.hp -= d;
    this.invulnT = CFG.PLAYER.invulnTime;
    const a = angleTo(srcX, srcY, this.x, this.y);
    this.x += Math.cos(a) * 16;
    this.y += Math.sin(a) * 16;
    g.addShake(8);
    g.addText(this.x, this.y - 24, "-" + d, "#ff5a4d", 15);
    AudioSys.play("hurt");
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      g.onPlayerDeath();
    }
  }

  heal(v) {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + v);
  }

  /* 从武器箱获得新武器（满弹药 + 图鉴记录） */
  addWeapon(id, g) {
    if (this.weapons.includes(id)) return;
    this.weapons.push(id);
    const max = CFG.WEAPONS[id].ammo;
    this.ammo[id] = max === Infinity ? Infinity : max;
    CodexStore.onWeapon(id);
    void g;
  }
}

/* ==================== 子弹 ==================== */
let _enemyId = 1;

class Bullet {
  constructor(x, y, angle, dmg, opts, g) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * opts.speed;
    this.vy = Math.sin(angle) * opts.speed;
    this.dmg = dmg;
    this.pierce = opts.pierce || 0;
    this.r = opts.r || 4;
    this.color = opts.color || "#ffd166";
    this.aoe = opts.aoe || 0;
    this.dot = opts.dot || 0;
    this.dotTime = opts.dotTime || 0;
    this.life = opts.life || 1.1;
    this.dead = false;
    this.hitCd = {};   // 敌人 id -> 最近命中时间（防穿透重复命中）
  }

  update(dt, g) {
    // 子步进移动，避免高速子弹穿透敌人
    const speed = Math.hypot(this.vx, this.vy);
    const total = speed * dt;
    const steps = Math.max(1, Math.ceil(total / 8));
    const sx = (this.vx * dt) / steps;
    const sy = (this.vy * dt) / steps;
    const sdt = dt / steps;

    for (let s = 0; s < steps; s++) {
      this.x += sx;
      this.y += sy;
      this.life -= sdt;
      if (this.life <= 0) { this.dead = true; return; }

      // 边界
      if (this.x < CFG.WALL || this.x > CFG.ARENA.w - CFG.WALL || this.y < CFG.WALL || this.y > CFG.ARENA.h - CFG.WALL) {
        this.dead = true;
        g.particles.push(new Particle(this.x, this.y, 0, 0, 0.12, 3, "#cfe0ff", "dot", 0));
        return;
      }
      // 障碍物
      const hit = MapSys.hitObstacle(this.x, this.y, this.r);
      if (hit) {
        if ((hit.kind === "barrel" || hit.kind2 === "barrel") && !hit.dead) {
          hit.hp -= this.dmg;
          if (hit.hp <= 0) {
            hit.dead = true;
            worldExplosion(g, hit.x + hit.w / 2, hit.y + hit.h / 2, 70, 120, "player", "#ff8c42");
            AudioSys.play("explosion");
            g.addShake(10);
          }
        }
        if (this.aoe > 0) worldExplosion(g, this.x, this.y, this.dmg * 0.9, this.aoe, "player", this.color);
        this.dead = true;
        return;
      }
      // 敌人
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (dist2(this.x, this.y, e.x, e.y) < (e.r + this.r) * (e.r + this.r)) {
          if (g.time - (this.hitCd[e.id] || -99) < 0.05) continue;
          this.hitCd[e.id] = g.time;
          e.takeDamage(this.dmg, g, this.x, this.y, 90);
          if (this.dot > 0) e.applyDot(this.dot, this.dotTime, g);
          if (this.aoe > 0) worldExplosion(g, this.x, this.y, this.dmg * 0.9, this.aoe, "player", this.color);
          if (this.pierce > 0) this.pierce--;
          else { this.dead = true; return; }
          break;
        }
      }
    }
  }
}

/* ==================== 敌方子弹 ==================== */
class EnemyBullet {
  constructor(x, y, angle, speed, dmg, r, color, g) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.dmg = dmg;
    this.r = r;
    this.color = color;
    this.life = 4;
    this.dead = false;
  }

  update(dt, g) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < 0 || this.x > CFG.ARENA.w || this.y < 0 || this.y > CFG.ARENA.h) { this.dead = true; return; }
    const o = MapSys.hitObstacle(this.x, this.y, this.r);
    if (o) { this.dead = true; return; }
    const p = g.player;
    if (!p.dead && dist2(this.x, this.y, p.x, p.y) < (p.radius + this.r) * (p.radius + this.r)) {
      p.takeDamage(this.dmg, g, this.x, this.y);
      this.dead = true;
    }
  }
}

/* ==================== 手雷 ==================== */
class Grenade {
  constructor(x, y, tx, ty) {
    this.x = x; this.y = y;
    this.tx = tx; this.ty = ty;
    this.t = 0;
    this.dead = false;
  }
  update(dt, g) {
    this.t += dt;
    const a = angleTo(this.x, this.y, this.tx, this.ty);
    const spd = 760;
    this.x += Math.cos(a) * spd * dt;
    this.y += Math.sin(a) * spd * dt;
    if (dist2(this.x, this.y, this.tx, this.ty) < 30 * 30 || this.t > 1.0) {
      this.dead = true;
      worldExplosion(g, this.x, this.y, CFG.PLAYER.grenadeDmg, CFG.PLAYER.grenadeRadius, "player", "#ffb84d");
      AudioSys.play("grenade");
    }
  }
}

/* ==================== 敌人 ==================== */
/* 机械异形形态参数（大小/体态各异 + 装备：launcher 背部发射器 / bomb 自爆雷 / armor 装甲等级 / visor 护目眼色） */
const DINO = {
  drone:   { belly: "#8a7266", bodyW: 0.85, legL: 1.0,  neck: 0.9,  head: 0.8,  spikes: 0, crest: 0, launcher: 0, bomb: 0, armor: 0, visor: "#ffb84d" },
  runner:  { belly: "#d0a6b2", bodyW: 0.7,  legL: 1.4,  neck: 1.05, head: 0.7,  spikes: 0, crest: 0, launcher: 0, bomb: 0, armor: 0, visor: "#ff5a4d" },
  spitter: { belly: "#b0e84d", bodyW: 1.0,  legL: 0.9,  neck: 1.25, head: 0.95, spikes: 0, crest: 1, launcher: 1, bomb: 0, armor: 1, visor: "#a3e635" },
  boomer:  { belly: "#ffe3a3", bodyW: 1.55, legL: 0.7,  neck: 0.6,  head: 0.85, spikes: 0, crest: 0, launcher: 0, bomb: 1, armor: 0, visor: "#ff3b30" },
  elite:   { belly: "#f7a1d2", bodyW: 0.95, legL: 1.2,  neck: 1.05, head: 0.9,  spikes: 1, crest: 0, launcher: 0, bomb: 0, armor: 2, visor: "#ffd166" },
  brute:   { belly: "#c58af0", bodyW: 1.75, legL: 0.75, neck: 0.7,  head: 1.3,  spikes: 1, crest: 0, launcher: 0, bomb: 0, armor: 3, visor: "#ff8c42" },
  warden:  { belly: "#e08ac4", bodyW: 2.1,  legL: 0.95, neck: 1.1,  head: 1.6,  spikes: 1, crest: 1, launcher: 0, bomb: 0, armor: 3, visor: "#ff8ad4" },
  boss:    { belly: "#ff8fa3", bodyW: 2.5,  legL: 1.05, neck: 1.3,  head: 2.0,  spikes: 1, crest: 1, launcher: 0, bomb: 0, armor: 4, visor: "#ff477e" },
};

/* 通用机械异形绘制（双足：两段液压腿 + 装甲板 + 发光护目眼；
   远程单位背部装发射器，自爆单位肚皮绑炸弹） */
function drawDino(ctx, d) {
  const R = d.r;
  const phase = d.moving ? d.t * 9 : d.t * 1.6;
  const bob = d.moving ? Math.abs(Math.sin(phase)) * R * 0.13 : Math.sin(d.t * 3) * R * 0.05;
  const color = d.flash ? "#ffffff" : d.color;
  const dark = d.flash ? "#ffffff" : shadeColor(d.color, -0.35);
  const legLen = R * (d.legL || 1) * 1.15;
  const armor = d.armor || 0;
  const visor = d.flash ? "#ffffff" : (d.visor || "#ffd166");

  ctx.save();
  ctx.translate(d.x, d.y);

  // ---- 双腿（两段式液压机械腿，步幅沿朝向）----
  const hipLX = -R * 0.12, hipLY = -R * 0.95 + bob * 0.7;
  const cosD = Math.cos(d.dir), sinD = Math.sin(d.dir);
  const hipWX = hipLX * cosD - hipLY * sinD;
  const hipWY = hipLX * sinD + hipLY * cosD;
  ctx.lineCap = "round";
  for (const [sw, sgn] of [[(d.moving ? Math.sin(phase) : 0), 1], [(d.moving ? Math.sin(phase + Math.PI) : 0), -1]]) {
    const strideX = cosD * sw * legLen * 0.85;
    const strideY = sinD * sw * legLen * 0.85;
    // 大腿
    const kneeX = hipWX + strideX * 0.5 + cosD * R * 0.14;
    const kneeY = hipWY + legLen * 0.46;
    ctx.strokeStyle = dark;
    ctx.lineWidth = R * 0.42;
    ctx.beginPath();
    ctx.moveTo(hipWX, hipWY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();
    // 小腿
    const footX = hipWX + strideX;
    const footY = hipWY + legLen * 0.92;
    ctx.strokeStyle = color;
    ctx.lineWidth = R * 0.34;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    // 膝关节（发光关节）
    ctx.fillStyle = d.flash ? "#fff" : "#ffd166";
    ctx.beginPath(); ctx.arc(kneeX, kneeY, R * 0.16, 0, TAU); ctx.fill();
    // 机械脚掌（梯形爪 + 爪尖）
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(footX, footY);
    ctx.rotate(d.dir + Math.PI / 2 * sgn);
    ctx.beginPath();
    ctx.moveTo(-R * 0.3, 0); ctx.lineTo(R * 0.3, 0);
    ctx.lineTo(R * 0.22, R * 0.16); ctx.lineTo(-R * 0.22, R * 0.16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = d.flash ? "#fff" : "#e8e4da";
    ctx.beginPath();
    ctx.moveTo(R * 0.22, R * 0.14); ctx.lineTo(R * 0.34, R * 0.28); ctx.lineTo(R * 0.12, R * 0.17);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---- 身体（前倾，绕朝向旋转）----
  const bodyW = R * (d.bodyW || 1) * 1.5;
  const bodyH = R * 1.5;
  ctx.save();
  ctx.rotate(d.dir);
  ctx.translate(0, -bodyH * 0.42 + bob * 0.7);
  ctx.rotate(0.12);

  // 尾部（分节机械尾）
  ctx.strokeStyle = dark;
  ctx.lineWidth = R * 0.3;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.7, -bodyH * 0.34);
  ctx.quadraticCurveTo(-bodyW * 1.35, -bodyH * 0.78, -bodyW * 1.75, -bodyH * 0.42 + Math.sin(d.t * 3 + 1) * R * 0.14);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = R * 0.2;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.9, -bodyH * 0.42);
  ctx.quadraticCurveTo(-bodyW * 1.35, -bodyH * 0.7, -bodyW * 1.65, -bodyH * 0.45);
  ctx.stroke();
  // 尾尖（刀锋）
  ctx.fillStyle = d.flash ? "#fff" : "#e8e4da";
  ctx.save();
  ctx.translate(-bodyW * 1.75, -bodyH * 0.42);
  ctx.rotate(0.5);
  ctx.beginPath(); ctx.moveTo(-R * 0.28, 0); ctx.lineTo(R * 0.1, -R * 0.16); ctx.lineTo(R * 0.12, R * 0.14); ctx.closePath(); ctx.fill();
  ctx.restore();

  // 身体基座
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyW, bodyH * 0.5, 0, 0, TAU);
  ctx.fill();
  // 底部暗影
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, bodyH * 0.14, bodyW * 0.85, bodyH * 0.3, 0, 0, TAU);
  ctx.fill();
  if (!d.flash) {
    // 肚皮装甲板
    ctx.fillStyle = d.belly;
    ctx.beginPath();
    ctx.ellipse(0, bodyH * 0.16, bodyW * 0.58, bodyH * 0.22, 0, 0, TAU);
    ctx.fill();
    // 背甲盖板
    if (armor >= 1) {
      ctx.fillStyle = shadeColor(color, 0.28);
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.8, -bodyH * 0.18);
      ctx.quadraticCurveTo(0, -bodyH * 0.52, bodyW * 0.8, -bodyH * 0.14);
      ctx.quadraticCurveTo(0, -bodyH * 0.28, -bodyW * 0.8, -bodyH * 0.18);
      ctx.closePath(); ctx.fill();
    }
    // 装甲加强肋（重装）
    if (armor >= 2) {
      ctx.fillStyle = shadeColor(color, -0.12);
      for (let i = 0; i < 3; i++) {
        const rx = -bodyW * 0.62 + i * bodyW * 0.62;
        ctx.fillRect(rx - R * 0.07, -bodyH * 0.32, R * 0.14, bodyH * 0.5);
      }
    }
    // 面板线
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.55, -bodyH * 0.12);
    ctx.lineTo(bodyW * 0.55, -bodyH * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.6, bodyH * 0.02);
    ctx.lineTo(bodyW * 0.6, bodyH * 0.06);
    ctx.stroke();
    // 铆钉
    ctx.fillStyle = "rgba(30,30,35,0.6)";
    for (let i = 0; i < 5; i++) {
      const rx = -bodyW * 0.7 + i * bodyW * 0.35;
      ctx.beginPath(); ctx.arc(rx, -bodyH * 0.24, R * 0.05, 0, TAU); ctx.fill();
    }
    // 背部能量纹路（发光）
    ctx.strokeStyle = visor;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.5, -bodyH * 0.34);
    ctx.quadraticCurveTo(0, -bodyH * 0.52, bodyW * 0.5, -bodyH * 0.3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 背棘（金属刀刃）
  if (d.spikes && !d.flash) {
    ctx.fillStyle = shadeColor(color, 0.35);
    for (let i = 0; i < 4; i++) {
      const sx = -bodyW * 0.55 + i * bodyW * 0.36;
      const sy = -bodyH * 0.78;
      ctx.beginPath();
      ctx.moveTo(sx - R * 0.12, sy);
      ctx.lineTo(sx + R * 0.04, sy - R * 0.38);
      ctx.lineTo(sx + R * 0.2, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 背部发射器（远程单位：酸液喷射者）
  if (d.launcher && !d.flash) {
    ctx.save();
    ctx.translate(-bodyW * 0.28, -bodyH * 0.78);
    ctx.rotate(-1.05);
    // 发射筒
    ctx.fillStyle = "#5a6472";
    ctx.fillRect(-R * 0.16, -R * 0.62, R * 0.32, R * 1.24);
    // 高光
    ctx.fillStyle = "rgba(200,220,240,0.35)";
    ctx.fillRect(-R * 0.1, -R * 0.62, R * 0.09, R * 1.24);
    // 尾部推进舱
    ctx.fillStyle = "#39424e";
    ctx.fillRect(-R * 0.2, -R * 0.72, R * 0.4, R * 0.22);
    // 稳定鳍
    ctx.fillStyle = "#454f5d";
    ctx.beginPath();
    ctx.moveTo(R * 0.16, -R * 0.55); ctx.lineTo(R * 0.42, -R * 0.62); ctx.lineTo(R * 0.16, -R * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-R * 0.16, -R * 0.55); ctx.lineTo(-R * 0.42, -R * 0.62); ctx.lineTo(-R * 0.16, -R * 0.3);
    ctx.closePath(); ctx.fill();
    // 发射口发光（蓄能脉冲）
    const lp = 0.6 + 0.4 * Math.sin(d.t * 8);
    ctx.fillStyle = `rgba(163,230,53,${0.5 + lp * 0.5})`;
    ctx.beginPath(); ctx.arc(0, R * 0.62, R * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath(); ctx.arc(0, R * 0.62, R * 0.06, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // 自爆雷（自爆者：肚皮炸弹背心）
  if (d.bomb && !d.flash) {
    ctx.save();
    ctx.translate(bodyW * 0.18, bodyH * 0.16);
    // 背带
    ctx.strokeStyle = "#3a3f45";
    ctx.lineWidth = R * 0.14;
    ctx.beginPath(); ctx.moveTo(-bodyW * 0.6, -bodyH * 0.3); ctx.lineTo(bodyW * 0.4, bodyH * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bodyW * 0.5, -bodyH * 0.3); ctx.lineTo(-bodyW * 0.35, bodyH * 0.3); ctx.stroke();
    // 炸弹盒
    ctx.fillStyle = "#2e3338";
    ctx.fillRect(-R * 0.55, -R * 0.4, R * 1.1, R * 0.8);
    ctx.fillStyle = "#4a525c";
    ctx.fillRect(-R * 0.55, -R * 0.4, R * 1.1, R * 0.22);
    // 警示标志
    ctx.fillStyle = "#e8b23a";
    ctx.beginPath(); ctx.arc(0, -R * 0.08, R * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = "#2e3338";
    ctx.font = "bold " + Math.round(R * 0.26) + "px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("!", 0, -R * 0.05);
    // 闪烁红灯
    const bp = 0.5 + 0.5 * Math.sin(d.t * 12);
    ctx.fillStyle = `rgba(255,59,48,${0.4 + bp * 0.6})`;
    ctx.beginPath(); ctx.arc(R * 0.3, -R * 0.3, R * 0.14, 0, TAU); ctx.fill();
    // 导火索火花
    ctx.strokeStyle = "rgba(255,180,90,0.9)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-R * 0.2, -R * 0.42);
    ctx.quadraticCurveTo(-R * 0.4, -R * 0.6, -R * 0.52, -R * 0.55);
    ctx.stroke();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath(); ctx.arc(-R * 0.52, -R * 0.55, R * 0.09 + bp * R * 0.04, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // 前肢（机械爪）
  ctx.strokeStyle = dark;
  ctx.lineWidth = R * 0.2;
  ctx.beginPath();
  ctx.moveTo(bodyW * 0.2, -bodyH * 0.2);
  ctx.lineTo(bodyW * 0.6, -bodyH * 0.02);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bodyW * 0.3, -bodyH * 0.32);
  ctx.lineTo(bodyW * 0.68, -bodyH * 0.12);
  ctx.stroke();
  ctx.fillStyle = d.flash ? "#fff" : "#e8e4da";
  ctx.beginPath(); ctx.arc(bodyW * 0.62, -bodyH * 0.02, R * 0.11, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(bodyW * 0.7, -bodyH * 0.11, R * 0.11, 0, TAU); ctx.fill();

  // ---- 脖子（液压管）+ 头 ----
  ctx.strokeStyle = dark;
  ctx.lineWidth = R * (d.neck || 1) * 0.3;
  ctx.beginPath();
  ctx.moveTo(bodyW * 0.5, -bodyH * 0.4);
  ctx.quadraticCurveTo(bodyW * 0.95, -bodyH * 0.8, bodyW * 1.25, -bodyH * 0.85);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = R * (d.neck || 1) * 0.14;
  ctx.beginPath();
  ctx.moveTo(bodyW * 0.55, -bodyH * 0.34);
  ctx.quadraticCurveTo(bodyW * 0.98, -bodyH * 0.72, bodyW * 1.22, -bodyH * 0.78);
  ctx.stroke();
  const hr = R * (d.head || 1) * 0.6;
  ctx.save();
  ctx.translate(bodyW * 1.32, -bodyH * 0.82);
  // 头部机械甲
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, hr, hr * 0.72, 0, 0, TAU);
  ctx.fill();
  if (!d.flash) {
    // 头顶甲
    ctx.fillStyle = shadeColor(color, 0.3);
    ctx.beginPath();
    ctx.ellipse(0, -hr * 0.28, hr * 0.7, hr * 0.34, 0, 0, TAU);
    ctx.fill();
    // 下颌（吻部甲板）
    ctx.fillStyle = shadeColor(color, -0.2);
    ctx.beginPath();
    ctx.moveTo(hr * 0.1, -hr * 0.3);
    ctx.lineTo(hr * 1.7, -hr * 0.05);
    ctx.lineTo(hr * 0.25, hr * 0.42);
    ctx.closePath();
    ctx.fill();
    // 金属齿
    ctx.fillStyle = "#e8e4da";
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(hr * 0.7 + i * hr * 0.5, hr * 0.1);
      ctx.lineTo(hr * 0.78 + i * hr * 0.5, hr * 0.38);
      ctx.lineTo(hr * 0.86 + i * hr * 0.5, hr * 0.06);
      ctx.closePath();
      ctx.fill();
    }
    // 护目眼（发光条，随呼吸脉动）
    const ep = 0.7 + 0.3 * Math.sin(d.t * 6);
    ctx.fillStyle = "rgba(20,22,26,0.9)";
    ctx.beginPath();
    ctx.ellipse(hr * 0.35, -hr * 0.18, hr * 0.62, hr * 0.2, -0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = visor;
    ctx.globalAlpha = 0.35 + ep * 0.3;
    ctx.beginPath();
    ctx.ellipse(hr * 0.36, -hr * 0.18, hr * 0.5, hr * 0.1, -0.15, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(hr * 0.38, -hr * 0.18, hr * 0.34, hr * 0.05, -0.15, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 头冠（信号天线鳍）
    if (d.crest) {
      ctx.fillStyle = shadeColor(color, 0.35);
      ctx.beginPath();
      ctx.moveTo(-hr * 0.2, -hr * 0.5);
      ctx.lineTo(hr * 0.35, -hr * 1.25);
      ctx.lineTo(hr * 0.8, -hr * 0.5);
      ctx.closePath();
      ctx.fill();
      // 天线灯
      ctx.fillStyle = visor;
      ctx.beginPath(); ctx.arc(hr * 0.35, -hr * 1.05, hr * 0.09, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();

  // 受击白闪覆盖
  if (d.flash) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(0, -bodyH * 0.45, bodyW * 1.15, bodyH * 0.7, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

class Enemy {
  constructor(type, x, y, level, g) {
    const def = CFG.ENEMIES[type];
    const diff = g.diff;
    this.id = _enemyId++;
    this.type = type;
    this.def = def;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.knockX = 0; this.knockY = 0;
    this.r = def.r;
    this.level = level;
    // Boss 的生命成长比杂兵平缓
    const isBoss = def.kind === "boss";
    const hpScale = (isBoss ? (1 + (level - 1) * 0.10) : (1 + (level - 1) * 0.13)) * diff.hpMul;
    this.maxHp = Math.round(def.hp * hpScale);
    this.hp = this.maxHp;
    this.speed = def.speed * diff.speedMul;
    this.dmg = Math.round(def.dmg * diff.dmgMul * (1 + (level - 1) * 0.04));
    this.score = def.score;
    this.kind = def.kind;
    this.attackCd = rand(0.3, 0.9);
    this.projCd = rand(1, 2);
    this.flashT = 0;
    this.slowT = 0;
    this.dotDps = 0; this.dotT = 0;
    this.t = 0;
    this.dead = false;
    this.wobble = rand(0, TAU);
    this.lastFacing = 0;   // 绘制朝向缓存
    // Boss 状态
    this.bossT = 2;
    this.casting = false;      // 是否在施法前摇
    this.castType = "";
    this.castT = 0;
    this.castDur = 1;
    this.castTarget = { x: 0, y: 0 };
    this.chargeT = 0;
    this.chargeAng = 0;
    this.enraged = false;
  }

  applyDot(dps, dur, g) {
    this.dotDps = Math.max(this.dotDps, dps);
    this.dotT = Math.max(this.dotT, dur);
  }

  takeDamage(dmg, g, srcX, srcY, knock) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flashT = 0.09;
    if (knock) {
      const a = angleTo(srcX, srcY, this.x, this.y);
      const k = knock * (this.kind === "boss" ? 0.15 : 1);
      this.knockX += Math.cos(a) * k;
      this.knockY += Math.sin(a) * k;
    }
    if (g.settings.dmgNums) {
      const col = dmg >= 60 ? "#ffb84d" : "#ffffff";
      g.addText(this.x + rand(-6, 6), this.y - this.r - 6, String(Math.round(dmg)), col, dmg >= 60 ? 16 : 12);
    }
    AudioSys.play("enemyHit");
    if (this.hp <= 0) this.die(g);
  }

  die(g) {
    if (this.dead) return;
    this.dead = true;
    g.kills++;
    if (g.levelKills !== undefined) g.levelKills++;
    g.score += Math.round(this.score * g.diff.scoreMul);
    CodexStore.onKill(this.type);

    if (this.kind === "boomer") {
      this.explode(g, true);
      return;
    }

    const col = this.def.color;
    spawnBlood(g, this.x, this.y, this.kind === "boss" ? 60 : 12, col);
    g.particles.push(new Particle(this.x, this.y, 0, 0, 0.3, this.r * 1.4, "rgba(255,60,40,0.35)", "ring", 0));
    AudioSys.play(this.kind === "boss" ? "explosion" : "enemyDie");
    if (this.kind === "boss") {
      worldExplosion(g, this.x, this.y, 0, 200, "player", "#ff6b35");
      AudioSys.play("explosion");
      g.addShake(22);
    }
    this.drop(g);

    // Boss 额外掉落
    if (this.kind === "boss") {
      g.pickups.push(new Pickup("health", this.x - 40, this.y));
      g.pickups.push(new Pickup("health", this.x + 40, this.y));
      g.pickups.push(new Pickup("ammo", this.x, this.y - 40));
      g.pickups.push(new Pickup("ammo", this.x, this.y + 40));
      g.pickups.push(new Pickup("ammo", this.x - 30, this.y + 30));
      g.pickups.push(new Pickup("grenade", this.x + 30, this.y - 30));
    }
  }

  explode(g, killedByDamage) {
    this.dead = true;
    g.kills++;
    if (g.levelKills !== undefined) g.levelKills++;
    g.score += Math.round(this.score * g.diff.scoreMul);
    CodexStore.onKill(this.type);
    const r = this.def.aoe;
    const p = g.player;
    if (!p.dead && dist(this.x, this.y, p.x, p.y) < r + p.radius) {
      p.takeDamage(this.dmg, g, this.x, this.y);
    }
    for (const e of g.enemies) {
      if (e === this || e.dead) continue;
      if (dist(this.x, this.y, e.x, e.y) < r + e.r) {
        e.takeDamage(this.dmg * 1.4, g, this.x, this.y, 150);
      }
    }
    spawnBlood(g, this.x, this.y, 18, "#e9c46a");
    g.particles.push(new Particle(this.x, this.y, 0, 0, 0.35, r, "rgba(255,180,60,0.5)", "ring", 0));
    g.addShake(10);
    AudioSys.play("boomer");
    MapSys.addDecal(this.x, this.y, r * 0.6, "rgba(60,40,10,0.35)");
    this.drop(g);
    void killedByDamage;
  }

  drop(g) {
    const roll = Math.random();
    if (roll < CFG.DROP.health) g.pickups.push(new Pickup("health", this.x, this.y));
    else if (roll < CFG.DROP.health + CFG.DROP.ammo) g.pickups.push(new Pickup("ammo", this.x, this.y));
    else if (roll < CFG.DROP.health + CFG.DROP.ammo + CFG.DROP.grenade) g.pickups.push(new Pickup("grenade", this.x, this.y));
  }

  update(dt, g) {
    if (this.dead) return;
    this.t += dt;
    this.flashT -= dt;
    this.slowT -= dt;
    this.attackCd -= dt;
    this.projCd -= dt;

    // 灼烧
    if (this.dotT > 0) {
      this.dotT -= dt;
      this.hp -= this.dotDps * dt;
      if (Math.random() < dt * 12) {
        g.particles.push(new Particle(this.x + rand(-8, 8), this.y + rand(-8, 8), rand(-20, 20), rand(-60, -20), 0.4, 4, "#ff7b00", "dot", 0));
      }
      if (this.hp <= 0) { this.die(g); return; }
    }

    const p = g.player;
    const d = dist(this.x, this.y, p.x, p.y);
    const spd = this.speed * (this.slowT > 0 ? 0.55 : 1);
    const knockDecay = Math.exp(-7 * dt);
    this.knockX *= knockDecay; this.knockY *= knockDecay;

    switch (this.kind) {
      case "melee": {
        const a = angleTo(this.x, this.y, p.x, p.y);
        this.vx = Math.cos(a) * spd;
        this.vy = Math.sin(a) * spd;
        if (d < this.r + p.radius + 8 && this.attackCd <= 0 && !p.dead) {
          p.takeDamage(this.dmg, g, this.x, this.y);
          this.attackCd = this.def.attackCd * rand(0.85, 1.25);
        }
        break;
      }
      case "ranged": {
        const want = 330, band = 100;
        let a;
        if (d > want + band) a = angleTo(this.x, this.y, p.x, p.y);
        else if (d < want - band) a = angleTo(p.x, p.y, this.x, this.y);
        else a = angleTo(this.x, this.y, p.x, p.y) + Math.PI / 2 * Math.sin(this.t * 1.6);
        this.vx = Math.cos(a) * spd * 0.85;
        this.vy = Math.sin(a) * spd * 0.85;
        if (this.projCd <= 0 && d < 600 && !p.dead) {
          this.projCd = this.def.attackCd * rand(0.9, 1.2);
          const pa = angleTo(this.x, this.y, p.x, p.y) + rand(-0.07, 0.07);
          g.ebullets.push(new EnemyBullet(this.x, this.y, pa, this.def.proj.speed, this.dmg, this.def.proj.r, this.def.proj.color, g));
        }
        break;
      }
      case "boomer": {
        const a = angleTo(this.x, this.y, p.x, p.y);
        this.vx = Math.cos(a) * spd;
        this.vy = Math.sin(a) * spd;
        if (d < this.r + p.radius + 26 && !p.dead) this.explode(g, false);
        break;
      }
      case "boss": {
        this.bossAI(dt, g, p, d, spd);
        break;
      }
    }

    // 移动 + 击退
    this.x += (this.vx + this.knockX) * dt;
    this.y += (this.vy + this.knockY) * dt;

    // 边界与障碍物
    const w = CFG.WALL + this.r;
    this.x = clamp(this.x, w, CFG.ARENA.w - w);
    this.y = clamp(this.y, w, CFG.ARENA.h - w);
    const res = MapSys.resolveCircle(this.x, this.y, this.r);
    if (res) { this.x += res.x; this.y += res.y; }
  }

  /* ---------- Boss AI（带攻击前摇预警） ---------- */
  bossAI(dt, g, p, d, spd) {
    // 移动：保持距离并缓慢逼近
    const want = 380;
    let a;
    if (d > want + 140) a = angleTo(this.x, this.y, p.x, p.y);
    else if (d < want - 140) a = angleTo(p.x, p.y, this.x, this.y);
    else a = angleTo(this.x, this.y, p.x, p.y) + Math.PI / 2 * Math.sin(this.t * 0.9);
    this.vx = Math.cos(a) * spd * 0.9;
    this.vy = Math.sin(a) * spd * 0.9;

    // 狂暴
    if (!this.enraged && this.hp < this.maxHp * 0.5) {
      this.enraged = true;
      g.addText(this.x, this.y - this.r - 20, this.def.name + " 狂暴了！", "#ff5a4d", 18);
      AudioSys.play("boss");
    }

    // 冲撞执行阶段
    if (this.chargeT > 0) {
      this.chargeT -= dt;
      this.vx = Math.cos(this.chargeAng) * 780;
      this.vy = Math.sin(this.chargeAng) * 780;
    }

    // 接触伤害
    if (d < this.r + p.radius + 12 && this.attackCd <= 0 && !p.dead) {
      p.takeDamage(this.dmg, g, this.x, this.y);
      this.attackCd = this.def.attackCd;
    }

    // 施法前摇
    if (this.casting) {
      this.castT -= dt;
      if (this.castT <= 0) {
        this.casting = false;
        this.executeCast(g);
      }
      return;
    }

    // 选择下一个技能（进入前摇）
    this.bossT -= dt;
    if (this.bossT <= 0 && this.chargeT <= 0) {
      this.bossT = this.enraged ? 1.5 : 2.1;
      const roll = Math.random();
      if (roll < 0.30) this.beginCast("ring", 0.9);
      else if (roll < 0.55) this.beginCast("volley", 0.8, p);
      else if (roll < 0.73) this.beginCast("summon", 1.0);
      else this.beginCast("charge", 1.1, p);
    }
  }

  beginCast(type, dur, target) {
    this.casting = true;
    this.castType = type;
    this.castT = dur;
    this.castDur = dur;
    if (target) { this.castTarget.x = target.x; this.castTarget.y = target.y; }
    if (type === "charge") this.chargeAng = angleTo(this.x, this.y, target.x, target.y);
    AudioSys.play("click");
  }

  executeCast(g) {
    switch (this.castType) {
      case "ring": this.ringBurst(g); break;
      case "volley": this.aimedVolley(g, this.castTarget.x, this.castTarget.y); break;
      case "summon": this.summonDrones(g); break;
      case "charge":
        this.chargeT = 0.8;
        AudioSys.play("boss");
        break;
    }
  }

  ringBurst(g) {
    const n = this.enraged ? 20 : 14;
    const speed = this.def.proj.speed * (this.enraged ? 1.25 : 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.t * 0.3;
      g.ebullets.push(new EnemyBullet(this.x, this.y, a, speed, this.dmg * 0.7, this.def.proj.r, this.def.proj.color, g));
    }
    g.particles.push(new Particle(this.x, this.y, 0, 0, 0.4, this.r * 1.2, "rgba(255,80,120,0.4)", "ring", 0));
    g.addShake(6);
  }

  aimedVolley(g, tx, ty) {
    const base = angleTo(this.x, this.y, tx, ty);
    for (let i = -1; i <= 1; i++) {
      g.ebullets.push(new EnemyBullet(this.x, this.y, base + i * 0.16, this.def.proj.speed * 1.15, this.dmg, this.def.proj.r, this.def.proj.color, g));
    }
  }

  summonDrones(g) {
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU);
      const d = rand(120, 200);
      const x = clamp(this.x + Math.cos(a) * d, CFG.WALL + 30, CFG.ARENA.w - CFG.WALL - 30);
      const y = clamp(this.y + Math.sin(a) * d, CFG.WALL + 30, CFG.ARENA.h - CFG.WALL - 30);
      g.spawnEnemy("drone", x, y, this.level);
    }
    g.addText(this.x, this.y - this.r - 26, "巢群增援！", "#e9c46a", 15);
  }

  draw(ctx, g) {
    const dcfg = DINO[this.type] || DINO.drone;
    const flash = this.flashT > 0;
    const pulse = 1 + Math.sin(this.t * 6 + this.wobble) * 0.05;
    const r = this.r * pulse;
    const moving = Math.hypot(this.vx, this.vy) > 8;

    // 投影（光从左上照来，影子落在右下方，不在脚下）
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(this.x + r * 0.55, this.y + r * 0.5, r * 1.15, r * 0.5, 0, 0, TAU);
    ctx.fill();

    // 朝向：远程/自爆/Boss 面朝玩家；近战面朝移动方向
    const facePlayer = this.kind === "ranged" || this.kind === "boomer" || this.kind === "boss";
    const facing = facePlayer
      ? angleTo(this.x, this.y, g.player.x, g.player.y)
      : (moving ? Math.atan2(this.vy, this.vx) : (this.lastFacing || 0));
    this.lastFacing = facing;

    // 机械异形绘制
    drawDino(ctx, {
      x: this.x, y: this.y, r, t: this.t, dir: facing, moving, flash,
      color: this.def.color, belly: dcfg.belly,
      bodyW: dcfg.bodyW, legL: dcfg.legL, neck: dcfg.neck, head: dcfg.head,
      spikes: dcfg.spikes, crest: dcfg.crest,
      launcher: dcfg.launcher, bomb: dcfg.bomb, armor: dcfg.armor, visor: dcfg.visor,
    });

    // Boss 核心发光
    if (this.kind === "boss") {
      const cp = 0.7 + Math.sin(this.t * 3) * 0.2;
      const coreX = this.x + Math.cos(facing) * r * 0.35;
      const coreY = this.y + Math.sin(facing) * r * 0.35 - r * 0.55;
      ctx.fillStyle = flash ? "#fff" : "rgba(255,209,102,0.9)";
      ctx.beginPath(); ctx.arc(coreX, coreY, r * 0.26 * cp, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(coreX, coreY, r * 0.12 * cp, 0, TAU); ctx.fill();
    }
    // 自爆者膨胀闪烁
    if (this.kind === "boomer") {
      const glow = 0.5 + Math.sin(this.t * 10) * 0.3;
      ctx.fillStyle = `rgba(255,220,120,${glow * 0.7})`;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - r * 0.8, r * 0.9, r * 0.45, 0, 0, TAU);
      ctx.fill();
    }

    // 施法前摇预警（Boss）
    if (this.casting && this.kind === "boss") {
      this.drawTelegraph(ctx, g);
    }

    // 血条
    if (this.hp < this.maxHp && this.kind !== "boss") {
      const w = this.r * 2;
      const pct = this.hp / this.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(this.x - w / 2, this.y - this.r - 16, w, 4);
      ctx.fillStyle = pct > 0.5 ? "#6fdc6f" : pct > 0.25 ? "#ffd166" : "#ff5a4d";
      ctx.fillRect(this.x - w / 2, this.y - this.r - 16, w * pct, 4);
    }
  }

  /* Boss 技能前摇预警绘制 */
  drawTelegraph(ctx, g) {
    const prog = 1 - this.castT / this.castDur;   // 0 → 1
    ctx.save();
    switch (this.castType) {
      case "ring": {
        // 扩散的同心圆
        for (let i = 0; i < 3; i++) {
          const rr = this.r * (1.1 + (i * 0.35 + prog) * 1.6);
          ctx.strokeStyle = `rgba(255,60,60,${0.75 - i * 0.2})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(this.x, this.y, rr, 0, TAU); ctx.stroke();
        }
        break;
      }
      case "volley": {
        // 目标脚下红圈
        const a = 0.35 + 0.4 * Math.sin(this.t * 14);
        ctx.strokeStyle = `rgba(255,50,50,${a + 0.4})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.castTarget.x, this.castTarget.y, 34, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(255,50,50,${a * 0.35})`;
        ctx.beginPath(); ctx.arc(this.castTarget.x, this.castTarget.y, 34, 0, TAU); ctx.fill();
        break;
      }
      case "summon": {
        // 召唤点红点
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + this.t;
          const dx = this.x + Math.cos(a) * 160;
          const dy = this.y + Math.sin(a) * 160;
          ctx.fillStyle = `rgba(255,80,80,${0.5 + 0.4 * Math.sin(this.t * 12)})`;
          ctx.beginPath(); ctx.arc(dx, dy, 14, 0, TAU); ctx.fill();
        }
        break;
      }
      case "charge": {
        // 冲锋方向箭头
        const len = 240;
        const x0 = this.x, y0 = this.y;
        const x1 = x0 + Math.cos(this.chargeAng) * len;
        const y1 = y0 + Math.sin(this.chargeAng) * len;
        ctx.strokeStyle = "rgba(255,60,60,0.8)";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.setLineDash([]);
        // 箭头
        ctx.fillStyle = "rgba(255,60,60,0.9)";
        ctx.save();
        ctx.translate(x1, y1);
        ctx.rotate(this.chargeAng);
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
    }
    ctx.restore();
    void g;
  }
}

/* ==================== 拾取物 ==================== */
class Pickup {
  constructor(kind, x, y) {
    this.kind = kind;   // health | ammo | grenade
    this.x = x; this.y = y;
    this.t = rand(0, TAU);
    this.dead = false;
    this.r = 11;
    this.vx = 0; this.vy = 0;
  }

  update(dt, g) {
    this.t += dt * 3;
    // 无磁力吸附：拾取物静止，玩家需真正走到跟前拾取
    const p = g.player;
    const d2 = dist2(this.x, this.y, p.x, p.y);
    if (d2 < (p.radius + this.r) * (p.radius + this.r)) {
      // 收集成功才消失（弹药/生命已满时不消耗，也不刷屏提示）
      if (this.collect(g)) this.dead = true;
    }
  }

  /* 返回是否真正收集（false = 已满，不消耗、静默） */
  collect(g) {
    const p = g.player;
    switch (this.kind) {
      case "health": {
        if (p.hp >= p.maxHp) return false;
        p.heal(25);
        g.addText(p.x, p.y - 20, "+25", "#6fdc6f", 14);
        AudioSys.play("health");
        return true;
      }
      case "ammo": {
        let gained = false;
        for (const wid of p.weapons) {
          const max = CFG.WEAPONS[wid].ammo;
          if (max !== Infinity && p.ammo[wid] < max) {
            p.ammo[wid] = Math.min(max, p.ammo[wid] + Math.round(max * 0.25));
            gained = true;
          }
        }
        if (!gained) return false;
        g.addText(p.x, p.y - 20, "弹药补给", "#8fd3ff", 14);
        AudioSys.play("ammo");
        return true;
      }
      case "grenade":
        p.grenadeCd = Math.max(0, p.grenadeCd - 2);
        g.addText(p.x, p.y - 20, "手雷 +1", "#ffb84d", 14);
        AudioSys.play("pickup");
        return true;
    }
    return true;
  }

  draw(ctx, g) {
    const bob = Math.sin(this.t) * 2;
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    switch (this.kind) {
      case "health": {
        // 急救箱：白箱 + 红十字
        ctx.fillStyle = "#e8e8ee";
        ctx.fillRect(-9, -7, 18, 14);
        ctx.strokeStyle = "#b0b6c0";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-9, -7, 18, 14);
        // 把手
        ctx.fillStyle = "#c8ccd4";
        ctx.fillRect(-6, -9, 12, 3);
        // 红十字
        ctx.fillStyle = "#e04b3a";
        ctx.fillRect(-5, -3, 10, 6);
        ctx.fillRect(-2, -6, 4, 12);
        // 高光
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillRect(-9, -7, 18, 2);
        break;
      }
      case "ammo": {
        // 弹药箱：木箱 + 盖上印当前武器的外形
        ctx.fillStyle = "#7a5c34";
        ctx.fillRect(-9, -7, 18, 14);
        ctx.fillStyle = "#8f6d3f";
        ctx.fillRect(-6, -5, 12, 10);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(-6, -5, 12, 10);
        // 盖面
        ctx.fillStyle = "#a07c48";
        ctx.beginPath();
        ctx.moveTo(-9, -7); ctx.lineTo(9, -7); ctx.lineTo(9, -10); ctx.lineTo(-9, -10);
        ctx.closePath(); ctx.fill();
        // 盖上印当前武器（迷你）
        if (g && g.player) {
          ctx.save();
          ctx.translate(-5, -2);
          ctx.scale(0.42, 0.42);
          drawWeaponShape(ctx, g.player.curW, 0);
          ctx.restore();
        }
        break;
      }
      case "grenade":
        ctx.fillStyle = "#7fb069";
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = "#3a2c14";
        ctx.fillRect(2, -9, 4, 5);
        break;
    }
    ctx.restore();
  }
}

/* ==================== 粒子 ==================== */
class Particle {
  constructor(x, y, vx, vy, life, size, color, kind, text) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.color = color;
    this.kind = kind || "dot"; // dot | ring | text | smoke
    this.text = text || "";
    this.dead = false;
    this.grav = 0;
    this.drag = 1;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.grav) this.vy += this.grav * dt;
    const d = Math.exp(-this.drag * dt);
    this.vx *= d; this.vy *= d;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    if (this.kind === "text") {
      ctx.globalAlpha = t;
      ctx.font = `bold ${this.size}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = this.color;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.strokeText(this.text, this.x, this.y);
      ctx.fillText(this.text, this.x, this.y);
    } else if (this.kind === "ring") {
      ctx.globalAlpha = t * 0.8;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3 * t + 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (1.6 - t), 0, TAU);
      ctx.stroke();
    } else {
      ctx.globalAlpha = t;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (0.4 + 0.6 * t), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ==================== 通用特效 ==================== */
function spawnBlood(g, x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const spd = rand(30, 220);
    g.particles.push(new Particle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, rand(0.25, 0.7), rand(2, 5), color, "dot", 0));
  }
  MapSys.addDecal(x, y, rand(10, 26), "rgba(90,20,25,0.35)");
}

/* 世界爆炸：team = 'player' 伤害敌人与油桶；team = 'enemy' 伤害玩家 */
function worldExplosion(g, x, y, dmg, radius, team, color) {
  color = color || "#ff8c42";
  g.particles.push(new Particle(x, y, 0, 0, 0.45, radius, `rgba(255,140,60,0.45)`, "ring", 0));
  for (let i = 0; i < 26; i++) {
    const a = rand(0, TAU);
    const spd = rand(60, 380);
    g.particles.push(new Particle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, rand(0.3, 0.8), rand(3, 7), choice(["#ffd166", "#ff8c42", "#ff5a4d", "#fff"]), "dot", 0));
  }
  for (let i = 0; i < 8; i++) {
    g.particles.push(new Particle(x + rand(-14, 14), y + rand(-14, 14), rand(-30, 30), rand(-60, -20), rand(0.5, 1.1), rand(6, 12), "rgba(80,80,80,0.35)", "smoke", 0));
  }
  MapSys.addDecal(x, y, radius * 0.5, "rgba(40,30,20,0.4)");
  g.addShake(radius / 8);

  if (team === "player") {
    for (const e of g.enemies) {
      if (e.dead) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < radius + e.r) {
        const fall = 1 - d / (radius + e.r);
        e.takeDamage(dmg * (0.5 + 0.5 * fall), g, x, y, 220 * fall + 60);
      }
    }
    MapSys.damageBarrels(x, y, radius, dmg, g);
  } else {
    const p = g.player;
    if (!p.dead && dist(x, y, p.x, p.y) < radius + p.radius) {
      p.takeDamage(dmg, g, x, y);
    }
  }
}
