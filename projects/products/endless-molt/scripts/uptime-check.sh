#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://www.endlessmolt.xyz}"

check() {
  local path="$1"
  local url="${BASE_URL}${path}"
  curl -fsS -o /dev/null -I "$url"
  echo "OK  $url"
}

check "/"
check "/listings"
check "/api/listings"
check "/api/search?q=health"

echo "Tip: run 'npm run monitor:prod' for deeper contract/header/rate-limit checks."
