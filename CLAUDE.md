# APPNAME

A 3D persistent-world multiplayer game on ProGameStore.

- Subdomain: `APPNAME.progamestore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`
- Deploy: `wrangler deploy` (Workers, not Pages -- needed for Durable Objects)

For platform conventions, read
https://progamestore.online/skills.md
before writing or changing anything.

## Architecture

This is a **3D persistent world** game with server-owned state:

- `src/worker.ts` -- Cloudflare Worker + Durable Object (`WorldDO`)
- `web/` -- React SPA using `@progamestore/games` SDK + Babylon.js
- `wrangler.jsonc` -- Worker config with DO bindings

The DO persists world state between sessions using SQLite storage.
Players connect via WebSocket and receive world state updates.
When all players disconnect, the world state persists in the DO's
SQLite database. When players reconnect, they get the latest state.

## Key files

- `src/worker.ts` -- Worker routes + WorldDO class with SQLite persistence.
- `web/src/App.tsx` -- React entry point with GameShell + useRooms + Babylon.js canvas.
- `wrangler.jsonc` -- Worker + DO config.

## Adding Babylon.js

```bash
cd web && pnpm add @babylonjs/core @babylonjs/loaders
```
