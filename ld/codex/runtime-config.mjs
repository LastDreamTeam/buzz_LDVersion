// OpenAI: native Buzz CLI needs this agent's identity, never the human owner's key.
export const buzzCliEnvironment = ['BUZZ_PRIVATE_KEY', 'BUZZ_RELAY_URL', 'BUZZ_AUTH_TAG'];

export function codingEnvironment(inherited) {
  const env = { ...inherited };
  for (const key of Object.keys(env)) {
    if (/^(BUZZ_|SPRIG_|NOSTR_|OPENAI_API_KEY$|ANTHROPIC_|GOOGLE_API_KEY$|GEMINI_API_KEY$|DEFAULT_AUTH_REQUEST$|MODEL_PROVIDER$|NODE_OPTIONS$)/i.test(key)
      && !buzzCliEnvironment.includes(key)) delete env[key];
  }
  return env;
}

export function codexConfig(model, servers) {
  const selected = model.match(/^(gpt-6-(?:astra|sol|luna))\[(low|medium|high|xhigh|max)\]$/);
  if (!selected) throw new Error('Unapproved model ID');
  return {
    model: selected[1], model_reasoning_effort: selected[2], approval_policy: 'on-request',
    sandbox_mode: 'workspace-write', sandbox_workspace_write: { network_access: true },
    mcp_servers: servers, notify: [], features: { apps: false, plugins: false, remote_plugin: false,
      skill_mcp_dependency_install: false, multi_agent: false, request_permissions_tool: true },
    windows: { sandbox: 'unelevated' },
    // Preserve native CLI auth despite Codex's default *KEY* exclusion, without
    // indiscriminately exposing all inherited provider tokens to shell tools.
    shell_environment_policy: {
      inherit: 'all', ignore_default_excludes: true,
      include_only: [...buzzCliEnvironment, 'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC',
        'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
        'USERNAME', 'OS', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE',
        'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMDATA', 'ALLUSERSPROFILE',
        'GIT_CONFIG_*', 'GIT_AUTHOR_*', 'GIT_COMMITTER_*', 'GIT_TERMINAL_PROMPT'],
    },
  };
}
