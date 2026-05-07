#!/usr/bin/env bash
# hook-wrapper.sh — structured output for pre-commit checks
#
# Usage: hook-wrapper.sh <name> <command> [args...]
#
# On success: prints one-line PASS summary
# On failure: prints inline error preview (first/last 20 lines)
#             saves full log to /tmp/arami/hook-logs/<timestamp>/<name>.log
#
# Logs are stored in /tmp/ so they auto-clean on reboot.

set -euo pipefail

name="$1"
shift

# All checks in the same minute share a directory (one commit attempt = one dir)
log_dir="/tmp/arami/hook-logs/$(date +%Y-%m-%d_%H%M)"
mkdir -p "$log_dir"
logfile="${log_dir}/${name}.log"

if "$@" > "$logfile" 2>&1; then
    printf "  ✓ %-20s passed\n" "$name"
    rm -f "$logfile"
    rmdir "$log_dir" 2>/dev/null || true
else
    status=$?
    printf "  ✗ %-20s FAILED (exit %d)\n" "$name" "$status"
    echo ""

    lines=$(wc -l < "$logfile" | tr -d ' ')
    if [ "$lines" -le 40 ]; then
        sed 's/^/    /' "$logfile"
    else
        head -20 "$logfile" | sed 's/^/    /'
        echo ""
        echo "    ... $((lines - 40)) lines omitted ..."
        echo ""
        tail -20 "$logfile" | sed 's/^/    /'
    fi

    echo ""
    echo "  Full log: cat $logfile"
    exit "$status"
fi
