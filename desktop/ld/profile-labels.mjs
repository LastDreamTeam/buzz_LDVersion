// Profile field labels are also upstream grouping identifiers. Translate only
// their rendered text, never the identifiers or their comparisons.
const labels = {
  "Public key": "公钥",
  "Managed by": "管理者",
  "Agent type": "智能体类型",
  Capabilities: "能力",
  Backend: "后端",
  Runtime: "运行环境",
  "Agent profile": "智能体资料",
  "Who can send instructions": "谁可以下达指令",
  "ACP command": "ACP 启动命令",
  "MCP command": "MCP 启动命令",
  "Start on launch": "随应用启动",
  Status: "状态",
  "Last error": "最近错误",
  Visibility: "可见范围",
  Model: "模型",
  Provider: "服务商",
  "Reasoning effort": "推理强度",
  "Working directory": "工作目录",
};
export function profileLabel(value, chinese) {
  return chinese ? (labels[value] ?? value) : value;
}
