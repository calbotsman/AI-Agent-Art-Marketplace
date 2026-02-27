#!/usr/bin/env bash

set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  "$(dirname "$0")/run_scout_telegram.sh" "Night plan is ready."
else
  "$(dirname "$0")/run_scout_telegram.sh" "$@"
fi
