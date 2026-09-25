# MJ Portfolio, black-and-white pixel edition

Open `index.html` (or serve the folder with any static server). No build step.

## Files
- `index.html`, `style.css`: content and 1-bit styling
- `script.js`: loader, smooth scroll (Lenis), and every scroll scene (GSAP + ScrollTrigger)
- `game.js`: the Bounce easter egg and the sliding puzzle in the bonus stage
- `vendor/`: GSAP, ScrollTrigger, Lenis (local copies, no CDN)
- `fonts/`: Press Start 2P and VT323 (local)

## Swap in your real images
- Project screenshots: in `index.html`, each `.level-shot img` under `#work`. Drop your file in `image/` and change `src`.
  Screenshots are shown in black and white. Delete the `filter:` line in `.level-shot img` (style.css) to show colour.
- Optional background plates: `image/placeholders/bg-1.png` (behind the intro statements) and `bg-2.png` (behind the contact screen).
  Both sit at reduced opacity (`.bg-img` in style.css).

## Tuning the scroll
- `unit()` at the top of `script.js` = scroll pixels per second of scene timeline. Raise it for slower scenes.
- Each scene is a function (`buildOpening`, `buildSkills`, `buildWork`, `buildXP`, `buildFinale`) holding one timeline.

## Still to fill in (marked with TODO in the code)
- Solar System project link is `href="#"`.
- `hello@mj.dev` looks like a placeholder email.
- No `og:image` share image yet.

## Accessibility and fallbacks
- Reduced-motion visitors, and anyone without JS, get a normal stacked page (no pinning, no zooms).
- The game only captures Space and the arrow keys while a round is running and on screen.
- `image/` still holds your original icons. Only `puzzle_1516813.png` (favicon) and `skyline.svg` are used now.
