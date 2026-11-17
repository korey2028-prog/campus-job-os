# 给编码代理

收工前运行 `npm run check`。不过就还没完成。

`npm run check` 依次执行 `npm run check:boundaries`、`npm run typecheck`、`npm test`。分层和不能进 git 的文件以 `scripts/check-boundaries.ts` 为准，说明在 README 的「提交前检查」。不要在这里加脚本没有执行的要求。
