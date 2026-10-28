'use strict';
/* ============================================================
   手持物注册表 (HeldItems, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   手持物的唯一数据源: 部件表 + 握持姿态 + 第一人称姿态(fp 两族常量)
   + 挥击/待机参数。
   两级供给: defs 注册表(个性武器 = 加一份纯数据; 镐/斧/剑/锹四阶
   工具 = mkToolDef 加载期批量生成 16 条, 工厂供单测直调) +
   defFor 惰性出口(运行时一律经此: wall 薄块(火把) → mkTorchDef 细棒
   +炭头, bed 薄块(床) → mkBlockDef 床形装配, 方块 → mkBlockDef 方块本体,
   棒状材料 → mkRodDef, 其余注册
   物品 → mkPlateDef 薄片, 空槽/未注册 → null=空手; MC 口径见
   docs/mc-held-item-render-research.md)。
   外加四个无状态入口: swingPose 第三人称挥击关节角 · swingView 第一
   人称挥击偏移(两支纯函数) · mount 按 def 装配网格 · swap 释放旧
   网格+mount 新 def(第三/第一人称渲染器共用换装生命周期)。fp 姿态
   数值口径见 docs/first-person-hand-design.md D3/D6。
   肢体动画与握持施加收在 Avatar。顶层零 THREE → Node vm
   可直接加载单测; mount()/defFor()/swap() 调用期才触碰 THREE/表依赖。
   依赖: config.js 的 BLOCKS 与 items-core.js 的 ITEMS(均 defFor
   调用期惰性读; 顶层不触碰, 单测 vm 同境先载两件)。
   ============================================================ */

/* 空手等价 def: 未持物时 Avatar 的挥击/待机缺省(形状与 defs 条目一致) */
const HELD_BARE = {
  label: '空手',
  swing: {dur: 0.24, amp: 1.1, curlZ: 0},
  sway: {idle: 0.03},
};

/* 装备动画半程秒数(两层共享, design D6): 第三人称 Avatar 与第一人称
   HandView 的 equip 下沉/抬起同拍——正典 mainHandHeight ±0.4/tick ≈
   0.15s 半程的折算(docs/mc-held-item-render-research.md Q4)。此前
   avatar.js/hand-view.js 各持一份 0.14 靠注释互指, 收口一份防两层漂移。 */
const HELD_EQUIP_HALF = 0.14;

/* ---------- 第一人称姿态两族常量 (fp) — design D3 / 调研 Q4 ----------
   MC 第一人称 display 坍缩为两族(docs/mc-first-person-hand-research.md Q4):
   方块 = block/block.json firstperson_righthand rot[0,45,0]/scale 0.40;
   手持物全族统一 = rot[0,-90,25] + translation[1.13,3.2,1.13]/16 + scale 0.68
   (handheld 镐斧剑锹锄 + generated 食物/材料 + 弓——bow 正典 display 与
   handheld 完全同值=继承)。折算口径: translation 单位 1/16 像素格 →
   本仓库格直接除 16; MC 的 scale 作用在全长 1.0 的模型上, 本仓库部件
   尺寸已自带缩放 → 比例再折算: 方块 def 本体边 0.38(≈正典 0.375–0.40
   终观感已内建, 见 mkBlockDef) → scale 1.0; 工具全长 ~0.85 →
   0.68/0.85 ≈ 0.8。数值=观感折算起点(design D6, 调参不判红),
   不做像素级校真, 形状与族归属正确即可。 */
const FP_BLOCK = {pos: [0, 0, 0], rot: [0, 0.785, 0], scale: 1.0}; /* 45° 绕 Y: 两面示人 */
/* rot 即正典 [-90,25]° 折弧度: 长轴指向画面内 + 斜握 */
const FP_HANDHELD = {pos: [1.13 / 16, 3.2 / 16, 1.13 / 16], rot: [0, -1.5708, 0.4363], scale: 0.8};
/* 族常量 → 条目内嵌副本(工厂展开, 零逐条复制; 拷贝防条目间共享可变别名) */
const fpOf = (F) => ({pos: [...F.pos], rot: [...F.rot], scale: F.scale});

/* swingView 挥击幅度(正典 ITEM_SWING_* 常量, 单位格/弧度, 调研 Q3):
   x −0.4 横扫 · y +0.2 上挑 · z −0.2 前伸 · pitch −80° 劈砍主力 · yaw −20° 摆头;
   基线 amp 1.3(hoe/pick/rod/block 档)对应正典全额 1.0 倍 */
const FP_SWING_AMP_BASE = 1.3;
const FP_SWING = {
  posX: -0.4, posY: 0.2, posZ: -0.2,
  rotX: -80 * Math.PI / 180, rotY: -20 * Math.PI / 180,
};

/* ---------- 工具 def 工厂 (mkToolDef): 镐/斧/剑/锹 × 木/石/铁/钻 ----------
   部件同构 = 木柄 + 工具头(形状按 kind 分四套), 头色按 tier 换材质色板;
   grip/swing 按 kind 分档(剑快阔 · 镐中 · 斧锹沉)。每次调用产出全新对象,
   16 个生成条目与 hoe/sword/bow_item 手工条目同住 defs(工具与 bow_item
   键名与物品 id 逐字一致, 供 Avatar.setItem 直用, 见设计稿 §3.1/D2;
   hoe/sword 是观感族模板——无同名物品, defFor 永不命中)。 */

/* 材质四阶色板: 工具头颜色(工单 T4 / 设计稿 §3.1 抄录) */
const TOOL_HEAD_COLORS = {
  wood: 0x8a5a2b,
  stone: 0x8a8f98,
  iron: 0xd8dde4,
  diamond: 0x4ee1d2,
};

/* 标签用字: 阶名(钻石不带「石」字, 同设计稿 §3.1 name 口径) × 种名 */
const KIND_LABELS = {pick: '镐', axe: '斧', sword: '剑', shovel: '锹'};
const TIER_LABELS = {wood: '木', stone: '石', iron: '铁', diamond: '钻石'};

/* 工具头部件表: 每种一套(c 为该阶材质色; 部件坐标系以握点为原点, -Z 为前) */
const TOOL_HEAD_PARTS = {
  /* 镐: 柄顶横梁 + 左右两端前倾尖 */
  pick: (c) => [
    {w: 0.30, h: 0.06, d: 0.06, color: c, pos: [0, 0.44, 0]},
    {w: 0.08, h: 0.05, d: 0.05, color: c, pos: [-0.16, 0.39, -0.03]},
    {w: 0.08, h: 0.05, d: 0.05, color: c, pos: [0.16, 0.39, -0.03]},
  ],
  /* 斧: 柄顶装颈 + 单侧宽刃(+X 侧, 微前伸) */
  axe: (c) => [
    {w: 0.09, h: 0.15, d: 0.075, color: c, pos: [0, 0.43, 0]},
    {w: 0.06, h: 0.19, d: 0.11, color: c, pos: [0.075, 0.43, -0.02]},
  ],
  /* 剑: 剑柄/柄尾/护手照手工 sword 条目, 仅剑身换材质色 */
  sword: (c) => [
    {w: 0.05, h: 0.24, d: 0.05, color: 0x3a2a1c, pos: [0, 0.06, 0]},
    {w: 0.065, h: 0.05, d: 0.065, color: 0xd9b23c, pos: [0, -0.09, 0]},
    {w: 0.17, h: 0.05, d: 0.06, color: 0x6a6f78, pos: [0, 0.20, 0]},
    {w: 0.055, h: 0.50, d: 0.028, color: c, pos: [0, 0.47, 0]},
  ],
  /* 锹: 柄顶装颈 + 前伸薄铲头 */
  shovel: (c) => [
    {w: 0.075, h: 0.07, d: 0.075, color: c, pos: [0, 0.42, 0]},
    {w: 0.14, h: 0.17, d: 0.05, color: c, pos: [0, 0.44, -0.06]},
  ],
};

/* 握持分档: 剑照手工剑(尖朝前上戒备式), 其余三种与锄头同位。
   前移+前倾统一口径(2026-10-24 用户观感反馈两轮: 前端再前倾 15°),
   工具头端离开小臂, 不贴臂竖立 */
const TOOL_GRIPS = {
  pick: {pos: [0, -0.50, -0.10], rot: [-0.71, 0, 0]},
  axe: {pos: [0, -0.50, -0.10], rot: [-0.71, 0, 0]},
  sword: {pos: [0, -0.50, -0.10], rot: [-0.76, 0, 0]},
  shovel: {pos: [0, -0.50, -0.10], rot: [-0.71, 0, 0]},
};

/* 挥击分档: 剑快而阔(照手工剑) · 镐中(照锄头) · 斧锹更沉(dur 长 amp 收) */
const TOOL_SWINGS = {
  pick: {dur: 0.24, amp: 1.3, curlZ: 0.12},
  axe: {dur: 0.30, amp: 1.1, curlZ: 0.15},
  sword: {dur: 0.20, amp: 1.6, curlZ: 0.05},
  shovel: {dur: 0.28, amp: 1.2, curlZ: 0.10},
};

/* 工具 def 工厂(纯数据): 越界 kind/tier 直接抛错, 不静默产出残缺 def */
const mkToolDef = (kind, tier) => {
  const heads = TOOL_HEAD_PARTS[kind];
  if (!heads || TOOL_HEAD_COLORS[tier] === undefined) {
    throw new Error('mkToolDef: 未知 kind/tier → ' + kind + '/' + tier);
  }
  const grip = TOOL_GRIPS[kind];
  const swing = TOOL_SWINGS[kind];
  return {
    label: TIER_LABELS[tier] + KIND_LABELS[kind],
    parts: [
      {w: 0.055, h: 0.55, d: 0.055, color: 0x8a5a2b, pos: [0, 0.16, 0]}, // 木柄(同锄头)
      ...heads(TOOL_HEAD_COLORS[tier]),
    ],
    grip: {pos: [...grip.pos], rot: [...grip.rot]},
    fp: fpOf(FP_HANDHELD), /* 第一人称: 手持物族(正典 handheld, 工厂展开) */
    swing: {...swing},
    sway: {idle: 0.03},
  };
};

/* 16 个工具 def 一次生成: 键名 kind_tier, 与 items-core 物品 id 逐字一致 */
const TOOL_DEFS = {};
for (const kind of Object.keys(TOOL_HEAD_PARTS)) {
  for (const tier of Object.keys(TOOL_HEAD_COLORS)) {
    TOOL_DEFS[kind + '_' + tier] = mkToolDef(kind, tier);
  }
}

const HELD_DEFS = {
  /* 锄头: 木柄 + 铁箍 + 前伸锄刃, 部件坐标系以握点为原点, -Z 为前 */
  hoe: {
    label: '锄头',
    parts: [
      {w: 0.055, h: 0.55, d: 0.055, color: 0x8a5a2b, pos: [0, 0.16, 0]}, // 木柄
      {w: 0.075, h: 0.07, d: 0.075, color: 0x4a4d52, pos: [0, 0.42, 0]}, // 铁箍
      {w: 0.20, h: 0.045, d: 0.07, color: 0x6a6f78, pos: [0, 0.435, -0.115]}, // 锄刃(前伸)
    ],
    /* 挂在右臂手部枢轴: 手心略前, 柄顶前倾离臂(与 TOOL_GRIPS 同口径) */
    grip: {pos: [0, -0.50, -0.10], rot: [-0.71, 0, 0]},
    fp: fpOf(FP_HANDHELD), /* 第一人称: 手持物族(正典 handheld, 锄无一例外, 调研 Q4) */
    /* 挥击: 0.24 秒内前挥 1.3 rad, 带轻微内收 */
    swing: {dur: 0.24, amp: 1.3, curlZ: 0.12},
    /* 待机呼吸浮动幅度(可调 0 关闭) */
    sway: {idle: 0.03},
  },
  /* 剑: 剑柄 + 金柄尾 + 十字护手 + 上指剑身, 部件坐标系以握点为原点, -Z 为前
     (口径出下界冒险「进下界换剑」——模式已退役, 条目留存为工具剑族模板;
     伤害/触及等战斗政策在模式层, 不进 def) */
  sword: {
    label: '剑',
    parts: [
      {w: 0.05, h: 0.24, d: 0.05, color: 0x3a2a1c, pos: [0, 0.06, 0]}, // 剑柄
      {w: 0.065, h: 0.05, d: 0.065, color: 0xd9b23c, pos: [0, -0.09, 0]}, // 柄尾圆头
      {w: 0.17, h: 0.05, d: 0.06, color: 0x6a6f78, pos: [0, 0.20, 0]}, // 十字护手
      {w: 0.055, h: 0.50, d: 0.028, color: 0xd8dde4, pos: [0, 0.47, 0]}, // 剑身
    ],
    /* 挂在右臂手部枢轴(与锄头同位): 剑尖朝前上, 戒备式前倾离臂 */
    grip: {pos: [0, -0.50, -0.10], rot: [-0.76, 0, 0]},
    fp: fpOf(FP_HANDHELD), /* 第一人称: 手持物族(正典 handheld, 剑同族) */
    /* 挥击: 比锄头更快更阔(剑感) */
    swing: {dur: 0.2, amp: 1.6, curlZ: 0.05},
    /* 待机呼吸浮动幅度 */
    sway: {idle: 0.03},
  },
  /* 弓: MC 正典「16×16 像素图挤出薄片」——vanilla bow.json parent=item/generated
     (1.20.4 一手, docs/mc-held-item-render-research.md Q2: 非方块物品统一为图标
     挤出薄片模型, 弓不是 3D 盒模型); 姿态照抄 thirdperson_righthand
     rotation[-80,260,-40]/scale0.9 的折算(长轴前倾上举、弦面转向身体侧,
     MC 持弓的斜握观感); 贴图走像素图标工坊的 ITEM_PIX.bow_item 字符画
     (art 字段, mount 调用期画布上色), 工坊/画布不可用时回落木色薄板(Node
     单测口径); 键名与物品 id 逐字一致(items-core bow_item, Avatar.setItem
     直用——2026-10-28 弓物品化, 旧键 'bow' 无同名物品已修正)。
     箭矢伤害/弹道等战斗政策在模式层, 不进 def */
  bow_item: {
    label: '弓',
    parts: [
      /* 弓薄片(正反面贴像素图, 侧面木色); 中点即握点——持弓握弓腹中段 */
      {w: 0.62, h: 0.62, d: 0.05, color: 0x8a5a2b, art: 'bow_item', pos: [0, 0.02, 0]},
    ],
    /* 挂在右臂手部枢轴: MC thirdperson 折算([-80,260,-40]°=[-1.40,-1.75,-0.70]rad,
       XYZ 序与 MC display 同构), 与工具组同款前移离臂 */
    grip: {pos: [0, -0.50, -0.10], rot: [-1.40, -1.75, -0.70]},
    /* 第一人称: 手持物族——正典 bow 第一人称 display 与 handheld/generated
       完全同值(等价于继承, mc-first-person-hand-research.md Q4 表) */
    fp: fpOf(FP_HANDHELD),
    /* 挥击=放箭的蓄力前送(幅度接近剑的挥砍, 放箭动作要看得见): 挥臂观感随 def 走 */
    swing: {dur: 0.3, amp: 1.1, curlZ: 0},
    /* 待机呼吸浮动幅度 */
    sway: {idle: 0.03},
  },

  /* 镐/斧/剑/锹 × 木/石/铁/钻 共 16 条: mkToolDef 批量生成(见上方工厂段) */
  ...TOOL_DEFS,
};

/* ---------- 惰性 def 工厂: 方块本体 / 通用薄片 / 棒 (defFor 调用期解析) ----------
   MC 口径(docs/mc-held-item-render-research.md): 方块手持 = 缩小的方块
   本体(block model 单 16³ element, 顶/侧可异色), 非方块物品 = 16×16 贴图
   挤出薄片, 木棍用工具握法(handheld——按用途不按类目)。产物不进 defs:
   defs 仍是手工武器 + 工具的唯一权威, 工厂调用期才读 BLOCKS/ITEMS。 */

/* BLOCKS 的 rgb 三元组(0..1 浮点) → 24 位颜色数 */
const heldHex = (c) =>
  (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);

/* 方块 def 工厂: 单 box 本体(边 0.38 ≈ MC 手持 scale 0.375 的观感)。
   top/side 异色方块(原木/草地/转辙器)在顶/底加端面盖(原木年轮口径):
   盖略宽防共面闪烁, 主体略矮使各面互不共面。grip: 中心在握点前上方,
   与手臂留出间隙不贴臂(2026-10-24 用户观感反馈), 绕 Y 45° 两面示人 +
   后仰让第三人称看到顶面(MC thirdperson rot[75,45,0] 的观感折算, 数值可调)。
   床(bed 旗标, 2026-10-28 床观感票)不走单盒: 床形装配——床垫(毯红)+
   枕头(白, -Z 前端)+床头/床脚板(木色), 白枕红毯木框与 BED_ART/图集床贴图
   同一语言(MC 手持床=缩小床本体的观感折算)。 */
function mkBlockDef(blockId) {
  const b = BLOCKS[blockId];
  if (!b) return null;
  if (b.bed) {
    return {
      label: b.name,
      parts: [
        {w: 0.42, h: 0.18, d: 0.05, color: 0x8a5a2b, pos: [0, 0.15, -0.30]}, // 床头板(前)
        {w: 0.42, h: 0.14, d: 0.05, color: 0x8a5a2b, pos: [0, 0.13, 0.30]}, // 床脚板(后)
        {w: 0.38, h: 0.12, d: 0.62, color: heldHex(b.top), pos: [0, 0.06, 0]}, // 床垫(毯红)
        {w: 0.26, h: 0.06, d: 0.16, color: 0xf4f4f4, pos: [0, 0.15, -0.22]}, // 枕头(白)
      ],
      grip: {pos: [0, -0.42, -0.20], rot: [0.50, 0.785, 0]},
      fp: fpOf(FP_BLOCK), /* 第一人称: 方块族(rotY 45° 两面示人) */
      swing: {dur: 0.24, amp: 1.3, curlZ: 0.12},
      sway: {idle: 0.03},
    };
  }
  const parts = b.side ? [
    {w: 0.38, h: 0.34, d: 0.38, color: heldHex(b.side), pos: [0, 0, 0]},
    {w: 0.40, h: 0.04, d: 0.40, color: heldHex(b.top), pos: [0, 0.17, 0]},
    {w: 0.40, h: 0.04, d: 0.40, color: heldHex(b.bottom || b.top), pos: [0, -0.17, 0]},
  ] : [
    {w: 0.38, h: 0.38, d: 0.38, color: heldHex(b.all), pos: [0, 0, 0]},
  ];
  return {
    label: b.name,
    parts,
    grip: {pos: [0, -0.42, -0.20], rot: [0.50, 0.785, 0]},
    fp: fpOf(FP_BLOCK), /* 第一人称: 方块族(rotY 45° 两面示人) */
    swing: {dur: 0.24, amp: 1.3, curlZ: 0.12},
    sway: {idle: 0.03},
  };
}

/* 通用薄片 def 工厂: MC 非方块物品 = 贴图挤出薄片(item/generated),
   无贴图体系以单色薄板近似(0.30×0.30×0.06)。grip 前伸内倾 = MC
   第一人称 rot[0,-90,25] 的观感折算(长轴指向前); 前移与手臂留出
   间隙不贴臂(2026-10-24 用户观感反馈)。 */
const PLATE_COLORS = {/* 薄片色板(物品→单色; 未登记回落中性灰) */
  apple: 0xd23b2e, bread: 0xc89858, rotten_flesh: 0x9a7048,
  coal: 0x2e2e30, charcoal: 0x3a2c22, iron_ore: 0xd7a878, gold_ore: 0xe8c668,
  iron_ingot: 0xd8dde4, gold_ingot: 0xe8c63e, diamond: 0x4ee1d2,
  bone: 0xe8e4d8, gunpowder: 0x8f9498, string: 0xd8d8d4, slimeball: 0x6fc44a,
  wheat: 0xd4b44a, wheat_seeds: 0x8bb04a, bone_meal: 0xe8e8e0,
  clay_ball: 0xa8845c, brick: 0xb0523e, shears: 0xb8bec6,
};
function mkPlateDef(id) {
  const it = ITEMS[id];
  if (!it) return null;
  return {
    label: it.name,
    parts: [{w: 0.30, h: 0.30, d: 0.06, color: PLATE_COLORS[id] || 0x9aa0a8, pos: [0, 0.12, 0]}],
    grip: {pos: [0, -0.46, -0.18], rot: [-1.13, 0, 0]},
    fp: fpOf(FP_HANDHELD), /* 第一人称: 手持物族(generated 与 handheld 正典同值) */
    swing: {dur: 0.24, amp: 1.1, curlZ: 0},
    sway: {idle: 0.03},
  };
}

/* 棒状材料 def 工厂: 木柄件同款细长棒(vanilla 木棍用 handheld 握法),
   握持与 TOOL_GRIPS 同口径(前移+前倾离臂) */
const ROD_IDS = ['stick'];
function mkRodDef(id) {
  const it = ITEMS[id];
  if (!it) return null;
  return {
    label: it.name,
    parts: [{w: 0.055, h: 0.55, d: 0.055, color: 0x8a5a2b, pos: [0, 0.16, 0]}],
    grip: {pos: [0, -0.50, -0.10], rot: [-0.71, 0, 0]},
    fp: fpOf(FP_HANDHELD), /* 第一人称: 手持物族(vanilla 木棍用 handheld 握法) */
    swing: {dur: 0.24, amp: 1.3, curlZ: 0.12},
    sway: {idle: 0.03},
  };
}

/* 火把 def 工厂: 与世界内 pushTorch 同款专用小盒(MC 2×10×2px 正典, 0.125 断面
   × 0.625 长, mc-torch-model-research §1.2——手持态与世界内共用同一盒模型,
   不再当方块本体画 0.38 小立方): 细棍身 + 顶部炭头(炭头色取 BLOCKS.all 块色
   =单一数据源; 棍身用仓库木色系, 同木棍/工具柄)。非 wall 薄块返回 null,
   defFor 落回 mkBlockDef 方块本体路径。grip/swing 沿木棍 rod 档。 */
function mkTorchDef(blockId) {
  const b = BLOCKS[blockId];
  if (!b || !b.wall) return null;
  return {
    label: b.name,
    parts: [
      {w: 0.125, h: 0.50, d: 0.125, color: 0x8a5a2b, pos: [0, 0.10, 0]}, // 棍身(MC 2×8×2px)
      {w: 0.125, h: 0.125, d: 0.125, color: heldHex(b.all), pos: [0, 0.4125, 0]}, // 炭头(2px, 块 all 色亮端)
    ],
    grip: {pos: [0, -0.50, -0.10], rot: [-0.71, 0, 0]},
    fp: fpOf(FP_HANDHELD), /* 第一人称: 手持物族(正典火把属手持物, 同木棍) */
    swing: {dur: 0.24, amp: 1.3, curlZ: 0.12},
    sway: {idle: 0.03},
  };
}

const HeldItems = {
  defs: HELD_DEFS,
  bare: HELD_BARE,
  equipHalf: HELD_EQUIP_HALF, /* 装备动画半程秒数(Avatar/HandView 两层同拍, design D6) */
  /* 工具 def 工厂: kind×tier → 全新 def。加载期已批量生成 16 条进 defs
     (本入口即那段装配代码的单测直调面), 非运行时按需入口——运行时
     消费方一律读 defs, 不经此现做 */
  mkToolDef,
  /* 惰性 def 工厂(单测直调面, 运行时一律经 defFor): mkBlockDef 收数字
      方块 id, mkTorchDef 收数字方块 id(wall 薄块, 火把), mkRodDef/mkPlateDef
      收物品 id; 越界返回 null 不抛 */
  mkBlockDef, mkTorchDef, mkRodDef, mkPlateDef,

  /* def 惰性出口(Avatar.setItem 的唯一取 def 通道): 工具/武器 → defs ·
      数字方块 id(建造/竞技场调色板直传)或放置型物品 → wall 薄块走
      mkTorchDef(火把细棒+炭头)、其余方块走 mkBlockDef 方块本体 ·
      棒状 → mkRodDef · 其余注册物品 → mkPlateDef · 空槽/未注册 →
      null(空手, MC 口径)。产物缺 fp 时回落手持物族(design D3 兜底:
      未来手滑新增不炸、观感可用; 兜底走浅拷贝, 不改原条目, 有 fp 的
      条目保持原引用恒等)。 */
  defFor(id) {
    if (id == null) return null;
    let def = HELD_DEFS[id] || null;
    if (!def && typeof id === 'number') def = mkTorchDef(id) || mkBlockDef(id);
    if (!def) {
      const it = ITEMS[id];
      if (!it) return null;
      if (it.block != null) def = mkTorchDef(it.block) || mkBlockDef(it.block);
      else if (ROD_IDS.indexOf(id) >= 0) def = mkRodDef(id);
      else def = mkPlateDef(id);
    }
    return def.fp ? def : {...def, fp: fpOf(FP_HANDHELD)};
  },

  /* 挥击关节角(纯函数): p 为 0..1 的挥击进度。
     sin(p·π) 包络 → 端点严格归零, Avatar 以加法式叠加在
     走/跳/飞姿态上, 边界自动连续, 无需混合状态机。 */
  swingPose(p, def) {
    const s = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
    return {x: s * def.swing.amp, z: s * def.swing.curlZ};
  },

  /* 第一人称挥击偏移(纯函数): p 为 0..1 的挥击进度 → {px,py,pz,rx,ry}。
     曲线照正典家族(docs/mc-first-person-hand-research.md Q3): 位移走
     sin(πp) 半波包络(ITEM_SWING_*_POS_SCALE −0.4/+0.2/−0.2, 单位格),
     旋转走 sin(π√p) 先快后慢(ITEM_SWING_*_ROT_AMOUNT −80°/−20°, 劈砍
     主力在 pitch)。正典裸臂路径专属的 sin(2π√p)「先抬后劈」项本仓库
     未采用: 裸臂与持物共用本函数(HandView 同一施加路径)。幅度随
     def.swing.amp 归一(基线 1.3=正典全额)。契约不变量(design D3):
     p=0 与 p=1 全零(端点归零, 与 swingPose 同纪律); 0<p<1 时 px<0
     (横扫前送)。 */
  swingView(p, def) {
    const q = Math.max(0, Math.min(1, p)); /* 钳制越界进度, 端点安全归零 */
    const k = def.swing.amp / FP_SWING_AMP_BASE; /* 幅度归一: 基线档=正典全额 */
    const wave = Math.sin(q * Math.PI); /* sin(πp): 半波包络(位移项) */
    const slash = Math.sin(Math.sqrt(q) * Math.PI); /* sin(π√p): 先快后慢(旋转项) */
    return {
      px: FP_SWING.posX * wave * k,
      py: FP_SWING.posY * wave * k,
      pz: FP_SWING.posZ * wave * k,
      rx: FP_SWING.rotX * slash * k,
      ry: FP_SWING.rotY * slash * k,
    };
  },

  /* 像素贴图薄板材质(art 部件): 图标工坊字符画 → CanvasTexture 关平滑(像素
     风), 只贴 ±Z 两大面(薄板正/背面同图, 背面镜像=MC 挤出薄片同款观感),
     挤出侧面用 color 单色近似; alphaTest 裁透明角(弓弧中空处透出背景)。
     工坊(icons.js 的 ITEM_PIX/drawArt 全局, 加载序在本文件之后)或画布
     不可用 → null(回落纯色薄板, Node 单测口径) */
  mkArtMats(p) {
    if (!p.art || typeof document === 'undefined' || typeof THREE === 'undefined' ||
        typeof ITEM_PIX === 'undefined' || typeof drawArt !== 'function' ||
        !ITEM_PIX[p.art]) return null;
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    drawArt(cv.getContext('2d'), ITEM_PIX[p.art].art, ITEM_PIX[p.art].map);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    const face = new THREE.MeshLambertMaterial({map: tex, alphaTest: 0.5, side: THREE.DoubleSide});
    const edge = new THREE.MeshLambertMaterial({color: p.color});
    return [edge, edge, edge, edge, face, face]; /* BoxGeometry 面序 [+x,-x,+y,-y,+z,-z] */
  },

  /* 按 def 装配手持物网格(仅浏览器: 调用期才触碰 THREE)。
     返回以握点为原点的 Group; 握持姿态(grip)由 Avatar 施加,
     因为那是手臂坐标系的知识。def 为空 → null(空手)。
     part 带 art 字段走 mkArtMats 像素薄片(MC item/generated 正典)。 */
  mount(def) {
    if (!def) return null;
    const g = new THREE.Group();
    for (const p of def.parts) {
      const m = new THREE.Mesh(
          new THREE.BoxGeometry(p.w, p.h, p.d),
          HeldItems.mkArtMats(p) || new THREE.MeshLambertMaterial({color: p.color}));
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
      g.add(m);
    }
    return g;
  },

  /* 换装生命周期收口(design D3): 释放旧网格(traverse 逐 Mesh dispose
     geometry+material, mkArtMats 的材质数组同收) + mount 新 def → 返回
     新 Group|null(def 空=空手 null, 旧组照常释放)。第三人称 Avatar.mountItem
     与第一人称 HandView(T2a)共用同一套「沉底换网格」舞步, 收口一份;
     本票只交付+直测, 消费方接线在 T2a/T3。调用期触碰 THREE(同 mount)。 */
  swap(oldGroup, def) {
    if (oldGroup) {
      oldGroup.traverse((o) => {
        if (!o.isMesh) return;
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m) m.dispose();
      });
    }
    return HeldItems.mount(def);
  },
};
if (typeof module !== 'undefined' && module.exports) module.exports = HeldItems;
