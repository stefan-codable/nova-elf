#!/bin/bash
# Stop-Hook: legt in daten/ einen Git-Stand an, wenn sich etwas geändert hat. Still, scheitert nie laut.
D="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}/daten"
cat >/dev/null
[ -d "$D/.git" ] || exit 0
cd "$D" || exit 0
[ -z "$(git status --porcelain 2>/dev/null)" ] && exit 0
git add -A >/dev/null 2>&1
msg=$(sed -n 's/^- \([0-9-]*\) | \([^|]*\) |.*/\2/p' protokoll.md 2>/dev/null | head -1 | cut -c1-72)
git commit -qm "Elf: ${msg:-Stand $(date '+%Y-%m-%d %H:%M')}" >/dev/null 2>&1
git remote get-url origin >/dev/null 2>&1 && (git push -q >/dev/null 2>&1 &)
exit 0
