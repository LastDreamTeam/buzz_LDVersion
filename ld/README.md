# Buzz LD 维护说明

上游：[block/buzz](https://github.com/block/buzz)，Apache-2.0 许可证保持不变。

## 仓库边界

- `main_1`：我们的默认维护分支。
- `legacy/main_20261011`：官方 main 初始快照，基线 `326e2301cb4b1edcb8a72d01ac4b19a83545365f`，Desktop 0.5.28。不推进此存档分支。
- Desktop、Relay、CLI、Mobile 同仓库，不将生产数据或身份放进 Git。
- 完整频道、私聊、话题、智能体协作界面在 Desktop。原生 Web 是代码仓库浏览器及邀请页；`BUZZ_SERVE_GIT_WEB_GUI=true` 不会变成网页聊天端。本次优先汉化 Desktop，不新造 Web 聊天端。

## 修改账本

| 编号 | 修改 | 上游接入点 | 验证 / 去除条件 |
| --- | --- | --- | --- |
| LD-001 | `messages edit --content -` 读取 stdin，与 send 一致 | `crates/buzz-cli/src/commands/messages.rs`，`src/lib.rs` 帮助文本 | 真实 CLI 回归；官方修复后先通过测试再删重复补丁 |
| LD-002 | 独立桌面中文词库与构建期覆盖 | 实施中 | 未完成前不声称全量汉化 |
| LD-003 | 手动构建、哈希与源码提交回执 | `.github/workflows/ld-*.yml` | 仅本 Fork 的 `main_1` 运行；不使用生产密钥 |

### LD-001：回复只剩圆点

Hermes 插件调用 `messages edit --content -` 并通过 stdin 传入正文。上游 send 读取 stdin，edit 原先直接将 `-` 写为 kind 40003 的编辑内容，Markdown 将其显示成空列表圆点。不是字体或模型问题，无须禁用鉴权、清理聊天或重启 Hermes。

补丁保留大小校验、事件签名、频道权限及 JSON 输出。`python3 ld/tests/cli-edit-stdin.py target/release/buzz` 调用真实二进制和 loopback 模拟 Relay，检查中文、emoji、换行、引号、shell 字符、字面量与超限拒绝；不能用模拟成功冒充生产成功。

已归档频道不能发送是另一个原生行为：Browse channels → Archived → 打开频道 → Unarchive channel 可恢复。无需改数据库。旧错误编辑事件仍属于审计历史，补丁不批量改写或伪造历史。

## 构建 / 验证

手动工作流 `LD CLI compatibility` 使用仓库固定 Rust toolchain 和 Cargo.lock；CLI 单测、真实二进制回归及格式检查通过后输出 `ld-buzz-cli-linux-x64`，包括 SHA256SUMS、SOURCE_COMMIT。它不是 Relay 镜像，不会自动部署。

初始源码补丁已审查，编译、回归与生产验收待运行。未运行的完整 `just ci`、Mobile 和其它平台不得标为通过；每次发布必须更新真实验证记录。

## 跟随官方升级

1. 确认无未提交改动，备份运行配置、数据库与身份（秘密不进 Git）。
2. `git fetch upstream`；从当前 `main_1` 建立升级分支，合并明确官方 SHA；不 reset、不强推覆盖维护分支。
3. 逐项核对本账本接入点。官方已修复的问题，先跑回归再移除补丁。重新扫描词库覆盖，陌生文案保留英文，不模糊替换协议字段。
4. 运行受影响测试、桌面可视化验证和独立环境试装。Mock 测试不等于真实身份、媒体或网络验收。
5. 人工验收后升级生产，记录源码 SHA、产物哈希、测试和回滚路径，保留旧程序。

“低侵入”不等于官方升级绝不影响：少量构建接入点和 Bug 修补仍须合并、测试。不要用强制丢弃改动的 Sync fork 更新 `main_1`。

## 数据保护与回滚

- 构建不会自动安装、删除旧桌面端或重置 AppData/keystore。替换前备份身份，由使用者确认。
- CLI 可在同一入口原子切换版本，不必重启 Gateway；失败切回旧二进制。
- 本地化只改固定 UI 文案，不能改聊天、用户命名、提示词、密钥、协议、参数或持久化枚举。
- 私钥、`.env`、生产数据库、个人聊天与访问令牌禁止上传仓库。
