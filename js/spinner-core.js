'use strict';
/* ============================================================
   旋转核心 (SpinnerCore · 术语见 GLOSSARY.md 的"旋转核心") — 引擎层纯核心(有单测)
   ------------------------------------------------------------
   匀速旋转体注册表的纯逻辑(ADR-0011 增补①, PO 亲裁破例件): 镇内场景
   动画的唯一机制件——风车叶片单 mesh 的注册与 tick 策略。注册表条目
   {mesh, axis, period, phase}: mesh 按哑对象约定消费(rotation[axis]
   可写属性——THREE Object3D 天然满足, 单测用哑对象); axis ∈ 'x'|'z'
   (轮面竖直, 无 y); period 秒(≥1s 下限=ADR 口径, 缺省 5=4-6s 设计带
   中点, map-design §5.1)。phase 0..1 绕回, rotation[axis]=phase·2π。
   范围护栏: 只此一件旋转体, **不开通用动画系统**(ADR-0011 增补红线)
   ——无缓动/无插值/无多类型动画注册面, 第二件旋转体须再过 PO。
   interface: SpinnerCore.register/tickSpinners/drain · clampPeriod
   依赖(均经全局名, 调用期解析): 无 — 纯核心, 消费方为 adventure-dims-core
     (townBuild 建场期 register, 建场前 drain 排空旧表)/main.js(帧循环
     tick 一行, 暂停冻结=不喂 dt, 与 fluids/昼夜同口径)
   可测性: 零 THREE·零 DOM·有单测(test/spinner-core.test.js)
   ============================================================ */

/* 周期钳域(ADR 口径 ≥1s): 非有限数回落缺省 5(设计带中点); 低于 1s 钳到
   1(快旋破「祥和无威胁」节奏口径); 无上限(数据钩自担)。 */
function clampPeriod(p) {
  if (!Number.isFinite(p)) return 5;
  return p < 1 ? 1 : p;
}

/* 旋转体注册表(文件内私有, 经 register/tickSpinners/drain 三面消费) */
const spinnerTable = [];

const SpinnerCore = {
  /* 注册: entry {mesh, axis, period?, phase?} —— period 过钳域, phase 初相
     秒(缺省 0), axis 白名单 'x' 其余落 'z'(轮面竖直缺省轴)。返回表长。 */
  register(entry) {
    spinnerTable.push({
      mesh: entry.mesh,
      axis: entry.axis === 'x' ? 'x' : 'z',
      period: clampPeriod(entry.period),
      phase: Number.isFinite(entry.phase) ? entry.phase : 0,
    });
    return spinnerTable.length;
  },
  /* 帧步进: dt 秒——phase 按 period 折算圈数累加(0..1 绕回), 写
     rotation[axis] = phase·2π。暂停冻结归调用方(帧循环不喂 dt 即停)。 */
  tickSpinners(dt) {
    for (const s of spinnerTable) {
      s.phase = (s.phase + dt / s.period) % 1;
      s.mesh.rotation[s.axis] = s.phase * Math.PI * 2;
    }
  },
  /* 清场排空: 返回并清空注册表。条目含 mesh 引用——scene.remove 与
     geometry/material dispose 归调用方(纯核不碰场景对象)。 */
  drain() {
    return spinnerTable.splice(0, spinnerTable.length);
  },
};

/* CJS 导出(测试与 Node 侧装具消费; 浏览器经典 script 走顶层声明全局) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {SpinnerCore, clampPeriod};
}
