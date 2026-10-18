/**
 * A hand-written question: [question, answers, fact]. `answers` is "Right|Wrong|Wrong|Wrong" (two to
 * four answers, the right one first; they are shuffled when shown). The fact is shown after answering.
 */
export type Raw = readonly [question: string, answers: string, fact: string];
