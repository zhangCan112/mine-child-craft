'use strict';
/* ============================================================
   Robot Commander Levels (怪物指挥官关卡库, 术语见 GLOSSARY.md) — 库层(数据+纯函数)
   ------------------------------------------------------------
   一句话职责: 怪物指挥官关卡数值的唯一权威——怪物包元数据、存档默认值
   与迁移; 关卡编排/难度曲线/三星与战利品掷骰随 T3 票在本文件续建
   (docs/robot-program-design.md §4/§8)。
   interface: ROBOT_PACKS · ROBOT_SAVE_VERSION · ROBOT_SAVE_DEFAULTS ·
     migrateRobotSave(s, from)
   依赖(均经全局名, 调用期解析): 无(纯数据+纯函数, Node 可直接加载)
   可测性: 零 THREE·零 DOM; 单测随 T3 票落 test/robot-levels.test.js
   ============================================================ */

/* ---------- 怪物包(设计稿 §3.2: Robot Turtles 解锁制, 每包只教一个新语义) ----------
   mob = 怪物库 MOB_TYPES 键(本包主角怪); skill = 特技卡语义键(核心模拟器
   stepSim 的意图分支, T2 落地); relay 包无双怪主角——带3 双怪接力由关卡
   params 声明两只怪(铁傀儡 A 段/苦力怕 B 段), 不在此复制怪键 */
const ROBOT_PACKS = [
  {key: 'creeper', mob: 'creeper', name: '找朋友', skill: 'boom', skillName: '炸开'},
  {key: 'golem', mob: 'golem', name: '送快递', skill: 'smash', skillName: '砸碎'},
  {key: 'spider', mob: 'spider', name: '过河', skill: 'climb', skillName: '爬墙'},
  {key: 'chicken', mob: 'chicken', name: '缓降', skill: 'glide', skillName: '滑翔'},
  {key: 'relay', mob: null, name: '大护送', skill: null, skillName: null},
];

/* ---------- 存档(家族键名 robot_camp_save, SyncDB.slot 经壳骨架收编) ----------
   形状对齐 math_camp_save 家族(设计稿 §8): stars 关号→星数; stamps/log 按
   日期记账滚动 90 天(裁剪随 T5 落账点续建); v 版本位——关号语义变化时
   一次性清空进度三表, stamps/log 不受影响 */
const ROBOT_SAVE_VERSION = 1;
const ROBOT_SAVE_DEFAULTS = {v: ROBOT_SAVE_VERSION, stars: {},
  stamps: {}, stampClaimed: [], stampKind: 'gem', log: {}};

/* 存档迁移(save-slot 的 migrate 链调用, (s, from) 两参): v=1 首版无历史档,
   只做幂等修形——字段缺/损坏补空, 存量进度原样保留 */
function migrateRobotSave(s, from) {
  if (!s || typeof s !== 'object') return {...ROBOT_SAVE_DEFAULTS};
  s.v = ROBOT_SAVE_VERSION;
  for (const k of ['stars', 'stamps', 'log']) {
    if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  }
  if (!Array.isArray(s.stampClaimed)) s.stampClaimed = [];
  if (typeof s.stampKind !== 'string') s.stampKind = 'gem';
  return s;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {ROBOT_PACKS, ROBOT_SAVE_VERSION, ROBOT_SAVE_DEFAULTS, migrateRobotSave};
}
