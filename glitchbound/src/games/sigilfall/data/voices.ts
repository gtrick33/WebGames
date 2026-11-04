/**
 * How a creature falls: the sound of its kind, so a skeleton clatters, a ghost sighs and a slime bursts. Only a sound:
 * nothing in the rules hangs on it, and a new creature whose name fits none of these simply dies like a person.
 */
const KINDS: readonly [RegExp, string][] = [
  [/slime|ooze|bloat|blob|jelly|spore|vatborn/, 'dieSlime'],
  [/shade|ghost|wraith|specter|spectre|spirit|wisp|soul|phantom|banshee|wailing|marsh-light/, 'dieGhost'],
  [/skeleton|bone|legion|wight|lich|barrow|oathsworn|kneeling|crypt|ashkar|death-knight|hollow-|pale-|ushabti|wrapped|acolyte|necro|sk_/, 'dieBone'],
  [/beetle|spider|scarab|crab|scorpion|wasp|locust|broodling|strider|moth|mite/, 'dieBug'],
  [/ogre|giant|troll|brute|golem|huscarl|colossus|treant|sentinel|horror/, 'dieOgre'],
  [/wolf|hound|boar|bear|beast|raptor|rat|fox|lizard|serpent|viper|wyrm|drake|lurker|imp|ghoul|zombie|drowned|kobold|goblin|mirefin|naga|centaur|stalker/, 'dieBeast'],
];

export function deathSound(def: { id: string; sprite: string }): string {
  const name = `${def.id} ${def.sprite}`;
  return KINDS.find(([re]) => re.test(name))?.[1] ?? 'die';
}
