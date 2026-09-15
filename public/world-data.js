export const PROJECT_BLUEPRINTS = [
  {
    id: 'starsilk', name: 'Starsilk Compendium', x: 18, y: 13, biome: 'obsidian', elevation: 3,
    summary: 'A finished archive-fortress of canon, museum systems, chronology, relationships, tours, media and machine-readable lore.',
    landmark: 'The Filament Spire', interior: 'Archive Citadel', accent: '#4ea7ff', guide: 'The Archivist',
    zones: ['CANON ARCHIVE','MUSEUM GALLERY','CHRONOLOGY ORRERY','PUBLICATION ENGINE','SEALED VAULT'],
    quests: [
      { title:'Keep the Fortress Honest', detail:'No Phase 13 exists. Preserve the completed authority, provenance and publication boundaries.', status:'sealed', archetype:'reconcile' }
    ]
  },
  {
    id: 'screen-weasels', name: 'The Screen Weasels', x: 78, y: 63, biome: 'scrapyard', elevation: 1,
    summary: 'Two tiny CYD worlds linked to the Mac. Cursor Portal is physically verified on CYD #1.',
    landmark: 'The Twin-Face Relay', interior: 'Signal Burrow', accent: '#34d7eb', guide: 'The Engineer',
    zones: ['CURSOR PORTAL','SIGNAL BENCH','FACE GALLERY','HARDWARE BAY','SECOND SHELL'],
    quests: [
      { title:'The Second Face', detail:'CYD #2 has not been started and is explicitly deferred.', status:'deferred', archetype:'signal' },
      { title:'Give the Weasels Ears', detail:'Audio and several board peripherals remain physically untested.', status:'open', archetype:'hardware' }
    ]
  },
  {
    id: 'atlas', name: 'Atlas of One', x: 66, y: 17, biome: 'highlands', elevation: 4,
    summary: 'Adaptive personality cartography with deterministic progression, voice, privacy controls and a still-open human handoff.',
    landmark: 'The Cartographer Observatory', interior: 'Map Observatory', accent: '#9fe3cf', guide: 'The Cartographer',
    zones: ['MAP CHAMBER','VOICE ROTUNDA','VAULT','ASSESSMENT LENS','HANDOFF GATE'],    quests: [
      { title:'Give It to Greyson', detail:'Phase 6 closes only through actual handoff and observed friction.', status:'open', archetype:'mapping' },
      { title:'The Ending That Does Not Fire', detail:'CAMPAIGN_COMPLETED has no production dispatcher; the end condition remains a design decision.', status:'blocked', archetype:'design' }
    ]
  },
  {
    id: 'dash', name: 'Dash Ledger', x: 29, y: 68, biome: 'market', elevation: 1,
    summary: 'A compact ledger district: small footprint, hard edges and transactional clarity.',
    landmark: 'The Counting Hall', interior: 'Counting House', accent: '#efc879', guide: 'The Merchant',
    zones: ['LEDGER FLOOR','TRANSFER DESK','RECOVERY OFFICE','AUDIT WALL','UNKNOWN ROOM'],
    quests: [
      { title:'Read the Ledger', detail:'No dedicated operational-state file is currently configured for Worldwalker. Treat status as unknown until evidence is added.', status:'unknown', archetype:'audit' }
    ]
  },
  {
    id: 'orbital', name: 'Orbital Tomb', x: 48, y: 43, biome: 'orbital', elevation: 2,
    summary: 'A physically navigable station skeleton with hard-won rendering evidence and human gameplay/art review still outstanding.',
    landmark: 'The Meridian Gantry', interior: 'Meridian Station', accent: '#a8b5cc', guide: 'The Station Keeper',
    zones: ['DOCKING GANTRY','LIGHTING LAB','ROUTE TABLE','EVIDENCE LOCKER','REVIEW DECK'],
    quests: [
      { title:'The Human Eye', detail:'Machine proof is strong. Human gameplay and art review is still outstanding.', status:'open', archetype:'review' },
      { title:'Gate D1', detail:'Receiver-local lighting architecture is recommended, not implemented.', status:'deferred', archetype:'engineering' }
    ]
  }
];
export const ROADS = [
  ['starsilk','orbital'], ['orbital','atlas'], ['orbital','screen-weasels'], ['orbital','dash']
];

export const TRAVERSAL_FEATURES = [
  { id:'atlas-climb', kind:'climb', label:'CLIFF STAIRS', x:61.5, y:21.5, to:{x:64.2,y:19.3}, hint:'C · CLIMB' },
  { id:'weasel-gap', kind:'squeeze', label:'CABLE GAP', x:73.7, y:59.2, to:{x:76.1,y:61.1}, hint:'C · SQUEEZE' },
  { id:'orbital-catwalk', kind:'climb', label:'SERVICE CATWALK', x:43.7, y:46.4, to:{x:46.3,y:44.4}, hint:'C · CLIMB' }
];

export const MANUAL_PAGES = [
  { id:'waystones', title:'I · WAYSTONES', x:47, y:58, text:'Walking builds spatial memory. Waystones exist so memory never becomes drudgery. Fast travel is available after a place is known.' },
  { id:'rumors', title:'II · RUMORS', x:11, y:20, text:'A quest begins as a rumor until the place itself has been visited. Worldwalker does not convert hearsay into project truth.' },
  { id:'evidence', title:'III · EVIDENCE', x:25, y:24, text:'Artifacts, state ledgers and commits can confirm that something exists. Evidence is not the same thing as completion.' },
  { id:'verification', title:'IV · VERIFICATION', x:58, y:35, text:'Only source-backed completed or sealed state earns VERIFIED. Walking past a problem does not solve it.' },
  { id:'unknown', title:'V · UNKNOWN', x:35, y:61, text:'Unknown is a valid state. Fog is preferable to fiction.' },
  { id:'chronicle', title:'VI · THE CHRONICLE', x:53, y:51, text:'Project history is terrain. Enter the Chronicle to walk among recent commits rather than reading a dead list.' },
  { id:'relationships', title:'VII · ROADS', x:71, y:39, text:'Shared technology can establish a factual road between projects. It does not imply shared purpose, authorship or canon.' },
  { id:'artifacts', title:'VIII · FOUND OBJECTS', x:83, y:54, text:'Recent artifacts exist in the world as discoveries. Their bytes stay in their source project.' },
  { id:'read-only', title:'IX · THE WALKER\'S VOW', x:23, y:52, text:'Ordinary exploration is read-only. Worldwalker may remember what you discovered, but it never silently edits the projects it depicts.' },
  { id:'change', title:'X · WEATHER OF WORK', x:41, y:28, text:'When source state changes, the world should change with it: light, roads, scaffolds, storms, silence and repair.' }
];

export const FEATURE_CONTRACT = [  'G01_BESPOKE_TILESETS','G02_VERTICALITY','G03_STATE_DRIVEN_ART','G04_SIGNATURE_LANDMARKS','G05_MICRO_ANIMATION',
  'G06_INFORMATION_INTERIORS','G07_TIME_WEATHER','G08_EIGHT_DIRECTION_AVATAR','G09_CARTOGRAPHIC_MAP','G10_CINEMATIC_TRANSITIONS',
  'P01_MOVEMENT_VERBS','P02_DISCOVERABLE_ARTIFACTS','P03_RUMOR_EVIDENCE_VERIFIED','P04_QUEST_ARCHETYPES','P05_PERSISTENT_WORLD_TRANSFORMS',
  'P06_FIELD_MANUAL','P07_CROSS_PROJECT_EXPEDITIONS','P08_EXPLORABLE_CHRONICLE','P09_WHAT_CHANGED','P10_RELATIONSHIP_SECRETS'
];
