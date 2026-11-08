#!/usr/bin/env bash
# Prints how long the overnight run has been going (start time in overnight-review/.start).
start=$(cat "$(dirname "$0")/../overnight-review/.start")
now=$(date +%s)
mins=$(( (now - start) / 60 ))
echo "$(date '+%H:%M') elapsed ${mins} min (target 180, hard stop 300)"
