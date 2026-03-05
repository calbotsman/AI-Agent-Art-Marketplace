# HEARTBEAT.md

# This file is actively managed by the self-improvement agent.

# Periodically summarize recent activity and log learnings.
# This helps maintain session continuity and provides an audit trail of self-improvement.

1) Ensure `/Users/calbotsman/clawd/memory/` directory exists.
2) If `/Users/calbotsman/clawd/memory/$(date +%Y-%m-%d).md` does not exist, create it.
3) Read `/Users/calbotsman/clawd/memory/$(date +%Y-%m-%d).md` (today's memory) and `/Users/calbotsman/clawd/MEMORY.md` (long-term memory).
2) If there is significant new activity or learnings since the last heartbeat, summarize them.
3) Append the summary and any new insights/lessons learned to `/Users/calbotsman/clawd/.learnings/$(date +%Y-%m-%d).md`. Create the `.learnings/` directory and file if they don't exist.
4) Ensure the "active thread" in `MEMORY.md` is always up-to-date with the most recent actionable request and its status.
5) Reply HEARTBEAT_OK if no new user-facing action is needed, otherwise proceed with the required action.
