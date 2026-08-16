/* ============ 全局配置 ============ */
"use strict";

const CFG = {
  VERSION: "0.4.0",
  TITLE: "孤胆枪手：蜂巢浩劫",

  ARENA: { w: 3200, h: 2000 },      // 战场大小（世界坐标）
  GRID: 80,                          // 地板网格尺寸
  WALL: 26,                          // 边界墙厚度
  WALL_H: 26,                        // 墙体视觉高度（斜视角）

  /* 关卡表：闯关制（count = 本关需击杀的目标数，enemies = 类型权重池）
     怪物会持续从四面八方刷新，直到击杀达标。 */
  LEVELS: [
    { name: "实验室入口",   count: 30,  desc: "殖民地研究中心的入口大厅。异形从四面八方涌入，空气中弥漫着消毒水和血腥味。", enemies: [["drone", 3], ["runner", 1]] },
    { name: "实验室走廊",   count: 45,  desc: "幽长的走廊两侧是破碎的培养槽。异形源源不断地涌出。", enemies: [["drone", 3], ["runner", 2], ["spitter", 1]] },
    { name: "深层实验室",   count: 60,  desc: "向下延伸的深层研究区，警报灯在黑暗中一明一灭。", enemies: [["drone", 3], ["runner", 2], ["spitter", 1], ["boomer", 1]] },
    { name: "冷藏库",       count: 75,  desc: "零下温度也没能阻止它们。冻结的货架上挂满了……不该存在的东西。", enemies: [["drone", 2], ["boomer", 1], ["elite", 1], ["brute", 1]] },
    { name: "孵化室",       count: 80,  boss: "warden", desc: "蜂巢的育儿所。黏稠的卵囊覆盖了整面墙壁——击杀过半后，护卫者将从巢群中现身。", enemies: [["drone", 3], ["runner", 2], ["spitter", 1], ["elite", 1]] },
    { name: "服务器核心",   count: 100, desc: "殖民地 AI 的心脏。异形把这里改造成了它们的数据巢穴，杀之不尽。", enemies: [["runner", 2], ["spitter", 1], ["elite", 1], ["brute", 1], ["boomer", 1]] },
    { name: "巢穴通道",     count: 120, desc: "肉壁覆盖了一切，脚下传来有节奏的搏动。怪物如潮水般涌来。", enemies: [["drone", 2], ["runner", 2], ["spitter", 1], ["elite", 1], ["brute", 1], ["boomer", 1]] },
    { name: "蜂巢核心",     count: 100, boss: "boss", desc: "蜂巢之母盘踞于此。击杀过半后，它将以真身降临——摧毁它，一切就结束了。", enemies: [["drone", 2], ["runner", 2], ["spitter", 1]] },
  ],

  SPAWN_MIN_DIST: 560,   // 出生点离玩家的最小距离

  PLAYER: {
    radius: 12,
    hp: 100,
    speed: 270,
    dashSpeed: 570,
    dashTime: 0.18,
    dashCd: 1.9,
    grenadeCd: 5.0,
    grenadeDmg: 100,
    grenadeRadius: 110,
    invulnTime: 0.4,                 // 受伤后无敌时间
  },

  /* 关卡清除后的补给 */
  LEVEL_CLEAR: {
    healPct: 0.45,                   // 回血比例
    ammoPct: 0.5,                    // 弹药补满比例（剩余缺口的一半）
    scoreBonus: 250,                 // 关卡完成奖励分（随关卡递增）
  },

  // 武器定义：rate 为每秒射击次数；ammo 为上限（Infinity = 无限）
  WEAPONS: {
    pistol:  { name: "双枪", dmg: 9, rate: 4.6, spread: 0.05, pellets: 1, pierce: 0, speed: 950, ammo: Infinity, color: "#ffd166", sound: "shoot", recoil: 1.4, dual: true },
    shotgun: { name: "霰弹枪",   dmg: 7,  rate: 1.7,  spread: 0.34, pellets: 8, pierce: 0, speed: 780,  ammo: 48,   color: "#f77f00", sound: "shotgun", recoil: 3.2 },
    smg:     { name: "冲锋枪",   dmg: 5,  rate: 11.0, spread: 0.10, pellets: 1, pierce: 0, speed: 1000, ammo: 150,  color: "#4cc9f0", sound: "smg",    recoil: 1.0 },
    rifle:   { name: "突击步枪", dmg: 20, rate: 5.6,  spread: 0.05, pellets: 1, pierce: 2, speed: 1080, ammo: 110,  color: "#80ed99", sound: "rifle",   recoil: 2.0 },
    plasma:  { name: "等离子炮", dmg: 40, rate: 1.25, spread: 0.0,  pellets: 1, pierce: 0, speed: 620,  ammo: 26,   color: "#c77dff", sound: "plasma",  recoil: 3.0, aoe: 62 },
    flamer:  { name: "火焰喷射器", dmg: 7, rate: 12,  spread: 0.2,  pellets: 1, pierce: 0, speed: 680,  ammo: 130,  color: "#ff7b00", sound: "flamer",  recoil: 0.6, range: 270, dot: 5, dotTime: 1.1 },
    minigun: { name: "加特林",   dmg: 7,  rate: 15.5, spread: 0.13, pellets: 1, pierce: 0, speed: 1010, ammo: 210,  color: "#f9c74f", sound: "smg",    recoil: 0.55 },
  },

  // 敌人定义（数值为基础值，随关卡缩放）
  ENEMIES: {
    drone:   { name: "工蚁异形",   hp: 26,   speed: 95,  r: 13, dmg: 8,  score: 10, kind: "melee",  attackCd: 1.0, color: "#6c584c", proj: false },
    runner:  { name: "迅捷异形",   hp: 16,   speed: 215, r: 11, dmg: 6,  score: 15, kind: "melee",  attackCd: 0.9, color: "#b5838d", proj: false },
    spitter: { name: "酸液喷射者", hp: 42,   speed: 72,  r: 13, dmg: 10, score: 20, kind: "ranged", attackCd: 1.9, color: "#8ac926", proj: { speed: 250, r: 5, color: "#a3e635" } },
    boomer:  { name: "自爆者",     hp: 30,   speed: 150, r: 12, dmg: 38, score: 18, kind: "boomer", attackCd: 0,   color: "#e9c46a", proj: false, aoe: 95 },
    elite:   { name: "精英猎杀者", hp: 115,  speed: 118, r: 15, dmg: 14, score: 35, kind: "melee",  attackCd: 0.85, color: "#f15bb5", proj: false },
    brute:   { name: "重装异形",   hp: 250,  speed: 52,  r: 20, dmg: 26, score: 45, kind: "melee",  attackCd: 1.4, color: "#9d4edd", proj: false },
    warden:  { name: "孵化护卫",   hp: 1500, speed: 72,  r: 36, dmg: 24, score: 500, kind: "boss", attackCd: 2.6, color: "#b5378c", proj: { speed: 280, r: 6, color: "#ff8ad4" } },
    boss:    { name: "蜂巢之母",   hp: 3200, speed: 48,  r: 46, dmg: 32, score: 1000, kind: "boss", attackCd: 2.8, color: "#e63946", proj: { speed: 300, r: 7, color: "#ff477e" } },
  },

  // 难度倍率
  DIFFICULTY: {
    easy:   { label: "简单", hpMul: 0.75, dmgMul: 0.65, speedMul: 0.95, scoreMul: 1.0, playerRegen: 0.8 },
    normal: { label: "普通", hpMul: 1.0,  dmgMul: 1.0,  speedMul: 1.0,  scoreMul: 1.0, playerRegen: 0.0 },
    hard:   { label: "困难", hpMul: 1.35, dmgMul: 1.3,  speedMul: 1.1,  scoreMul: 1.5, playerRegen: 0.0 },
  },

  // 打怪掉落：弹药与血药不再掉落（补给全靠地图箱子），仅小概率掉手雷
  DROP: { health: 0, ammo: 0, grenade: 0.03 },
};

/* 剧情文本（开场背景故事） */
const STORY_SLIDES = [
  {
    title: "公元 2087 年 · 求救信号",
    body: [
      "人类殖民舰队在深空航行了三十四年后，收到了来自边缘殖民地「盖亚-7」的求救信号。",
      "信号只持续了 47 秒。画面中满是蠕动的巢穴、飞溅的酸液，以及被拖入黑暗的殖民者。",
      "随后，一切归于死寂。",
    ],
  },
  {
    title: "沦陷的殖民地",
    body: [
      "当救援舰队抵达时，盖亚-7 已经沦陷。",
      "一种被命名为「蜂巢」的外星生物以惊人的速度吞噬了一切：它们在地表筑起巨大的肉巢，把整座城市变成了孵化场。",
      "救援队在撤离途中全军覆没，通讯彻底中断。舰队抛下了你，独自逃向深空。",
    ],
  },
  {
    title: "最后的士兵",
    body: [
      "你是舰队中最后一名幸存的士兵。弹射舱把你抛到了殖民地研究中心的废墟外——",
      "身后是燃烧的登陆舰，前方是异形盘踞的实验室群。",
      "没有人会来救你。也没有退路。",
    ],
  },
  {
    title: "任务简报",
    body: [
      "· 深入研究中心，依次通过 8 个区域：入口 → 走廊 → 深层实验室 → 冷藏库 → 孵化室 → 服务器核心 → 巢穴通道 → 蜂巢核心。",
      "· 孵化室与蜂巢核心有首领把守——注意它们的攻击前摇，及时闪避。",
      "· 弹药有限，收集补给，活着抵达核心。摧毁蜂巢之母，任务完成。",
    ],
  },
  {
    title: "最后的话",
    body: [
      "记住，士兵：你只有一条命。",
      "武器会过热，弹药会耗尽，黑暗里永远有新的眼睛睁开。",
      "如果这真的是最后一战——那就让它们记住，人类是怎么死的。",
      "祝你好运。",
    ],
  },
];
