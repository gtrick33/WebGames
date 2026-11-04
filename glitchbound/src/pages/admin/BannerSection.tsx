import { BANNER_MAX, type BannerText } from '../../catalog/settings';
import { useT } from '../../i18n';
import { Link } from '../../router/router';
import { BANNER_DEFAULTS } from '../../components/SigilfallHero';
import './BannerSection.css';

const FIELDS: { key: keyof BannerText; label: string; hint: string }[] = [
  { key: 'kicker', label: 'Line above the name', hint: 'Says what the game is, in a few words.' },
  { key: 'hook', label: 'Story line', hint: 'Why care: one or two short sentences.' },
  { key: 'cta', label: 'Button', hint: 'Short and plain, it opens the game.' },
];

/**
 * Admin › Home page: the Sigilfall banner, the first thing on the site. Its words are part of the home page's draft;
 * the picture and the logo are files, and the on/off switch is Sigilfall's own (Admin › Sigilfall).
 */
export function BannerEditor({ value, live, on, onChange }: { value: BannerText; live: BannerText; on: boolean; onChange: (next: BannerText) => void }) {
  const t = useT();
  const shown = (key: keyof BannerText): string => value[key] || t(BANNER_DEFAULTS[key]);
  const set = (key: keyof BannerText, text: string): void => {
    const next = { ...value };
    if (text) next[key] = text.slice(0, BANNER_MAX[key]);
    else delete next[key];
    onChange(next);
  };
  const custom = Object.keys(live).length > 0;
  return (
    <section className="panel info-block" aria-labelledby="ag-banner">
      <div className="admin-row">
        <h2 id="ag-banner">Sigilfall banner</h2>
        <span className="mono info-small">{custom ? 'Your words live' : 'Default words live'}</span>
      </div>
      <p className="info-small">
        The first thing on the home page. Leave a line blank to keep the default, translated into every language; your own words show exactly as written in every language.{' '}
        {on ? 'It’s on.' : 'It’s off, so the home page starts with the arcade.'} The switch is in <Link href="/admin?tab=sections">Sigilfall</Link>.
      </p>
      <div className="ab-grid">
        <div className="ab-preview" aria-hidden="true">
          <img className="ab-art" src="/games/sigilfall/key-art-1600.webp" alt="" width={1600} height={660} loading="lazy" />
          <div className="ab-copy">
            <span className="ab-kicker">{shown('kicker')}</span>
            <img className="ab-logo" src="/games/sigilfall/logo.svg" alt="" width={673} height={168} loading="lazy" />
            <span className="ab-hook">{shown('hook')}</span>
            <span className="ab-cta">{shown('cta')}</span>
          </div>
        </div>
        <div className="ab-fields">
          {FIELDS.map((f) => (
            <label key={f.key} className="ag-field">
              <span>{f.label}</span>
              {f.key === 'hook' ? (
                <textarea className="field" rows={3} value={value[f.key] ?? ''} placeholder={t(BANNER_DEFAULTS[f.key])} maxLength={BANNER_MAX[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input className="field" value={value[f.key] ?? ''} placeholder={t(BANNER_DEFAULTS[f.key])} maxLength={BANNER_MAX[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              )}
              <small className="info-small">{f.hint}</small>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
