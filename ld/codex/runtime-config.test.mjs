import test from 'node:test';
import assert from 'node:assert/strict';
import { codingEnvironment, codexConfig, harnessEnvironment } from './runtime-config.mjs';

test('native harness uses the guarded initial model without redundant model RPCs', () => {
  const input = { BUZZ_ACP_MODEL: 'wrong', BUZZ_ACP_EFFORT_LEVEL: 'low', BUZZ_PRIVATE_KEY: 'fake-key' };
  const env = harnessEnvironment(input, 'guard.exe');
  assert.equal(env.BUZZ_ACP_MODEL, undefined);
  assert.equal(env.BUZZ_ACP_EFFORT_LEVEL, undefined);
  assert.equal(env.BUZZ_ACP_AGENT_COMMAND, 'guard.exe');
  assert.equal(env.BUZZ_PRIVATE_KEY, 'fake-key');
  assert.equal(input.BUZZ_ACP_MODEL, 'wrong');
  for (const model of ['gpt-6-astra[xhigh]', 'gpt-6-sol[high]', 'gpt-6-luna[medium]']) {
    assert.equal(codexConfig(model, {}).model, model.split('[')[0]);
  }
});

test('preserve native per-agent Buzz identity but not harness or provider credentials', () => {
  const env = codingEnvironment({ BUZZ_PRIVATE_KEY: 'fake-agent-key', BUZZ_RELAY_URL: 'https://relay.invalid',
    BUZZ_AUTH_TAG: 'fake-attestation', BUZZ_ACP_PRIVATE_KEY: 'fake-harness-key',
    OPENAI_API_KEY: 'fake-provider-key', NODE_OPTIONS: '--inspect', PATH: 'bin' });
  assert.deepEqual(env, { BUZZ_PRIVATE_KEY: 'fake-agent-key', BUZZ_RELAY_URL: 'https://relay.invalid',
    BUZZ_AUTH_TAG: 'fake-attestation', PATH: 'bin' });
});

test('native CLI can communicate without broadening filesystem or MCP authority', () => {
  const cfg = codexConfig('gpt-6-astra[xhigh]', { unrelated: { enabled: false } });
  assert.equal(cfg.model_reasoning_effort, 'xhigh');
  assert.equal(cfg.sandbox_mode, 'workspace-write');
  assert.equal(cfg.sandbox_workspace_write.network_access, true);
  assert.equal(cfg.sandbox_workspace_write.writable_roots, undefined);
  assert.equal(cfg.approval_policy, 'on-request');
  assert.equal(cfg.features.plugins, false);
  assert.equal(cfg.features.remote_plugin, false);
  assert.equal(cfg.features.skill_mcp_dependency_install, false);
  assert.equal(cfg.features.request_permissions_tool, true);
  assert.deepEqual(cfg.mcp_servers, { unrelated: { enabled: false } });
  assert(cfg.shell_environment_policy.include_only.includes('BUZZ_PRIVATE_KEY'));
  assert(!cfg.shell_environment_policy.include_only.includes('*'));
  assert(!cfg.shell_environment_policy.include_only.includes('OPENAI_API_KEY'));
  assert.throws(() => codexConfig('auto', {}));
});
