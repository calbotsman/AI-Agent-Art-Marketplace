# Cal's LLM Fallback Setup Guide

## 🚨 Critical: Don't Run Out of Compute!

When Claude Code credits run out, Cal needs fallback LLMs to keep working autonomously.

**Current Status:**
- ✅ Ollama installed: `/usr/local/bin/ollama`
- ✅ Model available: `gemma3:4b` (3.3 GB)
- ⏸️ OpenRouter: Need API key configured
- ⏸️ Claude Code: Need fallback configuration

---

## Option 1: Ollama (Local, FREE, Works Offline)

### Already Installed! ✅

Ollama is running locally on Cal's machine with Gemma 3 4B.

**Test it:**
```bash
ollama run gemma3:4b "Write a hello world function"
```

### Add More Models (Optional)

```bash
# Faster, smaller (good for simple tasks)
ollama pull qwen2.5:7b

# Smarter, bigger (good for complex tasks)
ollama pull llama3.1:8b

# Coding specialist
ollama pull codellama:13b
```

### Claude Code Integration

Create `~/.claude/llm-config.json`:
```json
{
  "providers": [
    {
      "name": "anthropic",
      "type": "anthropic",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "models": ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4"],
      "priority": 1
    },
    {
      "name": "ollama-local",
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "models": ["gemma3:4b", "qwen2.5:7b"],
      "priority": 2
    }
  ],
  "fallbackBehavior": "automatic",
  "costLimit": {
    "daily": 50,
    "monthly": 1000
  }
}
```

**When Claude credits run out:**
- Claude Code automatically switches to Ollama
- Uses `gemma3:4b` for all requests
- Still works, just slightly slower responses

---

## Option 2: OpenRouter (Cloud, Paid, Many Models)

### Setup (5 minutes)

**1. Get API Key:**
```bash
# Visit: https://openrouter.ai/keys
# Create account (free)
# Generate API key
# Copy it
```

**2. Add to environment:**
```bash
# Add to ~/.zshrc or ~/.bashrc:
export OPENROUTER_API_KEY="sk-or-v1-..."

# Reload:
source ~/.zshrc
```

**3. Update Claude Code config:**
```json
{
  "providers": [
    {
      "name": "anthropic",
      "type": "anthropic",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "models": ["claude-sonnet-4-5"],
      "priority": 1
    },
    {
      "name": "openrouter",
      "type": "openrouter",
      "apiKey": "${OPENROUTER_API_KEY}",
      "models": [
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-3-haiku",
        "openai/gpt-4-turbo",
        "google/gemini-pro"
      ],
      "priority": 2
    },
    {
      "name": "ollama-local",
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "models": ["gemma3:4b"],
      "priority": 3
    }
  ]
}
```

**Pricing (OpenRouter):**
- Claude 3.5 Sonnet: $3/M input, $15/M output tokens
- Claude 3 Haiku: $0.25/M input, $1.25/M output tokens
- GPT-4 Turbo: $10/M input, $30/M output tokens
- Gemini Pro: $0.125/M input, $0.375/M output tokens

**Recommended for budget:** Claude 3 Haiku via OpenRouter (~80% cheaper than Sonnet)

---

## Option 3: Hybrid Strategy (RECOMMENDED)

**Priority Order:**
1. **Claude API** (primary, best quality)
2. **OpenRouter Haiku** (cheap fallback for simple tasks)
3. **Ollama gemma3** (free fallback, works offline)

**Configuration:**
```json
{
  "providers": [
    {
      "name": "anthropic-primary",
      "type": "anthropic",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "models": ["claude-sonnet-4-5"],
      "priority": 1,
      "costLimit": {
        "daily": 30
      }
    },
    {
      "name": "openrouter-fallback",
      "type": "openrouter",
      "apiKey": "${OPENROUTER_API_KEY}",
      "models": ["anthropic/claude-3-haiku"],
      "priority": 2,
      "costLimit": {
        "daily": 10
      }
    },
    {
      "name": "ollama-emergency",
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "models": ["gemma3:4b"],
      "priority": 3
    }
  ],
  "fallbackRules": {
    "onCostLimit": "nextProvider",
    "onError": "nextProvider",
    "onRateLimit": "wait:60s,then:nextProvider"
  }
}
```

---

## Quick Setup (Copy-Paste)

**Step 1: Get OpenRouter key** (2 min)
```bash
open https://openrouter.ai/keys
# Create account, get API key
```

**Step 2: Add to shell** (1 min)
```bash
echo 'export OPENROUTER_API_KEY="sk-or-v1-YOUR_KEY_HERE"' >> ~/.zshrc
source ~/.zshrc
```

**Step 3: Test Ollama** (30 sec)
```bash
ollama run gemma3:4b "Say hello"
```

**Step 4: Create config** (2 min)
```bash
mkdir -p ~/.claude
cat > ~/.claude/llm-config.json <<'EOF'
{
  "providers": [
    {
      "name": "anthropic",
      "type": "anthropic",
      "priority": 1
    },
    {
      "name": "openrouter",
      "type": "openrouter",
      "apiKey": "${OPENROUTER_API_KEY}",
      "models": ["anthropic/claude-3-haiku"],
      "priority": 2
    },
    {
      "name": "ollama",
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "models": ["gemma3:4b"],
      "priority": 3
    }
  ],
  "fallbackBehavior": "automatic"
}
EOF
```

**Done!** ✅

---

## Testing Fallback

**Test each provider:**
```bash
# Test Ollama
ollama run gemma3:4b "Write a Python hello world"

# Test OpenRouter (if configured)
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3-haiku",
    "messages": [{"role": "user", "content": "Say hello"}]
  }'
```

**Simulate credit exhaustion:**
```bash
# Temporarily rename Claude API key
export ANTHROPIC_API_KEY_BACKUP=$ANTHROPIC_API_KEY
unset ANTHROPIC_API_KEY

# Run Claude Code - should fall back to OpenRouter/Ollama
claude "Write a function to add two numbers"

# Restore
export ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY_BACKUP
```

---

## Cost Monitoring

**Check OpenRouter usage:**
```bash
# Visit: https://openrouter.ai/usage
# Shows: requests, tokens, cost per day
```

**Ollama usage (FREE):**
```bash
# No cost tracking needed - runs locally
# Only cost: electricity (~$0.10/day if running 24/7)
```

---

## Emergency Procedures

### If Claude Code Stops Mid-Task

**1. Check which provider is active:**
```bash
claude --debug status
# Shows: current provider, credits remaining
```

**2. Manually switch provider:**
```bash
# Force OpenRouter
export CLAUDE_CODE_PROVIDER=openrouter
claude "continue previous task"

# Force Ollama
export CLAUDE_CODE_PROVIDER=ollama
claude "continue previous task"
```

**3. If all fail:**
```bash
# Check Ollama is running
ollama list

# Restart Ollama
ollama serve

# Try again
claude "continue task"
```

---

## Performance Comparison

| Provider | Speed | Quality | Cost | Offline? |
|----------|-------|---------|------|----------|
| Claude Sonnet 4.5 | Fast | Best | $$$ | No |
| OpenRouter Haiku | Fast | Good | $ | No |
| Ollama gemma3:4b | Medium | OK | FREE | Yes |

**For autonomous night work:**
- Use **Ollama** if working offline
- Use **OpenRouter Haiku** if internet available
- Only use **Claude** for critical complex tasks

---

## Verification Checklist

Before starting autonomous work, verify:

```bash
# ✅ Ollama running
ollama list | grep gemma3

# ✅ OpenRouter key set
echo $OPENROUTER_API_KEY | head -c 10

# ✅ Config file exists
cat ~/.claude/llm-config.json | jq .

# ✅ Can access all providers
ollama run gemma3:4b "test"
# (test OpenRouter with curl if key is set)
```

---

## Documentation

**Claude Code LLM configuration:**
- Docs: https://docs.anthropic.com/claude-code/configuration
- Issue tracker: https://github.com/anthropics/claude-code/issues

**Ollama:**
- Docs: https://ollama.ai/docs
- Models: https://ollama.ai/library

**OpenRouter:**
- Docs: https://openrouter.ai/docs
- Pricing: https://openrouter.ai/pricing

---

## Summary

**Current Setup:**
- ✅ Ollama installed with gemma3:4b
- ⏸️ Need: OpenRouter API key
- ⏸️ Need: ~/.claude/llm-config.json

**To Complete Setup (5 min):**
1. Get OpenRouter key: https://openrouter.ai/keys
2. Add to ~/.zshrc: `export OPENROUTER_API_KEY="..."`
3. Create `~/.claude/llm-config.json` (see above)
4. Test: `ollama run gemma3:4b "hello"`

**Then Cal can work 24/7 even if Claude credits run out!** 🚀
