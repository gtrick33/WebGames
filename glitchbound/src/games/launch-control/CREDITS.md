# Launch Control: third-party assets

All car models are public domain (CC0 1.0). Credit isn't required; it's given here with thanks.

| Files | Source | Author | License |
| --- | --- | --- | --- |
| `public/games/launch-control/rg/`: 50 city-car schemes (`Car_*`, `Taxi_3`, two police cars), `atlas.webp`, `windows.webp` | [Cars - Low Poly Massive Car Pack](https://rg-poly.itch.io/cars-low-poly-massive-car-pack) | RG Poly | CC0 |
| `public/games/launch-control/cosmo/`: `fenyr`, `ghini`, `italia`, `lamb`, `kamaro`, `coupe`, `mobil`, `rally`, `palette.png` | [Low Poly Cars](https://cosmo-art.itch.io/low-poly-cars) (free version) | Cosmo | CC0 |

What changed from the packs' own files:
- Only the cars the roster uses are here, as glTF with the textures loaded once by the game (RG's scaled to 512 px WebP).
- The factory rear wings (RG bodies 1, 2 and 9, Cosmo's `ghini` and `lamb`) are split into their own `Wing` node, so the aero kit can replace them; Cosmo's wheels are named by position.
- The RG tow truck's crane skeleton is removed (it's posed as modelled).

Everything else on the cars is drawn by the game: the aero kit (aero.ts), the tyre sidewalls and rims,
the paint, liveries and underglow (modelcar.ts).
