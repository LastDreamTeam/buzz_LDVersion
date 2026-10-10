# LD-012：本机 Codex 的 E 盘启动适配器

这是 **LD 自己的可移除适配器**，不是官方新增的安全模式。Buzz 原生负责身份、主人归属、频道、托管记录、ACP 调度及生命周期；Codex 原生负责模型执行与 Windows 工作区沙箱。没有修改 Buzz、Hermes、Codex 或已安装 codex-acp 的核心文件。

## 为什么需要这一层

本次基线中，Buzz 桌面托管智能体从用户 `.buzz` 启动，并会自动批准 ACP 工具权限申请。不能只把工作目录写进提示词，也不能用“自动批准全部”实现无人值守的边界。

适配器将 native `buzz-acp` 的实际工作目录放到 E 盘，并代理它与原生 `@agentclientprotocol/codex-acp` 之间的 stdio：

- 每个 Bot 固定一个真实 E 盘目录和精确模型/推理强度。拒绝重定向目录、切换为 full access、额外写入根、恢复外部会话和不认识的权限流程。
- 普通工作区读写、脚本修改、编译测试使用原生 `workspace-write`，不逐条打断主人。
- 只自动批准原生 `request_permissions` 的结构化 **纯联网、当前回合** 请求；不得夹带 filesystem、其它环境或未知字段。不是按 shell 文本中出现 `buzz` / `curl` 就批准整个命令。
- 其它越界权限或客户端侧 shell/文件工具申请拒绝，不转交给 Buzz 的无条件自动批准器。不提供远程系统管理员入口。
- 禁用启动时读到的已配置全局 MCP、会话注入 MCP、Apps、插件及子智能体；不改全局配置或正在使用的 Codex 会话。不要随后把未知项目的 `.codex` 配置标为可信并据此开启额外工具，新项目权限需另审。
- 保留原生 Buzz CLI 必需的 **当前 Bot 自己** 的身份环境变量；不注入主人私钥。普通 assistant 文本只进入活动日志，面向人的回复必须用原生 `buzz messages send` 发布。

### 真实边界，别当成虚拟机

`workspace-write` 不是完整读取隔离，也不是对工作区内每个文件的业务价值判断。已授权目录内的删除/覆盖可能被允许，重要数据应放在未授权位置并另做备份。用户给定真实项目目录后，应单独审查再授权或把副本放入对应 Bot 工作区；本版**没有自动授权其它磁盘或现有项目**。

Bot 可正常联网；联网许可不授予越界写入。原生 codex-acp 2.2.2 的 `workspace-write` 回合预设会把网络初始设为关闭，即使 `CODEX_CONFIG` 声明允许联网，因此仍需上述独立的网络许可流程。不能以切换 full access 解决网络问题。

为提供这一原生工具，仅在三个 Bot 子进程的 `CODEX_CONFIG` 开启 `features.request_permissions_tool`；Codex CLI 0.153.4 将该功能标为 **under development**，不是稳定性承诺。没有更改全局 feature 开关。升级时若工具或字段变化，必须重新验收，失败应保持拒绝而不是放宽为 shell 全量批准。

每个 Bot 持有自己的 Buzz 签名能力，这是原生协作所必需的；不要要求它打印环境变量或私钥。此集成不构成机密数据防泄露沙箱。身份、登录、原生托管记录和 Codex 会话元数据仍由原产品保存在用户配置目录（可能在 C 盘）；**E 盘要求覆盖的是任务工作区及临时文件，不是把整个用户配置迁走**。

## 部署与复用

验证基线：Windows、Buzz Desktop `0.5.29-ld.4`、codex-acp `2.2.2`、Codex CLI `0.153.4`。先备份 Buzz 程序、本机数据及加密身份；不要把备份放入任务工作区。

1. 在 `E:\Agentic\Buzz-Codex` 下建立 `runtime`、`backups`、`workspaces\astra`、`workspaces\sol`、`workspaces\luna`。不得用链接把工作区指向其它盘或重要目录。`runtime`、`backups` 不在 Bot 可写根内。
2. 将本目录的 `adapter.mjs`、`policy.mjs`、`runtime-config.mjs` 复制到 `runtime`。复制 `machine.example.json` 为该处的 `machine.json`，填写已有 Node、Buzz harness、已安装 codex-acp、Codex 配置目录的真实绝对路径。不要写入任何账号私钥。
3. 用 Windows 自带 .NET Framework C# 编译器构建 `Launcher.cs`（独立进程 shim），输出 `runtime\buzz-ld-codex.exe`。例如从仓库根执行，所有目标目录须先创建：

   ```powershell
   & "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe /out:E:\Agentic\Buzz-Codex\runtime\buzz-ld-codex.exe .\ld\codex\Launcher.cs
   ```

4. 将编译产物复制一份到 **Buzz 程序目录**，命名为 `buzz-ld-workspace-acp.exe`。这是额外的原生可发现入口，不覆盖原 `buzz-acp.exe` 或 Codex。不要用同名 `.cmd` 替代：本基线 app-dir 的命令解析与 PATH 查找不同。
5. 通过 Buzz 原生“新建智能体”创建独立身份，运行器 Codex、ACP 命令 `buzz-ld-workspace-acp`、精确模型如下。不要手工伪造 `managed-agents.json` 或复制其它 Bot 的密钥。

   | 名称 | LD_BUZZ_AGENT | 模型 |
   | --- | --- | --- |
   | 兰州 Codex Astra | astra | gpt-6-astra[xhigh] |
   | 兰州 Codex 6 Sol | sol | gpt-6-sol[high] |
   | 兰州 Codex 6 Luna | luna | gpt-6-luna[medium] |

   跨电脑使用时名称应标明执行节点，不用含糊的“本机”；可在简介填写自己的计算机名。改显示名称沿用原身份，不重新创建 Bot。

6. 每个智能体设置环境变量 `LD_BUZZ_AGENT`、`LD_BUZZ_NODE`（Node exe 绝对路径）、`LD_BUZZ_RUNTIME=E:\Agentic\Buzz-Codex\runtime`。并行度 1，指令来源选择唯一主人身份。需要随桌面启动才开启原生启动选项；不要启用未使用的欢迎示例 Bot。
7. 指令中约定：中文协作；按主人任务行动；重要数据删除、系统环境/服务/注册表/凭据/安全策略变更先解释影响和回滚并请求确认；不得绕过沙箱。提示词只管行为约定，实际文件权限以沙箱为准。
8. 使用原生邀请/添加成员，把 Bot 加入目标频道。由主人发送 @ 消息，验收 E 盘落盘、精确模型、实际 Buzz 回帖和越界写入被拒绝。只有进程在线或文件生成不能算消息往返成功。

新电脑使用同一主人身份并连接同一社区，可通过成员、搜索、私聊或频道 @ 这些 Bot；无需把 Bot 私钥复制到新电脑。执行仍发生在这台 Windows 主机，不是遥控当前 Codex Desktop 会话。主机需开机、不休眠、网络与模型登录可用，托管 Buzz 需保持运行。此变更没有配置 Windows 开机任务、系统服务或更改电源设置，不保证断电/退出应用后仍 24 小时工作。

## 验证、升级与回退

```powershell
node --test ld/codex/*.test.mjs
```

测试覆盖目录、模型、MCP、客户端工具、权限申请、纯网络自动批准和 CLI 环境变量边界；不替代真实 Windows 沙箱测试。`Launcher.cs` 还需实际编译及原生 stdio 工作流验收，避免 stdio 缓冲造成卡住。

### 2026-10-11 实机回执

- 7 项适配器单测通过；C# shim 实际编译通过。原生桌面界面创建了三个独立托管 Agent，主人来源限制、模型和并行度均已核对。
- 三个真实模型会话分别核对了 Astra xhigh、Sol high、Luna medium；不是依据卡片显示名猜测模型。
- 由真实主人身份发送已标注的验收任务，三个 Bot 均在各自 E 盘目录落盘并读回标记；随后通过原生 CLI 向相同话题回帖，服务端按 Bot 公钥读回成功。早期调试曾因过滤 Bot 凭据、原生 ACP 默认禁网造成只执行不回帖，这两次失败没有算作验收通过。
- 网络权限只授予本轮且不含文件权限。真实 Windows 沙箱在联网获准后仍拒绝写入工作区外的备份目录，目标文件不存在。
- 自建 Buzz 的实际消息往返已验证；外部 example.com 探测遭遇 TLS 握手失败，不能据此声称任意外网下载均可用。没有关闭 TLS 验证或修改系统网络环境。
- 没有完成另一台电脑/手机实测、连续 24 小时耐久测试、所有项目工具链或完整上游 `just ci`。最终的人类交互验收由使用者完成，不用本回执替代。

最终在 `613c4d17` 的适配器代码上重新加载三个运行器；名称按执行节点改为“兰州”，保留原公钥、模型及主人限制。再次只发送普通对话请求（不提示如何申请联网或发消息），三个 Agent 均通过原生 CLI 回帖了新名称与各自 E 盘目录。运行目录内三份 JS 的哈希与该源码一致，原生主人归属再次读回为 verified。

更新 Buzz/Codex/ACP 时，先停这三个空闲 Bot，备份 runtime 和程序目录中的 LD shim。核对 upstream 模式/权限结构、CLI 身份注入、原生进程 Job Object，再跑单测和真实流程。发现模式/模型不符会拒绝会话；不能删除校验凑成“兼容”。不要自动更新全局模型设置。正常 Buzz 安装更新可能移除额外 shim，须按本说明恢复并复验。

卸载：先通过原生界面停止这三个 Bot 并关掉其自动启动，再移除新增的 `buzz-ld-workspace-acp.exe` 和 `runtime` 中列出的 LD 文件。不要删除整个 `E:\Agentic`、用户配置、原生身份、聊天、Hermes 或任务工作区。若要删除 Bot 身份/任务数据，另行确认。回退运行器文件时只恢复本次备份中的对应文件；恢复整个旧 AppData 会覆盖后来新增的本机记录，不应顺手做。

生产身份、IP/端口、聊天、签名回执、会话与备份均不进入本仓库。`machine.json` 和 exe 已忽略；发布安装器仍走独立的干净 CI 构建，此适配器不是把私人配置嵌进通用安装包。
