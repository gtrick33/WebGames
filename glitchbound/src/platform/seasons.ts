/**
 * Holiday looks: small touches for the big holidays (a greeting, a logo sticker, a few floating
 * decorations and a highlight color). Admins choose one in the Games tab, or leave it on automatic,
 * which follows the calendar below. Pure: shared by the browser, the server and the tests.
 */

export type HolidayId = 'halloween' | 'winter' | 'valentine' | 'lunar' | 'easter' | 'diwali' | 'summer';
/** What admins choose: follow the calendar, nothing, or one look. */
export type SeasonSetting = 'auto' | 'off' | HolidayId;

export interface Holiday {
  id: HolidayId;
  emoji: string;
  name: string;
  greeting: string;
  /** Floating decorations (a few of these drift across lobby pages). */
  decor: string[];
  /** Two highlight colors. */
  colors: [string, string];
}

export const HOLIDAYS: Holiday[] = [
  { id: 'halloween', emoji: '🎃', name: 'Halloween', greeting: 'Happy Halloween! Spooky tunes are on in Quizbelief', decor: ['🦇', '👻', '🎃', '🕸️', '🍬'], colors: ['#ff7a1a', '#9d4edd'] },
  { id: 'winter', emoji: '❄️', name: 'Winter holidays', greeting: 'Happy holidays! Cozy up with a puzzle or three.', decor: ['❄️', '❄️', '⛄', '✨', '🎁'], colors: ['#7fd7ff', '#ff4d5e'] },
  { id: 'valentine', emoji: '💘', name: 'Valentine’s Day', greeting: 'Happy Valentine’s! Challenge your favorite person.', decor: ['💖', '💘', '💌', '🌹'], colors: ['#ff4f9a', '#ff8fb8'] },
  { id: 'lunar', emoji: '🧧', name: 'Lunar New Year', greeting: 'Happy Lunar New Year! Wishing you luck and high scores.', decor: ['🧧', '🏮', '🐉', '✨'], colors: ['#e63946', '#ffc928'] },
  { id: 'easter', emoji: '🐣', name: 'Easter', greeting: 'Happy Easter! There’s a ball hidden in every photo, too.', decor: ['🐣', '🥚', '🌷', '🐰'], colors: ['#b8a1ff', '#9be15d'] },
  { id: 'diwali', emoji: '🪔', name: 'Diwali', greeting: 'Happy Diwali! May your days be bright and your streaks long.', decor: ['🪔', '✨', '🎆'], colors: ['#ffb703', '#ff4fc8'] },
  { id: 'summer', emoji: '☀️', name: 'Summer', greeting: 'Summer’s here. Play in the shade.', decor: ['☀️', '🌴', '🍉', '🏖️'], colors: ['#ffd23f', '#12c6b3'] },
];

export const isSeasonSetting = (v: unknown): v is SeasonSetting => v === 'auto' || v === 'off' || HOLIDAYS.some((h) => h.id === v);

/** Western Easter Sunday for a year (Anonymous Gregorian algorithm), as YYYY-MM-DD. */
export function easterDay(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Dates that move every year (lunar calendars). Extend these lists as the years go by. */
const LUNAR_NEW_YEAR: Record<number, string> = { 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03', 2031: '2031-01-23' };
const DIWALI: Record<number, string> = { 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17', 2029: '2029-11-05', 2030: '2030-10-26' };

const shift = (day: string, n: number): string => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const within = (day: string, from: string, to: string): boolean => day >= from && day <= to;

/** The holiday the calendar suggests for a day (automatic mode), or null. Summer is never automatic. */
export function autoHoliday(day: string): HolidayId | null {
  const year = Number(day.slice(0, 4));
  const md = day.slice(5);
  if (md >= '10-15' && md <= '11-01') return 'halloween';
  const diwali = DIWALI[year];
  if (diwali && within(day, shift(diwali, -2), shift(diwali, 2))) return 'diwali';
  if (md >= '12-01' || md <= '01-06') return 'winter';
  const lunar = LUNAR_NEW_YEAR[year];
  if (lunar && within(day, shift(lunar, -3), shift(lunar, 7))) return 'lunar';
  if (md >= '02-07' && md <= '02-14') return 'valentine';
  const easter = easterDay(year);
  if (within(day, shift(easter, -6), shift(easter, 1))) return 'easter';
  return null;
}

/** The look to show on a day for an admin setting (missing = automatic). */
export function activeHoliday(setting: SeasonSetting | undefined, day: string): Holiday | null {
  const id = setting === 'off' ? null : !setting || setting === 'auto' ? autoHoliday(day) : setting;
  return HOLIDAYS.find((h) => h.id === id) ?? null;
}
