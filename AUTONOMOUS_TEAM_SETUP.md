# Autonomous Development Team - Setup Guide

**Goal:** Cal runs continuously with a team of sub-agents, building the marketplace autonomously without constant supervision.

## 🏗️ Team Structure

### Main Agent: Cal (Orchestrator)
- **Role:** Project manager, coordinator, decision maker
- **Model:** Claude Sonnet 4.5
- **Responsibilities:**
  - Review task list daily
  - Assign work to sub-agents
  - Monitor progress
  - Handle blockers
  - Report status to you

### Sub-Agents (Specialists)

**1. Builder Agent** (Frontend/Backend Dev)
- Implements features
- Writes code
- Runs tests
- Uses coding-agent skill

**2. QA Agent** (Quality Assurance)
- Reviews code
- Tests features
- Reports bugs
- Validates requirements

**3. DevOps Agent** (Deployment/Infrastructure)
- Manages git operations
- Handles builds
- Monitors servers
- Deploys changes

**4. Designer Agent** (UI/UX)
- Reviews UI/UX
- Suggests improvements
- Ensures consistency
- Creates mockups

## 🔄 Autonomous Workflow

### Daily Cycle (Runs Automatically)

```
08:00 AM - Cal wakes up
  ├─ Reads MEMORY.md for context
  ├─ Checks TASK_LIST.md for pending work
  ├─ Reviews yesterday's progress
  └─ Plans today's work

09:00 AM - Morning standup (Cal → You)
  ├─ Telegram message with daily plan
  ├─ Lists completed tasks
  ├─ Lists planned tasks
  └─ Flags any blockers

09:30 AM - Work begins
  ├─ Cal spawns sub-agents
  ├─ Builder works on features
  ├─ QA tests completed work
  └─ DevOps handles deployments

12:00 PM - Mid-day check
  ├─ Progress update
  └─ Adjust priorities if needed

05:00 PM - End of day
  ├─ Sub-agents finish work
  ├─ Cal commits all changes
  ├─ Updates TASK_LIST.md
  ├─ Writes to DAILY_LOG.md
  └─ Sends evening report via Telegram

Continuous - Background monitoring
  ├─ Watches for errors
  ├─ Monitors build status
  └─ Responds to urgent issues
```

## 📋 Task Management System

### Task List File Structure

```markdown
# TASK_LIST.md

## 🔥 High Priority (Do First)
- [ ] #1 - Shopping cart implementation
  - Owner: Builder Agent
  - Status: Not Started
  - Est: 4 hours
  - Blocked by: None

- [ ] #2 - User auth UI (signin/signup)
  - Owner: Builder Agent
  - Status: Not Started
  - Est: 3 hours
  - Blocked by: None

## 🎯 Medium Priority (Do Next)
- [ ] #3 - Admin dashboard
  - Owner: Builder Agent
  - Status: Not Started
  - Est: 4 hours
  - Blocked by: #1, #2

## 📌 Low Priority (Nice to Have)
- [ ] #4 - Image upload integration
  - Owner: Builder Agent
  - Status: Not Started
  - Est: 2 hours
  - Blocked by: None

## ✅ Completed
- [x] #0 - Database and API setup
  - Completed: 2026-02-03
  - By: Claude Sonnet 4.5
```

### Task Assignment Rules

1. **Cal assigns tasks** based on priority and dependencies
2. **Sub-agents report** completion back to Cal
3. **Cal updates** TASK_LIST.md automatically
4. **Blockers are escalated** to you via Telegram

## 🤖 Setting Up Autonomous Operation

### Step 1: Create Task List

```bash
cat > ~/clawd/projects/products/endless-molt/TASK_LIST.md << 'EOF'
# Endless Molt Task List

## 🔥 High Priority
- [ ] #1 - Shopping cart implementation (4h)
- [ ] #2 - User auth UI signin/signup (3h)

## 🎯 Medium Priority
- [ ] #3 - Admin dashboard (4h)
- [ ] #4 - Image upload integration (2h)

## 📌 Low Priority
- [ ] #5 - Final QA testing (2h)
- [ ] #6 - Performance optimization (2h)

## ✅ Completed
- [x] #0 - Phase 1 Foundation (Database, APIs, Frontend)
  - Completed: 2026-02-03
  - By: Claude Sonnet 4.5
EOF
```

### Step 2: Create Daily Log Template

```bash
mkdir -p ~/clawd/logs
cat > ~/clawd/logs/DAILY_LOG_TEMPLATE.md << 'EOF'
# Daily Log - [DATE]

## Morning Standup
**Time:** [TIME]
**Cal's Status:** [STATUS]

### Completed Yesterday
- [List completed tasks]

### Planned Today
- [List planned tasks]

### Blockers
- [List any blockers]

## Work Session

### [TIME] - Task Started: [TASK_NAME]
**Agent:** [AGENT_NAME]
**Status:** In Progress

### [TIME] - Task Completed: [TASK_NAME]
**Agent:** [AGENT_NAME]
**Result:** [DESCRIPTION]
**Files Changed:** [LIST]

## End of Day Summary
**Time:** [TIME]
**Total Tasks Completed:** [NUMBER]
**Total Commits:** [NUMBER]
**Status:** [OVERALL_STATUS]

### Tomorrow's Plan
- [List tomorrow's tasks]
EOF
```

### Step 3: Create Autonomous Control Script

```bash
cat > ~/clawd/autonomous-cal.sh << 'EOF'
#!/bin/bash
# Autonomous Cal - Continuous Development Loop

LOG_DIR="$HOME/clawd/logs"
TASK_FILE="$HOME/clawd/projects/products/endless-molt/TASK_LIST.md"
TODAY=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/DAILY_LOG_$TODAY.md"

# Morning standup (9 AM)
morning_standup() {
  openclaw agent --message "Good morning! Time for your daily standup:
  1. Read TASK_LIST.md to see pending work
  2. Review yesterday's progress in logs/
  3. Create today's plan
  4. Send me a Telegram message with:
     - What was completed yesterday
     - What you plan to do today
     - Any blockers
  5. Start working on the highest priority task"
}

# Work session (continuous)
work_session() {
  openclaw agent --message "Continue working on the current task from TASK_LIST.md:
  1. If no task in progress, start the next high priority task
  2. Use sub-agents as needed:
     - coding-agent for implementation
     - github skill for git operations
  3. Update TASK_LIST.md when tasks complete
  4. Log progress to $LOG_FILE
  5. If blocked, notify me via Telegram and move to next task"
}

# Mid-day check (12 PM)
midday_check() {
  openclaw agent --message "Mid-day progress check:
  1. Review progress since morning
  2. Update TASK_LIST.md
  3. Send brief status via Telegram
  4. Continue working"
}

# End of day wrap-up (5 PM)
end_of_day() {
  openclaw agent --message "End of day wrap-up:
  1. Commit all changes to git
  2. Update TASK_LIST.md with final status
  3. Write today's summary to $LOG_FILE
  4. Send evening report via Telegram with:
     - Tasks completed today
     - Tasks remaining
     - Tomorrow's plan
  5. Sleep until tomorrow morning"
}

# Background monitor (continuous)
monitor() {
  openclaw agent --message "Background monitoring:
  1. Watch for build errors in endless-molt
  2. Check if dev server is running
  3. Alert via Telegram if issues found
  4. Auto-restart services if needed"
}

# Main execution
case "$1" in
  morning)
    morning_standup
    ;;
  work)
    work_session
    ;;
  midday)
    midday_check
    ;;
  evening)
    end_of_day
    ;;
  monitor)
    monitor
    ;;
  *)
    echo "Usage: $0 {morning|work|midday|evening|monitor}"
    exit 1
    ;;
esac
EOF

chmod +x ~/clawd/autonomous-cal.sh
```

### Step 4: Set Up Cron Jobs (Scheduled Autonomous Operation)

```bash
# Add to crontab
crontab -l > /tmp/cal-cron.tmp || true

cat >> /tmp/cal-cron.tmp << 'EOF'
# Autonomous Cal - Daily Development Schedule

# Morning standup - 9:00 AM
0 9 * * * /Users/calbotsman/clawd/autonomous-cal.sh morning >> /Users/calbotsman/clawd/logs/cron.log 2>&1

# Work sessions - Every 2 hours from 9 AM to 5 PM
0 9,11,13,15,17 * * * /Users/calbotsman/clawd/autonomous-cal.sh work >> /Users/calbotsman/clawd/logs/cron.log 2>&1

# Mid-day check - 12:00 PM
0 12 * * * /Users/calbotsman/clawd/autonomous-cal.sh midday >> /Users/calbotsman/clawd/logs/cron.log 2>&1

# End of day - 5:00 PM
0 17 * * * /Users/calbotsman/clawd/autonomous-cal.sh evening >> /Users/calbotsman/clawd/logs/cron.log 2>&1

# Background monitoring - Every 30 minutes
*/30 * * * * /Users/calbotsman/clawd/autonomous-cal.sh monitor >> /Users/calbotsman/clawd/logs/cron.log 2>&1
EOF

# Install crontab
crontab /tmp/cal-cron.tmp
rm /tmp/cal-cron.tmp

echo "Cron jobs installed. Cal will run autonomously."
```

## 🎛️ Control Panel Commands

### Start/Stop Autonomous Mode

```bash
# Enable autonomous mode
crontab -l  # Verify cron jobs are active

# Disable autonomous mode (pause Cal)
crontab -l > ~/cal-cron-backup.txt
crontab -r  # Remove all cron jobs

# Re-enable autonomous mode
crontab ~/cal-cron-backup.txt
```

### Manual Task Triggers

```bash
# Trigger morning standup manually
~/clawd/autonomous-cal.sh morning

# Trigger work session manually
~/clawd/autonomous-cal.sh work

# Trigger end of day manually
~/clawd/autonomous-cal.sh evening
```

### Monitor Cal's Activity

```bash
# View today's log
tail -f ~/clawd/logs/DAILY_LOG_$(date +%Y-%m-%d).md

# View cron execution log
tail -f ~/clawd/logs/cron.log

# Check Cal's current session
openclaw sessions list

# Check what Cal is working on
cat ~/clawd/projects/products/endless-molt/TASK_LIST.md
```

## 📱 Telegram Notifications

Cal will send you messages automatically at:
- **9:00 AM** - Morning standup (daily plan)
- **12:00 PM** - Mid-day progress update
- **5:00 PM** - End of day summary
- **Anytime** - When blocked or urgent issues arise

You can also message Cal anytime:
```
@CalBotsmanBot: "What's your current status?"
@CalBotsmanBot: "Prioritize task #3"
@CalBotsmanBot: "Pause work and wait for instructions"
```

## 🔧 Team Coordination Rules

### Rule 1: Builder Agent Does Heavy Lifting
```
When Cal assigns a coding task:
├─ Cal: "Use coding-agent to implement shopping cart"
├─ Builder Agent spawned
├─ Builder: Uses Claude Code to write code
├─ Builder: Reports back when done
└─ Cal: Reviews and commits
```

### Rule 2: QA Agent Tests Everything
```
When Builder completes a feature:
├─ Cal: Spawns QA Agent
├─ QA: Tests the feature
├─ QA: Reports pass/fail
├─ If fail: Builder Agent fixes
└─ If pass: Cal commits to git
```

### Rule 3: DevOps Agent Handles Git
```
When code is ready to commit:
├─ Cal: Spawns DevOps Agent
├─ DevOps: Runs tests
├─ DevOps: Creates commit
├─ DevOps: Pushes to GitHub
└─ DevOps: Sends you notification
```

### Rule 4: Cal Escalates Blockers
```
When any agent is blocked:
├─ Agent: Reports blocker to Cal
├─ Cal: Tries to resolve
├─ If can't resolve: Sends Telegram to you
└─ Cal: Moves to next task while waiting
```

## 🎯 Success Criteria

Cal is fully autonomous when:
- ✅ Works on tasks without your input
- ✅ Spawns sub-agents as needed
- ✅ Commits code to git regularly
- ✅ Reports progress daily via Telegram
- ✅ Handles blockers gracefully
- ✅ Completes 2-3 tasks per day
- ✅ Maintains task list automatically

## 🚀 Quick Start (Set Everything Up Now)

Run this to set up the entire autonomous system:

```bash
# 1. Create directory structure
mkdir -p ~/clawd/logs

# 2. Create task list
cat > ~/clawd/projects/products/endless-molt/TASK_LIST.md << 'EOF'
# Endless Molt Task List

## 🔥 High Priority
- [ ] #1 - Shopping cart implementation (4h)
- [ ] #2 - User auth UI (3h)

## 🎯 Medium Priority
- [ ] #3 - Admin dashboard (4h)
- [ ] #4 - Image upload (2h)

## ✅ Completed
- [x] #0 - Phase 1 Foundation
EOF

# 3. Create autonomous script
cat > ~/clawd/autonomous-cal.sh << 'SCRIPT'
#!/bin/bash
case "$1" in
  morning)
    openclaw agent --message "Morning standup: Read TASK_LIST.md, plan today, send Telegram update"
    ;;
  work)
    openclaw agent --message "Work session: Continue highest priority task from TASK_LIST.md using sub-agents"
    ;;
  midday)
    openclaw agent --message "Mid-day check: Update progress, send Telegram status"
    ;;
  evening)
    openclaw agent --message "End of day: Commit changes, update TASK_LIST.md, send evening report"
    ;;
  monitor)
    openclaw agent --message "Monitor: Check for errors, alert if issues found"
    ;;
esac
SCRIPT

chmod +x ~/clawd/autonomous-cal.sh

# 4. Set up cron jobs
(crontab -l 2>/dev/null || true; cat << 'CRON'
0 9 * * * /Users/calbotsman/clawd/autonomous-cal.sh morning >> /Users/calbotsman/clawd/logs/cron.log 2>&1
0 9,11,13,15,17 * * * /Users/calbotsman/clawd/autonomous-cal.sh work >> /Users/calbotsman/clawd/logs/cron.log 2>&1
0 12 * * * /Users/calbotsman/clawd/autonomous-cal.sh midday >> /Users/calbotsman/clawd/logs/cron.log 2>&1
0 17 * * * /Users/calbotsman/clawd/autonomous-cal.sh evening >> /Users/calbotsman/clawd/logs/cron.log 2>&1
*/30 * * * * /Users/calbotsman/clawd/autonomous-cal.sh monitor >> /Users/calbotsman/clawd/logs/cron.log 2>&1
CRON
) | crontab -

echo "✅ Autonomous Cal is set up and will start tomorrow morning at 9 AM"
echo "📱 Cal will send you Telegram updates"
echo "📋 Task list: ~/clawd/projects/products/endless-molt/TASK_LIST.md"
echo "📊 Logs: ~/clawd/logs/"

# 5. Test it now
echo ""
echo "Want to test it now? Run:"
echo "  ~/clawd/autonomous-cal.sh morning"
```

## 📊 Monitoring Dashboard

View Cal's activity at any time:

```bash
# Quick status
cat ~/clawd/projects/products/endless-molt/TASK_LIST.md | grep -E "^\- \[.\]"

# Today's work
cat ~/clawd/logs/DAILY_LOG_$(date +%Y-%m-%d).md

# Recent commits
cd ~/clawd && git log --oneline -10

# Cal's current session
openclaw sessions show main
```

## 🎉 You're Done!

Cal will now:
- ✅ Wake up every morning at 9 AM
- ✅ Read his task list and plan the day
- ✅ Spawn sub-agents to do the work
- ✅ Work continuously throughout the day
- ✅ Commit code regularly
- ✅ Send you Telegram updates
- ✅ Handle blockers and escalate to you
- ✅ Wrap up at 5 PM with a summary

**You can leave Cal running and come back to completed features!** 🚀
