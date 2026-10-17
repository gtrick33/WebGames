import { DEFAULT_SKIN_ID, SKINS, getSkin, isKnownSkin, type SkinDef } from './skins';
import type { Profile } from '../progression/profile';

export type BuyResult = 'ok' | 'owned' | 'insufficient' | 'not_for_sale' | 'unknown';

export function owns(profile: Profile, skinId: string): boolean {
  return profile.ownedSkins.includes(skinId);
}

export function buySkin(profile: Profile, skinId: string): BuyResult {
  if (!isKnownSkin(skinId)) return 'unknown';
  if (owns(profile, skinId)) return 'owned';
  const skin = getSkin(skinId);
  if (skin.unlock.type !== 'coins') return 'not_for_sale';
  if (profile.coins < skin.unlock.price) return 'insufficient';
  profile.coins -= skin.unlock.price;
  profile.ownedSkins.push(skinId);
  return 'ok';
}

export function equipSkin(profile: Profile, skinId: string): boolean {
  if (!owns(profile, skinId)) return false;
  profile.equippedSkin = skinId;
  return true;
}

/** Unequip returns to the starter car. */
export function unequipSkin(profile: Profile): void {
  profile.equippedSkin = DEFAULT_SKIN_ID;
}

/** Grant gameplay-unlocked skins whose conditions are now met. Returns newly unlocked skins. */
export function syncSkinUnlocks(profile: Profile): SkinDef[] {
  const out: SkinDef[] = [];
  for (const skin of SKINS) {
    if (owns(profile, skin.id)) continue;
    const u = skin.unlock;
    const earned =
      (u.type === 'level' && profile.level >= u.level) ||
      (u.type === 'achievement' && profile.achievements[u.achievementId] !== undefined);
    if (earned) {
      profile.ownedSkins.push(skin.id);
      out.push(skin);
    }
  }
  return out;
}
