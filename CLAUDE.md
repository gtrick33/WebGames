# WebGames — rules for every session

## Every change goes through a pull request (owner's rule, 2026-10-27)

Every new addition to a game goes into `pre-release` through a pull request that the owner (gtrick33) reviews
and merges personally. That covers:

- a new game;
- a feature, mode, level or content;
- art, sound, balance or a fix.

Changes outside the games (the site, CI, docs) go the same way. Nothing is pushed straight to `pre-release`.
The only exception is a change the owner names in chat as one to push directly.

- **Never merge a pull request, enable auto-merge, or push to `pre-release` yourself.** The merge is the
  owner's approval. Merging deploys: CI deploys every push to `pre-release`.
- **Branch:**
  - Cut `claude/<short-topic>` from `origin/pre-release`.
  - Work on it in its own git worktree (`git worktree add <dir> -b claude/<topic> origin/pre-release`) or in
    the worktree the app gave the session.
  - Never `git checkout` a branch in the shared checkout at the repository root. Other sessions work there
    at the same time.
- **Before opening the pull request,** the checks pass in `glitchbound/`:
  - `npm run typecheck`;
  - `npm run lint`;
  - `npx vitest run --no-fsModuleCache`;
  - `npx vite build && node scripts/build-games.mjs && node scripts/size-report.mjs`.
- **Open it with `gh pr create --base pre-release`:**
  - The title is the commit summary (`GlitchBound: …`).
  - The body says what changed, how it was checked (tests, screenshots, the browser) and what wasn't
    verified.
  - Add `Closes #<n>` for each GitHub issue it fixes, so merging closes them.
- **While the PR is open:**
  - CI doesn't run on it unless it has the `run-ci` label (Actions minutes are limited, and the checks above already
    ran). A push to `pre-release` is always checked, then deployed.
  - Fixes and the owner's review comments land as new commits on the same branch.
  - One pull request per piece of work. Don't stack unrelated changes.
- **After the merge,** delete the branch and the worktree.

GitHub can't enforce this rule: branch protection on a private repository needs a paid plan, and a pull
request's author can't approve their own pull request. So it holds because every session follows it.

## Other standing rules

- Commit by explicit pathspec, never `git add -A`. Other sessions may have changes in the shared checkout.
- Never run `prettier --write`. The style is kept by hand.
- Player-facing text is in American English.
- Never copy another game's names, art, card text, item sets or signature colors. Copy only rules.
  `glitchbound/src/games/sigilfall/LEGAL_REVIEW.md` has the record.
- Licensed art packs stay out of the repository (`glitchbound/assets/sigilfall/` is ignored). Only built
  atlases ship.
- Commit messages end with the session's Co-Authored-By line; pull request bodies end with its
  "Generated with" line.
