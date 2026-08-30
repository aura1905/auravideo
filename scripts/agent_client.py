#!/usr/bin/env python3
"""Minimal client for the NabiVideo agent bridge.

The bridge speaks JSON over loopback HTTP with a per-run token. Bodies must be
UTF-8: Korean subtitle text pushed through a shell's `curl -d` arrives mangled
and the bridge rejects it, which is why this exists as a real client instead of
a shell one-liner.

    python scripts/agent_client.py ping
    python scripts/agent_client.py state
    python scripts/agent_client.py generator.add '{"type":"solid","color":"#ffffff"}'
    python scripts/agent_client.py screenshot '{"time":1.5,"path":"C:/tmp/f.png"}'

Use `--file PATH` (or NABIVIDEO_AGENT_FILE) when the app was started with its
own handshake file, which is how two instances stay out of each other's way.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_HANDSHAKE = os.path.join(os.environ.get("TEMP", "/tmp"), "nabivideo", "agent.json")


def load_handshake(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def call(cmd: str, args: dict, handshake: dict, timeout: float = 120.0):
    body = json.dumps({"cmd": cmd, "args": args}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"http://127.0.0.1:{handshake['port']}/",
        data=body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "X-Agent-Token": handshake["token"],
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')}"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd")
    ap.add_argument("args", nargs="?", default="{}", help="JSON object")
    ap.add_argument("--file", default=os.environ.get("NABIVIDEO_AGENT_FILE") or DEFAULT_HANDSHAKE)
    ap.add_argument("--timeout", type=float, default=120.0)
    ns = ap.parse_args()

    hs = load_handshake(ns.file)
    out = call(ns.cmd, json.loads(ns.args), hs, ns.timeout)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if out.get("ok", True) else 1


if __name__ == "__main__":
    sys.exit(main())
