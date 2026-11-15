'use strict';
/* ============================================================
   造型档案 · 玩家 (player) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   小探险家: 官方 8/12/12px 等比人形(基座 humanoid), 身份件全部画进
   皮肤(橙帽/背包/蓝衫/棕色头发, 换自旧 avatar.js 盒子建模的配色锚
   — docs/mob-look-design.md D4)。
   滑翔翼(T-G03 形象层, UI spec v1.2 §6.1 甲案/§6.2): wingL/wingR 语义翼槽
   (axis 'z', dragon 四怪同款), 每翼三盒=骨杆+膜平面盒+翼尖金粒;
   收拢烘焙=过渡姿态(v1.2 §6.2)——骨 rotation 0=收拢竖板(凸出 ≈12px,
   单轴约束组下几何必然), 仅作 0.25s 展/收过渡的起止姿态、静止不可见
   (v1.1 外张预角 ±18° 已随 v1.2 撤销——静止不可见后无观感收益);
   旋 ±90°=水平展平(膜自前缘骨向后铺)。双翼共区镜像(wingR 与 wingL
   同 uv, 贴图单份, dragon 先例)。贴图 128×128 方形档: 膜十字 22×22
   放不进 64 档留白带故升档(五档先例); 既有身份件布局不动(全在 64×64
   区), 翼区画右下留白带。
   消费者: avatar.js 傀儡(−Z) + paper-doll.js 纸娃娃(puppet 共享,
   几何零双份)。基座: humanoid(玩家版 UV 布局) · 无 debris
   interface: declare('player', {...}) — 单一声明, 零其它语句
   依赖: js/mob-look-kit.js(先载)
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('player', {
  base: ['humanoid'],
  bones: {
    /* 滑翔翼翼骨(UI spec v1.2 §6.2 几何表): 枢轴=肩胛上后方(体宽 8px 的 ±3,
       背平面 z=2 外留 1px 转轴隙); 三盒轴向排布=收拢摆位: 骨杆自枢轴
       竖直向下(翼鞘主轴), 膜贴骨杆后侧自枢轴向下、展平后随弦向后铺,
       翼尖粒缀骨杆末梢(展平=翼尖标记)。收拢烘焙仅作 0.25s 展/收过渡的
       起止姿态(v1.2 §6.2: 静止不可见——显隐调度归 Avatar 四态机);
       v1.1 预角 ry=±18° 已随 v1.2 撤销(静止不可见后无观感收益),
       rotation 0 即过渡首/末帧的收拢竖板(凸出 ≈12px 只在过渡帧存在) */
    wingL: {pivot: [3, 26, 3], axis: 'z', add: [
      {origin: [3, 14, 3], size: [1, 12, 1], uv: [68, 68]}, /* 骨杆(展向主骨) */
      {origin: [3, 14, 4], size: [1, 12, 10], uv: [76, 68]}, /* 膜平面盒(弦向贴骨后) */
      {origin: [3, 13, 3], size: [1, 1, 1], uv: [68, 86]}, /* 翼尖金粒 */
    ]},
    wingR: {pivot: [-3, 26, 3], axis: 'z', add: [
      {origin: [-4, 14, 3], size: [1, 12, 1], uv: [68, 68]}, /* 与左翼共区 */
      {origin: [-4, 14, 4], size: [1, 12, 10], uv: [76, 68]}, /* 共区 */
      {origin: [-4, 13, 3], size: [1, 1, 1], uv: [68, 86]}, /* 共区 */
    ]},
  },
  tex: {size: 128, paint: (g, R) => {
    /* 配色锚(旧 avatar.js 延续): 肤/发/帽/衫/裤/鞋/背包/五官 */
    const SKIN = [240, 194, 151]; const HAIR = [90, 58, 34];
    const CAP = [232, 100, 44]; const CAPD = [196, 79, 31];
    const SHIRT = [79, 143, 221]; const PANTS = [46, 74, 143];
    const SHOE = [47, 50, 56]; const BAG = [217, 79, 79]; const STRAP = [138, 50, 50];
    const DARK = [42, 42, 51]; const CHEEK = [245, 160, 140];
    /* 头: 帽两行+檐 · 刘海两行 · 大眼/微笑/红晕(儿童亲和脸) */
    const F = R.head.front;
    g.noise(F, SKIN, 0.04);
    g.fill([F[0], F[1], 8, 1], CAP);
    g.fill([F[0], F[1] + 1, 8, 1], CAPD); /* 帽檐(正面深一档) */
    g.fill([F[0], F[1] + 2, 8, 2], HAIR); /* 刘海 */
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 4, 2, 2], DARK);
    g.px(F[0] + 2, F[1] + 4, [235, 235, 245]); g.px(F[0] + 6, F[1] + 4, [235, 235, 245]); /* 眼高光 */
    g.fill([F[0] + 3, F[1] + 6, 2, 1], DARK); /* 微笑 */
    g.px(F[0], F[1] + 5, CHEEK); g.px(F[0] + 7, F[1] + 5, CHEEK); /* 红晕 */
    g.noise(R.head.top, CAP, 0.05);
    g.noise(R.head.bottom, SKIN, 0.04); g.mul(R.head.bottom, 0.8);
    for (const side of [R.head.left, R.head.right, R.head.back]) {
      g.noise(side, SKIN, 0.04);
      g.fill([side[0], side[1], 8, 2], CAP);
      g.fill([side[0], side[1] + 2, 8, 3], HAIR);
    }
    /* 身: 蓝衫+背带 · 背面红背包+背带横条 */
    const B = R.root.front;
    g.noise(B, SHIRT, 0.05);
    g.fill([B[0] + 3, B[1], 2, 1], SKIN); /* 领口露肤 */
    g.fill([B[0] + 1, B[1], 1, 7], STRAP); g.fill([B[0] + 6, B[1], 1, 7], STRAP);
    const BK = R.root.back;
    g.noise(BK, SHIRT, 0.05);
    g.fill([BK[0], BK[1] + 1, 8, 1], STRAP); /* 背带横条 */
    g.fill([BK[0] + 1, BK[1] + 3, 6, 8], BAG); /* 背包 */
    g.mul([BK[0] + 1, BK[1] + 3, 6, 8], 0.96);
    g.noise(R.root.top, SHIRT, 0.05);
    g.noise(R.root.bottom, PANTS, 0.05); g.mul(R.root.bottom, 0.85);
    for (const side of [R.root.left, R.root.right]) g.noise(side, SHIRT, 0.05);
    /* 臂: 蓝袖五行 + 肤色手七行(顶=袖口, 底=手心) */
    for (const arm of [R.armR, R.armL]) {
      for (const f of ['front', 'back', 'left', 'right']) {
        const r = arm[f];
        g.noise(r, SHIRT, 0.05);
        g.fill([r[0], r[1] + 5, r[2], 7], SKIN);
        g.noise([r[0], r[1] + 5, r[2], 7], SKIN, 0.04);
      }
      g.noise(arm.top, SHIRT, 0.05);
      g.noise(arm.bottom, SKIN, 0.04); g.mul(arm.bottom, 0.85);
    }
    /* 腿: 藏蓝裤八行 + 深灰鞋三行 */
    for (const leg of [R.legR, R.legL]) {
      for (const f of ['front', 'back', 'left', 'right']) {
        const r = leg[f];
        g.noise(r, PANTS, 0.05);
        g.fill([r[0], r[1] + 9, r[2], 3], SHOE);
      }
      g.noise(leg.top, PANTS, 0.05);
      g.fill(leg.bottom, SHOE);
    }
    /* —— 滑翔翼贴图(T-G03 形象层, UI spec §6.3/§5.1): 双翼共区只画
       wingL 系区; 色板五色自持常量与 icons.js ITEM_PIX.glider.map 同值
       同源(测试持独立真值钉两处防漂移)——不能引用其顶层常量: icons.js
       装载序(index.html:381)晚于 avatar.js(:326), avatar 载入即建傀儡
       触发 paint, 引用必 ReferenceError(boot 炸) —— */
    const WG_GOLD = [233, 177, 21]; /* 金骨主 #e9b115: 骨杆/辐条/前缘描边 */
    const WG_GOLD_L = [253, 255, 118]; /* 金高光 #fdff76: 翼尖粒 */
    const WG_MEMB_L = [208, 138, 90]; /* 膜亮缘 #d08a5a: 邻骨受光边 */
    const WG_MEMB = [176, 85, 58]; /* 膜主 #b0553a: 暖红棕膜身 */
    const WG_FOLD = [138, 64, 40]; /* 暗折线 #8a4028: 近后缘褶皱暗示 */
    g.noiseAll(R.wingL, WG_GOLD, 0.04); /* 骨杆: 金骨主轻噪底(展平=前缘金脊) */
    g.noiseAll(R.wingL3, WG_GOLD_L, 0.04); /* 翼尖粒: 金高光点缀(§6.2) */
    g.noiseAll(R.wingL2, WG_MEMB, 0.05); /* 膜身六面噪底打底 */
    /* 膜左右大面(弦向×展向, 平面盒可见主面): 前缘金骨描边 + 邻骨亮缘 +
       翼根扇开金辐条 + 近后缘暗折线; right 面 u 镜像(flip)左右对称画。
       面内定向(kit asSeen, 傀儡不镜像): 画布顶行=翼根(枢轴端),
       left 面首列=前缘骨侧, right 面镜像取 xAt() 折算 */
    for (const side of [['left', false], ['right', true]]) {
      const m = R.wingL2[side[0]]; const flip = side[1];
      const xAt = (x) => m[0] + (flip ? m[2] - 1 - x : x);
      g.fill([xAt(0), m[1], 1, m[3]], WG_GOLD); /* 前缘金骨描边 */
      g.fill([xAt(1), m[1], 1, m[3]], WG_MEMB_L); /* 前缘邻骨受光亮缘 */
      g.fill([xAt(m[2] - 2), m[1], 1, m[3]], WG_FOLD); /* 近后缘暗折线 */
      /* 金辐条 3 根: 自翼根(顶行)向翼缘扇开(§6.3, dragon 辐条同源) */
      for (const rib of [[5, 11], [7, 7], [8, 3]]) {
        const steps = Math.max(rib[0] - 2, rib[1] - 1);
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          g.px(xAt(Math.round(2 + (rib[0] - 2) * t)),
              m[1] + Math.round(1 + (rib[1] - 1) * t), WG_GOLD);
        }
      }
    }
    /* 膜顶/底窄边(弦向 1×10, 展平=翼前后缘): 首行金脊 + 次行亮缘 +
       末行暗折线(两面前后缘语言一致) */
    for (const f of ['top', 'bottom']) {
      const s = R.wingL2[f];
      g.fill([s[0], s[1], s[2], 1], WG_GOLD);
      g.fill([s[0], s[1] + 1, s[2], 1], WG_MEMB_L);
      g.fill([s[0], s[1] + s[3] - 1, s[2], 1], WG_FOLD);
    }
  }},
});
