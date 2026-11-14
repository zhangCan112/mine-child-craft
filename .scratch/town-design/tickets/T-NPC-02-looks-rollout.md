# T-NPC-02 14 实体 look 落库票（剩余 13 件：V02~V10 / G01 / A01~A03）

> 波次：**一（立即可施工）** ｜ blocking edges：**T-NPC-01**（管线 + 几何尺寸表 + look 键契约）
> 上游权威：T-NPC-01 §5 box 几何尺寸表 · `.scratch/town-design/gen/gen-rollout-{villagers,golem,mobs}.js`（像素唯一真源）· `notes-villagers-rollout.md` §1（14 件映射表）§3（D1-D10 差异登记）

## 1. 目标

沿 T-NPC-01 打通的导出管线，把剩余 13 个实体的造型声明落库为 `js/mob-look/town_*.js`，使 14 键全部可渲染、可 golden 对账：

| 键 | 角色 | 基座/骨 | 画布 | 附件（追加骨） |
|---|---|---|---|---|
| town_v02 | 麦芽（农夫） | illager | 64×64 | 麦束（左手持） |
| town_v03 | 石匠阿砌 | illager | 64×64 | 腰挂锤（锤头 2×2 + 柄） |
| town_v04 | 图图（制图师） | illager | 64×64 | 斜挎卷轴筒（背侧） |
| town_v05 | 铁匠炉火 | illager | 64×64 | 钳（额带护目镜 UV 头区） |
| town_v06 | 朵朵（花匠） | illager | 64×64 | 花束 |
| town_v07 | 小厨乐乐 | illager | 64×64 | 托盘 6×1×4（双手胸前 y16~18） |
| town_v08 | 钟叔 | illager | 64×64 | 胸挂铃铛（装饰） |
| town_v09 | 牧童豆豆 | illager | 64×64 | 腰挂饲料袋 |
| town_v10 | 跑跑妮妮 | illager | 64×64 | 侧挂小挎包 |
| town_g01 | 铁守护·阿稳 | 自有骨（T-NPC-01 §5.2） | **64×80** | 献花盒 4×4×4（骨照建，显隐后置） |
| town_a01 | 小花鸡 | 自有骨（§5.3） | 32×32 | — |
| town_a02 | 咪喵 | 自有骨 | 32×32 | — |
| town_a03 | 小褐驼 | 自有骨 | 48×48 | — |

## 2. 文件域

- 增：`js/mob-look/town_{v02..v10,g01,a01,a02,a03}.js`（13 个新文件）
- 改：`test/fixtures/town-npc-golden.json`（导出器同步扩 13 键）
- 复跑：`.scratch/town-design/gen/gen-export-look.js`（不 commit）
- **改（票面登记授权，T-NPC-01 评审建议 1）**：`test/mob-look.test.js` 三处全键循环按方形 `tex.size` 读纹素——:143 出界判据（v 轴按 64）、:170 全覆盖行距（y*64）、:316-320 UV 逐顶点采样（floor(v*size)）。`size: w` 兼容读下这三处对 64×80 的 town_g01 会假红/假绿（出界判据假红、行距/采样读错纹素假绿）。**落 town_g01 前随票改为按 `texDims` 的 w/h 读**，存量 49 方形造型回归必须零漂移（12/12+town_v01 断言零改动通过即证）。
- **禁触**：index.html / js/town.js / js/mode-registry.js；本票不改 mob-look-kit.js（除上述已登记的三循环改源外，test/mob-look.test.js 其余断言零改动）。

## 3. 接口形状

- 与 T-NPC-01 §3.2 声明形状完全同构； villagers 逐角色差异全部由 **gen CAST 配置**（hat/acc/collarChar/cuffChar/pal/accPal）驱动，导出器机械移植，**不做逐角色手绘**（notes §2 基座推广口径）。
- G01 特有：裂纹四档语义——本批只画 `_ok` 完好态贴图；`_crack2` 中裂为 PO 首版必做项但属**状态切换实现**（裂纹叠加层），归动画层选型票（README §3.2 裁决二）；gen 中已内嵌的裂纹示意像素随导出器保留在 golden 对照域之外即可，不进默认画布。
- A02 咪喵 bind 即坐姿（gen 坐姿结构）；动物骨名沿 quad 惯例（head/root/legL/legR/tail），冠/喙/耳并入 head 追加盒或独立装饰骨（随 gen 结构映射，导出器自证）。
- 姿态：全部中性 bind；V01 挥手、V02 工作、V10 小跳、V04 指路等姿态语义**不入本批**（裁决二），姿态描述记入各文件头注释一句（供动画层选型票检索）。

## 4. 验收标准（红绿可测）

1. 13 键全部 `MobLookKit.has(k)` 且自动并入 mob-look.test.js 全键循环：贴图全覆盖（alpha=255）/ 六面不出界（G01 按 64×80 域）/ UV 落点逐顶点采已涂纹素（黑缝回归）/ 确定性两次绘制逐字节一致——**全绿是收尾硬门**。
2. golden 对账扩至 14 键全量：逐面内容摘要 == fixture。
3. 几何抽查断言：`rig('town_g01')` 身高 43/16≈2.7 格、臂盒 4×30×6（长臂过膝）、髋盒 10×5×7 存在；`rig('town_a01')` 腿盒 1×3×1；`rig('town_v07')` 托盘盒 6×1×4。
4. 像素抽查（gen 自检同款口径）：A01 正面眼/冠/喙、A02 胸白纹、A03 耳内色关键像素对色断言。
5. 表情帧一致性：10 村民 greet 模式元数据与 gen CAST 一致（V01=browlift、其余=eyesmile）——本票只校验数据被导出器正确携带（消费在 T-NPC-03 注册表）。
6. 收尾：`npm test` 全绿 + `npm run lint` 零错；禁触三文件零改动。

## 5. 备注

- 施工顺序建议：V02~V10（illager 基座参数化，机械度高）→ G01（自有骨 + 非方形首用）→ 动物 ×3（自有骨，结构独立）。
- 若导出器对某附件/帽饰映射产生歧义，以 `.scratch/town-design/assets/villagers-mobs/*.svg` 批产件为对照仲裁；gen 与 SVG 冲突时**以 gen 为真源**（notes §5：生成器唯一真源，SVG 是其产物）。
