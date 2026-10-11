# LD-014：桌面邀请链接失败的原生配置修复

## 根因与修复

本次服务器允许的 CORS 来源只有社区外网 HTTPS origin。Windows Buzz 使用 WebView2，实际页面 origin 为 `http://tauri.localhost`。因此同一份合法 NIP-98 邀请请求在原生 CLI/HTTP 中得到 200，桌面 fetch 却因缺少匹配的 `Access-Control-Allow-Origin` 失败。

使用原生 `BUZZ_CORS_ORIGINS`，没有修改 Buzz 源码、关闭鉴权、添加通配符或放开匿名邀请。示例见 [Compose 片段](desktop-cors.override.example.json)：

1. 备份当前 Compose 覆盖文件并确认 Relay 服务名。
2. 将示例中的 HTTPS origin 换为真实已配置来源；**保留已有合法来源**，再追加 `http://tauri.localhost`、`https://tauri.localhost`、`tauri://localhost`。不要直接用示例覆盖整个部署文件。
3. 用当前部署同一组 Compose 文件执行 `config --quiet`，再 `up -d --no-deps relay`。这会短暂重建 Relay 并使 WebSocket 重连，应选空闲窗口；不会主动重启 Hermes。不要执行 `compose down` 或删除卷。
4. 用短时、单次原生邀请请求检查 HTTP 状态及 CORS 头，再在真实桌面“邀请加入社区”窗口验收生成的链接。只检查 OPTIONS 或 HTTP 200 不能替代 WebView 验收。

## 实机记录与边界

2026-10-11：修复前原生 NIP-98 POST 为 200，但响应无匹配来源头；修复后同一桌面来源为 200 且头部正确。真实 Windows 客户端生成了有效 HTTPS 邀请链接，原来的“无法创建邀请链接”已消失。API 测试邀请设置为 60 秒、最多使用 1 次；邀请令牌、URL、签名与生产 origin 不提交仓库。

这只解决本次 CORS 根因。其他安装仍需分别排查主人权限、邀请功能配置、NIP-98 时钟/签名、TLS 和反向代理，不能把所有失败都归于 CORS。允许桌面 origin 不等于允许该 origin 的所有用户绕过服务器身份及成员权限。

回滚：先检查部署文件是否已有后续变化，恢复本次修改前的 `BUZZ_CORS_ORIGINS`，校验 Compose 后仅重建 Relay。不要覆盖数据库、`.env`、pairing 或其他服务配置。跟随官方升级时复验三个桌面 origin 是否仍适用，官方默认覆盖后可移除此额外配置。
