/**
 * The text of a land's map file, src/games/sigilfall/data/maps/<land>.json (data/landmaps.ts): a row to a line and a
 * placed thing to a line, so a change by hand reads as a change. The freeze (scripts/sigilfall-freeze-lands.mjs) and
 * the placement editor's ground painting (vite.config.ts) both write it.
 */
export function landMapText(land: { hand?: boolean; map: readonly string[]; placed: readonly unknown[] }): string {
  const rows = land.map.map((r) => `    ${JSON.stringify(r)}`).join(',\n');
  const placed = land.placed.map((p) => `    ${JSON.stringify(p)}`).join(',\n');
  return `{\n${land.hand ? '  "hand": true,\n' : ''}  "map": [\n${rows}\n  ],\n  "placed": [\n${placed}\n  ]\n}\n`;
}
