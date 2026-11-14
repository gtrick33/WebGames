/**
 * The Ring's nameplates on a phone (the owner: "sometimes i have to click 3-4 times on my phone in order to swap the
 * target"). A tap on a plate always took, at the press; what undid it was the left thumb coming down on the stick: the
 * ground's own tap-to-choose (ui/RingMatch.tsx `pick`) listened on the whole stage and chose whoever was drawn under the
 * thumb, most often the enemy beside you that the plate had just switched away from. Checked in a phone-sized browser
 * (Chromium, an iPhone held sideways): a thumb put down on the stick over an enemy left the target alone, a tap on an
 * enemy on open ground still chose them, and every press between two plates chose one of them.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const match = readFileSync('src/games/sigilfall/ui/RingMatch.tsx', 'utf8');

describe('The Ring: nameplates on a phone', () => {
  it('only a press on the ground itself chooses who stands there: not the stick, not the words over it', () => {
    expect(match).toContain('if (e.target !== canvas) return;');
    expect(match).toContain("host.addEventListener('pointerdown', pick, true);");
  });

  it('a press between two plates goes to the nearer, on both sides', () => {
    expect(match).toContain('<div className="rb-ring-team" onPointerDown={(e) => nearestPlate(e, left, target)}>');
    expect(match).toContain('<div className="rb-ring-team is-foes" onPointerDown={(e) => nearestPlate(e, right, target)}>');
    expect(match).toContain('const PLATE_SLACK = 8;');
  });
});
