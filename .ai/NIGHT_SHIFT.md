# NIGHT SHIFT

1. Read `AGENTS.md`, `.ai/PROJECT_BOARD.md`, `.ai/LEASE.md` and current code/config.
2. `git fetch origin`; use `origin/codex/night-shift` as durable checkpoint; never force.
3. Acquire lease; unexpired ACTIVE lease means exit.
4. Resume RUNNING, otherwise highest READY.
5. Work in small milestones: inspect → change → verify → update board/lease → commit → push `codex/night-shift`.
6. Stay in audit/maintenance mode until a new product milestone is explicit. Do not invent product scope.
7. Account/publishing/production gates go to BLOCKED; continue safe work.
8. Normal end releases lease; hard interruption may leave ACTIVE until TTL takeover.