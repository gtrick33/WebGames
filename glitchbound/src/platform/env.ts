/** Build-time configuration. Every VITE_* value is public (it ships in the browser bundle). */
const env = import.meta.env;

const clean = (v: string | undefined): string => (v ?? '').trim();

export const SITE_URL = clean(env.VITE_SITE_URL).replace(/\/+$/, '') || 'https://glitchboundstudio.com';

export const ANALYTICS = {
  provider: (clean(env.VITE_ANALYTICS) || (env.DEV ? 'console' : 'none')) as 'none' | 'console' | 'umami',
  umamiSrc: clean(env.VITE_UMAMI_SRC) || 'https://cloud.umami.is/script.js',
  umamiWebsiteId: clean(env.VITE_UMAMI_WEBSITE_ID),
};

const adClient = clean(env.VITE_ADSENSE_CLIENT);

export const ADS = {
  client: adClient,
  /** Ads only render when a valid publisher id is set AND they are explicitly switched on. */
  enabled: /^ca-pub-\d{10,20}$/.test(adClient) && clean(env.VITE_ADS_ENABLED) === 'on',
  test: clean(env.VITE_ADSENSE_TEST) === 'on',
  slots: {
    home: clean(env.VITE_ADSENSE_SLOT_HOME),
    game: clean(env.VITE_ADSENSE_SLOT_GAME),
  },
};
