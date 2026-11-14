# TerraTwin — design layer (Nov 2026)

Nothing in the existing pages, data or back end was removed or rewritten. The new look is one stylesheet loaded last on every page, plus four small scripts.

## New files
| File | What it does |
|---|---|
| `css/theme-lux.css` | The whole new look: colours, fonts, glass cards, floating menu, phone layout. Colours and fonts are the variables at the top. Remove its `<link>` from a page to get the old look back. |
| `lab.html`, `css/lab.css`, `js/lab.js` | The Analog Lab page. Hardware list: `HW` at the top of `js/lab.js` (each entry has its source link). |
| `js/planet-twins.js` | Home: click anywhere on Mars or the Moon to list the most similar Earth sites (TASI, and the deep model when patches exist). |
| `js/tour-marker.js` | The "?" marker and ring that move to each part of the page during the guide. |

## Edited files
- every `*.html`: one `<link>` to `css/theme-lux.css`; the "Analog Lab" menu item; `js/tour-marker.js` after `js/tour.js`
- `index.html`: `js/planet-twins.js` after `js/planet3d.js`
- `js/planet3d.js`: four values only (softer Earth highlight, thinner atmosphere on Earth and Mars)
- `data/locales.json`: `nav.lab` in English and Arabic

## Not tested here
The deep model and the web fonts load from the internet, which the build machine could not reach. Check both on the deployed site.
