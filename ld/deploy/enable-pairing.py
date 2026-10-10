"""Add the upstream ephemeral pairing sidecar to an LD Compose installation.

No relay/Gateway restart, database access, key material, or image download.
Run as the deployment owner: python3 enable-pairing.py /srv/buzz
"""
import datetime
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


root = Path(sys.argv[1]).resolve(strict=True)
assert root.name == "buzz" and (root / ".ld-buzz-20261010").is_file()
compose = root / "config/compose.ld.json"
nginx = root / "config/nginx.conf"
launcher = str(root / "scripts/buzz-compose.sh")
data = json.loads(compose.read_text())
before_nginx = nginx.read_text()
assert "pairing" not in data["services"] and "location = /pair" not in before_nginx
assert before_nginx.count("    location / {") == 1
assert before_nginx.count("  server {") == 1
relay_id = run("bash", launcher, "ps", "-q", "relay").strip()
edge_id = run("bash", launcher, "ps", "-q", "edge").strip()
assert re.fullmatch(r"[0-9a-f]+", relay_id) and re.fullmatch(r"[0-9a-f]+", edge_id)
relay = json.loads(run("docker", "inspect", relay_id))[0]
image = relay["Image"]
assert re.fullmatch(r"sha256:[0-9a-f]{64}", image)
run("docker", "exec", relay_id, "test", "-x", "/usr/local/bin/buzz-pair-relay")
started = relay["State"]["StartedAt"]
gateway_pid = run("systemctl", "show", "hermes-gateway.service", "--property=MainPID", "--value").strip()
backup = root / "backups" / ("pairing-" + datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
backup.mkdir(mode=0o700)
shutil.copy2(compose, backup / compose.name)
shutil.copy2(nginx, backup / nginx.name)
data["services"]["pairing"] = {
    "image": image,
    "pull_policy": "never",
    "entrypoint": ["/usr/local/bin/buzz-pair-relay"],
    "environment": {"BUZZ_PAIR_RELAY_BIND_ADDR": "0.0.0.0:5000"},
    "networks": ["buzz-net"],
    "restart": "unless-stopped",
    "read_only": True,
    "cap_drop": ["ALL"],
    "security_opt": ["no-new-privileges:true"],
    "mem_limit": "48m",
    "cpus": 0.25,
    "pids_limit": 64,
    "logging": {"driver": "json-file", "options": {"max-size": "2m", "max-file": "2"}},
    "healthcheck": {
        "test": ["CMD-SHELL", "bash -ec 'exec 3<>/dev/tcp/127.0.0.1/5000'"],
        "interval": "30s", "timeout": "3s", "retries": 3,
    },
}
route = """    # LD: native ephemeral NIP-AB pairing; no persisted identity or chat data.
    location = /pair {
      limit_conn ld_pair_connections 8;
      limit_req zone=ld_pair_requests burst=5 nodelay;
      client_body_timeout 10s;
      proxy_pass http://pairing:5000;
      proxy_http_version 1.1;
      proxy_set_header Host $http_host;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_connect_timeout 5s;
      proxy_read_timeout 130s;
      proxy_send_timeout 10s;
      proxy_buffering off;
    }
"""
next_nginx = before_nginx.replace("  server {", "  limit_conn_zone $binary_remote_addr zone=ld_pair_connections:1m;\n  limit_req_zone $binary_remote_addr zone=ld_pair_requests:1m rate=2r/s;\n  server {", 1)
next_nginx = next_nginx.replace("    location / {", route + "    location / {", 1)
try:
    compose.write_text(json.dumps(data, indent=2) + "\n")
    run("bash", launcher, "config", "--quiet")
    run("bash", launcher, "up", "-d", "--no-deps", "pairing")
    # Preserve the bind-mounted inode; replacement-by-rename leaves nginx stale.
    nginx.write_text(next_nginx)
    run("docker", "exec", edge_id, "nginx", "-t")
    run("docker", "exec", edge_id, "nginx", "-s", "reload")
    assert json.loads(run("docker", "inspect", relay_id))[0]["State"]["StartedAt"] == started
    assert run("systemctl", "show", "hermes-gateway.service", "--property=MainPID", "--value").strip() == gateway_pid
except Exception:
    nginx.write_text((backup / nginx.name).read_text())
    subprocess.run(["docker", "exec", edge_id, "nginx", "-t"], check=False)
    subprocess.run(["docker", "exec", edge_id, "nginx", "-s", "reload"], check=False)
    subprocess.run(["bash", launcher, "stop", "pairing"], check=False)
    compose.write_text((backup / compose.name).read_text())
    raise
print(json.dumps({"backup": str(backup), "pairing_image": image,
                  "relay_restarted": False, "gateway_restarted": False,
                  "pairing_has_no_host_port": True}))
