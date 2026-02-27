#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/calbotsman/clawd"
STATE_FILE="${ROOT}/studio/PIPELINE/creative-loop/STATE.md"
REVIEW_FILE="${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/review/LATEST.md"
DIRECTION_FILE="${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/direction/LATEST.md"
STRATEGY_FILE="${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/strategy/LATEST.md"
RESEARCH_FILE="${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/research/LATEST.md"
LOOP_LOG_FILE="${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/LOOP_LOG.md"
LOOP_POLICY_FILE="${ROOT}/studio/PIPELINE/creative-loop/LOOP_POLICY.json"

OUT_ROOT="${OUT_ROOT:-${ROOT}/output/creative-learning-loop}"
AUTO_RESET_IF_DONE="${AUTO_RESET_IF_DONE:-1}"
RUN_STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="${OUT_ROOT}/${RUN_STAMP}"
TESTS_OUT_DIR="${RUN_DIR}/tests"
SNAPSHOT_DIR="${RUN_DIR}/artifacts"
LEARNING_FILE="${RUN_DIR}/self-learning-input.md"
ZARA_CRITIQUE_DIR="${ROOT}/agents/zara/50 - Critiques"
ZARA_CRITIQUE_FILE="${ZARA_CRITIQUE_DIR}/Critique - Autonomous Creative Cycle - ${RUN_STAMP}.md"
INFLUENCE_DIGEST_MARKDOWN="${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/signals/logo-influence-tag-packet.md"
INFLUENCE_DIGEST_JSON="${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/signals/logo-influence-tag-packet.json"
LOGO_INFLUENCE_CATALOG="${ROOT}/data/logo-influences/meta/logo-catalog.jsonl"

STAGE1_ID="7338e783-5ef3-4e72-b7fc-d788f781b6f5"
STAGE2_ID="bbd7d4fa-8065-431b-8958-59ea7bf3fb6b"
STAGE3_ID="53f06530-834e-445f-ac71-c71f053c549a"
STAGE4_ID="8282fb92-5dd4-426d-8ef6-b9fb946f41e7"

log() {
  printf '[autonomous-creative-cycle] %s\n' "$*"
}

extract_value() {
  local key="$1"
  local file="$2"
  if [[ ! -f "$file" ]]; then
    printf ''
    return 0
  fi
  local value
  value="$(grep -E "^${key}:" "$file" | head -n 1 | sed -E "s/^${key}:[[:space:]]*//")"
  printf '%s' "$value"
}

reset_loop_if_done() {
  if [[ ! -f "$STATE_FILE" ]]; then
    return 0
  fi
  if ! grep -q '^STATE:[[:space:]]*DONE' "$STATE_FILE"; then
    return 0
  fi

  if [[ "$AUTO_RESET_IF_DONE" != "1" ]]; then
    log "Loop is DONE and AUTO_RESET_IF_DONE=0, skipping reset."
    return 0
  fi

  local next_round profile current_round
  next_round="$(extract_value "NEXT_ROUND" "$REVIEW_FILE")"
  profile="$(extract_value "PROFILE_ID" "$REVIEW_FILE")"
  current_round="$(extract_value "CURRENT_ROUND" "$STATE_FILE")"

  if [[ -z "$profile" ]]; then
    profile="packaging"
  fi
  if [[ -z "$next_round" ]]; then
    if [[ -n "$current_round" ]]; then
      next_round="$((current_round + 1))"
    else
      next_round="1"
    fi
  elif [[ -n "$current_round" && "$next_round" == "$current_round" ]]; then
    next_round="$((current_round + 1))"
  fi

  cat >"$STATE_FILE" <<EOF_STATE
STATE: ACTIVE
CURRENT_ROUND: ${next_round}
ACTIVE_PROFILE: ${profile}
LAST_DECISION: RESET
UPDATED_AT_ET: $(TZ=America/New_York date +%Y-%m-%d)
NOTES: Autonomous cycle reopened loop for fresh outputs.
EOF_STATE

  if [[ -f "$REVIEW_FILE" ]]; then
    cp "$REVIEW_FILE" "${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/review/reset-backup-${RUN_STAMP}.md"
  fi

  cat >"$REVIEW_FILE" <<EOF_REVIEW
ROUND: ${next_round}
PROFILE_ID: ${profile}
DECISION: REVISE
NEXT_ROUND: ${next_round}
NOTES: Loop reopened by autonomous cycle runner.
EOF_REVIEW

  printf 'Autonomous cycle reset loop to ROUND %s PROFILE %s.\n' "$next_round" "$profile" >>"$LOOP_LOG_FILE"
  log "Reset loop from DONE to ACTIVE at round ${next_round}."
}

open_review_gate_if_needed() {
  if [[ ! -f "$STATE_FILE" || ! -f "$REVIEW_FILE" ]]; then
    return 0
  fi

  local state decision current_round profile
  state="$(extract_value "STATE" "$STATE_FILE")"
  decision="$(extract_value "DECISION" "$REVIEW_FILE")"
  current_round="$(extract_value "CURRENT_ROUND" "$STATE_FILE")"
  profile="$(extract_value "ACTIVE_PROFILE" "$STATE_FILE")"

  if [[ "$state" != "ACTIVE" ]]; then
    return 0
  fi
  if [[ "$decision" != "SHIP" && "$decision" != "STOP" ]]; then
    return 0
  fi

  if [[ -z "$current_round" ]]; then
    current_round="1"
  fi
  if [[ -z "$profile" ]]; then
    profile="packaging"
  fi

  cp "$REVIEW_FILE" "${ROOT}/studio/PIPELINE/creative-loop/ARTIFACTS/review/reset-backup-${RUN_STAMP}-active.md"
  cat >"$REVIEW_FILE" <<EOF_REOPEN
ROUND: ${current_round}
PROFILE_ID: ${profile}
DECISION: REVISE
NEXT_ROUND: ${current_round}
NOTES: Active loop requires review gate reopened by autonomous cycle runner.
EOF_REOPEN

  printf 'Autonomous cycle reopened review gate at ROUND %s PROFILE %s.\n' "$current_round" "$profile" >>"$LOOP_LOG_FILE"
  log "Reopened review gate for ACTIVE state at round ${current_round}."
}

run_stage() {
  local stage_id="$1"
  local stage_name="$2"
  local attempt max_attempts
  max_attempts=3
  for attempt in $(seq 1 "$max_attempts"); do
    log "Running ${stage_name} (${stage_id}) [attempt ${attempt}/${max_attempts}]..."
    if openclaw cron run "$stage_id" --force --expect-final --timeout 90000 >/tmp/autonomous-cycle-"${stage_id}".log 2>&1; then
      return 0
    fi
    cat /tmp/autonomous-cycle-"${stage_id}".log >&2 || true
    launchctl kickstart -k "gui/$(id -u)/com.tcr.openclaw.guardian" >/dev/null 2>&1 || true
    sleep 6
  done
  return 1
}

run_stage_expect_round() {
  local stage_id="$1"
  local stage_name="$2"
  local target_file="$3"
  local expected_round="$4"
  local attempt max_attempts observed_round before_mtime after_mtime
  max_attempts=3
  before_mtime="$(stat -f '%m' "$target_file" 2>/dev/null || printf '0')"

  for attempt in $(seq 1 "$max_attempts"); do
    run_stage "$stage_id" "$stage_name" || true
    observed_round="$(extract_value "ROUND" "$target_file")"
    after_mtime="$(stat -f '%m' "$target_file" 2>/dev/null || printf '0')"
    if [[ -n "$observed_round" && "$observed_round" == "$expected_round" && "$after_mtime" -gt "$before_mtime" ]]; then
      return 0
    fi
    log "${stage_name} did not write expected ROUND ${expected_round} to ${target_file} (observed: ${observed_round:-missing}, mtime: ${before_mtime}->${after_mtime}) [check ${attempt}/${max_attempts}]"
    before_mtime="$after_mtime"
    sleep 4
  done

  log "ERROR: ${stage_name} failed to produce ROUND ${expected_round} in ${target_file}."
  return 1
}

write_research_fallback() {
  local expected_round="$1"
  node - "$RESEARCH_FILE" "$LOOP_POLICY_FILE" "$LOOP_LOG_FILE" "$expected_round" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [researchPath, policyPath, loopLogPath, expectedRound] = process.argv.slice(2);
const policy = fs.existsSync(policyPath)
  ? JSON.parse(fs.readFileSync(policyPath, "utf8"))
  : { directorGate: { minReviewsBeforeShip: 3, targetAcceptanceReview: 3, maxReviews: 4 } };
const round = expectedRound || "1";
const content = [
  `ROUND: ${round}`,
  "",
  "## Problem Frame",
  "Define the project problem for Sol Vida in one short paragraph focused on clarity, hierarchy, and material truth.",
  "",
  "## Evidence / Receipts",
  "- Placeholder receipt 1",
  "- Placeholder receipt 2",
  "- Placeholder receipt 3",
  "",
  "## Opportunity Areas",
  "1. Opportunity one",
  "2. Opportunity two",
  "3. Opportunity three",
  "",
  "## Constraints",
  "- Avoid generic wellness wallpaper aesthetics.",
  "- Prioritize clarity, hierarchy, and material truth.",
  "",
  "## Profile Context",
  "- Candidate profiles: logo, typography, packaging, website",
  "- Recommended profile for this round: packaging",
  "- Provide 2 bullets for why this profile best matches the round objective.",
  "",
  "## Loop Context",
  `- Loop policy: min ${policy.directorGate.minReviewsBeforeShip}, target ${policy.directorGate.targetAcceptanceReview}, max ${policy.directorGate.maxReviews}.`,
  "",
  "## Handoff to Strategy",
  "- Provide 3 concise bullets describing what strategy must decide next."
].join("\n");

fs.writeFileSync(researchPath, `${content}\n`);
fs.writeFileSync(path.join(path.dirname(researchPath), `round-${round}.md`), `${content}\n`);
fs.appendFileSync(loopLogPath, `Research fallback wrote ROUND ${round} with profile recommendation.\n`);
NODE
}

build_logo_influence_signal_packet() {
  if [[ ! -f "$LOGO_INFLUENCE_CATALOG" ]]; then
    log "Logo catalog missing; skipping tag packet generation: $LOGO_INFLUENCE_CATALOG"
    return 0
  fi

  node "${ROOT}/scripts/build_logo_influence_tag_digest.mjs" \
    --catalog "$LOGO_INFLUENCE_CATALOG" \
    --markdown "$INFLUENCE_DIGEST_MARKDOWN" \
    --json "$INFLUENCE_DIGEST_JSON" || log "Unable to update logo tag signal packet."
}

append_logo_influence_signal_packet() {
  local target_file="$1"

  if [[ ! -f "$target_file" || ! -f "$INFLUENCE_DIGEST_MARKDOWN" ]]; then
    return 0
  fi

  if rg -q "Logo Influence Signal Packet" "$target_file"; then
    return 0
  fi

  printf '\n\n%s\n' "$(cat "$INFLUENCE_DIGEST_MARKDOWN")" >> "$target_file"
}

write_strategy_fallback() {
  local expected_round="$1"
  node - "$RESEARCH_FILE" "$STRATEGY_FILE" "$LOOP_POLICY_FILE" "$LOOP_LOG_FILE" "$expected_round" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [researchPath, strategyPath, policyPath, loopLogPath, expectedRound] = process.argv.slice(2);
const research = fs.existsSync(researchPath) ? fs.readFileSync(researchPath, "utf8") : "";
const policy = fs.existsSync(policyPath)
  ? JSON.parse(fs.readFileSync(policyPath, "utf8"))
  : { directorGate: { minReviewsBeforeShip: 3, targetAcceptanceReview: 3, maxReviews: 4 } };

const readValue = (raw, key) => {
  const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : "";
};

const round = readValue(research, "ROUND") || expectedRound || "1";
const profile = "packaging";

const content = [
  `ROUND: ${round}`,
  `PROFILE_ID: ${profile}`,
  `PROFILE_PATH: /Users/calbotsman/clawd/studio/PIPELINE/profiles/${profile}.json`,
  "",
  "## Audience",
  "Define primary audience in 2 concise bullets.",
  "",
  "## Positioning",
  "One short positioning paragraph.",
  "",
  "## Message Pillars",
  "1. Pillar one",
  "2. Pillar two",
  "3. Pillar three",
  "",
  "## Proof Points",
  "- Proof point 1",
  "- Proof point 2",
  "- Proof point 3",
  "",
  "## Strategic Risks",
  "- Risk 1",
  "- Risk 2",
  "",
  "## Designer Profile Selection",
  "- Why this profile is correct for this round.",
  "- What constraints this profile imposes on execution.",
  "",
  "## Loop Context",
  `- min ${policy.directorGate.minReviewsBeforeShip}, target ${policy.directorGate.targetAcceptanceReview}, max ${policy.directorGate.maxReviews} reviews.`,
  "",
  "## Handoff to Creative Direction",
  "Provide 3 concise bullets for direction decisions."
].join("\n");

fs.writeFileSync(strategyPath, `${content}\n`);
fs.writeFileSync(path.join(path.dirname(strategyPath), `round-${round}.md`), `${content}\n`);
fs.appendFileSync(loopLogPath, `Strategy fallback wrote ROUND ${round} PROFILE ${profile}.\n`);
NODE
}

write_direction_fallback() {
  local expected_round="$1"
  node - "$STRATEGY_FILE" "$DIRECTION_FILE" "$LOOP_POLICY_FILE" "$LOOP_LOG_FILE" "$expected_round" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [strategyPath, directionPath, policyPath, loopLogPath, expectedRound] = process.argv.slice(2);
const strategy = fs.existsSync(strategyPath) ? fs.readFileSync(strategyPath, "utf8") : "";
const policy = fs.existsSync(policyPath)
  ? JSON.parse(fs.readFileSync(policyPath, "utf8"))
  : { directorGate: { minReviewsBeforeShip: 3, targetAcceptanceReview: 3, maxReviews: 4 } };

const readValue = (raw, key) => {
  const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : "";
};

const round = readValue(strategy, "ROUND") || expectedRound || "1";
const profile = readValue(strategy, "PROFILE_ID") || "packaging";
const content = [
  `ROUND: ${round}`,
  `PROFILE_ID: ${profile}`,
  `PROFILE_PATH: /Users/calbotsman/clawd/studio/PIPELINE/profiles/${profile}.json`,
  "",
  "## Creative Thesis",
  "One sentence thesis.",
  "",
  "## Non-Negotiables",
  "1. Non-negotiable 1",
  "2. Non-negotiable 2",
  "3. Non-negotiable 3",
  "4. Non-negotiable 4",
  "5. Non-negotiable 5",
  "",
  "## Visual System Rules",
  "- Rule 1",
  "- Rule 2",
  "- Rule 3",
  "",
  "## Copy Direction Rules",
  "- Rule 1",
  "- Rule 2",
  "- Rule 3",
  "",
  "## Profile Enforcement",
  "- Restate required deliverables from profile file.",
  "- Restate QA gates from profile file.",
  "- Restate profile constraints that execution must not break.",
  "",
  "## Director Acceptance Timing",
  `- min ${policy.directorGate.minReviewsBeforeShip}, target ${policy.directorGate.targetAcceptanceReview}, max ${policy.directorGate.maxReviews} reviews.`,
  "",
  "## Handoff to Review",
  "Provide 3 concise bullets for review checks."
].join("\n");

fs.writeFileSync(directionPath, `${content}\n`);
fs.writeFileSync(path.join(path.dirname(directionPath), `round-${round}.md`), `${content}\n`);
fs.appendFileSync(loopLogPath, `Direction fallback wrote ROUND ${round} PROFILE ${profile}.\n`);
NODE
}

write_review_fallback() {
  local expected_round="$1"
  node - "$STRATEGY_FILE" "$DIRECTION_FILE" "$LOOP_POLICY_FILE" "$REVIEW_FILE" "$STATE_FILE" "$LOOP_LOG_FILE" "$expected_round" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [strategyPath, directionPath, policyPath, reviewPath, statePath, loopLogPath, expectedRound] =
  process.argv.slice(2);
const strategy = fs.existsSync(strategyPath) ? fs.readFileSync(strategyPath, "utf8") : "";
const direction = fs.existsSync(directionPath) ? fs.readFileSync(directionPath, "utf8") : "";
const policy = fs.existsSync(policyPath)
  ? JSON.parse(fs.readFileSync(policyPath, "utf8"))
  : { directorGate: { minReviewsBeforeShip: 3, targetAcceptanceReview: 3, maxReviews: 4 } };

const readValue = (raw, key) => {
  const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : "";
};

const roundValue = readValue(strategy, "ROUND") || expectedRound || "1";
const round = Number.parseInt(roundValue, 10) || 1;
const profile = readValue(strategy, "PROFILE_ID") || "packaging";
const min = Number(policy.directorGate.minReviewsBeforeShip ?? 3);
const target = Number(policy.directorGate.targetAcceptanceReview ?? 3);
const max = Number(policy.directorGate.maxReviews ?? 4);

const requiredHeadings = [
  "## Creative Thesis",
  "## Non-Negotiables",
  "## Visual System Rules",
  "## Copy Direction Rules",
  "## Profile Enforcement",
  "## Handoff to Review"
];

const hasProfileLink = direction.includes("PROFILE_ID:") && direction.includes("PROFILE_PATH:");
const hasRequiredSections = requiredHeadings.every((heading) => direction.includes(heading));
const ready = hasProfileLink && hasRequiredSections;

let decision = "REVISE";
if (ready && round >= min) {
  decision = "SHIP";
} else if (round >= max) {
  decision = "STOP";
}

const nextRound = decision === "REVISE" ? round + 1 : round;
const review = [
  `ROUND: ${round}`,
  `PROFILE_ID: ${profile}`,
  `REVIEW_COUNT: ${round}`,
  `MIN_REVIEWS_BEFORE_SHIP: ${min}`,
  `TARGET_ACCEPTANCE_REVIEW: ${target}`,
  `MAX_REVIEWS: ${max}`,
  `READY_CONTENT: ${ready ? "yes" : "no"}`,
  `DECISION: ${decision}`,
  `NEXT_ROUND: ${nextRound}`,
  "",
  "## Keep",
  "- Keep 1",
  "- Keep 2",
  "",
  "## Change",
  "- Change 1",
  "- Change 2",
  "",
  "## Risks",
  "- Risk 1",
  "- Risk 2",
  "",
  "## Profile Compliance",
  `- HAS_PROFILE_LINK: ${hasProfileLink ? "yes" : "no"}`,
  `- HAS_REQUIRED_SECTIONS: ${hasRequiredSections ? "yes" : "no"}`,
  "- Top miss (if any): fallback path used",
  "",
  "## Required Next Actions",
  "1. Action 1",
  "2. Action 2",
  "3. Action 3"
].join("\n");

const currentDateET = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
})
  .format(new Date())
  .replaceAll("/", "-");

const state =
  decision === "REVISE"
    ? [
        "STATE: ACTIVE",
        `CURRENT_ROUND: ${nextRound}`,
        `ACTIVE_PROFILE: ${profile}`,
        `LAST_DECISION: ${decision}`,
        `UPDATED_AT_ET: ${currentDateET}`,
        "NOTES: Director gate evaluated against LOOP_POLICY (fallback path)."
      ].join("\n")
    : [
        "STATE: DONE",
        `CURRENT_ROUND: ${round}`,
        `ACTIVE_PROFILE: ${profile}`,
        `LAST_DECISION: ${decision}`,
        `UPDATED_AT_ET: ${currentDateET}`,
        "NOTES: Director gate evaluated against LOOP_POLICY (fallback path)."
      ].join("\n");

fs.writeFileSync(reviewPath, `${review}\n`);
fs.writeFileSync(path.join(path.dirname(reviewPath), `round-${round}.md`), `${review}\n`);
fs.writeFileSync(statePath, `${state}\n`);
fs.appendFileSync(loopLogPath, `Review fallback wrote ROUND ${round} DECISION ${decision} PROFILE ${profile}.\n`);
NODE
}

snapshot_file() {
  local src="$1"
  local dest="$2"
  if [[ -f "$src" ]]; then
    cp "$src" "$dest"
  fi
}

mkdir -p "$RUN_DIR" "$SNAPSHOT_DIR" "$TESTS_OUT_DIR" "$ZARA_CRITIQUE_DIR"

reset_loop_if_done
open_review_gate_if_needed

TARGET_ROUND="$(extract_value "CURRENT_ROUND" "$STATE_FILE")"
if [[ -z "$TARGET_ROUND" ]]; then
  TARGET_ROUND="1"
fi

if ! run_stage_expect_round "$STAGE1_ID" "Stage 1 Research" "$RESEARCH_FILE" "$TARGET_ROUND"; then
  log "Stage 1 failed after retries; applying deterministic research fallback."
  write_research_fallback "$TARGET_ROUND"
fi
TARGET_ROUND="$(extract_value "ROUND" "$RESEARCH_FILE")"
build_logo_influence_signal_packet
append_logo_influence_signal_packet "$RESEARCH_FILE"

if ! run_stage_expect_round "$STAGE2_ID" "Stage 2 Strategy" "$STRATEGY_FILE" "$TARGET_ROUND"; then
  log "Stage 2 failed after retries; applying deterministic strategy fallback."
  write_strategy_fallback "$TARGET_ROUND"
fi
TARGET_ROUND="$(extract_value "ROUND" "$STRATEGY_FILE")"
append_logo_influence_signal_packet "$STRATEGY_FILE"

if ! run_stage_expect_round "$STAGE3_ID" "Stage 3 Creative Direction" "$DIRECTION_FILE" "$TARGET_ROUND"; then
  log "Stage 3 failed after retries; applying deterministic direction fallback."
  write_direction_fallback "$TARGET_ROUND"
fi

if ! run_stage_expect_round "$STAGE4_ID" "Stage 4 Review" "$REVIEW_FILE" "$TARGET_ROUND"; then
  log "Stage 4 failed after retries; applying deterministic review fallback."
  write_review_fallback "$TARGET_ROUND"
fi

snapshot_file "$STATE_FILE" "${SNAPSHOT_DIR}/STATE.md"
snapshot_file "$RESEARCH_FILE" "${SNAPSHOT_DIR}/research-LATEST.md"
snapshot_file "$STRATEGY_FILE" "${SNAPSHOT_DIR}/strategy-LATEST.md"
snapshot_file "$DIRECTION_FILE" "${SNAPSHOT_DIR}/direction-LATEST.md"
snapshot_file "$REVIEW_FILE" "${SNAPSHOT_DIR}/review-LATEST.md"
snapshot_file "$LOOP_LOG_FILE" "${SNAPSHOT_DIR}/LOOP_LOG.md"
snapshot_file "$INFLUENCE_DIGEST_MARKDOWN" "${SNAPSHOT_DIR}/logo-influence-tag-packet.md"
snapshot_file "$INFLUENCE_DIGEST_JSON" "${SNAPSHOT_DIR}/logo-influence-tag-packet.json"

log "Running creative QA matrix tests..."
TEST_SUMMARY_JSON="$(node "${ROOT}/studio/PIPELINE/testing/run_creative_tests.mjs" --out "$TESTS_OUT_DIR" | tail -n 1)"

node - "$TEST_SUMMARY_JSON" "$REVIEW_FILE" "$LEARNING_FILE" <<'NODE'
const fs = require("node:fs");

const summaryPath = process.argv[2];
const reviewPath = process.argv[3];
const outPath = process.argv[4];

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const reviewRaw = fs.existsSync(reviewPath) ? fs.readFileSync(reviewPath, "utf8") : "";

const readReviewValue = (key) => {
  const match = reviewRaw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : "unknown";
};

const failingCases = [];
for (const section of Object.values(summary.sections)) {
  for (const entry of section.cases) {
    if (!entry.pass) {
      failingCases.push(entry);
    }
  }
}

const topViolations = [];
for (const entry of failingCases) {
  for (const violation of entry.violations.slice(0, 2)) {
    topViolations.push(`- [${entry.id}] ${violation}`);
  }
}

const markdown = [
  "# Autonomous Creative Self-Learning Input",
  "",
  `- Generated: ${new Date().toISOString()}`,
  `- Review decision: ${readReviewValue("DECISION")}`,
  `- Round: ${readReviewValue("ROUND")}`,
  `- Profile: ${readReviewValue("PROFILE_ID")}`,
  `- QA total cases: ${summary.totals.totalCases}`,
  `- QA pass: ${summary.totals.pass}`,
  `- QA fail: ${summary.totals.fail}`,
  "",
  "## Keep",
  "- Preserve section and combination cases passing with no expectation mismatch.",
  "- Keep profile-linked direction structure when HAS_PROFILE_LINK and HAS_REQUIRED_SECTIONS are both yes.",
  "",
  "## Kill",
  "- Kill repeated low-contrast text pairings and accent overuse patterns.",
  "- Kill logo systems that fail variant count or monochrome readiness.",
  "",
  "## Change",
  "- Prioritize fixing failing combination cases before isolated section failures.",
  "- Promote any repeated pass pattern into stable profile constraints.",
  "",
  "## Top QA Violations",
  ...(topViolations.length ? topViolations : ["- none"]),
  "",
  "## Sources",
  `- QA summary: \`${summaryPath}\``,
  `- Review artifact: \`${reviewPath}\``
].join("\n");

fs.writeFileSync(outPath, markdown);
NODE

cp "$LEARNING_FILE" "$ZARA_CRITIQUE_FILE"

log "Autonomous creative cycle complete."
log "Run directory: ${RUN_DIR}"
log "Learning input: ${LEARNING_FILE}"
log "Zara critique: ${ZARA_CRITIQUE_FILE}"
