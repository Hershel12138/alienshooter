/* ============ 音频系统（Web Audio 合成，零外部资源） ============ */
"use strict";

const AudioSys = {
  ctx: null,
  master: null,
  noiseBuf: null,
  volume: 0.7,
  enabled: true,
  _last: {},
  // 背景音乐
  musicOn: false,
  musicTimer: null,
  _musicSources: [],

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      // 噪声缓冲
      const len = this.ctx.sampleRate * 1.2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch (e) { this.ctx = null; }
  },

  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); },

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; },

  /* 节流：同一音效 30ms 内最多播放一次，避免叠爆 */
  _throttle(name) {
    const now = performance.now();
    if (this._last[name] && now - this._last[name] < 30) return true;
    this._last[name] = now;
    return false;
  },

  _tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  },

  _noise(dur, vol, filterFreq, filterType, delay, slideTo) {
    if (!this.ctx || !this.enabled || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType || "lowpass";
    filt.frequency.setValueAtTime(filterFreq, t0);
    if (slideTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  },

  /* ---------- 背景音乐（程序化合成：菜单合成波 / 战斗激烈节拍） ---------- */
  musicOn: false,
  musicKind: "battle",
  musicTimer: null,
  _musicSources: [],

  startMusic(kind) {
    if (!this.ctx) return;
    if (!kind) kind = this.musicKind || "battle";
    if (this.musicOn && this.musicKind === kind) return;
    this.stopMusic();
    this.musicKind = kind;
    this.musicOn = true;
    this._musicChunk();
    this.musicTimer = setInterval(() => this._musicChunk(), 3200);
  },

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    for (const s of this._musicSources) { try { s.stop(); } catch (e) {} }
    this._musicSources = [];
  },

  /* 单个音符（锯齿/方波 + 低通滤波） */
  _note(freq, t, dur, vol, type, filterFreq) {
    if (!this.ctx || !isFinite(freq) || !isFinite(dur) || !isFinite(vol)) return null;
    const o = this.ctx.createOscillator();
    o.type = type || "sawtooth";
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = filterFreq || 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.06);
    this._musicSources.push(o, f, g);
    return o;
  },

  _kick(t, vol) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.34, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.26);
    this._musicSources.push(o, g);
  },

  _snare(t, vol) {
    if (!this.ctx || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1900; f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.17);
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.07, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 0.12);
    this._musicSources.push(src, f, g, o, og);
  },

  _hat(t, vol, open) {
    if (!this.ctx || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 7000;
    const g = this.ctx.createGain();
    const d = open ? 0.16 : 0.04;
    g.gain.setValueAtTime(vol || 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + d + 0.02);
    this._musicSources.push(src, f, g);
  },

  /* 和弦垫（三音齐奏，慢起音） */
  _pad(freqs, t, dur, vol) {
    if (!this.ctx) return;
    for (const fr of freqs) {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = fr;
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 620; f.Q.value = 1.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
      g.gain.setValueAtTime(vol, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.06);
      this._musicSources.push(o, f, g);
    }
  },

  /* 温暖和弦垫（失谐三角波对 + 慢起音，柔和厚实） */
  _padSoft(freqs, t, dur, vol) {
    if (!this.ctx) return;
    for (const fr of freqs) {
      for (const det of [-3, 3]) {
        const o = this.ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = fr + det;
        const f = this.ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = 900; f.Q.value = 0.6;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol / 2, t + dur * 0.3);
        g.gain.setValueAtTime(vol / 2, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.06);
        this._musicSources.push(o, f, g);
      }
    }
  },

  _musicChunk() {
    if (!this.ctx || !this.musicOn || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.05;
    const menu = this.musicKind !== "battle";
    const spb = menu ? 60 / 92 : 60 / 128;   // 菜单 92 BPM 舒缓；战斗 128 BPM
    const bars = 4;
    const dur = bars * 4 * spb;
    const prog = menu ? ["Am", "F", "C", "G"] : ["Am", "F", "Am", "G"];
    const CH = {
      Am: [55.00, 65.41, 82.41, 110.00],  // A2 C3 E3 A3
      F:  [43.65, 55.00, 65.41, 87.31],   // F2 A2 C3 F3
      C:  [65.41, 82.41, 98.00, 130.81],  // C3 E3 G3 C4
      G:  [49.00, 61.74, 73.42, 98.00],   // G2 B2 D3 G3
    };
    const arpPat = [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 3, 2, 1, 2, 0, 2];

    for (let b = 0; b < bars; b++) {
      const bt = t0 + b * 4 * spb;
      const ch = prog[b];
      const tones = CH[ch];
      const root = tones[0];
      if (menu) {
        // 温暖和弦垫
        this._padSoft(tones.map(f => f * 2), bt, 4 * spb, 0.055);
        // 低音：整小节持续根音（正弦，柔和）
        this._note(root / 2, bt, 4 * spb * 0.95, 0.06, "sine", 320);
        // 柔和 8 分琶音（正弦拨弦，轻）
        const n8 = spb / 2;
        for (let i = 0; i < 8; i++) {
          const t = bt + i * n8;
          const f = tones[i % 4] * 4;
          this._note(f, t, n8 * 0.8, 0.028, "sine", 1000);
        }
        // 轻鼓：1、3 拍 + 反拍轻镲
        this._kick(bt, 0.11);
        this._kick(bt + 2 * spb, 0.085);
        this._hat(bt + spb * 0.5, 0.018, false);
        this._hat(bt + 2.5 * spb, 0.018, false);
      } else {
        // 战斗变奏（保留未启用）：激烈节拍
        this._pad(tones.map(f => f * 2), bt, 4 * spb, 0.05);
        for (let i = 0; i < 4; i++) {
          const t = bt + i * spb;
          this._note(root / 2, t, spb * 0.9, 0.12, "sawtooth", 520);
          this._note(root, t + spb * 0.5, spb * 0.4, 0.06, "square", 900);
        }
        const n16 = spb / 4;
        for (let i = 0; i < arpPat.length; i++) {
          const t = bt + i * n16;
          const f = tones[arpPat[i]] * 3;
          this._note(f, t, n16 * 0.85, 0.05, "square", 2400);
        }
        for (let i = 0; i < 4; i++) {
          const t = bt + i * spb;
          this._kick(t, 0.36);
          if (i === 1 || i === 3) this._snare(t, 0.16);
          this._hat(t + spb * 0.5, 0.05, false);
        }
        for (let i = 0; i < 4; i++) this._hat(bt + 3 * spb + i * n16, 0.045, i === 3);
        this._snare(bt + 3.5 * spb, 0.08);
      }
    }

    // 菜单：轻柔正弦主题旋律（A 段两句，带回声；B 段留白给垫与琶音）
    if (menu) {
      const mel = [440, 0, 523.25, 0, 659.25, 587.33, 523.25, 0];
      const n4 = spb;
      for (let i = 0; i < mel.length; i++) {
        const f = mel[i];
        if (!f) continue;
        const t = t0 + 0.5 + i * n4;
        this._note(f, t, n4 * 1.8, 0.035, "sine", 1300);
        this._note(f, t + n4 * 2, n4 * 1.2, 0.016, "sine", 1100);   // 回声
      }
    }

    if (this._musicSources.length > 200) this._musicSources.splice(0, this._musicSources.length - 200);
  },

  play(name) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case "shoot":   if (this._throttle("shoot")) return; this._tone(880, 0.06, "square", 0.10, 320); this._noise(0.05, 0.06, 2600, "highpass"); break;
      case "shotgun": if (this._throttle("shotgun")) return; this._noise(0.22, 0.30, 1400, "lowpass", 0, 200); this._tone(150, 0.14, "square", 0.16, 60); break;
      case "smg":     if (this._throttle("smg")) return; this._tone(620, 0.045, "square", 0.07, 240); break;
      case "rifle":   if (this._throttle("rifle")) return; this._tone(520, 0.07, "sawtooth", 0.10, 140); this._noise(0.05, 0.08, 1800, "highpass"); break;
      case "plasma":  if (this._throttle("plasma")) return; this._tone(140, 0.22, "sine", 0.22, 520); this._noise(0.10, 0.10, 3000, "bandpass"); break;
      case "flamer":  if (this._throttle("flamer")) return; this._noise(0.09, 0.09, 900, "lowpass"); this._tone(220, 0.08, "sawtooth", 0.05, 90); break;
      case "grenade": this._noise(0.4, 0.4, 700, "lowpass", 0, 90); this._tone(90, 0.35, "sine", 0.35, 30); break;
      case "explosion": this._noise(0.5, 0.5, 900, "lowpass", 0, 60); this._tone(80, 0.4, "sine", 0.4, 25); break;
      case "enemyHit": if (this._throttle("enemyHit")) return; this._tone(300, 0.05, "square", 0.06, 180); break;
      case "enemyDie": if (this._throttle("enemyDie")) return; this._tone(200, 0.14, "sawtooth", 0.10, 50); this._noise(0.12, 0.08, 700, "lowpass", 0, 150); break;
      case "boomer":   this._noise(0.3, 0.3, 800, "lowpass", 0, 100); this._tone(120, 0.25, "sine", 0.25, 40); break;
      case "boss":     this._tone(70, 0.9, "sawtooth", 0.30, 40); this._tone(105, 0.9, "square", 0.16, 55, 0.08); this._noise(0.7, 0.16, 400, "lowpass"); break;
      case "pickup":   if (this._throttle("pickup")) return; this._tone(660, 0.06, "sine", 0.09, 990); break;
      case "health":   this._tone(520, 0.09, "sine", 0.14, 780); this._tone(780, 0.10, "sine", 0.12, 1040, 0.07); break;
      case "ammo":     this._tone(440, 0.07, "square", 0.08, 660); this._tone(660, 0.07, "square", 0.08, 880, 0.07); break;
      case "levelup":  this._tone(523, 0.12, "triangle", 0.16); this._tone(659, 0.12, "triangle", 0.16, 0, 0.1); this._tone(784, 0.18, "triangle", 0.16, 0, 0.2); break;
      case "hurt":     this._tone(180, 0.18, "square", 0.22, 70); this._noise(0.12, 0.12, 500, "lowpass"); break;
      case "click":    this._tone(900, 0.04, "square", 0.06, 700); break;
      case "wave":     this._tone(392, 0.12, "triangle", 0.14); this._tone(523, 0.16, "triangle", 0.14, 0, 0.12); break;
      case "clear":    this._tone(523, 0.1, "triangle", 0.13); this._tone(659, 0.1, "triangle", 0.13, 0, 0.09); this._tone(784, 0.16, "triangle", 0.13, 0, 0.18); break;
      case "gameover": this._tone(392, 0.5, "sawtooth", 0.22, 120); this._tone(311, 0.7, "sawtooth", 0.2, 90, 0.35); this._noise(0.9, 0.2, 300, "lowpass"); break;
      case "victory":  this._tone(523, 0.14, "triangle", 0.18); this._tone(659, 0.14, "triangle", 0.18, 0, 0.12); this._tone(784, 0.14, "triangle", 0.18, 0, 0.24); this._tone(1047, 0.3, "triangle", 0.2, 0, 0.36); break;
      case "cinema":   this._tone(220, 1.4, "sawtooth", 0.09); this._tone(277.18, 1.4, "sawtooth", 0.07, 0, 0.06); this._tone(329.63, 1.4, "sawtooth", 0.07, 0, 0.12); this._tone(440, 1.7, "triangle", 0.10, 0, 0.3); this._tone(554.37, 2.0, "triangle", 0.07, 0, 0.5); this._tone(659.25, 2.2, "sine", 0.06, 0, 0.7); break;
    }
  },
};
