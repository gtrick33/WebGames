import { useEffect, useRef, useState } from 'react';
import { LANGS, setLang, useLang, useT } from '../i18n';
import { promptInstall, useInstall, type InstallHow } from '../platform/install';
import { music, useMusic } from '../platform/music';
import { setTheme, useTheme, type ThemeChoice } from '../platform/theme';
import { Flag } from './Flag';
import { Icon } from './Icon';
import './MusicControl.css';

const THEMES: { id: ThemeChoice; icon: 'sun' | 'moon' | null; label: string }[] = [
  { id: 'auto', icon: null, label: 'Auto' },
  { id: 'light', icon: 'sun', label: 'Day' },
  { id: 'dark', icon: 'moon', label: 'Night' },
];

/**
 * The settings button: sound, language, theme and the full-screen app in one place. It sits at the end of the phone tab
 * bar (where the header has no room for the language and theme buttons) and bottom-left on desktop.
 */
export function MusicControl() {
  const t = useT();
  const m = useMusic();
  const lang = useLang();
  const [theme] = useTheme();
  const install = useInstall();
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => music.init(), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const status = !m.on ? t('Music off') : m.playing ? t('Music on') : m.waiting ? t('Music starts on your first click') : t('Music paused');
  return (
    <div className={`music${open ? ' is-open' : ''}`} ref={ref}>
      <button className={`music-btn${m.playing ? ' is-playing' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="settings-pop" aria-label={t('Settings')} title={t('Settings')}>
        <Icon name="menu" size={20} />
        {m.playing && (
          <span className="eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
      </button>
      {open && (
        <div id="settings-pop" className="music-pop panel" role="dialog" aria-label={t('Settings')}>
          {!install.standalone && (
            <section className="set-block set-app">
              <button
                className="set-toggle set-app-btn is-on"
                onClick={() => (install.canPrompt ? void promptInstall() : setGuide((g) => !g))}
                aria-expanded={install.canPrompt ? undefined : guide}
              >
                <Icon name="expand" size={18} /> {t('Full screen app')}
              </button>
              {!install.canPrompt && guide && <InstallSteps how={install.how} />}
              {!install.canPrompt && !guide && <p className="set-note">{install.ios ? t('Tap Share, then Add to Home Screen: GlitchBound opens full screen, without Safari’s bars.') : t('Install GlitchBound to play full screen, without the browser’s bars.')}</p>}
            </section>
          )}
          <section className="set-block">
            <p className="set-head mono">{t('Sound')}</p>
            <div className="set-row">
              <button className={`set-toggle${m.on ? ' is-on' : ''}`} onClick={() => music.toggle()} aria-pressed={m.on}>
                {m.on ? '🔊' : '🔇'} {m.on ? t('Music on') : t('Music off')}
              </button>
              <input type="range" min={0} max={100} value={Math.round(m.volume * 100)} onChange={(e) => music.setVolume(Number(e.target.value) / 100)} aria-label={t('Music volume')} disabled={!m.on} />
            </div>
            <p className="set-note">
              {status}. {t('It pauses while you play a game.')}
            </p>
          </section>
          <section className="set-block">
            <p className="set-head mono">{t('Language')}</p>
            <div className="set-langs" role="radiogroup" aria-label={t('Language')}>
              {LANGS.map((l) => (
                <button key={l.code} role="radio" aria-checked={l.code === lang} className={`set-lang${l.code === lang ? ' is-on' : ''}`} onClick={() => void setLang(l.code)}>
                  <Flag lang={l.code} /> {l.name}
                </button>
              ))}
            </div>
          </section>
          <section className="set-block">
            <p className="set-head mono">{t('Theme')}</p>
            <div className="set-seg" role="radiogroup" aria-label={t('Theme')}>
              {THEMES.map((th) => (
                <button key={th.id} role="radio" aria-checked={theme === th.id} className={theme === th.id ? 'is-on' : ''} onClick={() => setTheme(th.id)}>
                  {th.icon ? <Icon name={th.icon} size={16} /> : <span className="mono">A</span>} {t(th.label)}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * The steps to put the arcade on the Home Screen when the browser gives no install dialog to open (platform/install.ts
 * installHow): Safari's Share sheet on an iPhone or iPad (no site can add itself there), the browser menu on Android,
 * the address bar's install icon on a computer.
 */
function InstallSteps({ how }: { how: InstallHow }) {
  const t = useT();
  const share = <Icon name="share" size={16} />;
  const home = t('Open GlitchBound from your Home Screen: full screen, no browser bars');
  if (how === 'ios-safari' || how === 'ios-safari-26' || how === 'ios-browser') {
    return (
      <ol className="set-steps">
        <li>
          {how === 'ios-safari' ? t('Tap Safari’s Share button') : how === 'ios-safari-26' ? t('Tap Share in Safari’s bar (or ••• first, then Share)') : t('Open your browser’s Share menu')} {share}
        </li>
        <li>{t('Choose Add to Home Screen')}</li>
        <li>{home}</li>
      </ol>
    );
  }
  if (how === 'android') {
    return (
      <ol className="set-steps">
        <li>{t('Open the browser menu (⋮)')}</li>
        <li>{t('Choose Install app or Add to Home screen')}</li>
        <li>{home}</li>
      </ol>
    );
  }
  return <p className="set-note">{how === 'mac-safari' ? t('In Safari’s menu bar, choose File, then Add to Dock') : how === 'none' ? t('This browser can’t install GlitchBound as an app: Chrome, Edge and Safari can.') : t('Click the install icon in the address bar, or choose Install GlitchBound in the browser menu')}</p>;
}
