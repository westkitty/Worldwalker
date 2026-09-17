/* THE HOUSE THAT HUNTS BACK - fears, traits, gear, archetypes.  Data only. */

/* Fear kinds. `sens` on an intruder runs -0.75 (soothed) .. 1.8 (terrified).
   icon is a procedural glyph id drawn in render/art.js. */
export const FEARS = [
  { id: 'darkness', name: 'Darkness', icon: 'eye_dark', color: '#4a5a86', desc: 'No light at all. The shape of the room goes.' },
  { id: 'isolation', name: 'Isolation', icon: 'alone', color: '#5d7a9a', desc: 'Alone in the house, or cut off from the group.' },
  { id: 'blood', name: 'Blood', icon: 'drip', color: '#8e2b32', desc: 'Red on the walls, in the water, on their hands.' },
  { id: 'dolls', name: 'Dolls', icon: 'doll', color: '#9a7f6c', desc: 'Things shaped like children that do not blink.' },
  { id: 'enclosed', name: 'Enclosed Spaces', icon: 'box', color: '#7a6b52', desc: 'Walls closing, doors that will not open, closets.' },
  { id: 'voices', name: 'Voices', icon: 'wave', color: '#6f8f7a', desc: 'Someone saying their name from an empty room.' },
  { id: 'watched', name: 'Being Watched', icon: 'watcher', color: '#7b5b8c', desc: 'The sense of eyes in the dark and in the pictures.' },
  { id: 'loss', name: 'Losing Companions', icon: 'chain', color: '#a4763f', desc: 'Someone in the group going quiet, or gone.' },
  { id: 'drowning', name: 'Water', icon: 'ripple', color: '#4b7c8f', desc: 'Wet floors, running taps, water that keeps rising.' },
  { id: 'insects', name: 'Vermin', icon: 'scuttle', color: '#6d6a44', desc: 'Scratching inside the walls and something in the hair.' }
];
export const FEAR_IDS = FEARS.map(f => f.id);

/* Behavioural modifiers consumed by the simulation.  Missing key = 0 delta. */
export const TRAITS = [
  { id: 'brave', name: 'Brave', desc: 'Fear drains faster and bites less.', mods: { fearGain: -0.22, fearDecay: 0.35 } },
  { id: 'anxious', name: 'Anxious', desc: 'Fear builds fast and spreads to others.', mods: { fearGain: 0.3, contagion: 0.3 } },
  { id: 'leader', name: 'Leader', desc: 'Calm radiates to allies nearby.', mods: { calmAura: 0.7 } },
  { id: 'follower', name: 'Follower', desc: 'Follows whoever is loudest; panics when separated.', mods: { soloPanic: 0.5, regroup: 0.4 } },
  { id: 'skeptic', name: 'Skeptic', desc: 'Explains phenomena; feeds on debunking.', mods: { debunk: 0.55, evidenceGain: 0.25, fearGain: -0.15 } },
  { id: 'devout', name: 'Devout', desc: 'Faith blunts apparitions and blood.', mods: { ritualResist: 0.5, fearGain: -0.12 } },
  { id: 'greedy', name: 'Greedy', desc: 'Loot outweighs dread.', mods: { greed: 0.8, fearGain: -0.05 } },
  { id: 'curious', name: 'Curious', desc: 'Cannot pass a closed door without trying it.', mods: { curiosity: 0.7 } },
  { id: 'careful', name: 'Careful', desc: 'Slow, deliberate, hard to startle.', mods: { fearGain: -0.25, moveSpeed: -0.1, startleResist: 0.35 } },
  { id: 'agile', name: 'Agile', desc: 'Moves fast, escapes rooms, climbs.', mods: { moveSpeed: 0.22, breakPower: 0.1 } },
  { id: 'strong', name: 'Strong', desc: 'Forces locked doors and jammed frames.', mods: { breakPower: 0.55 } },
  { id: 'medic', name: 'Medic', desc: 'Carries sedatives and shares them.', mods: { calmAura: 0.35, usesSedative: 1 } },
  { id: 'grief', name: 'Grieving', desc: 'Memories and voices land far harder.', mods: { memoryVuln: 0.9, voiceVuln: 0.7 } },
  { id: 'nightblind', name: 'Night-Blind', desc: 'Darkness is doubly hostile.', mods: { darkHandicap: 0.6 } },
  { id: 'insomniac', name: 'Insomniac', desc: 'Used to the hours; recovers resolve quickly.', mods: { fearDecay: 0.25 } },
  { id: 'veteran', name: 'Hardened', desc: 'Immune to panic contagion.', mods: { contagionResist: 0.8, fearGain: -0.1 } },
  { id: 'paranoid', name: 'Paranoid', desc: 'Trusts the house more than the group; splits parties.', mods: { paranoia: 0.8, regroup: -0.4 } },
  { id: 'clumsy', name: 'Clumsy', desc: 'Knocks things over; the house can use that.', mods: { noise: 0.5, breakChance: 0.35 } },
  { id: 'performer', name: 'Performer', desc: 'Fear becomes content; keeps rolling.', mods: { showman: 0.9, fearDecay: -0.1 } },
  { id: 'parent', name: 'Guardian', desc: 'Will not flee while an ally is missing.', mods: { rescue: 1, regroup: 0.5 } },
  { id: 'techy', name: 'Tech-Savvy', desc: 'Repairs gear, reads instruments.', mods: { repair: 0.7, evidenceGain: 0.2 } },
  { id: 'haunted', name: 'Sensitive', desc: 'The house can speak through them; also feels everything.', mods: { fearGain: 0.35, medium: 0.6, voiceVuln: 0.4 } }
];
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map(t => [t.id, t]));

/* Equipment: what intruders carry, and what it does to the house. */
export const GEAR = [
  { id: 'flashlight', name: 'Flashlight', icon: 'torch', light: 0.55, battery: 120, desc: 'Pushes back darkness. Batteries are not infinite.' },
  { id: 'headlamp', name: 'Headlamp', icon: 'torch', light: 0.4, battery: 160, handsFree: true, desc: 'Dim but never in the way. Good for climbing.' },
  { id: 'camera', name: 'Still Camera', icon: 'camera', capture: 'photo', evidence: 0.85, desc: 'Snaps one frame of a clear phenomenon. Hard evidence.' },
  { id: 'vidcam', name: 'Camcorder', icon: 'vidcam', capture: 'video', evidence: 1.35, battery: 200, desc: 'Rolling tape. Anything it sees is admissible.' },
  { id: 'phone', name: 'Phone', icon: 'phone', capture: 'photo', evidence: 0.6, light: 0.25, comms: true, desc: 'Camera, torch, and a bar of signal near the front door.' },
  { id: 'streamrig', name: 'Live Rig', icon: 'stream', capture: 'broadcast', evidence: 2.1, battery: 240, light: 0.3, desc: 'Sends it out live. The audience is the evidence.' },
  { id: 'emf', name: 'EMF Meter', icon: 'emf', detect: 'grip', evidence: 0.4, desc: 'Warns its holder before a manifestation and logs the spike.' },
  { id: 'thermal', name: 'Thermal Cam', icon: 'thermal', detect: 'cold', evidence: 0.7, capture: 'video', desc: 'Sees cold spots and shapes in the dark.' },
  { id: 'spiritbox', name: 'Spirit Box', icon: 'radio', detect: 'voice', evidence: 0.85, desc: 'Sweeps bands. Turns whispers into answers - and answers into questions.' },
  { id: 'recorder', name: 'Audio Recorder', icon: 'mic', capture: 'audio', evidence: 0.65, desc: 'EVP hunting. Catches every creak you spend.' },
  { id: 'salt', name: 'Salt Line', icon: 'salt', ward: 'room', uses: 1, desc: 'Poured across a threshold: the house cannot touch that room while it holds.' },
  { id: 'crucifix', name: 'Blessed Cross', icon: 'cross', resolve: 0.35, resist: 'apparition', desc: 'Apparitions slide off it. It also burns the house to look at.' },
  { id: 'sedative', name: 'Sedatives', icon: 'vial', uses: 2, calm: 26, desc: 'Drops fear to a manageable level. Costs them time and sharpness.' },
  { id: 'flare', name: 'Flares', icon: 'flare', uses: 2, light: 0.8, burst: 'light', calm: 12, desc: 'A room full of red light and courage. Also very filmable.' },
  { id: 'crowbar', name: 'Crowbar', icon: 'bar', break: 0.85, defend: 0.5, desc: 'Locked doors become open doors. Also swings at shadows.' },
  { id: 'lockpick', name: 'Lock Kit', icon: 'key', unlock: 0.8, break: 0.2, desc: 'Quiet way through a locked door.' },
  { id: 'rope', name: 'Rope & Carabiners', icon: 'rope', tether: 0.9, desc: 'Tethered to an ally or the stairs; warped architecture confuses them less.' },
  { id: 'tripod_trap', name: 'Camera Trap', icon: 'tripod', deploy: 'trap', evidence: 0.9, desc: 'Left running in a room. It records whether anyone is there or not.' },
  { id: 'sage', name: 'Sage Bundle', icon: 'smoke', cleanse: 0.5, desc: 'Smudges dread out of a room, and clears their heads a little.' },
  { id: 'geiger', name: 'Radiation Meter', icon: 'emf', detect: 'power', evidence: 0.5, desc: 'Paranormal teams use it as a crude power detector.' },
  { id: 'firstaid', name: 'Trauma Kit', icon: 'vial', heal: 22, desc: 'Picks an ally back up and gets them walking.' },
  { id: 'exorcism', name: 'Ritual Kit', icon: 'cross', ritual: 'banishing', desc: 'Five candles, a psalm, and twelve minutes to make the house unfriendly forever.' }
];
export const GEAR_BY_ID = Object.fromEntries(GEAR.map(g => [g.id, g]));

/* Nine intruder archetypes.  stats are base 0..1 unless noted. */
export const ARCHETYPES = [
  {
    id: 'thrill_seeker', name: 'Thrill Seeker', role: 'Daredevil',
    blurb: 'Came in for a dare and a video. Scares are the product.',
    palette: { skin: '#d9a06a', hair: '#2b2018', top: '#b8462f', bottom: '#37414f', accent: '#e8d9b0' },
    stats: { nerve: 0.62, curiosity: 0.85, greed: 0.2, faith: 0.15, aggression: 0.35, tech: 0.3, charisma: 0.5, resolve: 0.55 },
    fears: { dolls: 0.85, loss: 0.7, darkness: -0.35, watched: -0.25, blood: 0.25, enclosed: 0.35 },
    traits: ['brave', 'curious', 'performer', 'clumsy'],
    gear: ['phone'], speed: 1.06
  },
  {
    id: 'skeptic', name: 'Skeptic', role: 'Debunker',
    blurb: 'Has a column to fill and a bias to protect. Explains everything, twice.',
    palette: { skin: '#e0b48a', hair: '#4a4a52', top: '#59646f', bottom: '#2f343b', accent: '#d8dee6' },
    stats: { nerve: 0.7, curiosity: 0.7, greed: 0.15, faith: 0.05, aggression: 0.4, tech: 0.6, charisma: 0.45, resolve: 0.72 },
    fears: { watched: 0.35, isolation: 0.3, voices: 0.45, darkness: 0.1, dolls: -0.15, blood: 0.15 },
    traits: ['skeptic', 'careful', 'techy'],
    gear: ['flashlight', 'camera', 'recorder'], speed: 0.98
  },
  {
    id: 'occult_investigator', name: 'Occult Investigator', role: 'Professional Haunt-hunter',
    blurb: 'Twenty years of case files. Wants a clean reading more than a scare.',
    palette: { skin: '#c98f63', hair: '#221d1a', top: '#6b5a45', bottom: '#3a3831', accent: '#cbb894' },
    stats: { nerve: 0.8, curiosity: 0.9, greed: 0.25, faith: 0.4, aggression: 0.35, tech: 0.8, charisma: 0.6, resolve: 0.8 },
    fears: { isolation: 0.45, loss: 0.5, voices: -0.15, darkness: -0.1, watched: 0.2, enclosed: 0.2 },
    traits: ['curious', 'careful', 'techy', 'leader'],
    gear: ['flashlight', 'emf', 'recorder', 'camera', 'tripod_trap'], speed: 0.98
  },
  {
    id: 'night_thief', name: 'Night Thief', role: 'Burglar',
    blurb: 'In and out with the silver. Every locked door is an insult and a bill.',
    palette: { skin: '#b98462', hair: '#151312', top: '#2b2f36', bottom: '#20242a', accent: '#7e6a4b' },
    stats: { nerve: 0.68, curiosity: 0.35, greed: 0.95, faith: 0.1, aggression: 0.7, tech: 0.5, charisma: 0.3, resolve: 0.66 },
    fears: { enclosed: 0.9, isolation: 0.6, voices: 0.35, blood: 0.2, dolls: 0.15, watched: 0.55 },
    traits: ['greedy', 'agile', 'strong', 'nightblind'],
    gear: ['crowbar', 'lockpick', 'headlamp'], speed: 1.1
  },
  {
    id: 'journalist', name: 'Journalist', role: 'Reporter',
    blurb: 'Needs one good quote and one good photograph. Will trade the truth for neither.',
    palette: { skin: '#e6c39c', hair: '#6b3f2a', top: '#94643f', bottom: '#3f4a56', accent: '#eae0cd' },
    stats: { nerve: 0.55, curiosity: 0.85, greed: 0.4, faith: 0.25, aggression: 0.3, tech: 0.55, charisma: 0.7, resolve: 0.6 },
    fears: { watched: 0.5, blood: 0.45, loss: 0.65, darkness: 0.35, isolation: 0.35, voices: 0.4 },
    traits: ['curious', 'anxious', 'leader'],
    gear: ['flashlight', 'camera', 'recorder', 'phone'], speed: 1.0
  },
  {
    id: 'paranormal_streamer', name: 'Paranormal Streamer', role: 'Live Host',
    blurb: 'Chat is watching. A dead hour is a cancelled career, so nothing is too scary.',
    palette: { skin: '#d8a878', hair: '#121218', top: '#3f7f8c', bottom: '#232a33', accent: '#ff4d6d' },
    stats: { nerve: 0.6, curiosity: 0.7, greed: 0.6, faith: 0.3, aggression: 0.2, tech: 0.65, charisma: 0.85, resolve: 0.5 },
    fears: { dolls: 0.6, voices: -0.2, watched: -0.35, darkness: 0.25, loss: 0.45, isolation: 0.2 },
    traits: ['performer', 'brave', 'techy', 'anxious'],
    gear: ['streamrig', 'flashlight', 'spiritbox', 'emf'], speed: 1.0
  },
  {
    id: 'spiritualist_medium', name: 'Spiritualist Medium', role: 'Circle Leader',
    blurb: 'Believes the dead are polite guests. Will sit in the dark until they answer.',
    palette: { skin: '#c9a2b0', hair: '#3a2430', top: '#5d3f66', bottom: '#2a2233', accent: '#c8a86a' },
    stats: { nerve: 0.72, curiosity: 0.65, greed: 0.1, faith: 0.95, aggression: 0.15, tech: 0.3, charisma: 0.8, resolve: 0.85 },
    fears: { blood: -0.4, dolls: 0.25, isolation: -0.3, voices: -0.6, watched: -0.35, darkness: -0.25, enclosed: 0.15 },
    traits: ['devout', 'haunted', 'leader', 'curious'],
    gear: ['spiritbox', 'candles' ,'sage', 'crucifix'], speed: 0.92
  },
  {
    id: 'search_party', name: 'Search Party Volunteer', role: 'Looking For Someone',
    blurb: 'A kid went in and did not come out. They are not leaving without an answer.',
    palette: { skin: '#d3a17c', hair: '#3d2c22', top: '#4e6b3f', bottom: '#33383a', accent: '#e8e2cf' },
    stats: { nerve: 0.66, curiosity: 0.55, greed: 0.05, faith: 0.35, aggression: 0.5, tech: 0.4, charisma: 0.55, resolve: 0.78 },
    fears: { loss: 1.4, blood: 0.7, isolation: 0.55, darkness: 0.3, voices: 0.5, enclosed: 0.4, drowning: 0.35 },
    traits: ['parent', 'careful', 'brave', 'grief'],
    gear: ['headlamp', 'firstaid', 'rope', 'phone'], speed: 1.02
  },
  {
    id: 'exorcist', name: 'Deliverance Minister', role: 'Exorcist',
    blurb: 'Carries a rite that will make this house merely a house.',
    palette: { skin: '#c99b78', hair: '#5a5a5a', top: '#22232b', bottom: '#191a20', accent: '#b89a5e' },
    stats: { nerve: 0.9, curiosity: 0.4, greed: 0.0, faith: 1.0, aggression: 0.45, tech: 0.25, charisma: 0.75, resolve: 0.95 },
    fears: { blood: -0.55, dolls: 0.2, darkness: -0.4, isolation: -0.2, watched: 0.1, voices: -0.35, enclosed: 0.15 },
    traits: ['devout', 'veteran', 'leader', 'strong'],
    gear: ['exorcism', 'crucifix', 'flashlight', 'sage'], speed: 0.95
  },
  {
    id: 'urban_explorer', name: 'Urban Explorer', role: 'Photographer',
    blurb: 'Wants the shot of the covered mirror. Will climb anything for it.',
    palette: { skin: '#e3b591', hair: '#7a2f2f', top: '#7d5a2b', bottom: '#2c3138', accent: '#dfe6ea' },
    stats: { nerve: 0.6, curiosity: 0.95, greed: 0.35, faith: 0.2, aggression: 0.2, tech: 0.6, charisma: 0.4, resolve: 0.55 },
    fears: { dolls: 0.5, enclosed: 0.75, watched: 0.3, darkness: -0.15, loss: 0.4, insects: 0.6 },
    traits: ['agile', 'curious', 'nightblind', 'performer'],
    gear: ['camera', 'headlamp', 'thermal'], speed: 1.08
  }
];
export const ARCH_BY_ID = Object.fromEntries(ARCHETYPES.map(a => [a.id, a]));
/* the medium's candle pack */
GEAR.push({ id: 'candles', name: 'Ritual Candles', icon: 'candles', ritual: 'seance', desc: 'Five-point circle. Gives the circle somewhere to put their fear.' });
export const GEAR_BY_ID_ALL = Object.fromEntries(GEAR.map(g => [g.id, g]));
