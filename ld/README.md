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
| LD-002 | 独立桌面中文词库与 AST 构建期覆盖 | `desktop/vite.config.ts` 两行接入；其余集中于 `desktop/ld/` | 本地化边界回归 + 中文消息/频道/设置端到端测试；未覆盖内容回退英文 |
| LD-003 | 手动构建、哈希与源码提交回执 | `.github/workflows/ld-*.yml` | 仅本 Fork 的 `main_1` 运行；不使用生产密钥 |
| LD-004 | 设置 → 外观中的简体中文 / English 切换 | `desktop/ld/LanguageSetting.tsx`，构建时挂到已校验的原生外观设置节点 | 原生分段控件与确认弹窗；取消不变、双向切换、存储失败不重载测试 |
| LD-005 | 跟随上游的轻量检查 | `.github/workflows/ld-checks.yml` | `main_1` 相关推送/PR 检查词条锚点、展示边界和新增组件类型；不自动部署 |
| LD-006 | 有归属的第三方词库补充与本土用词 | `desktop/ld/vendor/asterracy/`、`reference-catalog.mjs`、`catalog.mjs` | 固定来源版本，键/参数一致性及歧义排除测试；官方国际化合并后评估迁移 |
| LD-007 | Windows 更新前的本机受保护备份及回退说明 | `ld/windows/`，不接入客户端运行时代码 | 仅 Buzz 路径与专属凭据；文件哈希对照、DPAPI 解密验证；不自动安装或恢复凭据 |
| LD-008 | 工作流、项目、运行环境和智能体资料漏译补充 | 独立词库、已审查展示常量、`workflow-display.mjs`、`profile-labels.mjs` | 协议/YAML/用户内容不翻译；资料分类标识不修改，只在渲染时翻译；复杂动态工作流摘要暂保留英文 |
| LD-009 | 自有仓库新版检查与手动下载 | 构建期将原生 `use-updater.ts` 映射到 `desktop/ld/use-fork-updater.ts` | 上游文件 SHA-256 漂移即构建失败；只查询本 Fork Releases，不回退官方、不自动安装未签名包 |
| LD-010 | 补齐原生手机配对 sidecar | `ld/deploy/enable-pairing.py`，独立 Compose 服务及 Nginx `/pair` | 复用已部署官方镜像中的 `buzz-pair-relay`；无数据库/私钥/聊天持久化，不重启 Hermes 或主 Relay |
| LD-011 | 已有外部 Hermes 身份的原生主人归属与权限声明 | 原生 NIP-OA kind 0 / 主人签名 kind 30177；不改产品源码 | 本机主人签名、远端 Agent 签名，严格读回；不复制主人私钥，不伪造本机托管记录或远程控制权限 |
| LD-012 | 本机 Codex 的 E 盘工作区及限定权限自动审批 | 独立 `ld/codex/` shim + 原生 Buzz ACP / Codex 沙箱 | [部署、边界、测试、升级及卸载](codex/README.zh-CN.md)；不用 full access，不修改产品核心 |

### 提交元数据勘误

早期部分提交（包括 `48077414`）中的“Codex + GPT-5”为手写模板误标，不是 Git 采集到的运行模型。核对本次维护会话对应的本机 `turn_context`，构建阶段与本轮记录均为 `gpt-6-astra`、`xhigh`。这里只更正提交说明，不声称能独立审计服务端路由，也不改写或强推已发布历史。后续使用核实后的会话型号填写 LD 提交头；遵循现有 DCO 与署名规范。

### 本 Fork 发布与更新边界

- 新版检查访问 `LastDreamTeam/buzz_LDVersion/releases/latest`，验证 LD 版本格式和安装包、`SOURCE_COMMIT`、`SHA256SUMS` 三项附件齐全。网络失败显示错误，不伪装为“已是最新版”。
- 当前实现是 **检查更新 → 打开本 Fork 发布页 → 手动安装**，不是静默自动安装。原生 Tauri 自动安装另需独立更新签名密钥、公钥及签名清单；不能关闭验签凑成自动更新。Windows Authenticode 签名和 Tauri 更新签名也不是同一回事。
- 中文版中选 English 仍使用本 Fork 更新通道；`LD_BUZZ_LOCALE=en` 只旁路本地化，不将更新源切回官方。
- 发布包来自干净 CI 构建，只发布安装器、源码 SHA、校验和及说明；禁止上传本机 AppData、身份备份、生产配置、聊天截图或令牌。预览质量仍在说明中明确，不以“可下载”代替完整产品验收。

### 手机二维码 404 的部署修复

主 Relay 的 NIP-11 宣告 NIP-43、但未配置独立 pairing URL 时，原生客户端回退到 `/pair`。只部署主 Relay 而未部署 `buzz-pair-relay` 会返回 404；不是汉化或主账号损坏。

`enable-pairing.py` 仅适用于带 LD 标记的已有 Compose 安装：校验目标、备份 Compose/Nginx、复用主服务的已落盘镜像 SHA、启动独立内网 sidecar，再验证并 reload Nginx。该服务无宿主机端口、不读取主服务 `.env`，48 MiB 内存上限；入口限连接/请求速率，官方 sidecar 自带签名校验、4 KiB 帧、120 秒连接寿命等边界。脚本不是重复执行的更新器，已启用时拒绝覆盖。

失败时恢复配置并停止新增 sidecar；手动回滚先恢复备份的 Nginx 内容（保留 bind mount 的文件 inode），`nginx -t` 后 reload，再仅停止 pairing，恢复 Compose 备份。不要 `compose down`，更不要删除数据卷。

2026-10-11 已在真实 Windows 客户端中点击“开始配对”，成功生成原生二维码；此前的 WebSocket 404 不再出现。没有代替用户完成手机扫码和身份接收，因此不把桌面二维码可用写成手机端已完整验收。配对截图和临时载荷不进入仓库。

### 外部 Hermes 的主人归属：原生协议，不是新建 Bot

适用场景：现有 Hermes Gateway 已通过原生 Buzz 插件正常收发，但资料看起来像普通用户。Windows 的 Hermes ACP 运行环境安装按钮管理的是本机执行程序，不能收编服务器上已有的 Gateway；不要为归属识别另建同名身份。

1. 先备份该 Agent 最新签名 kind 0 资料、原有主人 kind 30177 策略（如存在）及服务 PID。确认真实主人公钥、Agent 公钥与当前资料，遇到已有不同归属时停止，不覆盖。
2. 主人的私钥只在其本机内存中用于签名。NIP-OA 对 `nostr:agent-auth:<agent-pubkey>:kind=0` 的 SHA-256 做 BIP-340 签名，生成 `["auth", "<owner-pubkey>", "kind=0", "<signature>"]`。此凭证仅证明该 Agent 资料的主人归属，不授予重启、模型或文件权限。
3. 主人通过原生认证连接发布 kind 30177，`d` 标签为精确 Agent 公钥；内容限定姓名、`parallelism: 1`、`respond_to: "owner-only"` 和空的额外允许名单。不得填入密钥、模型凭据、命令、目录或虚假运行状态。
4. 仅将公开签名标签交给原有 Agent。Agent 使用服务器上原有私钥签署新的 kind 0，保留原来的资料正文与非 auth 标签。发布前再次核对旧事件 ID，防止覆盖期间的头像或资料修改。
5. 从 Relay 重新读取并验证双方事件签名、标签和原文一致性。同步核对 Hermes 已生效的 `BUZZ_ALLOWED_USERS` 确为主人、`BUZZ_ALLOW_ALL_USERS=false`；声明本身不替代 Gateway 的实际入站权限检查。

女仆长的上述归属补充已完成，真实客户端资料卡显示 `Managed by lastdream (you)`；原生 CLI 的 `users get --owner <主人公钥> --name <精确名称>` 返回唯一匹配且 `verification: "verified"`。该次原身份、头像和正文未改，Gateway PID 未变，没有重启。操作回执及原事件只保存在受保护的本机/服务器备份，不上传身份、主机配置或聊天数据。

2026-10-11 后续接入芙蓉、贞德：仍用已有 Hermes 原生 Buzz 插件，补齐独立 Bot 身份、主人归属和实际入站 allowlist，原生查询均为 verified。按另行授权，在空闲、备份、回滚与配置校验通过后，逐个重启承载它们的两个精确 Gateway 服务加载配置；没有改模型、记忆、Hermes 核心或隧道。两者均已在真实频道返回验收标记。上游模型同时出现额度告警，连接成功不能等同于模型额度健康，也没有为此擅自充值或替换模型。

边界与后续维护：

- 主人归属不等于 Buzz 托管生命周期。外部 Hermes 的日志、在线心跳、远程启动/停止仍需真实的运行器/控制面支持；不能伪造 `ManagedAgentRecord` 或发布一次永久“在线”事件来凑界面。
- 当前“智能体”主页不是社区全量 Agent 名单：`AgentsView.tsx` 将 `agents.managedAgents` 与 `libraryPersonas` 交给 `UnifiedAgentsSection`；Relay 发现数据只辅助频道等信息，不自动创建托管实例。因此外部 Hermes 可在资料、成员和私聊中显示机器人/主人归属，却不出现在本机托管卡片网格。仅为补一张卡而新建同名 Bot 会造成身份分叉，不应这样修复。
- 新电脑导入同一个主人身份并连接同一社区，可按原生已签名归属发现 Agent；不需要复制 Agent 私钥，也不会自动迁移本机 Codex 的工作区、运行环境或模型凭据。
- kind 0 归属标签必须在后续资料更新时保留。当前上游 CLI `users set-profile` 重建资料事件，并不会自动继承旧标签；后续更换 Agent 头像/简介时须在该次资料签名中明确携带有效标签并读回验证。**不要把只允许 kind 0 的标签全局塞进 Hermes 的 `BUZZ_AUTH_TAG`**，否则普通聊天/认证事件不满足签名条件。本次不改变全局环境变量、不扩大签名范围。
- 回退须由原 Agent 用更新的时间戳重新签署已备份资料，并由主人撤销本次新增 kind 30177 坐标或恢复原策略；不能靠重放旧的 replaceable 事件回退。实施回退前也要检查当前事件，避免覆盖后续用户修改。

### LD-001：回复只剩圆点

Hermes 插件调用 `messages edit --content -` 并通过 stdin 传入正文。上游 send 读取 stdin，edit 原先直接将 `-` 写为 kind 40003 的编辑内容，Markdown 将其显示成空列表圆点。不是字体或模型问题，无须禁用鉴权、清理聊天或重启 Hermes。

补丁保留大小校验、事件签名、频道权限及 JSON 输出。`python3 ld/tests/cli-edit-stdin.py target/release/buzz` 调用真实二进制和 loopback 模拟 Relay，检查中文、emoji、换行、引号、shell 字符、字面量与超限拒绝；不能用模拟成功冒充生产成功。

已归档频道不能发送是另一个原生行为：Browse channels → Archived → 打开频道 → Unarchive channel 可恢复。无需改数据库。旧错误编辑事件仍属于审计历史，补丁不批量改写或伪造历史。

## 构建 / 验证

手动工作流 `LD CLI compatibility` 使用仓库固定 Rust toolchain 和 Cargo.lock；CLI 单测、真实二进制回归及格式检查通过后输出 `ld-buzz-cli-linux-x64`，包括 SHA256SUMS、SOURCE_COMMIT。它不是 Relay 镜像，不会自动部署。

CLI 的 Linux 构建、单测、真实二进制回归和格式检查已通过：[构建 38067741472](https://github.com/LastDreamTeam/buzz_LDVersion/actions/runs/38067741472)。上海生产测试频道中已完成发送 → 编辑 → 读取 kind 40003 的严格正文比对；Gateway PID 未变，测试频道随后归档，未修改用户聊天。激活版本为源码 `404c378144c647d42b745b11b9b2b5899503a4c1`，二进制 SHA-256 `8863c6e8ee6530cf67e292461ec4d8ace3b0ed396e0d8a1c63126894d812cd78`。

Desktop 已通过 TypeScript 检查、E2E 前端构建、本地化边界回归以及浏览器模拟 Tauri 的中文消息/频道/设置交互测试。发送 `Save Cancel Archive channel 原样保留` 后原文仍保持不变。模拟测试使用隔离浏览器目录，不接入生产身份。Windows 原生编译与安装验收单独记录，不能与这些测试混为一谈。未运行完整 `just ci`、Mobile 和其它平台测试。

中英切换最初通过 10 项本地化回归；纳入 LD-006 词库后已重新通过 17 项回归、原生前端及独立设置组件类型检查和 4 项浏览器交互测试（其中包括取消、切换后保留设置页面、双向切换及存储失败不重载）。这些是模拟桌面桥接测试，不是拿用户私钥执行真实登录测试。

LD-006 的正式前端构建（`pnpm --dir desktop build`）与上游 protected-feature internal/OSS 产物矩阵也已通过；构建仍有上游大分块/动态导入提示，不把提示说成零警告。Windows 安装包状态以对应源码的 Actions 结果为准。

LD-008 / LD-009 在源码 `4a65ac02` 上已通过 25 项 Node 回归、前端与新增组件类型检查、E2E 构建及 7 项界面测试。覆盖工作流中文与原始 YAML 事件值、项目标签、维护版更新入口，以及原有消息/语言切换边界。固定展示扫描为 4211 处，命中 3466 处（较 LD-006 增加 110 处）；不同展示键 2894 项中命中 2240 项。此扫描包含技术名称，不能换算为全产品汉化完成率。

### 中文层如何维护

- `desktop/ld/zh-CN.json`：固定界面文案词库，当前覆盖登录、身份备份、聊天、频道、个人资料、常用设置与部分智能体/项目界面；不是所有功能 100% 汉化。
- `desktop/ld/vendor/asterracy/`：经许可复用的固定英文/简体中文目录，4082 个原始键。只补充当前源码精确匹配的展示文案，并非 4082 项都在本版生效。LD 人工词条优先，来源归属见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
- 本土用词见 [GLOSSARY.zh-CN.md](GLOSSARY.zh-CN.md)：话题回复、语音会议、共享文档、智能体运行器等按功能解释；Open 等歧义词逐位置处理，不全局猜测。
- `localize.mjs`：TypeScript AST 仅识别 JSX 展示文字、明确展示属性、展示分支与模板。不是正则全局替换，不扫描聊天 DOM，不访问翻译网站。
- `reviewed-literals.json`：少数经审查的文件级展示常量例外；动态姓名/频道名仍保留原值。`reviewed-label-files.json` 仅允许所列文件的 `label` 字段本地化。
- 默认中文，用户可在 **设置 → 外观 → 界面语言** 切换 English / 简体中文。使用原生控件与确认弹窗；确认才保存并重新载入界面，取消不修改。请先发送或保存未完成内容，避免未保存编辑丢失。
- 偏好只保存到设备本地 `localStorage["ld.buzz.uiLocale"]`，不改变社区/智能体语言、不读取密钥、不调用服务端。双语分支保留动态表达式的单次求值；重载后统一生效，避免模块级展示常量出现混合语言。
- `LD_BUZZ_LOCALE=en` 构建仍可完全旁路 LD 本地化和语言设置，供故障回退；不需要删词库或重置用户数据。这与在双语版设置中选 English 不同。
- `node desktop/ld/inventory.mjs` 输出未覆盖固定文案及覆盖统计。模板参数的数量和顺序必须保持一致，否则构建报错。未识别文案保持英文；不会以韩语为兜底。
- `node --test desktop/ld/localize.test.mjs desktop/ld/reference-catalog.test.mjs` 运行 17 项测试：展示边界、未知文字回退、模板参数、运行时语言偏好、设置注入节点、全部 TSX 变换后语法、已审查词条锚点，以及来源键/参数一致性、歧义排除、术语例外与 LD 优先级。
- `pnpm --dir desktop exec tsc --noEmit -p ld/tsconfig.json` 单独检查新增设置组件。`LD overlay upgrade guard` 在 `main_1` 相关推送/PR 自动执行轻量回归；不是完整原生发行验收，也不替代分支保护。
- `pnpm --dir desktop build:e2e` 后执行 `pnpm --dir desktop exec playwright test --config ld/playwright.config.ts`。该测试只模拟 Tauri；正式应用仍需真实验证。

### Windows 中文预览版

手动运行 `LD Chinese Desktop`。沿用官方 Windows/Tauri/NSIS 构建和 sidecar 打包方式，增加 LD 版本后缀、中文覆盖、兼容回归、独立校验和。产物为**未签名预览安装包**，关闭自动更新产物，不自动发布或安装。GitHub Actions 附件保留 7 天，可按相同源码再次构建；验收前不称正式稳定版。

保留官方应用标识与数据格式是为了未来接续身份，**不意味着可以和原版同时运行，也不等于已证明任意版本双向兼容**。先用原版内置功能导出并验证加密身份备份，退出原版，再决定是否安装；不要点击“退出并清空数据”。回滚保留官方安装包及安装前本地数据备份，服务端聊天不因更换客户端而清空。

具体更新步骤、原生 `/UPDATE` 模式、备份脚本和回退边界见 [Windows 更新说明](windows/UPDATE.zh-CN.md)。脚本不在构建时执行，也不写入应用安装目录或用户钥匙串。

### Windows 实机安装验收：2026-10-11（ld.3）

[构建 38071460854](https://github.com/LastDreamTeam/buzz_LDVersion/actions/runs/38071460854) 已成功，安装包版本 `0.5.29-ld.3`，运行时代码来自 `4807741485edfe815b6aa269a86315bd179a226a`。后续备份脚本及本文档提交不改变该安装包的运行时代码。

- 产物：`Buzz_0.5.29-ld.3_x64-setup.exe`；SHA-256：`f9ae98f7ca355e79d4613527b1b47aa45b86b711750ddec6ae94083fdff2a995`。下载时同时核对 Actions ZIP digest、`SOURCE_COMMIT` 和 `SHA256SUMS`。
- 本机从 `0.5.28` 原位更新，原生 NSIS `/S /UPDATE` 返回 0，程序与安装记录均为 `0.5.29-ld.3`。保留既有桌面快捷方式。
- 更新前受保护备份 563 个文件，逐文件 SHA-256 一致；Buzz 专属凭据使用 DPAPI CurrentUser 加密并验证。更新及语言切换后凭据摘要与备份前完全相同。没有退出账号、清空 AppData 或重新注册。
- **真实 Windows 客户端**已检查：中文导航、个人资料及原头像；既有账号、频道与历史聊天可见；外观设置里的取消操作、中文 → English → 中文切换和双语确认弹窗正常。最终停留在简体中文。截图与含个人数据的验收回执只保存本机，不上传仓库。
- 安装到本机的真实 `buzz.exe` 再次通过 `ld/tests/cli-edit-stdin.py`：中文、换行、签名、字面量和超限拒绝均通过。此测试仅使用 loopback fixture，不发送生产聊天。
- 本次桌面安装没有重启 Hermes、Relay 或其它服务。该结果是上述范围的实机验收，不等于全产品、语音/视频或其它操作系统均已验证；剩余未匹配界面文案仍回退英文。

### Windows 实机更新与公开发布：2026-10-11（ld.4）

[构建 38076969145](https://github.com/LastDreamTeam/buzz_LDVersion/actions/runs/38076969145) 成功后，已将三项脱敏附件发布为 [desktop-v0.5.29-ld.4](https://github.com/LastDreamTeam/buzz_LDVersion/releases/tag/desktop-v0.5.29-ld.4)。安装包运行时代码固定来自 `4a65ac02c111bc563e88c66d5e70339ddb446628`；后续验收文档提交不改变该包。

- 安装包 `Buzz_0.5.29-ld.4_x64-setup.exe` 为 55,737,704 字节；SHA-256 为 `3bc446d3260771aaaa5fe5dcb267f06f0d16f777649b8efdceed3a6375c8101f`。发布前验证源码回执、附件哈希及上传后的 GitHub 资产摘要；公开内容不含身份、配置或聊天截图。
- 实机从 `0.5.29-ld.3` 原位更新到 `0.5.29-ld.4`，NSIS 退出码 0。更新前保护备份 750 个文件及专属凭据；更新前后凭据摘要一致，原账号、头像、社区和历史消息保留。没有重装身份、清空数据或重启服务器。
- 在真实 Windows 客户端验证：创建工作流的标题、频道选择、消息触发器及放弃草稿弹窗；项目的代码仓库页和计数；外部 Agent 资料标签及主人归属。仅打开并取消测试草稿，没有发布测试工作流或改写现有业务内容。
- 设置 → 更新真实点击后显示“当前已是最新版本”。同时匿名调用实际发布检查函数：`ld.3` 得到指向本 Fork 的手动下载入口，`ld.4` 得到 `up-to-date`。不以模拟请求代替这次线上检查。
- 设置 → 移动端在本版再次成功生成二维码，无 WebSocket 404。未进行手机扫码、验证码输入和身份接收，手机端完整配对仍待用户实际测试。
- 汉化仍非全量：实机确认工作流深层条件中的 `Message text` / `contains` 等、部分活动动态句、相对时间、`Default model` 和少数 `View` / `you` 仍是英文。这些属于后续明确的展示覆盖缺口，不是要翻译用户频道名、模型名或协议字段；不得把本次界面测试写成所有页面已完整中文化。

以上为 Agent 实机验收，不代替用户验收，也不宣称已通过全部产品功能测试。安装回执、程序回退文件和含私人内容的截图仅留在受保护的本机位置。

## 跟随官方升级

1. 确认无未提交改动，备份运行配置、数据库与身份（秘密不进 Git）。
2. `git fetch upstream`；从当前 `main_1` 建立升级分支，合并明确官方 SHA；不 reset、不强推覆盖维护分支。
3. 逐项核对本账本接入点，并按新上游基线调整 Windows 工作流的 LD 预览版本号。官方已修复的问题，先跑回归再移除补丁。重新扫描词库覆盖，陌生文案保留英文，不模糊替换协议字段。
4. 运行受影响测试、桌面可视化验证和独立环境试装。Mock 测试不等于真实身份、媒体或网络验收。
5. 人工验收后升级生产，记录源码 SHA、产物哈希、测试和回滚路径，保留旧程序。

“低侵入”不等于官方升级绝不影响：少量构建接入点和 Bug 修补仍须合并、测试。不要用强制丢弃改动的 Sync fork 更新 `main_1`。

### 外部 Fork 参考核查：2026-10-11

核查 [tianheil3/buzz](https://github.com/tianheil3/buzz) 当前 `main` 的固定提交 `37d9622c5ab490472d3b943a6917d92205bb83f5`。相对其已合并的官方基线 `82f7ed1532f50e0d28afca5580ed522f1c2ef1ca`，仅新增 `.github/workflows/fork-desktop-canary.yml`（227 行）；没有中文词库或 UI 汉化改动。结论限于此次核查的公开 main，不推断作者的未发布工作。

[新增工作流提交](https://github.com/tianheil3/buzz/commit/badd51a8b983743f560919bfb4323d1a811d812d) 可供参考之处是按需构建、无签名/无自动更新的预览产物、按上游版本派生 Fork 版本，以及 Rust/pnpm 缓存。LD 已自行实现前三类中的手动构建和非自动更新边界；自动版本派生、macOS 与缓存优化可后续单独评估。本次没有合并该 Fork、没有运行其工作流，也没有将它误标为中文来源。最初 LD 词库与语言切换独立实现；后来 LD-006 明确纳入 Asterracy 的词库数据，不将第三方翻译冒认为 LD 原创。

### 中文参考的选择与用词调整

- [Asterracy 的 i18n-zh-hans / PR #7777](https://github.com/block/buzz/pull/7777)：核查时 open、未合并；固定头 `3343dee36cb81ae87878cc4bf78a2c95d97237f1`。提供较完整的 4082 键词库、术语表和 i18n 实现，但涉及 628 个文件；本 Fork 只复用许可明确的词库数据，不整体合并源码。不能把作者报告的测试数量当成 LD 的实测结果。
- [PR #5152](https://github.com/block/buzz/pull/5152)：核查时 open、未合并；固定头 `b4560ace4d99ba70dcfdcfed842415df65418d11`。侧重较小范围的原生国际化基础、语言偏好、系统语言跟随与回退机制。本次参考设计，不复制其实现；LD 暂只提供简体中文与 English，不声称已支持跟随系统或繁体。
- `reference-catalog.mjs` 排除同一英文对应不同中文、参数重排/重复插值以及富文本标记；只做构建期确定性匹配，不运行外部 PR 的脚本，不联网翻译。原始目录保持原始键值，适配规则单独保存。
- 本土化不是批量换词：Huddle → 语音会议、频道 Canvas → 共享文档；画图画布保持原义。Thread 在聊天中叫话题，CPU/worker 线程不改。频道权限 Open → 公开，仅在已审查的创建频道展示摘要生效。
- 此轮扫描固定展示位置 4089 处，命中 3356 处；2850 个不同展示键中完整命中 2206 个。统计只针对 AST 可识别范围，包括部分品牌/技术名，不代表整个应用完成率。此次也纠正 `.ts` 泛型被错误按 JSX 统计的问题。
- 官方最终合并哪套框架尚不确定；将来优先迁移到官方接口并移除重复外层，不能无限叠加多套语言系统。

## 数据保护与回滚

- 构建不会自动安装、删除旧桌面端或重置 AppData/keystore。替换前备份身份，由使用者确认。
- CLI 可在同一入口原子切换版本，不必重启 Gateway；失败切回旧二进制。
- 本次 CLI 部署按“下载构建附件 → 校验附件哈希 / SOURCE_COMMIT / 二进制哈希 → 隔离回归 → 独立版本目录 → 原子切换既有链接 → 私密测试频道严格读回 → 归档测试频道”执行。旧二进制未删除，激活回执保存在服务器发布目录。仅替换 CLI，不替换 Relay 镜像、不调整 Hermes 配置。
- 本地化只改固定 UI 文案，不能改聊天、用户命名、提示词、密钥、协议、参数或持久化枚举。
- 私钥、`.env`、生产数据库、个人聊天与访问令牌禁止上传仓库。
