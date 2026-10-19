/**
 * PARTY MODE shared types. Party Mode is a pass-the-phone collection: one device, a list of players,
 * and several modes that all draw from the same content registry and challenge engine.
 */

export interface Player {
  id: string;
  name: string;
  /** Token color (board) and accent. */
  color: string;
  emoji: string;
}

/** What happens when a prompt says someone "pays up". Alcohol is always optional. */
export type Consequence = 'points' | 'tasks' | 'sips' | 'none';

/** Content intensity levels, from everyone-friendly to adults only. */
export type Intensity = 'casual' | 'spicy' | 'afterdark';

export interface PartySettings {
  consequence: Consequence;
  /** Intensities allowed in this session (After Dark also needs `adultConfirmed`). */
  intensities: Intensity[];
  adultConfirmed: boolean;
  /** Content tags the group does not want (e.g. 'exes', 'body', 'money'). */
  excludedTags: string[];
  /** Approximate session length in cards / turns. */
  length: 'quick' | 'standard' | 'long';
}

/**
 * Who a challenge is about. The engine picks players for these slots, favouring players who have not
 * been picked recently.
 */
export type Target =
  | 'one' // one player, {A}
  | 'two' // two different players, {A} and {B}
  | 'everyone'
  | 'group-pick' // the group decides who it applies to
  | 'teams' // the players split into two random teams
  | 'leader' // the current points leader, {A}
  | 'trailer' // the player with the fewest points, {A}
  | 'quiet'; // the player who has played the least, {A}

export type ChallengeKind = 'truth' | 'dare' | 'vote' | 'challenge' | 'duel' | 'rule' | 'question' | 'group';

export interface Challenge {
  id: string;
  kind: ChallengeKind;
  intensity: Intensity;
  /** Text with {A}, {B}, {TEAM1}, {TEAM2} placeholders. */
  text: string;
  target: Target;
  /** Extra instruction shown under the prompt. */
  note?: string;
  /** Seconds on a timer, when the challenge is timed. */
  seconds?: number;
  /** Consequence units for refusing / losing (default 1). */
  stakes?: number;
  tags?: string[];
}

export interface NhieStatement {
  id: string;
  /** Text after "Never have I ever ...". */
  text: string;
  category: NhieCategory;
  tags?: string[];
}

export type NhieCategory = 'casual' | 'funny' | 'embarrassing' | 'relationships' | 'spicy' | 'adults';

export type CharadesCategory = 'movies' | 'heroes' | 'animals' | 'jobs' | 'famous' | 'games' | 'internet' | 'cartoons' | 'random' | 'food' | 'sports' | 'music' | 'places' | 'afterdark';

export interface CharadesCard {
  id: string;
  text: string;
  category: CharadesCategory;
  difficulty: 1 | 2 | 3;
}

export interface AuctionItem {
  id: string;
  name: string;
  theme: AuctionTheme;
  /** 1 common .. 3 legendary: shown as a hint, never as an "objective" value. */
  rarity: 1 | 2 | 3;
  emoji: string;
  tags: string[];
}

export type AuctionTheme =
  | 'heroes'
  | 'villains'
  | 'anime'
  | 'screen'
  | 'gaming'
  | 'sports'
  | 'creatures'
  | 'cartoons'
  | 'internet'
  | 'food'
  | 'cars'
  | 'fantasy'
  | 'music'
  | 'history'
  | 'myths'
  | 'powers'
  | 'trips'
  | 'pets';

export interface TriviaQuestion {
  id: string;
  q: string;
  /** First option is the correct one; options are shuffled when shown. */
  options: [string, string, string, string];
  category: string;
}
