/**
 * GlitchBound email design: an arcade-cabinet look built only from text, color and borders.
 * No images, no big buttons and a single link keep it reading like a personal message, which is
 * what Gmail files in the Primary tab (image-heavy, button-heavy mail tends to go to Promotions).
 * Every email gets a matching plain-text part.
 */
import { esc } from './email';

export interface ArcadeMail {
  /** Small line above the title, e.g. "NEW CABINET UNLOCKED". */
  kicker: string;
  title: string;
  /** Paragraphs of plain text. */
  intro: string[];
  /** A one-line, game-HUD style status bar, e.g. "LV 1 · 0 XP · 3 QUESTS READY". */
  hud?: string;
  /** Checklist rows, e.g. today's quests. */
  list?: { label: string; value?: string }[];
  /** Paragraphs after the list/code, before the link. */
  outro?: string[];
  /** A one-time code, shown big. */
  code?: string;
  link?: { label: string; url: string };
  signoff?: string;
  footer: string;
  footerLink?: { label: string; url: string };
}

const C = {
  bg: '#0d0522',
  card: '#170a38',
  line: '#3b2678',
  cyan: '#22e4ff',
  magenta: '#ff3fd2',
  lime: '#c4f034',
  yellow: '#ffd12e',
  text: '#ddd4f7',
  dim: '#9a8cc8',
};
const MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace";
const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function arcadeEmail(m: ArcadeMail): { html: string; text: string } {
  const p = (t: string): string => `<p style="margin:0 0 12px;font:400 15px/1.6 ${SANS};color:${C.text}">${esc(t)}</p>`;
  const hud = m.hud
    ? `<div style="margin:16px 0;padding:10px 12px;border:1px dashed ${C.line};border-radius:8px;background:${C.bg};font:700 12px/1.4 ${MONO};letter-spacing:1px;color:${C.yellow}">${esc(m.hud)}</div>`
    : '';
  const list = m.list?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 16px;border-collapse:collapse">${m.list
        .map(
          (r) =>
            `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.line};font:400 15px/1.4 ${SANS};color:${C.text}"><span style="color:${C.cyan};font-family:${MONO}">&#9634;</span>&nbsp; ${esc(r.label)}</td>` +
            `<td align="right" style="padding:7px 0;border-bottom:1px solid ${C.line};font:700 13px ${MONO};color:${C.lime};white-space:nowrap">${r.value ? esc(r.value) : ''}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const code = m.code
    ? `<div style="margin:14px 0 18px;font:700 34px/1 ${MONO};letter-spacing:10px;color:${C.cyan}">${esc(m.code)}</div>`
    : '';
  const link = m.link
    ? `<p style="margin:18px 0 6px;font:700 15px ${MONO}"><a href="${esc(m.link.url)}" style="color:${C.cyan};text-decoration:none">&#9654; ${esc(m.link.label)}</a></p>`
    : '';
  const signoff = m.signoff ? `<p style="margin:18px 0 0;font:400 15px/1.5 ${SANS};color:${C.text}">${esc(m.signoff).replace(/\n/g, '<br>')}</p>` : '';
  const footerLink = m.footerLink ? ` <a href="${esc(m.footerLink.url)}" style="color:${C.dim}">${esc(m.footerLink.label)}</a>` : '';

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark light"></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="background:${C.bg};padding:24px 12px">
<div style="max-width:520px;margin:0 auto;background:${C.card};border:2px solid ${C.cyan};border-radius:16px;padding:22px 22px 18px">
<div style="font:700 13px ${MONO};letter-spacing:3px;color:${C.cyan}">&#9654; GLITCH<span style="color:${C.magenta}">BOUND</span></div>
<div style="margin:18px 0 8px;font:700 11px ${MONO};letter-spacing:2px;color:${C.lime}">&#9733; ${esc(m.kicker)} &#9733;</div>
<h1 style="margin:0 0 14px;font:800 26px/1.15 ${SANS};color:#ffffff">${esc(m.title)}</h1>
${m.intro.map(p).join('')}${hud}${list}${code}${(m.outro ?? []).map(p).join('')}${link}${signoff}
</div>
<p style="max-width:520px;margin:12px auto 0;font:400 12px/1.5 ${SANS};color:${C.dim};text-align:center">${esc(m.footer)}${footerLink}</p>
</div></body></html>`;

  const text = [
    `GLITCHBOUND · ${m.kicker}`,
    '',
    m.title,
    '',
    ...m.intro.flatMap((t) => [t, '']),
    ...(m.hud ? [m.hud, ''] : []),
    ...(m.list?.length ? [...m.list.map((r) => `[ ] ${r.label}${r.value ? `  ${r.value}` : ''}`), ''] : []),
    ...(m.code ? [m.code, ''] : []),
    ...(m.outro ?? []).flatMap((t) => [t, '']),
    ...(m.link ? [`${m.link.label}: ${m.link.url}`, ''] : []),
    ...(m.signoff ? [m.signoff, ''] : []),
    m.footer + (m.footerLink ? ` ${m.footerLink.label}: ${m.footerLink.url}` : ''),
  ].join('\n');
  return { html, text };
}
