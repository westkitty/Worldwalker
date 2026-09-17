/* THE HOUSE THAT HUNTS BACK - the house: floors, rooms, doors, stairs, props.
   Layout data only; the simulation reads this and mutates a clone per night.

   Floors: -1 cellar, 0 ground, 1 upper, 2 attic.  Each room is a rect in a
   1200x700 plan; doors store a point on each side of their wall so travel looks
   continuous and so `alter connection` can retarget a real passage. */

const R = (id, name, kind, floor, rect, opts = {}) => ({
  id, name, kind, floor,
  x: rect[0], y: rect[1], w: rect[2], h: rect[3],
  floorMaterial: opts.floor || 'wood',
  wall: opts.wall || 'damask',
  lightDefault: opts.light === undefined ? 1 : opts.light,
  baseDread: opts.dread || 0,
  tags: opts.tags || [],
  desc: opts.desc || '',
  outside: !!opts.outside
});

/* draw: which procedural sprite to use.  flags drive the systemic layer. */
const P = (room, type, draw, x, y, w, h, flags = {}, extra = {}) => ({
  id: `${room}:${type}:${x}:${y}`, room, type, draw, x, y, w, h,
  movable: !!flags.movable, breakable: !!flags.breakable, container: !!flags.container,
  hideable: !!flags.hide, seatable: !!flags.seatable, light: !!flags.light,
  objective: flags.objective || null, value: flags.value || 0,
  state: {}, ...extra
});

export const FLOORS = [
  { id: -1, name: 'Cellar', short: 'B1', height: 0.86, ambient: 0.16 },
  { id: 0, name: 'Ground Floor', short: 'G', height: 1, ambient: 0.3 },
  { id: 1, name: 'Upper Floor', short: 'U', height: 1, ambient: 0.24 },
  { id: 2, name: 'Attic', short: 'A', height: 0.8, ambient: 0.18 }
];

/* Outside spaces (only reachable through a gate) */
export const OUTSIDE = [
  R('yard', 'Front Walk', 'outside', 0, [430, 660, 180, 90], { floor: 'gravel', wall: 'night', outside: true, light: 1, desc: 'Gravel, a dead lantern, the street beyond.' }),
  R('lane', 'Cobble Lane', 'outside', 0, [1150, 360, 120, 120], { floor: 'gravel', wall: 'night', outside: true, light: 1, desc: 'A service lane. A van with the engine still ticking.' }),
  R('alley', 'Coal Chute', 'outside', -1, [850, 180, 90, 90], { floor: 'gravel', wall: 'night', outside: true, light: 1, desc: 'The old chute. Cold air and loose bricks.' }),
  R('roof', 'Slate Roof', 'outside', 2, [880, 240, 90, 90], { floor: 'gravel', wall: 'night', outside: true, light: 1, desc: 'Steep slate. One bad step from the eaves.' })
];

export const ROOMS = [
  /* ---------------- ground ---------------- */
  R('foyer', 'Foyer', 'foyer', 0, [430, 520, 180, 140], {
    floor: 'tile', wall: 'panel', dread: 0.05,
    tags: ['entry', 'social'], light: 1,
    desc: 'Front doors, a cracked mirror, coats that are not theirs.'
  }),
  R('hall', 'Ground Hall', 'hallway', 0, [430, 120, 180, 400], {
    floor: 'wood', wall: 'panel', dread: 0.1,
    tags: ['spine', 'stairs'],
    desc: 'The spine of the house. Stairs up, stairs down, every door off it.'
  }),
  R('parlor', 'Parlor', 'parlor', 0, [150, 120, 280, 220], {
    floor: 'carpet', wall: 'damask', dread: 0.2,
    tags: ['formal', 'watched'],
    desc: 'Chairs still arranged for company that never came.'
  }),
  R('study', 'Study', 'study', 0, [150, 340, 280, 180], {
    floor: 'wood', wall: 'panel', dread: 0.16,
    tags: ['papers', 'quiet'],
    desc: 'Deeds, letters, and a ledger in a hand that changed over the years.'
  }),
  R('dining', 'Dining Room', 'dining', 0, [610, 120, 320, 240], {
    floor: 'wood', wall: 'damask', dread: 0.24,
    tags: ['formal', 'long_table'],
    desc: 'Thirteen chairs. The table is set for a meal nobody finished.'
  }),
  R('kitchen', 'Kitchen', 'kitchen', 0, [930, 120, 220, 240], {
    floor: 'tile', wall: 'tile', dread: 0.14,
    tags: ['service', 'heat', 'gas'],
    desc: 'Gas line still live. Copper, soot, a door pinned shut once.'
  }),
  R('pantry', 'Pantry', 'pantry', 0, [930, 360, 220, 120], {
    floor: 'stone', wall: 'stone', light: 0, dread: 0.3,
    tags: ['confined', 'service', 'cold'],
    desc: 'Shelves to the ceiling and a door that swings closed by itself.'
  }),
  R('powder', 'Powder Room', 'bathroom', 0, [610, 360, 150, 160], {
    floor: 'tile', wall: 'tile', dread: 0.22,
    tags: ['water', 'mirror', 'small'],
    desc: 'A mirror with a soft cloth over it. Nobody remembers draping it.'
  }),
  /* ---------------- upper ---------------- */
  R('uhall', 'Upstairs Hall', 'hallway', 1, [430, 140, 180, 400], {
    floor: 'wood', wall: 'stripes', dread: 0.18,
    tags: ['spine', 'stairs', 'watched'],
    desc: 'A long runner, six doors, and the sense of being watched from the ceiling.'
  }),
  R('master', 'Master Bedroom', 'bedroom', 1, [150, 120, 280, 220], {
    floor: 'carpet', wall: 'damask', dread: 0.26,
    tags: ['private', 'mirror'],
    desc: 'Four-poster, cold side of the bed kept made for years.'
  }),
  R('child', "Children's Room", 'bedroom', 1, [150, 340, 280, 200], {
    floor: 'wood', wall: 'nursery', dread: 0.42,
    tags: ['dolls', 'small', 'memory'],
    desc: 'Two beds, a dollhouse with every chair pulled out, and a shelf of watchers.'
  }),
  R('spare', 'Spare Bedroom', 'bedroom', 1, [610, 120, 220, 200], {
    floor: 'carpet', wall: 'stripes', dread: 0.2,
    tags: ['private', 'guests'],
    desc: 'Fresh sheets, once. Suitcases nobody came back for.'
  }),
  R('ubath', 'Upstairs Bathroom', 'bathroom', 1, [610, 320, 220, 220], {
    floor: 'tile', wall: 'tile', dread: 0.34,
    tags: ['water', 'mirror', 'enclosed'],
    desc: ' Claw-foot tub, drain that breathes, a window that will not lift.'
  }),
  R('linen', 'Linen Closet', 'closet', 1, [830, 360, 100, 120], {
    floor: 'wood', wall: 'plaster', light: 0, dread: 0.5,
    tags: ['confined', 'dark', 'hiding'],
    desc: 'Towels, mothballs, and just enough room to stand and be forgotten.'
  }),
  /* ---------------- cellar ---------------- */
  R('blanding', 'Cellar Landing', 'hallway', -1, [430, 120, 180, 180], {
    floor: 'stone', wall: 'stone', light: 0, dread: 0.34,
    tags: ['stairs', 'damp'],
    desc: 'Last step that moves. A bulb on a long cord, always swinging.'
  }),
  R('boiler', 'Boiler Room', 'utility', -1, [150, 120, 280, 220], {
    floor: 'stone', wall: 'brick', light: 0, dread: 0.3,
    tags: ['heat', 'noise', 'confined'],
    desc: 'Iron, soot, and a furnace that still wants to be fed.'
  }),
  R('laundry', 'Wash House', 'utility', -1, [150, 340, 280, 200], {
    floor: 'tile', wall: 'brick', light: 0, dread: 0.28,
    tags: ['water', 'noise'],
    desc: 'Wringers, steam, sheets that were never brought upstairs.'
  }),
  R('rootcellar', 'Root Cellar', 'storage', -1, [610, 120, 240, 200], {
    floor: 'dirt', wall: 'stone', light: 0, dread: 0.44,
    tags: ['confined', 'earth', 'cold'],
    desc: 'Jars, roots, and a wall that sounds hollow in three places.'
  }),
  R('workshop', 'Workshop', 'utility', -1, [610, 320, 240, 220], {
    floor: 'wood', wall: 'plaster', light: 0, dread: 0.2,
    tags: ['tools', 'creations'],
    desc: 'A bench, hand tools, and things half-made on purpose.'
  }),
  /* ---------------- attic ---------------- */
  R('attic', 'Attic', 'attic', 2, [300, 160, 440, 300], {
    floor: 'wood', wall: 'plaster', light: 0, dread: 0.38,
    tags: ['rafters', 'stored', 'dark'],
    desc: 'Sheet-draped furniture, rafters thick with dust, a mirror under canvas.'
  }),
  R('nook', 'Eaves Nook', 'attic', 2, [740, 200, 140, 140], {
    floor: 'wood', wall: 'plaster', light: 0, dread: 0.55,
    tags: ['confined', 'memory', 'heights'],
    desc: 'Someone lived up here. Drawings under the eaves, a hatch to the roof.'
  })
];

/* doors: [roomA, roomB, ax, ay, bx, by, kind]  kind: door | stair | gate */
const rawDoors = [
  ['hall', 'foyer', 520, 508, 520, 532, 'door'],
  ['hall', 'parlor', 442, 200, 418, 200, 'door'],
  ['hall', 'study', 442, 430, 418, 430, 'door'],
  ['hall', 'dining', 598, 200, 622, 200, 'door'],
  ['hall', 'powder', 598, 440, 622, 440, 'door'],
  ['parlor', 'study', 250, 328, 250, 352, 'door'],
  ['dining', 'kitchen', 918, 240, 942, 240, 'door'],
  ['kitchen', 'pantry', 1040, 348, 1040, 372, 'door'],
  ['dining', 'powder', 700, 348, 700, 372, 'door'],
  ['foyer', 'yard', 520, 655, 520, 675, 'gate', 'Front Door'],
  ['pantry', 'lane', 1145, 420, 1160, 420, 'gate', 'Back Door'],
  ['hall', 'uhall', 585, 150, 585, 520, 'stair', 'Grand Stair'],
  ['hall', 'blanding', 455, 500, 520, 140, 'stair', 'Cellar Stair'],
  ['uhall', 'master', 442, 210, 418, 210, 'door'],
  ['uhall', 'child', 442, 460, 418, 460, 'door'],
  ['uhall', 'spare', 598, 190, 622, 190, 'door'],
  ['uhall', 'ubath', 598, 460, 622, 460, 'door'],
  ['master', 'child', 250, 328, 250, 352, 'door'],
  ['ubath', 'linen', 826, 420, 838, 420, 'door'],
  ['uhall', 'attic', 455, 160, 600, 430, 'stair', 'Attic Stair'],
  ['blanding', 'boiler', 442, 200, 418, 200, 'door'],
  ['boiler', 'laundry', 300, 334, 300, 346, 'door', 'Back Stairs'],
  ['blanding', 'rootcellar', 598, 200, 622, 200, 'door'],
  ['rootcellar', 'workshop', 700, 314, 700, 326, 'door'],
  ['boiler', 'laundry', 250, 336, 250, 348, 'door'],
  ['rootcellar', 'workshop', 730, 316, 730, 332, 'door'],
  ['rootcellar', 'alley', 846, 250, 862, 250, 'gate', 'Coal Chute'],
  ['attic', 'nook', 736, 270, 748, 270, 'door'],
  ['nook', 'roof', 876, 270, 892, 270, 'gate', 'Roof Hatch']
];

export const DOORS = rawDoors.map((d, i) => {
  const [a, b, ax, ay, bx, by, kind, label] = d;
  return {
    id: `d${i}_${a}_${b}`,
    a, b,
    ax, ay, bx, by,
    kind, label: label || null,
    open: kind === 'stair',
    locked: false,
    forced: false,
    broken: false,
    seal: 0,
    warp: null,          /* {toRoom, fromPoint?} while architecture is unhinged */
    hinge: 1,           /* structural health 0..1 -> noisy / stuck doors */
    slamAt: -99,
    creak: kind === 'stair' ? 0 : 1
  };
});

/* props.  `draw` selects a procedural sprite in render/art.js */
export const PROPS = [
  /* foyer */
  P('foyer', 'front_door', 'door_plate', 496, 636, 48, 16, {}),
  P('foyer', 'hall_mirror', 'mirror', 440, 540, 20, 52, { breakable: true }),
  P('foyer', 'console_table', 'table', 556, 540, 46, 20, { movable: false, container: true }),
  P('foyer', 'coat_rack', 'rack', 448, 632, 18, 18, { movable: true }),
  P('foyer', 'umbrella_stand', 'stand', 580, 630, 16, 16, { movable: true }),
  P('foyer', 'runner', 'rug', 470, 560, 110, 70, {}),
  P('foyer', 'ceiling_lamp', 'ceiling_lamp', 520, 585, 26, 26, { light: true }),
  P('foyer', 'mail_pile', 'boxes', 566, 546, 22, 10, { movable: true, container: true }),
  /* hall */
  P('hall', 'grandfather_clock', 'clock', 436, 300, 26, 46, { breakable: true }),
  P('hall', 'hall_table', 'table', 574, 320, 30, 46, { container: true }),
  P('hall', 'wall_phone', 'radio', 578, 336, 14, 12, {}),
  P('hall', 'runner', 'rug', 470, 150, 100, 360, {}),
  P('hall', 'newel_post', 'column', 578, 146, 12, 12, {}),
  P('hall', 'pendant_lamp', 'ceiling_lamp', 520, 250, 22, 22, { light: true }),
  P('hall', 'pendant_lamp2', 'ceiling_lamp', 520, 430, 22, 22, { light: true }),
  P('hall', 'potted_fern', 'plant', 440, 470, 20, 20, { movable: true, breakable: true }),
  P('hall', 'crate_stack', 'boxes', 440, 200, 34, 26, { movable: true, hideable: true, container: true }),
  /* parlor */
  P('parlor', 'sofa', 'sofa', 170, 150, 92, 32, { seatable: true }),
  P('parlor', 'armchair', 'chair', 300, 150, 26, 26, { seatable: true, movable: true }),
  P('parlor', 'armchair2', 'chair', 340, 190, 26, 26, { seatable: true, movable: true }),
  P('parlor', 'fireplace', 'fireplace', 170, 296, 70, 24, {}),
  P('parlor', 'piano', 'piano', 330, 250, 76, 40, { objective: 'piano' }),
  P('parlor', 'bookshelf', 'bookshelf', 160, 226, 20, 58, { container: true }),
  P('parlor', 'curio_cabinet', 'cabinet', 402, 130, 24, 56, { container: true, breakable: true }),
  P('parlor', 'china_doll', 'doll', 406, 142, 12, 16, { movable: true }),
  P('parlor', 'china_doll2', 'doll', 406, 162, 12, 16, { movable: true }),
  P('parlor', 'coffee_table', 'table', 232, 208, 44, 26, { movable: true, container: true }),
  P('parlor', 'parlor_rug', 'rug', 200, 180, 160, 110, {}),
  P('parlor', 'portrait', 'portrait', 156, 130, 12, 40, { breakable: true }),
  P('parlor', 'candelabra', 'candles', 246, 214, 16, 14, { movable: true, light: true }),
  P('parlor', 'drapes', 'curtain', 152, 240, 10, 54, {}),
  P('parlor', 'mirror_ornate', 'mirror', 420, 210, 18, 44, { breakable: true }),
  /* study */
  P('study', 'desk', 'desk', 200, 420, 76, 34, { container: true, objective: 'papers' }),
  P('study', 'desk_chair', 'chair', 236, 460, 24, 24, { seatable: true, movable: true }),
  P('study', 'bookshelf_a', 'bookshelf', 160, 350, 20, 78, { container: true }),
  P('study', 'bookshelf_b', 'bookshelf', 190, 350, 20, 78, { container: true }),
  P('study', 'globe', 'globe', 396, 360, 26, 26, { movable: true }),
  P('study', 'oil_lamp', 'lamp', 268, 426, 12, 12, { movable: true, light: true }),
  P('study', 'files', 'boxes', 330, 486, 32, 22, { container: true, movable: true }),
  P('study', 'armchair', 'chair', 380, 430, 28, 28, { seatable: true, movable: true }),
  P('study', 'study_rug', 'rug', 220, 452, 150, 58, {}),
  P('study', 'typewriter', 'typewriter', 214, 428, 24, 14, { movable: true }),
  /* dining */
  P('dining', 'dining_table', 'long_table', 690, 180, 160, 56, { objective: 'table' }),
  P('dining', 'chair_a', 'chair', 660, 160, 18, 18, { movable: true, seatable: true }),
  P('dining', 'chair_b', 'chair', 700, 160, 18, 18, { movable: true, seatable: true }),
  P('dining', 'chair_c', 'chair', 740, 160, 18, 18, { movable: true, seatable: true }),
  P('dining', 'chair_d', 'chair', 780, 160, 18, 18, { movable: true, seatable: true }),
  P('dining', 'chair_e', 'chair', 660, 236, 18, 18, { movable: true, seatable: true }),
  P('dining', 'chair_f', 'chair', 700, 236, 18, 18, { movable: true, seatable: true }),
  P('dining', 'chair_g', 'chair', 740, 236, 18, 18, { movable: true, seatable: true }),
  P('dining', 'sideboard', 'cabinet', 890, 140, 34, 62, { container: true }),
  P('dining', 'china', 'dishes', 896, 150, 22, 16, { movable: true, breakable: true }),
  P('dining', 'chandelier', 'chandelier', 762, 200, 44, 44, { light: true }),
  P('dining', 'dining_fire', 'fireplace', 620, 330, 66, 22, {}),
  P('dining', 'candles_a', 'candles', 700, 196, 14, 12, { movable: true, light: true }),
  P('dining', 'candles_b', 'candles', 820, 210, 14, 12, { movable: true, light: true }),
  P('dining', 'portrait_wall', 'portrait', 616, 140, 12, 44, { breakable: true }),
  P('dining', 'highchair', 'chair', 830, 300, 20, 20, { movable: true }),
  /* kitchen */
  P('kitchen', 'stove', 'stove', 940, 130, 44, 32, { light: true, objective: 'stove' }),
  P('kitchen', 'icebox', 'fridge', 1100, 130, 40, 46, { container: true }),
  P('kitchen', 'sink', 'sink', 940, 200, 44, 22, {}),
  P('kitchen', 'counter', 'counter', 990, 200, 100, 20, { container: true }),
  P('kitchen', 'kitchen_table', 'table', 1000, 290, 62, 34, { movable: false }),
  P('kitchen', 'stool_a', 'chair', 986, 268, 18, 18, { movable: true, seatable: true }),
  P('kitchen', 'stool_b', 'chair', 1060, 300, 18, 18, { movable: true, seatable: true }),
  P('kitchen', 'shelves_k', 'shelf', 1108, 240, 34, 44, { container: true }),
  P('kitchen', 'pots', 'pans', 950, 176, 22, 12, { movable: true, breakable: true }),
  P('kitchen', 'fuse_box', 'fusebox', 1140, 330, 18, 24, { objective: 'fuse' }),
  P('kitchen', 'kettle', 'pans', 966, 138, 12, 10, { movable: true }),
  P('kitchen', 'cat_bowl', 'bowls', 1080, 330, 14, 10, { movable: true }),
  P('kitchen', 'ceiling_fixture', 'ceiling_lamp', 1030, 200, 20, 20, { light: true }),
  /* pantry */
  P('pantry', 'shelf_a', 'shelf', 940, 372, 26, 96, { container: true }),
  P('pantry', 'shelf_b', 'shelf', 1000, 372, 26, 96, { container: true }),
  P('pantry', 'cider_barrel', 'barrel', 1064, 420, 34, 34, { movable: false }),
  P('pantry', 'preserve_jars', 'jars', 1104, 372, 40, 22, { breakable: true, container: true }),
  P('pantry', 'ham_hook', 'hanging', 1080, 440, 18, 30, { movable: true }),
  P('pantry', 'coal_scoop', 'tools', 950, 468, 20, 10, { movable: true }),
  /* powder room */
  P('powder', 'toilet_p', 'toilet', 622, 372, 22, 30, {}),
  P('powder', 'sink_p', 'sink', 700, 372, 30, 20, {}),
  P('powder', 'mirror_p', 'mirror', 736, 400, 16, 34, { breakable: true }),
  P('powder', 'cabinet_p', 'cabinet', 622, 470, 26, 40, { container: true }),
  P('powder', 'towel_p', 'towels', 700, 494, 30, 16, { movable: true }),
  /* upstairs hall */
  P('uhall', 'settee', 'sofa', 448, 300, 26, 60, { seatable: true }),
  P('uhall', 'uhall_lamp', 'lamp', 576, 300, 14, 14, { movable: true, light: true }),
  P('uhall', 'picture_strip', 'portrait', 596, 210, 10, 110, { breakable: true }),
  P('uhall', 'uhall_runner', 'rug', 470, 200, 100, 300, {}),
  P('uhall', 'toy_train', 'toys', 452, 400, 30, 14, { movable: true }),
  P('uhall', 'bucket', 'buckets', 560, 470, 18, 16, { movable: true }),
  /* master bedroom */
  P('master', 'four_poster', 'bed', 200, 160, 92, 76, { seatable: true, hideable: true }),
  P('master', 'nightstand_l', 'table', 170, 160, 22, 22, { container: true, movable: true }),
  P('master', 'nightstand_r', 'table', 296, 160, 22, 22, { container: true, movable: true }),
  P('master', 'wardrobe', 'wardrobe', 160, 264, 60, 26, { container: true, hideable: true }),
  P('master', 'dresser', 'dresser', 386, 150, 40, 62, { container: true, objective: 'jewelry' }),
  P('master', 'jewelry_box', 'lockbox', 396, 168, 16, 14, { movable: true, container: true, value: 3, objective: 'loot' }),
  P('master', 'vanity_mirror', 'mirror', 392, 224, 30, 14, { breakable: true }),
  P('master', 'rocker', 'chair', 330, 290, 26, 26, { seatable: true, movable: true }),
  P('master', 'master_rug', 'rug', 220, 250, 130, 60, {}),
  P('master', 'bed_lamp', 'lamp', 174, 164, 12, 12, { movable: true, light: true }),
  P('master', 'portrait_couple', 'portrait', 156, 130, 12, 42, { breakable: true }),
  /* children's room */
  P('child', 'crib', 'crib', 170, 480, 54, 34, { container: true }),
  P('child', 'small_bed', 'bed', 300, 360, 66, 44, { seatable: true, hideable: true }),
  P('child', 'dollhouse', 'dollhouse', 170, 360, 54, 40, { container: true, objective: 'dollhouse' }),
  P('child', 'doll_row_a', 'doll', 232, 356, 12, 18, { movable: true }),
  P('child', 'doll_row_b', 'doll', 250, 356, 12, 18, { movable: true }),
  P('child', 'doll_row_c', 'doll', 268, 356, 12, 18, { movable: true }),
  P('child', 'toy_box', 'boxes', 380, 470, 34, 26, { container: true, movable: true }),
  P('child', 'rocking_horse', 'rocking_horse', 200, 424, 44, 26, { movable: true }),
  P('child', 'child_lamp', 'lamp', 372, 404, 12, 12, { movable: true, light: true }),
  P('child', 'crayon_wall', 'drawings', 156, 430, 10, 80, {}),
  P('child', 'child_rug', 'rug', 250, 440, 120, 70, {}),
  /* spare bedroom */
  P('spare', 'cot', 'bed', 630, 150, 76, 42, { seatable: true, hideable: true }),
  P('spare', 'suitcase', 'suitcase', 740, 160, 34, 22, { container: true, movable: true }),
  P('spare', 'trunk_s', 'trunk', 776, 230, 44, 26, { container: true, hideable: true }),
  P('spare', 'shelf_s', 'shelf', 620, 250, 24, 54, { container: true }),
  P('spare', 'photos', 'boxes', 626, 262, 16, 12, { movable: true, objective: 'photos' }),
  P('spare', 'spare_lamp', 'lamp', 700, 246, 12, 12, { movable: true, light: true }),
  /* upstairs bath */
  P('ubath', 'claw_tub', 'tub', 630, 340, 70, 44, { hideable: true }),
  P('ubath', 'sink_b', 'sink', 730, 340, 30, 20, {}),
  P('ubath', 'mirror_b', 'mirror', 786, 350, 16, 40, { breakable: true }),
  P('ubath', 'toilet_b', 'toilet', 630, 470, 22, 30, {}),
  P('ubath', 'hamper', 'basket', 700, 490, 26, 26, { container: true, hideable: true, movable: true }),
  P('ubath', 'shelf_b', 'shelf', 780, 440, 34, 40, { container: true }),
  P('ubath', 'tiles_wet', 'wetmark', 660, 420, 40, 40, {}),
  /* linen closet */
  P('linen', 'towels_shelf', 'shelf', 838, 372, 80, 20, { container: true }),
  P('linen', 'linen_rolls', 'boxes', 840, 404, 60, 16, { movable: true }),
  P('linen', 'mothball_jar', 'jars', 850, 440, 20, 14, { breakable: true, movable: true }),
  /* cellar landing */
  P('blanding', 'swing_bulb', 'hanglamp', 520, 180, 16, 30, { light: true, movable: true }),
  P('blanding', 'coal_scuttle', 'basket', 570, 250, 22, 18, { movable: true }),
  P('blanding', 'stairs_mark', 'stairs_glyph', 520, 132, 40, 16, {}),
  P('blanding', 'canning_shelf', 'shelf', 440, 220, 24, 60, { container: true }),
  /* boiler room */
  P('boiler', 'boiler', 'boiler', 180, 150, 80, 60, { objective: 'furnace' }),
  P('boiler', 'pipes', 'pipes', 280, 130, 130, 16, {}),
  P('boiler', 'coal_pile', 'coal', 170, 280, 60, 40, { movable: true }),
  P('boiler', 'workbench_b', 'workbench', 300, 280, 90, 26, { container: true }),
  P('boiler', 'chain', 'hanging', 396, 170, 14, 46, { movable: true }),
  P('boiler', 'bucket_b', 'buckets', 176, 240, 18, 16, { movable: true }),
  /* wash house */
  P('laundry', 'wringer_a', 'washer', 170, 360, 46, 34, {}),
  P('laundry', 'wringer_b', 'washer', 230, 360, 46, 34, {}),
  P('laundry', 'copper_tub', 'tub', 340, 360, 60, 40, { hideable: true }),
  P('laundry', 'drying_rack', 'rack', 180, 470, 70, 26, { movable: true, hideable: true }),
  P('laundry', 'basket_l', 'basket', 300, 490, 26, 22, { container: true, movable: true, hideable: true }),
  P('laundry', 'ironing', 'table', 350, 470, 66, 20, { movable: true }),
  /* root cellar */
  P('rootcellar', 'jar_wall', 'jars', 620, 130, 120, 20, { breakable: true, container: true }),
  P('rootcellar', 'potato_crate', 'crate', 760, 220, 40, 30, { container: true, hideable: true, movable: true }),
  P('rootcellar', 'dirt_wall', 'hollowwall', 616, 240, 10, 60, { objective: 'hollow' }),
  P('rootcellar', 'sack_row', 'sacks', 700, 260, 80, 22, { movable: true, hideable: true }),
  P('rootcellar', 'hanging_cage', 'hanging', 820, 150, 20, 34, {}),
  /* workshop */
  P('workshop', 'bench', 'workbench', 630, 340, 120, 30, { container: true, objective: 'tools' }),
  P('workshop', 'tool_wall', 'tools', 760, 330, 80, 16, { breakable: true, container: true }),
  P('workshop', 'radio_w', 'radio', 630, 400, 24, 18, { light: true }),
  P('workshop', 'saw_horse', 'table', 740, 440, 60, 18, { movable: true }),
  P('workshop', 'paint_cans', 'buckets', 810, 480, 34, 20, { movable: true, breakable: true }),
  P('workshop', 'hidden_safe', 'safe', 626, 486, 30, 30, { container: true, objective: 'safe', value: 5 }),
  P('workshop', 'crate_w', 'crate', 700, 490, 34, 26, { container: true, hideable: true, movable: true }),
  /* attic */
  P('attic', 'covered_furniture', 'covered', 340, 220, 80, 50, { hideable: true }),
  P('attic', 'trunk_a', 'trunk', 460, 200, 46, 28, { container: true, hideable: true }),
  P('attic', 'trunk_b', 'trunk', 460, 240, 46, 28, { container: true }),
  P('attic', 'hatbox_doll', 'doll', 640, 200, 16, 22, { movable: true, objective: 'hatbox' }),
  P('attic', 'crate_a', 'crate', 690, 300, 40, 32, { container: true, hideable: true, movable: true }),
  P('attic', 'rocking_horse_a', 'rocking_horse', 360, 380, 50, 28, { movable: true }),
  P('attic', 'covered_mirror', 'mirror', 300, 300, 14, 46, { breakable: true }),
  P('attic', 'music_box', 'lockbox', 560, 300, 18, 14, { movable: true, value: 4, objective: 'relic' }),
  P('attic', 'oil_lantern', 'lamp', 600, 380, 14, 14, { movable: true, light: true }),
  P('attic', 'loose_board', 'floorboard', 400, 320, 44, 14, { container: true, objective: 'cache' }),
  P('attic', 'eave_window', 'window', 300, 430, 34, 12, { breakable: true }),
  P('attic', 'attic_doll_row', 'doll', 520, 400, 30, 14, { movable: true }),
  /* eaves nook */
  P('nook', 'nook_cot', 'bed', 750, 220, 60, 34, { seatable: true, hideable: true }),
  P('nook', 'nook_desk', 'desk', 820, 220, 44, 22, { container: true }),
  P('nook', 'nook_drawings', 'drawings', 876, 240, 8, 80, {}),
  P('nook', 'hatch', 'window', 862, 260, 22, 22, { objective: 'hatch' }),
  P('nook', 'nook_crates', 'boxes', 750, 300, 40, 30, { container: true, hideable: true })
];

export const HOUSE_META = {
  name: 'Hollowmere House',
  built: 1889,
  address: '13 Hollowmere Lane',
  plan: { w: 1260, h: 780 },
  exitRooms: ['yard', 'lane', 'alley', 'roof']
};

/* Light fixtures per room (what `snuff` / `flicker` act on). */
export function lightsOf(room) {
  return PROPS.filter(p => p.room === room.id && p.light);
}
