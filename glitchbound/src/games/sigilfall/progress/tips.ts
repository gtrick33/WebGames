/**
 * The first-timer's tutorial: short hints that pause the game, light up one thing on the screen and say what it is.
 * It only explains. It changes nothing in the game's rules: the world simply waits, as it does for a menu.
 *
 * Who gets it: a hero marked `tips` on its `opened` list (given at creation, or when the player turns the hints on
 * in Settings), while the Settings choice is on. Heroes from before the tutorial have no mark and never see it.
 * What they have seen is kept beside it as `tip:<id>`, on the hero, so it follows them to their other devices.
 */
import { SKILLS } from '../data/skills';
import type { ResourceDef, SlotKey } from '../data/types';
import type { PanelId } from '../engine';
import type { Character } from './character';

export type TipId = 'combat' | 'bag' | 'spell' | 'talents' | 'riding' | 'rift';

export const TIPS_MARK = 'tips';
export const tipKey = (id: TipId): string => `tip:${id}`;

export const takesTips = (h: Character): boolean => h.opened.includes(TIPS_MARK);

/** Marks a hero for the tutorial (once). */
export function giveTips(h: Character): void {
  if (!takesTips(h)) h.opened.push(TIPS_MARK);
}

/**
 * Whether this hint should still be shown to this hero, with the Settings choice as it is. The Rift's is about the
 * endgame, which a hero from before the tutorial is as new to as anyone: they see it too, unless they have already
 * climbed past the first stone. Riding comes halfway through Act I, long after the hints were asked for or turned
 * down, and nothing else on the screen says how it is done (the owner: "theres no tutorial for the mount riding"): its
 * three cards are shown to every hero once, hints on or off.
 */
export const tipDue = (h: Character, on: boolean, id: TipId): boolean => (id === 'riding' || (on && (takesTips(h) || (id === 'rift' && h.keystone <= 1)))) && !h.opened.includes(tipKey(id));

/** Marks a hint as shown (once). */
export function tipShown(h: Character, id: TipId): void {
  const key = tipKey(id);
  if (!h.opened.includes(key)) h.opened.push(key);
}

/**
 * A boss's mechanic, explained under its callout the first time a hero meets it (ui/GameScreen.tsx BossBar), kept on the
 * hero like a hint seen. It pauses nothing, so every hero gets it, old or new, while the Settings choice is on.
 */
export const mechanicKey = (text: string): string => `hint:${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
export const mechanicDue = (h: Character, on: boolean, text: string): boolean => on && !h.opened.includes(mechanicKey(text));
export function mechanicShown(h: Character, text: string): void {
  const key = mechanicKey(text);
  if (!h.opened.includes(key)) h.opened.push(key);
}

export interface TipStep {
  /** What lights up (a CSS selector inside the game's UI). None, or not on the screen: the card alone, in the middle. */
  target: string | null;
  /** The panel open behind this step. */
  panel: PanelId | null;
  title: string;
  text: string;
}

export interface TipContext {
  touch: boolean;
  /** The hero's bar, as built: which skill is in which slot. */
  bar: Partial<Record<SlotKey, string | null>>;
  resource: ResourceDef | null;
  /** A specialization has been chosen (the talents panel shows its trees, not the choice). */
  specChosen: boolean;
  /** For the new-skill hint: the skill just learned. */
  spell?: string;
}

/** A key on the desktop bar, or a button on the touch controls. */
const barSlot = (touch: boolean, slot: SlotKey): string => (touch ? `.rb-sb-${slot}` : `.rb-slot6.is-${slot}`);
const hudButton = (label: string): string => `.rb-hud-menu .rb-hudbtn[aria-label^="${label}"]`;
const panelTab = (id: PanelId): string => `.rb-tabs [data-tab="${id}"]`;
/** The mount key on the desktop bar, or the horseshoe on the touch controls (shown once there is riding). */
const mountButton = (touch: boolean): string => (touch ? '.rb-sb-mount' : '.rb-slot6.is-mount');

/** One line on what a skill spends, in the words of the HUD's own help. */
const COSTS: Record<ResourceDef['kind'], string> = {
  mana: 'It costs mana, which comes back fast out of combat.',
  rage: 'It costs rage: hitting and being hit build it, so strike first.',
  energy: 'It costs energy, which comes back quickly.',
  focus: 'It costs focus, which comes back quickly.',
  holy: 'It costs zeal: your strikes build it, so strike first.',
};

/** The steps of a hint, for this input and this hero. */
export function tipSteps(id: TipId, c: TipContext): TipStep[] {
  const { touch } = c;
  const tap = touch ? 'Tap' : 'Click';
  switch (id) {
    case 'combat': {
      const skill = c.bar.s1 ? SKILLS[c.bar.s1]?.name : undefined;
      const dodge = c.bar.dodge ? SKILLS[c.bar.dodge] : undefined;
      const cost = c.resource ? ` ${COSTS[c.resource.kind]}` : '';
      return [
        {
          target: barSlot(touch, 'basic'),
          panel: null,
          title: 'Your basic attack',
          // (what the game does, progress/build.ts paceBasics: the skills carry the fight and the strikes fill the time between
          // them. It said the strikes did most of the work, which the pacing had made untrue)
          text: touch ? 'Tap this button to strike. It aims for you. Strike between your skills: the skills hit far harder, and your strikes keep the fight going while they come back.' : 'Left-click to strike where your mouse points. Strike between your skills: the skills hit far harder, and your strikes keep the fight going while they come back.',
        },
        {
          target: barSlot(touch, 's1'),
          panel: null,
          title: skill ? `Your first skill: ${skill}` : 'Your first skill',
          text: (touch ? 'Tap it to cast at the nearest enemy, or drag from it to aim by hand.' : 'Press Q to cast it where your mouse points.') + cost,
        },
        {
          target: barSlot(touch, 'dodge'),
          panel: null,
          // (every class's is its own: a barge, a blink, a guard; the skill's own words say which)
          title: dodge ? `Your dodge: ${dodge.name}` : 'Your dodge',
          text: `${touch ? 'Tap Dodge' : 'Press Space'}. ${dodge?.blurb ?? 'A quick dash out of harm’s way.'} Nothing can hurt you while it lasts, so use it when an enemy draws back to hit.`,
        },
      ];
    }
    case 'bag':
      return [
        {
          target: hudButton('Hero & bag'),
          panel: null,
          title: 'You found gear',
          text: touch ? 'What you find goes into your bag. This button opens it.' : 'What you find goes into your bag. This button opens it, or press I.',
        },
        {
          // (the first slot: the bag sorts the newest first)
          target: '.rb-bag-grid .rb-bslot',
          panel: 'hero',
          title: 'Inspect it',
          text: `${tap} an item to see what it does and how it compares with what you wear, then equip it from there. A ▲ marks an upgrade.`,
        },
        {
          target: panelTab('wardrobe'),
          panel: 'wardrobe',
          title: 'Your Wardrobe',
          text: 'Every look you find stays here for good. Wear any of them over the gear you have on, without changing what that gear does.',
        },
      ];
    case 'spell': {
      const name = c.spell ? SKILLS[c.spell]?.name : undefined;
      const slot = (['s1', 's2', 's3', 's4'] as const).find((s) => c.spell && c.bar[s] === c.spell);
      return [
        {
          target: slot ? barSlot(touch, slot) : null,
          panel: null,
          title: name ? `New skill: ${name}` : 'A new skill',
          text: slot ? 'You just learned it, and it went on your bar by itself.' : 'You just learned it. Your bar is full, so it waits in your skills until you make room.',
        },
        {
          target: panelTab('skills'),
          panel: 'skills',
          title: 'Find it under Skills',
          text: touch ? 'Every skill you know is on this tab. To get here, open your bag and tap Skills.' : 'Every skill you know is on this tab. Press U to come here, or open it from any panel.',
        },
        {
          target: '.rb-skill-slots',
          panel: 'skills',
          title: 'Choose what you carry',
          text: `${tap} a slot here, then ${touch ? 'tap' : 'click'} a skill in the list to put it in that slot. Change it whenever you like: the bar is your build.`,
        },
      ];
    }
    case 'talents':
      return [
        {
          target: hudButton('Talents'),
          panel: null,
          title: 'Level 10: talents open',
          text: touch ? 'This star opens your talents. A number on it means you have points to spend.' : 'This star opens your talents, or press K. A number on it means you have points to spend.',
        },
        {
          target: c.specChosen ? '.rb-tree-tabs' : '.rb-spec-cards',
          panel: 'talents',
          title: 'Choose a specialization',
          text: 'It sets how your hero plays. You get its ability and its passive, and its talent tree is where your points go first. You can change it later at a cost.',
        },
        {
          target: panelTab('talents'),
          panel: 'talents',
          title: 'Spend your points',
          text: 'You earn one talent point per level from now on, and you spend them in the tree here. Resetting them is free until level 20.',
        },
      ];
    // (a hero at the top level with a Riftstone: the endgame, where it is and what it is for; ui/RiftGuide.tsx has the whole of it)
    case 'rift':
      return [
        {
          target: null,
          panel: null,
          title: 'Level 60: the Rift',
          text: 'The story’s dungeons have a second life. With a Riftstone, any of them can be run again against a clock, harder with every level of the stone. The best gear in the game comes from there, and only from there.',
        },
        {
          target: hudButton('Map'),
          panel: null,
          title: 'Where to go',
          text: `The Riftward, past any waystone on the map${touch ? '' : ' (M)'}: show the Keeper of the Riftgate your stone and choose a dungeon. Each dungeon keeps its own stone: beat one in time and only that one goes deeper. Or take the Riftstone from the title screen, as this hero or a champion. With friends, it’s Play together.`,
        },
        {
          target: null,
          panel: null,
          title: 'What it gives',
          text: 'Beat the clock and that dungeon’s next stones open; late, the run still pays and nothing is lost. Every level raises the item level of what drops, and every new stone you open gives a Rift-forged piece: your class’s set first, then one for each specialization.',
        },
        {
          target: null,
          panel: null,
          title: 'Sigil Marks and the Riftbroker',
          text: 'Every run pays Sigil Marks. The Sigil Quartermaster takes them for wagers: marks on a slot, and one piece for it comes back, sometimes Rift-forged. The whole guide is on the Riftstone panel, under How the Rift works.',
        },
      ];
    // (after Riders for Briarhollow, the quest that gives the first mount: wardrobe.ts FIRST_RIDE)
    case 'riding':
      return [
        {
          target: mountButton(touch),
          panel: null,
          title: 'Level 20: you can ride',
          text: touch
            ? 'Tap the horseshoe to call your mount. Stand still while it comes, and tap it again to get down.'
            : 'Press Y, or click the horseshoe, to call your mount. Stand still while it comes, and press Y again to get down.',
        },
        {
          target: '.rb-seg [data-look-tab="mounts"]',
          panel: 'wardrobe',
          title: 'Choose your mount',
          text: `Every mount you earn waits here, under Wardrobe › Mounts. ${tap} one, then Ride this one. They all run at the same pace, so pick the one you like best.`,
        },
        {
          target: barSlot(touch, 'basic'),
          panel: null,
          title: 'Get down to fight',
          text: 'Attack or cast and you get down first, and a hit knocks you off. You can’t call your mount in a fight, indoors or in a dungeon.',
        },
      ];
  }
}
