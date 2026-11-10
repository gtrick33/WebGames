import { after, all, during, is, not, until } from './cond';
import { EVENTS } from './events';
import { QUEST_DEFS } from './quests';
import { isRetired } from './retired';
import type { SceneDef } from '../sim/scene';
import { STORY_SCENES } from './scenes-story';

/**
 * The story's staged beats (sim/scene.ts): a few seconds each, in the world, at the moments the story
 * turns. Each one only stages what the markers already say — who stands where comes from the region —
 * and plays once. The last of them are shots that open the story's fights and arrivals (`opens`): a title
 * and the battle line for the great ones, a few seconds each its own way for the rest (the thing to hold,
 * the people to save, the column walking in).
 */
export const SCENES: SceneDef[] = [
  {
    // the first dawn after the raid: the village alive in its square, and a camp now
    id: 'briar-dawn',
    region: 'briarhollow',
    // only that first morning: once Act I is under way (the orders from the north read) it has passed
    when: all(after('the-empty-tomb'), until('camp-scouts'), until('orders-from-the-north')),
    near: 'briar-square',
    // (from further out than the rangers' arrival begins: Maren speaks first, then they walk in)
    r: 340,
    steps: [
      { look: 'briar-square' },
      { say: 'maren', line: 'Look at them. Every soul in Briarhollow, alive, in one square. I counted twice.' },
      { look: 'elyra' },
      { emote: 'elyra', icon: 'heart' },
      { say: 'elyra', line: 'Thessa says I talk too much when I’m frightened. I’m not frightened anymore. Mostly.' },
      { look: 'Chapel of the Bell' },
      { say: 'old-haldor', line: 'She rang three times last night, and no hand on the rope. Quiet again now. But listening. I can feel it.' },
      { look: 'hero' },
      { say: 'maren', line: 'This is a camp now. And a camp needs someone to go and bring the others in.' },
    ],
  },
  {
    // the Prologue: the gate has held, and the chapel bell nobody has rung in three weeks tolls by itself;
    // the roofs catch, the chapel's side first, then the east wall's, where the Host came over
    id: 'briar-the-toll',
    region: 'briarhollow',
    when: during('briar-nightfall'),
    near: 'briar-gate',
    r: 220,
    steps: [
      { wait: 0.6 },
      { sfx: 'bell-toll' },
      { shake: 4 },
      { look: 'Chapel of the Bell' },
      { wait: 2.4 },
      { sfx: 'bell-toll' },
      { shake: 3 },
      { look: 'briar-east-roofs' },
      { wait: 2.6 },
      { look: 'hero' },
      { say: 'mara', line: 'The chapel bell. Nobody has touched that rope in three weeks.' },
      { sfx: 'bell-toll' },
      { say: 'mara', line: 'And that’s fire. They came over the east wall while we held the gate. The square, with me!' },
    ],
  },
  {
    // the courier coming up the road out of the dark, the last of it on foot, carrying his light: the camera
    // stays on him through the gate to where he falls, and on him there
    id: 'briar-the-rider-comes',
    region: 'briarhollow',
    when: during('briar-the-rider'),
    // (inside his arrival's six tiles, so he is on the road when the camera looks)
    near: 'briar-gate',
    r: 88,
    steps: [{ look: 'briar-road' }, { wait: 1.6 }, { follow: 'courier', secs: 16 }, { look: 'briar-courier-falls' }, { wait: 2.6 }, { look: 'hero' }],
  },
  {
    // the courier dead in the gateway, his seal in the hero's hand: and behind them the inn's roof catches
    id: 'briar-the-inn-catches',
    region: 'briarhollow',
    when: during('briar-the-inn'),
    near: 'briar-gate',
    r: 160,
    steps: [{ wait: 1.8 }, { look: 'The Bramble & Barrel' }, { sfx: 'roar' }, { wait: 3 }, { look: 'hero' }],
  },
  {
    // the Crown City's keep, the first time the hero comes up the avenue to it: the camera climbs it, a horn
    id: 'ember-the-keep',
    region: 'emberwick',
    when: not(during('festival-the-knives')),
    near: 'regent-elowen',
    r: 200,
    steps: [{ look: 'The Ember Keep' }, { title: 'The Ember Keep', sub: 'Seat of the Regents of Aster' }, { sfx: 'warhorn' }, { wait: 3 }, { look: 'hero' }],
  },
  {
    // the Crown City: the Regent meets the hero with the countermanded order, the Chancellor at her side
    id: 'ember-the-regent',
    region: 'emberwick',
    when: during('the-kings-design'),
    near: 'regent-elowen',
    r: 120,
    steps: [
      { look: 'regent-elowen' },
      { say: 'regent-elowen', line: 'The Vale’s champion. Your letters arrive a day before you do.' },
      { emote: 'chancellor-crane', icon: 'dots' },
      { say: 'chancellor-crane', line: 'And exaggerate, Highness. Letters always do. It is what they are for.' },
      { say: 'regent-elowen', line: 'Then let us find out which parts.' },
      { look: 'cael-varrow' },
      { say: 'cael-varrow', line: 'Give her the paper. Before he sees what it is.' },
      { look: 'hero' },
    ],
  },
  {
    // the morning after the Night of Knives: the Regent at the Chancellor's empty door
    id: 'ember-after-knives',
    region: 'emberwick',
    when: all(after('festival-the-knives'), until('festival-the-champion')),
    near: 'regent-elowen',
    r: 120,
    steps: [
      { look: 'The Chancellor’s House' },
      { wait: 0.6 },
      { look: 'regent-elowen' },
      { say: 'regent-elowen', line: 'Nine years at my right hand. I never once asked him where the road money went.' },
      { emote: 'regent-elowen', icon: 'dots' },
      { say: 'regent-elowen', line: 'I am asking now. Find out what is under his house.' },
      { look: 'hero' },
    ],
  },
  {
    // the Herald has taken Elyra: her teacher alone in the camp
    id: 'briar-elyra-gone',
    region: 'briarhollow',
    when: all(after('the-heralds-ambush'), not(after('fern-retaken')), until('gloam-out-of-the-cells')),
    near: 'herbwife-thessa',
    r: 130,
    steps: [
      { look: 'herbwife-thessa' },
      { emote: 'herbwife-thessa', icon: 'dots' },
      { say: 'herbwife-thessa', line: 'She left her satchel on my table. Packed for three days. She always packs for three days.' },
      { move: 'mara-venn', to: 'herbwife-thessa' },
      { say: 'mara-venn', line: 'Then she means to come back. We’ll make sure there’s a way.' },
      { look: 'hero' },
    ],
  },
  {
    // Highwall held: Haldor at the chapel door, not yet ringing the bell
    id: 'briar-highwall-holds',
    region: 'briarhollow',
    when: all(after('the-long-night-ends'), until('epilogue-the-camp-goes-home')),
    near: 'old-haldor',
    r: 140,
    steps: [
      { look: 'Chapel of the Bell' },
      { move: 'old-haldor', to: 'briar-chapel' },
      { emote: 'old-haldor', icon: 'note' },
      { say: 'old-haldor', line: 'Not yet, old girl. Not yet. But soon. I’ll ring you myself when it’s over.' },
      { look: 'hero' },
    ],
  },
  {
    // Act I: the morning after the Defense of Hearthstead, the gate still standing and the shrine dark
    id: 'hearth-morning',
    region: 'amberfield',
    when: during('hearth-the-shrine'),
    near: 'hearth-square',
    r: 150,
    steps: [
      { look: 'hearth-gate' },
      { say: 'marshal-dunmore', line: 'The gate held. I didn’t think it would. I’ve stopped telling people that.' },
      { look: 'tess-hearthkeeper' },
      { emote: 'tess-hearthkeeper', icon: 'dots' },
      { say: 'tess-hearthkeeper', line: 'The shrine fire went out in the night. Not blown out. Taken. Come and look.' },
      { look: 'hero' },
    ],
  },
  {
    // Act II: the great lamp of Lantern Hill alight again
    id: 'lantern-relit',
    region: 'ashen-barrows',
    when: all(after('the-last-lamp'), until('sir-corvane')),
    near: 'lantern-hill',
    r: 160,
    steps: [
      { look: 'lantern-hill' },
      { emote: 'lamplighter-ivo', icon: 'heart' },
      { say: 'lamplighter-ivo', line: 'Look at it. Forty years I trimmed that wick and never once saw it from the road.' },
      { say: 'sister-maud', line: 'The dead see it too. Tonight they will stay where they are.' },
      { look: 'hero' },
    ],
  },
  {
    // Act III: Fernstead taken back, its people home in their own square
    id: 'fern-home',
    region: 'brackenridge',
    when: after('fern-retaken'),
    near: 'fern-square',
    r: 160,
    steps: [
      { look: 'fern-square' },
      { say: 'warden-hollis', line: 'Home. They left their banners on our roofs. We’ll burn them on the Harvest Stones tonight.' },
      { emote: 'pip-tanner', icon: 'alert' },
      { say: 'pip-tanner', line: 'My room’s still there! Something slept in my bed. A skeleton. I’m keeping the bed.' },
      { say: 'mother-alsa', line: 'Then you’re washing it first, Pip.' },
      { look: 'hero' },
    ],
  },
  {
    // Act IV: Nyx back in Mara's camp under a white rag, the Herald's map under her arm
    id: 'highwall-nyx-returns',
    region: 'highwall',
    when: all(after('gate-nyx-returns'), until('gate-the-prison-map')),
    near: 'nyx-returned',
    r: 140,
    steps: [
      { look: 'nyx-returned' },
      { emote: 'captain-mara', icon: 'alert' },
      { say: 'captain-mara', line: 'You sold her. You sold Elyra to that thing, and you walk into my camp asking for soup.' },
      { emote: 'nyx-returned', icon: 'dots' },
      { say: 'nyx-returned', line: 'I didn’t ask for soup. You gave me soup. I brought his map. Look at it before you hit me.' },
      { say: 'captain-mara', line: 'I’ll look. Then I’ll decide.' },
      { look: 'hero' },
    ],
  },
  {
    // Act IV: Elyra out of the Gloam Gate's cells, by Lastlight's fire
    id: 'gloam-elyra-free',
    region: 'gloamhollow',
    when: all(after('gloam-out-of-the-cells'), until('the-gloam-gate')),
    near: 'elyra-lastlight',
    r: 140,
    steps: [
      { look: 'elyra-lastlight' },
      { say: 'elyra-lastlight', line: 'It’s warm. Everything is warm. I forgot things could be warm.' },
      { move: 'wren', to: 'elyra-lastlight' },
      { say: 'wren', line: 'Brin says you have to drink this. All of it. She says it’s soup. It isn’t soup.' },
      { emote: 'nyx-lastlight', icon: 'dots' },
      { say: 'nyx-lastlight', line: 'Elyra. I’m sorry. I know that isn’t worth anything. I’m saying it anyway.' },
      { emote: 'elyra-lastlight', icon: 'heart' },
      { say: 'elyra-lastlight', line: 'You came back for me. That’s worth something. Sit down, you’re blocking the fire.' },
      { look: 'hero' },
    ],
  },
  {
    // Act V: Lark's Hollow, the first of Queen Ysane's echoes, calling her children in from the snow
    id: 'wood-ysane-echo',
    region: 'weeping-woods',
    when: all(after('the-frozen-hamlet'), until('wood-the-children')),
    near: 'echo-of-ysane',
    r: 140,
    steps: [
      { look: 'echo-of-ysane' },
      { say: 'echo-of-ysane', line: 'Aldis! Wenna! Come in now, it’s snowing. Your father will be home by morning.' },
      { wait: 0.8 },
      { say: 'echo-of-ysane', line: 'He went to get the star. For the fever. He promised.' },
      { look: 'hollow-wood' },
      { say: 'orren-in-vaelmoor', line: 'She has said that every night for three hundred years. They are still out there. Go and bring them home.' },
      { look: 'hero' },
    ],
  },
  {
    // Act VI: every banner the hero earned, coming into Dawn's Rest
    id: 'reach-the-banners',
    region: 'pale-reach',
    when: all(after('the-last-road'), until('march-vosk')),
    near: 'mara-at-the-reach',
    r: 150,
    steps: [
      { look: 'reach-camp' },
      { say: 'mara-at-the-reach', line: 'I stopped counting. There are more banners in this camp than there were people in Briarhollow.' },
      { look: 'cael-at-the-reach' },
      { say: 'cael-at-the-reach', line: 'Ten years ago I was told relief wasn’t coming. Look at it. Look at all of it.' },
      { emote: 'nyx-at-the-reach', icon: 'note' },
      { say: 'nyx-at-the-reach', line: 'I’ve stolen from at least four of these flags. They don’t seem to mind today.' },
      { say: 'orren-at-the-reach', line: 'Every one of them is somebody you went back for. Remember that when it gets loud.' },
      { look: 'hero' },
    ],
  },
  {
    // Act VI: before the gate, Mara stays to keep the door
    id: 'reach-the-door',
    region: 'pale-reach',
    when: all(after('march-the-voice'), until('the-duskspire-gate')),
    near: 'mara-at-the-reach',
    r: 150,
    steps: [
      { look: 'mara-at-the-reach' },
      { say: 'mara-at-the-reach', line: 'Somebody has to keep the door. I always do. Bring her back out.' },
      { move: 'elyra-at-the-reach', to: 'mara-at-the-reach' },
      { say: 'elyra-at-the-reach', line: 'Seven locks, seven lights. I can feel the door from here. It’s waiting for us.' },
      { emote: 'mara-at-the-reach', icon: 'heart' },
      { look: 'hero' },
    ],
  },
  {
    // Crownfall: the Crown's memory of Vaelmoor, whole and beautiful
    id: 'memory-the-square',
    region: 'vaelmoor-remembered',
    when: is('crownfall-vaelmoor', 'active'),
    near: 'elyra-in-the-memory',
    r: 160,
    steps: [
      { look: 'memory-square' },
      { say: 'vaelmoor-herald-boy', line: 'A star has fallen in the north! The King rides at dawn to see it!' },
      { look: 'echo-of-ysane-whole' },
      { say: 'echo-of-ysane-whole', line: 'Aldis, leave the cake alone. Your father will be home by supper.' },
      { look: 'vaelor-remembered' },
      { say: 'vaelor-remembered', line: 'I am home. I am home. Why can none of them see me?' },
      { look: 'elyra-in-the-memory' },
      { say: 'elyra-in-the-memory', line: 'This is what he wanted back. It’s beautiful. Come here. I have to ask you something.' },
      { look: 'hero' },
    ],
  },
  {
    // the Epilogue: Old Haldor rings the bell at last
    id: 'briar-the-bell',
    region: 'briarhollow',
    when: is('epilogue-the-bell', 'active'),
    near: 'old-haldor',
    r: 150,
    steps: [
      { look: 'Chapel of the Bell' },
      { move: 'old-haldor', to: 'briar-chapel' },
      { say: 'old-haldor', line: 'It’s over, old girl. I said I’d ring you myself.' },
      { sfx: 'bell' },
      { wait: 1.4 },
      { sfx: 'bell' },
      { wait: 1.4 },
      { sfx: 'bell' },
      { look: 'maren' },
      { say: 'maren', line: 'Once for the dead. Once for the living. And the rest because his arms remember how.' },
      { look: 'elyra' },
      { say: 'elyra', line: 'They’ll hear it in Fernstead. They’ll hear it all the way to the Crown City.' },
      { look: 'hero' },
    ],
  },

  /* ------------------------------------------- the shots that open the great moments */
  {
    // Act I: the Defense of Hearthstead begins, the Host's riders already in the lanes
    id: 'hearth-the-riders-come',
    region: 'amberfield',
    opens: { event: 'hearth-riders' },
    steps: [{ look: 'foes' }, { title: 'The Defense of Hearthstead' }, { sfx: 'warhorn' }, { wait: 1.4 }, { shake: 3 }, { wait: 1.4 }, { look: 'hero' }],
  },
  {
    // the ram comes up the road to Hearthstead's gate
    id: 'hearth-the-ram-comes',
    region: 'amberfield',
    opens: { event: 'hearth-ram', wave: 1 },
    steps: [{ look: 'foes' }, { sfx: 'slam' }, { shake: 5 }, { wait: 0.9 }, { sfx: 'slam' }, { shake: 6 }, { wait: 1.3 }, { look: 'hero' }],
  },
  {
    // Act III: Fernstead taken back, its lanes full of the Legion
    id: 'fern-the-retaking',
    region: 'brackenridge',
    opens: { event: 'fern-retake' },
    steps: [{ look: 'foes' }, { title: 'Fernstead Again' }, { sfx: 'warhorn' }, { wait: 2.6 }, { look: 'hero' }],
  },
  {
    // the Pale Herald steps out of the grey at the Tear, for Elyra
    id: 'tear-the-herald',
    region: 'shattered-vale',
    opens: { event: 'herald-ambush', wave: 2 },
    steps: [
      { look: 'the-pale-herald' },
      { title: 'The Pale Herald' },
      { sfx: 'rift' },
      { shake: 3 },
      { say: 'the-pale-herald', line: 'Little light. You have been carrying something of my king’s. Come and give it back.' },
      { look: 'hero' },
    ],
  },
  {
    // the Night of Knives: the masks in the festival crowd, all moving toward the Regent
    id: 'ember-the-knives',
    region: 'emberwick',
    opens: { event: 'festival-knives' },
    steps: [{ look: 'foes' }, { title: 'The Night of Knives' }, { sfx: 'shadow' }, { wait: 2.2 }, { look: 'hero' }],
  },
  {
    // the night Fernstead fell: what is left of it, coming up the west road to Briarhollow
    id: 'briar-fernstead-comes',
    region: 'briarhollow',
    opens: { event: 'fern-refugees' },
    steps: [{ title: 'The Night Fernstead Fell' }, { follow: 'fern-ranger', secs: 8 }, { look: 'hero' }],
  },
  {
    // Act IV: Highwall's gate opens and the Ninefold ride out at the Legion's line
    id: 'highwall-the-sortie',
    region: 'highwall',
    opens: { event: 'highwall-sortie' },
    steps: [{ look: 'foes' }, { title: 'The Sortie' }, { sfx: 'warhorn' }, { wait: 1.6 }, { shake: 3 }, { wait: 1 }, { look: 'hero' }],
  },
  {
    // Act V: the Legion drawn up on the field before the Muster Hall, and every ally beside the hero
    id: 'bone-the-field',
    region: 'bonefields',
    opens: { event: 'muster-field' },
    steps: [{ look: 'foes' }, { title: 'The Field Before the Hall' }, { sfx: 'warhorn' }, { wait: 1.4 }, { shake: 4 }, { wait: 1.4 }, { look: 'hero' }],
  },
  {
    // the drowned crews of the fireships, coming up out of the harbor
    id: 'sunken-the-fireships',
    region: 'sunken-reaches',
    opens: { event: 'the-fireships' },
    steps: [{ look: 'foes' }, { title: 'Fireships' }, { sfx: 'roar' }, { wait: 2.2 }, { look: 'hero' }],
  },
  {
    // the mere answers Orren's lantern: the drowned rise, and one of them is small
    id: 'mere-the-water-answers',
    region: 'hollowmere',
    opens: { event: 'orren-on-the-shore' },
    steps: [{ look: 'foes' }, { sfx: 'soul' }, { wait: 2.6 }, { look: 'hero' }],
  },
  {
    // Act VI: every banner the hero earned, marching into Dawn's Rest
    id: 'reach-the-columns',
    region: 'pale-reach',
    opens: { event: 'reach-the-banners' },
    steps: [{ title: 'Every Banner' }, { follow: 'highwall-soldier', secs: 7 }, { look: 'hero' }],
  },
  {
    // Act VI: the last march, the Pale Host before the wall and the siege mages behind the hero
    id: 'reach-the-last-march',
    region: 'pale-reach',
    opens: { event: 'reach-the-mages' },
    steps: [{ look: 'foes' }, { title: 'The Last March' }, { sfx: 'warhorn' }, { wait: 1.4 }, { shake: 4 }, { wait: 1.6 }, { look: 'hero' }],
  },
  /* ------------------------------------- every other story moment: a short shot, its own way */
  {
    // the Prologue's last stand: the chapel door, and what is coming for it
    id: 'briar-the-door',
    region: 'briarhollow',
    opens: { event: 'briar-door' },
    steps: [{ look: 'chapel-door' }, { title: 'Hold the Chapel Door' }, { wait: 0.6 }, { look: 'foes' }, { sfx: 'roar' }, { shake: 3 }, { wait: 1.2 }, { look: 'hero' }],
  },
  {
    // Act I, the camp filling up: each village's people walking into Briarhollow, watched all the way in
    id: 'briar-the-rangers-come',
    region: 'briarhollow',
    opens: { event: 'camp-scouts' },
    steps: [{ title: 'Rangers for Briarhollow' }, { follow: 'fern-ranger', secs: 6 }, { look: 'hero' }],
  },
  {
    id: 'briar-the-grain-comes',
    region: 'briarhollow',
    opens: { event: 'camp-grain' },
    steps: [{ title: 'Grain for Briarhollow' }, { follow: 'mill-carter', secs: 6 }, { look: 'hero' }],
  },
  {
    id: 'briar-the-healers-come',
    region: 'briarhollow',
    opens: { event: 'camp-healers' },
    steps: [{ title: 'Healers for Briarhollow' }, { follow: 'reed-healer', secs: 6 }, { look: 'hero' }],
  },
  {
    id: 'briar-the-forge-comes',
    region: 'briarhollow',
    opens: { event: 'camp-smiths' },
    steps: [{ title: 'A Forge for Briarhollow' }, { follow: 'gull-smith', secs: 6 }, { look: 'hero' }],
  },
  {
    id: 'briar-the-riders-come',
    region: 'briarhollow',
    opens: { event: 'camp-riders' },
    steps: [{ title: 'Riders for Briarhollow' }, { follow: 'hearth-rider', secs: 6 }, { look: 'hero' }],
  },
  {
    id: 'briar-the-steel-comes',
    region: 'briarhollow',
    opens: { event: 'camp-dwarves' },
    steps: [{ title: 'Steel for Briarhollow' }, { follow: 'dwarf-carter', secs: 6 }, { look: 'hero' }],
  },
  {
    // Act I: the Harvest Stone, and the restless dead coming for its candles
    id: 'fern-the-stones',
    region: 'brackenridge',
    opens: { event: 'fern-stones' },
    steps: [{ look: 'harvest-stone' }, { title: 'The Harvest Stones' }, { wait: 0.8 }, { look: 'foes' }, { sfx: 'soul' }, { wait: 1.4 }, { look: 'hero' }],
  },
  {
    // Act I: the Gallows Gang at the mill, paid in ash-gold
    id: 'mill-the-gang',
    region: 'thornvale',
    opens: { event: 'mill-the-mill' },
    steps: [{ look: 'foes' }, { title: 'The Mill Road' }, { sfx: 'roar' }, { wait: 1.8 }, { look: 'hero' }],
  },
  {
    // Act I: Reedwater's taken people, found in Mother Mire's cage
    id: 'reed-the-cage',
    region: 'greyfen',
    opens: { event: 'reed-home' },
    steps: [{ look: 'reed-villager' }, { title: 'Bring Them Home' }, { wait: 2 }, { look: 'hero' }],
  },
  {
    // Act I: the Patience on the slip, and the grey tide coming up out of the water at her
    id: 'gull-the-tide',
    region: 'saltmarsh',
    opens: { event: 'gull-tide' },
    steps: [{ look: 'ines-boat' }, { title: 'The Grey Tide' }, { wait: 0.8 }, { look: 'foes' }, { sfx: 'roar' }, { wait: 1.4 }, { look: 'hero' }],
  },
  {
    // the last sledges out of the snow, their drivers by a dying fire
    id: 'rime-the-sledges',
    region: 'rimeheld',
    opens: { event: 'rime-sledges' },
    steps: [{ look: 'sledge-driver' }, { title: 'The Last Sledges' }, { wait: 2 }, { look: 'hero' }],
  },
  {
    // Act I's finale goes on: the only gate, and the second wave at it
    id: 'hearth-the-wall',
    region: 'amberfield',
    opens: { event: 'hearth-wall' },
    steps: [{ look: 'hearth-gate' }, { wait: 0.6 }, { look: 'foes' }, { sfx: 'warhorn' }, { shake: 3 }, { wait: 1.4 }, { look: 'hero' }],
  },
  {
    // Act II begins on the road: the wagon of the sick setting out across the fen
    id: 'dusk-the-caravan',
    region: 'duskfen',
    opens: { event: 'dusk-caravan' },
    steps: [{ title: 'The Sick Villages' }, { follow: 'refugee-wagon', secs: 5 }, { look: 'hero' }],
  },
  {
    // Act II: Nyx at the Deepforge's postern lock, and the guards coming down on her
    id: 'iron-the-back-door',
    region: 'ironpeak',
    opens: { event: 'iron-postern' },
    steps: [{ look: 'nyx-at-the-lock' }, { title: 'The Back Door' }, { wait: 0.8 }, { look: 'foes' }, { wait: 1.4 }, { look: 'hero' }],
  },
  {
    // Act II: the great lamp of Lantern Hill lit for the vigil, and the dead coming up the downs to end it
    id: 'lantern-the-vigil',
    region: 'ashen-barrows',
    opens: { event: 'lantern-vigil' },
    steps: [{ look: 'great-lamp' }, { title: 'The Vigil' }, { wait: 1 }, { look: 'foes' }, { sfx: 'soul' }, { wait: 1.6 }, { look: 'hero' }],
  },
  {
    // Act II: the Chancellor's cellar, and who was waiting in it
    id: 'ember-the-cellar',
    region: 'emberwick',
    opens: { event: 'city-cellar' },
    steps: [{ look: 'foes' }, { title: 'The Chancellor’s Cellar' }, { sfx: 'shadow' }, { wait: 1.8 }, { look: 'hero' }],
  },
  {
    // Act III: Silvaine singing to the prince of thorns, and his knights coming to stop her
    id: 'thorn-the-song',
    region: 'glimmerwood',
    opens: { event: 'thorn-song' },
    steps: [
      { look: 'silvaine-singing' },
      { title: 'Silvaine’s Song' },
      { say: 'silvaine-singing', line: 'Thistle. Little Thistle. Do you remember the river?' },
      { look: 'foes' },
      { wait: 1.2 },
      { look: 'hero' },
    ],
  },
  {
    // Act III's low point begins: the light wrong at the Tear
    id: 'tear-the-light-is-wrong',
    region: 'shattered-vale',
    opens: { event: 'herald-ambush' },
    steps: [{ look: 'tear-top' }, { sfx: 'rift' }, { wait: 1.6 }, { look: 'foes' }, { wait: 1.2 }, { look: 'hero' }],
  },
  {
    // Act IV: someone coming up the road to the relief camp under a white rag
    id: 'highwall-the-white-rag',
    region: 'highwall',
    opens: { event: 'nyx-returns' },
    steps: [{ title: 'Under a White Rag' }, { follow: 'nyx', secs: 6 }, { look: 'hero' }],
  },
  {
    // Act IV: Nyx at the Gloam Gate's cells, and the gate-guards on the stair
    id: 'gloam-the-stair',
    region: 'gloamhollow',
    opens: { event: 'gloam-cells' },
    steps: [{ look: 'nyx-at-the-lock' }, { title: 'The Cells' }, { wait: 0.8 }, { look: 'foes' }, { wait: 1.4 }, { look: 'hero' }],
  },
  {
    // Act IV: Elyra on her feet in the open cell
    id: 'gloam-out-of-the-dark',
    region: 'gloamhollow',
    opens: { event: 'gloam-out' },
    steps: [
      { look: 'elyra-freed' },
      { title: 'Out of the Dark' },
      { say: 'elyra-freed', line: 'I can walk. I can. Don’t carry me. If you carry me I’ll never stop being carried.' },
      { look: 'hero' },
    ],
  },
  {
    // Act V: the queen's two children, still out in the snow after three hundred years
    id: 'wood-the-snow',
    region: 'weeping-woods',
    opens: { event: 'wood-the-children' },
    steps: [
      { look: 'echo-child' },
      { title: 'Two Names in the Snow' },
      { say: 'echo-child', line: 'Is it Papa? Papa, did you get the star? Mama says you went to get the star.' },
      { look: 'hero' },
    ],
  },
  {
    // Act VI: the second charge, through the gap in the wall
    id: 'reach-through-the-gap',
    region: 'pale-reach',
    opens: { event: 'reach-the-breach' },
    steps: [{ look: 'foes' }, { title: 'The Breach' }, { sfx: 'warhorn' }, { shake: 4 }, { wait: 1.6 }, { look: 'hero' }],
  },
  {
    // the Epilogue: Maren sends the camp home, and the first of them take the south road
    id: 'briar-going-home',
    region: 'briarhollow',
    opens: { event: 'epilogue-the-camp' },
    steps: [{ title: 'The Camp Goes Home' }, { follow: 'fern-ranger', secs: 6 }, { look: 'hero' }],
  },
];

// the main story's own staging, land by land (data/scenes-story.ts)
SCENES.push(...STORY_SCENES);

// a retired land's scenes go with it, and so does a scene about a quest or a story event that is gone
const named = (c: unknown): string[] => JSON.stringify(c ?? null).match(/"quest":"[^"]+"/g)?.map((m) => m.slice(9, -1)) ?? [];
for (let i = SCENES.length - 1; i >= 0; i--) {
  const d = SCENES[i]!;
  if (isRetired(d.region) || (d.opens && !EVENTS[d.opens.event]) || named(d.when).some((q) => !QUEST_DEFS[q])) SCENES.splice(i, 1);
}
