// OpenAI: enforce protocol boundaries, never approve a shell command by keyword guessing.
export class Policy {
  constructor(workspace, model) { this.workspace = workspace; this.model = model; this.sessions = new Set(); this.pending = new Map(); }
  client(message) {
    if (!message.method) throw new Error('Unsolicited client response');
    const out = structuredClone(message);
    const p = out.params ?? {};
    switch (out.method) {
      case 'initialize':
        out.params = { protocolVersion: p.protocolVersion, clientInfo: p.clientInfo, clientCapabilities: {} };
        break;
      case 'session/new':
        if (p.cwd?.replaceAll('\\', '/').toLowerCase() !== this.workspace.replaceAll('\\', '/').toLowerCase()) throw new Error('Workspace mismatch');
        out.params = { cwd: this.workspace, mcpServers: [] };
        break;
      case 'session/set_mode':
        if (p.modeId !== 'workspace-write') throw new Error('Privilege change refused');
        break;
      case 'session/set_config_option':
        if (!((p.configId === 'model' && p.value === this.model) || (p.configId === 'mode' && p.value === 'workspace-write'))) throw new Error('Unapproved configuration');
        break;
      case 'session/set_model':
        if (p.modelId !== this.model) throw new Error('Model pin mismatch');
        break;
      case 'session/prompt':
        out.params = { sessionId: p.sessionId, prompt: [{ type: 'text', text: 'LD runtime: workspace writes are allowed; out-of-workspace or unsandboxed shell escalation is not. The owner authorizes ordinary network access. Before using the native Buzz CLI or downloads, use the native request_permissions tool to request ONLY network enabled=true (no filesystem permissions). The adapter can approve that specific network grant automatically. Never substitute require_escalated shell execution. Do not print credentials. Publish human-facing replies via the native buzz messages send command.' }, ...p.prompt] };
        break;
      case 'session/cancel':
        out.params = { sessionId: p.sessionId };
        break;
      default: throw new Error('Unsupported client method');
    }
    if (out.method.startsWith('session/') && out.method !== 'session/new' && !this.sessions.has(p.sessionId)) throw new Error('Unknown session');
    if (out.id !== undefined) this.pending.set(out.id, out.method);
    return out;
  }
  agent(message) {
    if (message.method && message.id !== undefined) {
      if (message.method === 'session/request_permission') {
        const p = message.params ?? {};
        const call = p.toolCall ?? {};
        const input = call.rawInput ?? {};
        const grant = input.permissions;
        const networkOnly = this.sessions.has(p.sessionId) && call.name === 'request_permissions'
          && call.kind === 'other' && input.cwd?.replaceAll('\\', '/').toLowerCase() === this.workspace.replaceAll('\\', '/').toLowerCase()
          && [undefined, null, 'local'].includes(input.environmentId) && grant
          && Object.keys(grant).every(x => x === 'network' || (x === 'fileSystem' && grant[x] === null))
          && grant.network?.enabled === true && Object.keys(grant.network).length === 1
          && p.options?.some(x => x.optionId === 'allow_permissions_turn' && x.kind === 'allow_once');
        const outcome = networkOnly ? { outcome: 'selected', optionId: 'allow_permissions_turn' } : { outcome: 'cancelled' };
        return { reply: { jsonrpc: '2.0', id: message.id, result: { outcome } }, denied: !networkOnly };
      }
      return { reply: { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Client-side tools and credential requests are disabled' } }, denied: true };
    }
    const out = structuredClone(message);
    const method = this.pending.get(out.id);
    if (!out.method) {
      if (!method) throw new Error('Unknown agent response');
      this.pending.delete(out.id);
    }
    if (method === 'initialize' && out.result) {
      out.result.agentCapabilities = { ...out.result.agentCapabilities, loadSession: false, sessionCapabilities: {} };
      out.result.authMethods = [];
    }
    if (method === 'session/new' && out.result) {
      if (!out.result.sessionId || out.result.modes?.currentModeId !== 'workspace-write') throw new Error('Workspace sandbox was not selected');
      if (out.result.models?.currentModelId !== this.model) throw new Error('Requested model/effort was not selected');
      this.sessions.add(out.result.sessionId);
      if (out.result.modes) out.result.modes.availableModes = out.result.modes.availableModes.filter(x => x.id === 'workspace-write');
    }
    return { forward: out };
  }
}
