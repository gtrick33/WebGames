import type { CSSProperties } from 'react';

/** The brand's geometric toy box. Purely decorative: always aria-hidden. */
type ShapeProps = { className?: string; style?: CSSProperties };

const INK = '#170f30';

export const Pill = ({ className, style, fill = '#ffd12e' }: ShapeProps & { fill?: string }) => (
  <svg className={className} style={style} viewBox="0 0 120 52" aria-hidden="true">
    <rect x="3" y="3" width="114" height="46" rx="23" fill={fill} stroke={INK} strokeWidth="4" />
    <path d="M28 18h40" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".7" />
  </svg>
);

export const Dot = ({ className, style, fill = '#ff5a6c' }: ShapeProps & { fill?: string }) => (
  <svg className={className} style={style} viewBox="0 0 80 80" aria-hidden="true">
    <circle cx="40" cy="40" r="35" fill={fill} stroke={INK} strokeWidth="4" />
    <circle cx="28" cy="27" r="7" fill="#fff" opacity=".75" />
  </svg>
);

export const Tri = ({ className, style, fill = '#c4f034' }: ShapeProps & { fill?: string }) => (
  <svg className={className} style={style} viewBox="0 0 100 92" aria-hidden="true">
    <path d="M50 6l44 80H6z" fill={fill} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
  </svg>
);

export const Star = ({ className, style, fill = '#ff6a1a' }: ShapeProps & { fill?: string }) => (
  <svg className={className} style={style} viewBox="0 0 100 100" aria-hidden="true">
    <path
      d="M50 4l9 30 30-12-18 27 25 18-31 3 4 31-19-25-19 25 4-31-31-3 25-18-18-27 30 12z"
      fill={fill}
      stroke={INK}
      strokeWidth="4"
      strokeLinejoin="round"
    />
  </svg>
);

export const Ring = ({ className, style, fill = '#12c6b3' }: ShapeProps & { fill?: string }) => (
  <svg className={className} style={style} viewBox="0 0 100 100" aria-hidden="true">
    <path d="M50 6a44 44 0 1 0 0.01 0zM50 30a20 20 0 1 1-0.01 0z" fill={fill} stroke={INK} strokeWidth="4" fillRule="evenodd" />
  </svg>
);

export const Squiggle = ({ className, style, stroke = '#7a4cff' }: ShapeProps & { stroke?: string }) => (
  <svg className={className} style={style} viewBox="0 0 140 40" aria-hidden="true">
    <path d="M6 28c12-22 22-22 32 0s22 22 32 0 22-22 32 0 18 18 32 0" fill="none" stroke={INK} strokeWidth="12" strokeLinecap="round" />
    <path d="M6 28c12-22 22-22 32 0s22 22 32 0 22-22 32 0 18 18 32 0" fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round" />
  </svg>
);

export const Cube = ({ className, style }: ShapeProps) => (
  <svg className={className} style={style} viewBox="0 0 100 100" aria-hidden="true">
    <path d="M50 6l40 22v44L50 94 10 72V28z" fill="#2c45ff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    <path d="M50 6l40 22-40 22-40-22z" fill="#6f83ff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    <path d="M50 50v44" stroke={INK} strokeWidth="4" />
  </svg>
);
