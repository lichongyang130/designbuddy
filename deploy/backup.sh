#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
file="backups/designbuddy-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
compose=(docker compose -f deploy/compose.yaml)
# Refuse to disturb a deployment whose app was not already running.
if [[ -z "$("${compose[@]}" ps --status running -q app)" ]]; then
  echo 'app 未运行；请先确认部署状态，再执行备份。' >&2
  exit 1
fi
"${compose[@]}" stop app
trap '"${compose[@]}" start app' EXIT
"${compose[@]}" run --rm --no-deps -T --user root --entrypoint tar app \
  -czf - -C /app data .cache > "$file.partial"
mv "$file.partial" "$file"
sha256sum "$file" > "$file.sha256"
printf '备份完成：%s（需另行安全备份 deploy/.env）\n' "$file"
