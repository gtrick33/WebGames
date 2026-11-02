import { describe, expect, it } from 'vitest';
import { AUCTION_ITEMS } from '../src/party/content/auction';
import { CHALLENGES } from '../src/party/content/challenges';
import { CHARADES } from '../src/party/content/charades';
import { IMPOSTOR_THEMES } from '../src/party/content/impostor';
import { MYSTERY_WORDS } from '../src/party/content/mystery';
import { NHIE } from '../src/party/content/nhie';
import { SPECTRUMS } from '../src/party/content/spectrums';
import { TRIVIA } from '../src/party/content/trivia';

/** British words with a plain American one (the decks are in American English). */
const BRITISH =
  /\b(holidays?|cinemas?|mum|biscuits?|fringe|car park|bin|bins|till|queues?|lift|lorry|rubbish|trolley|petrol|sledge|torch|jumper|courgette|aubergine|ice lolly|paddling pool|skipping rope|plaster|windscreen|nappy|crisps|sweets|candy floss|chilli|laundrette|launderette|fizzy drink|stag do|table football|advert|pitch|wardrobe|motorway|pavement|duvet|ladybird|motorbike|beetroot|sandpit|caravan|letterbox|postman|tin opener|oven glove)\b/i;

/** Fine in American English too: a dance or ski lift, a power's hint, a holiday as a day off, a musical pitch. */
const OK = new Set(['Big dance lift', 'A ski lift', 'Ski lift', 'Lift', 'Overrated holiday', 'Underrated holiday', 'Pitch']);

const texts = (): string[] => [
  ...CHALLENGES.map((c) => c.text),
  ...CHARADES.map((c) => c.text),
  ...NHIE.map((c) => c.text),
  ...SPECTRUMS.flat(),
  ...TRIVIA.flatMap((q) => [q.q, ...q.options]),
  ...AUCTION_ITEMS.map((i) => i.name),
  ...IMPOSTOR_THEMES.flatMap((t) => t.words.flatMap((w) => w.split('|'))),
  ...MYSTERY_WORDS,
];

describe('party decks', () => {
  it('are in American English', () => {
    expect(texts().filter((s) => BRITISH.test(s) && !OK.has(s))).toEqual([]);
  });

  it('never deal the same prompt card twice', () => {
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const c of CHALLENGES) {
      const key = c.text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '');
      if (seen.has(key)) twice.push(`${seen.get(key)} = ${c.id}`);
      seen.set(key, c.id);
    }
    expect(twice).toEqual([]);
  });
});

describe('party cards', () => {
  it('show both player counts when one phone and online rooms differ', async () => {
    const { PARTY_GAMES, playerRange } = await import('../src/party/catalog');
    const byId = (id: string) => PARTY_GAMES.find((g) => g.id === id)!;
    expect(playerRange(byId('impostor'))).toBe('📱 3–16 · 🌐 3–12');
    expect(playerRange(byId('hues'))).toBe('📱 3–10 · 🌐 2–12');
    expect(playerRange(byId('board'))).toBe('👥 2–8');
    expect(playerRange(byId('scribble'))).toBe('👥 2–10');
  });
});
