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
      // (the square first, from further back: the whole village in it)
      { zoom: 'wide' },
      { look: 'briar-square' },
      { wait: 1.4 },
      { zoom: 'auto' },
      { say: 'maren', line: 'Three of ours died last night, and the courier. Everyone else is here. I counted twice.' },
      { look: 'elyra' },
      { emote: 'elyra', icon: 'heart' },
      { act: 'elyra', does: 'wave' },
      { say: 'elyra', line: 'My hands haven’t stopped shaking since the roof came down. The three children are asleep in the chapel.' },
      { look: 'Chapel of the Bell' },
      { say: 'old-haldor', line: 'Forty years I’ve rung that bell. Last night it rang three times with nobody on the rope. It was warning us.' },
      { look: 'hero' },
      { say: 'maren', line: 'Briarhollow is a camp now. When the Host comes back for Elyra, the whole Vale has to be standing here with us.' },
      { say: 'maren', line: 'But first, the north road. The Host came through the Whisperwood, and the beasts there have gone mad.' },
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
      { zoom: 'wide' },
      { look: 'Chapel of the Bell' },
      { wait: 2.4 },
      { sfx: 'bell-toll' },
      { shake: 3 },
      { look: 'briar-east-roofs' },
      { wait: 2.6 },
      { zoom: 'auto' },
      { look: 'hero' },
      { say: 'mara', line: 'The chapel bell. Nobody has touched that rope in three weeks.' },
      { sfx: 'bell-toll' },
      { say: 'mara', line: 'And that’s fire. They came over the east wall while we held the gate.' },
      { say: 'mara', line: 'To the square, with me!' },
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
      { say: 'regent-elowen', line: 'You’ve come from the Vale? I’ve had no news from the Vale in months.' },
      { emote: 'chancellor-crane', icon: 'dots' },
      { say: 'chancellor-crane', line: 'The roads are dangerous, Highness. Letters get lost.' },
      { say: 'regent-elowen', line: 'So you keep telling me. What have you brought me?' },
      // (the captain comes to the hero's shoulder to say it, low)
      { look: 'cael-varrow' },
      { move: 'cael-varrow', to: 'hero' },
      { zoom: 'close' },
      { say: 'cael-varrow', line: 'Give her Corvane’s order now, while he’s standing there. I want him to see it in her hand.' },
      { zoom: 'auto' },
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
      // (on the Regent, turned toward his house: no glance at the house first and back)
      { look: 'regent-elowen' },
      // (to his door, not to the hero: she is not ready to look at anyone)
      { face: 'regent-elowen', to: 'The Chancellor’s House' },
      { say: 'regent-elowen', line: 'He sat at my side for nine years. I never once asked him where the road money went.' },
      { emote: 'regent-elowen', icon: 'dots' },
      { face: 'regent-elowen', to: 'hero' },
      { zoom: 'close' },
      { say: 'regent-elowen', line: 'I’m asking now. He ran down a stair under his house. Find out where it goes.' },
      { zoom: 'auto' },
      { look: 'hero' },
    ],
  },
  {
    // the Herald has taken Elyra: her teacher alone in the camp
    id: 'briar-elyra-gone',
    region: 'briarhollow',
    // (after Fernstead burns: Thessa hears the news in that scene, data/scenes-story.ts briar-fernstead-burns, and
    // asked for Elyra there after this one had her grieving already)
    when: all(after('fall-of-fernstead'), not(after('fern-retaken')), until('gloam-out-of-the-cells')),
    near: 'herbwife-thessa',
    r: 130,
    steps: [
      { look: 'herbwife-thessa' },
      { zoom: 'close' },
      { emote: 'herbwife-thessa', icon: 'dots' },
      { act: 'herbwife-thessa', does: 'take' },
      { say: 'herbwife-thessa', line: 'I unpacked her satchel tonight. Willow bark, clean linen, and a honey cake she never ate.' },
      { move: 'mara-venn', to: 'herbwife-thessa' },
      { act: 'mara-venn', does: 'give' },
      { say: 'mara-venn', line: 'She meant to come back, Thessa. We’ll bring her home. I promise.' },
      { zoom: 'auto' },
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
      { say: 'old-haldor', line: 'Highwall held. They say our own Mara Venn commanded it. The girl who kept our gate.' },
      { say: 'old-haldor', line: 'Forty years I’ve rung that bell for weddings and fires. I won’t ring it for a battle.' },
      { say: 'old-haldor', line: 'I’ll ring it when the war is over, and everyone the Host took is home.' },
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
      { say: 'marshal-dunmore', line: 'The gate held. I didn’t think it would. We’ll be digging graves until noon.' },
      { look: 'tess-hearthkeeper' },
      { emote: 'tess-hearthkeeper', icon: 'dots' },
      { say: 'tess-hearthkeeper', line: 'Marshal, the shrine. The hearthstone is gone, and the altar’s split in two. Come and look.' },
      { act: 'tess-hearthkeeper', does: 'wave' },
      { wait: 0.9 },
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
      { zoom: 'wide' },
      { look: 'lantern-hill' },
      { wait: 1.6 },
      { zoom: 'auto' },
      { emote: 'lamplighter-ivo', icon: 'heart' },
      { act: 'lamplighter-ivo', does: 'cheer' },
      { say: 'lamplighter-ivo', line: 'Look! Every lamp on the downs is burning again, all the way to the King’s Road.' },
      { say: 'brother-orren', line: 'That shield-boss you took. The black rose was Sir Corvane’s badge. He commanded the Ninefold Watch.' },
      { say: 'brother-orren', line: 'The Watch died on these downs ten years ago. Tonight its knights came up the hill under his rose.' },
      { say: 'elyra', line: 'Vosk’s orders said a knight of the barrows would guard him. Is that Corvane?' },
      { say: 'brother-orren', line: 'I think so. One of his captains lived. He drinks at the bottom of the village and calls himself Wat.' },
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
      { say: 'warden-hollis', line: 'We’re home. Six of my rangers aren’t. We’ll bury them by the Harvest Stones tonight.' },
      { emote: 'pip-tanner', icon: 'alert' },
      { act: 'pip-tanner', does: 'point' },
      { say: 'pip-tanner', line: 'The tannery’s gone, but the vats are still standing. I can start again.' },
      { say: 'mother-alsa', line: 'The Host left its banners on our roofs. Help me pull them down, Pip. We’ll burn them on the graves.' },
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
      // (Mara comes over to have it out with her: the two of them stood ten tiles apart, and the camera swung from one
      // to the other at every line)
      { move: 'captain-mara', to: 'nyx-returned', run: true },
      { emote: 'captain-mara', icon: 'alert' },
      { act: 'captain-mara', does: 'point' },
      { say: 'captain-mara', line: 'Elyra shared her bread with you. She trusted you. And you sold her to the Herald.' },
      { emote: 'nyx-returned', icon: 'dots' },
      { say: 'nyx-returned', line: 'I know what I did. I can’t give that back.' },
      { act: 'nyx-returned', does: 'give' },
      { say: 'nyx-returned', line: 'I can give you this. It’s the Herald’s own map. It shows where he keeps her.' },
      { act: 'captain-mara', does: 'take' },
      { say: 'captain-mara', line: 'If this is another trap, I’ll hang you from the Breach myself.' },
      { act: 'captain-mara', does: 'give' },
      { say: 'captain-mara', line: 'Take it. You talk to her. I can’t.' },
      { look: 'hero' },
    ],
  },
  {
    // Act IV: Elyra out of the Gloam Gate's cells, by Lastlight's fire
    id: 'gloam-elyra-free',
    region: 'riftscar',
    when: all(after('gloam-out-of-the-cells'), until('the-gloam-gate')),
    near: 'elyra-lastlight',
    r: 140,
    steps: [
      { look: 'elyra-lastlight' },
      // (down by the fire, as near it as she can get)
      { act: 'elyra-lastlight', does: 'kneel', hold: true },
      { wait: 0.9 },
      { say: 'elyra-lastlight', line: 'It’s warm here. It was so cold in that cell.' },
      // (to her other side: the fire is at her right hand)
      { move: 'wren', to: 'elyra-lastlight', dx: -1, dy: 0.15 },
      { act: 'wren', does: 'give' },
      { say: 'wren', line: 'Brin says to drink all of this. It will help you get your strength back.' },
      { emote: 'nyx-lastlight', icon: 'dots' },
      { say: 'nyx-lastlight', line: 'Elyra, I’m sorry. I sold you to him. I know sorry doesn’t fix it.' },
      { emote: 'elyra-lastlight', icon: 'heart' },
      { say: 'elyra-lastlight', line: 'You came back for me. That matters. Sit down here with me.' },
      // (and she does)
      { act: 'nyx-lastlight', does: 'kneel', hold: true },
      { wait: 1.4 },
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
      { act: 'echo-of-ysane', does: 'wave' },
      { say: 'echo-of-ysane', line: 'Lark! Edda! Come inside, it’s snowing. Your father will be home by morning.' },
      { wait: 0.8 },
      // (nobody comes. She goes down in the snow where she stands)
      { zoom: 'close' },
      { act: 'echo-of-ysane', does: 'kneel', hold: true },
      { say: 'echo-of-ysane', line: 'He rode out to fetch the physicians. He promised he’d be back by morning.' },
      { zoom: 'auto' },
      { look: 'hollow-wood' },
      { say: 'orren', line: 'That’s the Hallow King’s queen. Three hundred years ago he was a man riding through the snow for a doctor.' },
      { say: 'orren', line: 'She has said this every night since. The children are out in the wood. Let’s bring them home.' },
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
      { zoom: 'wide' },
      { look: 'reach-camp' },
      { wait: 1.6 },
      { zoom: 'auto' },
      { say: 'mara-at-the-reach', line: 'Three thousand, and more still on the road. In the spring there were three of us on Briarhollow’s gate.' },
      { look: 'cael-at-the-reach' },
      { say: 'cael-at-the-reach', line: 'Ten years ago my Watch died waiting for help that never came. This time, help came.' },
      { emote: 'nyx-at-the-reach', icon: 'note' },
      { act: 'nyx-at-the-reach', does: 'wave' },
      { say: 'nyx-at-the-reach', line: 'I’ve robbed people from half the villages under these banners. They came anyway. They came for you.' },
      { say: 'orren-at-the-reach', line: 'Look at their faces. When it gets hard up there, think of them.' },
      { say: 'elyra-at-the-reach', line: 'Six sigils, and the whole Vale behind us. For the first time, I think we can win.' },
      { look: 'hero' },
    ],
  },
  {
    // Act VI, Crownfall: the hero comes back out of Duskspire with the King fallen, and Mara is still holding the gate.
    // The Crown has torn the sky open over the tower, and while it hangs there, the Host is still on its feet
    id: 'reach-the-door',
    region: 'pale-reach',
    when: all(after('the-hollow-king'), until('crownfall-vaelmoor')),
    near: 'duskspire-gate',
    r: 340,
    steps: [
      { zoom: 'wide' },
      { look: 'duskspire-gate' },
      { fx: 'holy', at: 'duskspire-gate', color: '#ffe8a8', size: 40 },
      { wait: 1.6 },
      { zoom: 'auto' },
      { say: 'mara', line: 'You’re out. When the Crown tore the sky open, every soldier of the Host stopped and looked up.' },
      { say: 'mara', line: 'Now they’re moving again. Whatever keeps them on their feet is still up in that light.' },
      { say: 'mara', line: 'Elyra went into it after the Crown. Go with her and end it. We’ll hold here as long as it takes.' },
      // (her shield up: the door is kept)
      { act: 'mara', does: 'guard', hold: true },
      { wait: 1.1 },
      { look: 'hero' },
    ],
  },
  {
    // Crownfall: the Crown's memory of Vaelmoor, whole and beautiful, opened on as the hero steps into it; the King in
    // his own square, and nobody turning round (first: the place, then the Stone's vision, vision-stone)
    id: 'memory-the-square',
    region: 'vaelmoor-remembered',
    when: is('crownfall-vaelmoor', 'active'),
    near: 'elyra-in-the-memory',
    r: 220,
    steps: [
      { title: 'Vaelmoor Remembered', sub: 'The summer before the plague' },
      { look: 'memory-square' },
      { wait: 1.4 },
      { act: 'vaelmoor-herald-boy', does: 'wave' },
      { say: 'vaelmoor-herald-boy', line: 'The King rides to the border at dawn, to meet the King of Aster!' },
      { look: 'echo-of-ysane-whole' },
      { say: 'echo-of-ysane-whole', line: 'Lark, leave the honey cake alone. Your father will be home by supper.' },
      { look: 'vaelor-remembered' },
      // (the king on his knees in his own square, and nobody turning round)
      { zoom: 'close' },
      { act: 'vaelor-remembered', does: 'kneel', hold: true },
      { say: 'vaelor-remembered', line: 'I am home. I am standing right here. Why can’t any of them see me?' },
      { zoom: 'auto' },
      // (Orren keeps the promise he made at Hollowmere: Ysane's message, given to the King himself)
      { say: 'orren', line: 'King Vaelor. At Hollowmere your queen asked us to tell you something. Let her go.' },
      { say: 'vaelor-remembered', line: 'She told me herself, in my hall, at the end. I heard her. I am trying.' },
      { look: 'elyra-in-the-memory' },
      { say: 'elyra-in-the-memory', line: 'This is the Crown’s memory of his city. It’s all he wanted back, and he can’t even touch it.' },
      { look: 'hero' },
    ],
  },
  {
    // the Stone won back from the Crown: the seventh vision, two kings forging two crowns under one sky, shown in the
    // Crown's own memory of Vaelmoor; the Stone took nothing from her (SIGIL_LORE)
    id: 'vision-stone',
    region: 'vaelmoor-remembered',
    when: is('crownfall-vaelmoor', 'active'),
    near: 'elyra-in-the-memory',
    r: 220,
    steps: [
      { look: 'elyra-in-the-memory' },
      { say: 'elyra-in-the-memory', line: 'The Stone wants to show me something before the end. Stay with me.' },
      { music: 'chapel' },
      { fade: 'out', secs: 0.9 },
      { vision: 'A thousand years ago, two kings forged two crowns from one fallen star, under one sky.', tint: 'ember' },
      { ghost: 'vision-king-aster', as: 'marshal-dunmore', at: 'memory-square', dx: -2, face: 1 },
      { ghost: 'vision-king-vaelmoor', as: 'old-gaius', at: 'memory-square', dx: 2, face: -1 },
      { fade: 'in', secs: 0.9 },
      // (each at his own anvil, the sparks going up between them)
      { act: 'vision-king-aster', does: 'work' },
      { act: 'vision-king-vaelmoor', does: 'work' },
      { fx: 'blast', at: 'memory-square', color: '#ffb070', size: 30 },
      { wait: 1 },
      { say: 'vision-king-aster', line: 'Half for Aster, half for Vaelmoor. While both crowns are worn, the dead stay dead.' },
      { say: 'vision-king-vaelmoor', line: 'And if one of us breaks his crown?' },
      // (they come together in the middle of the square, and clasp hands on it)
      { move: 'vision-king-aster', to: 'memory-square', dx: -0.55 },
      { move: 'vision-king-vaelmoor', to: 'memory-square', dx: 0.55 },
      { face: 'vision-king-aster', to: 'vision-king-vaelmoor' },
      { face: 'vision-king-vaelmoor', to: 'vision-king-aster' },
      { act: 'vision-king-aster', does: 'give' },
      { act: 'vision-king-vaelmoor', does: 'give' },
      { say: 'vision-king-aster', line: 'Then the other keeps the dead at rest for both of us. We swear it, as brothers.' },
      { fx: 'holy', at: 'memory-square', color: '#ffd88a', size: 34 },
      { vision: 'Three hundred years ago, one king broke his crown. The other crown was broken into seven to keep it from him.', tint: 'ember' },
      { wait: 1.6 },
      { fade: 'out', secs: 0.8 },
      { vision: '' },
      { fade: 'in', secs: 0.8 },
      { zoom: 'close' },
      { say: 'elyra-in-the-memory', line: 'All seven. Aster’s whole crown, in my two hands.' },
      { say: 'elyra-in-the-memory', line: 'The Stone didn’t take anything from me. It only wanted me to see that. Come here. I have to ask you something.' },
      { zoom: 'auto' },
      { look: 'hero' },
    ],
  },
  {
    // the Epilogue: Old Haldor rings the bell at last, and Elyra, who has forgotten so much, gets back the one thing the
    // first sigil took: her mother's lullaby, which was about this bell all along
    id: 'briar-the-bell',
    region: 'briarhollow',
    when: is('epilogue-the-bell', 'active'),
    near: 'old-haldor',
    r: 150,
    steps: [
      { look: 'Chapel of the Bell' },
      { move: 'old-haldor', to: 'briar-chapel' },
      { say: 'old-haldor', line: 'I swore I’d ring this bell when the war was over. Robin won’t hear it. I’ll ring it for him anyway.' },
      // (he hauls on the rope: three pulls, three strokes)
      { act: 'old-haldor', does: 'work' },
      { sfx: 'bell' },
      { shake: 2 },
      { wait: 1.4 },
      { act: 'old-haldor', does: 'work' },
      { sfx: 'bell' },
      { shake: 2 },
      { wait: 1.4 },
      { act: 'old-haldor', does: 'work' },
      { sfx: 'bell' },
      { shake: 2 },
      { wait: 1.6 },
      { look: 'maren' },
      { say: 'maren', line: 'Once for the dead, and once for the living. The last one was for Robin.' },
      { look: 'elyra' },
      { zoom: 'close' },
      { emote: 'elyra', icon: 'note' },
      { say: 'elyra', line: '“Hush now, the bell has rung. The gate is shut, the fire is low.”' },
      { say: 'elyra', line: '“Whoever’s still out on the road tonight, the bell will bring them home.”' },
      { say: 'elyra', line: 'Those are the words. My mother’s song. It was about this bell all along.' },
      { zoom: 'auto' },
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
    // the Pale Herald steps out of the grey at the Tear, for Elyra, and says who sold him the road
    id: 'tear-the-herald',
    region: 'shattered-vale',
    opens: { event: 'herald-ambush', wave: 2 },
    steps: [
      { look: 'the-pale-herald' },
      { title: 'The Pale Herald', sub: 'The voice of the Hallow King' },
      { sfx: 'rift' },
      { shake: 3 },
      { wait: 1.2 },
      { say: 'the-pale-herald', line: 'The Veil kept this door shut for three hundred years. Thank you for opening it, girl.' },
      { say: 'the-pale-herald', line: 'Your thief sold me your road for her brother. She is gone. Nobody else is coming.' },
      { say: 'elyra', line: 'Stay back! You won’t have them. Not one!' },
      { say: 'the-pale-herald', line: 'You carry five of my king’s sigils, girl. You will carry them to him.' },
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
    steps: [{ title: 'The Night Fernstead Fell', sub: 'The same night the Herald took Elyra' }, { follow: 'fern-ranger', secs: 8 }, { look: 'hero' }],
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
    steps: [{ look: 'chapel-door' }, { title: 'Hold the Chapel Door' }, { wait: 1.3 }, { look: 'foes' }, { sfx: 'roar' }, { shake: 3 }, { wait: 1.2 }, { look: 'hero' }],
  },
  {
    // Act I, the camp filling up: each village's people walking into Briarhollow, seen coming in, and then (a cut) where
    // they stop, with what they call out and the camp's answer said there. The shot followed them for six seconds and
    // went back to the hero while they were still on the road; their lines came after it, off the picture
    id: 'briar-the-rangers-come',
    region: 'briarhollow',
    opens: { event: 'camp-scouts' },
    steps: [{ title: 'Rangers for Briarhollow' }, { follow: 'fern-ranger', secs: 5 }, { fade: 'out', secs: 0.5 }, { cut: true }, { look: 'briar-watchfire' }, { fade: 'in', secs: 0.5 }, { say: 'fern-ranger', line: 'Rangers from Fernstead, sent by Warden Hollis! Where do you want us?' }, { say: 'mara-venn', line: 'By the gate. You can watch the north road from there. Welcome to Briarhollow.' }, { look: 'hero' }],
  },
  {
    id: 'briar-the-grain-comes',
    region: 'briarhollow',
    opens: { event: 'camp-grain' },
    steps: [{ title: 'Grain for Briarhollow' }, { follow: 'mill-carter', secs: 5 }, { fade: 'out', secs: 0.5 }, { cut: true }, { look: 'briar-granary' }, { fade: 'in', secs: 0.5 }, { say: 'mill-carter', line: 'Grain from Millbrook, twelve carts of it! Tobin sent his hens too.' }, { say: 'briar-oda', line: 'Twelve carts! We won’t go hungry this winter!' }, { look: 'hero' }],
  },
  {
    id: 'briar-the-healers-come',
    region: 'briarhollow',
    opens: { event: 'camp-healers' },
    steps: [{ title: 'Healers for Briarhollow' }, { follow: 'reed-healer', secs: 5 }, { fade: 'out', secs: 0.5 }, { cut: true }, { look: 'briar-infirmary' }, { fade: 'in', secs: 0.5 }, { say: 'reed-healer', line: 'Reedwater’s herb-boats, for the camp! Where are the sick? Where is Thessa?' }, { say: 'herbwife-thessa', line: 'Here. And about time. Wash your hands, all of you.' }, { look: 'hero' }],
  },
  {
    id: 'briar-the-forge-comes',
    region: 'briarhollow',
    opens: { event: 'camp-smiths' },
    steps: [{ title: 'A Forge for Briarhollow' }, { follow: 'gull-smith', secs: 5 }, { fade: 'out', secs: 0.5 }, { cut: true }, { look: 'briar-forge' }, { fade: 'in', secs: 0.5 }, { say: 'gull-smith', line: 'Gullport’s forge, for Elder Maren! Mind the kegs. Really, mind the kegs.' }, { say: 'smith-hollin', line: 'Two forges in one village. Keep to your side of the square.' }, { look: 'hero' }],
  },
  {
    id: 'briar-the-riders-come',
    region: 'briarhollow',
    opens: { event: 'camp-riders' },
    // (the shot stays on them until they are in: it came back to the hero while they were still on the north road, and
    // what they called out was said off the picture)
    steps: [{ title: 'Riders for Briarhollow' }, { follow: 'hearth-horseman', secs: 9 }, { say: 'hearth-horseman', line: 'Hearthstead’s riders, sent to Elder Maren! Where should we put the horses?' }, { look: 'hero' }],
  },
  {
    id: 'briar-the-steel-comes',
    region: 'briarhollow',
    opens: { event: 'camp-dwarves' },
    steps: [{ title: 'Steel for Briarhollow' }, { follow: 'dwarf-carter', secs: 5 }, { fade: 'out', secs: 0.5 }, { cut: true }, { look: 'briar-dwarves' }, { fade: 'in', secs: 0.5 }, { say: 'dwarf-carter', line: 'Steel from the Deepforge, for the Elder! Where’s your anvil? You have an anvil?' }, { say: 'forgewife-runa', line: 'Two anvils. Over here. Don’t touch the kegs.' }, { look: 'hero' }],
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
    steps: [{ look: 'hearth-gate' }, { wait: 1.3 }, { look: 'foes' }, { sfx: 'warhorn' }, { shake: 3 }, { wait: 1.4 }, { look: 'hero' }],
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
      { say: 'silvaine-singing', line: 'Thistlemourn! It’s Silvaine, your sister. I’ve come to sing to you.' },
      { look: 'foes' },
      { wait: 1.2 },
      { look: 'hero' },
    ],
  },
  {
    // Act III's low point begins: Elyra pulls the Sigil of the Veil out of the glass, the Tear tears wide, the
    // light goes grey, and the Herald's shades come down out of it
    id: 'tear-the-light-is-wrong',
    region: 'shattered-vale',
    opens: { event: 'herald-ambush' },
    steps: [
      { look: 'the-tear' },
      { say: 'elyra', line: 'I have it. The Sigil of the Veil. That makes five.' },
      { fx: 'holy', at: 'elyra', color: '#c58cff', size: 30 },
      { wait: 0.8 },
      { sfx: 'rift' },
      { fx: 'rift', at: 'the-tear', color: '#e8e4ff', size: 58 },
      { shake: 4 },
      { wait: 1.4 },
      { say: 'elyra', line: 'The Tear is opening wider! The sigil was all that held it shut!' },
      { say: 'orren', line: 'The light’s gone grey. Something is coming down out of it.' },
      { look: 'foes' },
      { wait: 1.2 },
      { say: 'nyx', line: 'I’m sorry. I’m so sorry.' },
      { look: 'hero' },
    ],
  },
  {
    // Act IV: someone coming up the road to the relief camp under a white rag
    id: 'highwall-the-white-rag',
    region: 'highwall',
    opens: { event: 'nyx-returns' },
    steps: [{ title: 'Under a White Rag' }, { follow: 'nyx', secs: 4 }, { say: 'highwall-soldier', line: 'Halt! Captain, it’s a woman under a white rag. She says she knows you.' }, { fade: 'out', secs: 0.5 }, { cut: true }, { look: 'relief-tents' }, { fade: 'in', secs: 0.5 }, { say: 'nyx', line: 'Hit me after, Mara. Elyra’s alive. I know where he keeps her, and I can get you in.' }, { say: 'captain-mara', line: 'Put her in a tent under guard. Nobody gives her a weapon.' }, { look: 'hero' }],
  },
  {
    // Act IV: Nyx at the Gloam Gate's cells, and the gate-guards on the stair
    id: 'gloam-the-stair',
    region: 'riftscar',
    opens: { event: 'gloam-cells' },
    steps: [{ look: 'nyx-at-the-lock' }, { title: 'The Cells' }, { wait: 0.8 }, { look: 'foes' }, { wait: 1.4 }, { look: 'hero' }],
  },
  {
    // Act IV: Elyra on her feet in the open cell
    id: 'gloam-out-of-the-dark',
    region: 'riftscar',
    opens: { event: 'gloam-out' },
    steps: [
      { look: 'elyra-freed' },
      { title: 'Out of the Dark' },
      { say: 'elyra-freed', line: 'You came. I knew you would come.' },
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
      { say: 'echo-child', line: 'It’s so cold, Edda. Hold my hand. We have to find Papa.' },
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
