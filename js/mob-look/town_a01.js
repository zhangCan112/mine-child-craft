'use strict';
/* ============================================================
   造型档案 · 氛围动物 A01 小花鸡 (town_a01) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   小花鸡(Chicken, Ambient): 自有骨(§5.3: 头 4×5×4+冠 2×1×2 上突+喙 2×1×2
   前突/体 6×6×8/尾 2×2×1 上翘/腿 1×3×1 ×2), 画布 32×32。
   姿态语义(供动画层选型票检索): 待机/啄地(gen §5.3) — 本批中性 bind(裁决二)。
   贴图非手绘: gen 批产字符行面图经一次性导出器烘焙为下方字面量, blit 语义
   等价移植(拉伸 out[r][c]=in[⌊r·inH/outH⌋][⌊c·inW/outW⌋]; 只用 g.px 确定性)。
   UV: 沿 gen boxUV 坐标系(与 kit faceRects 公式同构), 像素内容逐纹素等值。
   像素真源: .scratch/town-design/gen/gen-rollout-mobs.js(A1 表+CH_A1)
   复跑导出命令: node .scratch/town-design/gen/gen-export-look.js
   interface: declare('town_a01', {...}) — 单一声明(键=文件名)
   依赖: js/mob-look-kit.js(先载); 不入 mob-registry(镇民注册表归 T-NPC-03)
   可测性声明: 纯声明数据 — test/town-npc-look.test.js golden 逐面对账 +
     mob-look.test.js 全键循环(覆盖/布局/UV 落点/确定性)
   ============================================================ */
MobLookKit.declare('town_a01', {
  debris: 0xe6c35c, /* A01 体羽主色 #E6C35C(CH_A1.Y, 碎块色=体主色) */
  bones: {
    /* 自有骨(§5.3; 骨名沿 quad 惯例, 冠/喙并入 head 追加盒随头动) */
    head: {pivot: [0, 9, 0], add: [
      {origin: [-2, 9, -8], size: [4, 5, 4], uv: [0, 0]},
      {origin: [-1, 13.75, -6.75], size: [2, 1, 2], uv: [16, 0]}, /* 冠上突; 底面嵌入 0.25 防共面 */
      {origin: [-1, 10, -9], size: [2, 1, 2], uv: [24, 0]}, /* 喙前突 1px */
    ]},
    root: {pivot: [0, 6, 0], add: [
      {origin: [-3, 3, -4], size: [6, 6, 8], uv: [0, 9]}, /* 体 y3~9, 腿 y0~3 */
    ]},
    tail: {pivot: [0, 10, 4.5], add: [
      {origin: [-1, 9, 4], size: [2, 2, 1], uv: [0, 23]}, /* 体后缘上翘 */
    ]},
    legR: {pivot: [-1.5, 3, 0], add: [
      {origin: [-2, 0, -0.5], size: [1, 3, 1], uv: [8, 23]}, /* 落地 y0 */
    ]},
    legL: {pivot: [1.5, 3, 0], add: [
      {origin: [1, 0, -0.5], size: [1, 3, 1], uv: [8, 23]}, /* 共区 mirror */
    ]},
  },
  tex: {w: 32, h: 32, paint: (g, R) => {
    /* town_a01 色表(gen CH 全键烘焙, hex→[r,g,b]) */
    const RGB = {
      Y: [230, 195, 92], G: [217, 164, 65], R: [217, 107, 82], E: [47, 93, 80],
      k: [90, 70, 54],
    };
    /* gen 字符行面图(烘焙字面量; 行序=模型 y 高→低, '.'=透跳) */
    const MAPS = {
      headFront: [
        'YYYY',
        'EYYE',
        'EYYE',
        'YYYY',
        'YYYY',
      ],
      headBack: [
        'YYYY',
        'YYYY',
        'YYYY',
        'YYYY',
        'YYYY',
      ],
      headSide: [
        'YYYY',
        'YEEY',
        'YEEY',
        'YYYY',
        'YYYY',
      ],
      headTop: [
        'YYYY',
        'YYYY',
        'YYYY',
        'YYYY',
      ],
      headBot: [
        'YYYY',
        'YYYY',
        'YYYY',
        'YYYY',
      ],
      combFront: [
        'RR',
      ],
      combSide: [
        'RR',
      ],
      combTop: [
        'RR',
        'RR',
      ],
      beakFront: [
        'GG',
      ],
      beakSide: [
        'GG',
      ],
      beakTop: [
        'GG',
        'GG',
      ],
      bodyFront: [
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
      ],
      bodyBack: [
        'kkkkkk',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
      ],
      bodySide: [
        'kkkkkkkk',
        'YYYYYYYY',
        'YYYYYYYY',
        'YYkkkkYY',
        'YYYYYYYY',
        'YYYYYYYY',
      ],
      bodyTop: [
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
      ],
      bodyBot: [
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
        'YYYYYY',
      ],
      tailFront: [
        'YY',
        'YG',
      ],
      tailSide: [
        'Y',
        'G',
      ],
      tailTop: [
        'YY',
      ],
      legFront: [
        'G',
        'G',
        'G',
      ],
      legSide: [
        'G',
        'G',
        'G',
      ],
      legTop: [
        'G',
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
    /* 头(head 4×5×4): 正面眼贴边 1×2(MC 鸟惯例, D7 远景豁免)/侧面眼 2×2 */
    blit(MAPS.headFront, R.head.front);
    blit(MAPS.headBack, R.head.back);
    blit(MAPS.headSide, R.head.left);
    blit(MAPS.headSide, R.head.right);
    blit(MAPS.headTop, R.head.top);
    blit(MAPS.headBot, R.head.bottom);
    /* 冠(head2 2×1×2): #D96B52 上突件 */
    blit(MAPS.combFront, R.head2.front);
    blit(MAPS.combFront, R.head2.back);
    blit(MAPS.combSide, R.head2.left);
    blit(MAPS.combSide, R.head2.right);
    blit(MAPS.combTop, R.head2.top);
    blit(MAPS.combTop, R.head2.bottom);
    /* 喙(head3 2×1×2): #D9A441 前突件 */
    blit(MAPS.beakFront, R.head3.front);
    blit(MAPS.beakFront, R.head3.back);
    blit(MAPS.beakSide, R.head3.left);
    blit(MAPS.beakSide, R.head3.right);
    blit(MAPS.beakTop, R.head3.top);
    blit(MAPS.beakTop, R.head3.bottom);
    /* 体(root 6×6×8): 羽 #E6C35C+背缘/翼线 1px */
    blit(MAPS.bodyFront, R.root.front);
    blit(MAPS.bodyBack, R.root.back);
    blit(MAPS.bodySide, R.root.left);
    blit(MAPS.bodySide, R.root.right);
    blit(MAPS.bodyTop, R.root.top);
    blit(MAPS.bodyBot, R.root.bottom);
    /* 尾(tail 2×2×1): 上翘(尖金) */
    blit(MAPS.tailFront, R.tail.front);
    blit(MAPS.tailFront, R.tail.back);
    blit(MAPS.tailSide, R.tail.left);
    blit(MAPS.tailSide, R.tail.right);
    blit(MAPS.tailTop, R.tail.top);
    blit(MAPS.tailTop, R.tail.bottom);
    /* 腿(legR/legL 共区 1×3×1): ×2 金(票 §4.3 抽查件) */
    blit(MAPS.legFront, R.legR.front);
    blit(MAPS.legFront, R.legR.back);
    blit(MAPS.legSide, R.legR.left);
    blit(MAPS.legSide, R.legR.right);
    blit(MAPS.legTop, R.legR.top);
    blit(MAPS.legTop, R.legR.bottom);
    blit(MAPS.legFront, R.legL.front);
    blit(MAPS.legFront, R.legL.back);
    blit(MAPS.legSide, R.legL.left);
    blit(MAPS.legSide, R.legL.right);
    blit(MAPS.legTop, R.legL.top);
    blit(MAPS.legTop, R.legL.bottom);
  }},
});
