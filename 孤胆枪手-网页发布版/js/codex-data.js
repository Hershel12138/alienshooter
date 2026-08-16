/* ============ 图鉴数据 ============ */
"use strict";

const CODEX = {
  enemies: [
    { id: "drone",  name: "工蚁异形",   desc: "蜂巢中最底层的工蜂，被生物机械改造过：液压双腿、装甲背板、发光护目眼。成群结队、不知疲倦，用机械颚钳撕扯猎物。单独一只不可怕，但当你被上百只包围时——它们就是绞肉机。", stats: ["生命 26", "速度 中", "近战伤害 8", "出现 第 1 关起"] },
    { id: "runner", name: "迅捷异形",   desc: "轻装猎手，以极高的速度突袭目标。细长的机械肢体让它们跑得飞快，膝关节的发光关节在夜色中一闪而过。擅长从侧翼包抄。注意听——它们的尖啸声往往是你听到的最后一声。", stats: ["生命 16", "速度 极快", "近战伤害 6", "出现 第 1 关起"] },
    { id: "spitter", name: "酸液喷射者", desc: "远距离压制单位，背部驮着一门生物酸液发射器，蓄能脉冲亮起时就要发射了。酸液能融化护甲和血肉。优先解决它们，否则你会在躲闪中被耗干。", stats: ["生命 42", "速度 慢", "酸液伤害 10", "射程 420"] },
    { id: "boomer", name: "自爆者",     desc: "肚皮上绑着生物炸弹背心的自杀单位，红灯闪烁得越快，离引爆越近。靠近目标后引爆，造成大范围伤害。远距离击杀它们，别让它们近身——它爆炸的余波可不会分辨敌我。", stats: ["生命 30", "速度 快", "爆炸伤害 38", "范围 95"] },
    { id: "elite", name: "精英猎杀者",  desc: "蜂巢培育的战斗个体，覆盖双层强化装甲与金属背棘，行动迅捷且极具攻击性。它们通常作为小队的先锋发起冲锋。", stats: ["生命 115", "速度 快", "近战伤害 14", "出现 第 4 关起"] },
    { id: "brute", name: "重装异形",    desc: "蜂巢的移动堡垒。三层重型装甲板吸收大量火力，巨大的机械前肢一击就能砸碎防弹玻璃。用穿甲武器或爆炸物对付它。", stats: ["生命 250", "速度 极慢", "近战伤害 26", "出现 第 4 关起"] },
    { id: "warden", name: "孵化护卫",   desc: "孵化室的守护者，蜂巢之母最忠实的卫兵。通体覆盖重型装甲，护目眼泛着诡异的粉紫色光，会施展和蜂巢之母同源的酸液法术。小心它的攻击前摇。", stats: ["生命 1500+", "速度 慢", "多段攻击", "首领 · 第 5 关"] },
    { id: "boss",  name: "蜂巢之母",    desc: "蜂巢的核心意识体，一只被机械科技增幅过的巨型母体。它盘踞在巢穴最深处，不断孵化新的异形。拥有多种攻击模式：酸液弹幕、召唤巢群、野蛮冲撞。注意地面的红色预警，及时闪避。", stats: ["生命 3200+", "速度 慢", "多段攻击", "最终首领 · 第 8 关"] },
  ],
  weapons: [
    { id: "pistol",  name: "双枪",       desc: "标准配发的制式双持手枪，双手各持一把、交替开火。弹药无限、射速均衡，是每一位士兵最忠实的伙伴。永远不要扔掉你的双枪。", stats: ["伤害 9×2", "射速 4.6/s", "弹药 无限"] },
    { id: "shotgun", name: "霰弹枪",     desc: "近距离的绝对主宰。一发八颗弹丸，贴脸输出足以将任何异形打成筛子。代价是射速慢、弹药消耗快。", stats: ["伤害 7×8", "射速 1.7/s", "弹药 48"] },
    { id: "smg",     name: "冲锋枪",     desc: "高射速的压制利器，适合清理成群的工蚁异形。弹道散布较大，中远距离精准度有限。", stats: ["伤害 5", "射速 11/s", "弹药 150"] },
    { id: "rifle",   name: "突击步枪",   desc: "精准而致命，子弹可穿透 2 个目标。远距离点射精英单位的首选。", stats: ["伤害 20", "射速 5.6/s", "穿透 2", "弹药 110"] },
    { id: "plasma",  name: "等离子炮",   desc: "发射高温等离子团，命中后产生范围爆炸。对付密集的异形群效果拔群，但射速较慢。", stats: ["伤害 40", "范围爆炸 62", "弹药 26"] },
    { id: "flamer",  name: "火焰喷射器", desc: "喷射持续燃烧的烈焰，点燃目标造成灼烧伤害。最适合封堵通道、清剿巢群。", stats: ["伤害 7", "灼烧 5/s", "弹药 130"] },
    { id: "minigun", name: "加特林",     desc: "蜂巢战役中缴获的重型武器。极限射速，火力倾泻如雨。后坐力大，但谁在乎呢？", stats: ["伤害 7", "射速 15.5/s", "弹药 210"] },
  ],
  lore: [
    { title: "盖亚-7 殖民地", text: "人类在深空建立的第三十七座殖民地，人口四万七千。以矿业和农业闻名，是殖民舰队最重要的补给节点。2087 年 3 月失联。" },
    { title: "蜂巢（HIVE）", text: "一种来源不明的外星生物集群。以有机组织构筑巢穴，将一切生物质转化为自身增殖的原料。已知个体类型：工蚁、迅捷、喷射者、自爆者、精英、重装、孵化护卫、蜂巢之母。" },
    { title: "研究中心", text: "盖亚-7 的地面科研中枢，共八层结构：入口大厅、实验走廊、深层实验室、冷藏库、孵化室、服务器核心、巢穴通道，以及最深处——蜂巢核心。异形把它们逐一改造成了它们的领土。" },
    { title: "蜂巢之母", text: "蜂巢的核心个体，也是唯一拥有智慧的存在。它会主动孵化战斗个体，并在巢穴被入侵时亲自迎战。传说摧毁蜂巢之母，整个蜂巢都会随之崩溃。" },
    { title: "最后防线", text: "殖民舰队撤离后，盖亚-7 轨道上只剩下你。联邦档案将本次行动编号为「FINAL STAND」——最后一次抵抗。无论结果如何，你的名字都会被写进人类的挽歌里。" },
  ],
};

/* 图鉴进度存取（localStorage） */
const CodexStore = {
  KEY: "asr_codex_v1",
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      this.data = raw ? JSON.parse(raw) : { kills: {}, weapons: {}, best: { level: 0, score: 0, kills: 0 } };
      // 兼容旧版（wave 字段）
      if (this.data.best && !this.data.best.level && this.data.best.wave) {
        this.data.best.level = this.data.best.wave;
      }
    } catch (e) { this.data = { kills: {}, weapons: {}, best: { level: 0, score: 0, kills: 0 } }; }
    return this.data;
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {}
  },
  reset() {
    this.data = { kills: {}, weapons: {}, best: { level: 0, score: 0, kills: 0 } };
    this.save();
  },
  onKill(id) {
    this.data.kills[id] = (this.data.kills[id] || 0) + 1;
    this.save();
  },
  onWeapon(id) {
    if (!this.data.weapons[id]) { this.data.weapons[id] = true; this.save(); }
  },
  onRunEnd(level, score, kills) {
    const b = this.data.best;
    if (level > (b.level || 0)) b.level = level;
    if (score > b.score) b.score = score;
    if (kills > b.kills) b.kills = kills;
    this.save();
  },
  enemyUnlocked(id) { return (this.data.kills[id] || 0) > 0; },
  weaponUnlocked(id) { return !!this.data.weapons[id]; },
};
