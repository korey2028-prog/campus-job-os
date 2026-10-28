# job-os

本地优先的校招求职工作台（MVP）：把一张几千行的校招汇总表变成能检索、能判断“我能不能投”、能跟进投递的工具。零依赖，Node 26 直接运行 TypeScript。

在线演示（虚构数据）：https://jobs.korey2028.tech

## MVP 有什么

- **检索与筛选**：按公司、岗位、城市（含“远程”）、行业筛；快捷组合“省事组合”（能投 + 免笔试）和“碰运气”（再加 7 天内截止，按截止日排）。
- **能不能投**：按毕业时间、学历、专业逐条判断，给出可投 / 待确认 / 不可投和理由。
- **为你推荐**：按方向和城市分档，只对 A 档写推荐理由。
- **投递跟进**：看板（想投 → 准备中 → 已投递 → 笔试面试 → 结束），今天页列出当天要做的事和已过期待决定的事。
- **台账写回**：改状态时先比对旧值（冲突返回 409）、写前备份、追加变更日志；`scripts/ledger.ts` 供命令行和其他 Agent 使用。
- **可信度**：每条岗位标来源可信度和时效，只在可信度低时提示。

## 命令

```
node src/cli.ts init
node src/cli.ts import-ledger <台账.csv>
node src/cli.ts import-jobs <jobs目录>
node src/cli.ts add-posting --company X --title Y [--url] [--grad "27届"] [--degree 本科] [--no-compat] [--majors "a,b"] [--cities "a,b"] [--deadline "2026/10/31"] [--batch "27届秋招"]
node src/cli.ts eligible --grad 2027-06 --degree 本科 [--major ...] [--as-of YYYY-MM-DD] [--all]
node src/cli.ts today [--as-of YYYY-MM-DD]
node src/cli.ts list
```

所有命令可加 `--db <path>`，默认 `~/.job-os/job-os.db`。测试：`npm test`。

## 数据分离规则

代码仓库只放虚构示例（`examples/`）。真实台账、JD、简历留在仓库之外；导入器对源文件只读，数据库默认在 `~/.job-os/`，`*.db` 与 `data/` 已被忽略。

## 网页演示

```bash
npm run gen:demo
npm run build:web
npm run web
```

打开 `http://127.0.0.1:5178/` 后，网页演示使用虚构岗位和浏览器本地存储。现在的闭环是：岗位筛选 → 资格与来源核验 → 加入投递 → 编辑下一步/日期/备注 → 状态推进 → 运行记录。运行记录和导出数据都保留在本机，不会自动发送或提交申请。

## 个人模式

`npm run me` 读本机私有数据（`private/` 与仓库外的 `data-private/`，均不进仓库），打开 `http://127.0.0.1:5179/`。没有这些数据时只能用上面的演示模式；依赖真实数据的测试会自动跳过。

`job-os` 不保存招聘网站密码、验证码或外部 API 密钥。外部数据源应作为可替换适配器接入；TikHub 只作为公开平台补源，不是核心事实库。
