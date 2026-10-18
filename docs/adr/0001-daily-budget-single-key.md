# 0001 — 每日预算并入单一存档键 daily_budget_save

已有真实用户在用（进度不可丢失），而"儿童时限"当时存在两套实现：main.js 的
`play_time_save {date,ms}` 与 focus.js 存档内嵌的 `daily {date,played,ms}`。我们决定把
两者的当日账合并进 `js/daily-budget.js`（每日预算 module）唯一持有的 `daily_budget_save`
键，启动时（`SyncDB.ready` 之后）一次性迁移：搬运当日旧账 → 校验新键 → 备份旧值到
`daily_budget_migrate_backup`（只写一次）→ 删除 `play_time_save`、从 `focus_camp_save`
仅摘除 `daily` 字段（解锁/星级/历史原样保留）。任何一步不成立则旧 key 原样保留、下次
启动重试；读不懂的旧值永不删除。

## Considered Options

- 给两个旧 key 各配存储 adapter、免迁移 —— 被否：schema 知识继续漏在调用方，正是本次要消灭的浅模块。
- 单一新 key + 一次性迁移 —— 采用：一份形状、一处演化；代价是一次幂等迁移（见
  `test/daily-budget.test.js` 的真机夹具用例）。

## Consequences

- 未来动存档形状前先看本条：`daily` 不在 `focus_camp_save` 里是**有意的**，别把它搬回去。
- `play_time_save` 从 SYNC_KEYS 退役；升级前已开着的旧页面回写旧 key 只会无害复活，新代码不读它。
- 备份键 `daily_budget_migrate_backup` 常驻至下个版本再清，作为可手工恢复的保单。
