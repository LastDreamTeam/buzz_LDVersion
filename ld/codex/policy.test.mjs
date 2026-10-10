import test from 'node:test';
import assert from 'node:assert/strict';
import { Policy } from './policy.mjs';
const workspace = 'E:\\Agentic\\Buzz-Codex\\workspaces\\astra';
const model = 'gpt-6-astra[xhigh]';
test('new sessions cannot introduce MCP servers or extra writable roots', () => {
  const policy = new Policy(workspace, model);
  const out = policy.client({ id: 1, method: 'session/new', params: { cwd: workspace, mcpServers: [{ name: 'escape' }], _meta: { additionalDirectories: ['C:\\'] } } });
  assert.deepEqual(out.params, { cwd: workspace, mcpServers: [] });
  assert.throws(() => policy.client({ id: 2, method: 'session/new', params: { cwd: 'C:\\' } }));
});
test('permissions are cancelled rather than forwarded to auto-approving Buzz', () => {
  const result = new Policy(workspace, model).agent({ id: 10, method: 'session/request_permission', params: { options: [{ optionId: 'yes', kind: 'allow_always' }] } });
  assert.equal(result.reply.result.outcome.outcome, 'cancelled');
  assert.equal(result.forward, undefined);
});
test('no client shell, filesystem, credential request or unsafe mode switch', () => {
  const policy = new Policy(workspace, model); policy.sessions.add('s');
  for (const method of ['terminal/create', 'fs/write_text_file', 'auth/request']) assert.equal(policy.agent({ id: 9, method }).reply.error.code, -32601);
  for (const modeId of ['agent-full-access', 'agent']) assert.throws(() => policy.client({ id: 1, method: 'session/set_mode', params: { sessionId: 's', modeId } }));
  for (const method of ['session/load', 'session/resume', 'session/fork', 'unknown']) assert.throws(() => policy.client({ id: 1, method }));
});
test('refuse model fallback, reject unknown session, preserve normal prompt', () => {
  const policy = new Policy(workspace, model);
  policy.client({ id: 1, method: 'session/new', params: { cwd: workspace } });
  assert.throws(() => policy.agent({ id: 1, result: { sessionId: 's', modes: { currentModeId: 'agent-full-access' } } }));
  policy.client({ id: 2, method: 'session/new', params: { cwd: workspace } });
  policy.agent({ id: 2, result: { sessionId: 's', modes: { currentModeId: 'workspace-write', availableModes: [] }, models: { currentModelId: model } } });
  const message = { id: 3, method: 'session/prompt', params: { sessionId: 's', prompt: [{ type: 'text', text: '开发项目' }] } };
  const guarded = policy.client(message);
  assert.deepEqual(guarded.params.prompt.slice(1), message.params.prompt);
  assert.throws(() => policy.client({ ...message, params: { sessionId: 'alien' } }));
});
test('approve only native structured network-only permission, never a shell escalation', () => {
  const policy = new Policy(workspace, model); policy.sessions.add('s');
  const request = { id: 20, method: 'session/request_permission', params: { sessionId: 's',
    toolCall: { name: 'request_permissions', kind: 'other', rawInput: { cwd: workspace, permissions: { network: { enabled: true } } } },
    options: [{ optionId: 'allow_permissions_turn', kind: 'allow_once' }] } };
  assert.equal(policy.agent(request).reply.result.outcome.optionId, 'allow_permissions_turn');
  const native = structuredClone(request);
  native.params.toolCall.rawInput.environmentId = 'local';
  native.params.toolCall.rawInput.permissions.fileSystem = null;
  assert.equal(policy.agent(native).reply.result.outcome.optionId, 'allow_permissions_turn');
  for (const change of [
    r => r.params.toolCall.name = 'exec_command',
    r => r.params.sessionId = 'alien',
    r => r.params.toolCall.rawInput.cwd = 'C:\\',
    r => r.params.toolCall.rawInput.environmentId = 'remote',
    r => r.params.toolCall.rawInput.permissions.fileSystem = { write: ['C:\\'] },
    r => r.params.toolCall.rawInput.permissions.network.extra = true,
    r => r.params.options[0].optionId = 'allow_permissions_session',
  ]) {
    const invalid = structuredClone(request); change(invalid);
    assert.equal(policy.agent(invalid).reply.result.outcome.outcome, 'cancelled');
  }
});
