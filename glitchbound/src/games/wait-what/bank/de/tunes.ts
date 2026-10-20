import { TUNES } from '../tunes'; // STUB
export const TUNE_TEXT: { name: string; fact: string }[] = TUNES.map((t) => ({ name: t.name, fact: t.fact }));
