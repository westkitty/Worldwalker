# The House That Hunts Back

A reverse-horror strategy game: you are the house. Twelve hundred square feet of it, four
floors, twenty-one rooms, one hundred and seventy-one pieces of furniture, and a set of
nervous people walking around inside it.

Play it at `/house/` (the repo's own static server serves it: `npm start`, then open
<http://localhost:5179/house/>). No build step, no dependencies, no network calls - every
module is plain ES modules and every asset is drawn or synthesised at runtime.

## What you actually do

You never control a body. You spend **manifestation energy** to haunt, and every haunt has a
price in one or more of four linked resources:

| resource | what it is | what spending it costs you |
| --- | --- | --- |
| energy | the will to act | regenerates from the fear you harvest, so a house that never scares starves |
| stability | the fabric of the building | locks, seals, collapses and possession all eat it; at zero the house is a ruin and the night is lost |
| secrecy | how little they can prove | every manifestation banks evidence; reach the scenario's case limit and the house is exposed mid-night |
| fury | haunting intensity | rises with fear inflicted; above 62 haunts are cheaper but loud, above 86 the house starts acting on its own |

The intruders are not scripted. Each is an archetype with a temperament, a fear profile, gear
and goals, and they re-plan every tick: explore, come toward a noise, regroup, help a fallen
compatriot, search a specific prop, file evidence in their van, revise a goal they can no
longer reach. They catch each other's panic and are calmed by each other's company; split a
party and the one left alone deteriorates. Nobody has a fixed route - routes are Dijkstra on
the live door graph, so locking a door genuinely reroutes them, sealing one genuinely walls
them off (and they will start looking for another way in).

You learn them by watching: which of them froze at the sealed door, who flinches at dolls, who
walks *toward* the noise. That knowledge is what makes targeted haunting work, and it is the
difference between a scare that routs someone and a scare that emboldens the skeptic.

## Structure

```
public/house/
  index.html house.css
  js/
    core/util.js          clamp/lerp, seeded rng, formatting
    data/house.js         floors, 21 rooms, 29 door links, 171 props, geometry
    data/intruders.js     10 fears, 22 traits, 23 gear items, 10 archetypes
    data/powers.js        20 haunts: cost, cooldown, stability, evidence, risk, what they reveal
    data/scenarios.js     6 escalating nights, 45 upgrades, lore, the lost child
    sim/world.js          DOM-free world: rooms, doors, props, stimuli, caches, effects
    sim/intruder.js       movement, fear, senses, perception, door crossings
    sim/ai.js             the utility planner and its actions
    sim/haunts.js         every power's world mutation
    sim/game.js           resources, objectives, scoring, save/load
    render/art.js         procedural drawing - no image files anywhere
    render/view.js        camera, picking, floor slicing, one canvas
    ui/ui.js              power bar, panels, modals, tutorial, chronicle, sheets
    audio/audio.js        WebAudio synthesis of 27 cues + ambient, all captioned
    main.js               boot, input (mouse/keys/gamepad), RAF loop, autosave
scripts/
  house-sim.mjs           headless night runner: node scripts/house-sim.mjs --night=5 --haunt
  house-contract.mjs      28 acceptance tests against the real sim
  house-runtime.mjs       40 checks that drive the real renderer/audios/UI with fakes
  house-dom.mjs           14 checks in a real DOM (needs `npm i --no-save jsdom`, else self-skips)
```

The simulation never touches the DOM and rendering never mutates simulation state, which is
why pausing and the x1/x2/x3 speeds are coherent: they only change how many fixed-dt ticks run
per frame.

## Controls

`1`-`0` select a haunt · `Enter` haunt the focused room · right-click (or shift-click) a prop,
door or person for the targeted version · `E` observe (learn instead of scare) · `T` bank fury
into a Surge · `Space` pause · `,` / `.` cycle speed · `F` next person · `G` plan view /
cutaway · `[` `]` floor · `L` chronicle · `H` help · `M` mute · `R` restart night · `Esc` menu.
Gamepad: `A` haunt, `B` pause, `LB`/`RB` floor. Every sound is captioned in the ticker,
because the house's best tricks are things you should be able to see coming.

## Verifying

```
npm run test:house          # contract + runtime + (optional) real-DOM
node scripts/house-sim.mjs --night=3 --haunt --seconds=300
```

The contract suite is the one to trust for gameplay: it asserts the map is walkable room to
room, that every power changes the world in a perceivable way, that nobody can be left standing
in place for 45 seconds with an unfinished goal, that a crowd can never cancel a stride (the
night-6 rescue once deadlocked in the linen closet that way), that every intruder-driven
objective still completes in bounded time when the house does nothing at all, that fear lands
differently per archetype, and that each of the six scenarios can be won or lost by several
deliberately different strategies.
