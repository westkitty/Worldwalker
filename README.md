# Worldwalker

Worldwalker is a local-first SNES-style exploration layer over real project state. Projects become fixed places with landmarks, interiors, artifacts, history, unfinished work, source-backed roads and environmental consequences.

## Run

```bash
cd /Users/andrew/Worldwalker
./PLAY_WORLDWALKER.command
```

Or:

```bash
npm start
```

Open `http://127.0.0.1:5179`.

## Controls

- WASD / arrows — walk
- Shift — sprint / high-speed stride
- Space — hop short obstacles / sprint dash
- C — climb or squeeze through nearby traversal features
- Enter / controller A — interact and advance JRPG dialogue
- Escape / controller B — close dialogue, a panel or leave an interior / Chronicle
- M — mute / restore the generated score
- T — cycle tracked quest across regions
- O — toggle overworld quest compass overlay
- L — open dispatch log & communications drawer
- J — open Jukebox Studio modal (audition regional themes & stingers)
- P — take framed Expedition Postcard snapshot (PNG download)
- R — smoothly recenter camera on the traveler
- F3 — toggle runtime performance diagnostics HUD
- 1–8 — quick-select dock tools (1: Map, 2: Quests, 3: Vault, 4: Chronicle, 5: Journal, 6: Manual, 7: Art Codex, 8: Help)
- Controller left stick — move; X — traverse; Start — map; R2 / stick-click — sprint
- Touch controls appear on coarse-pointer devices

## What the world reads

The server performs bounded, read-only scans of five configured project roots. It reads Git history, recent artifacts and small technology signatures, plus whether a configured project-state ledger exists. Ledger contents are not sent to the browser.

Worldwalker never treats a commit, build, file or generated report as human acceptance unless the source project itself says so. Unknown remains unknown. Deferred remains deferred.

## Major systems

Five bespoke project biomes, vertical terrain, project-condition weather, signature landmarks, animated environmental details, information-specific interiors, time lighting, an eight-direction avatar, an illustrated cartographic map, cinematic transitions, sprint/hop/climb/squeeze traversal, discoverable real artifacts, Rumored→Confirmed→Evidence→Verified investigation stages, quest archetypes, source-driven environmental repair, a ten-page field manual, cross-project expeditions, a walkable Chronicle, WHAT CHANGED source-digest notices and relationship secrets derived only from shared technology evidence.

## Validation

```bash
npm run validate
npm run smoke
```

`npm run validate` checks JavaScript syntax across all modules plus the 20-feature structural contract, source-evidence model, game-feel contract, immersion contract, v0.23 presence contract, v0.28 adventure contract, and v0.29 system contract. `npm run smoke` checks the running read-only HTTP API and five-region snapshot contract.

## v0.4 — Production Art Runtime

Worldwalker now ships its production-sliced JRPG art locally under `public/assets/runtime/`. The renderer uses generated terrain, water, five illustrated project landmarks, animated player frames, role-specific interior NPCs, discovery icons, dialogue portraits and VFX accents. The original large reference sheets remain available through the Art Codex and are preserved separately in Google Drive.

Run `./PLAY_WORLDWALKER.command` or `npm start`, then open `http://127.0.0.1:5179`. Use `npm run validate && npm run smoke` for the machine verification gate. Source projects remain read-only; Worldwalker writes only its own browser exploration state.

## v0.23 — Presence Pass

Worldwalker now uses bottom-screen portrait dialogue with typewriter progression and choices for guides, residents and World Echoes. The generated score is joined by sparse regional ambience and terrain-aware synthesized footsteps. Overworld landmarks, settlement buildings, residents and waystones use foreground redraws so walking behind scenery produces proper JRPG occlusion.

Real source-digest changes can trigger a World Shift cinematic at the Crossroads messenger. A remembered prior condition is shown only when Worldwalker actually has one. The Expedition Journal stores a capped local history of arrivals, discoveries, hidden roads, waystones, tracked quests, World Echoes, travel and observed shifts. It is exploration memory, not XP, currency or a productivity score.

## v0.28 — Adventure Layer

Worldwalker now treats the road, settlements and interiors as authored JRPG space rather than connective UI. Long-distance walking can trigger non-combat travel encounters whose fiction is wrapped around explicitly source-backed status. Settlement residents follow morning/day/evening/night schedules and towns gain warm evening lighting. Interior furniture and instruments expose inspectable source-backed observations. Attuned waystones can open a Journey Recap built only from local exploration memory, and the title screen surfaces the latest remembered event.

First entry into a project region now uses a camera-focused location reveal showing the landmark, project name, biome identity and current source condition. These systems remain read-only with respect to source projects and are guarded by `npm run test:adventure` in addition to every earlier contract.

## v0.29 — Grand Cartographic Expedition Atlas & Live Ecosystem Orrery (Uplift Pass)

- **Flagship WOW-01: Grand Expedition Atlas & Ecosystem Orrery**: Integrated in the Atlas view (`1` / Map dock / waystones). Features topographic elevation contours, an interactive Walking Route Surveyor calculating real path distances, leagues, steps, and river crossings, and the cosmic Ecosystem Orrery visualizing live source project health and Git freshness as celestial orbits.
- **Physical Traversal & Navigation**: River stepping stones enable natural pedestrian crossings; two-way cable raft ferries connect the east and west banks; overworld signposts guide travelers at crossroads; and settlement bulletin boards publish local notices.
- **Tools & Quality of Life**: Real-time Jukebox Studio (`J`), framed Expedition Postcard export (`P`), Technology Matrix dependency viewer, 9-badge Exploration Milestones system, quick quest cycling (`T`), compass overlay (`O`), communications dispatch drawer (`L`), multi-toast notification stack, F3 performance diagnostics, JSON save backup/restore, and high-contrast accessibility mode.
- **Architecture & Server Hardening**: Fast HTTP ETag caching with 304 Not Modified, snapshot TTL caching (2500ms), 3500ms Git execution timeouts, URL space decoding, nosniff security headers, and spatial grid indexing (`SpatialGrid`).
