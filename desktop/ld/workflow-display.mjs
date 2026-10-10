// Only complete, fixed summaries at the render boundary. Never translate YAML,
// user labels, quoted conditions, or the English parsing/segmentation helpers.
const summaries = {
  "Message posted": "收到消息",
  "Diff posted": "收到代码变更",
  "Reaction added": "收到表情回应",
};
export function workflowDisplay(value, chinese) {
  return chinese ? (summaries[value] ?? value) : value;
}
