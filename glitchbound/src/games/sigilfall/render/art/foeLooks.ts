import type { HeroLook, Mat, Piece } from './hero';

/**
 * The people the heroes fight, dressed from the heroes' own wardrobe (the same bodies, faces and pieces), so a bandit
 * stands in the world as the heroes do rather than as a figure from another set. render3d/kits.ts puts each to its
 * foes, with what they hold.
 */
type P = HeroLook['head'];
const piece = <S extends string>(style: S, tint: string, mat: Mat = 'cloth', r: Piece['r'] = 'common'): Piece<S> => ({ style, mat, tint, r });

const foe = (skin: string, hair: string, hairStyle: HeroLook['hairStyle'], head: P, chest: HeroLook['chest'], legs: HeroLook['legs'], extra: Partial<HeroLook> = {}): HeroLook => ({
  skin,
  hair,
  hairStyle,
  head,
  chest,
  legs,
  hands: piece('gloves', '#3a2a1e', 'leather'),
  feet: piece('boots', '#3a2618', 'leather'),
  quiver: null,
  cape: null,
  ...extra,
});

export const FOE_LOOKS: Record<string, HeroLook> = {
  // a cutthroat of the roads: a dark hood, oiled leathers, a mask of shadow
  'foe-cutthroat': foe('#d8a880', '#2a2018', 'short', piece('hood', '#2a2430'), piece('tunic', '#3a3036', 'leather', 'uncommon'), piece('trousers', '#2a2228'), { beard: '#2a2018' }),
  // an archer of the same gang: a brown hood, a quiver
  'foe-bandit-archer': foe('#e0b088', '#5a3a22', 'pony', piece('hood', '#5a4430'), piece('tunic', '#6a5038', 'leather'), piece('trousers', '#4a3a2a'), { quiver: '#6a4428' }),
  // the muscle: iron on the chest, a helm, an axe
  'foe-enforcer': foe('#c89870', '#3a2a1a', 'short', piece('helm', '#6a6470', 'plate'), piece('plate', '#5a5560', 'plate', 'uncommon'), piece('greaves', '#4a4650', 'plate'), { beard: '#3a2a1a', hands: piece('gauntlets', '#4a4650', 'plate'), feet: piece('sabatons', '#3a3640', 'plate') }),
  // the gallows' man: black hood and leathers
  'foe-hangman': foe('#c8a080', '#1a1418', 'short', piece('hood', '#141018'), piece('plate', '#2a2430', 'plate', 'rare'), piece('greaves', '#1e1a22', 'plate'), { cape: '#3a1418' }),
  // a smuggler of the coast: a sea-blue hood over a salt-stained coat
  'foe-smuggler': foe('#d8a478', '#4a2e1a', 'pony', piece('hood', '#2a4a5a'), piece('tunic', '#4a5a5a', 'leather'), piece('trousers', '#3a3a3a'), { beard: '#4a2e1a' }),
  // desert raiders: sand-colored wraps
  'foe-dune-raider': foe('#b8805a', '#1a1410', 'short', piece('hood', '#d8c090'), piece('tunic', '#c8a870', 'cloth'), piece('trousers', '#a88a5a')),
  'foe-dune-javelineer': foe('#b07a52', '#1a1410', 'pony', piece('hood', '#c8b080'), piece('tunic', '#b8986a', 'leather'), piece('trousers', '#9a7a50'), { quiver: '#8a6a40' }),
  // a serpent cultist: a green robe and hood
  'foe-serpent-cultist': foe('#d8b090', '#2a2a1a', 'long', piece('hood', '#3a6a3a'), piece('robe', '#2e5a34', 'cloth', 'uncommon'), piece('trousers', '#1e3a22'), { cape: '#1e3a22' }),
  // a hedge-witch of the wild: a wide hat, a patched brown robe
  'foe-hedge-witch': foe('#d8b098', '#8a8a7a', 'long', piece('wizard', '#4a3a2a'), piece('robe', '#5a4a34', 'cloth', 'uncommon'), piece('trousers', '#3a3024'), { female: true }),
  // a witch of the blight: rot-green
  'foe-blight-witch': foe('#b8c0a0', '#3a3a2a', 'long', piece('wizard', '#3a4a2a'), piece('robe', '#4a5a2a', 'cloth', 'rare'), piece('trousers', '#2a3218'), { female: true, cape: '#2a3218' }),
  // the Coffin Matron of the Chapel Crypt: a widow's black veil over a bone-white burial shroud, grave-pale skin
  'foe-coffin-matron': foe('#c8c4b8', '#e8e4dc', 'long', piece('hood', '#16121c'), piece('robe', '#d8d2c0', 'cloth', 'rare'), piece('trousers', '#8a8474'), { female: true, cape: '#16121c', hands: null, feet: piece('shoes', '#2a2430', 'leather') }),
  // Vizier Khepset of the Tomb: the dead king's crown of office in gold, a bone-white robe, a mantle of the sun's gold
  'foe-vizier-khepset': foe('#b89870', '#1a1410', 'short', piece('crown', '#ffd27a', 'plate', 'epic'), piece('robe', '#efe4c8', 'cloth', 'epic'), piece('trousers', '#c8b890'), { cape: '#d8a830', beard: '#1a1410', hands: piece('gloves', '#d8a830', 'cloth'), feet: piece('shoes', '#c8a050', 'leather') }),
  // a brother of the plague: a stained cleric's robe
  'foe-brother-pustule': foe('#c8b890', '#5a5a3a', 'short', piece('hood', '#6a6a3a'), piece('robe', '#7a7a4a', 'cloth', 'rare'), piece('trousers', '#4a4a2a')),
  // a poacher of the Whisperwood: green and brown, a bow
  'foe-briar-poacher': foe('#d8a880', '#6a4428', 'short', piece('hood', '#3a5a2e'), piece('tunic', '#4a5a30', 'leather'), piece('trousers', '#4a3a24'), { quiver: '#5a3a1e', beard: '#6a4428' }),
  // ---- the land's own people, where a story or a fight calls for one without a face of their own: dressed as the
  // heroes are, so no one in the world wears another set's overalls, goggles or a soldier's vest
  // a villager: plain wool, a hood against the weather
  'folk-villager': foe('#e0b088', '#6a4a2a', 'short', piece('hood', '#6a5a40'), piece('tunic', '#7a6a4a'), piece('trousers', '#4a3a2a'), { hands: null, apron: '#c9b896' }),
  // a smith: a leather apron over bare arms, a beard, a hammer
  'folk-smith': foe('#d0986a', '#3a2418', 'short', null, piece('tunic', '#5a4030', 'leather'), piece('trousers', '#3a2c22', 'leather'), { beard: '#3a2418', apron: '#4a3020', hands: piece('gloves', '#2a1c14', 'leather') }),
  // an elder: a long grey robe, a white beard
  'folk-elder': foe('#e0b898', '#e8e4dc', 'long', null, piece('robe', '#5a6a5a', 'cloth', 'uncommon'), piece('trousers', '#3a4038'), { beard: '#e8e4dc', hands: null, feet: piece('shoes', '#4a3a2a', 'leather') }),
  // a hedge-mystic: a pointed hat and a starry robe
  'folk-mystic': foe('#e0b8a0', '#8a6aa0', 'long', piece('wizard', '#3a2a5a'), piece('robe', '#4a3a6a', 'cloth', 'rare'), piece('trousers', '#2a2440'), { female: true, cape: '#2a2440', hands: null }),
  // Varric, the gang's captain: black-iron plate under a dark hood, a beard like a hedge
  'foe-varric': foe('#c89870', '#2a1e14', 'short', piece('hood', '#1e1a20'), piece('plate', '#3a3440', 'plate', 'rare'), piece('greaves', '#2a2630', 'plate'), { beard: '#2a1e14', cape: '#4a1418', hands: piece('gauntlets', '#2a2630', 'plate'), feet: piece('sabatons', '#24202a', 'plate') }),
  // Saltbeard, the smugglers' captain: a sea-coat, a salt-white beard
  'foe-saltbeard': foe('#c8946a', '#e8e0d0', 'short', piece('hood', '#1e3a4a'), piece('tunic', '#2a4a5a', 'leather', 'rare'), piece('trousers', '#2a2a30'), { beard: '#e8e0d0', cape: '#1a2a3a' }),
};
