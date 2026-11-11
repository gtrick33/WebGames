/** The Vigil is the campaign's own: its classes' spells by name and picture, its lands, and sounds made of what a spell is. */
import { describe, expect, it } from 'vitest';
import { SAMPLES } from '../src/games/sigilfall/audio/samples';
import { SFX } from '../src/games/sigilfall/audio/sound';
import { SONGS } from '../src/games/sigilfall/audio/songs';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import { SKILL_ICON } from '../src/games/sigilfall/render/art/iconPicks';
import { fxSound } from '../src/games/sigilfall/ui/VigilScreen';
import { ALL_SPELLS, spellsOf, VIGIL_MAPS, type Element } from '../src/games/sigilfall/vigil/kit';
import { TIDE_MAX, TIDE_START, Vigil, type Fx } from '../src/games/sigilfall/vigil/sim';

describe('The Vigil: the campaign’s own', () => {
  it('every spell is one of its class’s campaign skills, by name and by picture', () => {
    const skills = Object.values(SKILLS);
    for (const cls of CLASS_IDS) {
      const kit = spellsOf(cls);
      expect(kit, cls).toHaveLength(6);
      for (const s of kit) {
        // (a mage's motes are their Arcane Bolt, many of them)
        const known = skills.find((k) => k.cls === cls && (k.name === s.name || `${k.name}s` === s.name));
        expect(known, `${cls}: ${s.name} is not a campaign skill of the class`).toBeTruthy();
        expect(s.icon, `${cls}: ${s.name}`).toBe(SKILL_ICON[known!.id]);
      }
      expect(new Set(kit.map((s) => s.name)).size, cls).toBe(6);
    }
    // nothing an upgrade is called is also a spell of the same class (two cards with one name)
    for (const s of ALL_SPELLS) expect(spellsOf(s.cls).some((o) => o.name === s.sig.name), `${s.cls}: ${s.sig.name}`).toBe(false);
  });

  it('every land is a land of the story, with its own song for the night', () => {
    for (const m of VIGIL_MAPS) {
      const r = REGIONS[m.region];
      expect(r, m.id).toBeTruthy();
      expect(r.kind, m.id).toBe('wild');
      expect(SONGS[r.music as keyof typeof SONGS], m.id).toBeTruthy();
    }
    expect(SONGS.boss).toBeTruthy();
  });

  it('every effect of every element has a sound, and each is a real one', () => {
    const kinds: Fx['kind'][] = ['nova', 'chain', 'strike', 'drop', 'burst', 'hit', 'cone', 'beam', 'heal', 'guard', 'dash', 'level', 'frenzy', 'summon', 'slam', 'bomb'];
    const els: Element[] = ['fire', 'ice', 'lightning', 'arcane', 'nature', 'poison', 'holy', 'shadow', 'water', 'blood'];
    for (const k of kinds) {
      for (const el of els) {
        const s = fxSound(k, el);
        expect(s, `${k} ${el}`).toBeTruthy();
        expect(!!SAMPLES[s![0]] || !!SFX[s![0]], `${k} ${el}: ${s![0]}`).toBe(true);
        expect(s![1]).toBeGreaterThan(0.05);
        expect(s![2]).toBeLessThanOrEqual(1);
      }
    }
    // (a casting flourish is silent: the spell itself is what is heard)
    expect(fxSound('cast', 'fire')).toBeUndefined();
    // steel for a warrior, fire and frost for a mage
    expect(fxSound('hit', 'blood')![0]).toBe('clash');
    expect(fxSound('burst', 'fire')![0]).toBe('explode');
    expect(fxSound('nova', 'ice')![0]).toBe('freeze');
  });

  it('the Host is a crowd from the first seconds, and the first champion is the gentlest', () => {
    expect(TIDE_START).toBeGreaterThanOrEqual(2);
    expect(TIDE_MAX).toBeGreaterThan(TIDE_START * 8);
    const v = new Vigil(3, 2000, 2000);
    for (let t = 0; t < 20; t += 1 / 30) {
      if (v.cards) v.choose(0);
      v.step(1 / 30, { mx: 0, my: 0 });
    }
    // (standing still for twenty seconds: forty or more have come)
    expect(v.kills + v.foes.length).toBeGreaterThanOrEqual(40);
    // the champions, by what they have when they come
    const champion = (at: number): { hp: number; dmg: number } => {
      const n = new Vigil(4, 2000, 2000);
      n.me.hp = 1e9;
      let seen: { hp: number; dmg: number } | null = null;
      for (let t = 0; t < at + 2 && !seen; t += 1 / 20) {
        if (n.cards) n.choose(0);
        n.step(1 / 20, { mx: 0, my: 0 });
        n.me.hp = 1e9;
        // (the one that has just come: any before it are still about)
        if (n.t >= at) {
          const b = n.foes.filter((f) => f.boss).sort((a, c) => c.id - a.id)[0];
          if (b) seen = { hp: b.maxHp, dmg: b.dmg };
        }
      }
      return seen!;
    };
    const first = champion(150);
    const second = champion(300);
    expect(first.hp).toBeLessThan(second.hp);
    expect(first.dmg).toBeLessThan(second.dmg);
  }, 60_000);
});
