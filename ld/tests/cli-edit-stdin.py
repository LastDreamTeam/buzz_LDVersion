"""OpenAI: black-box regression against the real CLI, with a loopback HTTP fixture."""
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

event_id = "12" * 32
channel_id = "12345678-1234-4234-9234-123456789abc"
submitted = []


class Relay(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.path == "/query":
            response = [{"id": event_id, "kind": 9, "content": "original",
                         "tags": [["h", channel_id]]}]
        elif self.path == "/events":
            submitted.append(body)
            response = {"accepted": True, "event_id": body["id"], "message": ""}
        else:
            self.send_error(404)
            return
        data = json.dumps(response).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    with ThreadingHTTPServer(("127.0.0.1", 0), Relay) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        env = {k: v for k, v in os.environ.items() if not k.startswith("BUZZ_")}
        env.update(BUZZ_PRIVATE_KEY="0" * 63 + "1",
                   BUZZ_RELAY_URL=f"http://127.0.0.1:{server.server_port}")

        def edit(argument, stdin):
            return subprocess.run([sys.argv[1], "messages", "edit", "--event", event_id,
                                   "--content", argument], input=stdin.encode(),
                                  env=env, capture_output=True, timeout=15)

        try:
            for argument, stdin, expected in [
                ("-", "中文回复 🐝\n第二行 `code` $var 'quoted'\n", "中文回复 🐝\n第二行 `code` $var 'quoted'\n"),
                ("unchanged literal", "ignored stdin", "unchanged literal"),
                ("-", "-", "-"),
            ]:
                result = edit(argument, stdin)
                assert result.returncode == 0, result.stderr.decode()
                event = submitted.pop()
                assert event["kind"] == 40003, event
                assert event["content"] == expected, event
                assert ["h", channel_id] in event["tags"], event
                assert any(t[:2] == ["e", event_id] for t in event["tags"]), event
                assert len(event["sig"]) == 128, event
            result = edit("-", "中" * (2 * 1024 * 1024))
            assert result.returncode != 0, "Oversized stdin accepted"
            assert not submitted, "Oversized edit reached relay"
            print("PASS: real CLI stdin/literal/Unicode/newline/signing/size edit contract")
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
