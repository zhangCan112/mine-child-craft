# AGENTS.md — my-craft-demo

给 6 岁孩子的 Minecraft 风格体素注意力训练游戏。原生 JS + Three.js r128，
经典 `<script>` 共享词法环境（顶层声明互为全局，加载序即依赖序），**无构建步骤**。

## 必读（按需到达）

- **MISSION.md** — 项目使命、成功标准、技术栈约束。动工前先读。
- **docs/conventions.md** — 工程与代码规范正文。改任何代码前读；本地偏离登记表在它的 §6。
- **GLOSSARY.md** — 模块术语表。**找模块先查这里**：词条按 interface 收词，_Avoid_ 是已废弃的旧名，别再用。
- docs/google-style-research.md · docs/project-structure-research.md — 规范背后的来源论证（改规范前读）。

## 硬规则（conventions.md 的浓缩，细节以正文为准）

- 一文件一模块：文件名即模块索引，kebab-case + 后缀语义（`-core` 纯核心必配同名单测、
  `-registry` 清单唯一权威、`-kit` 跨模式工具、`-worker` Worker 入口）。
- 引擎层不知道玩法；应用可依赖引擎，引擎不得依赖应用。
- 可能被其他文件写的顶层绑定用 `let`（input.js 写 pitch、build.js 写 flyMode），
  文件内变量默认 `const`。
- 新模式 = index.html 加卡/页/script + mode-registry.js 加行（三重命名有测试断言）。
- 注释用中文；模块头注释走 `====` 五要素契约（conventions.md §1.7）。
- 新约定先过 conventions.md §1.10 升格判据；不可逆决策写 docs/adr/。

## 收尾前必跑

```
npm test        # 全部单测 + boot 全链冒烟 + 规范守门（test/conventions.test.js）
npm run lint    # ESLint(google 基线) + Stylelint + htmlhint，零错误才算过
node server.js  # 本地起服务，端口默认 8080
```

运行时不依赖 node_modules（浏览器直引 js，server.js 只用 Node 内建模块）；
package.json 只装开发期 lint 工具。
