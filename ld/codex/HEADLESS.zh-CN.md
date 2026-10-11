# LD-013：执行节点独立运行报告与新增 Agent 清单

作用域：本目录的 Windows Codex 接入。2026-10-11，基线 Buzz Desktop `0.5.29-ld.4`、codex-acp `2.2.2`、Codex CLI `0.153.4`、PowerShell `7.6.5`。

## 现在如何使用

重启执行电脑后，**登录原来的 Windows 用户一次**。Windows 原生计划任务在登录后约 15 秒启动三个独立运行器；一般不必打开 Codex Desktop 或 Buzz Desktop。锁屏不是注销，可继续运行；关闭两个桌面窗口不会停止这三个任务。不要休眠、关机或注销 Windows。模型登录、网络、Relay 与模型服务也必须可用。

异地 Buzz Desktop 使用同一个主人身份、同一个社区，通过原 Agent 的私聊或频道 @ 派单。任务在执行节点的 E 盘运行，不在发消息的电脑运行，也不是接管当前打开的 Codex Desktop 对话。不要把 Agent 私钥复制到其他电脑。

| 原身份 | 固定模型 | 授权工作区 |
| --- | --- | --- |
| 兰州 Codex Astra | `gpt-6-astra[xhigh]` | `E:\Agentic\Buzz-Codex\workspaces\astra` |
| 兰州 Codex 6 Sol | `gpt-6-sol[high]` | `E:\Agentic\Buzz-Codex\workspaces\sol` |
| 兰州 Codex 6 Luna | `gpt-6-luna[medium]` | `E:\Agentic\Buzz-Codex\workspaces\luna` |

当前派单者仅主人、指定的女仆长与芙蓉身份；贞德及其他同主人 Bot 不自动获得派单权。实际判断使用已签名公钥，不使用名字或消息正文的“我是主人”。启停、授权变更及高风险决策仍只属于主人。

**异地的 Start / Restart 卡片不是执行节点遥控器。** 原生桌面托管按钮启动当前电脑的进程；同步过来的 persona 是定义，不代表远端进程已迁移。点击 Start 可能报缺少运行器，或创建新的同名公钥实例。本方案不伪造托管状态、不改造该按钮；在线与回帖看原公钥的真实 presence/消息。原生加密 observer 已开启，活动信息只发给主人；未承诺异地按钮可重启宿主任务。

## 原理及非原生部分

`异地主人/授权 Bot → 原生 Buzz Relay → 执行节点 buzz-acp → 原生 codex-acp → Codex workspace-write → 原生 Buzz CLI 回帖`

- 原生承担：身份与主人归属、签名和消息、订阅规则、在线心跳、加密活动观察、ACP、Codex 模型与沙箱、Windows 登录计划任务。
- LD 增补：原有 E 盘权限适配器，以及本目录的小型进程启动/日志脚本。不是自造消息桥、远程桌面或新的控制服务器，没有修改已安装的 Buzz/Codex 核心二进制。
- `headless-host.ps1`：读取原生已有托管记录和 Windows Credential Manager 中**该 Agent 自己**的密钥，在内存中传给原生进程。不导出私钥、不创建替代身份、不向子进程提供主人私钥。
- `HeadlessNative.cs`：仅访问 Windows 凭据 API 和进程 Job Object。任务关闭时回收自己的子进程，防止孤儿运行器重复接单；公钥命名的全局 mutex 拒绝同节点重复运行。
- `install-headless-tasks.ps1`：注册 Limited / Interactive / AtLogOn 原生任务，无保存密码、无自动登录、无提权、无系统服务。三个任务互相独立，失败 2 分钟后重试、最多 20 次；干净退出（包括主人 `!shutdown`）不偷偷重生。
- 日志位于 `runtime\logs\<agent>`，每个文件约 8 MiB、保留当前及 4 个轮转文件。日志可能有业务文本，应限制 ACL；不把日志当机密过滤器，不上传仓库。原生会话/聊天存储仍按原产品机制管理，不删除业务历史。

## 本轮排错结论

1. **关桌面就停**：旧配置由 Buzz Desktop 托管，退出会回收子进程。改为独立原生 harness，不再隶属于桌面的进程树。
2. **5 秒超时**：原生 harness 再次发 `session/set_model`，虽已通过子进程配置选好相同模型，仍触发其 5 秒 RPC 超时。适配器移除多余的 `BUZZ_ACP_MODEL` / effort 下发，模型仍在 `CODEX_CONFIG` 固定，并由 `session/new` 结果严格核验。不是切换低配模型，也不是忽略模型错误。
3. **Session 0 不等于后台常驻**：曾测试 AtStartup/S4U，身份与联网成功，但沙箱 shell 在未交互登录的 Session 0 返回 `0xC0000142`；不能用“进程在线”宣称可开发。已撤掉测试任务，采用用户同意的“重启后登录一次”边界。没有关闭沙箱、修改 WindowStation ACL、设置自动登录或安装 WSL。完全无人登录即执行不在当前交付承诺内。
4. **原生 allowlist 还接受 sibling**：本基线 `author_allowed` 也可放行同主人的 Bot。额外使用原生 subscription TOML 的 `author == ...` 表达式，按真实签名公钥严格限定；包含 DM，频道仍需 mention。主人 kind 30177 声明同步同一名单，但声明不替代执行端过滤。
5. **两个 Luna**：同名并非同身份，本轮读到两个不同公钥。执行节点继续使用原公钥，未创建第三个、未删除历史；应先核对公钥再关闭或归档多余入口。不能按名字批量删 Bot，也不要从同步 persona 再新建同名 Agent。
6. **启动工具被缓存回收**：部署将当前已验证 PowerShell 同版本放在 E 盘独立工具目录，并校验 exe 哈希一致；不再把任务指向 Codex 的临时缓存。Node、Codex ACP、Buzz 程序仍是明确依赖，升级或迁移路径需复验。

## 新执行节点 / 新增 Agent 的标准步骤

1. 备份原生身份及记录、runtime，放在任务工作区外，ACL 限当前 Windows 用户与 SYSTEM。新 Agent 用 Buzz 原生创建流程生成身份；迁移现有 Agent 时只沿用旧公钥，不能用重建代替修复。
2. 按 [LD-012](README.zh-CN.md) 装好 E 盘适配器、native Buzz、codex-acp、Codex 登录。准备持久 PowerShell 7 路径，不用下载缓存或随时会清理的临时目录。
3. 将 `headless-host.ps1`、`HeadlessNative.cs` 和 `headless-host.example.json` 复制到受保护 runtime；示例改名为 `headless-host.json`，填写执行计算机名、TLS Relay、原生记录路径、主人及指定 Bot 公钥、已有 Agent 公钥。不包含任何私钥。与 `machine.json` 的 agent id 一一对应，工作区和模型以该文件为准。
4. **先关闭这几个实例的 Desktop “Start on launch”**，等空闲并通过原生界面或主人 `!shutdown` 停止旧运行器。确认旧进程树已消失，再切换；不要并行跑两个相同密钥实例。
5. 同步原生主人策略为 `respond_to: allowlist` 及精确名单，保留已有 persona、姓名、并发数和无关字段；发布前比较旧事件 ID，之后验证签名并读回。不手工伪造 `managed-agents.json`。LD host 的独立名单是运行权威，修改授权时两处一起核对，避免后续桌面编辑覆盖公开声明。
6. 在原 Windows 用户的 PowerShell 7 运行（从仓库根；路径换成真实值）：

   ```powershell
   ./ld/codex/test-headless.ps1
   ./ld/codex/install-headless-tasks.ps1 -Runtime 'E:\Agentic\Buzz-Codex\runtime' -PowerShellExe 'E:\Agentic\Buzz-Codex\tools\powershell-7\pwsh.exe'
   ```

   安装器拒绝覆盖已有同名任务，且不自动启动。新增 Agent 时用 `-Agents newagent` 只注册已配置的新 id；不要删除原任务来通过安装器。新增 id 用小写字母/数字/`_`/`-`，配置内不得重复公钥；新增任务前先检查实际路径、模型与凭据。
7. 停旧实例后，在任务计划程序启动选定任务，或用 `Start-ScheduledTask -TaskName 'LD Buzz Lanzhou Codex astra'` 等精确名称启动。检查 Running、Session 非 0、原公钥 online，再以真实任务验收；Running 本身不是成功。
8. 验收至少包括：主人私聊、主人频道 @、每个指定 Bot 派单、未授权同主人 Bot 被拒绝、E 盘写入与读回、原生回帖、沙箱越界拒绝；关闭再打开 Buzz 仍不新增进程或身份。重启/登录和耐久测试另行记录，不能用单测替代。

**现行方案不要求安装新的遥控插件，也不要求自动登录 Windows。** 计划任务只有在原用户登录后才运行；如果用户主动 `!shutdown`，随后手动启动对应计划任务即可恢复，不要点异地 persona 的 Start。

## 验收记录：2026-10-11

- Buzz Desktop 完全退出时，三种模型分别在自己的 E 盘目录写入、读回测试标记，原生 CLI 用各自原公钥成功回到对应话题。
- 新版本后台加载后，原 Luna DM 收到正常回复；女仆长实际派给 Astra、芙蓉实际派给 Sol，两者完成落盘、读回及签名回帖。不是代用主人签名伪装 Bot 委派。
- 额外用不在名单的 Luna 身份向 Astra 发送标注的负向测试：Relay 接收消息，但 Astra 未创建对应回合、未回帖；既有正向会话不受影响。
- 桌面重新打开后仍只有三个原生 harness，各属计划任务，不是桌面子进程。三个任务的原生 `!shutdown` 正常退出、不自启；再次显式启动可恢复。
- 原有权限/模型/环境变量单测共 8 项通过；新增脚本语法及 C# 编译检查单独执行。初始 LD-012 已真实验过联网批准后工作区外写入仍被拒绝；本轮未扩充可写根。
- **没有实际重启/注销整台用户电脑，没有运行连续 24 小时耐久测试，也没有代替用户操作南京那台电脑。** AtLogOn 配置已核对、同会话手动任务启动和桌面关闭实测通过；下次实际登录后的自动触发仍需用户验收。不将 Windows 登录自启写成零登录的系统服务能力。

## 升级、故障与回退

先读 `runtime\logs\<agent>\current.log` 与任务 LastTaskResult，区分 Relay 掉线、模型限额、CLI 登录失效、ACP 模型超时和 Windows shell 失败。不要看到绿点就重建身份；不要把消息只写进 observer 的 assistant 文本误当已经在 Buzz 回帖。

模型不符、目录不符、未知权限流程应保持拒绝。更换 Codex/ACP/Buzz 后跑 Node 单测、PowerShell/C# 检查及真实往返；核对本次原生订阅字段、observer 行为、凭据格式和权限协议。更改工作区为真实项目时另行审查，不能把整个 E 盘作为写入根。

回退时，先等任务空闲，停止**这三个精确计划任务**并确认其子进程退出；备份后移除对应任务。保留身份、聊天、项目、工作区与模型登录。不做目录级全盘清理。恢复旧 adapter 及桌面托管配置时，移走 `headless-host.json`（保留备份）以解除 Desktop 启动保护，再仅启用一个原身份运行器；不可让旧桌面和新后台同时接管同一公钥。

原生源码核对入口：`crates/buzz-acp/src/config.rs`（订阅和运行配置）、`lib.rs`（author gate / observer）；若上游迁移则按符号查找。本补丁没有修改这些上游源码；升级仍需检查协议兼容，不是“外层就永远不会坏”。生产配置、身份、公钥清单、聊天、日志与完整回执只保存在私有部署位置，不随源码或安装包发布。
