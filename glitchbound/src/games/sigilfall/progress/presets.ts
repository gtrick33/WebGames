import { xpToNext } from '../data/classes';
import { isRetired } from '../data/retired';
import { QUEST_DEFS } from '../data/quests';
import { REGIONS } from '../data/regions';
import type { RegionId } from '../data/types';
import { addXp, startQuests, type Character } from './character';

/**
 * Review presets (blueprint Prompt 9 and §14.3): jump a hero straight to a story beat — the story behind it
 * done, the beat itself under way, a level that suits it — so a scene, an event or a world state can be
 * looked at without playing there. Offered on the dev server and with `?review`; a hero who has used one
 * is a review hero from then on and no longer sends scores to the arcade.
 */

export interface Preset {
  id: string;
  label: string;
  region: RegionId;
  /** The quest under way (everything it comes after is done). */
  active?: string;
  /** Quests done as well (with what they come after). */
  done?: string[];
  level: number;
}

export const PRESETS: Preset[] = [
  { id: 'prologue-dusk', label: 'Prologue: dusk at the gate', region: 'briarhollow', active: 'briar-dusk', level: 1 },
  { id: 'prologue-raid', label: 'Prologue: the raid', region: 'briarhollow', active: 'briar-nightfall', level: 3 },
  { id: 'prologue-toll', label: 'Prologue: the bell tolls by itself (scene)', region: 'briarhollow', active: 'briar-nightfall', level: 2 },
  { id: 'prologue-rider', label: 'Prologue: the courier comes up the road (scene)', region: 'briarhollow', active: 'briar-the-rider', level: 3 },
  { id: 'prologue-inn', label: 'Prologue: the inn catches (scene)', region: 'briarhollow', active: 'briar-the-inn', level: 3 },
  { id: 'camp-dawn', label: 'Prologue: dawn, the camp (scene)', region: 'briarhollow', active: 'camp-scouts', level: 7 },
  { id: 'hearthstead', label: 'Act I: the Defense of Hearthstead', region: 'amberfield', active: 'hearth-the-riders-come', level: 17 },
  { id: 'hearth-ram', label: 'Act I: the ram at Hearthstead’s gate', region: 'amberfield', active: 'hearth-the-ram', level: 21 },
  { id: 'hearth-morning', label: 'Act I: Hearthstead the morning after (scene)', region: 'amberfield', active: 'hearth-the-shrine', level: 18 },
  { id: 'lantern-relit', label: 'Act II: Lantern Hill alight (scene)', region: 'ashen-barrows', done: ['the-last-lamp'], level: 26 },
  { id: 'crown-city', label: 'Act II: the Regent (scene)', region: 'emberwick', active: 'the-kings-design', level: 28 },
  { id: 'night-of-knives', label: 'Act II: the Night of Knives', region: 'emberwick', active: 'festival-the-knives', level: 29 },
  { id: 'after-knives', label: 'Act II: the morning after (scene)', region: 'emberwick', active: 'festival-the-catacombs', level: 29 },
  { id: 'the-tear', label: 'Act III: the Pale Herald at the Tear', region: 'shattered-vale', active: 'the-heralds-ambush', level: 40 },
  { id: 'fernstead-falls', label: 'Act III: Fernstead’s people come in', region: 'briarhollow', active: 'fall-of-fernstead', level: 40 },
  { id: 'elyra-gone', label: 'Act III: Elyra taken (scene)', region: 'briarhollow', active: 'fern-retaken', level: 41 },
  { id: 'fern-again', label: 'Act III: Fernstead taken back', region: 'brackenridge', active: 'fern-retaken', level: 41 },
  { id: 'fern-home', label: 'Act III: Fernstead home again (scene)', region: 'brackenridge', done: ['fern-retaken'], level: 42 },
  { id: 'highwall', label: 'Act IV: Highwall’s relief', region: 'highwall', active: 'mara-commands', level: 44 },
  { id: 'the-sortie', label: 'Act IV: the sortie from Highwall', region: 'highwall', active: 'cael-the-sortie', level: 44 },
  { id: 'highwall-holds', label: 'Act IV: Highwall holds (scene)', region: 'briarhollow', done: ['the-long-night-ends'], level: 48 },
  { id: 'nyx-returns', label: 'Act IV: Nyx comes back (scene)', region: 'highwall', active: 'gate-the-prison-map', level: 44 },
  { id: 'gloam-cells', label: 'Act IV: the cells under the Gloam Gate', region: 'riftscar', active: 'gloam-the-cells', level: 47 },
  { id: 'elyra-free', label: 'Act IV: Elyra out of the dark (scene)', region: 'riftscar', active: 'the-gatewarden', level: 48 },
  { id: 'muster-hall', label: 'Act IV: the field before the Muster Hall', region: 'bonefields', active: 'muster-the-field', level: 50 },
  { id: 'ysane-echo', label: 'Act V: the queen at the door (scene)', region: 'weeping-woods', active: 'wood-the-children', level: 49 },
  { id: 'fireships', label: 'Act V: the fireships', region: 'sunken-reaches', active: 'the-fireships', level: 51 },
  { id: 'orren-shore', label: 'Act V: the lake answers Orren', region: 'hollowmere', active: 'orren-on-the-shore', level: 55 },
  { id: 'every-banner', label: 'Act VI: every banner comes in', region: 'pale-reach', active: 'the-last-road', level: 56 },
  { id: 'last-march', label: 'Act VI: every banner (scene)', region: 'pale-reach', active: 'march-vosk', level: 58 },
  { id: 'siege-mages', label: 'Act VI: the siege mages before the wall', region: 'pale-reach', active: 'march-the-siege-mages', level: 58 },
  { id: 'keep-the-door', label: 'Act VI: Mara keeps the door (scene)', region: 'pale-reach', active: 'the-duskspire-gate', level: 59 },
  { id: 'crownfall-throne', label: 'Crownfall: the throne', region: 'duskspire', active: 'the-hollow-king', level: 60 },
  { id: 'crownfall-memory', label: 'Crownfall: Vaelmoor whole (scene)', region: 'vaelmoor-remembered', active: 'crownfall-vaelmoor', level: 60 },
  { id: 'crownfall-ash-crown', label: 'Crownfall: the Ash Crown', region: 'vaelmoor-remembered', active: 'crownfall-the-ash-crown', done: ['crownfall-break-it'], level: 60 },
  { id: 'the-bell', label: 'Epilogue: the bell (scene)', region: 'briarhollow', active: 'epilogue-the-bell', level: 60 },
  { id: 'mythic-plus', label: 'Postgame: the Riftstone (+1)', region: 'briarhollow', done: ['postgame-crownfall-mythic'], level: 60 },
  { id: 'v3-embers', label: 'Prologue: the first vision, the star (scene)', region: 'briarhollow', active: 'the-empty-tomb', level: 6 },
  { id: 'v3-wood', label: 'Prologue: the Whisperwood trail (scene)', region: 'whisperwood', active: 'into-the-wood', level: 5 },
  { id: 'v3-fern-candles', label: 'Act I: Fernstead’s candles (scene)', region: 'brackenridge', active: 'west-road', level: 6 },
  { id: 'v3-fern-barrows', label: 'Act I: the Old Barrows wake (scene)', region: 'brackenridge', active: 'the-old-barrows', level: 7 },
  { id: 'v3-fern-lady', label: 'Act I: the Grey Lady’s song (scene)', region: 'brackenridge', active: 'lay-the-grey-lady', level: 8 },
  { id: 'v3-fern-stones', label: 'Act I: the Grey Lady at rest (scene)', region: 'brackenridge', active: 'the-harvest-stones', level: 8 },
  { id: 'v3-fern-scouts', label: 'Act I: the Harvest Stones lit (scene)', region: 'brackenridge', active: 'camp-scouts', level: 9 },
  { id: 'v3-mill', label: 'Act I: Millbrook’s bridge (scene)', region: 'thornvale', active: 'south-road', level: 8 },
  { id: 'v3-mill-kettle', label: 'Act I: Kettle Farm (scene)', region: 'thornvale', active: 'kettle-farm', level: 9 },
  { id: 'v3-mill-nyx', label: 'Act I: Nyx reads the orders (scene)', region: 'thornvale', active: 'thieves-cant', level: 10 },
  { id: 'v3-mill-bridge', label: 'Act I: the mill, after Harlan (scene)', region: 'thornvale', active: 'mill-the-bridge', level: 12 },
  { id: 'v3-mill-wheel', label: 'Act I: the mill wheel turns (scene)', region: 'thornvale', active: 'hollow-gold', level: 13 },
  { id: 'v3-hearth', label: 'Act I: Hearthstead (scene)', region: 'amberfield', active: 'refugees-on-the-road', level: 16 },
  { id: 'v3-hearth-caravan', label: 'Act I: the broken caravan (scene)', region: 'amberfield', active: 'the-broken-caravan', level: 16 },
  { id: 'v3-hearth-captain', label: 'Act I: the captain on the ridge (scene)', region: 'amberfield', active: 'riders-in-the-grass', level: 17 },
  { id: 'v3-hearth-stones', label: 'Act I: the Clan Stones remember (scene)', region: 'amberfield', active: 'the-clan-stones', level: 18 },
  { id: 'v3-hearth-sigil', label: 'Act I: the Sigil of Stone taken (scene)', region: 'amberfield', active: 'hearth-the-shrine', level: 21 },
  { id: 'v3-hearth-orders', label: 'Act I: Vosk’s orders read (scene)', region: 'amberfield', active: 'camp-riders', level: 21 },
  { id: 'v3-lantern-the-lamps-dim', label: 'Act II: the lamps go out (scene)', region: 'ashen-barrows', active: 'the-lanterns-dim', level: 22 },
  { id: 'v3-lantern-orren', label: 'Act II: the last chapel (scene)', region: 'ashen-barrows', active: 'orren-the-last-chapel', level: 23 },
  { id: 'v3-lantern-wat', label: 'Act II: a man called Wat (scene)', region: 'ashen-barrows', active: 'cael-the-hostel', level: 25 },
  { id: 'v3-lantern-the-mound', label: 'Act II: the Kings’ Mound (scene)', region: 'ashen-barrows', active: 'the-kings-mound', level: 26 },
  { id: 'v3-lantern-the-barrow-king', label: 'Act II: the mound stands open (scene)', region: 'ashen-barrows', active: 'the-barrow-king', level: 27 },
  { id: 'v3-barrow-corvane', label: 'Act II: Sir Corvane counting (scene)', region: 'barrow-of-kings', active: 'sir-corvane', level: 28 },
  { id: 'v3-lantern-the-order', label: 'Act II: the countermanded order (scene)', region: 'ashen-barrows', active: 'the-kings-design', level: 28 },
  { id: 'v3-ember-the-ledgers', label: 'Act II: the treasury ledgers (scene)', region: 'emberwick', active: 'city-the-treasury', level: 28 },
  { id: 'v3-ember-the-roads', label: 'Act II: the roads office (scene)', region: 'emberwick', active: 'city-the-roads-office', level: 28 },
  { id: 'v3-ember-the-festival', label: 'Act II: the Starfall Festival (scene)', region: 'emberwick', active: 'festival-the-lanterns', level: 29 },
  { id: 'v3-ember-the-stair', label: 'Act II: the stair under Crane’s house (scene)', region: 'emberwick', active: 'festival-the-catacombs', level: 30 },
  { id: 'v3-ember-the-map', label: 'Act II: the wardens’ map (scene)', region: 'emberwick', active: 'festival-the-champion', level: 30 },
  { id: 'v3-sun-the-oasis', label: 'Act III: the Oasis of Ras (scene)', region: 'sunscorch', active: 'the-sun-kings-tomb', level: 30 },
  { id: 'v3-sun-the-sandscribe', label: 'Act III: the sandscribe reads (scene)', region: 'sunscorch', active: 'the-sandscribe', level: 31 },
  { id: 'v3-sun-the-obelisk', label: 'Act III: the Fallen Obelisk (scene)', region: 'sunscorch', active: 'the-fallen-obelisk', level: 31 },
  { id: 'v3-sun-the-dig', label: 'Act III: the Ashen Dig (scene)', region: 'sunscorch', active: 'the-hollow-dig', level: 32 },
  { id: 'v3-sun-the-gate', label: 'Act III: the Sunken Gate (scene)', region: 'sunscorch', active: 'the-sunken-gate', level: 33 },
  { id: 'v3-tomb-the-warden', label: 'Act III: the Sand Warden (scene)', region: 'tomb-of-the-sun-king', active: 'the-sand-warden', level: 33 },
  { id: 'v3-tomb-the-sun-king', label: 'Act III: the Sun King wakes (scene)', region: 'tomb-of-the-sun-king', active: 'the-sun-king', level: 34 },
  { id: 'v3-vision-sun', label: 'Act III: the Sun’s vision, the plague ship (scene)', region: 'sunscorch', active: 'the-fading-lights', level: 34 },
  { id: 'v3-glimmer-the-glade', label: 'Act III: Lumen Glade (scene)', region: 'glimmerwood', active: 'the-fading-lights', level: 34 },
  { id: 'v3-glimmer-the-ring', label: 'Act III: the Withered Ring (scene)', region: 'glimmerwood', active: 'the-withered-ring', level: 34 },
  { id: 'v3-glimmer-the-pavilion', label: 'Act III: the Pale Pavilion (scene)', region: 'glimmerwood', active: 'the-pale-pavilion', level: 35 },
  { id: 'v3-glimmer-the-court', label: 'Act III: the Thorn Court (scene)', region: 'glimmerwood', active: 'the-thorn-court', level: 36 },
  { id: 'v3-vision-thorns', label: 'Act III: the Thorns’ vision, the broken crown (scene)', region: 'glimmerwood', active: 'the-clans-decide', level: 36 },
  { id: 'v3-glimmer-the-clans', label: 'Act III: the clans decide (scene)', region: 'glimmerwood', active: 'the-clans-decide', level: 36 },
  { id: 'v3-rime-frostgate', label: 'Act III: Frostgate (scene)', region: 'rimeheld', active: 'the-frozen-road', level: 36 },
  { id: 'v3-rime-the-hearth', label: 'Act III: the Giants’ Hearth (scene)', region: 'rimeheld', active: 'the-giants-hearth', level: 36 },
  { id: 'v3-rime-the-door', label: 'Act III: the Vault Door (scene)', region: 'rimeheld', active: 'the-vault-door', level: 36 },
  { id: 'v3-vault-the-traitor', label: 'Act III: Jarl Hrimfang (scene)', region: 'rimeheld-vault', active: 'the-traitor-jarl', level: 37 },
  { id: 'v3-vault-the-wyrm', label: 'Act III: the Rime Wyrm (scene)', region: 'rimeheld-vault', active: 'the-vault-of-rime', level: 38 },
  { id: 'v3-vision-frost', label: 'Act III: the Frost’s vision, the eight wardens (scene)', region: 'rimeheld', active: 'where-the-rift-bleeds', level: 38 },
  { id: 'v3-vale-shardwatch', label: 'Act III: Shardwatch (scene)', region: 'shattered-vale', active: 'where-the-rift-bleeds', level: 38 },
  { id: 'v3-vale-the-singers', label: 'Act III: the breach camp (scene)', region: 'shattered-vale', active: 'the-breach-camp', level: 38 },
  { id: 'v3-vale-the-cipher', label: 'Act III: Nyx reads the cipher (scene)', region: 'shattered-vale', active: 'the-heralds-cipher', level: 38 },
  { id: 'v3-vale-the-lip', label: 'Act III: the lip of the Tear (scene)', region: 'shattered-vale', active: 'the-tear', level: 39 },
  { id: 'v3-vale-after-the-herald', label: 'Act III: Elyra is gone (scene)', region: 'shattered-vale', active: 'the-heart-of-the-tear', level: 40 },
  { id: 'v3-vale-the-crack', label: 'Act III: the Tear closing (scene)', region: 'shattered-vale', active: 'fall-of-fernstead', level: 40 },
  { id: 'v3-briar-fernstead-burns', label: 'Act III: Fernstead’s smoke (scene)', region: 'briarhollow', active: 'fall-of-fernstead', level: 40 },
  { id: 'v3-fern-ours', label: 'Act IV: Fernstead is ours (scene)', region: 'brackenridge', active: 'the-wall-burns', level: 40 },
  { id: 'v3-highwall-the-camp', label: 'Act IV: the relief camp (scene)', region: 'highwall', active: 'the-wall-burns', level: 40 },
  { id: 'v3-highwall-the-captain', label: 'Act IV: the captain of the relief (scene)', region: 'highwall', active: 'mara-commands', level: 40 },
  { id: 'v3-highwall-ashby', label: 'Act IV: the ashes of Ashby (scene)', region: 'highwall', active: 'ashes-of-ashby', level: 41 },
  { id: 'v3-highwall-the-map', label: 'Act IV: the Herald’s map (scene)', region: 'highwall', active: 'gate-the-prison-map', level: 44 },
  { id: 'v3-highwall-the-breach', label: 'Act IV: the Breach (scene)', region: 'highwall', active: 'the-breach', level: 44 },
  { id: 'v3-siege-the-breaker', label: 'Act IV: the Siege-Breaker (scene)', region: 'siege-of-highwall', active: 'the-siege-breaker', level: 44 },
  { id: 'v3-siege-morvain', label: 'Act IV: General Morvain (scene)', region: 'siege-of-highwall', active: 'general-morvain', level: 44 },
  { id: 'v3-highwall-relieved', label: 'Act IV: the first gate (scene)', region: 'highwall', active: 'the-long-night-ends', level: 44 },
  { id: 'v3-gloam-lastlight', label: 'Act IV: Lastlight (scene)', region: 'riftscar', active: 'gloam-the-lamp-road', level: 44 },
  { id: 'v3-gloam-the-dark-mile', label: 'Act IV: the unlit mile (scene)', region: 'riftscar', active: 'gloam-the-unlit-mile', level: 44 },
  { id: 'v3-gloam-the-jetty', label: 'Act IV: Nyx on the jetty (scene)', region: 'riftscar', active: 'gloam-nyx-confesses', level: 46 },
  { id: 'v3-vision-veil', label: 'Act IV: the Veil’s vision, the eighth warden (scene)', region: 'riftscar', active: 'gloam-the-gate', level: 46 },
  { id: 'v3-gloam-the-gatewarden', label: 'Act IV: the Gatewarden (scene)', region: 'riftscar', active: 'the-gatewarden', level: 48 },
  { id: 'v3-gloam-the-fire', label: 'Act IV: by Brin’s fire (scene)', region: 'riftscar', active: 'the-gloam-gate', level: 48 },
  { id: 'v3-wood-into-vaelmoor', label: 'Act V: into Vaelmoor (scene)', region: 'weeping-woods', active: 'into-vaelmoor', level: 48 },
  { id: 'v3-wood-candlewick', label: 'Act V: Candlewick (scene)', region: 'weeping-woods', active: 'the-candle-road', level: 48 },
  { id: 'v3-wood-the-rest', label: 'Act V: the Wardens’ Rest (scene)', region: 'weeping-woods', active: 'the-wardens-rest', level: 49 },
  { id: 'v3-wood-the-hollow', label: 'Act V: Lark’s Hollow (scene)', region: 'weeping-woods', active: 'the-frozen-hamlet', level: 49 },
  { id: 'v3-wood-the-tree', label: 'Act V: the Weeping Tree (scene)', region: 'weeping-woods', active: 'the-weeping-tree', level: 50 },
  { id: 'v3-wood-the-lord', label: 'Act V: the Weeping Lord (scene)', region: 'weeping-woods', active: 'the-weeping-lord', level: 50 },
  { id: 'v3-wood-at-rest', label: 'Act V: the wood at rest (scene)', region: 'weeping-woods', active: 'the-pale-crown', level: 51 },
  { id: 'v3-ember-cinderhold', label: 'Act V: Cinderhold (scene)', region: 'emberdeep', active: 'the-pale-crown', level: 51 },
  { id: 'v3-ember-the-forges', label: 'Act V: the Slave Forges (scene)', region: 'emberdeep', active: 'forges-on-the-rim', level: 51 },
  { id: 'v3-ember-the-reading', label: 'Act V: Dvalin reads the moulds (scene)', region: 'emberdeep', active: 'dvalins-reading', level: 52 },
  { id: 'v3-ember-the-chains', label: 'Act V: break the chains (scene)', region: 'emberdeep', active: 'break-the-chains', level: 52 },
  { id: 'v3-ember-the-throne-gate', label: 'Act V: the Throne’s Gate (scene)', region: 'emberdeep', active: 'the-throne-gate', level: 52 },
  { id: 'v3-throne-the-warden', label: 'Act V: the Magma Warden (scene)', region: 'molten-throne', active: 'the-magma-warden', level: 53 },
  { id: 'v3-throne-ashkar', label: 'Act V: Ashkar the Bound (scene)', region: 'molten-throne', active: 'ashkar-the-bound', level: 53 },
  { id: 'v3-ember-the-voice', label: 'Act V: a voice in the fire (scene)', region: 'emberdeep', active: 'the-dead-lake', level: 53 },
  { id: 'v3-mere-the-ferryman', label: 'Act V: the Ferryman (scene)', region: 'hollowmere', active: 'the-dead-lake', level: 53 },
  { id: 'v3-mere-the-shore', label: 'Act V: the restless shore (scene)', region: 'hollowmere', active: 'the-restless-shore', level: 53 },
  { id: 'v3-mere-the-causeway', label: 'Act V: across the mere (scene)', region: 'hollowmere', active: 'across-the-mere', level: 55 },
  { id: 'v3-mere-the-lich', label: 'Act V: the Lich of Hollowmere (scene)', region: 'hollowmere', active: 'the-necropolis', level: 55 },
  { id: 'v3-vision-tides', label: 'Act V: the Tides’ vision, let me go (scene)', region: 'hollowmere', active: 'ysanes-last-echo', level: 56 },
  { id: 'v3-reach-dawns-rest', label: 'Act VI: Dawn’s Rest (scene)', region: 'pale-reach', active: 'the-last-march', level: 56 },
  { id: 'v3-reach-vosk', label: 'Act VI: Vosk at the head of the Host (scene)', region: 'pale-reach', active: 'march-vosk', level: 58 },
  { id: 'v3-vision-stone', label: 'Act VI: the Stone’s vision, two kings (scene)', region: 'pale-reach', active: 'the-seventh-sigil', level: 58 },
  { id: 'v3-reach-the-voice', label: 'Act VI: the voice in the gate (scene)', region: 'pale-reach', active: 'march-the-voice', level: 59 },
  { id: 'v3-dusk-the-guard', label: 'Act VI: Ser Maltheus (scene)', region: 'duskspire', active: 'the-hollow-guard', level: 59 },
  { id: 'v3-dusk-the-king', label: 'Act VI: the Hallow King (scene)', region: 'duskspire', active: 'the-hollow-king', level: 60 },
  { id: 'v3-memory-the-crown', label: 'Crownfall: the Ash Crown (scene)', region: 'vaelmoor-remembered', active: 'crownfall-the-ash-crown', level: 60 },
  { id: 'v3-fern-alsa-hums', label: 'Act I: Mother Alsa hums (scene)', region: 'brackenridge', active: 'the-widows-song', level: 7 },
  { id: 'v3-gallows-harlan', label: 'Act I: Harlan Blackglove (scene)', region: 'gallows-keep', active: 'the-bandit-king', level: 11 },
  { id: 'v3-briar-ash-gold', label: 'Act I: the ash-gold (scene)', region: 'briarhollow', active: 'hollow-gold', level: 13 },
  { id: 'v3-briar-the-letter', label: 'Act I: the courier’s letter (scene)', region: 'briarhollow', active: 'the-regents-council', level: 14 },
  { id: 'v3-hearth-the-bone-case', label: 'Act I: the bone case (scene)', region: 'amberfield', active: 'orders-from-the-north', level: 20 },
  { id: 'v3-reach-seven-locks', label: 'Act VI: the seven locks (scene)', region: 'pale-reach', active: 'the-duskspire-gate', level: 59 },
];

// (a retired land's beats, and a beat whose quest is gone, are gone from the list)
for (let i = PRESETS.length - 1; i >= 0; i--) {
  const p = PRESETS[i]!;
  if (isRetired(p.region) || (p.active && !QUEST_DEFS[p.active]) || (p.done ?? []).some((q) => !QUEST_DEFS[q])) PRESETS.splice(i, 1);
}

/** Puts a hero at a preset's beat: its story done, the beat under way, raised to its level, its lands open. */
export function applyPreset(c: Character, p: Preset): void {
  const done = (id: string): void => {
    const q = QUEST_DEFS[id];
    if (!q || c.quests[id]?.state === 'done') return;
    for (const a of q.after ?? []) done(a);
    // a choice already answered another way stays as it is; otherwise the beat counts as played
    if (!q.choice || !Object.values(QUEST_DEFS).some((o) => o.choice === q.choice && o.id !== id && c.quests[o.id]?.state === 'done')) c.quests[id] = { state: 'done', n: 1 };
  };
  for (const id of p.done ?? []) done(id);
  if (p.active) {
    for (const a of QUEST_DEFS[p.active]?.after ?? []) done(a);
    c.quests[p.active] = { state: 'active', n: 0 };
  }
  for (let guard = 0; c.level < p.level && guard < 100; guard++) addXp(c, xpToNext(c.level));
  for (const r of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(r) && REGIONS[r].levels[0] <= c.level + 2) c.unlocked.push(r);
  if (!c.unlocked.includes(p.region)) c.unlocked.push(p.region);
  // the scenes of the beat play again
  c.opened = c.opened.filter((o) => !o.startsWith('scene:'));
  // the story's gifts that the beats done would have paid (the tier, the Riftstone)
  for (const [id, e] of Object.entries(c.quests)) {
    const r = e.state === 'done' ? QUEST_DEFS[id]?.reward : undefined;
    if (r?.tier !== undefined) c.tier = Math.max(c.tier, r.tier);
    if (r?.keystone) c.keystone = Math.max(c.keystone, r.keystone);
  }
  c.review = true;
  startQuests(c);
}
