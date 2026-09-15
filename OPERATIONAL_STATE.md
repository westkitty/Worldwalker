# Operational State: Worldwalker

Project ID: `worldwalker`
State revision: 28
Baseline: `0.28.0`
State: `adventure-five-pass-integrated-verified`

## Purpose
Worldwalker is a local-first SNES/JRPG spatial interface over Andrew's real project ecosystem. Real project state drives geography, artifacts, quests and environmental condition without silently mutating source projects.

## Current release
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
- Package version: `0.28.0`.
- `npm run validate`: PASS.
- Feature contract: 20/20 PASS.
- Evidence/model contract: PASS.
- Game-feel contract: PASS.
- Immersion contract: PASS.
- Presence contract: PASS.
- Adventure contract: PASS on travel encounters, NPC schedules, interior props, Journey Recap and cinematic region reveals.
- `npm run smoke`: PASS after live-server restart.
- Live HTTP delivery: `/`, `/app.js`, `/travel-encounters.js`, `/dialogue.js` and `/styles.css` all return 200.
- Live shell contains `regionCard`; served app contains `journeyRecapPanel`.
- Live server: `http://127.0.0.1:5179`.
- Git repository: verified tracking origin/main at git@github.com:westkitty/Worldwalker.git.
- Automated visual/auditory acceptance does not substitute for human aesthetic review.

## Next human gate
Walk a long route between regions, inspect at least one gold-glint interior prop, revisit a waystone for Journey Recap, then enter a previously undiscovered region. Judge encounter cadence, schedule believability, prop usefulness, recap clarity and whether the location reveal finally feels like entering a place in a JRPG rather than opening a project card.
