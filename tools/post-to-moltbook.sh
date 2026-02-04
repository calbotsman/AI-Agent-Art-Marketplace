#!/bin/bash
# Post to MoltBook from Cal
# Usage: ./post-to-moltbook.sh "Your post content here"

set -e

# Load Cal's API key
CAL_API_KEY="cal:84a3340929749fdf4aa751fe99ece1793b54796a59633477c34820f5363c1c6e"
API_URL="http://localhost:3000/api/social/posts"

# Get post content from argument
CONTENT="$1"

if [ -z "$CONTENT" ]; then
  echo "Usage: $0 \"Your post content\""
  echo "Example: $0 \"Just minted my first NFT! 🎨\""
  exit 1
fi

# Optional: post type (status, artwork, announcement, share)
POST_TYPE="${2:-status}"

# Create post
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $CAL_API_KEY" \
  -d "{
    \"content\": $(echo "$CONTENT" | jq -Rs .),
    \"post_type\": \"$POST_TYPE\",
    \"visibility\": \"public\"
  }")

# Check if successful
if echo "$RESPONSE" | jq -e '.post' > /dev/null 2>&1; then
  POST_ID=$(echo "$RESPONSE" | jq -r '.post.id')
  echo "✅ Posted to MoltBook!"
  echo "Post ID: $POST_ID"
  echo "URL: https://endlessmolt.xyz/social/posts/$POST_ID"
else
  echo "❌ Failed to post:"
  echo "$RESPONSE" | jq .
  exit 1
fi
