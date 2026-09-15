# Operational State: Worldwalker

Project ID: `worldwalker`
State revision: 29
Baseline: `0.29.0`
State: `grand-atlas-uplift-verified`

## Purpose
Worldwalker is a local-first SNES/JRPG spatial interface over Andrew's real project ecosystem. Real project state drives geography, artifacts, quests and environmental condition without silently mutating source projects.

## Current release (v0.29.0)
- **Flagship WOW-01**: The **Grand Cartographic Expedition Atlas & Live Ecosystem Orrery** is integrated into the Worldwalker Atlas (`1` / Map dock / waystones). Includes topographic elevation contours, interactive Walking Route Surveyor (`calculateWalkingRoute`) computing real distances, leagues, footsteps, and river navigation, and the cosmic **Ecosystem Orrery** visualizing the 5 source projects orbiting the Central Meridian with live Git branch/commit telemetry and condition spectra.
- **Gameplay Traversal & Navigation**: Added river stepping stones for pedestrian crossings, two-way river cable raft ferries (`RIVER_FERRY`), directional overworld signposts (`OVERWORLD_SIGNPOSTS`), settlement bulletin boards (`SETTLEMENT_BULLETINS`), and a high-speed sprint-hop stride dash.
- **Interactive Tools & Audio**: Added Jukebox Studio (`J`) for auditioning regional themes and acoustic stingers, Expedition Postcard Snapshot tool (`P`), Technology Matrix viewer (`FEAT-03`), and Exploration Milestones (`FEAT-15`) celebrating genuine cartographic discovery.
- **QOL & HUD Uplift**: Quick quest cycling (`T`), compass overlay toggle (`O`), notification dispatch drawer (`L`), multi-toast notification stack, F3 performance diagnostics HUD, and dock hotkeys (`1` through `8`).
- **Backend & Storage Hardening**: Server ETag calculation with HTTP 304 Not Modified support, snapshot TTL caching (2500ms), Git execution timeout guards (3500ms), URL space decoding for paths such as `orbital tomb`, robust save migration (`v5` -> `v6`), save JSON backup/restore, and localStorage quota protection.
- Long-distance overworld travel can trigger non-combat road encounters near project regions. Their narrative wrapper is Worldwalker fiction; project condition and quest status lines are source-backed.
- Settlement residents now follow morning/day/evening/night schedules. Evening and night also add warm settlement-light treatment while source condition remains authoritative.
- Fifteen interior furniture/instrument interactions are wired across the five project interiors. Inspections expose bounded condition, quest or Git evidence and preserve ledger-content privacy.
- The title screen now surfaces the latest local journey memory and changes BEGIN JOURNEY to RESUME JOURNEY when history exists.
- Attuned waystones now offer REST & REVIEW JOURNEY, opening a Journey Recap with visited-region count, waystones, echoes, tracked quest and recent local journal events.
- First entry into a project region now uses a non-blocking JRPG location reveal with camera focus, landmark, project name, biome identity and current source condition.
- v0.23 dialogue scenes, physical audio, depth occlusion, World Shift and Expedition Journal remain intact.
- v0.18 adaptive score, cinematic camera, quest tracking, weather/time atmosphere and World Echoes remain intact.
- Production art remains local under `public/assets/runtime/`; normal play does not depend on Drive availability.

## Active invariants
1. Source projects are read-only.
2. Unknown remains unknown.
3. Git/file existence never implies user acceptance.
4. Quest source status is separate from Worldwalker investigation progress.
5. Fixed project geography persists between sessions.
6. Fast travel requires an attuned waystone.
7. Guides, residents and road encounters distinguish Worldwalker fiction from source-backed facts.
8. Project-state ledger contents are never sent to the browser.
9. Starsilk retains fine azure/cobalt filament treatment.
10. World Echoes are interpretive atmosphere, not evidence.
11. World Shift never invents a previous condition when none was remembered.
12. The Expedition Journal records Worldwalker exploration, not source-project progress.
13. Road encounters never mutate source state and never manufacture project completion.
14. Waystone rest is memory/navigation only; it grants no fake stats, XP or productivity score.
15. Reduced-motion, keyboard, touch and controller gameplay paths remain available.

## Verification
- Package version: `0.29.0`.
- `npm run validate`: PASS (all 9 test suites: check, features, model, gamefeel, immersion, presence, adventure, system, uplift).
- Feature contract: 20/20 PASS.
- Evidence/model contract: PASS.
- Game-feel contract: PASS.
- Immersion contract: PASS.
- Presence contract: PASS.
- Adventure contract: PASS on travel encounters, NPC schedules, interior props, Journey Recap and cinematic region reveals.
- System contract: PASS on spatial grid, world data, route surveyor, milestones, tech matrix, server hardening, and invariant discipline.
- Uplift contract: 101/101 PASS on docs/IMPROVEMENT_LEDGER.md count integrity (20 UI/UX, 20 Gameplay, 20 Backend, 20 QOL, 20 Features, 1 WOW-ME) and functional wiring.
- `npm run smoke`: PASS with dual-mode live-network and in-process request verification.
- Live HTTP delivery: `/`, `/app.js`, `/travel-encounters.js`, `/dialogue.js` and `/styles.css` all return 200.
- Live shell contains `regionCard`; served app contains `journeyRecapPanel`.
- Live server: `http://127.0.0.1:5179`.
- Git repository: verified tracking origin/main at git@github.com:westkitty/Worldwalker.git.
- Automated visual/auditory acceptance does not substitute for human aesthetic review.

## Next human gate
Walk a long route between regions, inspect at least one gold-glint interior prop, revisit a waystone for Journey Recap, then enter a previously undiscovered region. Judge encounter cadence, schedule believability, prop usefulness, recap clarity and whether the location reveal finally feels like entering a place in a JRPG rather than opening a project card.
