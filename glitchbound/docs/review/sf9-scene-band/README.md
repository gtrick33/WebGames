# The yellow band in cinematics (2026-11-27)

The owner saw a wide yellow band with dark edges cross the picture now and then during a cinematic, on his iPhone.

It was touch's ring round the enemy a tap would hit (`Renderer.drawFacing`: a dashed yellow ring, a dark one under
it). It is laid on the ground where that enemy stands, beside the hero, and it was still drawn during scenes. A
scene's camera can look far from the hero; zoomed in close, a point by the hero falls near the plane the camera stands
in, where the ground's projection grows without bound, and the ring came out dozens of times its size: one dash of it,
a straight band across the screen, under the grass.

- `before.png`: a phone on its side, a rider in tap reach of the hero, a scene looking north of them, zoomed in: the
  ring drawn at 1,834 screen pixels to a tile (about 40 normally).
- `after.png`: the same scene with the fix, at the moment the camera was nearest that point (881 pixels to a tile,
  then past it): nothing.

The fix: in a scene neither the aim nor touch's arrow and ring are drawn (the aim already wasn't).
