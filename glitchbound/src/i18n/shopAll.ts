import type { Lang } from '.';
import bg from './shop/bg';
import en from './shop/en';
import type { ShopText } from './shopTypes';

/**
 * Every language's shop words at once, for the server (the purchase email in the buyer's language). The site's pages
 * load one language at a time instead (src/i18n/shopText.tsx).
 */
export const SHOP_TEXTS: Partial<Record<Lang, ShopText>> = { en, bg };
