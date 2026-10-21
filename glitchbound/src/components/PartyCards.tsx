import { Link } from '../router/router';
import { useT } from '../i18n';
import { partySettingsFor } from '../catalog/settings';
import { DEFAULT_FEATURED, PARTY_GAMES } from '../party/catalog';
import { useLiveCatalog } from '../platform/liveCatalog';
import { AdultLabel } from './AdultLabel';

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
            <Link href={`/party?play=${g.id}`} className="party-card" style={{ background: g.color }}>
              {g.art ? (
                <img src={g.art.tile} alt="" width={72} height={72} loading="lazy" />
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
