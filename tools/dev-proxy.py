#!/usr/bin/env python3
"""Local dev server for the site plus the /api/ask proxy.

Serves the repo as static files and answers POST /api/ask by calling BotDojo
with the key from .env. The key stays in this process: the browser only ever
talks to this server.

    python3 tools/dev-proxy.py          # http://localhost:8000

In production the same contract is implemented by functions/api/ask.js.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_BODY = 64 * 1024


def load_env():
    """Read .env into a dict. No dependency on python-dotenv."""
    env = {}
    path = ROOT / ".env"
    if not path.exists():
        sys.exit("No .env found. Copy .env.example to .env and fill in BOTDOJO_API_KEY.")

    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")

    missing = [k for k in (
        "BOTDOJO_API_KEY", "BOTDOJO_ACCOUNT_ID",
        "BOTDOJO_PROJECT_ID", "BOTDOJO_FLOW_ID", "BOTDOJO_BASE_URL",
    ) if not env.get(k)]
    if missing:
        sys.exit("Missing in .env: " + ", ".join(missing))

    return env


ENV = load_env()
FLOW_URL = (
    f"{ENV['BOTDOJO_BASE_URL']}/accounts/{ENV['BOTDOJO_ACCOUNT_ID']}"
    f"/projects/{ENV['BOTDOJO_PROJECT_ID']}/flows/{ENV['BOTDOJO_FLOW_ID']}/run"
)


def call_flow(message, session_id):
    """Conversation memory lives on BotDojo's side, keyed by flow_session_id.

    Omitting it starts a new session; passing one back continues that
    conversation, so prior turns do not need replaying.
    """
    options = {"stream": "none"}
    if session_id:
        options["flow_session_id"] = session_id

    payload = json.dumps({"options": options, "body": {"user_message": message}})
    request = urllib.request.Request(
        FLOW_URL,
        data=payload.encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": ENV["BOTDOJO_API_KEY"],
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        data = json.load(response)

    reply = (
        (data.get("response") or {}).get("text_output")
        or (data.get("aiMessage") or {}).get("content")
        or ""
    ).strip()

    return reply, data.get("flow_session_id")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _json(self, status, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.split("?")[0] != "/api/ask":
            self._json(404, {"error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0

        if length <= 0 or length > MAX_BODY:
            self._json(400, {"error": "Bad request body."})
            return

        try:
            payload = json.loads(self.rfile.read(length))
            message = str(payload.get("message", "")).strip()
            session_id = payload.get("sessionId") or None
        except (ValueError, AttributeError):
            self._json(400, {"error": "Could not parse the request."})
            return

        if not message:
            self._json(400, {"error": "Message is required."})
            return
        if len(message) > 2000:
            self._json(400, {"error": "Message is too long."})
            return

        try:
            reply, new_session = call_flow(message, session_id)
        except urllib.error.HTTPError as exc:
            detail = ""
            try:
                detail = exc.read().decode("utf-8", "replace")
            except Exception:
                pass

            # A session that BotDojo no longer knows about. Tell the client so it
            # can drop the stale id and start a fresh one, rather than wedging.
            if session_id and "error loading session" in detail.lower():
                self._json(409, {
                    "error": "That conversation expired. Starting a new one.",
                    "code": "session_invalid",
                })
                return

            self._json(502, {"error": f"The assistant is unavailable ({exc.code})."})
            return
        except Exception:
            self._json(502, {"error": "Could not reach the assistant."})
            return

        if not reply:
            self._json(502, {"error": "The assistant returned an empty response."})
            return

        self._json(200, {"reply": reply, "sessionId": new_session})

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving {ROOT} on http://localhost:{port}  (POST /api/ask is proxied)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
