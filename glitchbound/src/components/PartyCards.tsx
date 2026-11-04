import { Link } from '../router/router';
import { useT } from '../i18n';
import { partySettingsFor } from '../catalog/settings';
import { DEFAULT_FEATURED, PARTY_GAMES } from '../party/catalog';
import { useLiveCatalog } from '../platform/liveCatalog';
import { AdultLabel } from './AdultLabel';
import { tileImg } from '../platform/cardImg';

/** Relative luminance of a #rrggbb color (WCAG). */
function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
}

/** The card's text color: dark ink, or white on a fill too dark for it (Impostor's violet), whichever reads better. */
export function cardInk(fill: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(fill)) return '#1d1238';
  const l = luminance(fill);
  const ink = luminance('#1d1238');
  return (l + 0.05) / (ink + 0.05) >= 1.05 / (l + 0.05) ? '#1d1238' : '#ffffff';
}

/**
 * The two featured party games as cards under the home page's party banner (the admins' featured
 * picks, else Impostor and Crass Act). Loaded after the first paint: it sits below the arcade and
 * brings the party catalog with it.
 */
export function PartyCards() {
  const t = useT();
  const live = useLiveCatalog();
  const shown = PARTY_GAMES.filter((g) => !partySettingsFor(live.raw, g.id).hidden);
  const chosen = shown.filter((g) => partySettingsFor(live.raw, g.id).featured);
  const cards = (chosen.length ? chosen : shown.filter((g) => DEFAULT_FEATURED.includes(g.id))).slice(0, 2);
  if (cards.length === 0) return null;
  return (
    <ul className="party-cards">
      {cards.map((g) => {
        const s = partySettingsFor(live.raw, g.id);
        return (
          <li key={g.id}>
            <Link href={`/party?play=${g.id}`} className="party-card" style={{ background: g.color, color: cardInk(g.color) }}>
              {g.art ? (
                <img {...tileImg(g.art.tile, 72)} alt="" width={72} height={72} loading="lazy" />
              ) : (
                <span className="party-card-emoji" aria-hidden="true">
                  {g.emoji}
                </span>
              )}
              <span className="party-card-text">
                <strong>
                  {s.title || g.title} {g.adult && <AdultLabel text={t('Adults only')} />}
                </strong>
                <span>{t(s.blurb || g.blurb)}</span>
                <span className="mono party-card-meta">
                  {g.players} · {g.onePhone && t('📱 One phone')}
                  {g.onePhone && g.room && ' · '}
                  {g.room && t('🌐 Own phones')}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
