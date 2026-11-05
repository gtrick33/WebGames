import type { Lang } from '.';
import bg from './shop/bg';
import de from './shop/de';
import en from './shop/en';
import es from './shop/es';
import fr from './shop/fr';
import it from './shop/it';
import nl from './shop/nl';
import pl from './shop/pl';
import pt from './shop/pt';
import ro from './shop/ro';
import tr from './shop/tr';
import uk from './shop/uk';
import type { ShopText } from './shopTypes';

/**
 * Every language's shop words at once, for the server (the purchase email in the buyer's language). The site's pages
 * load one language at a time instead (src/i18n/shopText.tsx).
 */
export const SHOP_TEXTS: Record<Lang, ShopText> = { en, bg, de, es, fr, it, nl, pl, pt, ro, tr, uk };
