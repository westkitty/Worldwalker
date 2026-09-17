/* THE HOUSE THAT HUNTS BACK - nights, upgrades, house lore. */

/* Night = roster + their objective + countermeasures + pressure limits.
   timeLimit is sim-seconds of night; dawn ends it and everyone still inside walks out
   with whatever they are carrying. */
export const SCENARIOS = [
  {
    id: 'n1', n: 1, name: 'Four in the Foyer', tagline: 'Teenagers, a dare, a phone camera',
    brief: 'A dare posted at 9:40. Four of them, one phone, and the bet that nobody makes it to the attic. They will wreck things, they will film nothing much, and they will leave by the front door if it is open. Let them learn what this house is.',
    timeLimit: 300, caseLimit: 34, dreadTarget: 40,
    objective: { kind: 'dare_tour', targets: ['attic', 'child', 'parlor', 'ubath'], need: 3, exit: 'yard', review: 'foyer', reviewHold: 13, needReview: 1 },
    roster: [
      { arch: 'thrill_seeker', name: 'Marcus', traits: ['brave'] },
      { arch: 'thrill_seeker', name: 'Taffy', fears: { dolls: 1.2, blood: 0.6 }, traits: ['anxious', 'performer'] },
      { arch: 'skeptic', name: 'Dane', gear: ['phone', 'flashlight'] },
      { arch: 'urban_explorer', name: 'Kit', gear: ['phone', 'headlamp'] }
    ],
    teaching: ['movement', 'observe', 'sound', 'fear', 'expel'],
    mods: { intruderNerve: 0.92 },
    after: 'They posted eleven seconds of a door swinging. Nobody believed it. Three of them did not come back.'
  },
  {
    id: 'n2', n: 2, name: 'The Column', tagline: 'A journalist and a man with a meter',
    brief: 'Two bylines are due: a reporter who wants the story and an investigator who wants a clean EMF reading. They take notes, they file to the car, and if the file gets out the house is on the front page by Thursday.',
    timeLimit: 330, caseLimit: 40, dreadTarget: 55,
    objective: { kind: 'evidence', need: 4, cache: 'foyer:console_table', exit: 'yard' },
    roster: [
      { arch: 'journalist', name: 'Rosalind Hale' },
      { arch: 'occult_investigator', name: 'Verne Ockel', gear: ['flashlight', 'emf', 'recorder', 'camera', 'tripod_trap'] }
    ],
    teaching: ['evidence', 'cache', 'light', 'isolate', 'devour'],
    newGear: ['emf', 'recorder', 'tripod_trap'],
    mods: { evidenceWeight: 1.1 },
    after: 'The recorder caught a door and a breath. Ockel has asked for a second night in.'
  },
  {
    id: 'n3', n: 3, name: 'The Silver', tagline: 'Thieves with a crowbar and a list',
    brief: 'Three came for the Hollowmere silver: a jewelry box in the master bedroom and a locked strongbox under the cellar bench. They break locks instead of walking around them, and every thing they carry out of this house is gone from it forever.',
    timeLimit: 320, caseLimit: 26, dreadTarget: 62,
    objective: { kind: 'loot', cache: 'lane:van', exit: 'lane', need: 1,
      targets: ['master:jewelry_box', 'workshop:hidden_safe', 'attic:music_box', 'spare:suitcase'] },
    roster: [
      { arch: 'night_thief', name: 'Sully' },
      { arch: 'night_thief', name: 'Roan', traits: ['strong', 'careful'], gear: ['crowbar', 'lockpick', 'headlamp'] },
      { arch: 'skeptic', name: 'Petra', role: 'Getaway Driver', traits: ['agile'], gear: ['lockpick', 'flashlight'] }
    ],
    teaching: ['lock', 'break', 'loot', 'hiding', 'props'],
    mods: { breakPower: 1.35, evidenceWeight: 0.8 },
    after: 'Two of them ran out the back with nothing but a bad ankle. The house kept the list.'
  },
  {
    id: 'n4', n: 4, name: 'The Circle', tagline: 'Five candles and people who want to believe',
    brief: 'A spiritualist circle sits in your parlor to open a door. Manifestations do not frighten them the way they frighten others - they feed, and if the ritual finishes the house is bound for a hundred years. Divide them, speak to them, and let the dark do the arguing.',
    timeLimit: 340, caseLimit: 30, dreadTarget: 70,
    objective: { kind: 'ritual', room: 'parlor', need: 3, hold: 40, exit: 'yard' },
    roster: [
      { arch: 'spiritualist_medium', name: 'Madame Ursich' },
      { arch: 'occult_investigator', name: 'Devon Pryce', traits: ['devout', 'follower'], gear: ['flashlight', 'recorder', 'emf'] },
      { arch: 'thrill_seeker', name: 'Iona', fears: { blood: 1.3, insects: 0.8 }, traits: ['anxious', 'haunted'], gear: ['flashlight', 'camera'] },
      { arch: 'journalist', name: 'Fenella Grant', traits: ['curious', 'paranoid'], gear: ['flashlight', 'recorder', 'phone'] }
    ],
    teaching: ['ritual', 'emboldened', 'fury', 'seal', 'memory'],
    mods: { ritualValue: 1.4, fearToDread: 1.15 },
    after: 'The circle broke at three minutes to dawn. Ursich wrote that the house answered - and that it did not want to be spoken to.'
  },
  {
    id: 'n5', n: 5, name: 'The Reclamation Team', tagline: 'Salt, thermals, a live feed',
    brief: 'A coordinated crew: two on sensors, one on the feed, one on the doors. They salt thresholds, run camera traps, and file evidence in a box by the front walk. Nothing they cannot explain bothers them; everything they cannot explain gets them funding. Break the feed before it breaks you.',
    timeLimit: 360, caseLimit: 44, dreadTarget: 85,
    objective: { kind: 'evidence', need: 6, cache: 'yard:front_walk', exit: 'yard' },
    roster: [
      { arch: 'paranormal_streamer', name: 'Dez (Channel: NightWire)' },
      { arch: 'occult_investigator', name: 'Verne Ockel', gear: ['flashlight', 'emf', 'thermal', 'recorder', 'camera', 'salt', 'tripod_trap'] },
      { arch: 'skeptic', name: 'Dr. Alina Reyes', traits: ['skeptic', 'leader', 'techy'], gear: ['headlamp', 'emf', 'camera', 'sedative'] },
      { arch: 'urban_explorer', name: 'Kit', traits: ['agile', 'careful'], gear: ['camera', 'headlamp', 'rope', 'thermal'] },
      { arch: 'search_party', name: 'Ola Sandvane', role: 'Medic', traits: ['medic', 'brave', 'careful'], gear: ['firstaid', 'sedative', 'headlamp', 'flashlight'] }
    ],
    teaching: ['salt', 'ward', 'countermeasure', 'tripod', 'battery'],
    mods: { evidenceWeight: 1.3, wardStrength: 1 },
    newGear: ['salt', 'thermal', 'sedative', 'firstaid'],
    after: 'The crew lost four of six files and a tripod. The feed ran for eleven minutes and the house is trending.'
  },
  {
    id: 'n6', n: 6, name: 'Deliverance', tagline: 'A rite to end all haunting',
    brief: 'They are not here for proof. A minister, a search party, and a team of specialists are coming for the missing, and for the seal under the parlor hearth. If they complete the rite at the four anchor points, Hollowmere goes quiet forever. This is the last night.',
    timeLimit: 380, caseLimit: 52, dreadTarget: 100,
    objective: { kind: 'banishing', anchors: ['foyer', 'parlor', 'blanding', 'uhall'], hold: 26, need: 4, exit: 'yard',
      rescue: { room: 'linen', need: 1 } },
    roster: [
      { arch: 'exorcist', name: 'Father Ivo Kessel' },
      { arch: 'search_party', name: 'Nora Blythe', traits: ['parent', 'grief', 'brave'] },
      { arch: 'search_party', name: 'Cal Blythe', traits: ['strong', 'careful'], gear: ['headlamp', 'rope', 'crowbar', 'firstaid'] },
      { arch: 'occult_investigator', name: 'Verne Ockel', traits: ['techy', 'veteran'], gear: ['emf', 'thermal', 'recorder', 'camera', 'salt', 'sedative'] },
      { arch: 'paranormal_streamer', name: 'Dez', traits: ['performer'], gear: ['streamrig', 'spiritbox', 'headlamp'] },
      { arch: 'skeptic', name: 'Dr. Alina Reyes', traits: ['skeptic', 'medic'], gear: ['headlamp', 'firstaid', 'sedative', 'camera'] }
    ],
    teaching: ['anchor', 'rescue', 'collapse', 'final'],
    mods: { banishPressure: 1.25, evidenceWeight: 1.2, anchorDrain: 0.5 },
    newGear: ['exorcism', 'crowbar', 'rope'],
    after: 'Dawn came up grey over Hollowmere. The house is still standing, and still angry.'
  }
];

/* The missing child, modelled as a world object so the rescue objective is systemic. */
export const LOST_CHILD = {
  id: 'lost_child', name: 'The Blythe Boy', hiddenIn: 'linen',
  desc: 'Nine years old, in a blue coat, asleep in the house for eleven days and not hungry.',
  state: 'hidden'
};

/* ---------------- progression ---------------- */
/* mods keys are read directly by the simulation (see sim/game.js -> applyMods) */
export const UPGRADES = [
  /* ---- powers ---- */
  { id: 'p_flicker', power: 'flicker_power', name: 'Curse the Circuit', cat: 'power', cost: 2, desc: 'Unlock: drain flashlights, fog lenses and deaden sensors in one room.', mods: {} },
  { id: 'p_possess', power: 'possess_object', name: 'Take a Thing', cat: 'power', cost: 3, desc: 'Unlock: possess an object and use it. Devastating, very filmable.', mods: {} },
  { id: 'p_bleed', power: 'bleed_walls', name: 'Bleed the Walls', cat: 'power', cost: 3, desc: 'Unlock: push blood out of the plaster. Persists; stains; sells.', mods: {} },
  { id: 'p_voice', power: 'mimic_voice', name: 'Wear a Voice', cat: 'power', cost: 3, desc: 'Unlock: imitate a companion and call them across the house.', mods: {} },
  { id: 'p_seal', power: 'seal_room', name: 'Seal a Room', cat: 'power', cost: 4, desc: 'Unlock: black pitch in every door frame of one room.', mods: {} },
  { id: 'p_unhinge', power: 'unhinge', name: 'Unhinge the Hallway', cat: 'power', cost: 5, desc: 'Unlock: retarget a passage. Architecture becomes a weapon.', mods: {} },
  { id: 'p_apparition', power: 'apparition', name: 'Manifest', cat: 'power', cost: 5, desc: 'Unlock: stand in a room and be seen.', mods: {} },
  { id: 'p_memory', power: 'memory_horror', name: 'Trigger a Memory', cat: 'power', cost: 5, desc: 'Unlock: play back what they have not told anyone.', mods: {} },
  { id: 'p_grasp', power: 'shadow_grasp', name: 'Shadow Grasp', cat: 'power', cost: 4, desc: 'Unlock: hold one of them still with cold hands.', mods: {} },
  { id: 'p_collapse', power: 'collapse', name: 'Bring Down the Ceiling', cat: 'power', cost: 6, desc: 'Unlock: let a joist give. Costs the house dearly.', mods: {} },
  { id: 'p_devour', power: 'devour_records', name: 'Devour the Record', cat: 'power', cost: 4, desc: 'Unlock: rot film and wipe cards in a room or off a person.', mods: {} },
  { id: 'p_feed', power: 'feed', name: 'Feed on Dread', cat: 'power', cost: 3, desc: 'Unlock: digest dread in a room into energy and settled plaster.', mods: {} },
  /* ---- passive traits ---- */
  { id: 't_fear_fuel', name: 'Fear Is Food', cat: 'trait', cost: 4, desc: 'Regenerate 60% of the fear you inflict as manifestation energy.', mods: { fearToEnergy: 0.6 } },
  { id: 't_fear_fuel2', name: 'Feast', cat: 'trait', cost: 6, requires: 't_fear_fuel', desc: 'Fear conversion rises to 100% and dread lingers longer.', mods: { fearToEnergy: 0.4, dreadDecay: -0.4 } },
  { id: 't_deep_root', name: 'Deep Foundations', cat: 'trait', cost: 3, desc: 'Stability recovers twice as fast; the house forgives itself.', mods: { stabilityRegen: 0.28 } },
  { id: 't_quiet', name: 'Quiet House', cat: 'trait', cost: 4, desc: 'All evidence produced reduced by 18%. Small scares, small files.', mods: { evidenceMult: -0.18 } },
  { id: 't_long_reach', name: 'Long Reach', cat: 'trait', cost: 4, desc: 'Powers may be cast into rooms adjacent to your focus, at +30% cost.', mods: { gripRange: 1 } },
  { id: 't_patience', name: 'Patience of Stone', cat: 'trait', cost: 3, desc: 'Cooldowns 20% shorter; the house waits better than people do.', mods: { cooldownMult: 0.8 } },
  { id: 't_cold_blood', name: 'Cold-Handed', cat: 'trait', cost: 3, desc: 'Grasps and seals last 40% longer.', mods: { holdDuration: 0.4 } },
  { id: 't_control', name: 'Leash the Anger', cat: 'trait', cost: 4, desc: 'No loss of control at high intensity, and intensity decays slower.', mods: { outburstRisk: -0.9, furyDecay: -0.3 } },
  { id: 't_memory_keep', name: 'The House Remembers', cat: 'trait', cost: 6, desc: 'Learned fears and secrets persist into every later night.', mods: { memoryKeep: 1 } },
  { id: 't_sharp_eyes', name: 'Sharpen Senses', cat: 'trait', cost: 2, desc: 'Observation resolves targets twice as fast.', mods: { observeRate: 1 } },
  { id: 't_ward_break', name: 'Salt Means Nothing', cat: 'trait', cost: 5, desc: '45% chance to manifest straight through a salt line.', mods: { wardBreak: 0.45 } },
  { id: 't_haunt_light', name: 'Heavy Dark', cat: 'trait', cost: 4, desc: 'Snuffed rooms bleed more dread; lightless rooms frighten 25% more.', mods: { darkAmp: 0.25 } },
  /* ---- architecture ---- */
  { id: 'a_passage', name: 'Open a Passage', cat: 'structure', cost: 5, desc: 'The pantry is now connected to the ground hall. More routes for them, more traps for you.', mods: { extraDoor: 'pantry_hall' } },
  { id: 'a_stair_lock', name: 'Lockable Stairs', cat: 'structure', cost: 4, desc: 'Staircases can be sealed, warped and locked like any door.', mods: { stairLockable: 1 } },
  { id: 'a_warp_long', name: 'Sticky Geometry', cat: 'structure', cost: 4, desc: 'Unhinged passages hold nearly twice as long and cost less stability.', mods: { warpDuration: 0.8, warpStab: -0.3 } },
  { id: 'a_warp_cheap', name: 'Loose Joints', cat: 'structure', cost: 3, desc: 'Unhinge costs 30% less energy.', mods: { warpCost: -0.3 } },
  { id: 'a_windows', name: 'Fused Windows', cat: 'structure', cost: 4, desc: 'They can no longer climb out of a room through glass.', mods: { noWindows: 1 } },
  { id: 'a_second_door', name: 'Wall Between Rooms', cat: 'structure', cost: 5, desc: 'A door in the cellar that was bricked up is open again: root cellar to workshop, and the hall to the boiler.', mods: { extraDoor2: 1 } },
  /* ---- rooms ---- */
  { id: 'r_child', name: 'Playmates', cat: 'room', cost: 4, room: 'child', desc: 'The dolls in the children’s room carry the house’s voice: any haunt in that room lands 30% harder on anyone afraid of them.', mods: { roomAmp: { child: { dollFear: 0.3 } } } },
  { id: 'r_parlor', name: 'An Audience', cat: 'room', cost: 4, room: 'parlor', desc: 'Manifesting in the parlor costs a third less and leaves less to photograph.', mods: { roomAmp: { parlor: { appCost: -0.33, appEvidence: -0.25 } } } },
  { id: 'r_dining', name: 'The Table Is Set', cat: 'room', cost: 3, room: 'dining', desc: 'Chairs answer when you move them: nudges in the dining room are free and repeat.', mods: { roomAmp: { dining: { nudgeFree: 1 } } } },
  { id: 'r_cellar', name: 'Deeper Dark', cat: 'room', cost: 4, room: 'blanding', desc: 'Dread in the cellar half of the house never decays on its own.', mods: { cellarDread: 1 } },
  { id: 'r_kitchen', name: 'Gas Tickles', cat: 'room', cost: 3, room: 'kitchen', desc: 'Cold spots in the kitchen also drain resolve; several people feel faint there.', mods: { roomAmp: { kitchen: { coldResolve: 0.5 } } } },
  { id: 'r_bath', name: 'The Drain Sings', cat: 'room', cost: 3, room: 'ubath', desc: 'Water rooms build dread twice as fast, and the sound carries through walls.', mods: { roomAmp: { ubath: { dreadRate: 2 }, powder: { dreadRate: 1.6 } } } },
  { id: 'r_attic', name: 'The Covered Mirror', cat: 'room', cost: 5, room: 'attic', desc: 'You can manifest anywhere in the house from the attic mirror; the attic itself becomes cheap.', mods: { roomAmp: { attic: { appCost: -0.5, anyRoomFromAttic: 1 } } } },
  { id: 'r_hall', name: 'Footprints in the Runner', cat: 'room', cost: 2, room: 'hall', desc: 'You can see where they have walked and what they are carrying in every room you focus.', mods: { observeAll: 1 } },
  { id: 'r_nook', name: 'Someone Lived Up There', cat: 'room', cost: 3, room: 'nook', desc: 'The eaves nook hides anything: searchers take far longer to find what is in there.', mods: { roomAmp: { nook: { searchSlow: 2 }, linen: { searchSlow: 2.2 } } } }
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

/* Lore: unlocked by milestones, each grants a small passive and explains the house. */
export const LORE = [
  { id: 'l_deed', name: 'The Deed, 1889', where: 'study:desk', hint: 'Someone has read the deeds.',
    mods: { energyMax: 6 }, text: 'Ezra Hollowmere built the house on a salt marsh he could not drain, and wrote in the deed that no room in it would ever be sold apart from its neighbours. That is why the doors remember which room they belong to.' },
  { id: 'l_children', name: 'Two Beds, One Name', where: 'child:toy_box', hint: 'Look in the children’s room.',
    mods: { dollPower: 0.25 }, text: 'The Hollmere children kept a house of their own inside this one. When they drowned in the marsh the dolls came inside, and the family stopped photographing them together. Dolls are not furniture here; they are seating.' },
  { id: 'l_fire', name: 'The Fire That Was Not', where: 'parlor:fireplace', hint: 'The parlor hearth knows.',
    mods: { stabilityRegen: 0.12 }, text: 'In 1911 the house burned for eleven minutes and then did not. The fire stopped at the parlor threshold, walked back into the grate, and went out. Ezra had made a bargain with something in the plaster, and the plaster has held to it ever since.' },
  { id: 'l_physician', name: 'Dr. Ames’s Last Note', where: 'workshop:bench', hint: 'A workshop in the cellar.',
    mods: { evidenceMult: -0.08 }, text: 'The physician who certified three deaths in this house wrote one line on the fourth page of his ledger: “The house is not the site. It is the party.” He was struck by a falling beam a fortnight later, indoors, on a still day.' },
  { id: 'l_seal', name: 'Five Anchors', where: 'attic:music_box', hint: 'Something is hidden under the attic boards.',
    mods: { energyRegen: 0.25 }, text: 'Salt in the threshold, iron in the stair, a mirror facing the wall, a bell that does not ring, and a room kept locked. Five anchors hold Hollowmere’s grip on the living. Five of them can be used by anyone who reads this far - including the men coming with candles.' },
  { id: 'l_first', name: 'The First Intruder', where: 'nook:nook_desk', hint: 'The eaves nook keeps a name.',
    mods: { fearGainMult: 0.08 }, text: 'A surveyor came in through the coal chute in 1924 to measure the property for the bank. He lived in the eaves for a year, drew every room, and never once found the front door. He is the reason the house knows what it is like to be on the inside.' }
];
