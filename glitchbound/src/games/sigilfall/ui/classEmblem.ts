import type { ClassId } from '../data/types';
import { iconPicture } from '../render/art/gameIcons';

/**
 * A class's emblem wherever a class is picked: the Ring's lobby, the Vigil's and the Rift Trials', and the seats of a
 * party. One picture per class, the same in every one of them (the owner: "use the icons from the ring for the classes
 * in vigil and rifstone, the ones showcased on the pics right now are old"). Each is the class's opening blow in the
 * Ring, named here rather than read off its kit, so a change to the kit doesn't change who the class looks like; and
 * for the Gloamknight a picture of his own, a horned helm with burning eyes (his blow, Gloam Cleave's scythe, could
 * have been anyone's: the owner, "his icon in the character selection screen could be way better").
 */
const EMBLEM: Record<ClassId, string> = {
  warrior: 'great_axe_with_a_bright_red_edge_on_red',
  mage: 'fire_comet_with_a_long_tail_on_navy',
  ranger: 'arrow_shot_with_a_speed_trail_on_green',
  paladin: 'holy_sword_with_light_rays_on_gold',
  priest: 'golden_spear_of_light_on_gold',
  warlock: 'dark_meteor_on_violet',
  druid: 'moonfire_beam_on_navy',
  gloamknight: 'berserker_face_mask_with_red_eyes_on_black',
};

export const classEmblem = (c: ClassId): string => iconPicture(EMBLEM[c]);
