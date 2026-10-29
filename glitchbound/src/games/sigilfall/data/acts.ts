/**
 * The tale's acts (STORY_BIBLE.md §3), each opened by the quest that begins it: as that quest is taken, the
 * act's title comes up over the world (engine.ts), once.
 */
export interface ActDef {
  id: string;
  /** Over the title: "Act II", "Prologue". */
  over: string;
  name: string;
  /** The quest that begins it. */
  opens: string;
}

export const ACTS: ActDef[] = [
  { id: 'prologue', over: 'Prologue', name: 'The Night the Bells Stopped', opens: 'briar-dusk' },
  { id: 'act-1', over: 'Act I', name: 'The Villages of the Vale', opens: 'south-road' },
  { id: 'act-2', over: 'Act II', name: 'Road to the Crown City', opens: 'the-sick-villages' },
  { id: 'act-3', over: 'Act III', name: 'The Broken Alliance', opens: 'the-sun-kings-tomb' },
  { id: 'act-4', over: 'Act IV', name: 'War of the Three Gates', opens: 'the-wall-burns' },
  { id: 'act-5', over: 'Act V', name: 'The Dead Kingdom', opens: 'into-vaelmoor' },
  { id: 'act-6', over: 'Act VI', name: 'The Last March', opens: 'the-last-march' },
  { id: 'crownfall', over: 'The Finale', name: 'Crownfall', opens: 'the-hollow-king' },
  { id: 'epilogue', over: 'Epilogue', name: 'The Bell', opens: 'epilogue-the-camp-goes-home' },
];
