# Failure Taxonomy

Error categorization patterns for OpenClaw gateway logs and self-improvement reporting.

## Purpose

Group recurring errors into categories so we can:
- Track frequency + first/last occurrence per category
- Auto-escalate when a category crosses a threshold (e.g., >10 occurrences in 1 hour)
- Avoid treating each instance of the same root cause as a unique problem

## Categories

### 1. API_KEY_EXPIRED
**Pattern:** `API_KEY_INVALID|API key expired`  
**Provider match:** `googleapis.com|generativelanguage.googleapis.com`  
**Description:** API key for a provider (usually Google Gemini) has expired and needs renewal.  
**Auto-escalate:** After 3 consecutive failures (suggests systemic issue, not transient)  
**Example:**
```
"error": {
  "code": 400,
  "message": "API key expired. Please renew the API key.",
  "status": "INVALID_ARGUMENT",
  "details": [
    {
      "@type": "type.googleapis.com/google.rpc.ErrorInfo",
      "reason": "API_KEY_INVALID",
      "domain": "googleapis.com"
    }
  ]
}
```

### 2. RATE_LIMIT_EXCEEDED
**Pattern:** `rate limit|quota exceeded|429`  
**Provider match:** `openai|anthropic|google`  
**Description:** Provider rate limit or quota exceeded.  
**Auto-escalate:** After 5 occurrences in 10 minutes (suggests load spike or misconfigured limits)  
**Example:**
```
"error": {
  "code": 429,
  "message": "Rate limit exceeded. Retry after 60 seconds."
}
```

### 3. MEMORY_DIRTY
**Pattern:** `Dirty: yes|memory index dirty`  
**Provider match:** N/A (OpenClaw internal)  
**Description:** Memory index is out of sync and needs reindexing.  
**Auto-escalate:** After 2 consecutive hourly checks showing dirty state (suggests reindexing failed or not running)  
**Detection:** `openclaw memory status --deep | grep "Dirty: yes"`

### 4. CRON_TIMEOUT
**Pattern:** `timeout|timed out|ETIMEDOUT`  
**Provider match:** N/A (OpenClaw internal)  
**Description:** Cron job exceeded its timeout and was killed.  
**Auto-escalate:** After 3 consecutive timeouts for the same job (suggests job needs longer timeout or is stuck)  
**Example:**
```
lane task error: lane=cron ... error="TimeoutError: Task exceeded 300s timeout"
```

### 5. TOOL_DENIED
**Pattern:** `tool denied|not allowed|policy deny`  
**Provider match:** N/A (OpenClaw internal)  
**Description:** Agent attempted to use a tool that's blocked by policy (e.g., `web_search` in a restricted context).  
**Auto-escalate:** After 5 occurrences in 1 hour (suggests misconfiguration or agent needs updated instructions)  
**Example:**
```
"error": "Tool 'web_search' is not allowed in this context (policy: deny)"
```

### 6. MODEL_UNAVAILABLE
**Pattern:** `model not found|model unavailable|503`  
**Provider match:** `ollama|openai|anthropic|google`  
**Description:** Requested model is not available (provider down, model name typo, or model deprecated).  
**Auto-escalate:** After 2 consecutive failures (suggests model config needs update)  
**Example:**
```
"error": {
  "code": 503,
  "message": "Model 'gpt-4.5' is not available."
}
```

### 7. EMBEDDING_QUOTA_EXCEEDED
**Pattern:** `embedding.*quota|embedding.*limit exceeded`  
**Provider match:** `openai|voyage|mistral`  
**Description:** Embedding quota exceeded for the configured provider.  
**Auto-escalate:** After 3 occurrences in 1 hour (suggests need to switch to local model or increase quota)  
**Example:**
```
"error": "Embedding quota exceeded for provider 'openai'. Consider using a local model."
```

### 8. GATEWAY_UNREACHABLE
**Pattern:** `ECONNREFUSED|gateway not reachable|connection refused`  
**Provider match:** N/A (OpenClaw internal)  
**Description:** Gateway is down or not responding.  
**Auto-escalate:** After 1 occurrence (critical service outage)  
**Detection:** `openclaw status | grep "Gateway" | grep -v "reachable"`

### 9. SANDBOX_SPAWN_FAILED
**Pattern:** `spawn docker ENOENT|docker.*not found|sandbox.*failed`  
**Provider match:** N/A (OpenClaw internal)  
**Description:** Sandbox mode is enabled but Docker is not installed or not running.  
**Auto-escalate:** After 1 occurrence (indicates config drift: sandbox mode should be "off" when Docker unavailable)  
**Example:**
```
"error": "spawn docker ENOENT"
```

### 10. TELEGRAM_RUNTIME_UNKNOWN
**Pattern:** `telegram runtime unknown|status_command_error|status_json_missing`  
**Provider match:** N/A (OpenClaw internal)  
**Description:** Telegram channel status probe failed (usually transient).  
**Auto-escalate:** After 8 consecutive failures (per guardian threshold)  
**Example:**
```
guardian: telegram runtime unknown (no restart): status_command_error
```

## Usage

### Manual categorization (current)
1. Read gateway logs: `tail -500 ~/.openclaw/logs/gateway.err.log`
2. Grep for category patterns: `grep -E "API_KEY_INVALID|API key expired"`
3. Count occurrences: `wc -l`
4. Document in self-improvement report under "What's broken"

### Automated (proposed)
1. Create `/Users/calbotsman/clawd/loops/failure_health_check.sh`:
   - Parse last 24h of `gateway.err.log`
   - For each category, extract first/last occurrence + count
   - Output markdown table: `Category | First Seen | Last Seen | Count | Status`
   - Flag categories exceeding escalation threshold with `⚠️ ESCALATE`
2. Run hourly via self-improvement loop
3. Append to `reports/failure-health/YYYY-MM-DD.md`

### Example output
```markdown
| Category              | First Seen           | Last Seen            | Count | Status      |
|-----------------------|----------------------|----------------------|-------|-------------|
| API_KEY_EXPIRED       | 2026-03-13 04:42 EDT | 2026-03-14 03:42 EDT | 2568  | ⚠️ ESCALATE |
| TELEGRAM_RUNTIME_UNKNOWN | 2026-03-06 08:49 EDT | 2026-03-08 10:59 EDT | 12    | OK          |
| GATEWAY_UNREACHABLE   | 2026-03-06 08:07 EDT | 2026-03-08 10:59 EDT | 8     | OK          |
```

## Maintenance

- Add new categories as recurring patterns emerge
- Update regex patterns when log format changes
- Review escalation thresholds quarterly based on observed false-positive rate
