'use strict';
/* ============================================================
   造型档案 · 氛围动物 A03 小褐驼 (town_a03) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   小褐驼(Llama, Ambient): 自有骨(§5.3: 体 8×7×12/颈 3×7×3 竖直/头 4×4×6/
   腿 2×9×2 ×4/耳 1×1×1 ×2 耳内红背视), 画布 48×48(体盒 40 宽超 32)。
   姿态语义(供动画层选型票检索): 站立/咀嚼(gen §5.3) — 本批中性 bind(裁决二)。
   贴图非手绘: gen 批产字符行面图经一次性导出器烘焙为下方字面量, blit 语义
   等价移植(拉伸 out[r][c]=in[⌊r·inH/outH⌋][⌊c·inW/outW⌋]; 只用 g.px 确定性)。
   UV: 沿 gen boxUV 坐标系(与 kit faceRects 公式同构), 像素内容逐纹素等值。
   像素真源: .scratch/town-design/gen/gen-rollout-mobs.js(A3 表+CH_A3)
   复跑导出命令: node .scratch/town-design/gen/gen-export-look.js
   interface: declare('town_a03', {...}) — 单一声明(键=文件名)
   依赖: js/mob-look-kit.js(先载); 不入 mob-registry(镇民注册表归 T-NPC-03)
   可测性声明: 纯声明数据 — test/town-npc-look.test.js golden 逐面对账 +
     mob-look.test.js 全键循环(覆盖/布局/UV 落点/确定性)
   ============================================================ */
MobLookKit.declare('town_a03', {
  debris: 0xc8a97e, /* A03 米褐体主色 #C8A97E(CH_A3.c, 碎块色=体主色) */
  bones: {
    /* 自有骨(§5.3; 骨名沿 quad 惯例, 耳并入 head 追加盒随头动) */
    head: {pivot: [0, 27, 0], add: [
      {origin: [-2, 23, -8], size: [4, 4, 6], uv: [12, 19]},
      {origin: [-2.25, 26.5, -3.25], size: [1, 1, 1], uv: [40, 19]}, /* 耳 ×2 共区; 后缘凸出头背 0.25(耳内红背视可见) */
      {origin: [1.25, 26.5, -3.25], size: [1, 1, 1], uv: [40, 19]},
    ]},
    neck: {pivot: [0, 23, -6], add: [
      {origin: [-1.5, 16, -7.5], size: [3, 7, 3], uv: [0, 19]}, /* 竖直 y16~23 */
    ]},
    root: {pivot: [0, 12.5, 0], add: [
      {origin: [-4, 9, -6], size: [8, 7, 12], uv: [0, 0]}, /* 体 y9~16 */
    ]},
    legR: {pivot: [-3, 9, 0], add: [
      {origin: [-4, 0, -4.5], size: [2, 9, 2], uv: [32, 19]},
      {origin: [-4, 0, 2.5], size: [2, 9, 2], uv: [32, 19]}, /* 前后各一, ×4 共区 */
    ]},
    legL: {pivot: [3, 9, 0], add: [
      {origin: [2, 0, -4.5], size: [2, 9, 2], uv: [32, 19]},
      {origin: [2, 0, 2.5], size: [2, 9, 2], uv: [32, 19]},
    ]},
  },
  tex: {w: 48, h: 48, paint: (g, R) => {
    /* town_a03 色表(gen CH 全键烘焙, hex→[r,g,b]) */
    const RGB = {
      c: [200, 169, 126], f: [232, 216, 181], r: [217, 107, 82], e: [47, 93, 80],
      k: [90, 70, 54],
    };
    /* gen 字符行面图(烘焙字面量; 行序=模型 y 高→低, '.'=透跳) */
    const MAPS = {
      bodyFront: [
        'kkkkkkkk',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
      ],
      bodyBack: [
        'kkkkkkkk',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
      ],
      bodySide: [
        'kkkkkkkkkkkk',
        'cccccccccccc',
        'cccccccccccc',
        'cccccccccccc',
        'cccccccccccc',
        'cccccccccccc',
        'cccccccccccc',
      ],
      bodyTop: [
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
      ],
      bodyBot: [
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
        'cccccccc',
      ],
      neckFront: [
        'ccc',
        'ccc',
        'ccc',
        'ccc',
        'ccc',
        'ccc',
        'ccc',
      ],
      neckBack: [
        'ccc',
        'ccc',
        'ccc',
        'ccc',
        'ccc',
        'ccc',
        'ccc',
      ],
      neckSide: [
        'ccc',
        'ccc',
        'ccc',
        'ccc',
        'ccc',
        'ccc',
        'ccc',
      ],
      neckTop: [
        'ccc',
        'ccc',
        'ccc',
      ],
      neckBot: [
        'ccc',
        'ccc',
        'ccc',
      ],
      headFront: [
        'ffff',
        'effe',
        'effe',
        'ffff',
      ],
      headBack: [
        'cccc',
        'cccc',
        'cccc',
        'cccc',
      ],
      headSide: [
        'ffffff',
        'eeffff',
        'eeffff',
        'ffffff',
      ],
      headTop: [
        'ffff',
        'ffff',
        'ffff',
        'ffff',
        'ffff',
        'ffff',
      ],
      headBot: [
        'cccc',
        'cccc',
        'cccc',
        'cccc',
        'cccc',
        'cccc',
      ],
      earFront: [
        'c',
      ],
      earSide: [
        'c',
      ],
      earTop: [
        'c',
      ],
      earBack: [
        'r',
      ],
      legFront: [
        'cc',
        'cc',
        'cc',
        'cc',
        'cc',
        'cc',
        'cc',
        'cc',
        'kk',
      ],
      legSide: [
        'cc',
        'cc',
        'cc',
        'cc',
        'cc',
        'cc',
        'cc',
        'cc',
        'kk',
      ],
      legTop: [
        'cc',
        'cc',
      ],
      legBot: [
        'kk',
        'kk',
      ],
    };
    /* gen 层 blit 语义等价移植(未知字符即抛错; 拉伸规则见文件头) */
    const blit = (map, rect) => {
      const inH = map.length; const inW = map[0].length;
      for (let r = 0; r < rect[3]; r++) {
        const row = map[Math.floor(r * inH / rect[3])];
        for (let c = 0; c < rect[2]; c++) {
          const ch = row[Math.floor(c * inW / rect[2])];
          if (ch === '.') continue;
          const col = RGB[ch];
          if (!col) throw new Error('未知色字符: ' + ch);
          g.px(rect[0] + c, rect[1] + r, col);
        }
      }
    };
    /* 体(root 8×7×12): 米褐大色块+背缘线 */
    blit(MAPS.bodyFront, R.root.front);
    blit(MAPS.bodyBack, R.root.back);
    blit(MAPS.bodySide, R.root.left);
    blit(MAPS.bodySide, R.root.right);
    blit(MAPS.bodyTop, R.root.top);
    blit(MAPS.bodyBot, R.root.bottom);
    /* 颈(neck 3×7×3): 竖直(斜置由视图层表达) */
    blit(MAPS.neckFront, R.neck.front);
    blit(MAPS.neckBack, R.neck.back);
    blit(MAPS.neckSide, R.neck.left);
    blit(MAPS.neckSide, R.neck.right);
    blit(MAPS.neckTop, R.neck.top);
    blit(MAPS.neckBot, R.neck.bottom);
    /* 头(head 4×4×6): 脸面 f 浅/正面眼贴边 1×2/侧眼 2×2 */
    blit(MAPS.headFront, R.head.front);
    blit(MAPS.headBack, R.head.back);
    blit(MAPS.headSide, R.head.left);
    blit(MAPS.headSide, R.head.right);
    blit(MAPS.headTop, R.head.top);
    blit(MAPS.headBot, R.head.bottom);
    /* 耳(head2/head3 1×1×1 ×2 共区): 背面纹素=耳内红 #D96B52(§4.4 抽查件) */
    blit(MAPS.earFront, R.head2.front);
    blit(MAPS.earBack, R.head2.back);
    blit(MAPS.earSide, R.head2.left);
    blit(MAPS.earSide, R.head2.right);
    blit(MAPS.earTop, R.head2.top);
    blit(MAPS.earTop, R.head2.bottom);
    blit(MAPS.earFront, R.head3.front);
    blit(MAPS.earBack, R.head3.back);
    blit(MAPS.earSide, R.head3.left);
    blit(MAPS.earSide, R.head3.right);
    blit(MAPS.earTop, R.head3.top);
    blit(MAPS.earTop, R.head3.bottom);
    /* 腿(legR/legL 各×2 共区 2×9×2): 蹄 1px #5A4636 */
    blit(MAPS.legFront, R.legR.front);
    blit(MAPS.legFront, R.legR.back);
    blit(MAPS.legSide, R.legR.left);
    blit(MAPS.legSide, R.legR.right);
    blit(MAPS.legTop, R.legR.top);
    blit(MAPS.legBot, R.legR.bottom);
    blit(MAPS.legFront, R.legR2.front);
    blit(MAPS.legFront, R.legR2.back);
    blit(MAPS.legSide, R.legR2.left);
    blit(MAPS.legSide, R.legR2.right);
    blit(MAPS.legTop, R.legR2.top);
    blit(MAPS.legBot, R.legR2.bottom);
    blit(MAPS.legFront, R.legL.front);
    blit(MAPS.legFront, R.legL.back);
    blit(MAPS.legSide, R.legL.left);
    blit(MAPS.legSide, R.legL.right);
    blit(MAPS.legTop, R.legL.top);
    blit(MAPS.legBot, R.legL.bottom);
    blit(MAPS.legFront, R.legL2.front);
    blit(MAPS.legFront, R.legL2.back);
    blit(MAPS.legSide, R.legL2.left);
    blit(MAPS.legSide, R.legL2.right);
    blit(MAPS.legTop, R.legL2.top);
    blit(MAPS.legBot, R.legL2.bottom);
  }},
});
