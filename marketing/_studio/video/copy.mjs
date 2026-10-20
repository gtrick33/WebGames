// Per-game creative: the cuts (from the bot-played takes), hooks, captions, end-card lines and music
// for each game's spotlight and challenge videos.
//
// Times use video/marks.mjs: plain seconds, 'end', or [mark, index, offset] into the take's marks
// (written by the bots in capture/bots/), so a re-recorded take keeps its edit in sync. Caption and
// sticker times are seconds of the finished video, or a mark in the spotlight's take a.
// Text may use {mark.field} tokens (e.g. {solved.rows}), filled from the take's marks.
// Copy rules: honest claims only (no made-up stats), no emoji in on-screen text, short lines.

export const GAMES = {
  'wing-it': {
    music: 'pixel-dash', color: '#7fd7ff',
    hooks: ['This tiny bird made it to *space*', 'One tap. *Four skies.* How far can you fly?', 'POV: "one more flight" *an hour ago*'],
    clips: [{ from: ['takeoff', 0, 0.3], len: 4.5 }, { from: ['biome', 0, -1.7], len: 4 }, { from: ['biome', 1, -1.6], len: 4 }, { from: ['biome', 2, -1.5], to: 'end' }],
    captions: [['One tap to *flap*', 2.6], ['*Sunset* at 15', 4.9], ['*Night* at 30', 8.9], ['*Space* at 45', 13.2]],
    stickers: [['{crash.score} gaps!', ['crash', 0, 0.5], '#ffc928']],
    outro: 'Can you reach *space*?',
    challenge: { take: 'b', from: 0.5, to: 'end', speed: 1.3, score: 'Score to beat: *{crash.score} gaps*' },
  },
  gloop: {
    music: 'brain-snack', color: '#b98cff',
    hooks: ['Two of a kind *squish* together', 'The jelly jar you *can’t stop* filling', 'How big can you *grow* it?'],
    clips: [{ from: 0.5, len: 5.5 }, { from: 14, len: 5.5 }, { from: 30, len: 5.5 }, { from: ['end', 0, -12.5], to: 'end' }],
    captions: [['Drop the *jelly*', 2.8], ['Twins *squish* into a bigger blob', 6], ['Bigger...', 11.5], ['Just don’t let it *overflow*', 17]],
    outro: 'Fill the jar.|*Don’t overflow.*',
    challenge: { take: 'b', from: 0.5, to: 'end', speed: 1.4, score: 'Can you beat this jar?' },
  },
  'neon-rush': {
    music: 'neon-nights', color: '#ff3fd2',
    hooks: ['An endless neon racer *in your browser*', 'Chain *near misses*. Go faster.', 'How long would *you* last?'],
    clips: [{ from: 0.5, len: 6 }, { from: 20, len: 5 }, { from: 38, len: 5 }, { from: ['crash', 0, -8.5], to: 'end' }],
    captions: [['Tap *left*. Tap *right*.', 2.8], ['Weave through *traffic*', 6.6], ['Grab the *coins*', 11.6], ['It only gets *faster*', 16.6]],
    outro: 'Beat my *distance*',
    challenge: { take: 'b', from: 0.3, to: 'end', speed: 1.3, score: 'Beat this run' },
  },
  'mini-racer': {
    music: 'neon-nights', color: '#ff5a6c',
    hooks: ['Last on the grid. *Watch this.*', 'A tiny racer you steer with *two thumbs*', 'Drift. *Overtake.* Win.'],
    clips: [{ from: 0, len: 5 }, { from: 7.5, len: 5.5 }, { from: 19, len: 5 }, { from: ['finish', 0, -8.8], to: 'end' }],
    captions: [['Start from the *back*', 2.8], ['Hold left or right. *Gas is automatic.*', 5.4], ['Drift past the *rivals*', 10.6], ['Finish: *P{finish.position}*', ['finish', 0, 0.4]]],
    outro: 'Race *3 AI rivals*',
    challenge: { take: 'b', from: 0, to: 'end', speed: 1.6, score: 'Frost Peak. *Beat my time.*' },
  },
  'color-lab': {
    music: 'brain-snack', color: '#12c6b3',
    hooks: ['The most *satisfying* way to sort colors', 'Pour until every tube is *one color*', 'Can you solve it *at par*?'],
    clips: [{ from: 0.5, len: 13, speed: 1.25 }, { from: ['won', 0, -9], to: ['won', 0, 1.6], speed: 1.15 }, { from: ['won', 1, -5], to: 'end' }],
    captions: [['Pour onto the *same color*', 2.8], ['Or into an *empty tube*', 6.6], ['Every tube *one color*', ['won', 0, 0.1]]],
    outro: 'New puzzles|*every day*',
    challenge: { take: 'b', from: 0.5, to: 'end', speed: 1.2, score: 'Large board. *Your move.*' },
  },
  'square-deal': {
    music: 'pixel-dash', color: '#ff6a1a',
    hooks: ['Drop blocks. *Clear lines.* Repeat.', 'That moment when *two rows* clear at once', 'Block puzzle, but *chain the clears*'],
    clips: [{ from: 0.5, to: 'end', speed: 1.25 }],
    captions: [['Drag a piece onto the *board*', 2.8], ['Fill a row or column to *clear it*', 6.4], ['*Clear!*', ['clear', 0, 0.1]], ['Clear lines back to back for a *streak*', ['clear', 1, 0.1]]],
    outro: 'How long can your|*streak* go?',
    challenge: { take: 'b', from: 0.5, to: 'end', speed: 1.3, score: 'Beat my *streak*' },
  },
  'outta-here': {
    music: 'brain-snack', color: '#2ad1f0',
    hooks: ['Every arrow wants *off the board*', 'Tap them in the *right order*', 'One wrong tap costs *a heart*'],
    clips: [{ from: 0.5, len: 8, speed: 1.2 }, { from: ['bump', 0, -3], to: ['bump', 0, 2.2] }, { from: ['cleared', -1, -7.5], to: ['cleared', -1, 1.2], speed: 1.2 }],
    captions: [['Tap an arrow to *send it off*', 2.8], ['Blocked? That costs a *heart*', ['bump', 0, -0.3]], ['Order is *everything*', ['cleared', -1, -6.5]], ['Board *cleared*', ['cleared', -1, 0.2]]],
    outro: 'Clear the board.|*Keep your hearts.*',
    challenge: { take: 'b', from: 0.5, to: 'end', speed: 1.8, score: 'Level 5. *Flawless?*' },
  },
  'star-grid': {
    music: 'lofi-lobby', color: '#7b4dff',
    hooks: ['One star per *row, column and color*', 'A logic puzzle with *one rule*', 'Watch it get *solved*'],
    clips: [{ from: 0, len: 10 }, { from: ['oops', 0, -1], to: ['oops', 0, 3.2] }, { from: ['solved', 0, -7], to: 'end' }],
    captions: [['One star in every *row*', 2.4], ['...every *column*...', 4.6], ['...and every *color*', 6.8], ['Wrong? It turns *red*', ['oops', 0, 0.4]], ['No two touching. *Not even diagonally.*', ['solved', 0, -6.5]], ['*Solved!*', ['solved', 0, 0.3]]],
    outro: 'Three new grids|*every day*',
    challenge: { take: 'b', from: 0, to: 'end', speed: 1, score: '8 by 8. *Beat my time.*' },
  },
  'memory-grid': {
    music: 'tick-tock', color: '#ffb7d5',
    hooks: ['Watch it light up. *Tap it back.*', 'How long is *your* memory?', 'The grid keeps *growing*'],
    clips: [{ from: 0.5, to: ['clear', 0, 0.4] }, { from: ['clear', 5, -9], to: ['clear', 5, 0.5] }, { from: ['miss', 0, -9], to: 'end' }],
    captions: [['Watch the *pattern*', 2.0], ['Tap it back *in order*', ['clear', 0, -2.6]], ['The grid *grows*', ['clear', 5, -8.5]], ['Round 9...', ['miss', 0, -8.5]], ['Missed *one*!', ['miss', 0, 0.2]]],
    outro: 'How far can|*you* go?',
    challenge: { take: 'b', from: 0.5, to: 'end', speed: 1.5, score: 'Round 7. *Beat it.*' },
  },
  'color-recall': {
    music: 'lofi-lobby', color: '#ff4fc8',
    hooks: ['You get *3 seconds* to remember this color', 'Mix a color *from memory*', 'Do you have a *perfect* color memory?'],
    clips: [{ from: 0.5, len: 9.5 }, { from: ['reveal', 0, -4.5], to: ['reveal', 0, 2.6] }, { from: ['reveal', 2, -3.5], to: ['reveal', 2, 2.4] }, { from: ['done', 0, -1.2], to: 'end' }],
    captions: [['Look *closely*...', 1.6], ['Now mix it *from memory*', 4.2], ['Hue, saturation, *brightness*', 7], ['How close?', ['reveal', 0, -0.6]], ['*{done.accuracy}%* from memory', ['done', 0, 0.2]]],
    outro: 'Five colors|*every day*',
    challenge: { take: 'b', from: 0.5, to: 'end', speed: 1.4, score: 'Beat my *score*' },
  },
  'letter-pinch': {
    music: 'brain-snack', color: '#b6e62c',
    hooks: ['A daily word puzzle that is *not* the one you think', 'Every tile points *up or down* the alphabet', 'Five letters. *Six guesses.* Arrows only.'],
    clips: [{ from: 0, to: ['guess', 0, 1.5] }, { from: ['guess', 1, -4.5], to: ['guess', 1, 1.5] }, { from: ['solved', 0, -5], to: 'end' }],
    captions: [['Guess a *5-letter word*', 2.0], ['Up = *later* in the alphabet', ['guess', 0, 0.3]], ['Down = *earlier*', ['guess', 1, -4.2]], ['Got it in *{solved.rows}*', ['solved', 0, 0.3]]],
    outro: 'A new word|*every day*',
    challenge: { take: 'b', from: 0, to: 'end', speed: 0.9, score: 'Solved in *{solved.rows}*. Can you?' },
  },
  crosswire: {
    music: 'lofi-lobby', color: '#ffc928',
    hooks: ['The crossword where clues live *inside* the grid', 'Follow the arrows. *Crack the mystery word.*', 'A crossword you can finish *on the bus*'],
    clips: [{ from: 0, len: 11 }, { from: ['grid', 0, -6], to: ['grid', 0, 1.5] }, { from: ['wrong-mystery', 0, -1.5], to: 'end' }],
    captions: [['Clues live *in the grid*', 1.6], ['Follow the *arrows*', 5], ['Then the circled letters...', ['grid', 0, 0.4]], ['Not quite...', ['wrong-mystery', 0, 0.3]], ['...spell *{mystery.word}*', ['mystery', 0, 0.1]]],
    outro: 'A fresh grid|*every day*',
    challenge: { take: 'b', from: 0, to: 'end', speed: 1.15, score: 'Medium grid. *Speedrun.*' },
  },
  'wait-what': {
    music: 'brain-snack', color: '#ffc928',
    hooks: ['Trivia that sounds *made up*', 'Real facts. *Sound fake.*', '10 weird questions *every day*'],
    clips: [{ from: ['answer', 0, -1.8], len: 9 }, { from: ['answer', 2, -1.6], len: 9.5 }],
    captions: [['Sounds *made up*...', 2.6], ['...but it’s *true*', 6.6], ['Weird history, odd animals, *strange words*', 11]],
    outro: '*10 new questions*|every day',
  },
  'gut-check': {
    music: 'tick-tock', color: '#ff4fc8',
    hooks: ['*Higher or lower?* Trust your gut.', 'One wrong call and *it’s over*', 'How long can *your* streak go?'],
    clips: [{ from: 0.5, len: 19.5, speed: 1.2 }, { from: ['miss', 0, -6.5], to: 'end' }],
    captions: [['Is the next one *more or less*?', 2.8], ['Rivers, countries, *animals*...', 7.6], ['One wrong call *ends it*', ['miss', 0, -0.6]]],
    outro: 'Trust your *gut*',
    challenge: { take: 'b', from: 0.5, to: 'end', speed: 1.3, score: 'Streak to beat: *{miss.streak}*' },
  },
  'to-scale': {
    music: 'brain-snack', color: '#3d5bff',
    hooks: ['Drag it to its *real size*', 'How big is it *really*?', 'Your sense of scale is *probably wrong*'],
    clips: [{ from: 0.5, to: ['lock', 0, 3.5] }, { from: ['lock', 2, -5], to: ['lock', 2, 3.2] }, { from: ['lock', 4, -4], to: ['lock', 4, 3.5] }],
    captions: [['Size it up', 2.8], ['Drag it to its *real size*', 5.6], ['Then see the *real thing*', ['lock', 0, 0.6]], ['Closer than you\u2019d think?', ['lock', 2, -4.5]]],
    outro: 'Five shots|*every day*',
  },
  'spot-the-glitch': {
    music: 'tick-tock', color: '#b6e62c',
    hooks: ['Two pictures. *Five glitches.*', 'Spot the difference, but *against the clock*', 'Every find adds *8 seconds*'],
    clips: [{ from: 0.5, to: ['found', 2, 0.8] }, { from: ['miss', 0, -1.5], to: ['miss', 0, 6] }, { from: ['found', -2, -2], to: ['found', -1, 1.2] }],
    captions: [['Find all *five*', 2.8], ['Every find: *+8 seconds*', ['found', 1, 0.2]], ['Wrong spot? *Keep looking.*', ['miss', 0, 0.2]], ['Last one!', ['found', -1, -1.2]]],
    outro: 'New pictures|*every day*',
  },
  'wheres-the-ball': {
    music: 'tick-tock', color: '#9be15d',
    hooks: ['There’s a *tennis ball* in every photo', 'Zoom in. Aim. *Lock it in.*', 'Can you find it *first try*?'],
    clips: [{ from: 0.5, len: 8.5 }, { from: ['wrong', 0, -2], to: ['wrong', 0, 3] }, { from: ['found', 0, -5], to: ['found', 0, 2.2] }, { from: ['found', -1, -4], to: ['found', -1, 2] }],
    captions: [['One ball. *Every photo.*', 2.8], ['Zoom in...', 5.5], ['Wrong guess? *Look again.*', ['wrong', 0, 0.3]], ['There it is!', ['found', 0, 0.6]]],
    outro: 'A new ball|*hides every day*',
  },
  fussbox: {
    music: 'brain-snack', color: '#1f9e6a',
    hooks: ['This robot has a *secret rule*', 'Feed it cards. *Crack its taste.*', 'Can you read a robot’s *mind*?'],
    clips: [{ from: 0, to: ['feed', 0, 1.5] }, { from: ['feed', -1, -4], to: ['feed', -1, 2.2] }, { from: ['handin', 0, -9], to: 'end' }],
    captions: [['It has a *secret rule*', 1.8], ['Feed it cards: *ding* or *buzz*', ['feed', 0, 0.4]], ['Cracked it? *Take the exam.*', ['handin', 0, -8.5]], ['"*{handin.rule}*"', ['handin', 0, 1.2]]],
    outro: 'A new rule|*every day*',
  },
  whatsit: {
    music: 'brain-snack', color: '#ff8a1f',
    hooks: ['Something is hiding *in this box*', 'Twenty questions, but you pick from a *line-up*', 'Fewer questions, *more points*'],
    clips: [{ from: 0, to: ['ask', -1, 2.5] }, { from: ['pick', 0, -9], to: 'end' }],
    captions: [['A secret thing *in a box*', 1.6], ['Ask *yes or no*', ['ask', 0, 0.2]], ['Then pick it from the *line-up*', ['pick', 0, -8.5]], ['It\u2019s a *{pick.name}*!', ['pick', 0, 0.4]]],
    outro: 'A new box|*every day*',
  },
};

/** Party Mode pieces (cut on the marks the party bot writes). */
export const PARTY = {
  impostor: {
    hooks: ['Game night with *one phone*', 'Everyone knows the word. *Except one.*', 'Find the *impostor*'],
    clips: [{ slug: 'party-impostor', from: ['players', 0, -4.6], to: ['pick', 0, 3.2] }, { slug: 'party-impostor', from: ['pick', 0, 3.2], to: ['vote', 0, -1.6], speed: 1.9 }, { slug: 'party-impostor', from: ['vote', 0, -1.6], to: 'end' }],
    captions: [['Add your *friends*', 1.0], ['Pass the phone *around*', ['pass', 0, 0.2]], ['Everyone peeks at a *secret card*', ['pass', 1, 0.2]], ['One card says *impostor*', ['impostor-card', 0, 0.2]], ['Talk. Then *vote*.', ['talk', 0, 0.3]], ['*Caught!*', ['result', 0, 0.2]]],
  },
};
