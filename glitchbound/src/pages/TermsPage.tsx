import { useLang } from '../i18n';
import { usePageMeta } from '../platform/meta';
import { bannersOn, rewardedOn, useMoney } from '../platform/money';
import { Link } from '../router/router';
import { CONTACT_PATH, OWNER_EMAIL } from './infoText';
import './InfoPages.css';

/** When these terms last changed (shown on the page; update it with every change). */
export const TERMS_UPDATED = '4 November 2026';
/** The same date in Bulgarian: change both together. */
export const TERMS_UPDATED_BG = '4 ноември 2026 г.';

/** The terms of use, in English and in Bulgarian side by side: change both together (a lawyer should read the Bulgarian). */
export function TermsPage() {
  const bg = useLang() === 'bg';
  const l = <T,>(en: T, bgText: T): T => (bg ? bgText : en);
  usePageMeta({
    title: l('Terms of use', 'Условия за ползване'),
    description: l('The rules for playing on GlitchBound: free games, fair play, accounts, Party Mode and coins.', 'Правилата за игра в GlitchBound: безплатни игри, честна игра, акаунти, Парти режим и монети.'),
    path: '/terms',
  });
  const money = useMoney();
  const mail = <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>;
  const privacy = <Link href="/privacy">{l(<>Privacy &amp; your data</>, <>Поверителност и вашите данни</>)}</Link>;

  return (
    <div className="wrap info-page">
      <p className="eyebrow">{l(`Plain language · updated ${TERMS_UPDATED}`, `На разбираем език · обновени на ${TERMS_UPDATED_BG}`)}</p>
      <h1 className="info-title">{l('Terms of use', 'Условия за ползване')}</h1>
      <p className="info-lead">
        {l(
          'GlitchBound is free to play, with or without an account. By playing you agree to these few rules. They are written to be read, so please do.',
          'В GlitchBound се играе безплатно, със или без акаунт. Като играете, приемате тези няколко правила. Написани са, за да се четат, така че, моля, прочетете ги.',
        )}
      </p>

      <div className="info-cols">
        <section className="panel info-block" aria-labelledby="t-who">
          <h2 id="t-who">{l('Who we are', 'Кои сме ние')}</h2>
          <p>
            {l(
              <>
                GlitchBound is an independent studio run by Sava Hristov. You can reach us about anything on this page, your account or your data by <Link href={CONTACT_PATH}>opening a ticket</Link>{' '}
                (no account needed) or at {mail}.{money.address && ` Our address is ${money.address}.`}
              </>,
              <>
                GlitchBound е независимо студио, управлявано от Сава Христов. Можете да се свържете с нас за всичко на тази страница, за акаунта или данните си, като{' '}
                <Link href={CONTACT_PATH}>отворите тикет</Link> (не е нужен акаунт) или на {mail}.{money.address && ` Адресът ни е ${money.address}.`}
              </>,
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-play">
          <h2 id="t-play">{l('Playing', 'Игра')}</h2>
          <p>
            {l(
              <>
                Every game is free and runs in your browser. {money.shop ? 'You never have to buy anything to play: what the shop sells is optional.' : 'There is nothing to buy.'} You can play as a
                guest; your progress then stays on your device (see {privacy}).
              </>,
              <>
                Всяка игра е безплатна и върви в браузъра ви. {money.shop ? 'Никога не е нужно да купувате нещо, за да играете: това, което се продава в магазина, е по желание.' : 'Няма нищо за купуване.'}{' '}
                Можете да играете като гост; тогава напредъкът ви остава на устройството ви (вижте {privacy}).
              </>,
            )}
          </p>
          <p>
            {l(
              <>
                An account is optional and free. To create one you must be at least 13, and old enough where you live to agree to these terms yourself (14 in Bulgaria, up to 16 elsewhere in the EU), or
                have a parent or guardian agree for you.
              </>,
              <>
                Акаунтът е по желание и е безплатен. За да създадете акаунт, трябва да сте поне на 13 години и достатъчно големи, за да приемете сами тези условия там, където живеете (14 години в
                България, до 16 другаде в ЕС), или родител или настойник да ги приеме вместо вас.
              </>,
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-fair">
          <h2 id="t-fair">{l('Fair play', 'Честна игра')}</h2>
          <p>{l(<>Leaderboards only mean something if everyone plays fair. So please don&rsquo;t:</>, <>Класациите имат смисъл само ако всички играят честно. Затова, моля, не:</>)}</p>
          {bg ? (
            <ul>
              <li>използвайте ботове, скриптове или променен код на играта и не изпращайте измислени резултати до сървърите ни;</li>
              <li>използвайте съзнателно грешка, за да се изкачите в класациите (вместо това я съобщете, и благодарим);</li>
              <li>избирайте прякор и не пишете в стая нищо, което е изпълнено с омраза, тормози, има сексуален характер спрямо непълнолетни или се представя за някой друг;</li>
              <li>се опитвайте да счупите, претоварите или да влезете в части от сайта, които не са ваши.</li>
            </ul>
          ) : (
            <ul>
              <li>use bots, scripts or modified game code, or send made-up scores to our servers;</li>
              <li>knowingly exploit a bug to climb the boards (report it instead, and thank you);</li>
              <li>pick a nickname, or type anything in a room, that is hateful, harassing, sexual about minors or impersonates someone;</li>
              <li>try to break, overload or get into parts of the site that aren&rsquo;t yours.</li>
            </ul>
          )}
          <p>
            {l(
              <>
                If you do, we may remove scores or text, rename you, or suspend or close your account. We tell you what we did and why, unless the law stops us, and you can reply to us if you think we
                got it wrong.
              </>,
              <>
                Ако го направите, може да премахнем резултати или текст, да ви преименуваме или да спрем временно или да закрием акаунта ви. Казваме ви какво сме направили и защо, освен ако законът не
                ни забранява, и можете да ни отговорите, ако смятате, че сме сгрешили.
              </>,
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-party">
          <h2 id="t-party">{l('Party Mode and live rooms', 'Парти режим и стаи на живо')}</h2>
          <p>
            {l(
              'Names, answers and prompts you type in a party game are shown to the people in that game. Play with people you know, and be kind. Rooms are deleted after three hours without activity.',
              'Имената, отговорите и подсказките, които пишете в парти игра, се показват на хората в тази игра. Играйте с хора, които познавате, и бъдете мили. Стаите се изтриват след три часа без активност.',
            )}
          </p>
          <p>
            {l(
              'Crass Act and the After Dark cards are for adults only. Everyone playing them must be 18 or over; the group confirms this before they start.',
              'Crass Act и картите After Dark са само за възрастни. Всеки, който ги играе, трябва да е навършил 18 години; групата потвърждава това, преди да започне.',
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-report">
          <h2 id="t-report">{l('Reporting something illegal', 'Сигнал за нещо незаконно')}</h2>
          <p>
            {l(
              <>
                If you see something illegal or against these rules (a nickname, text in a room, anything players can put on the site), tell us by <Link href={CONTACT_PATH}>opening a ticket</Link> or
                at {mail}. Say where it is and why it is a problem, and leave a contact address if you would like to hear back. We look at every report, act on it, and tell you what we decided. That
                address is also our contact point for authorities. We answer in English or Bulgarian.
              </>,
              <>
                Ако видите нещо незаконно или против тези правила (прякор, текст в стая, всичко, което играчите могат да публикуват в сайта), кажете ни, като <Link href={CONTACT_PATH}>отворите тикет</Link>{' '}
                или на {mail}. Посочете къде е и защо е проблем и оставете адрес за връзка, ако искате да получите отговор. Разглеждаме всеки сигнал, предприемаме действия и ви казваме какво сме решили.
                Този адрес е и нашата точка за контакт с органите. Отговаряме на английски или български.
              </>,
            )}
          </p>
        </section>

        {(bannersOn(money) || rewardedOn(money)) && (
          <section className="panel info-block" aria-labelledby="t-ads">
            <h2 id="t-ads">{l('Ads', 'Реклами')}</h2>
            <p>
              {l('Ads help keep the games free. They are labeled, and never run inside a game or on a page for adults only. ', 'Рекламите помагат игрите да останат безплатни. Те са обозначени и никога не се показват вътре в игра или на страница само за възрастни. ')}
              {rewardedOn(money) &&
                l(
                  'After a daily you may choose to watch a short ad for one more try. It is always your choice, the reward has no money value, and that try doesn’t count for the leaderboards. ',
                  'След дневно предизвикателство можете да изберете да гледате кратка реклама за още един опит. Изборът винаги е ваш, наградата няма парична стойност и този опит не се брои за класациите. ',
                )}
              {l(
                <>{privacy} says what ads do with your data, and how to change your choice.</>,
                <>В {privacy} пише какво правят рекламите с данните ви и как да промените избора си.</>,
              )}
            </p>
          </section>
        )}

        {money.shop && (
          <section className="panel info-block" aria-labelledby="t-buy">
            <h2 id="t-buy">{l('Purchases', 'Покупки')}</h2>
            <p>
              {l(
                <>
                  The shop sells one-time items for real money: no subscriptions, no game currency and no random boxes. Nothing in it makes you stronger in a game or higher on a board. The{' '}
                  <Link href="/terms/sale">terms of sale</Link> cover prices, your right to withdraw, and refunds.
                </>,
                <>
                  Магазинът продава еднократни покупки срещу истински пари: без абонаменти, без игрова валута и без случайни кутии. Нищо в него не ви прави по-силни в игра или по-високо в класация.{' '}
                  <Link href="/terms/sale">Условията за продажба</Link> уреждат цените, правото ви на отказ и връщането на пари.
                </>,
              )}
            </p>
          </section>
        )}

        <section className="panel info-block" aria-labelledby="t-coins">
          <h2 id="t-coins">{l('Coins, XP and rewards', 'Монети, XP и награди')}</h2>
          <p>
            {l(
              <>
                Coins, XP, levels, badges and other rewards are part of the games. They have no money value, can&rsquo;t be bought, sold or swapped for anything outside GlitchBound, and we may
                rebalance or reset them, for example to fix a bug or undo cheating.
              </>,
              <>
                Монетите, XP, нивата, значките и другите награди са част от игрите. Те нямат парична стойност, не могат да се купуват, продават или разменят срещу нищо извън GlitchBound и може да ги
                пребалансираме или нулираме, например за да поправим грешка или да отменим измама.
              </>,
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-ours">
          <h2 id="t-ours">{l('Our games, your words', 'Нашите игри, вашите думи')}</h2>
          <p>
            {l(
              <>
                The games, art, music, puzzles and text on GlitchBound belong to us or to the artists who license them to us. Share links, screenshots, clips and result grids as much as you like;
                please don&rsquo;t copy the games or host them elsewhere.
              </>,
              <>
                Игрите, графиките, музиката, пъзелите и текстовете в GlitchBound принадлежат на нас или на авторите, които ни ги лицензират. Споделяйте линкове, екранни снимки, клипове и таблици с
                резултати колкото искате; моля, не копирайте игрите и не ги качвайте другаде.
              </>,
            )}
          </p>
          <p>
            {l(
              'If you send us feedback, a bug report or an idea, we may use it to improve GlitchBound without owing you anything for it. Thank you, honestly.',
              'Ако ни изпратите отзив, съобщение за грешка или идея, може да ги използваме, за да подобрим GlitchBound, без да ви дължим нищо за това. Наистина благодарим.',
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-changes">
          <h2 id="t-changes">{l('Changes and availability', 'Промени и достъпност')}</h2>
          <p>
            {l(
              <>
                We keep adding, changing and sometimes retiring games and features. GlitchBound is provided as it is, and we can&rsquo;t promise it will always be online or free of bugs. As far as the
                law allows, we are not liable for indirect losses from using it. Nothing here limits rights you have as a consumer that can&rsquo;t be waived.
              </>,
              <>
                Постоянно добавяме, променяме и понякога премахваме игри и функции. GlitchBound се предоставя във вида, в който е, и не можем да обещаем, че винаги ще е достъпен или без грешки. Доколкото
                законът позволява, не отговаряме за косвени загуби от използването му. Нищо тук не ограничава правата ви като потребител, от които не можете да се откажете.
              </>,
            )}
          </p>
          <p>
            {l(
              <>
                You can stop playing whenever you like and delete your account from <Link href="/me">your profile</Link>. If these terms change in a way that matters, we will say so on the site before
                the change applies.
              </>,
              <>
                Можете да спрете да играете, когато пожелаете, и да изтриете акаунта си от <Link href="/me">профила си</Link>. Ако тези условия се променят съществено, ще го обявим на сайта, преди
                промяната да влезе в сила.
              </>,
            )}
          </p>
        </section>

        <section className="panel info-block" aria-labelledby="t-law">
          <h2 id="t-law">{l('Law', 'Приложимо право')}</h2>
          <p>
            {l(
              'These terms are governed by the law of Bulgaria. If you live elsewhere in the EU, you also keep the protections of the consumer law where you live, and you can bring a claim in your local courts.',
              'Тези условия се уреждат от българското право. Ако живеете другаде в ЕС, запазвате и защитата на потребителското право там, където живеете, и можете да предявите иск пред местните съдилища.',
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
