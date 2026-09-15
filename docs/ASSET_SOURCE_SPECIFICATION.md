# Worldwalker Asset Source & Motion Interpolation Specification

This specification provides the exhaustive technical matrix of all remaining sprites and source assets required for Worldwalker. Every entity is itemized across three mandatory dimensions:
1. **Primary / Base Source Asset**: Pixel dimensions, visual footprint, core state, palette anchoring.
2. **Secondary Asset**: Companion state, alternate directional posture, active/emissive counterpart, emotion/reaction variant, or interaction overlay.
3. **Motion Interpolation Model**: Mathematical equations, stride/frame frequencies, harmonic oscillation parameters, easing functions, and diurnal/reactive cycles.

---

## Architecture Overview & Rendering Invariants

```
+-------------------------------------------------------------------------------+
|                             Worldwalker Engine                                 |
+-------------------------------------------------------------------------------+
| [Sprite Sheet / Slice Asset]                                                  |
|       |                                                                       |
|       +--> Primary Base Asset       --> Initial spatial pose & bounding box   |
|       +--> Secondary Companion Asset--> Emissive layer / Emote / Interaction   |
|       +--> Motion Interpolation     --> Harmonic bob, Lissajous roam, stride   |
|                                         decay, cubic bezier, or smoothstep    |
+-------------------------------------------------------------------------------+
```

* **Grid Invariant**: Base tile unit is $16 \times 16$ pixels (`WORLD.tile = 16`).
* **Non-Gamified Exploration Invariant**: Pure observation and cartography; no XP, level badges, or combat stats.
* **Asset Loading Pipeline**: Handled via `public/assets.js` (`/api/runtime-asset?name=...`) with offscreen image pre-decoding and runtime cache.
* **Interpolation Timing Invariant**: All mathematical models bind strictly to continuous time `game.now` (milliseconds) or elapsed delta time `dt` to ensure display-rate independence.

---

## 1. Player Traveler Entity (`player`)

The player avatar is an observational scholar and cartographer equipped with walking pack, field journal, and walking staff.

### Asset Matrix

| Entity Subsystem | Primary Base Asset | Secondary Companion Asset | Dimensions | Visual Description |
| :--- | :--- | :--- | :--- | :--- |
| **Walk South** | `player_down_0.png` | `player_idle_down.png`<br>`player_down_1.png`<br>`player_down_2.png` | $32 \times 42$ px | Cloaked traveler facing south with walking staff in right hand; secondary walk cycles toggle stride feet; idle shows relaxed weight-shift. |
| **Walk North** | `player_up_0.png` | `player_idle_up.png`<br>`player_up_1.png`<br>`player_up_2.png` | $32 \times 42$ px | Traveler facing north displaying expedition knapsack and bedroll; secondary walk cycles alternate pack sway and stride heels. |
| **Walk West** | `player_left_0.png` | `player_idle_left.png`<br>`player_left_1.png`<br>`player_left_2.png` | $32 \times 42$ px | Side profile walking west; secondary frames exhibit staff thrust forward and trailing scarf flutter. |
| **Walk East** | `player_right_0.png` | `player_idle_right.png`<br>`player_right_1.png`<br>`player_right_2.png` | $32 \times 42$ px | Side profile walking east; staff planted forward, companion frames exhibit foot plant and recovery stride. |
| **Diagonal Traversal** | `player_downleft_0.png`<br>`player_downright_0.png` | `player_upleft_0.png`<br>`player_upright_0.png` | $32 \times 42$ px | $45^\circ$ isometric angles for smooth diagonal traversal; eliminates cardinal snaps. |
| **Sprint / Dash** | `player_sprint_cardinal.png` | `player_dash_trail.png` | $36 \times 42$ px | Low center-of-gravity running posture with windward scarf; secondary asset is an alpha ghost motion streak ($40\%$ opacity). |
| **Traversal Verbs** | `player_climb_0.png` | `player_climb_1.png`<br>`player_squeeze_0.png` | $32 \times 42$ px | Hand-over-hand ladder/cliff climbing frames; sideways narrow squeeze frame through cable gaps. |
| **River Leap / Hop** | `player_jump_apex.png` | `player_jump_fall.png` | $32 \times 42$ px | Airborne tucked knee silhouette for apex; landing compression silhouette for touchdown. |

### Motion Interpolation Specifications

1. **Velocity Vector Spatial Lerp (Sub-Tile Smoothing)**:
   $$\vec{x}(t + \Delta t) = \vec{x}(t) + \vec{v}(t) \Delta t$$
   $$\vec{v}(t + \Delta t) = \vec{v}(t) + (\vec{v}_{\text{target}} - \vec{v}(t)) \cdot \left(1 - e^{-k_{\text{accel}} \Delta t}\right)$$
   *Acceleration Constant*: $k_{\text{accel}} = 14.0\text{ s}^{-1}$.
   *Deceleration Constant*: $k_{\text{friction}} = 18.0\text{ s}^{-1}$.

2. **Stride Frame Slicing**:
   $$f_{\text{stride}}(t) = \left\lfloor (t \cdot \nu) \right\rfloor \pmod 3$$
   *Walk Stride Frequency*: $\nu_{\text{walk}} = 0.008\text{ ms}^{-1} = 8\text{ Hz}$ ($125\text{ ms}$ per step).
   *Sprint Stride Frequency*: $\nu_{\text{sprint}} = 0.013\text{ ms}^{-1} = 13\text{ Hz}$ ($76.9\text{ ms}$ per step).

3. **Parabolic Traversal Hop Oscillation**:
   $$y_{\text{hop}}(t) = -H_{\max} \cdot \sin\left(\left(1 - \frac{t_{\text{hop}}}{\tau_{\text{hop}}}\right)\pi\right)$$
   *Hop Period*: $\tau_{\text{hop}} = 0.38\text{ s}$.
   *Apex Elevation*: $H_{\max} = 10\text{ px}$.
   *Ground Shadow Scale Interpolation*:
   $$w_{\text{shadow}}(t) = 8 \cdot \left(1 - 0.35 \cdot \frac{|y_{\text{hop}}(t)|}{H_{\max}}\right)\text{ px}$$

4. **Idle Stance Breathing Harmonic**:
   $$y_{\text{idle}}(t) = A_{\text{breathe}} \cdot \sin\left(\frac{2\pi t}{T_{\text{breathe}}}\right)$$
   *Breathing Amplitude*: $A_{\text{breathe}} = 0.75\text{ px}$.
   *Breathing Period*: $T_{\text{breathe}} = 2400\text{ ms}$ ($0.417\text{ Hz}$).

---

## 2. Settlement Residents & World Guides (`npcs`)

Each regional settlement hosts a resident guide and roaming wanderers.

### Asset Matrix

| Entity Name | Primary Base Asset | Secondary Companion Asset | Dimensions | Character Archetype & Visual Details |
| :--- | :--- | :--- | :--- | :--- |
| **The Archivist** (Starsilk) | `npc_archivist.png` | `npc_archivist_inspect.png`<br>`npc_archivist_night.png`<br>`npc_archivist_back.png` | $20 \times 29$ px | Robed in deep indigo and silver; secondary asset shows unrolling a digital parchment scroll; night asset shows resting at archive desk; back asset faces canon vaults. |
| **The Engineer** (Screen Weasels) | `npc_engineer.png` | `npc_engineer_solder.png`<br>`npc_engineer_night.png`<br>`npc_engineer_back.png` | $20 \times 29$ px | Work apron, brass goggles, wire spool; secondary asset depicts holding soldering stylus with blue spark; night asset seated on workbench stool; back asset inspecting relay rack. |
| **The Cartographer** (Atlas of One) | `npc_cartographer.png` | `npc_cartographer_measure.png`<br>`npc_cartographer_night.png`<br>`npc_cartographer_back.png` | $20 \times 29$ px | Sage green tunic, brass sextant at hip; secondary asset shows sighting through brass calipers onto open map; night asset sleeping under observatory rug; back asset observing meridian lens. |
| **The Merchant** (Dash Ledger) | `npc_merchant.png` | `npc_merchant_weigh.png`<br>`npc_merchant_night.png`<br>`npc_merchant_back.png` | $20 \times 29$ px | Ochre felt cloak, leather ledger bandolier; secondary asset holds twin balance scales; night asset sitting with closed iron lockbox; back asset facing tally wall. |
| **The Station Keeper** (Orbital Tomb) | `npc_station_keeper.png` | `npc_station_keeper_tune.png`<br>`npc_station_keeper_night.png`<br>`npc_station_keeper_back.png` | $20 \times 29$ px | Slate flight suit with radio headset; secondary asset adjusting telemetry dial; night asset wrapped in thermal emergency quilt; back asset observing star gantry. |
| **The Wanderer** (Cross-Settlement) | `npc_wanderer.png` | `npc_wanderer_rest.png`<br>`npc_wanderer_walk.png`<br>`npc_wanderer_camp.png` | $20 \times 29$ px | Weathered brown poncho, brimmed hood, staff; secondary asset resting against waystone; walk asset mid-stride with staff forward; camp asset seated around embers. |
| **The Harbor Keeper** (Quayside) | `npc_harbor_keeper.png` | `npc_harbor_keeper_rope.png`<br>`npc_harbor_keeper_night.png`<br>`npc_harbor_keeper_back.png` | $20 \times 29$ px | Heavy oilskin fisherman smock, nautical cap; secondary asset coiling hemp mooring hawser; night asset smoking pipe on pier bollard; back asset scanning river waves. |
| **The Chronicler** (History Relays) | `npc_chronicler.png` | `npc_chronicler_write.png`<br>`npc_chronicler_night.png`<br>`npc_chronicler_back.png` | $20 \times 29$ px | Ashen grey coat with ink-stained cuffs; secondary asset writing in leather codex; night asset reading by amber oil lamp; back asset facing commit plinth. |

### Motion Interpolation Specifications

1. **Diurnal Schedule Lissajous Roam Equation**:
   $$x_{\text{npc}}(t) = x_{\text{base}} + \Delta x_{\text{band}} + r_{\text{roam}} \cdot \sin\left(\omega_{\text{roam}} t + i \cdot 2.7 + x_p \cdot 0.03\right)$$
   $$y_{\text{npc}}(t) = y_{\text{base}} + \Delta y_{\text{band}} + 0.48 \cdot r_{\text{roam}} \cdot \cos\left(0.73 \cdot (\omega_{\text{roam}} t + i \cdot 2.7 + x_p \cdot 0.03)\right)$$
   *Angular Velocity*: $\omega_{\text{roam}} = 0.00055\text{ rad/ms} = 0.55\text{ rad/s}$.
   *Roam Radius by Diurnal Band*:
   * `night`: $r_{\text{roam}} = 0.18\text{ tiles}$ (near-stationary slumber)
   * `evening`: $r_{\text{roam}} = 0.42\text{ tiles}$ (settling near campfires/hearths)
   * `morning`: $r_{\text{roam}} = 0.72\text{ tiles}$ (emerging to duties)
   * `day`: $r_{\text{roam}} = 1.05\text{ tiles}$ (active patrol/inspection)

2. **Vertical Levitation / Idle Weight Bob**:
   $$y_{\text{bob}}(t) = A_{\text{bob}} \cdot \sin(\omega_{\text{bob}} t + i)$$
   *Amplitude*: $A_{\text{bob}} = 1.1\text{ px}$.
   *Frequency*: $\omega_{\text{bob}} = 0.004\text{ rad/ms} \approx 0.637\text{ Hz}$.

3. **Player Proximity Look-At Slerp**:
   When player distance $d \le 3.0\text{ tiles}$, the NPC turns towards the player using quantized direction angles:
   $$\theta_{\text{target}} = \text{atan2}(y_{\text{player}} - y_{\text{npc}}, x_{\text{player}} - x_{\text{npc}})$$
   *Quantization*: 4 cardinal directions ($0, 1, 2, 3$) with $180\text{ ms}$ hysteresis threshold to prevent jitter.

---

## 3. Dialogue Portraits (`heroPortraits` & `npcPortraits`)

High-fidelity pixel portraits displayed inside the CRT dialogue box modal (`#dialoguePortrait`).

### Asset Matrix

| Subject | Primary Base Asset | Secondary Companion Asset | Dimensions | Emotive State & Visual Nuance |
| :--- | :--- | :--- | :--- | :--- |
| **Hero (Neutral)** | `portrait_hero_neutral.png` | `portrait_hero_neutral_talk.png`<br>`portrait_hero_blink.png` | $80 \times 80$ px | Calm, open expression; secondary talk frame has $4\text{px}$ mouth aperture; blink frame has closed lids with light lashes. |
| **Hero (Smile)** | `portrait_hero_smile.png` | `portrait_hero_smile_talk.png`<br>`portrait_hero_smile_blink.png` | $80 \times 80$ px | Warm, confident squint; secondary talk frame has joyful mouth lift. |
| **Hero (Worried)** | `portrait_hero_worried.png` | `portrait_hero_worried_talk.png`<br>`portrait_hero_worried_blink.png` | $80 \times 80$ px | Furrowed brow, tense lips; secondary talk frame exhibits tentative vocal shape. |
| **Hero (Thinking)** | `portrait_hero_thinking.png` | `portrait_hero_thinking_talk.png`<br>`portrait_hero_alert.png` | $80 \times 80$ px | Eyes cast upward, hand at chin; alert variant wide-eyed with realization. |
| **Archivist** | `portrait_archivist.png` | `portrait_archivist_talk.png`<br>`portrait_archivist_stern.png`<br>`portrait_archivist_blink.png` | $80 \times 80$ px | Scholarly monocle, ascetic posture; stern variant raises eyebrow at canon drift; talk frame syncs with script typewriter. |
| **Engineer** | `portrait_engineer.png` | `portrait_engineer_talk.png`<br>`portrait_engineer_smirk.png`<br>`portrait_engineer_blink.png` | $80 \times 80$ px | Soot-smudged cheek, copper goggles raised; smirk variant flashes toothy technician grin. |
| **Cartographer** | `portrait_cartographer.png` | `portrait_cartographer_talk.png`<br>`portrait_cartographer_curious.png`<br>`portrait_cartographer_blink.png` | $80 \times 80$ px | Keen observant eyes, wind-swept hair; curious variant tilts head examining route evidence. |
| **Merchant** | `portrait_merchant.png` | `portrait_merchant_talk.png`<br>`portrait_merchant_calculating.png`<br>`portrait_merchant_blink.png` | $80 \times 80$ px | Sharply groomed goatee, coin-scale insignia; calculating variant narrows eyes counting tallies. |
| **Station Keeper** | `portrait_station_keeper.png` | `portrait_station_keeper_talk.png`<br>`portrait_station_keeper_weary.png`<br>`portrait_station_keeper_blink.png` | $80 \times 80$ px | Radio headset, distant gaze; weary variant exhibits heavy eye-shadow and worn collar. |
| **Wanderer** | `portrait_wanderer.png` | `portrait_wanderer_talk.png`<br>`portrait_wanderer_kind.png`<br>`portrait_wanderer_blink.png` | $80 \times 80$ px | Weathered hood, kind crow's feet; kind variant softens expression during lore sharing. |
| **Harbor Keeper** | `portrait_harbor_keeper.png` | `portrait_harbor_keeper_talk.png`<br>`portrait_harbor_keeper_laugh.png`<br>`portrait_harbor_keeper_blink.png` | $80 \times 80$ px | Salt-and-pepper beard, heavy knitted collar; laugh variant booms with sea humor. |
| **Chronicler** | `portrait_chronicler.png` | `portrait_chronicler_talk.png`<br>`portrait_chronicler_scribe.png`<br>`portrait_chronicler_blink.png` | $80 \times 80$ px | High collar, quill tucked over ear; scribe variant peers over horn-rimmed half-lenses. |

### Motion Interpolation Specifications

1. **Dialogue Phoneme Mouth-Flap Cycle**:
   $$M(t) = \begin{cases} 
   \text{talk\_asset}, & \text{if typing active and } \lfloor (t / 85\text{ms}) \rfloor \bmod 2 = 1 \\
   \text{base\_asset}, & \text{otherwise}
   \end{cases}$$
   *Phoneme Frequency*: Synchronized to text character delay ($14\text{ ms}$ normal, $7\text{ ms}$ fast); mouth flips every $85\text{ ms}$ while typing buffer is non-empty.

2. **Stochastic Eye-Blink Poisson Process**:
   $$t_{\text{next\_blink}} = t_{\text{current}} + \Delta t_{\text{interval}}, \quad \Delta t_{\text{interval}} \sim \mathcal{U}(3.4\text{ s}, 5.6\text{ s})$$
   $$\text{Frame}(t) = \begin{cases} \text{blink\_asset}, & \text{if } 0 \le (t - t_{\text{blink\_start}}) \le 110\text{ ms} \\ \text{base\_asset}, & \text{otherwise} \end{cases}$$

3. **Dialogue Box Entrance Spring Easing**:
   $$y_{\text{portrait}}(t) = Y_{\text{rest}} + Y_{\text{offset}} \cdot (1 - \text{EaseOutBack}(\tau)), \quad \tau = \frac{t}{280\text{ ms}}$$
   $$\text{EaseOutBack}(\tau) = 1 + c_3 (\tau - 1)^3 + c_1 (\tau - 1)^2 \quad (c_1 = 1.70158, c_3 = c_1 + 1 = 2.70158)$$

---

## 4. Regional Signature Landmarks (`landmarks`)

Monumental structures defining the five project biomes.

### Asset Matrix

| Landmark ID & Name | Primary Base Asset | Secondary Companion Asset | Dimensions | Architectural & Thematic Detailing |
| :--- | :--- | :--- | :--- | :--- |
| **Starsilk**: Filament Spire | `landmark_starsilk.png` | `landmark_starsilk_night.png`<br>`landmark_starsilk_weave.png` | $116 \times 116$ px | Monolithic obsidian spire with cyan luminescent vertical conduits; secondary night asset adds cyan corona; weave asset overlays pulsing data filaments. |
| **Screen Weasels**: Twin-Face Relay | `landmark_screen_weasels.png` | `landmark_weasels_night.png`<br>`landmark_weasels_crt.png` | $116 \times 116$ px | Dual-scaffolded industrial antenna with amber/cyan CRT terminal faces; secondary CRT asset has scanline glyph updates. |
| **Atlas**: Cartographer Observatory | `landmark_atlas.png` | `landmark_atlas_night.png`<br>`landmark_atlas_armillary.png` | $116 \times 116$ px | Domed sandstone observatory with emerald copper roof and meridian arch; secondary armillary asset features brass ring celestial globe. |
| **Dash**: The Counting Hall | `landmark_dash.png` | `landmark_dash_night.png`<br>`landmark_dash_scales.png` | $140 \times 112$ px | Heavy timber ledger vault with carved lintel and stone vaults; secondary scales asset features swinging counterweight brass balances. |
| **Orbital**: The Meridian Gantry | `landmark_orbital.png` | `landmark_orbital_night.png`<br>`landmark_orbital_dish.png` | $116 \times 128$ px | Industrial space-station gantry skeleton with landing struts; secondary dish asset features 4-spoke revolving telemetry radar. |

### Motion Interpolation Specifications

1. **Rotational Telemetry & Armillary Interpolation**:
   $$\theta_{\text{rotation}}(t) = \left(\theta_0 + \omega_{\text{rot}} \cdot t\right) \pmod{2\pi}$$
   *Meridian Gantry Radar*: $\omega_{\text{rot}} = 0.0003\text{ rad/ms} \approx 17.19^\circ/\text{s}$.
   *Atlas Armillary Rings*: $\omega_{\text{inner}} = 0.00045\text{ rad/ms}$, $\omega_{\text{outer}} = -0.0002\text{ rad/ms}$ (counter-rotation).

2. **Filament Waveform Math (Starsilk Spire)**:
   For strand index $i \in [0, 13]$:
   $$x_i(t) = -48 + i \cdot 7$$
   $$y_{\text{mid}, i}(t) = -58 + \sin\left(0.001 t + i\right) \cdot 36\text{ px}$$
   Curve rendered via quadratic bezier $B(t): (-48+7i, -8) \to (x_{\text{mid},i}, y_{\text{mid},i}) \to (-16+2i, -101)$.

3. **CRT Screen Glitch & Flicker Interpolation (Screen Weasels)**:
   $$I_{\text{crt}}(t) = 0.88 + 0.12 \cdot \sin(0.003 t) \cdot \cos(0.007 t + 1.4)$$
   $$y_{\text{glitch}}(t) = -68 + \sin(0.003 t) \cdot 2.0\text{ px}$$

4. **Nocturnal Emissive Glow Modulation**:
   $$R_{\text{glow}}(t) = R_{\text{base}} + A_{\text{flicker}} \cdot \sin\left(0.005 t + p_x\right)$$
   *Base Radius*: $R_{\text{base}} = 24\text{ px}$.
   *Flicker Amplitude*: $A_{\text{flicker}} = 2.0\text{ px}$.
   *Radial Gradient Alpha*: $\alpha_{\text{center}} = 0.47$, $\alpha_{\text{edge}} = 0.0$.

---

## 5. Settlement Structures (`settlements`)

The 22 structural architecture assets deployed across the regional hubs.

### Asset Matrix

| Structure ID | Primary Base Asset | Secondary Companion Asset | Dimensions | Function & Visual Details |
| :--- | :--- | :--- | :--- | :--- |
| `arch` | `settlement_arch.png` | `settlement_arch_lit.png` | $58 \times 40$ px | Carved milestone entry arch; secondary adds suspended keystone lantern glow. |
| `beacon` | `settlement_beacon.png` | `settlement_beacon_flare.png` | $44 \times 62$ px | Pyramidal signal beacon; secondary adds rotating directional light beam. |
| `cottage` | `settlement_cottage.png` | `settlement_cottage_lit.png`<br>`settlement_cottage_smoke.png` | $54 \times 50$ px | Timber highland home; secondary adds lit hearth windows and smoke puff. |
| `crystal` | `settlement_crystal.png` | `settlement_crystal_glow.png` | $50 \times 52$ px | Resonant ground crystal cluster; secondary adds pulsing ambient halo. |
| `desert_ruin` | `settlement_desert_ruin.png` | `settlement_desert_ruin_dust.png`| $60 \times 54$ px | Weathered sandstone colonnade; secondary adds drifting dust whisps. |
| `docks` | `settlement_docks.png` | `settlement_docks_water.png` | $72 \times 44$ px | Heavy timber dock decking; secondary adds lapping wave foam trim. |
| `floating_ruin`| `settlement_floating_ruin.png` | `settlement_floating_ruin_particles.png` | $66 \times 64$ px | Anti-gravity shattered monolithic slab; secondary adds drifting gravity motes. |
| `garden_ruin` | `settlement_garden_ruin.png` | `settlement_garden_ruin_bloom.png`| $58 \times 48$ px | Overgrown marble terrace; secondary adds bioluminescent flora petals. |
| `gate` | `settlement_gate.png` | `settlement_gate_open.png` | $58 \times 54$ px | Iron reinforced portcullis; secondary adds open threshold clearance. |
| `harbor` | `settlement_harbor.png` | `settlement_harbor_lit.png` | $72 \times 58$ px | Multi-level customs house; secondary adds quayside lanterns and wharf glow. |
| `inn` | `settlement_inn.png` | `settlement_inn_lit.png` | $60 \times 50$ px | Two-story travel resthouse; secondary adds stained-glass illuminated windows. |
| `lighthouse` | `settlement_lighthouse.png` | `settlement_lighthouse_beam.png` | $38 \times 52$ px | River lookout stone tower; secondary adds sweeping Fresnel searchlight cone. |
| `observatory` | `settlement_observatory.png` | `settlement_observatory_dome.png`| $58 \times 62$ px | Highland telescope dome; secondary adds rotated aperture showing brass scope. |
| `pier` | `settlement_pier.png` | `settlement_pier_tide.png` | $64 \times 42$ px | Extended mooring slip; secondary adds tidal waterline wash. |
| `shrine` | `settlement_shrine.png` | `settlement_shrine_fire.png` | $44 \times 54$ px | Sacred boundary alcove; secondary adds flickering blue ritual braziers. |
| `snow_lodge` | `settlement_snow_lodge.png` | `settlement_snow_lodge_lit.png` | $54 \times 52$ px | Steep pitched cedar shake cabin; secondary adds frosty window illumination. |
| `statue` | `settlement_statue.png` | `settlement_statue_moss.png` | $42 \times 52$ px | Carved memorial explorer monolith; secondary adds season-reactive moss overlay. |
| `swamp` | `settlement_swamp.png` | `settlement_swamp_gas.png` | $56 \times 48$ px | Stilt-raised marsh shelter; secondary adds bubbling will-o'-the-wisp bubbles. |
| `tent` | `settlement_tent.png` | `settlement_tent_lit.png` | $56 \times 48$ px | Merchant canvas pavilion; secondary adds internal lantern silhouette. |
| `tower` | `settlement_tower.png` | `settlement_tower_lit.png` | $48 \times 64$ px | Fortified stone bastion; secondary adds crenellation torch lights. |
| `watchtower` | `settlement_watchtower.png` | `settlement_watchtower_beacon.png`| $50 \times 54$ px | Open-frame timber lookout; secondary adds signal mirror glare. |
| `windmill` | `settlement_windmill.png` | `settlement_windmill_blades.png` | $52 \times 60$ px | Canvas-sailed flour/signal mill; secondary asset is 4-blade rotor cross. |
| `workshop` | `settlement_workshop.png` | `settlement_workshop_sparks.png` | $60 \times 54$ px | Foundry chimney and gear shed; secondary adds furnace flue sparks. |

### Motion Interpolation Specifications

1. **Windmill Rotor Motion Equation**:
   $$\theta_{\text{mill}}(t) = (\omega_{\text{mill}} \cdot t) \pmod{2\pi}$$
   *Rotor Speed*: $\omega_{\text{mill}} = 0.0012\text{ rad/ms} \approx 68.75^\circ/\text{s}$.
   Blades rendered with center origin $(sx, sy - 28)$ transformed via rotation matrix.

2. **Lighthouse / Beacon Sweeping Light Cone**:
   $$\phi_{\text{beam}}(t) = (\omega_{\text{beam}} \cdot t) \pmod{2\pi}, \quad \omega_{\text{beam}} = 0.0008\text{ rad/ms}$$
   $$\vec{P}_{\text{beam}}(t) = \begin{bmatrix} x_0 + L \cos(\phi_{\text{beam}}) \\ y_0 + 0.35 L \sin(\phi_{\text{beam}}) \end{bmatrix}, \quad L = 72\text{ px}$$
   Alpha attenuation: $\alpha_{\text{beam}}(\phi) = 0.6 \cdot |\sin(\phi_{\text{beam}})|$ (dimmer when pointing away).

3. **Chimney Smoke Puff Particle Physics**:
   For particle $k \in [0, 2]$ launched at period $T = 1600\text{ ms}$:
   $$t_k = (t + k \cdot 533) \bmod T, \quad \tau = \frac{t_k}{T}$$
   $$y_k(\tau) = y_{\text{stack}} - v_{\text{rise}} \cdot \tau - 8 \cdot \tau^2$$
   $$x_k(\tau) = x_{\text{stack}} + w_{\text{wind}} \cdot \tau + A_{\text{curl}} \cdot \sin(2\pi \tau \cdot 1.5)$$
   $$\text{Scale}_k(\tau) = 0.8 + 1.2 \cdot \tau, \quad \text{Alpha}_k(\tau) = 0.7 \cdot (1 - \tau)$$
   *Rise Velocity*: $v_{\text{rise}} = 22\text{ px/s}$.
   *Wind Drift*: $w_{\text{wind}} = 14\text{ px/s}$.

4. **Floating Ruin Harmonic Levitation**:
   $$y_{\text{float}}(t) = y_0 + A_{\text{float}} \cdot \sin\left(\omega_{\text{float}} t + \phi_0\right)$$
   *Amplitude*: $A_{\text{float}} = 3.5\text{ px}$.
   *Frequency*: $\omega_{\text{float}} = 0.0015\text{ rad/ms} \approx 0.239\text{ Hz}$.

---

## 6. Interior Architecture & Furnishings (`interiors`)

Rendered inside project interior chambers (`drawInteriorScene`).

### Asset Matrix

| Interior Asset Key | Primary Base Asset | Secondary Companion Asset | Dimensions | Room Placement & Interactive Role |
| :--- | :--- | :--- | :--- | :--- |
| `floor_stone` | `interior_floor_stone.png` | `interior_floor_stone_worn.png` | $49 \times 49$ px | Flagstone flooring in Starsilk, Atlas, and Orbital. |
| `floor_gold` | `interior_floor_gold.png` | `interior_floor_gold_tile.png` | $49 \times 49$ px | Gilded polished parquet in Dash Counting House. |
| `floor_wood` | `interior_floor_wood.png` | `interior_floor_wood_creak.png` | $49 \times 49$ px | Oiled fir floorboards in Screen Weasels Signal Burrow. |
| `rug_green` | `interior_rug_green.png` | `interior_rug_green_worn.png` | $160 \times 104$ px | Forest woven wool carpet in Screen Weasels & Dash. |
| `rug_blue` | `interior_rug_blue.png` | `interior_rug_blue_worn.png` | $160 \times 104$ px | Azure embroidered indigo carpet in Starsilk & Orbital. |
| `wall_panel` | `interior_wall_panel.png`| `interior_wall_panel_shadow.png`| $(tw-16) \times 58$ px | Wainscot wall boundary along north interior edge. |
| `bookshelf` | `interior_bookshelf.png` | `interior_bookshelf_lit.png` | $150 \times 78$ px | Tall mahogany bookshelf with leather volumes and brass bookends. |
| `bookcase` | `interior_bookcase.png` | `interior_bookcase_lit.png` | $150 \times 78$ px | Dual-tiered library stacks with archival folios. |
| `table` | `interior_table.png` | `interior_table_active.png` | $190 \times 92$ px | Heavy central library table; secondary adds unrolled maps and inkpot. |
| `desk` | `interior_desk.png` | `interior_desk_active.png` | $160 \times 95$ px | Scholar roll-top desk; secondary adds lit desk lamp and open ledger. |
| `fireplace` | `interior_fireplace.png` | `interior_fireplace_fire_{0,1,2}.png` | $112 \times 118$ px | Stone masonry hearth; secondary is 3-frame crackling timber fire. |
| `globe` | `interior_globe.png` | `interior_globe_rotated.png` | $82 \times 96$ px | Antique brass floor stand celestial terrestrial globe. |
| `telescope` | `interior_telescope.png`| `interior_telescope_angled.png`| $104 \times 96$ px | Heavy brass refractor telescope on cast-iron tripod. |
| `door` | `interior_door.png` | `interior_door_open.png` | $66 \times 82$ px | Heavy oak arched exit doorway with threshold light beam. |
| `crystal_blue` | `interior_crystal_blue.png` | `interior_crystal_blue_pulse.png`| $54 \times 76$ px | Resonant azure geode node in Starsilk and Orbital. |
| `crystal_purple`| `interior_crystal_purple.png`| `interior_crystal_purple_pulse.png`| $58 \times 82$ px | Deep violet telemetry crystal pillar in Orbital station. |
| `market_stall` | `interior_market_stall.png`| `interior_market_stall_active.png`| $150 \times 118$ px | Timber awning stall with sample trays in Dash market. |
| `lantern` | `interior_lantern.png` | `interior_lantern_glow.png` | $52 \times 78$ px | Hanging brass ship gimbal lantern with amber glass mantle. |

### Motion Interpolation Specifications

1. **Fireplace Flame Animation & Flicker Math**:
   $$f_{\text{fire}}(t) = \left\lfloor \frac{t}{135\text{ ms}} \right\rfloor \bmod 3$$
   $$R_{\text{hearth}}(t) = 42 + 3.8 \cdot \sin(0.011 t) \cdot \cos(0.006 t + 2.1)\text{ px}$$
   $$\alpha_{\text{hearth}}(t) = 0.52 + 0.12 \cdot \sin(0.015 t)$$

2. **Resonant Crystal Internal Luminescence Pulse**:
   $$\alpha_{\text{crystal}}(t) = 0.40 + 0.45 \cdot \left(\frac{1 + \sin(0.0022 t + \phi_{\text{id}})}{2}\right)^2$$
   *Phase Shifts*: $\phi_{\text{blue}} = 0.0$, $\phi_{\text{purple}} = 1.85\text{ rad}$.

3. **Interactive Celestial Globe Spin Interpolation**:
   Triggered on inspection (`TURN · CARTOGRAPHER GLOBE`):
   $$\theta_{\text{globe}}(\tau) = \theta_0 + \Delta \theta \cdot \left(1 - (1 - \tau)^3\right), \quad \tau = \frac{t - t_{\text{interact}}}{1800\text{ ms}}$$
   *Total Angular Displacement*: $\Delta \theta = 3\pi\text{ rad}$ ($540^\circ$).

4. **Hanging Gimbal Lantern Harmonic Pendulum**:
   $$\theta_{\text{lantern}}(t) = \theta_{\max} \cdot e^{-\gamma (t - t_0)} \cdot \cos\left(\omega_n (t - t_0)\right)$$
   *Natural Frequency*: $\omega_n = 3.8\text{ rad/s}$.
   *Damping Factor*: $\gamma = 0.55\text{ s}^{-1}$.

---

## 7. Overworld Traversal, River & World Interactive Sprites

Sprites providing physical presence, river crossing, guidance, and discovery verification.

### Asset Matrix

| Entity | Primary Base Asset | Secondary Companion Asset | Dimensions | Function & Physical Placement |
| :--- | :--- | :--- | :--- | :--- |
| **River Ferry Raft** | `raft_wood.png` | `raft_cruise_wake.png` | $24 \times 14$ px | Timber log ferry raft at $x:36.2, y:43.0$; secondary adds stern prop water wake. |
| **River Stepping Stones** | `stepping_stone.png` | `stepping_stone_splash.png` | $16 \times 16$ px | Natural granite stepping boulders across river; secondary adds swirling foam ring. |
| **Overworld Signposts** | `signpost_wood.png` | `signpost_sway.png` | $18 \times 18$ px | Carved signposts at 5 major trail junctions; secondary adds wind-swaying directional board. |
| **Noticeboards** | `settlement_bulletin.png`| `settlement_bulletin_pinned.png`| $24 \times 24$ px | Kiosk noticeboards displaying settlement register and local contracts. |
| **Waystone Monoliths** | `fx_waystone.png` | `fx_waystone_attuned.png` | $28 \times 32$ px | Ancient teleport pylon; secondary is glowing golden etched obelisk. |
| **Artifact Nodes** | `icon_evidence.png` | `icon_verified.png`<br>`icon_evidence_ring.png` | $21 \times 21$ px | Floating discovery marker; secondary is green verified badge; ring is pulsing beacon. |
| **Field Manual Pages** | `icon_book.png` | `icon_book_flutter.png` | $22 \times 22$ px | Lost parchment page; secondary adds gilded page corner flapping. |
| **World Echo Nodes** | `fx_sparkle.png` | `fx_echo_wave.png` | $22 \times 22$ px | Spatial memory point; secondary is concentric cyan acoustic ring. |
| **Cliff Stairs Traversal** | `traversal_climb.png` | `traversal_climb_prompt.png` | $24 \times 16$ px | Carved stone steps at Atlas ascent and Orbital catwalk. |
| **Cable Gap Squeeze** | `traversal_squeeze.png`| `traversal_squeeze_prompt.png`| $16 \times 16$ px | Narrow industrial slot at Screen Weasels scrapyard. |

### Motion Interpolation Specifications

1. **River Ferry Transit Trajectory**:
   Transits between $x_{\text{west}} = 36.2$ and $x_{\text{east}} = 40.2$ ($y = 43.0$):
   $$x_{\text{ferry}}(\tau) = x_{\text{start}} + (x_{\text{dest}} - x_{\text{start}}) \cdot \left(3\tau^2 - 2\tau^3\right), \quad \tau = \frac{t - t_{\text{launch}}}{\tau_{\text{transit}}}$$
   *Transit Duration*: $\tau_{\text{transit}} = 4200\text{ ms}$.
   *Buoyancy Water Bob*:
   $$y_{\text{raft\_bob}}(t) = 1.35 \cdot \sin\left(0.0028 t\right)\text{ px}$$

2. **Stepping Stone River Foam Swirl**:
   $$\theta_{\text{swirl}}(t) = \left(0.0035 t + y_{\text{stone}}\right) \pmod{2\pi}$$
   $$r_{\text{swirl}}(t) = 6.5 + 1.8 \cdot \sin\left(0.002 t + x_{\text{stone}}\right)\text{ px}$$

3. **Signpost Wind Sway Easing**:
   $$\theta_{\text{sign}}(t) = \theta_{\text{gust}} \cdot \sin(0.0018 t) \cdot \cos(0.0009 t + 0.5)$$
   *Max Gust Deflection*: $\theta_{\text{gust}} = 2.8^\circ$ ($0.0488\text{ rad}$).

4. **Waystone Attunement Pulse Wave**:
   $$\tau_{\text{pulse}} = (0.003 t) \bmod 1$$
   $$R_{\text{ring}}(\tau) = 14 + 24 \cdot \tau_{\text{pulse}}\text{ px}$$
   $$\alpha_{\text{ring}}(\tau) = 0.70 \cdot (1 - \tau_{\text{pulse}})$$

5. **World Echo Reverberation Wave**:
   $$R_{\text{echo}}(t) = 7 + 2 \cdot \sin(0.002 t + x_e)\text{ px}$$
   $$\alpha_{\text{echo}}(t) = \begin{cases} 0.35, & \text{if discovered} \\ 0.65 + 0.30 \cdot \sin(0.003 t), & \text{if undiscovered} \end{cases}$$

---

## 8. Environmental FX & Ambient Shrouds (`fx`)

### Asset Matrix

| FX Asset Key | Primary Base Asset | Secondary Companion Asset | Dimensions | Environmental State Role |
| :--- | :--- | :--- | :--- | :--- |
| `fx_torch` | `fx_torch.png` | `fx_torch_flame_{0,1,2}.png` | $16 \times 24$ px | Settlement trail perimeter torches. |
| `fx_crystal_glow` | `fx_crystal_glow.png` | `fx_crystal_glow_burst.png` | $32 \times 32$ px | Radial light mask for mysterious structures. |
| `fx_sparkle` | `fx_sparkle.png` | `fx_sparkle_orbit.png` | $18 \times 18$ px | Sealed vault threshold particles. |
| `fx_dust` | `fx_dust.png` | `fx_dust_cloud.png` | $116 \times 52$ px | Blocked condition debris haze. |
| `fx_water_ripple` | `fx_water_ripple.png` | `fx_water_splash.png` | $20 \times 12$ px | River wading and stepping stone contact ripple. |

### Motion Interpolation Specifications

1. **Torch Flame Jitter & Ember Emission**:
   $$x_{\text{flame}}(t) = x_0 + 0.8 \cdot \cos(0.009 t)$$
   $$y_{\text{flame}}(t) = y_0 + 1.2 \cdot \sin(0.015 t)$$
   *Ember Particle Float*:
   $$y_{\text{ember}}(\tau) = y_0 - 18 \cdot \tau, \quad x_{\text{ember}}(\tau) = x_0 + 4 \cdot \sin(6\pi \tau), \quad \tau \in [0, 1]$$

2. **Dust Cloud Horizontal Drift & Wrap**:
   $$x_{\text{dust}}(t) = \left(x_{\text{origin}} + t \cdot 0.018\right) \pmod{W_{\text{canvas}} + 116} - 58$$
   $$\alpha_{\text{dust}}(t) = 0.45 + 0.15 \cdot \sin(0.0012 t)$$

3. **Sealed Vault Sparkle Orbital Swarm**:
   For particle $j \in [0, 3]$:
   $$\theta_j(t) = 0.35 \cdot 0.001 t + j \cdot \frac{\pi}{2}$$
   $$x_j(t) = x_{\text{vault}} + 86 \cdot \cos(\theta_j(t))$$
   $$y_j(t) = y_{\text{vault}} + 48 \cdot \sin(\theta_j(t)) - 34$$

---

## 9. Implementation File Routing & Engine Integration Map

When generated assets are loaded into `/public/assets/runtime/`, the following engine modules integrate them:

```
public/assets.js
  |---> asset(name) / drawAsset(ctx, name, x, y, w, h, alpha)
  |---> playerAsset(dir, moving, now) ---> add diagonal & sprint routing
  |---> npcAsset / npcPortrait ---> add shift & expressive lookup tables

public/render.js
  |---> drawAvatar(ctx, game, sx, sy) ---> bind hop, sprint & climb frames
  |---> drawLandmark(ctx, p, game) ---> draw base + kinetic overlay assets
  |---> drawRiverFeatures(ctx, game) ---> bind raft wake & stepping stone ripples
  |---> drawSignposts / drawNoticeboards ---> bind sway rotation matrices

public/settlement-render.js
  |---> drawSettlement(ctx, game, p) ---> bind lit overlays & windmill rotation
  |---> residentPosition(game, p, resident, index) ---> bind diurnal shift poses

public/interior-render.js
  |---> drawInteriorScene(ctx, p, ox, oy, tw, th) ---> bind fireplace flame cycles

public/dialogue.js
  |---> showDialogue(opts) / typeLine() ---> bind mouth-flap & blink timers
```

---

## Summary of Totals

| System Category | Entities / Types | Primary Base Slices | Secondary Assets | Total Asset Slices |
| :--- | :--- | :--- | :--- | :--- |
| **Player Traveler** | 1 (8-Dir, Actions, Stride) | 4 cardinal walk | 16 (diagonals, idles, sprint, climb, hop) | 20 |
| **Settlement NPCs** | 8 (6 world + 2 special) | 8 idle | 24 (shift work, night sleep, turn back) | 32 |
| **Dialogue Portraits** | 9 (Hero + 8 NPCs) | 12 base emotion | 24 (mouth-flap talk, blinks, reactions) | 36 |
| **Signature Landmarks**| 5 Regional Monuments | 5 structure base | 10 (night lit masks, kinetic overlays) | 15 |
| **Settlements** | 22 Structures | 22 structure base | 26 (night lit masks, kinetic rotors/smoke)| 48 |
| **Interiors** | 18 Props & Floors | 18 prop base | 20 (fireplace frames, active states) | 38 |
| **Traversal & World** | 10 Traversal Nodes | 10 world base | 12 (wake, eddy ripples, sign sway) | 22 |
| **Environmental FX** | 5 Particle / Light Types| 5 FX base | 8 (flame frames, burst overlays) | 13 |
| **TOTALS** | **78 distinct entity roles** | **84 primary slices**| **140 secondary companion slices** | **224 slices** |
