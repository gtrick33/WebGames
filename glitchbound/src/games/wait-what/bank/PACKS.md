# Quizbelief language packs

English is built in. Every other language is a folder here, `bank/<lang>/`, named with its site
language code (`bg`, `de`, `es`, `fr`, `it`, `nl`, `pl`, `pt`, `ro`, `tr`, `uk`). Its `index.ts`
exports `PACK: Pack` (see `pack.ts`). `loadPack()` finds folders on its own, and the folder only
downloads for people who play in that language. **`bg/` is the finished example: copy its shape.**

A pack only goes live when the language is added to `contentLangs` in `src/catalog/games.ts`. That
switch is done centrally once a pack is finished, so a pack never touches files outside its folder.

## What a pack contains

| Part | Where (in `bg/`) | Rule |
|---|---|---|
| Hand-written questions | `history.ts` … `myths.ts`, `bulgaria.ts`, `growth.ts` | **Translations, same order, same count.** Three batches, with `since` taken from `EN.batches[k].since`. |
| Timeline events | `timeline.ts` (`EVENT_TEXT`) | Translations, same order (175). Years and art come from English. |
| Lever questions | `numbers.ts` (`NUMBER_TEXT`) | Translations of `q`, `fact`, `unit`, same order (40). Answers come from English. |
| Tunes | `tunes.ts` (`TUNE_TEXT`) | The name the tune is known by in this language, plus the fact, same order (23). |
| Words of the world | `lexicon.ts` (`WORLD_TEXT`, `worldWords`) | Same order and count (34): the language name and meaning in this language. If an entry comes from *this* language (a German word in the German pack), swap in a fun word from another language instead. |
| Real words that sound fake | `lexicon.ts` (`ODD_WORDS`) | **Your own list** of at least 40 genuine words of this language that sound invented (old, regional, borrowed, or just odd). Tag near-synonyms with the same group so they're never offered as each other's wrong answer. |
| Typed answers | `typed.ts` | **Your own list**, at least 20 (bg has 30). Accepted answers are separated by `\|`, the first is shown. |
| Emoji puzzles | `emoji.ts` | **Your own lists**: film and book titles as known in this country, and native sayings (bg: 26 + 12). Four unique answers each, right one first. |
| Sentences | `index.ts` (`text`) | Every `PackText` sentence, written naturally. `articles` drops a leading article from typed answers (a regex, or `null` if the language has none). |
| On-screen text | `ui.ts` → `index.ts` (`ui`) | The whole `Ui` from `../ui.ts`, translated. bg keeps its own in `../ui.ts`; new languages put it in their folder. |
| Answer sets kept in order | `index.ts` (`fixedOrder`) | True/False, Myth/Fact, Yes/No, in that order. Use exactly these words wherever English uses those sets. |

## Rules for the hand-written questions

- **Never reorder, add or drop a question.** A question's id is its position, and the daily quiz and
  friends' challenges must pick the same questions in every language.
- **Same number of answers, right answer first.** Wrong answers can change if a literal translation
  would give the game away. Keep all answers different from each other.
- **True/False, Myth/Fact and Yes/No** questions use exactly the pack's `fixedOrder` words, with the
  right one first, just like English.
- **Write it the way a native speaker would say it,** not word for word. Every question should still
  make a player say "wait, what?". Keep the twist, the facts and the numbers.
- **Questions about English words** (the `words` category, puns, spellings): do what bg does. Ask about
  the English word and gloss it, as in „Как се нарича на английски…“, or explain it in the fact. Where
  your own language has a fun link (bg: „азбука“ from „аз“ + „буки“), add it to the fact.
- **Local formats:** decimal comma where the language uses one, thousands spacing, quotation marks
  („…“, «…», "…"), and metric units. No straight `'` inside strings (use `’`), or escape it.
- **Short answers:** aim for 60 characters or fewer. The test fails above 72.
- **Facts stay true.** If a translation forces a change, check the fact again.

## Checking your work

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npx vitest run tests/wait-what-packs.test.ts   # checks every pack folder against English
npm run check                                   # types, lint, all tests, build
```

`tests/wait-what-packs.test.ts` finds your folder on its own. It checks that every list lines up,
answer counts and order sets match, the daily and challenges pick the same questions as English, and
a long endless run plays.
