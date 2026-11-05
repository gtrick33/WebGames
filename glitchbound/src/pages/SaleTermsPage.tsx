import { SALE_TERMS_VERSION } from '../catalog/shop';
import { useLang } from '../i18n';
import { usePageMeta } from '../platform/meta';
import { useMoney } from '../platform/money';
import { Link } from '../router/router';
import { CONTACT_PATH, OWNER_EMAIL } from './infoText';
import './InfoPages.css';

/**
 * The terms of sale. A draft for a lawyer to check before opening: see docs/LEGAL-READINESS.md. Readable by its address
 * while the shop is closed, hidden from search, because Stripe's reviewers must be able to read the refund policy.
 * Change SALE_TERMS_VERSION with any change here, because purchases record the version agreed to.
 * In English and in Bulgarian, side by side: change both together (a lawyer should read the Bulgarian).
 */
export function SaleTermsPage() {
  const bg = useLang() === 'bg';
  const l = <T,>(en: T, bgText: T): T => (bg ? bgText : en);
  usePageMeta({
    title: l('Terms of sale', 'Условия за продажба'),
    description: l('Prices, your right to withdraw, refunds and who you buy from in the GlitchBound shop.', 'Цени, право на отказ, връщане на пари и от кого купувате в магазина на GlitchBound.'),
    path: '/terms/sale',
  });
  const money = useMoney();
  const ticket = <Link href={CONTACT_PATH}>{l('opening a ticket', 'като отворите тикет')}</Link>;
  const mail = <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>;
  return (
    <div className="wrap info-page">
      <p className="eyebrow">{l(`Plain language · version ${SALE_TERMS_VERSION}`, `На разбираем език · версия ${SALE_TERMS_VERSION}`)}</p>
      <h1 className="info-title">{l('Terms of sale', 'Условия за продажба')}</h1>
      <p className="info-lead">
        {l(
          <>
            These add to the <Link href="/terms">terms of use</Link> when you buy something in the shop. Nothing here limits your rights as a consumer.
          </>,
          <>
            Те допълват <Link href="/terms">условията за ползване</Link>, когато купувате нещо от магазина. Нищо тук не ограничава правата ви като потребител.
          </>,
        )}
      </p>
      {!money.shop && (
        <p className="info-small" role="status">
          {l(
            <>The shop isn&rsquo;t open yet, so nothing can be bought right now. These terms apply once it opens.</>,
            <>Магазинът още не е отворен, затова в момента нищо не може да се купи. Тези условия се прилагат, след като се отвори.</>,
          )}
        </p>
      )}
      <div className="info-cols">
        <section className="panel info-block">
          <h2>{l('Who you buy from', 'От кого купувате')}</h2>
          <p>
            {l(
              <>
                GlitchBound is run by Sava Hristov{money.address ? `, ${money.address}` : ''}. Payments go through Stripe, whose Link service acts as the merchant of record: it is the seller on your
                receipt, it collects the VAT, and it handles payment support. We deliver what you bought and look after it. Reach us by <Link href={CONTACT_PATH}>opening a ticket</Link> or at {mail}.
              </>,
              <>
                GlitchBound се управлява от Сава Христов{money.address ? `, ${money.address}` : ''}. Плащанията минават през Stripe, чиято услуга Link действа като търговец по сделката (merchant of
                record): тя е продавачът във вашата разписка, събира ДДС и отговаря за въпросите по плащането. Ние доставяме това, което сте купили, и се грижим за него. Свържете се с нас, {ticket},
                или на {mail}.
              </>,
            )}
          </p>
        </section>
        <section className="panel info-block">
          <h2>{l('What you get', 'Какво получавате')}</h2>
          <p>
            {l(
              <>
                A one-time purchase, shown with its full price in euros in the shop, VAT included. There are no subscriptions, so there is nothing to cancel and nothing renews. There&rsquo;s no game
                currency and no random boxes. Apart from the Gloamknight class below, nothing in the shop changes how a game plays. A purchase belongs to your account, so you need to be signed in. It
                reaches your account as soon as the payment is confirmed, usually within a minute.
              </>,
              <>
                Еднократна покупка, показана в магазина с пълната си цена в евро, с включен ДДС. Няма абонаменти, така че няма какво да прекратявате и нищо не се подновява. Няма игрова валута и
                случайни кутии. Освен класа Gloamknight по-долу, нищо в магазина не променя как се играе дадена игра. Покупката принадлежи на акаунта ви, затова трябва да сте влезли в него. Тя стига до
                акаунта ви веднага щом плащането бъде потвърдено, обикновено до минута.
              </>,
            )}
          </p>
          <p>
            {l(
              <>
                <strong>The Gloamknight Pack</strong> unlocks the Gloamknight, one of Sigilfall&rsquo;s eight classes, for every hero slot on your account, in the campaign, the Vigil and the Ring, and
                opens two more hero slots. It also gives the Duskborn helm and armor, the Gloamwing Drake and the Gloam border and banner, which come only with the pack. The other seven classes are
                free. The class is a different way to play, balanced with the free classes, not a stronger one, and we may tune it, as we do every class. If the purchase is refunded, all of it is
                locked again, and a Gloamknight hero, or a hero in one of the pack&rsquo;s slots, waits, kept, until you buy the pack again. It lasts as long as Sigilfall runs.
              </>,
              <>
                <strong>Пакетът Gloamknight</strong> отключва Gloamknight, един от осемте класа в Sigilfall, за всяко място за герой в акаунта ви, в кампанията, във Vigil и в Ring, и отваря още две
                места за герои. Той дава също шлема и бронята Duskborn, Gloamwing Drake и рамката и банера „Здрач“, които се получават само с пакета. Другите седем класа са безплатни. Класът е различен
                начин на игра, балансиран спрямо безплатните класове, а не по-силен, и може да го настройваме, както правим с всеки клас. Ако покупката бъде възстановена, всичко от пакета се заключва
                отново, а герой Gloamknight или герой в някое от местата на пакета остава запазен и чака, докато не купите пакета отново. Пакетът важи, докато Sigilfall съществува.
              </>,
            )}
          </p>
          <p>
            {l(
              <>
                <strong>Ad-free</strong> removes ad banners on your account and lets you take your extra try at a daily without watching an ad. It lasts as long as GlitchBound runs. It doesn&rsquo;t
                affect games from other sites that have their own ads.
              </>,
              <>
                <strong>„Без реклами“</strong> премахва рекламните банери в акаунта ви и ви позволява да използвате допълнителния си опит в дневно предизвикателство, без да гледате реклама. Важи,
                докато GlitchBound съществува. Не засяга игри от други сайтове, които имат свои реклами.
              </>,
            )}
          </p>
          <p>
            {l(
              <>
                <strong>Borders, banners and profile icons</strong> change how your picture and your name look on your profile, in the header, in friends lists and on the leaderboards, and nothing
                else. You choose which ones to wear, or none, on your profile. Each one lasts as long as GlitchBound runs.
              </>,
              <>
                <strong>Рамките, банерите и иконите за профила</strong> променят само как изглеждат снимката и името ви в профила, в горната лента, в списъците с приятели и в класациите. В профила си
                избирате кои да носите или да не носите никои. Всяка от тях важи, докато GlitchBound съществува.
              </>,
            )}
          </p>
          <p>
            {l(
              <>
                <strong>Sigilfall mounts and looks</strong> belong to your account, not to one hero: every hero on it, of any class, finds them in Sigilfall&rsquo;s Wardrobe, on any device you sign in
                on. They change only how a hero looks. Every mount runs at the same pace as every other, a look never changes a stat, and a mount can be ridden from the point early in the story where
                riding begins. Each one lasts as long as Sigilfall runs on GlitchBound. If a purchase is refunded, the item leaves the Wardrobe.
              </>,
              <>
                <strong>Ездитните животни и облеклата за Sigilfall</strong> принадлежат на акаунта ви, а не на един герой: всеки герой в него, от всеки клас, ги намира в Гардероба (Wardrobe) на
                Sigilfall, на всяко устройство, на което влезете. Те променят само как изглежда героят. Всяко ездитно животно се движи със същото темпо като всяко друго, облеклото никога не променя
                показател, а ездитното животно може да се язди от момента в началото на историята, в който започва ездата. Всяко от тях важи, докато Sigilfall съществува в GlitchBound. Ако покупката бъде
                възстановена, предметът изчезва от Гардероба.
              </>,
            )}
          </p>
        </section>
        <section className="panel info-block">
          <h2>{l('Paying safely', 'Сигурно плащане')}</h2>
          <p>
            {l(
              <>
                You pay on Stripe&rsquo;s own checkout page, over an encrypted connection. Your card details go straight to Stripe: we never see or store them. Payment may not be available in every
                country, for example where sanctions or local law don&rsquo;t allow it.
              </>,
              <>
                Плащате на собствената страница за плащане на Stripe, през криптирана връзка. Данните на картата ви отиват направо в Stripe: ние никога не ги виждаме и не ги съхраняваме. Плащането може да
                не е възможно във всяка държава, например където санкции или местното право не го позволяват.
              </>,
            )}
          </p>
        </section>
        <section className="panel info-block">
          <h2>{l('Your right to withdraw', 'Правото ви на отказ')}</h2>
          <p>
            {l(
              <>
                In the EU you normally have 14 days to withdraw from an online purchase. For digital content that arrives right away, you lose that right once delivery has started, if you asked for it
                to start at once and confirmed that you understood this. You confirm both before you pay, and the confirmation email repeats them. If you didn&rsquo;t receive what you bought, the right
                still stands.
              </>,
              <>
                В ЕС обикновено имате 14 дни, за да се откажете от онлайн покупка. При цифрово съдържание, което се доставя веднага, губите това право, след като доставката е започнала, ако сте поискали
                тя да започне веднага и сте потвърдили, че разбирате това. Потвърждавате и двете преди плащането, а имейлът с потвърждението ги повтаря. Ако не сте получили това, което сте купили,
                правото ви остава.
              </>,
            )}
          </p>
        </section>
        <section className="panel info-block">
          <h2>{l('If something is wrong, and refunds', 'Ако нещо не е наред, и връщане на пари')}</h2>
          <p>
            {l(
              <>
                What you buy has to work as described. If it doesn&rsquo;t, tell us and we&rsquo;ll fix it, and if we can&rsquo;t, you get your money back. This legal guarantee applies whatever else
                this page says. Refunds go back the way you paid. A refunded item leaves your account. To ask for a refund or dispute a charge, <Link href={CONTACT_PATH}>open a ticket</Link> or write
                to {mail}. For anything else, ask us: we are reasonable people.
              </>,
              <>
                Това, което купувате, трябва да работи както е описано. Ако не работи, кажете ни и ще го поправим, а ако не можем, ще ви върнем парите. Тази законова гаранция важи независимо от всичко
                друго на тази страница. Парите се връщат по начина, по който сте платили. Предмет, за който са върнати парите, изчезва от акаунта ви. За да поискате връщане на пари или да оспорите
                плащане, <Link href={CONTACT_PATH}>отворете тикет</Link> или пишете на {mail}. За всичко друго ни попитайте: ние сме разумни хора.
              </>,
            )}
          </p>
        </section>
        <section className="panel info-block">
          <h2>{l('Under 18?', 'Под 18 години?')}</h2>
          <p>
            {l(
              <>You need a parent or guardian&rsquo;s agreement to buy something, and you confirm that before paying.</>,
              <>За да купите нещо, ви трябва съгласието на родител или настойник, и го потвърждавате преди плащането.</>,
            )}
          </p>
        </section>
        <section className="panel info-block">
          <h2>{l(<>What you can&rsquo;t do</>, <>Какво не можете да правите</>)}</h2>
          <p>
            {l(
              <>
                Purchases can&rsquo;t be resold, swapped or moved to another account, and they have no money value outside GlitchBound. If we close your account for serious breaches of the terms of
                use, you may lose them, and we&rsquo;ll tell you why.
              </>,
              <>
                Покупките не могат да се препродават, разменят или прехвърлят в друг акаунт и нямат парична стойност извън GlitchBound. Ако закрием акаунта ви заради сериозни нарушения на условията за
                ползване, може да ги загубите, и ще ви кажем защо.
              </>,
            )}
          </p>
        </section>
        <section className="panel info-block">
          <h2>{l('If GlitchBound closes', 'Ако GlitchBound спре')}</h2>
          <p>
            {l(
              <>We hope it won&rsquo;t. If it ever does, we&rsquo;ll say so on the site well ahead of time, and your rights as a consumer still apply to anything you bought.</>,
              <>Надяваме се да не стане. Ако някога се случи, ще го обявим на сайта доста предварително, а правата ви като потребител остават за всичко, което сте купили.</>,
            )}
          </p>
        </section>
        <section className="panel info-block">
          <h2>{l('Disagreements', 'Спорове')}</h2>
          <p>
            {l(
              <>
                Please talk to us first. Bulgarian law applies, and if you live elsewhere in the EU you also keep the protections of the consumer law where you live and can go to your local courts.
                In Bulgaria you can also turn to the Commission for Consumer Protection (kzp.bg) and its conciliation commissions.
              </>,
              <>
                Моля, първо говорете с нас. Прилага се българското право, а ако живеете другаде в ЕС, запазвате и защитата на потребителското право там, където живеете, и можете да се обърнете към
                местните съдилища. В България можете да се обърнете и към Комисията за защита на потребителите (kzp.bg) и нейните помирителни комисии.
              </>,
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
