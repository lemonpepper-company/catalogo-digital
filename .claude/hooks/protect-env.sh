#!/usr/bin/env bash
# PreToolUse guard: blocks Edit/Write/MultiEdit against .env* secret files.
# Reads the tool call JSON from stdin and extracts tool_input.file_path via node
# (node is a hard dependency of this project, so it's always available).
set -euo pipefail

file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const i=JSON.parse(s).tool_input||{};console.log(i.file_path||i.path||"")}catch{console.log("")}})' 2>/dev/null || true)

# Allow committed, non-secret templates.
case "$file" in
  *.example|*.sample) exit 0 ;;
esac

# Block real env files: .env, .env.local, .env.production, etc.
case "$file" in
  *.env|*.env.*)
    echo "Blocked: editing environment/secret files (.env*) is not allowed by the project's .env guard. Ask the user to change secrets manually." >&2
    exit 2
    ;;
esac

exit 0
