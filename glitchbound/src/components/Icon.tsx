/** Hand-drawn stroke icons (24px grid). One component keeps them consistent and tree-shakable enough. */
const PATHS = {
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  arrowLeft: <path d="M20 12H5M11 6l-6 6 6 6" />,
  arrowUp: <path d="M12 20V5M6 11l6-6 6 6" />,
  share: <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />,
  restart: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" />,
  expand: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  shrink: <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  flame: <path d="M12 21c-4 0-6.5-2.6-6.5-6.2 0-3.2 2.2-5.3 3.6-7.3.4 1.6 1.2 2.7 2.4 3.3-.3-3 1-5.6 3.5-7.8.2 3.3 4.5 5.6 4.5 10.9C19.5 18.3 16.5 21 12 21z" />,
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6.5 10h1M10.5 10h1M14.5 10h1M8 14h8" />
    </>
  ),
  touch: <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.6-2.2L4.6 15.6a1.5 1.5 0 0 1 2.3-1.9L9 16" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  bolt: <path d="M13 2L4.5 13.5H12L11 22l8.5-11.5H12z" />,
  heart: <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 4 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.8 1.1-1.7 2.7-2.8 4.7-2.8 3.3 0 5.7 3.1 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />,
  crown: <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5zM5 19h14" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4 21c1-4.2 4.2-6.5 8-6.5s7 2.3 8 6.5" />
    </>
  ),
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  bug: (
    <>
      <rect x="7" y="7.5" width="10" height="12" rx="5" />
      <path d="M9 7.5a3 3 0 0 1 6 0M12 11v8.5M3.5 13H7M17 13h3.5M4.5 8.5L7.5 10M19.5 8.5L16.5 10M4.5 18.5l3-1.5M19.5 18.5l-3-1.5" />
    </>
  ),
  sword: <path d="M19.5 3.5l-9.5 9.5M19.5 3.5H15M19.5 3.5V8M6.5 12.5l5 5M9 15l-4.5 4.5M3.5 18.5l2 2" />,
  party: <path d="M4 20l5.5-14 8.5 8.5zM13 4.5l1-2M18.5 8l2.5-1M17 3.5l.5.5M20 13l1.5.5M9.5 9l5 5" />,
  chat: <path d="M4 5.5h16v10.5H10l-4.5 4V16H4z" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  gamepad: (
    <>
      <path d="M6 8h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5.3 1.9L15 15H9l-1.7 1.9A3 3 0 0 1 2 15v-3a4 4 0 0 1 4-4z" />
      <path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
