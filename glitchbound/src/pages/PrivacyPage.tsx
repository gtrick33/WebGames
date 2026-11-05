import { useState } from 'react';
import { GAMES } from '../catalog/games';
import { Icon } from '../components/Icon';
import { useLang } from '../i18n';
import { api, useAccount } from '../platform/account';
import { ANALYTICS } from '../platform/env';
import { openAdChoices } from '../platform/adScript';
import { bannersOn, rewardedOn, useMoney } from '../platform/money';
import { usePageMeta } from '../platform/meta';
import { storageKeys } from '../platform/qa';
import { CONTACT_PATH, OWNER_EMAIL } from './infoText';
import { saveStore, useSave } from '../platform/store';
import { Link } from '../router/router';
import './InfoPages.css';

/** Display preferences stay; everything else the arcade and its games keep in this browser goes. */
const PREFS = new Set(['glitchbound.theme', 'glitchbound.lang', 'glitchbound.music']);
const dataKeys = (): string[] => storageKeys().filter((k) => /^(gb\.|glitchbound|neonrush)/i.test(k) && !PREFS.has(k));

/** Privacy & your data, in English and in Bulgarian side by side: change both together (a lawyer should read the Bulgarian). */
export function PrivacyPage() {
  const bg = useLang() === 'bg';
  const l = <T,>(en: T, bgText: T): T => (bg ? bgText : en);
  usePageMeta({
    title: l('Privacy & your data', 'Поверителност и вашите данни'),
    description: l('What GlitchBound stores, what it does not, and how to delete your data.', 'Какво пази GlitchBound, какво не пази и как да изтриете данните си.'),
    path: '/privacy',
  });
  const save = useSave();
  const { me } = useAccount();
  const money = useMoney();
  const adsOn = bannersOn(money) || rewardedOn(money);
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);
  const rounds = Object.values(save.games).reduce((n, g) => n + g.plays, 0);
  const dailies = Object.values(save.daily).filter((d) => d.done).length;
  // Only games on another site: a game built into GlitchBound (Neon Rush) falls under this page.
  const embeds = GAMES.filter((g) => g.runtime.kind === 'embed' && /^https?:/.test(g.runtime.url));
  const mail = <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>;

  return (
    <div className="wrap info-page">
      <p className="eyebrow">{l('Plain language, no tricks', 'На разбираем език, без уловки')}</p>
      <h1 className="info-title">{l(<>Privacy &amp; your data</>, <>Поверителност и вашите данни</>)}</h1>
      <p className="info-lead">
        {l(
          'You can play every game without an account. Here is everything GlitchBound keeps, and how to delete it.',
          'Можете да играете всяка игра без акаунт. Ето всичко, което GlitchBound пази, и как да го изтриете.',
        )}
      </p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="p-device">
          <h2 id="p-device">{l('Saved on this device', 'Запазено на това устройство')}</h2>
          <p>
            {l(
              <>
                As a guest, your bests, rounds played, favorites and Daily Challenge history are stored in this browser&rsquo;s local storage, and each game keeps its own progress there (for example
                today&rsquo;s puzzle). As a guest they never leave your device; signed in, a copy is kept with your account (see below). The date of your last visit is kept there too; our anonymous
                statistics only learn whether you have visited before and how many days ago, never who you are.
              </>,
              <>
                Като гост най-добрите ви резултати, изиграните рундове, любимите игри и историята на дневните предизвикателства се пазят в локалното хранилище на този браузър, а всяка игра пази там и
                собствения си напредък (например днешния пъзел). Като гост те никога не напускат устройството ви; ако сте влезли, копие се пази с акаунта ви (вижте по-долу). Там се пази и датата на
                последното ви посещение; анонимната ни статистика научава само дали сте идвали преди и преди колко дни, никога кои сте.
              </>,
            )}
          </p>
          <p className="info-small mono">
            {l(
              `Right now: ${rounds} ${rounds === 1 ? 'round' : 'rounds'} recorded · ${dailies} daily ${dailies === 1 ? 'challenge' : 'challenges'} cleared`,
              `В момента: ${rounds} ${rounds === 1 ? 'записан рунд' : 'записани рунда'} · ${dailies} ${dailies === 1 ? 'изпълнено дневно предизвикателство' : 'изпълнени дневни предизвикателства'}`,
            )}
            {saveStore.persistent ? '' : l(' · storage unavailable, nothing is kept after you leave', ' · хранилището не е достъпно, нищо не се пази, след като излезете')}
          </p>
          <div className="reset-row">
            {!confirming ? (
              <button className="btn" onClick={() => setConfirming(true)} disabled={dataKeys().length === 0}>
                {l('Delete my GlitchBound data', 'Изтрий данните ми в GlitchBound')}
              </button>
            ) : (
              <>
                <button
                  className="btn btn-magenta"
                  onClick={() => {
                    for (const k of dataKeys()) {
                      try {
                        localStorage.removeItem(k);
                      } catch {
                        /* storage blocked */
                      }
                    }
                    saveStore.reset();
                    // ...and the guest key's cookie, or the server would hand the old key straight back.
                    void api('/api/guest', { method: 'DELETE' }).catch(() => undefined);
                    setConfirming(false);
                    setCleared(true);
                  }}
                >
                  {l('Yes, delete everything', 'Да, изтрий всичко')}
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
                  {l('Cancel', 'Отказ')}
                </button>
              </>
            )}
          </div>
          <p role="status" className="info-small">
            {cleared ? l('Done. Your local GlitchBound data has been deleted.', 'Готово. Локалните ви данни в GlitchBound са изтрити.') : ''}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-account">
          <h2 id="p-account">{l('If you sign in', 'Ако влезете в акаунт')}</h2>
          <p>
            {l(
              <>
                You can sign in with Google or with a one-time code sent to your email address. With Google we receive your name, email address and profile picture; with a code, only your email
                address. We store them with your nickname, XP, favorites, bests, quest progress, cleared Daily Challenges and the scores of rounds you finish while signed in. We also keep a copy of each
                game&rsquo;s save (today&rsquo;s dailies, a daily you left halfway, your bests), so your progress follows you to every device; a save nobody changed for 180 days is deleted, and deleting
                your GlitchBound data above removes the copies too. Leaderboards show only your nickname, your level and the border, banner or icon you chose to wear, never your profile picture. We
                use a single essential cookie to keep you signed in{adsOn ? '; the cookies ads may use are covered under Advertising below.' : '.'}
              </>,
              <>
                Можете да влезете с Google или с еднократен код, изпратен на имейл адреса ви. С Google получаваме името, имейл адреса и профилната ви снимка; с код само имейл адреса ви. Пазим ги
                заедно с прякора ви, XP, любимите игри, най-добрите резултати, напредъка в задачите, изпълнените дневни предизвикателства и резултатите от рундовете, които завършите, докато сте влезли.
                Пазим и копие от записа на всяка игра (днешните дневни предизвикателства, недовършено дневно предизвикателство, най-добрите ви резултати), за да ви следва напредъкът на всяко
                устройство; запис, който никой не е променял 180 дни, се изтрива, а изтриването на данните ви в GlitchBound по-горе премахва и копията. Класациите показват само прякора ви, нивото ви и
                рамката, банера или иконата, които сте избрали да носите, никога профилната ви снимка. Използваме една-единствена необходима бисквитка, за да останете влезли
                {adsOn ? '; бисквитките, които рекламите може да използват, са описани в „Реклами“ по-долу.' : '.'}
              </>,
            )}
          </p>
          <p>
            {l(
              <>
                The GlitchBound team can look at a signed-in player&rsquo;s Sigilfall save (heroes, gear, quests and progress) to help them, and can fix it, for example by repairing a stuck quest or
                bringing back a hero. If you delete a hero, we keep its last copy for 120 days for that reason. Guests&rsquo; heroes stay on their own device and we can&rsquo;t see them.
              </>,
              <>
                Екипът на GlitchBound може да разгледа записа в Sigilfall на влязъл играч (герои, екипировка, задачи и напредък), за да му помогне, и може да го поправи, например като оправи блокирала
                задача или върне герой. Ако изтриете герой, пазим последното му копие 120 дни по тази причина. Героите на гостите остават на собственото им устройство и ние не можем да ги видим.
              </>,
            )}
          </p>
          <p>
            {me
              ? l(
                  <>
                    You can delete your account and all of this data at any time from <Link href="/me">your profile</Link>.
                  </>,
                  <>
                    Можете да изтриете акаунта си и всички тези данни по всяко време от <Link href="/me">профила си</Link>.
                  </>,
                )
              : l('You can delete your account and all of this data at any time from your profile.', 'Можете да изтриете акаунта си и всички тези данни по всяко време от профила си.')}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-challenges">
          <h2 id="p-friends">{l('Friends and your shelf', 'Приятели и вашата витрина')}</h2>
          <p>
            {l(
              <>
                You add a friend with a code or link they gave you; nobody can search for you. Your friends see your nickname, level, Trophy Shelf, your scores on the friends boards and the game you
                last played. A friend can ask you to join their room, with no message of their own. Removing or blocking someone takes effect at once, and deleting your account removes all of this.
              </>,
              <>
                Добавяте приятел с код или линк, който ви е дал; никой не може да ви търси. Приятелите ви виждат прякора ви, нивото ви, Витрината ви с трофеи, резултатите ви в класациите между приятели
                и последната игра, която сте играли. Приятел може да ви покани в стаята си, без собствено съобщение. Премахването или блокирането на някого действа веднага, а изтриването на акаунта
                ви премахва всичко това.
              </>,
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-challenges">
          <h2 id="p-challenges">{l('Friend challenges', 'Предизвикателства с приятели')}</h2>
          <p>
            {l(
              <>
                When you start or join a challenge, the name you play under and your scores in it are stored on our server so everyone in the challenge can see them, with a random key from this browser
                that keeps your seat. That key is kept in this browser&rsquo;s storage and in one essential cookie (<code>gb_guest</code>, which only our server can read, for up to 400 days), so you
                keep your seats even if the browser clears its storage; deleting your GlitchBound data above removes both. Challenges are deleted about a month after they end.
              </>,
              <>
                Когато започнете предизвикателство или се присъедините към такова, името, с което играете, и резултатите ви в него се пазят на сървъра ни, за да ги виждат всички в предизвикателството,
                заедно със случаен ключ от този браузър, който пази мястото ви. Този ключ се пази в хранилището на браузъра и в една необходима бисквитка (<code>gb_guest</code>, която само нашият сървър
                може да чете, до 400 дни), за да запазите местата си, дори ако браузърът изчисти хранилището си; изтриването на данните ви в GlitchBound по-горе премахва и двете. Предизвикателствата се
                изтриват около месец след края си.
              </>,
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-rooms">
          <h2 id="p-rooms">{l('Party rooms and Discord', 'Парти стаи и Discord')}</h2>
          <p>
            {l(
              'A live party room keeps the names and answers typed in it on our server only while it is in use; it deletes itself after three hours without activity. Pass-the-phone games never leave your device.',
              'Парти стаята на живо пази имената и отговорите, написани в нея, на сървъра ни само докато се използва; тя се изтрива сама след три часа без активност. Игрите с подаване на телефона никога не напускат устройството ви.',
            )}
          </p>
          <p>
            {l(
              'If you play inside Discord, Discord shows the game your display name so your friends see it. We only keep which Discord activity is playing which game, for two days.',
              'Ако играете в Discord, Discord показва на играта името ви, за да го виждат приятелите ви. Пазим само коя активност в Discord коя игра играе, за два дни.',
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-email">
          <h2 id="p-email">{l('New-game emails', 'Имейли за нови игри')}</h2>
          <p>
            {l(
              'Only if you ask for them. Guests confirm their address with one email first. Every email has a one-click unsubscribe link. We send through Resend and never share or sell the list.',
              'Само ако ги поискате. Гостите първо потвърждават адреса си с един имейл. Всеки имейл има линк за отписване с едно щракване. Изпращаме чрез Resend и никога не споделяме и не продаваме списъка.',
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-reports">
          <h2 id="p-reports">{l('Feedback and bug reports', 'Отзиви и съобщения за грешки')}</h2>
          <p>
            {l(
              'What you send (your message, the game, your browser and device type, and a contact address if you add one) is kept so we can read it and fix things. Bug reports, without any contact details, may be copied to our private issue tracker on GitHub.',
              'Това, което изпращате (съобщението ви, играта, типа на браузъра и устройството ви и адрес за връзка, ако добавите такъв), се пази, за да можем да го прочетем и да поправим нещата. Съобщенията за грешки, без данни за връзка, може да се копират в частния ни списък със задачи в GitHub.',
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-analytics">
          <h2 id="p-analytics">{l('Analytics and crash reports', 'Статистика и доклади за сривове')}</h2>
          <p>
            {l(
              'We count anonymous events (a page was viewed, a game was started or finished, a search returned results) and collect crash reports so we can fix bugs. There are no analytics cookies: visitors are counted with a key that is derived from the request and changes every day, and IP addresses are never stored. Events are kept for 180 days and crash reports for 90 days.',
              'Броим анонимни събития (отворена страница, започната или завършена игра, търсене с резултати) и събираме доклади за сривове, за да поправяме грешки. Няма бисквитки за статистика: посетителите се броят с ключ, който се извежда от заявката и се сменя всеки ден, а IP адресите никога не се пазят. Събитията се пазят 180 дни, а докладите за сривове 90 дни.',
            )}
            {ANALYTICS.provider === 'umami' && ANALYTICS.umamiWebsiteId ? l(' We also use Umami, a cookieless analytics tool.', ' Използваме и Umami, инструмент за статистика без бисквитки.') : ''}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-ads">
          <h2 id="p-ads">{l('Advertising', 'Реклами')}</h2>
          {adsOn ? (
            <>
              <p>
                {l(
                  'Some pages show ads from Google, clearly labeled and never inside a game or on a page for adults only. Google and its partners may use cookies and similar technology to show and measure ads. If you are in the EU, UK or Switzerland, you are asked first: ads that use your data for personalizing only run if you agree, and saying no never stops you playing. We rely on that consent for these ads, and you can withdraw it at any time. ',
                  'Някои страници показват реклами от Google, ясно обозначени и никога вътре в игра или на страница само за възрастни. Google и партньорите му може да използват бисквитки и подобни технологии, за да показват и измерват реклами. Ако сте в ЕС, Обединеното кралство или Швейцария, първо ви питаме: реклами, които използват данните ви за персонализиране, се показват само ако се съгласите, а отказът никога не ви пречи да играете. За тези реклами разчитаме на това съгласие и можете да го оттеглите по всяко време. ',
                )}
                <button className="link-btn" onClick={openAdChoices}>
                  {l('Change your ad choices', 'Променете избора си за реклами')}
                </button>
                {l('. See ', '. Вижте ')}
                <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">
                  {l('how Google uses data', 'как Google използва данните')} <Icon name="external" size={14} />
                </a>
                .
              </p>
              {rewardedOn(money) && (
                <p>
                  {l(
                    'If you choose to watch an ad for one more try at a daily, we only learn that it was watched: nothing about you goes to us from Google.',
                    'Ако изберете да гледате реклама за още един опит в дневно предизвикателство, научаваме само, че е изгледана: от Google не ни стига нищо за вас.',
                  )}
                </p>
              )}
              <p>{l(<>GlitchBound isn&rsquo;t aimed at children, and we don&rsquo;t ask Google to target anyone by age.</>, <>GlitchBound не е насочен към деца и не молим Google да насочва реклами към никого по възраст.</>)}</p>
            </>
          ) : (
            <p>
              {l(
                'There are no ads on GlitchBound right now. If we start showing ads from Google, this section will say so first, with what they do with your data and how to choose.',
                'В момента в GlitchBound няма реклами. Ако започнем да показваме реклами от Google, този раздел първо ще го каже, заедно с това какво правят те с данните ви и как да изберете.',
              )}
            </p>
          )}
        </section>

        {money.shop && (
          <section className="panel info-block" aria-labelledby="p-buy">
            <h2 id="p-buy">{l('Purchases', 'Покупки')}</h2>
            <p>
              {l(
                'When you buy something, our payment provider, Stripe, takes your payment and is the seller on the receipt. We never see your card. We keep what you bought, when, what it cost, and your agreement to get it right away, so it stays yours and for our accounts. We keep those records as long as tax and accounting law requires, even if you delete your account, but no longer linked to your profile.',
                'Когато купувате нещо, нашият доставчик на плащания Stripe приема плащането ви и е продавачът в разписката. Ние никога не виждаме картата ви. Пазим какво сте купили, кога, колко е струвало и съгласието ви да го получите веднага, за да остане ваше и за счетоводството ни. Пазим тези записи толкова дълго, колкото изисква данъчното и счетоводното законодателство, дори ако изтриете акаунта си, но вече без връзка с профила ви.',
              )}
            </p>
          </section>
        )}

        {embeds.length > 0 && (
          <section className="panel info-block" aria-labelledby="p-games">
            <h2 id="p-games">{l('Games from their own sites', 'Игри от собствените им сайтове')}</h2>
            <p>
              {l(
                'Some games load inside GlitchBound from their own website. That game keeps its own progress in your browser and has its own privacy policy:',
                'Някои игри се зареждат в GlitchBound от собствения си сайт. Такава игра пази собствения си напредък в браузъра ви и има своя политика за поверителност:',
              )}
            </p>
            <ul className="info-links">
              {embeds.map((g) => (
                <li key={g.slug}>
                  <a href={g.homepage ?? (g.runtime.kind === 'embed' ? g.runtime.url : '#')} target="_blank" rel="noopener">
                    {g.title} <Icon name="external" size={14} />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel info-block" aria-labelledby="p-who">
          <h2 id="p-who">{l('Who is responsible, and who helps', 'Кой отговаря и кой помага')}</h2>
          <p>
            {l(
              <>
                GlitchBound is run by Sava Hristov{money.address ? `, ${money.address}` : ''}, who is responsible for your data (the &ldquo;controller&rdquo;). You can write to {mail}. A few service
                providers process it only on our behalf: Cloudflare (hosting, database and live rooms), Google (sign-in, if you choose it{adsOn ? ', and ads' : ''}), Resend (emails)
                {money.shop ? ', Stripe (payments)' : ''} and GitHub (our bug tracker). Some of them are based in the US and protect transfers with the EU&rsquo;s standard contractual clauses or the
                EU&ndash;US Data Privacy Framework. We never sell your data.
              </>,
              <>
                GlitchBound се управлява от Сава Христов{money.address ? `, ${money.address}` : ''}, който отговаря за данните ви (&bdquo;администратор&ldquo;). Можете да пишете на {mail}. Няколко
                доставчици на услуги ги обработват само от наше име: Cloudflare (хостинг, база данни и стаи на живо), Google (вход, ако го изберете{adsOn ? ', и реклами' : ''}), Resend (имейли)
                {money.shop ? ', Stripe (плащания)' : ''} и GitHub (списъкът ни с грешки). Някои от тях са в САЩ и защитават предаването на данни със стандартните договорни клаузи на ЕС или с Рамката за
                защита на данните между ЕС и САЩ. Никога не продаваме данните ви.
              </>,
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="p-rights">
          <h2 id="p-rights">{l('Why we may, and your rights', 'На какво основание, и вашите права')}</h2>
          <p>
            {l(
              'We handle account and game data to run the service you asked for; analytics and crash reports because we have a legitimate interest in keeping GlitchBound working; and emails only with your consent, which you can withdraw with one click. Account data is kept until you delete your account.',
              'Обработваме данните за акаунта и игрите, за да предоставяме услугата, която сте поискали; статистиката и докладите за сривове, защото имаме законен интерес GlitchBound да работи; а имейлите само с вашето съгласие, което можете да оттеглите с едно щракване. Данните за акаунта се пазят, докато не изтриете акаунта си.',
            )}
          </p>
          <p>
            {l(
              'You can ask to see, correct, export or delete your data, or object to how we use it, by opening a ticket (see below) or by email. You can also complain to the Bulgarian Commission for Personal Data Protection (cpdp.bg) or the data protection authority where you live.',
              'Можете да поискате да видите, поправите, изнесете или изтриете данните си или да възразите срещу начина, по който ги използваме, като отворите тикет (вижте по-долу) или по имейл. Можете да подадете жалба и до Комисията за защита на личните данни (cpdp.bg) или до органа за защита на данните там, където живеете.',
            )}
          </p>
        </section>
      </div>
      <p className="info-small">
        {l(
          <>
            Questions or data requests: <Link href={CONTACT_PATH}>open a ticket</Link> and choose &ldquo;Question or request&rdquo; · See also the <Link href="/terms">terms of use</Link>.
          </>,
          <>
            Въпроси или искания за данни: <Link href={CONTACT_PATH}>отворете тикет</Link> и изберете &bdquo;Въпрос или молба&ldquo; · Вижте също <Link href="/terms">условията за ползване</Link>.
          </>,
        )}
      </p>
    </div>
  );
}
