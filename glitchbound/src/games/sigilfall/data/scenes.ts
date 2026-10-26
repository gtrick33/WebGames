import { after, all, during, not, until } from './cond';
import type { SceneDef } from '../sim/scene';

/**
 * The story's staged beats (sim/scene.ts): a few seconds each, in the world, at the moments the story
 * turns. Each one only stages what the markers already say — who stands where comes from the region —
 * and plays once.
 */
export const SCENES: SceneDef[] = [
  {
    // the first dawn after the raid: the village alive in its square, and a camp now
    id: 'briar-dawn',
    region: 'briarhollow',
    when: all(after('the-empty-tomb'), until('camp-scouts')),
    near: 'briar-square',
    r: 150,
    steps: [
      { look: 'briar-square' },
      { say: 'maren', line: 'Look at them. Every soul in Briarhollow, alive, in one square. I counted twice.' },
      { look: 'elyra' },
      { emote: 'elyra', icon: 'heart' },
      { say: 'elyra', line: 'Thessa says I talk too much when I’m frightened. I’m not frightened anymore. Mostly.' },
      { look: 'briar-chapel' },
      { say: 'old-haldor', line: 'She’s quiet still. But she’s listening now. I can feel it in the rope.' },
      { look: 'hero' },
      { say: 'maren', line: 'This is a camp now. And a camp needs someone to go and bring the others in.' },
    ],
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
      { look: 'crane-door' },
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
    when: all(after('the-heralds-ambush'), not(after('fern-retaken'))),
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
    when: after('the-long-night-ends'),
    near: 'old-haldor',
    r: 140,
    steps: [
      { look: 'briar-chapel' },
      { move: 'old-haldor', to: 'briar-chapel' },
      { emote: 'old-haldor', icon: 'note' },
      { say: 'old-haldor', line: 'Not yet, old girl. Not yet. But soon. I’ll ring you myself when it’s over.' },
      { look: 'hero' },
    ],
  },
];
