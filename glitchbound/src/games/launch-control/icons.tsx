/** Launch Control's icon set: one stroke style (24 px grid, round caps), drawn here so no emoji or icon font is needed. */
import type { PartId, Material } from './parts';

const PATHS = {
  flag: 'M5 21V4m0 0h11l-1.6 4L16 12H5m3-8v8m4-8v8',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm0 3h16M8 3v4m8-4v4m-8 7h2m3 0h2m-7 4h2m3 0h2',
  wrench: 'M14.5 6.5a4 4 0 0 0 5 5L21 13l-1.5 1.5a6 6 0 0 1-7.4.9L6 21.5a2.1 2.1 0 0 1-3-3l6.1-6.1a6 6 0 0 1 .9-7.4L11.5 3.5l1.5 1.5a4 4 0 0 0 1.5 1.5z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  car: 'M3 15.5v-3l2-4.5a2 2 0 0 1 1.8-1.2h10.4A2 2 0 0 1 19 8l2 4.5v3a1.5 1.5 0 0 1-1.5 1.5H18m-12 0H4.5A1.5 1.5 0 0 1 3 15.5M3 12.5h18M8 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 17h8',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5zm2 11h14',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zm0 1H4v2a3 3 0 0 0 4 3m8-5h4v2a3 3 0 0 1-4 3m-4 3v4m-4 3h8m-6-3h4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-6 10v-1a6 6 0 0 1 12 0v1m1-10a3.5 3.5 0 1 0-1-6.8M21 21v-1a5 5 0 0 0-4-4.9',
  sound: 'M4 9.5v5h3.5L12 19V5L7.5 9.5zm11.5-1a5 5 0 0 1 0 7m2.5-10a9 9 0 0 1 0 13',
  mute: 'M4 9.5v5h3.5L12 19V5L7.5 9.5zM16 9.5l5 5m0-5-5 5',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-2.6-12a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 4m0 3v.01',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  lock: 'M6 11h12v10H6zm2 0V8a4 4 0 0 1 8 0v3m-4 4v2',
  check: 'M5 12.5l4.5 4.5L19 7',
  play: 'M7 4.5v15l12-7.5z',
  gift: 'M4 11h16v10H4zm-1-4h18v4H3zm9 0v14M12 7S10.5 3 8 3a2 2 0 0 0 0 4m4 0s1.5-4 4-4a2 2 0 0 1 0 4',
  share: 'M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  warn: 'M12 3l10 18H2zm0 7v4m0 3v.01',
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-8V10m-2-8h4m5.5 4.5L18 8',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  // parts
  engine: 'M7 8h4V6h3v2h3l2 3h2v5h-2l-2 3h-6l-2-2H7zm0 4H3m0-3v6',
  transmission: 'M6 4v16m6-16v16m6-16v8H6m6 0',
  suspension: 'M12 2v3m0 14v3M8 5h8M8 19h8M9 7.5l6 2-6 2 6 2-6 2 6 2',
  tyres: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-13v5m0 8v5M3 12h5m8 0h5',
  aero: 'M3 17h18M5 17l2-6h12l-2 6m-6-6V7h8',
  looks: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  // materials
  scrap: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  alloy: 'M3 17l3-8h12l3 8zm4.5-8L9 5h6l1.5 4',
  carbon: 'M4 4h16v16H4zm0 8h16M12 4v16M4 4l16 16M20 4 4 20',
  chips: 'M7 7h10v10H7zm3 3h4v4h-4zM9 3v4m6-4v4M9 17v4m6-4v4M3 9h4m-4 6h4m10-6h4m-4 6h4',
  rubber: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`lc-ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

export const PART_ICON: Record<PartId, IconName> = { engine: 'engine', transmission: 'transmission', suspension: 'suspension', tyres: 'tyres', aero: 'aero', looks: 'looks' };
export const MAT_ICON: Record<Material, IconName> = { scrap: 'scrap', alloy: 'alloy', carbon: 'carbon', chips: 'chips', rubber: 'rubber' };
