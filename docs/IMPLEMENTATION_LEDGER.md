# Worldwalker 0.2 Implementation Ledger

This ledger maps the accepted graphics and gameplay upgrades to inspectable implementation evidence.

| ID | Upgrade | Implementation evidence | Verification |
|---|---|---|---|
| G01 | Bespoke project tilesets | `render.js::drawBiomeTile` has five distinct biome grammars | structural contract: five unique biomes |
| G02 | Serious verticality | project elevation contours plus climb/catwalk traversal features | feature contract + configured climb features |
| G03 | Project state alters art | `conditionFor` → `condition` → `projectStatusDecor` and weather | API smoke verifies condition field |
| G04 | Signature landmark per project | five named landmarks with project-specific renderers | feature contract requires every landmark |
| G05 | Micro-animation | water ripples, filaments, antenna motion, screens, particles, weather | source inspection; visual proof pending |
| G06 | Information-specific interiors | five project interiors with state, artifacts, history, quests and purpose stations | five-zone contract per project |
| G07 | Time, lighting and weather | local-hour lighting and condition-specific regional weather | source inspection; visual proof pending |
| G08 | Better Worldwalker avatar | eight-direction facing, walk frames, inertia, hop height, shadow and water response | source inspection; browser proof pending |
| G09 | Illustrated cartographic map | parchment-style SVG, fixed landmarks, discovered labels and evidence roads | DOM source inspection |
| G10 | Cinematic transitions | landmark/interior/Chronicle transition overlay | DOM + app source inspection |
| P01 | Movement verbs | sprint, hop, climb, squeeze, bridges and touch controls | feature/model source + configured traversal |
| P02 | Discoverable artifacts | recent real artifacts become proximity discoveries with read-only preview | API artifact inventory + browser implementation |
| P03 | Rumor→Evidence→Verified | pure investigation-state model preserves source authority | `test:model` PASS |
| P04 | Project-specific quest archetypes | signal, hardware, mapping, design, audit, review, engineering and reconcile evidence rules | `test:model` + blueprint contract |
| P05 | Real work transforms locations | source conditions and changed digests alter landmark/weather/region state | API condition/digest smoke PASS |
| P06 | Collectible field manual | ten world-positioned pages with persistent recovery | `test:features` requires exactly ten |
| P07 | Cross-project expeditions | shared-tech relationships open roads after both endpoints are visited | `test:model` expedition PASS |
| P08 | Explorable Chronicle | dedicated walkable commit realm with commit stones | source inspection; browser proof pending |
| P09 | WHAT CHANGED | prior/current source digests produce a Crossroads messenger and regional beacon | `test:model` source-change PASS |
| P10 | Genuine relationship secrets | unlocked midpoint roads expose only shared-tech evidence and explicit non-claims | server relationship contract + client secret model |

## Gate state

Structural, pure-model and Mac HTTP runtime requirements pass. Visual/browser play-feel remains a human gate; no machine-only claim is made about final visual quality.
