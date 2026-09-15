#!/bin/zsh
set -e
cd "${0:A:h}"
PORT="${PORT:-5179}"
if ! curl -fsS --noproxy 127.0.0.1 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  nohup node server.mjs > /tmp/worldwalker.log 2>&1 &
  for _ in {1..30}; do
    curl -fsS --noproxy 127.0.0.1 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break
    sleep 0.1
  done
fi
open -a "Brave Browser" "http://127.0.0.1:${PORT}"
