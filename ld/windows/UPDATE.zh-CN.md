# Windows 桌面端更新与回退

LD 版使用上游 Tauri NSIS 安装方式，保持 `xyz.block.buzz.app` 应用标识与 `buzz-desktop` 系统凭据服务名。它不是新的独立账号客户端；不要与官方版同时运行。

## 更新

1. 从本 Fork [Releases](https://github.com/LastDreamTeam/buzz_LDVersion/releases) 获取已发布安装包，或从 `main_1` 的成功 `LD Chinese Desktop` 构建获取附件。核对 `SOURCE_COMMIT` 是需要的源码；按 `SHA256SUMS` 校验安装包。Actions 临时附件仅保留 7 天，Release 附件单独发布，不受这个临时附件保留期约束。
2. 保存未发送内容，退出 Buzz。不要点“退出登录 / Sign out”：该原生功能会清理本地身份和状态，不是普通关闭窗口。
3. 用 PowerShell 7 执行下面的备份脚本；目录必须是全新的，并位于来源目录之外。脚本不终止进程，发现 Buzz/本机智能体运行中会停止。

   ```powershell
   pwsh -File ./ld/windows/backup-before-update.ps1 `
     -InstallDirectory 'E:\app\Buzz' `
     -BackupDirectory 'E:\Backups\Buzz-before-update-YYYYMMDD-HHmmss'
   ```

   备份包含旧程序、Roaming/Local 下的 Buzz 数据、`.buzz` 工作目录；逐文件 SHA-256 对照。脚本还只读取 `secrets.buzz-desktop` 这一项 Windows 凭据，将其用 **DPAPI CurrentUser** 加密并解密验证，不显示或上传秘密。目录 ACL 仅允许当前 Windows 用户和 SYSTEM。发现重解析点时停止，避免误跟随到其他数据。

   此加密备份适用于同一 Windows 用户环境的回退，**不是跨电脑可移植的身份备份**。换电脑仍应使用 Buzz 原生加密身份导出。不要上传整个备份目录到 Git。

4. 正常交互安装：运行已校验的 `Buzz_…_x64-setup.exe`，沿用原安装位置；不要勾选删除应用数据。自动化维护可以使用该版本 Tauri 原生参数 `/S /UPDATE /D=原安装路径`，其中 `/D=` 放最后；`/UPDATE` 跳过卸载旧程序和清理应用数据。不要加入 `/R`，先完成安装后校验再启动。
5. 启动 Buzz，核对版本、原身份、社区及频道列表。设置 → 外观 → 界面语言可中英切换。确认切换会重载界面，先保存编辑。

默认仍是未签名预览安装包。校验和证明下载文件对应构建附件，不等于代码签名或已通过全部安全审计；不能因此关闭 Windows 防护。

## 回退

- 先退出 Buzz。保留出问题的新程序和当前数据快照，以免回退误丢安装后新增内容。
- 优先只恢复备份中的旧程序文件以及必要的 Buzz 安装记录/快捷方式，再打开检查；不要先清空 AppData 或钥匙串。
- 只有确认存在数据迁移兼容问题时，才在明确授权后恢复对应的数据备份。整个目录回退会丢失快照之后的本机设置、草稿等变化。
- `buzz-secrets.dpapi` 的用途是最后的凭据恢复保障，正常更新不应写入钥匙串。自动脚本不提供静默覆盖系统凭据的操作。当前凭据一致时不恢复它。
- 维护回执应记录：源码 SHA、构建 URL、安装包及主程序 SHA-256、旧/新版本、备份位置、安装退出码、身份指纹是否一致、界面验收结果。回执和截图如含私人数据，仅保存本机受保护目录。

## 后续如何获得更新

从 `0.5.29-ld.4` 开始，设置 → 更新只检查本 Fork 的最新公开 Release，校验 LD 版本格式及三项附件后提供发布页下载入口；网络失败会显示错误。它不会自动安装未签名程序，也不自动切回官方版。`ld.3` 及更早维护版尚无此检查功能，首次须手动更新。

后续先在 `main_1` 合并并验收上游更新、运行 LD 构建、发布对应的安装包 / `SOURCE_COMMIT` / `SHA256SUMS` 三项附件，再按同一流程覆盖更新。草稿和标记为 GitHub prerelease 的发布不作为当前检查源；维护预览质量和未签名边界仍应在公开 Release 说明中明确。不要把“官方最新”按钮等同于“LD 中文最新版”。

安装参数核查基于固定的 [Tauri CLI 2.11.4 NSIS 模板](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi)。升级 Tauri 后须重新检查模板行为。
