"use strict";
/* ============================================================
   专注训练营 — 维度定义 / 难度参数表 / 100 关生成器

   科学依据(见 MISSION.md 与设计共识):
   - 持续警觉=CPT 警觉范式 · 抑制控制=Go/No-Go · 干扰控制=Flanker
   - 视空记忆=Corsi 方块(6岁常模 3~5) · 规则切换=任务切换
   - 每关只动一个难度维度(Davidson 2006: 2 规则可, 6 规则崩)
   - 复习/交错编排 = 间隔效应+交错练习(Cepeda 2006; Klimovich 2025)
============================================================ */

const FOCUS_DIMS = ['cpt', 'gonogo', 'flanker', 'corsi', 'switch'];   // 阶段顺序
const mcIco = n => '<img class="f-mcicon" draggable="false" src="' + mcIcon(n) + '">';
const FOCUS_META = {
  cpt:    {name:'持续警觉', game:'矿洞瞭望塔',   icon: mcIco('torch'),
           rule:'看到钻石，快点点它！别的矿不要点。',
           tip(p){ return p.similar ? '小心！绿宝石长得像钻石，看清楚了再点！'
             : '矿灯闪得' + (p.isi < 1150 ? '很快' : '比较快') + '，钻石出现得不多，眼睛要一直盯着。'; }},
  gonogo: {name:'抑制控制', game:'挖矿小能手',   icon: mcIco('pickaxe'),
           rule:'钻石快挖！TNT 千万不要碰。',
           tip(p){ return p.disguised ? 'TNT 会变成绿宝石的样子混进来！手别太快，看清楚再挖。'
             : '钻石变少、TNT 变多了，忍住不碰 TNT 才能拿星星。'; }},
  flanker:{name:'干扰控制', game:'苦力怕排队',   icon: '<img class="f-mcicon" draggable="false" src="'+creeperFace(1)+'">',
           rule:'只看中间那只苦力怕，它看哪边，就点哪边。',
           tip(p){ return '队伍变成 ' + p.len + ' 只，两边捣乱的苦力怕' + (p.congruentRate < 0.6 ? '很多' : '不少') + '。记住：只看中间那只！'; }},
  corsi:  {name:'视空记忆', game:'钻石闪闪光',   icon: mcIco('diamond'),
           rule:'看清楚钻石亮的顺序，再按一样的顺序点回去。',
           tip(p){ return '要记住 ' + p.len + ' 个钻石亮的顺序' + (p.grid===16 ? '，格子也变成 4×4 了' : '') + '。'; }},
  switch: {name:'规则切换', game:'听指挥的小矿工', icon: mcIco('flag'),
           rule:'看旗子！按旗子说的采方块，旗子变了就换方法。',
           tip(p){ return (p.rules===3 ? '现在有三种旗子：颜色、材质、大小。' : '两种旗子：颜色和材质。')
             + '旗子大约每 ' + p.switchEvery + ' 次换一次，盯紧旗子！'; }}
};

function fLerp(a, b, t){ return a + (b-a)*t; }

/* 各范式难度参数: tier 1..19 (关卡在阶段内的档位, 教学关固定 tier 1)
   时间类参数会被关内阶梯微调(calib)缩放 —— 时间放宽=更简单 */
function paramsFor(dim, tier){
  const t = Math.min(1, Math.max(0, (tier-1)/18));      // 0..1 归一
  switch(dim){
    case 'cpt':                                         // 警觉:更快+目标更少+干扰更相似
      return {
        trials: Math.round(fLerp(16, 28, t)),
        isi:    Math.round(fLerp(1500, 950, t)),        // 间隔
        dur:    Math.round(fLerp(1000, 800, t)),        // 呈现时长(calib 杠杆)
        targetRate: fLerp(0.55, 0.3, t),
        similar: tier >= 10                             // 加入💎的高相似干扰💠
      };
    case 'gonogo':                                      // 抑制:Go 更少+伪装+更快
      return {
        trials: Math.round(fLerp(16, 28, t)),
        dur:    Math.round(fLerp(1100, 750, t)),        // (calib 杠杆)
        goRate: fLerp(0.75, 0.55, t),
        disguised: tier >= 8                            // No-Go 用💠伪装
      };
    case 'flanker':                                     // 干扰:不一致更多+排更长+窗口更短
      return {
        trials: Math.round(fLerp(14, 22, t)),
        len:    t < 0.4 ? 3 : (t < 0.75 ? 5 : 7),
        congruentRate: fLerp(0.8, 0.45, t),
        window: Math.round(fLerp(2600, 1900, t))        // (calib 杠杆)
      };
    case 'corsi':                                       // 记忆:序列更长+格阵更大+节奏更快
      return {
        seqs: 6,
        grid: tier >= 12 ? 16 : 9,
        len:  Math.min(6, 2 + Math.floor(tier/4)),      // 6 岁常模 3~5,顶格 6
        pace: Math.round(fLerp(850, 600, t))            // (calib 杠杆)
      };
    case 'switch':                                      // 切换:规则更多+切换更频繁
      return {
        trials: Math.round(fLerp(14, 22, t)),
        rules: tier < 6 ? 2 : 3,                        // 颜色/形状 (+大小)
        switchEvery: Math.round(fLerp(5, 2, t)),
        choices: 4
      };
  }
}

/* ---------- 100 关编排 (螺旋轮换制) ----------
   - 第 1~5 关: 五个游戏的入门教学关 (从第一关就换着玩)
   - 第 6~99 关: 每 5 关一轮, 五个游戏轮换出现, 难度档随轮次递进
     (交错练习+间隔复习合一: Klimovich 2025; Cepeda 2006)
   - 第 100 关: 五维大师考验
   - 特殊变体随难度档自然出现: 规则切换 3 旗(tier≥6≈L28) · TNT 伪装(tier≥8≈L40)
     · 假钻石(tier≥10≈L50) · 记忆 4×4(tier≥12≈L60)                              */
const FOCUS_LEVELS = [];
(function generateFocusLevels(){
  for(let i=0; i<100; i++){
    let dim, kind = 'normal', tier;
    if(i < 5){                                        // 五个教学关
      dim = FOCUS_DIMS[i];
      kind = 'tutorial';
      tier = 1;
    } else if(i === 99){                              // 大师考验
      dim = FOCUS_DIMS[4];
      kind = 'master';
      tier = 19;
    } else {                                          // 螺旋轮换
      const k = i - 5;
      dim = FOCUS_DIMS[k % 5];
      tier = Math.min(19, 2 + Math.floor(k / 5));
    }
    FOCUS_LEVELS.push({ i, stage: Math.floor(i/5)+1, dim, kind, tier, params: paramsFor(dim, tier) });
  }
  // 大师关: 五维连续小节(各 tier 8 难度)
  FOCUS_LEVELS[99].sections = FOCUS_DIMS.map(d => ({dim:d, params: paramsFor(d, 8)}));
})();
