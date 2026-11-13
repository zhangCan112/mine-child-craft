'use strict';
/* ============================================================
   城镇 NPC 模型注册表 (TownNpcRegistry) — 应用层·纯数据注册表
   ------------------------------------------------------------
   一句话职责: 14 实体(V01~V10 十村民 + G01 铁傀儡 + A01~A03 氛围动物)
   模型清单的唯一权威——命名/贴图引用/几何血统/配色出处/站位锚引用/
   交互协议形状预留一处收口, 消费方只派生不复制(不入 MOB_TYPES 战斗
   注册表, 引擎渲染管线由 mob-look-kit 共享)。
   interface: TOWN_NPCS(14 行纯数据, 行键集按 category 恰好定型:
      villager/golem 各 15 键 · animal 12 键, 动物零交互字段) ·
      townNpcRegistry(list?) 纯函数(校验+快照: id/key 唯一·category/
      sessionKind 拼写域·动物必无 sessionKind·look 与锚点在册性·
      tex 声明一致, 违规值进消息构造即抛; 快照=源字段透传+label(name)
      +faceSrc('facePixels'), 同参同输出零副作用)。
   依赖(均经全局名, 调用期解析): MobLookKit(js/mob-look-kit.js 引擎层,
      has(key) look 在册性 + textureBuffer(key) tex 声明一致性) ·
      TOWN_SESSION_KINDS(js/town-interact-core.js 冻结五值) ·
      TOWN_NPC_ANCHORS(js/town-npc-anchor-core.js 站位锚在册性);
      加载序 mob-look-kit → mob-look/town_* → town-interact-core →
      town-npc-anchor-core → 本文件; index.html 挂载归波次二接线票
      (T-NPC-10), 本票 Node 测试经导出守卫直测。
   可测性声明: 零 THREE · 零 DOM · 零墙钟 · 零随机 · 装载零副作用
      (顶层只声明数据与函数, 校验全在调用期, 裸沙盒可安全装载) ·
      有同名单测(test/town-npc-registry.test.js)。
   ============================================================ */

/* ---------- 数据表: 14 行纯数据(命名/贴图基线唯一权威) ----------
   真源对账: name/slug/job=.scratch/town-design/gen/gen-rollout-villagers.js
   的 CAST 表(G01/A01~A03 同理 gen-rollout-golem/gen-rollout-mobs 与
   assets/villagers-mobs 文件名); sessionKind=会话五值定值表(票面钉死);
   paletteRef 指向 gen 色表(CAST/CH_G/CH_A1~A3); devNotes 引 rollout
   notes §3 差异登记 D1-D10; anchorId='npc:'+id 小写(镜像 task: 先例,
   锚点数据唯一权威在 town-npc-anchor-core.js)。贴图基线(PO 采纳):
   村民 64×64 / G01 64×80 / A01 A02 32×32 / A03 48×48。 */
const TOWN_NPCS = [
  {id: 'V01', key: 'town_v01', slug: 'amian', name: '阿面',
    role: '向导型村民 / 面包向导', category: 'villager', geometry: 'illager-base',
    tex: {w: 64, h: 64}, anchorId: 'npc:v01', sessionKind: 'greet',
    expression: {frames: ['default', 'greet', 'focus', 'happy'], greet: 'browlift'},
    accessory: 'basket', postureNote: '挥手迎接',
    paletteRef: 'gen CAST v01', devNotes: 'D5 面包 UV 手排'},
  {id: 'V02', key: 'town_v02', slug: 'maiya', name: '麦芽',
    role: '农夫', category: 'villager', geometry: 'illager-base',
    tex: {w: 64, h: 64}, anchorId: 'npc:v02', sessionKind: 'help',
    expression: {frames: ['default', 'greet', 'focus', 'happy'], greet: 'eyesmile'},
    accessory: 'wheat', postureNote: '俯身查看农田',
    paletteRef: 'gen CAST v02', devNotes: 'D2 草帽檐 UV 出檐 1px 表达'},
  {id: 'V03', key: 'town_v03', slug: 'aqi', name: '石匠阿砌',
    role: '石匠/建筑匠', category: 'villager', geometry: 'illager-base',
    tex: {w: 64, h: 64}, anchorId: 'npc:v03', sessionKind: 'help',
    expression: {frames: ['default', 'greet', 'focus', 'happy'], greet: 'eyesmile'},
    accessory: 'hammer', postureNote: '敲凿修缮广场',
    paletteRef: 'gen CAST v03', devNotes: '无专属 D 条目(袖口点缀按 spec §5.3)'},
  {id: 'V04', key: 'town_v04', slug: 'tutu', name: '图图',
    role: '制图师/图书管理员气质', category: 'villager', geometry: 'illager-base',
    tex: {w: 64, h: 64}, anchorId: 'npc:v04', sessionKind: 'tour',
    expression: {frames: ['default', 'greet', 'focus', 'happy'], greet: 'eyesmile'},
    accessory: 'scrolltube', postureNote: '抬手指路',
    paletteRef: 'gen CAST v04', devNotes: '无专属 D 条目(眉线横条按 spec §6.4)'},
  {id: 'V05', key: 'town_v05', slug: 'luhuo', name: '铁匠炉火',
    role: '护甲/铁匠匠人', category: 'villager', geometry: 'illager-base',
    tex: {w: 64, h: 64}, anchorId: 'npc:v05', sessionKind: 'help',
    expression: {frames: ['default', 'greet', 'focus', 'happy'], greet: 'eyesmile'},
    accessory: 'tongs', postureNote: '抡锤打铁',
    paletteRef: 'gen CAST v05', devNotes: 'D1 领巾画在腰带扣位(侧领三角不可读)'},
  {id: 'V06', key: 'town_v06', slug: 'duoduo', name: '朵朵',
    role: '花匠/摊贩', category: 'villager', geometry: 'illager-base',
    tex: {w: 64, h: 64}, anchorId: 'npc:v06', sessionKind: 'seek',
    expression: {frames: ['default', 'greet', 'focus', 'happy'], greet: 'eyesmile'},
    accessory: 'bouquet', postureNote: '整理花束摊位',
    paletteRef: 'gen CAST v06', devNotes: '无专属 D 条目(花环头饰按 spec 执行)'},
  {id: 'V07', key: 'town_v07', slug: 'lele', name: '小厨乐乐',
    role: '厨师(Lava Chicken 趣味转译)', category: 'villager',
    geometry: 'illager-base', tex: {w: 64, h: 64}, anchorId: 'npc:v07',
    sessionKind: 'greet',
    expression: {frames: ['default', 'greet', 'focus', 'happy'], greet: 'eyesmile'},
    accessory: 'tray', postureNote: '双手端托盘迎客',
    paletteRef: 'gen CAST v07', devNotes: '无专属 D 条目(厨帽压缩内嵌按 §6.6)'},
  {id: 'V08', key: 'town_v08', slug: 'zongshu', name: '钟叔',
    role: '守钟人/长者村民', category: 'villager', geometry: 'illager-base',
    tex: {w: 64, h: 64}, anchorId: 'npc:v08', sessionKind: 'greet',
    expression: {frames: ['default', 'greet', 'focus', 'happy'], greet: 'eyesmile'},
    accessory: 'bell', postureNote: '钟塔值守垂臂',
    paletteRef: 'gen CAST v08', devNotes: 'D4 双手背后改中性垂臂(姿态归动画层)'},
  {id: 'V09', key: 'town_v09', slug: 'doudou', name: '牧童豆豆',
    role: '牧人/动物照看', category: 'villager', geometry: 'illager-base',
    tex: {w: 64, h: 64}, anchorId: 'npc:v09', sessionKind: 'help',
    expression: {frames: ['default', 'greet', 'focus', 'happy'], greet: 'eyesmile'},
    accessory: 'feedbag', postureNote: '围栏边照看',
    paletteRef: 'gen CAST v09', devNotes: '无专属 D 条目(N4 小草帽可选项未做)'},
  {id: 'V10', key: 'town_v10', slug: 'nini', name: '跑跑妮妮',
    role: '孩童气质村民', category: 'villager', geometry: 'illager-base',
    tex: {w: 64, h: 64}, anchorId: 'npc:v10', sessionKind: 'greet',
    expression: {frames: ['default', 'greet', 'focus', 'happy'], greet: 'eyesmile'},
    accessory: 'satchel', postureNote: '原地小跳玩耍',
    paletteRef: 'gen CAST v10', devNotes: 'D3 脸颊提亮=主肤 k 色(不自创提亮色)'},
  {id: 'G01', key: 'town_g01', slug: 'ashou', name: '铁守护·阿稳',
    role: '铁傀儡守卫', category: 'golem', geometry: 'golem-town',
    tex: {w: 64, h: 80}, anchorId: 'npc:g01', sessionKind: 'care',
    crack: {states: ['ok', 'crack1', 'crack2', 'crack3'],
      firstVersion: ['ok', 'crack2']},
    flower: {box: [4, 4, 4], pose: 'reserved'}, postureNote: '广场慢巡逻',
    paletteRef: 'gen CH_G G01', devNotes: 'D9 三状态内嵌单文件分区'},
  {id: 'A01', key: 'town_a01', slug: 'xiaohuaji', name: '小花鸡',
    role: '氛围动物(花鸡)', category: 'animal', geometry: 'a01',
    tex: {w: 32, h: 32}, anchorId: 'npc:a01',
    postureNote: '待机 idle, 啄地 peck',
    paletteRef: 'gen CH_A1 A01', devNotes: 'D7 正面眼贴边 · D10 town_amb_ 前缀'},
  {id: 'A02', key: 'town_a02', slug: 'mimiao', name: '咪喵',
    role: '氛围动物(猫)', category: 'animal', geometry: 'a02',
    tex: {w: 32, h: 32}, anchorId: 'npc:a02',
    postureNote: '坐 sit, 伸懒腰 stretch',
    paletteRef: 'gen CH_A2 A02', devNotes: 'D8 伸懒腰侧视轮廓帧 · D10 前缀'},
  {id: 'A03', key: 'town_a03', slug: 'xiaohetuo', name: '小褐驼',
    role: '氛围动物(褐驼)', category: 'animal', geometry: 'a03',
    tex: {w: 48, h: 48}, anchorId: 'npc:a03',
    postureNote: '站立 idle, 咀嚼 chew',
    paletteRef: 'gen CH_A3 A03', devNotes: 'D7 正面眼贴边 · D10 town_amb_ 前缀'},
];

/* ---------- 注册派生: 校验+快照(纯函数, 镜像 townInteractRegistry) ----------
   全部依赖调用期解析(裸沙盒装载本文件零副作用): MobLookKit·
   TOWN_SESSION_KINDS·TOWN_NPC_ANCHORS 均经全局名在函数体内取。校验即
   拼写域错误(违规值进消息, 构造即抛); 快照每行 = 源字段透传 + label(name,
   TTS 同源) + faceSrc('facePixels', kit 头像裁切供给话 UI Speaker Strip),
   保源序, 不改源清单(同参同输出零副作用)。 */
function townNpcRegistry(list = TOWN_NPCS) {
  const CATEGORIES = ['villager', 'golem', 'animal'];
  const anchorIds = new Set(TOWN_NPC_ANCHORS.map((a) => a.id));
  const seenIds = new Set();
  const seenKeys = new Set();
  const out = [];
  for (const e of list) {
    if (seenIds.has(e.id)) {
      throw new Error('townNpcRegistry: 条目 id 重复「' + e.id + '」(资产 id 空间唯一)');
    }
    seenIds.add(e.id);
    if (seenKeys.has(e.key)) {
      throw new Error('townNpcRegistry: 条目「' + e.id + '」key 重复「' + e.key +
        '」(look 键空间唯一)');
    }
    seenKeys.add(e.key);
    if (!CATEGORIES.includes(e.category)) {
      throw new Error('townNpcRegistry: 条目「' + e.id + '」category 越域「' +
        e.category + '」(合法域 villager|golem|animal)');
    }
    if (e.category === 'animal' && 'sessionKind' in e) {
      throw new Error('townNpcRegistry: 动物条目「' + e.id +
        '」不带 sessionKind(纯氛围非交互, 交互协议只属村民/傀儡)');
    }
    if ('sessionKind' in e && !TOWN_SESSION_KINDS.includes(e.sessionKind)) {
      throw new Error('townNpcRegistry: 条目「' + e.id + '」sessionKind 越域「' +
        e.sessionKind + '」(合法域 greet|tour|seek|help|care)');
    }
    if (!MobLookKit.has(e.key)) {
      throw new Error('townNpcRegistry: 条目「' + e.id + '」key「' + e.key +
        '」无 look 档案(MobLookKit.has 为假, 私生键)');
    }
    if (!anchorIds.has(e.anchorId)) {
      throw new Error('townNpcRegistry: 条目「' + e.id + '」anchorId「' + e.anchorId +
        '」不在 TOWN_NPC_ANCHORS(站位锚在册性)');
    }
    const tex = MobLookKit.textureBuffer(e.key);
    if (tex.w !== e.tex.w || tex.h !== e.tex.h) {
      throw new Error('townNpcRegistry: 条目「' + e.id + '」tex「' + e.tex.w + 'x' +
        e.tex.h + '」与 look 声明「' + tex.w + 'x' + tex.h + '」不一致(基线口径零漂移)');
    }
    out.push(Object.assign({}, e, {label: e.name, faceSrc: 'facePixels'}));
  }
  return out;
}

/* ---------- CommonJS 导出守卫(mob-registry.js 同款): 浏览器经典脚本
    共享词法环境, 顶层 const 即全局, 供消费方直接引用; Node 下仅测试
    消费, 挂 module.exports。 ---------- */
const TownNpcRegistry = {TOWN_NPCS, townNpcRegistry};
if (typeof module !== 'undefined' && module.exports) module.exports = TownNpcRegistry;
