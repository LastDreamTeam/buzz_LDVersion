import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Policy } from './policy.mjs';
import { codingEnvironment, codexConfig, harnessEnvironment } from './runtime-config.mjs';

// OpenAI: this adapter is a removable LD integration, not an upstream Buzz security feature.
const dir = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'machine.json'), 'utf8'));
const name = process.env.LD_BUZZ_AGENT;
const agent = cfg.agents[name];
if (!agent || !['harness', 'guard'].includes(process.argv[2])) throw new Error('Unconfigured agent/role');
const workspace = fs.realpathSync.native(agent.workspace);
if (workspace.toLowerCase() !== path.resolve(agent.workspace).toLowerCase() || path.parse(workspace).root.toLowerCase() !== 'e:\\') throw new Error('Require real E-drive workspace without junction');
process.chdir(workspace);
let env = { ...process.env, TEMP: path.join(workspace, '.tmp'), TMP: path.join(workspace, '.tmp') };
fs.mkdirSync(env.TEMP, { recursive: true });
let child;
if (process.argv[2] === 'harness') {
  if (fs.existsSync(path.join(dir, 'headless-host.json')) && env.LD_BUZZ_HEADLESS !== '1') {
    throw new Error('This identity is hosted independently on its execution computer; use Buzz messages, not Desktop Start.');
  }
  env = harnessEnvironment(env, path.join(dir, 'buzz-ld-codex.exe'));
  child = spawn(cfg.harness, [], { cwd: workspace, env, stdio: 'inherit', windowsHide: true });
} else {
  env = codingEnvironment(env);
  const configText = fs.readFileSync(path.join(cfg.codexHome, 'config.toml'), 'utf8');
  const servers = {};
  for (const line of configText.split(/\r?\n/)) {
    if (!/^\s*\[mcp_servers\./.test(line)) continue;
    const match = line.match(/^\s*\[mcp_servers\.([a-zA-Z0-9_-]+)(?:\.[a-zA-Z0-9_-]+)?\]\s*(?:#.*)?$/);
    if (!match) throw new Error('Unrecognized MCP table; inspect configuration before launch');
    servers[match[1]] = { enabled: false };
  }
  env.CODEX_HOME = cfg.codexHome;
  env.INITIAL_AGENT_MODE = 'workspace-write';
  env.CODEX_CONFIG = JSON.stringify(codexConfig(agent.model, servers));
  const policy = new Policy(workspace, agent.model);
  child = spawn(cfg.node, [cfg.acpModule], { cwd: workspace, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const diagnostic = process.env.LD_BUZZ_DIAGNOSTIC === '1';
  const send = (stream, object) => { if (!stream.destroyed) stream.write(JSON.stringify(object) + '\n'); };
  const fail = () => { process.stderr.write('[LD Codex guard] protocol boundary failed; stopping.\n'); child.kill(); process.exitCode = 1; };
  function lines(stream, accept) {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', data => {
      buffer += data;
      if (Buffer.byteLength(buffer) > 8 * 1024 * 1024) return fail();
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        try { accept(JSON.parse(line)); } catch { fail(); return; }
      }
    });
  }
  lines(process.stdin, message => {
    if (diagnostic) process.stderr.write('[LD diagnostic] client ' + (message.method ?? 'response') + '\n');
    try { send(child.stdin, policy.client(message)); }
    catch (error) { if (message.id !== undefined) send(process.stdout, { jsonrpc: '2.0', id: message.id, error: { code: -32602, message: 'LD guard: ' + error.message } }); }
  });
  lines(child.stdout, message => {
    if (diagnostic) process.stderr.write('[LD diagnostic] agent ' + (message.method ?? 'response') + '\n');
    if (diagnostic && message.method === 'session/request_permission') {
      const p = message.params ?? {}, call = p.toolCall ?? {}, input = call.rawInput ?? {};
      process.stderr.write('[LD permission shape] ' + JSON.stringify({ knownSession: policy.sessions.has(p.sessionId), name: call.name, kind: call.kind, inputKeys: Object.keys(input), cwd: input.cwd, environmentId: input.environmentId, permissions: input.permissions, options: p.options?.map(x => ({ optionId: x.optionId, kind: x.kind })) }) + '\n');
    }
    const action = policy.agent(message);
    if (action.reply) send(child.stdin, action.reply);
    if (action.forward) send(process.stdout, action.forward);
    if (action.denied) process.stderr.write('[LD Codex guard] Out-of-sandbox approval/client tool refused; human review required.\n');
  });
  // Adapter debug output can include config, prompts and tool output: discard it, not user messages.
  child.stderr.on('data', data => { if (diagnostic) process.stderr.write('[LD diagnostic] child stderr bytes: ' + data.length + '\n'); });
  process.stdin.on('end', () => child.stdin.end());
  process.stdin.on('close', () => child.kill());
}
child.on('error', () => { process.stderr.write('[LD Codex guard] runtime unavailable.\n'); process.exitCode = 1; });
child.on('close', code => {
  process.exitCode = process.exitCode ?? code ?? 1;
  if (process.argv[2] === 'guard') process.stdin.destroy();
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(); process.exit(0); });
