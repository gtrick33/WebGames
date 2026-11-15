/**
 * The build, as Sigilfall's title screen shows it, small: "v660 · 76c4db7" for one that CI built and deployed (the run's
 * number only goes up, so the latest is the biggest), "dev · 76c4db7" for one built anywhere else.
 */
export function buildLabel(b: { run: string | null; sha: string } = __BUILD__): string {
  const name = b.run ? `v${b.run}` : 'dev';
  return b.sha ? `${name} · ${b.sha}` : name;
}
