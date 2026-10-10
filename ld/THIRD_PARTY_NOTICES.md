# LD 本地化参考与归属

## Asterracy 简体中文目录

- 来源：[Asterracy/buzz — i18n-zh-hans](https://github.com/Asterracy/buzz/tree/3343dee36cb81ae87878cc4bf78a2c95d97237f1)
- 相关提案：[block/buzz PR #7777](https://github.com/block/buzz/pull/7777)，本次核查尚未合并，不能称为官方已支持。
- 作者与维护者：Asterracy；来源说明注明使用 OpenAI Codex 协助，提交作者与 DCO 签署人为 Asterracy。
- 固定源码：`3343dee36cb81ae87878cc4bf78a2c95d97237f1`。
- 许可证：Apache License 2.0；来源 LICENSE 与本仓库根目录 LICENSE 的 Git blob 相同，`862ee3c28647e7a58801a75236855c269c1448ae`。
- 纳入路径：`desktop/ld/vendor/asterracy/en.json`、`zh-Hans.json`，来自原 `desktop/src/locales/`。保持键值数据，JSON 排版经规范化。
- LD 修改：不运行来源 PR 的代码，也不合并其 628 个文件修改。通过 `reference-catalog.mjs` 筛选精确展示文字、排除语义冲突/参数重排/富文本标记，再按 LD 术语表调整少量中文；人工 LD 词库始终优先。
- 原文版权与许可继续有效；LD 适配不宣称来源翻译由 LastDreamTeam 独立原创，不代表 Block 或原作者认可本发行版。

## 其他参考（未复制实现）

- [PR #5152](https://github.com/block/buzz/pull/5152)，固定头 `b4560ace4d99ba70dcfdcfed842415df65418d11`：参考语言偏好、英文回退、键/参数一致性和存储异常设计；原工作保留 Sam Wong / HyperfocuSam 及后续作者的归属。本次未引入其 react-i18next 实现或繁体目录。
- [tianheil3/buzz](https://github.com/tianheil3/buzz/commit/badd51a8b983743f560919bfb4323d1a811d812d)：参考 Fork 桌面构建工作流，不是中文词库来源，未复制代码。
