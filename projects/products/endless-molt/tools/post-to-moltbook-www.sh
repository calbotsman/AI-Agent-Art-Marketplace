#!/usr/bin/env bash
# Post to Moltbook (official) using the local stored credential.
#
# Usage:
#   ./tools/post-to-moltbook-www.sh "Title" "Content" [submolt]
#
# Notes:
# - Moltbook requires using https://www.moltbook.com (no redirect) or your Authorization header is lost.
# - API key is read from (in order):
#   1) MOLTBOOK_API_KEY env var
#   2) ~/.config/moltbook/credentials.json (.api_key)
set -euo pipefail

TITLE="${1:-}"
CONTENT="${2:-}"
SUBMOLT="${3:-general}"

if [[ -z "${TITLE}" || -z "${CONTENT}" ]]; then
  echo "Usage: $0 \"Title\" \"Content\" [submolt]" >&2
  exit 2
fi

API_KEY="${MOLTBOOK_API_KEY:-}"
if [[ -z "${API_KEY}" ]]; then
  CREDS="${HOME}/.config/moltbook/credentials.json"
  if [[ -f "${CREDS}" ]]; then
    # Prefer jq, fallback to python if needed.
    if command -v jq >/dev/null 2>&1; then
      API_KEY="$(jq -r '.api_key // empty' "${CREDS}")"
    else
      API_KEY="$(python3 - <<'PY'
import json, os, pathlib
p = pathlib.Path(os.path.expanduser("~/.config/moltbook/credentials.json"))
data = json.loads(p.read_text())
print(data.get("api_key",""))
PY
)"
    fi
  fi
fi

if [[ -z "${API_KEY}" ]]; then
  echo "Missing Moltbook API key. Set MOLTBOOK_API_KEY or create ~/.config/moltbook/credentials.json" >&2
  exit 3
fi

API_BASE="https://www.moltbook.com/api/v1"

payload="$(python3 - <<PY
import json
print(json.dumps({
  "submolt": "${SUBMOLT}",
  "title": "${TITLE}",
  "content": "${CONTENT}",
}))
PY
)"

resp="$(curl -sS -X POST "${API_BASE}/posts" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "${payload}")"

if command -v jq >/dev/null 2>&1; then
  post_id="$(echo "${resp}" | jq -r '.post.id // .id // empty')"
else
  post_id="$(python3 - <<PY
import json, sys
data=json.loads(sys.stdin.read())
post=data.get("post", data)
print(post.get("id",""))
PY
<<<"${resp}")"
fi

if [[ -z "${post_id}" ]]; then
  echo "Failed to post. Response:" >&2
  echo "${resp}" >&2
  exit 4
fi

echo "OK: ${post_id}"
echo "URL: https://www.moltbook.com/p/${post_id}"

