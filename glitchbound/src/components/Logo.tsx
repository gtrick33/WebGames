/**
 * The GlitchBound mark: a bold "G" held inside bounding-box corners, with a misregistered
 * coral/teal print offset (the glitch). The same drawing is public/favicon.svg.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo-mark" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="#2c45ff" stroke="#170f30" strokeWidth="2.5" />
      <g fill="none" strokeWidth="5" strokeLinecap="square">
        <path className="logo-g logo-g-a" d="M26.4 13.6A9 9 0 1 0 29 20h-7.5" stroke="#ff5a6c" transform="translate(-1.6 0)" />
        <path className="logo-g logo-g-b" d="M26.4 13.6A9 9 0 1 0 29 20h-7.5" stroke="#12c6b3" transform="translate(1.6 0)" />
        <path d="M26.4 13.6A9 9 0 1 0 29 20h-7.5" stroke="#fff" />
      </g>
      <path d="M7 11.5V7h4.5M28.5 7H33v4.5M33 28.5V33h-4.5M11.5 33H7v-4.5" fill="none" stroke="#c4f034" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark" aria-hidden="true">
      Glitch<span className="wordmark-b">Bound</span>
    </span>
  );
}
