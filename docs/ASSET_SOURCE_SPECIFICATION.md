# Worldwalker Absolute Asset Source & Motion Interpolation Specification

This document is the authoritative, exhaustive technical matrix of all production spreads, sprite assets, secondary companion assets, traversal systems, environmental symptoms, and mathematical motion interpolation models across the Worldwalker engine.

---

## 1. Engine Architecture & Rendering Invariants

```
+---------------------------------------------------------------------------------------------------+
|                                        WORLDWALKER ENGINE                                         |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [Master Production Spreads] ---> Sliced into runtime PNG assets (/public/assets/runtime/)        |
|                                                                                                   |
|  [Entity Layer]                                                                                   |
|    +-- Primary Base Asset        : Grounding silhouette, rest posture, bounding collision box     |
|    +-- Secondary Companion Asset : Emissive layer, directional turn, action state, reaction frame |
|    +-- Motion Interpolation      : Mathematical function of continuous game.now and delta time dt |
|                                                                                                   |
|  [Traversal & Symptom Layer]                                                                      |
|    +-- Physical Movement Verbs   : Stride, sprint, climb, squeeze, river leap, ferry transit       |
|    +-- Environmental Symptoms    : Sealed aura, blocked hazard, unknown fog, dormant embers       |
|    +-- Diurnal Lighting Bands    : Dawn (5-8h), Day (8-17h), Dusk (17-20h), Night (20-5h)          |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

### Core Engine Invariants
* **Tile Coordinate Scale**: The fundamental world grid tile is $16 \times 16$ pixels (`WORLD.tile = 16`). World dimensions are $96 \times 72$ tiles ($1536 \times 1152$ px).
* **Coordinate Mapping**: World coordinates $(x, y)$ map to screen space $(sx, sy)$ via:
  $$sx = (x - cx) \cdot 16 + \frac{W_{\text{canvas}}}{2}, \quad sy = (y - cy) \cdot 16 + \frac{H_{\text{canvas}}}{2}$$
  where $(cx, cy)$ is camera center lerped from player velocity and screen shake.
* **Non-Gamified Exploration Invariant**: Pure observation and cartography. The codebase strictly forbids player levels, XP, productivity scores, or combat counters.
* **Deterministic Interpolation**: All motion equations must be continuous functions of `game.now` (monotonic milliseconds) or accumulated delta time $dt$, ensuring 60fps/120fps display-rate independence.

---

## 2. Master Production Spreads Specification (Spreads 01 to 11)

The entire Worldwalker visual universe is authored across **11 Master Production Spreads**. These spreads define the exact authoring sheets, grid cell dimensions, layer masks, and export configurations.

```
+---------------------------------------------------------------------------------------------------+
| SPREAD OVERVIEW                                                                                   |
+---------------------------------------------------------------------------------------------------+
| Spread ID | Spread Title                         | Sheet Resolution | Cell Size   | Slices Yield  |
+-----------+--------------------------------------+------------------+-------------+---------------+
| SPREAD-01 | Player Traveler Locomotion & Verbs   | 512 x 512 px     | 32 x 42 px  | 34 slices     |
| SPREAD-02 | Settlement Residents & Guides        | 512 x 512 px     | 20 x 29 px  | 40 slices     |
| SPREAD-03 | Road Couriers & Expedition Travelers | 256 x 256 px     | 20 x 29 px  | 15 slices     |
| SPREAD-04 | CRT Dialogue Portraits & Emotes      | 1024 x 512 px    | 80 x 80 px  | 48 slices     |
| SPREAD-05 | Regional Signature Landmarks         | 1024 x 1024 px   | Varied      | 20 slices     |
| SPREAD-06 | Settlement Architecture Structures   | 1024 x 1024 px   | Varied      | 54 slices     |
| SPREAD-07 | Interior Chambers, Floors & Props    | 512 x 512 px     | Varied      | 42 slices     |
| SPREAD-08 | Traversal Systems & Physical Verbs   | 256 x 256 px     | Varied      | 24 slices     |
| SPREAD-09 | Environmental Symptoms & Biome Masks | 512 x 512 px     | Varied      | 28 slices     |
| SPREAD-10 | Terrain Bitmask Autotile Transitions | 512 x 256 px     | 16 x 16 px  | 64 slices     |
| SPREAD-11 | HUD, Compass, Map & Iconography      | 256 x 256 px     | Varied      | 32 slices     |
+-----------+--------------------------------------+------------------+-------------+---------------+
| TOTALS    | 11 Master Production Spreads         |                  |             | 401 Slices    |
+---------------------------------------------------------------------------------------------------+
```

---

### Spread 01: Player Traveler Locomotion & Verbs
* **Sheet Resolution**: $512 \times 512$ px, RGBA 32-bit PNG.
* **Cell Dimensions**: $32 \times 42$ px per frame.
* **Layout Matrix**: 8 Directional Rows $\times$ 6 Action Columns.
  * **Row 0**: South ($0^\circ$) — Walk 0, Walk 1, Walk 2, Idle, Sprint, Hop.
  * **Row 1**: South-West ($45^\circ$) — Walk 0, Walk 1, Walk 2, Idle, Sprint, Hop.
  * **Row 2**: West ($90^\circ$) — Walk 0, Walk 1, Walk 2, Idle, Sprint, Hop.
  * **Row 3**: North-West ($135^\circ$) — Walk 0, Walk 1, Walk 2, Idle, Sprint, Hop.
  * **Row 4**: North ($180^\circ$) — Walk 0, Walk 1, Walk 2, Idle, Sprint, Hop.
  * **Row 5**: North-East ($225^\circ$) — Walk 0, Walk 1, Walk 2, Idle, Sprint, Hop.
  * **Row 6**: East ($270^\circ$) — Walk 0, Walk 1, Walk 2, Idle, Sprint, Hop.
  * **Row 7**: South-East ($315^\circ$) — Walk 0, Walk 1, Walk 2, Idle, Sprint, Hop.
  * **Auxiliary Bank (Lower Right)**:
    * `player_climb_0.png`, `player_climb_1.png` ($32 \times 42$ px)
    * `player_squeeze_0.png`, `player_squeeze_1.png` ($24 \times 42$ px)
    * `player_jump_apex.png`, `player_jump_fall.png` ($32 \times 42$ px)
    * `player_dash_trail.png` ($36 \times 42$ px translucent alpha mask)

---

### Spread 02: Settlement Residents & World Guides
* **Sheet Resolution**: $512 \times 512$ px, RGBA 32-bit PNG.
* **Cell Dimensions**: $20 \times 29$ px per character frame.
* **Layout Matrix**: 8 Resident Rows $\times$ 5 Behavior Columns.
  * **Row 0**: The Archivist (Starsilk) — Idle South, Shift Work (scroll unroll), Night Slumber, Reverse Facing, Greet Turn.
  * **Row 1**: The Engineer (Screen Weasels) — Idle South, Shift Work (soldering stylus spark), Night Slumber, Reverse Facing, Greet Turn.
  * **Row 2**: The Cartographer (Atlas of One) — Idle South, Shift Work (brass sextant inspection), Night Slumber, Reverse Facing, Greet Turn.
  * **Row 3**: The Merchant (Dash Ledger) — Idle South, Shift Work (balance scale weigh), Night Slumber, Reverse Facing, Greet Turn.
  * **Row 4**: The Station Keeper (Orbital Tomb) — Idle South, Shift Work (radio tuning dial), Night Slumber, Reverse Facing, Greet Turn.
  * **Row 5**: The Wanderer (Overworld cross-region) — Idle South, Shift Walk (staff stride), Night Campfire Rest, Reverse Facing, Greet Turn.
  * **Row 6**: The Harbor Keeper (Quayside / Docks) — Idle South, Shift Work (hawser rope knot), Night Slumber, Reverse Facing, Greet Turn.
  * **Row 7**: The Chronicler (History Relays) — Idle South, Shift Work (quill ledger entry), Night Reading, Reverse Facing, Greet Turn.

---

### Spread 03: Road Couriers & Expedition Travelers
* **Sheet Resolution**: $256 \times 256$ px, RGBA 32-bit PNG.
* **Cell Dimensions**: $20 \times 29$ px per frame.
* **Layout Matrix**: 5 Regional Courier Rows $\times$ 3 Movement Columns (Walk 0, Walk 1, Idle Consultation).
  * **Row 0**: Starsilk Archive Courier / Spire Chronicler (carrying sealed folio tube).
  * **Row 1**: Screen Weasels Signal Runner / Cable Splicer (carrying wire harness & continuity tester).
  * **Row 2**: Atlas Mountain Surveyor / Highland Guide (carrying altimeter rod & map tube).
  * **Row 3**: Dash Ledger Courier / Audit Clerk (carrying ironbound receipt pouch).
  * **Row 4**: Orbital Station Drifter / Beacon Engineer (carrying battery pack & thermal blanket).

---

### Spread 04: CRT Dialogue Portraits & Emote States
* **Sheet Resolution**: $1024 \times 512$ px, RGBA 32-bit PNG.
* **Cell Dimensions**: $80 \times 80$ px per portrait.
* **Layout Matrix**: 12 Character Rows $\times$ 4 Emote Columns.
  * **Columns**: `[0] Base Expression`, `[1] Phoneme Mouth-Open (Talk)`, `[2] Eye-Blink (Closed Lids)`, `[3] Expressive Reaction`.
  * **Row 0**: Hero Neutral (`portrait_hero_neutral`, talk, blink, alert wide-eyed).
  * **Row 1**: Hero Smile (`portrait_hero_smile`, talk, blink, laugh).
  * **Row 2**: Hero Worried (`portrait_hero_worried`, talk, blink, distressed).
  * **Row 3**: Hero Thinking (`portrait_hero_thinking`, talk, blink, realization).
  * **Row 4**: The Archivist (`portrait_archivist`, talk, blink, stern frown).
  * **Row 5**: The Engineer (`portrait_engineer`, talk, blink, toothy smirk).
  * **Row 6**: The Cartographer (`portrait_cartographer`, talk, blink, inquisitive tilt).
  * **Row 7**: The Merchant (`portrait_merchant`, talk, blink, calculating squint).
  * **Row 8**: The Station Keeper (`portrait_station_keeper`, talk, blink, weary stare).
  * **Row 9**: The Wanderer (`portrait_wanderer`, talk, blink, gentle warmth).
  * **Row 10**: The Harbor Keeper (`portrait_harbor_keeper`, talk, blink, sea laugh).
  * **Row 11**: The Chronicler (`portrait_chronicler`, talk, blink, scribe concentration).

---

### Spread 05: Regional Signature Landmarks
* **Sheet Resolution**: $1024 \times 1024$ px, RGBA 32-bit PNG.
* **Content**: 5 Signature Monuments with 3 Multi-Layer Passes (Base Exterior, Nocturnal Emissive Mask, Kinetic Dynamic Layer).
  * **Quadrant 1 (Starsilk Spire)**:
    * `landmark_starsilk.png` ($116 \times 116$ px base obsidian tower).
    * `landmark_starsilk_night.png` ($116 \times 116$ px cyan conduit glow).
    * `landmark_starsilk_weave.png` ($116 \times 116$ px pulsing data filament threads).
  * **Quadrant 2 (Screen Weasels Relay)**:
    * `landmark_screen_weasels.png` ($116 \times 116$ px antenna gantry).
    * `landmark_weasels_night.png` ($116 \times 116$ px amber cabin windows).
    * `landmark_weasels_crt.png` ($48 \times 24$ px dual CYD CRT screens with glyph animations).
  * **Quadrant 3 (Atlas Observatory)**:
    * `landmark_atlas.png` ($116 \times 116$ px sandstone domed observatory).
    * `landmark_atlas_night.png` ($116 \times 116$ px slit aperture lantern glow).
    * `landmark_atlas_armillary.png` ($68 \times 68$ px concentric rotating brass celestial rings).
  * **Quadrant 4 (Dash Counting Hall)**:
    * `landmark_dash.png` ($140 \times 112$ px timber ledger fortress).
    * `landmark_dash_night.png` ($140 \times 112$ px gold tally lantern row).
    * `landmark_dash_scales.png` ($32 \times 32$ px oscillating balance arm).
  * **Quadrant 5 (Orbital Meridian Gantry)**:
    * `landmark_orbital.png` ($116 \times 128$ px space station skeleton).
    * `landmark_orbital_night.png` ($116 \times 128$ px emergency beacon strobes).
    * `landmark_orbital_dish.png` ($72 \times 72$ px 4-arm rotating telemetry radar).

---

### Spread 06: Settlement Architecture Structures
* **Sheet Resolution**: $1024 \times 1024$ px, RGBA 32-bit PNG.
* **Content**: The 22 Unique Settlement Structures mapped in `settlements.js`.
  * **Grid Organization**:
    1. `settlement_arch` ($58 \times 40$) $\to$ Base + `settlement_arch_lit` (keystone lantern glow).
    2. `settlement_beacon` ($44 \times 62$) $\to$ Base + `settlement_beacon_flare` (radial light beam).
    3. `settlement_cottage` ($54 \times 50$) $\to$ Base + `settlement_cottage_lit` + `settlement_cottage_smoke` (3-frame chimney plume).
    4. `settlement_crystal` ($50 \times 52$) $\to$ Base + `settlement_crystal_glow` (harmonic pulse mask).
    5. `settlement_desert_ruin` ($60 \times 54$) $\to$ Base + `settlement_desert_ruin_dust` (sand whisper overlay).
    6. `settlement_docks` ($72 \times 44$) $\to$ Base + `settlement_docks_water` (lapping foam wake).
    7. `settlement_floating_ruin` ($66 \times 64$) $\to$ Base + `settlement_floating_ruin_particles` (gravity motes).
    8. `settlement_garden_ruin` ($58 \times 48$) $\to$ Base + `settlement_garden_ruin_bloom` (bioluminescent flora).
    9. `settlement_gate` ($58 \times 54$) $\to$ Base + `settlement_gate_open` (raised iron portcullis).
    10. `settlement_harbor` ($72 \times 58$) $\to$ Base + `settlement_harbor_lit` (wharf lanterns).
    11. `settlement_inn` ($60 \times 50$) $\to$ Base + `settlement_inn_lit` (stained glass warm glow).
    12. `settlement_lighthouse` ($38 \times 52$) $\to$ Base + `settlement_lighthouse_beam` (sweeping Fresnel cone).
    13. `settlement_observatory` ($58 \times 62$) $\to$ Base + `settlement_observatory_dome` (rotated brass aperture).
    14. `settlement_pier` ($64 \times 42$) $\to$ Base + `settlement_pier_tide` (tidal waterline wash).
    15. `settlement_shrine` ($44 \times 54$) $\to$ Base + `settlement_shrine_fire` (twin blue ritual braziers).
    16. `settlement_snow_lodge` ($54 \times 52$) $\to$ Base + `settlement_snow_lodge_lit` (frost-framed window pane).
    17. `settlement_statue` ($42 \times 52$) $\to$ Base + `settlement_statue_moss` (overgrown ancient patina).
    18. `settlement_swamp` ($56 \times 48$) $\to$ Base + `settlement_swamp_gas` (phosphorescent marsh bubbles).
    19. `settlement_tent` ($56 \times 48$) $\to$ Base + `settlement_tent_lit` (internal lantern shadow).
    20. `settlement_tower` ($48 \times 64$) $\to$ Base + `settlement_tower_lit` (crenellation pitch torches).
    21. `settlement_watchtower` ($50 \times 54$) $\to$ Base + `settlement_watchtower_beacon` (heliograph signal glare).
    22. `settlement_windmill` ($52 \times 60$) $\to$ Base building + `settlement_windmill_blades` ($48 \times 48$ rotor cross).
    23. `settlement_workshop` ($60 \times 54$) $\to$ Base + `settlement_workshop_sparks` (furnace flue particle sparks).

---

### Spread 07: Interior Chambers, Floors & Props
* **Sheet Resolution**: $512 \times 512$ px, RGBA 32-bit PNG.
* **Flooring Tiles**:
  * `interior_floor_stone.png` ($49 \times 49$ px)
  * `interior_floor_gold.png` ($49 \times 49$ px)
  * `interior_floor_wood.png` ($49 \times 49$ px)
* **Carpets & Wall Architecture**:
  * `interior_rug_green.png`, `interior_rug_blue.png` ($160 \times 104$ px)
  * `interior_wall_panel.png` ($64 \times 58$ px tileable wainscot)
  * `interior_door.png` ($66 \times 82$ px closed) $\to$ `interior_door_open.png` (light spillway)
* **Scholarly & Interior Furnishings**:
  * `interior_bookshelf.png`, `interior_bookcase.png` ($150 \times 78$ px) $\to$ Lit reading sconce companion.
  * `interior_table.png` ($190 \times 92$ px) $\to$ Active unrolled cartography map companion.
  * `interior_desk.png` ($160 \times 95$ px) $\to$ Active illuminated scholar ledger companion.
  * `interior_fireplace.png` ($112 \times 118$ px) $\to$ 3-Frame hearth fire loop (`fire_0`, `fire_1`, `fire_2`).
  * `interior_globe.png` ($82 \times 96$ px) $\to$ Rotated $90^\circ$ continental alignment companion.
  * `interior_telescope.png` ($104 \times 96$ px) $\to$ Zenith angled brass barrel companion.
  * `interior_crystal_blue.png`, `interior_crystal_purple.png` ($54 \times 76$, $58 \times 82$ px) $\to$ Internal facet glow pulse.
  * `interior_market_stall.png` ($150 \times 118$ px) $\to$ Sample trays & scale companion.
  * `interior_lantern.png` ($52 \times 78$ px) $\to$ Gimbal amber mantle glow companion.

---

### Spread 08: Traversal Systems & Physical Verbs
* **Sheet Resolution**: $256 \times 256$ px, RGBA 32-bit PNG.
* **River Traversal Systems**:
  * `raft_wood.png` ($24 \times 14$ px timber deck) $\to$ `raft_cruise_wake.png` (stern churning bubble froth).
  * `stepping_stone.png` ($16 \times 16$ px basalt river boulder) $\to$ `stepping_stone_splash.png` (swirling eddy ring).
* **Trail Navigation & Teleportation**:
  * `signpost_wood.png` ($18 \times 18$ px carved marker) $\to$ `signpost_sway.png` (aerodynamic wind-deflected board).
  * `settlement_bulletin.png` ($24 \times 24$ px timber kiosk) $\to$ `settlement_bulletin_pinned.png` (fluttering dispatches).
  * `fx_waystone.png` ($28 \times 32$ px dormant granite pylon) $\to$ `fx_waystone_attuned.png` (radiant gold ley-line runes).
* **Elevation & Obstacle Verbs**:
  * `traversal_climb.png` ($24 \times 16$ px cliff-face stone rungs & catwalk stairs).
  * `traversal_squeeze.png` ($16 \times 16$ px narrow cable gap hazard boundary).

---

### Spread 09: Environmental Symptoms & Biome Masks
* **Sheet Resolution**: $512 \times 512$ px, RGBA 32-bit PNG.
* **Project Condition State Symptoms**:
  * `symptom_sealed_sparkle.png` ($18 \times 18$ px golden star orbital motes).
  * `symptom_blocked_hazard.png` ($32 \times 32$ px crimson hazard crosshatch & falling rain streaks).
  * `symptom_unknown_fog.png` ($128 \times 128$ px soft-edge radial cloud disc).
  * `symptom_dormant_ash.png` ($16 \times 16$ px drifting amber particulate).
  * `symptom_active_spore.png` ($16 \times 16$ px floating emerald life spores).
* **Atmospheric Particle Shrouds**:
  * `fx_dust.png` ($116 \times 52$ px horizontal debris drift bank).
  * `fx_torch.png` ($16 \times 24$ px iron perimeter torch) $\to$ `fx_torch_ember_{0,1,2}.png` (rising spark cycle).
  * `fx_water_ripple.png` ($20 \times 12$ px concentric landing shockwave ring).

---

### Spread 10: Terrain Bitmask Autotile Transitions
* **Sheet Resolution**: $512 \times 256$ px, RGBA 32-bit PNG.
* **Content**: 47-tile Wang / marching-squares autotiling bitmasks for seamless 16px tile transitions across 9 biomes:
  * Biomes: `grass`, `grass_flowers`, `dirt`, `stone`, `forest`, `water`, `shore`, `snow`, `sand`.
  * Slices: Outer corners, inner corners, cardinal shorelines, diagonal water transitions, cliff ledges.

---

### Spread 11: HUD, Compass, Map & Iconography
* **Sheet Resolution**: $256 \times 256$ px, RGBA 32-bit PNG.
* **UI Elements & Bezel Masks**:
  * `ui_minimap.png` ($152 \times 152$ px circular brass orrery compass bezel).
  * `ui_dialogue.png` ($320 \times 96$ px CRT terminal dialogue bezel with scanline grain).
  * `ui_panel.png`, `ui_scroll.png` ($128 \times 128$ px parchment inventory and journal frames).
* **Field Discovery & Status Badges**:
  * `icon_evidence.png` ($21 \times 21$ px unresolved rumor ring).
  * `icon_verified.png` ($21 \times 21$ px green seal of source completion).
  * `icon_blocked.png`, `icon_unknown.png` ($21 \times 21$ px diagnostic badges).
  * `icon_book.png` ($22 \times 22$ px field manual page) $\to$ `icon_book_flutter.png`.
  * `icon_map.png`, `icon_compass.png`, `icon_crystal.png`, `icon_key.png`, `icon_lantern.png` ($16 \times 16$ px).

---

## 3. Comprehensive Entity & Character Catalog

### 3.1 Player Traveler Entity
The protagonist is a field scholar and cartographer.

```
+---------------------------------------------------------------------------------------------------+
| PLAYER TRAVELER LOCOMOTION & ACTION MATRIX                                                       |
+---------------------------------------------------------------------------------------------------+
| State Key         | Primary Base Slice       | Secondary Companion Slice     | Motion Profile     |
+-------------------+--------------------------+-------------------------------+--------------------+
| Walk South (0)    | player_down_0.png        | player_down_1, player_down_2  | Stride ν = 8 Hz    |
| Walk South-West(1)| player_downleft_0.png    | player_downleft_1, 2          | Stride ν = 8 Hz    |
| Walk West (2)     | player_left_0.png        | player_left_1, player_left_2  | Stride ν = 8 Hz    |
| Walk North-West(3)| player_upleft_0.png      | player_upleft_1, 2            | Stride ν = 8 Hz    |
| Walk North (4)    | player_up_0.png          | player_up_1, player_up_2      | Stride ν = 8 Hz    |
| Walk North-East(5)| player_upright_0.png     | player_upright_1, 2           | Stride ν = 8 Hz    |
| Walk East (6)     | player_right_0.png       | player_right_1, player_right_2| Stride ν = 8 Hz    |
| Walk South-East(7)| player_downright_0.png   | player_downright_1, 2         | Stride ν = 8 Hz    |
| Idle Rest (All 8) | player_idle_<dir>.png    | Weight-shift breathing        | A = 0.75px, T=2.4s |
| Sprint Dash       | player_sprint_<card>.png | player_dash_trail.png         | ν = 13 Hz, Ghost   |
| Cliff Climb Verb  | player_climb_0.png       | player_climb_1.png            | Hand-over-hand 6Hz |
| Gap Squeeze Verb  | player_squeeze_0.png     | player_squeeze_1.png          | Sideways shuffle   |
| River Hop Apex    | player_jump_apex.png     | player_jump_fall.png          | Parabolic H = 10px |
+---------------------------------------------------------------------------------------------------+
```

#### Motion Interpolation Formulation
1. **Sub-Tile Velocity Vector Lerp**:
   $$\vec{v}(t + \Delta t) = \vec{v}(t) + (\vec{v}_{\text{target}} - \vec{v}(t)) \cdot \left(1 - e^{-k \Delta t}\right)$$
   where $k_{\text{accel}} = 14.0\text{ s}^{-1}$ and $k_{\text{friction}} = 18.0\text{ s}^{-1}$.
2. **Hop Trajectory with Ground Shadow Attenuation**:
   $$y_{\text{hop}}(t) = -H_{\max} \cdot \sin\left(\left(1 - \frac{t}{\tau}\right)\pi\right), \quad \tau = 0.38\text{ s}, \quad H_{\max} = 10\text{ px}$$
   $$r_{\text{shadow}}(t) = R_0 \cdot \left(1 - 0.35 \cdot \frac{|y_{\text{hop}}(t)|}{H_{\max}}\right), \quad R_0 = 8\text{ px}$$

---

### 3.2 Settlement Residents & World Guides

```
+---------------------------------------------------------------------------------------------------+
| SETTLEMENT GUIDES & RESIDENTS MATRIX                                                              |
+---------------------------------------------------------------------------------------------------+
| Figure & Region    | Primary Base   | Secondary Work       | Secondary Night     | Secondary Turn |
+--------------------+----------------+----------------------+---------------------+----------------+
| The Archivist      | npc_archivist  | npc_archivist_scroll | npc_archivist_night | npc_archivist_b|
| The Engineer       | npc_engineer   | npc_engineer_solder  | npc_engineer_night  | npc_engineer_b |
| The Cartographer   | npc_cartograph | npc_cartograph_scope | npc_cartograph_night| npc_cartograp_b|
| The Merchant       | npc_merchant   | npc_merchant_scales  | npc_merchant_night  | npc_merchant_b |
| The Station Keeper | npc_station_k  | npc_station_k_radio  | npc_station_k_night | npc_station_k_b|
| The Wanderer       | npc_wanderer   | npc_wanderer_staff   | npc_wanderer_camp   | npc_wanderer_b |
| The Harbor Keeper  | npc_harbor_k   | npc_harbor_k_rope    | npc_harbor_k_night  | npc_harbor_k_b |
| The Chronicler     | npc_chronicler | npc_chronicler_write | npc_chronicler_read | npc_chronicler_b|
+---------------------------------------------------------------------------------------------------+
```

#### Motion Interpolation Formulation
1. **Diurnal Lissajous Roam Pathing**:
   $$x(t) = x_0 + \Delta x_{\text{band}} + r_{\text{roam}} \cdot \sin(\omega t + 2.7i + 0.03x_p)$$
   $$y(t) = y_0 + \Delta y_{\text{band}} + 0.48 r_{\text{roam}} \cdot \cos(0.73(\omega t + 2.7i + 0.03x_p))$$
   *Parameters*: $\omega = 0.00055\text{ rad/ms}$, $r_{\text{roam}} \in [0.18\text{ (night)}, 0.42\text{ (eve)}, 0.72\text{ (morn)}, 1.05\text{ (day)}]$.
2. **Idle Breathing Levitation**:
   $$y_{\text{bob}}(t) = 1.1 \cdot \sin(0.004 t + i)\text{ px}$$
3. **Player Proximity Slerp / Look-At**:
   $$\theta_{\text{look}} = \text{atan2}(y_{\text{player}} - y_{\text{npc}}, x_{\text{player}} - x_{\text{npc}})$$
   Quantized to 4 cardinal directions with $180\text{ ms}$ hysteresis delay.

---

### 3.3 Road Couriers & Expedition Travelers

Couriers encountered along overworld highways between settlements (`travel-encounters.js`):
1. **Starsilk Archive Courier / Spire Chronicler**: Carries sealed leather document canister.
2. **Screen Weasels Signal Runner / Cable Splicer**: Carries battery pack and copper wire coils.
3. **Atlas Mountain Surveyor / Highland Guide**: Wears climbing gaiters and carries surveyor rod.
4. **Dash Ledger Courier / Audit Clerk**: Carries brass tally scales and journal lockbox.
5. **Orbital Station Drifter / Beacon Engineer**: Wears thermal flight poncho and headlamp.

* **Motion Interpolation**: Linear road spline interpolation between project anchor nodes $A$ and $B$:
  $$\vec{P}(u) = (1 - u)\vec{A} + u\vec{B}, \quad u(t) = \frac{(v \cdot t) \bmod D}{D}$$
  with vertical stride bounce $y(t) = 0.9 \cdot |\sin(0.008 t)|\text{ px}$.

---

## 4. CRT Dialogue Portraits & Reaction System

High-fidelity $80 \times 80$ px portraits displayed in the dialogue terminal.

```
+---------------------------------------------------------------------------------------------------+
| CRT PORTRAITS MATRIX                                                                              |
+---------------------------------------------------------------------------------------------------+
| Subject            | Base Neutral   | Phoneme Mouth-Flap   | Eye-Blink           | Special Emote  |
+--------------------+----------------+----------------------+---------------------+----------------+
| Hero Neutral       | p_hero_neutral | p_hero_neutral_talk  | p_hero_neutral_blink| p_hero_alert   |
| Hero Smile         | p_hero_smile   | p_hero_smile_talk    | p_hero_smile_blink  | p_hero_laugh   |
| Hero Worried       | p_hero_worried | p_hero_worried_talk  | p_hero_worried_blink| p_hero_dread   |
| Hero Thinking      | p_hero_thinking| p_hero_thinking_talk | p_hero_thinking_blnk| p_hero_eureka  |
| The Archivist      | p_archivist    | p_archivist_talk     | p_archivist_blink   | p_archivist_ste|
| The Engineer       | p_engineer     | p_engineer_talk      | p_engineer_blink    | p_engineer_smk |
| The Cartographer   | p_cartographer | p_cartographer_talk  | p_cartographer_blink| p_cartograph_cu|
| The Merchant       | p_merchant     | p_merchant_talk      | p_merchant_blink    | p_merchant_calc|
| The Station Keeper | p_station_k    | p_station_k_talk     | p_station_k_blink   | p_station_k_wea|
| The Wanderer       | p_wanderer     | p_wanderer_talk      | p_wanderer_blink    | p_wanderer_kind|
| The Harbor Keeper  | p_harbor_k     | p_harbor_k_talk      | p_harbor_k_blink    | p_harbor_k_laug|
| The Chronicler     | p_chronicler   | p_chronicler_talk    | p_chronicler_blink  | p_chronicler_sc|
+---------------------------------------------------------------------------------------------------+
```

#### Motion & Lifecycle Interpolation Formulations
1. **Phoneme Mouth-Flap Function**:
   $$M(t) = \begin{cases} \text{talk\_slice}, & \text{if typewriter active and } \lfloor t / 85\text{ms} \rfloor \bmod 2 = 1 \\ \text{base\_slice}, & \text{otherwise} \end{cases}$$
2. **Poisson Stochastic Eye-Blink Process**:
   Interval between blinks $\Delta t \sim \mathcal{U}(3.4\text{ s}, 5.6\text{ s})$. Single-frame lid closure held for $110\text{ ms}$.
3. **Dialogue Box Modal Entry Spring Easing**:
   $$y_{\text{modal}}(\tau) = Y_0 \cdot \left(1 - \left(1 + 2.70158(\tau - 1)^3 + 1.70158(\tau - 1)^2\right)\right), \quad \tau = \frac{t}{280\text{ ms}}$$

---

## 5. Regional Signature Landmarks

Monumental structures defining the five project biomes.

```
+---------------------------------------------------------------------------------------------------+
| SIGNATURE LANDMARKS MATRIX                                                                        |
+---------------------------------------------------------------------------------------------------+
| Landmark & Region     | Base Daytime Slice   | Nocturnal Emissive Mask | Kinetic Overlay Pass     |
+-----------------------+----------------------+-------------------------+--------------------------+
| Starsilk Spire        | landmark_starsilk    | landmark_starsilk_night | landmark_starsilk_weave  |
| Screen Weasels Relay  | landmark_weasels     | landmark_weasels_night  | landmark_weasels_crt     |
| Atlas Observatory     | landmark_atlas       | landmark_atlas_night    | landmark_atlas_armillary |
| Dash Counting Hall    | landmark_dash        | landmark_dash_night     | landmark_dash_scales     |
| Orbital Gantry        | landmark_orbital     | landmark_orbital_night  | landmark_orbital_dish    |
+---------------------------------------------------------------------------------------------------+
```

#### Motion Interpolation Formulations
1. **Orbital Radar & Atlas Armillary Rotations**:
   $$\theta_{\text{radar}}(t) = (\theta_0 + 0.0003 \cdot t) \bmod 2\pi \quad (\approx 17.19^\circ/\text{s})$$
   $$\theta_{\text{armillary\_inner}}(t) = (\theta_0 + 0.00045 \cdot t) \bmod 2\pi, \quad \theta_{\text{outer}}(t) = (\theta_0 - 0.0002 \cdot t) \bmod 2\pi$$
2. **Starsilk Quadratic Filament Weave**:
   For strand $i \in [0, 13]$:
   $$x_i = -48 + 7i, \quad y_{\text{ctrl}, i}(t) = -58 + 36 \cdot \sin(0.001 t + i)\text{ px}$$
   Rendered through quadratic bezier $B_i(u) = (1-u)^2 P_{\text{start}, i} + 2(1-u)u P_{\text{ctrl}, i}(t) + u^2 P_{\text{end}, i}$.
3. **Screen Weasels CRT Terminal Glitch**:
   $$I(t) = 0.88 + 0.12 \cdot \sin(0.003 t) \cdot \cos(0.007 t + 1.4)$$
   Scanline jitter offset: $y_{\text{jitter}}(t) = \sin(0.003 t) \cdot 2.0\text{ px}$.
4. **Nocturnal Emissive Glow Breathe**:
   $$R_{\text{glow}}(t) = 24 + 2.0 \cdot \sin(0.005 t + x_p)\text{ px}$$

---

## 6. Settlement Structural Architecture (22 Structures)

```
+---------------------------------------------------------------------------------------------------+
| SETTLEMENT STRUCTURES MATRIX                                                                      |
+---------------------------------------------------------------------------------------------------+
| Structure ID     | Resolution | Base Asset              | Secondary Lit / Kinetic Companion       |
+------------------+------------+-------------------------+-----------------------------------------+
| arch             | 58 x 40 px | settlement_arch.png     | settlement_arch_lit.png (lantern glow)  |
| beacon           | 44 x 62 px | settlement_beacon.png   | settlement_beacon_flare.png (light beam)|
| cottage          | 54 x 50 px | settlement_cottage.png  | settlement_cottage_smoke (chimney plume)|
| crystal          | 50 x 52 px | settlement_crystal.png  | settlement_crystal_glow.png (aura pulse)|
| desert_ruin      | 60 x 54 px | settlement_desert_ruin  | settlement_desert_ruin_dust.png         |
| docks            | 72 x 44 px | settlement_docks.png    | settlement_docks_water.png (foam wake)  |
| floating_ruin    | 66 x 64 px | settlement_floating_ruin| settlement_floating_particles.png       |
| garden_ruin      | 58 x 48 px | settlement_garden_ruin  | settlement_garden_bloom.png             |
| gate             | 58 x 54 px | settlement_gate.png     | settlement_gate_open.png (clearance)    |
| harbor           | 72 x 58 px | settlement_harbor.png   | settlement_harbor_lit.png (quayside glow|
| inn              | 60 x 50 px | settlement_inn.png      | settlement_inn_lit.png (stained glass)  |
| lighthouse       | 38 x 52 px | settlement_lighthouse   | settlement_lighthouse_beam.png (Fresnel)|
| observatory      | 58 x 62 px | settlement_observatory  | settlement_observatory_dome.png (scope) |
| pier             | 64 x 42 px | settlement_pier.png     | settlement_pier_tide.png (waterline)    |
| shrine           | 44 x 54 px | settlement_shrine.png   | settlement_shrine_fire.png (braziers)   |
| snow_lodge       | 54 x 52 px | settlement_snow_lodge   | settlement_snow_lodge_lit.png           |
| statue           | 42 x 52 px | settlement_statue.png   | settlement_statue_moss.png              |
| swamp            | 56 x 48 px | settlement_swamp.png    | settlement_swamp_gas.png (wisp bubbles) |
| tent             | 56 x 48 px | settlement_tent.png     | settlement_tent_lit.png (shadow silhoue)|
| tower            | 48 x 64 px | settlement_tower.png    | settlement_tower_lit.png (crenellations)|
| watchtower       | 50 x 54 px | settlement_watchtower   | settlement_watchtower_beacon.png        |
| windmill         | 52 x 60 px | settlement_windmill     | settlement_windmill_blades (rotary cross|
| workshop         | 60 x 54 px | settlement_workshop.png | settlement_workshop_sparks.png          |
+---------------------------------------------------------------------------------------------------+
```

#### Motion Interpolation Formulations
1. **Windmill Rotor Continuous Rotation**:
   $$\theta_{\text{mill}}(t) = (0.0012 \cdot t) \bmod 2\pi \quad (\approx 68.75^\circ/\text{s})$$
   Blades rendered with center origin $(sx, sy - 28)$ transformed via rotation matrix.
2. **Lighthouse / Beacon Fresnel Sweep**:
   $$\phi(t) = (0.0008 \cdot t) \bmod 2\pi, \quad \vec{P}(t) = \begin{bmatrix} x_0 + 72 \cos(\phi) \\ y_0 + 25 \sin(\phi) \end{bmatrix}$$
   Alpha attenuation: $\alpha(\phi) = 0.60 \cdot |\sin(\phi)|$.
3. **Chimney Smoke Plume Kinematics**:
   For puff $k \in [0, 2]$ launched at period $T = 1600\text{ ms}$ ($\tau = (t + 533k) \bmod T / T$):
   $$y_k(\tau) = y_{\text{stack}} - 22\tau - 8\tau^2, \quad x_k(\tau) = x_{\text{stack}} + 14\tau + 3\sin(3\pi \tau)$$
   $\text{Scale}(\tau) = 0.8 + 1.2\tau$, $\text{Alpha}(\tau) = 0.70(1 - \tau)$.
4. **Floating Ruin Levitation**:
   $$y_{\text{float}}(t) = y_0 + 3.5 \cdot \sin(0.0015 t + \phi_0)\text{ px}$$

---

## 7. Interior Chambers & Furnishings (18 Interior Assets)

```
+---------------------------------------------------------------------------------------------------+
| INTERIOR FURNISHINGS & PROPS MATRIX                                                               |
+---------------------------------------------------------------------------------------------------+
| Asset Key          | Base Resolution | Primary Asset          | Secondary State Companion         |
+--------------------+-----------------+------------------------+-----------------------------------+
| floor_stone        | 49 x 49 px      | interior_floor_stone   | interior_floor_stone_worn         |
| floor_gold         | 49 x 49 px      | interior_floor_gold    | interior_floor_gold_tile          |
| floor_wood         | 49 x 49 px      | interior_floor_wood    | interior_floor_wood_creak         |
| rug_green          | 160 x 104 px    | interior_rug_green     | interior_rug_green_worn           |
| rug_blue           | 160 x 104 px    | interior_rug_blue      | interior_rug_blue_worn            |
| wall_panel         | 64 x 58 px      | interior_wall_panel    | interior_wall_panel_shadow        |
| bookshelf          | 150 x 78 px     | interior_bookshelf     | interior_bookshelf_lit            |
| bookcase           | 150 x 78 px     | interior_bookcase      | interior_bookcase_lit             |
| table              | 190 x 92 px     | interior_table         | interior_table_active (open maps) |
| desk               | 160 x 95 px     | interior_desk          | interior_desk_active (lit ledger) |
| fireplace          | 112 x 118 px    | interior_fireplace     | interior_fireplace_fire_{0,1,2}   |
| globe              | 82 x 96 px      | interior_globe         | interior_globe_rotated (90 deg)   |
| telescope          | 104 x 96 px     | interior_telescope     | interior_telescope_angled (zenith)|
| door               | 66 x 82 px      | interior_door          | interior_door_open (threshold beam|
| crystal_blue       | 54 x 76 px      | interior_crystal_blue  | interior_crystal_blue_pulse       |
| crystal_purple     | 58 x 82 px      | interior_crystal_purple| interior_crystal_purple_pulse     |
| market_stall       | 150 x 118 px    | interior_market_stall  | interior_market_stall_active      |
| lantern            | 52 x 78 px      | interior_lantern       | interior_lantern_glow (amber)     |
+---------------------------------------------------------------------------------------------------+
```

#### Motion Interpolation Formulations
1. **Hearth Fire Loop & Ambient Flicker**:
   $$f_{\text{fire}}(t) = \left\lfloor \frac{t}{135\text{ ms}} \right\rfloor \bmod 3$$
   $$R_{\text{hearth}}(t) = 42 + 3.8 \cdot \sin(0.011 t) \cdot \cos(0.006 t + 2.1)\text{ px}$$
2. **Resonant Crystal Luminescence**:
   $$\alpha_{\text{crystal}}(t) = 0.40 + 0.45 \cdot \left(\frac{1 + \sin(0.0022 t + \phi_{\text{id}})}{2}\right)^2$$
3. **Interactive Celestial Globe Spin**:
   $$\theta_{\text{globe}}(\tau) = \theta_0 + 3\pi \cdot \left(1 - (1 - \tau)^3\right), \quad \tau = \frac{t - t_{\text{spin}}}{1800\text{ ms}}$$
4. **Hanging Gimbal Lantern Damped Pendulum**:
   $$\theta(t) = \theta_{\max} \cdot e^{-0.55 t} \cdot \cos(3.8 t)$$

---

## 8. Traversal Systems & Physical Movement Verbs

Physical traversal mechanics connecting regions across the map.

```
+---------------------------------------------------------------------------------------------------+
| TRAVERSAL SYSTEMS & PHYSICAL VERBS MATRIX                                                         |
+---------------------------------------------------------------------------------------------------+
| Traversal Feature  | Coordinates     | Primary Slice          | Secondary Action Slice            |
+--------------------+-----------------+------------------------+-----------------------------------+
| River Ferry Raft   | x:36.2, y:43.0  | raft_wood.png          | raft_cruise_wake.png (foam froth) |
| River Stepping St. | x:38, y:26..54  | stepping_stone.png     | stepping_stone_splash.png         |
| Overworld Signpost | 5 junctions     | signpost_wood.png      | signpost_sway.png (wind defection)|
| Noticeboards       | 5 settlements   | settlement_bulletin.png| settlement_bulletin_pinned.png    |
| Waystone Monoliths | 5 settlement    | fx_waystone.png        | fx_waystone_attuned.png           |
| Cliff Stairs Climb | x:61.5, y:21.5  | traversal_climb.png    | Hand-over-hand climbing animation |
| Catwalk Catwalk    | x:43.7, y:46.4  | traversal_climb.png    | Industrial steel ladder frames    |
| Cable Gap Squeeze  | x:73.7, y:59.2  | traversal_squeeze.png  | Sideways narrow squeeze frames    |
+---------------------------------------------------------------------------------------------------+
```

#### Motion Interpolation Formulations
1. **River Ferry Smoothstep Transit**:
   Transits between $x_{\text{west}} = 36.2$ and $x_{\text{east}} = 40.2$ ($y = 43.0$):
   $$x_{\text{ferry}}(\tau) = x_{\text{start}} + (x_{\text{dest}} - x_{\text{start}}) \cdot (3\tau^2 - 2\tau^3), \quad \tau = \frac{t - t_{\text{launch}}}{4200\text{ ms}}$$
   Vertical water bob: $y_{\text{bob}}(t) = 1.35 \cdot \sin(0.0028 t)\text{ px}$.
2. **Stepping Stone River Eddy Swirl**:
   $$\theta(t) = (0.0035 t + y_{\text{stone}}) \bmod 2\pi, \quad r(t) = 6.5 + 1.8 \cdot \sin(0.002 t + x_{\text{stone}})\text{ px}$$
3. **Signpost Aerodynamic Wind Sway**:
   $$\theta_{\text{sign}}(t) = 2.8^\circ \cdot \sin(0.0018 t) \cdot \cos(0.0009 t + 0.5)$$
4. **Waystone Attunement Energy Wave**:
   $$\tau = (0.003 t) \bmod 1, \quad R(\tau) = 14 + 24\tau\text{ px}, \quad \alpha(\tau) = 0.70(1 - \tau)$$

---

## 9. Environmental Symptoms & Biome Condition States

Dynamic symptoms reflecting real source project states (`public/render.js:127-141`, `204-230`).

```
+---------------------------------------------------------------------------------------------------+
| ENVIRONMENTAL SYMPTOMS MATRIX                                                                     |
+---------------------------------------------------------------------------------------------------+
| Condition State    | Tone Color | Primary Symptom Overlay     | Secondary Particle / Light Motion |
+--------------------+------------+-----------------------------+-----------------------------------+
| sealed             | #efc95f    | Golden boundary perimeter   | 7 Orbiting sparkle motes (ω=0.3)  |
| blocked            | #e65b58    | Diagonal crimson crossbars  | 5 Jittering red hazard bars + rain|
| unknown            | #8d96a5    | Radial fog veil (r=145px)   | 5 Drifting cloud ellipses (t*0.2) |
| dormant            | #ab8bc7    | Desaturated ground tone     | 6 Drifting amber ember motes      |
| active / open      | #65e38c    | Clear sunlight gradient     | 5 Spore circles in orbital loop   |
| quiet              | #8bb3c7    | Cool slate ground wash      | Gentle low-frequency ground mist  |
+---------------------------------------------------------------------------------------------------+
```

#### Mathematical Symptom Models
1. **`sealed` Sparkle Orbital Ring**:
   For particle $i \in [0, 6]$:
   $$\theta_i(t) = 0.3 \cdot 0.001 t + i, \quad x_i(t) = 38 \cos(\theta_i), \quad y_i(t) = 19 \sin(\theta_i) - 28$$
2. **`blocked` Rain & Crossbar Jitter**:
   Falling rain streaks (48 streaks):
   $$x_i(t) = (47i + 150 \cdot 0.001 t) \bmod W, \quad y_i(t) = (83i + 230 \cdot 0.001 t) \bmod H$$
   Lightning flash strobe: $\alpha_{\text{strobe}}(t) = 1$ when $\sin(0.0009 t) > 0.985$.
3. **`unknown` Radial Fog Diffusion**:
   $$g(r) = \text{createRadialGradient}\left(\frac{W}{2}, \frac{H}{2}, 60, \frac{W}{2}, \frac{H}{2}, 0.7 \max(W, H)\right)$$
   Alpha falls from $0.00$ at center to $0.27$ at perimeter, with 10 ellipses revolving at $\omega = 0.008\text{ rad/s}$.
4. **Diurnal Ambient Lighting Modulation**:
   * **Dawn ($05:00-08:00$)**: Amber morning glaze `#f3a46b22`.
   * **Day ($08:00-17:00$)**: Golden solar linear gradient `#fff6ce0d` $\to$ transparent.
   * **Dusk ($17:00-20:00$)**: Sunset copper glaze `#e67d5b24`.
   * **Night ($20:00-05:00$)**: Midnight blue wash `#06112672` with 60 twinkling star pixels and a $190\text{px}$ radial lantern circle around the traveler (`#ffd88621`).

---

## 10. Unified Mathematical Motion Interpolation Catalog

```
+---------------------------------------------------------------------------------------------------+
| MATHEMATICAL FORMULA SUMMARY REFERENCE                                                            |
+---------------------------------------------------------------------------------------------------+
| Subsystem          | Equation                                                         | Units     |
+--------------------+------------------------------------------------------------------+-----------+
| Locomotion Lerp    | v(t+dt) = v(t) + (v_target - v(t))(1 - exp(-14.0 dt))            | px/s      |
| Stride Step        | frame = floor(t * 0.008) mod 3                                   | frames    |
| Parabolic Hop      | y_hop = -10 * sin((1 - t / 0.38) * pi)                           | px        |
| Idle Bob           | y_bob = 1.1 * sin(0.004 * t + phase)                             | px        |
| Lissajous Roam X   | x = x_0 + dx + r_roam * sin(0.00055 * t + 2.7*i + 0.03*x_p)      | tiles     |
| Lissajous Roam Y   | y = y_0 + dy + 0.48 * r_roam * cos(0.73 * (0.00055*t + ...))     | tiles     |
| Windmill Rotate    | theta = (0.0012 * t) mod 2*pi                                    | rad       |
| Radar Rotate       | theta = (0.0003 * t) mod 2*pi                                    | rad       |
| Armillary Inner    | theta = (0.00045 * t) mod 2*pi                                   | rad       |
| Armillary Outer    | theta = (-0.0002 * t) mod 2*pi                                   | rad       |
| Starsilk Filament  | y_ctrl = -58 + 36 * sin(0.001 * t + i)                           | px        |
| CRT Glitch         | I = 0.88 + 0.12 * sin(0.003*t) * cos(0.007*t + 1.4)              | intensity |
| Lantern Pendulum   | theta = theta_max * exp(-0.55 * t) * cos(3.8 * t)                | rad       |
| Fireplace Flame    | frame = floor(t / 135ms) mod 3                                   | frames    |
| Fireplace Radius   | R = 42 + 3.8 * sin(0.011*t) * cos(0.006*t + 2.1)                | px        |
| Crystal Pulse      | alpha = 0.40 + 0.45 * ((1 + sin(0.0022*t + phi)) / 2)^2         | alpha     |
| Ferry Transit      | x = x_0 + dx * (3*tau^2 - 2*tau^3), tau = dt / 4200ms            | tiles     |
| Ferry Water Bob    | y = 1.35 * sin(0.0028 * t)                                       | px        |
| Signpost Wind Sway | theta = 2.8 deg * sin(0.0018*t) * cos(0.0009*t + 0.5)            | deg       |
| Waystone Ring Wave | R = 14 + 24 * ((0.003*t) mod 1), alpha = 0.7 * (1 - ((...)))     | px, alpha |
| Dialogue Spring    | y = Y_0 * (1 - (1 + 2.70158*(tau-1)^3 + 1.70158*(tau-1)^2))      | px        |
| Dialogue MouthFlap | state = floor(t / 85ms) mod 2                                    | binary    |
| Poisson Blink      | interval = U(3.4s, 5.6s), hold = 110ms                           | ms        |
| Smoke Rise         | y = y_stack - 22*tau - 8*tau^2, x = x_stack + 14*tau + 3*sin(...) | px        |
+---------------------------------------------------------------------------------------------------+
```

---

## 11. Production Pipeline & Atlas Compilation Rules

1. **Pixel Art Style Guide**:
   * Unfiltered nearest-neighbor rendering (`ctx.imageSmoothingEnabled = false`).
   * Color harmony: Palette constrained to regional obsidian, scrapyard, highland, market, and orbital tones.
   * Outlines: 1px deep tone `#0b0a10` outline around character sprites; anti-aliasing handled via intermediate palette value rather than alpha translucency.
2. **Runtime Serving**:
   * Handled through `server.mjs` endpoint `/api/runtime-asset?name=<filename>`.
   * Asset names registered in `/public/assets/runtime/manifest.json`.
3. **Contract Auditing**:
   * Every new slice added must be verified against `scripts/uplift-contract.mjs` and `scripts/system-contract.mjs` to preserve invariant discipline and zero-breakage stability.
