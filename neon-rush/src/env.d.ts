declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_AD_PROVIDER?: string;
  readonly VITE_PURCHASE_PROVIDER?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
