import { describe, expect, it } from 'vitest';
import { newCharacter } from '../src/games/sigilfall/progress/character';
import { storedHero, validateCharacter } from '../src/games/sigilfall/progress/save';

describe('Sigilfall: the title a hero wears is kept when the game opens again', () => {
  it('keeps a title the team gave (its id is `given-` and the grant’s 36-letter id), as well as the game’s own', () => {
    for (const id of ['given-3f2b8c1e-9a4d-4f7e-8b21-6c0d5e4a9f13', 'ring-1700', 'champion', '']) {
      const c = newCharacter('mage', 'Ash', 'a', 0);
      c.title = id;
      const back = validateCharacter(JSON.parse(JSON.stringify(storedHero(c))), 0);
      expect(back?.title, id).toBe(id);
    }
  });

  it('still refuses what is no title id', () => {
    const c = newCharacter('mage', 'Ash', 'a', 0);
    const raw = { ...storedHero(c), title: '<b>x</b>' };
    expect(validateCharacter(JSON.parse(JSON.stringify(raw)), 0)?.title).not.toBe('<b>x</b>');
  });
});
