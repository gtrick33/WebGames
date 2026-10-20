import { NUMBERS } from '../numbers'; // PLACEHOLDER
export const NUMBER_TEXT: { q: string; fact: string; unit?: string }[] = NUMBERS.map((n) => ({ q: n.q, fact: n.fact, unit: n.unit }));
