# TerraTwin — cinematic home page

## Try it alone
Drag the whole folder onto app.netlify.com → Deploy manually. Or run `python -m http.server` here and open http://localhost:8000

## Put it in the Astraea repo
1. Copy `css/home-cinema.css`, `js/home-cinema.js`, `js/data-fallback.js` and the folder `assets/home-cinema/` into the repo (no existing file is overwritten).
2. Replace the repo's `index.html` with this `index.html` (keep a copy of the old one).
3. Open `js/home-cinema.js` and check the page names in `LINKS` at the top (finder, compare, lab, evidence, guide, login, register).

## Data
- The page reads the team's own files: `data/terratwin-real.js` (sites) and `data/validation.json` (Results numbers).
- If those files are missing, it uses `js/data-fallback.js` (a copy of today's data).
- Similarity is computed live in the page with the TASI formula (equal weights, Moon skips thermal, NDVI gate already applied).

## What moves
- Start screen: loading counter, then a camera warp through the stars.
- Hero: letter-by-letter headline, live Earth with day/night lights and clouds.
- Explore: switch Earth / Mars / Moon (shock-ring transition); click any glowing pin.
- Twin pair: the two planets turn to face you, a light stream flows from the target to its Earth twin, names decode, score ring fills, criteria dots slide.
- Results: numbers count up while the three worlds line up.
- Guided tour (?): the guide card flies to each element it explains.

Textures: NASA Blue Marble / city lights from the three.js examples; Mars and Moon from threex.planets.
