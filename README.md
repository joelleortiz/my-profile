# joelleortiz.me

Joelle Ortiz's personal site: a pixel-art room where Joelle types at a desk beside the cats Myles and Margot, with the intro and contact links on the sign and corkboard on the wall. SvelteKit, deployed as a Cloudflare Worker.

- `npm run dev` starts the dev server.
- `npm run art` redraws every sprite sheet and the site icons from the pixel data in `scripts/art/`, and refreshes the tables in `ART_SPEC.md`.
- `node scripts/still/capture.mjs`, with the dev server running, captures the still the page shows without JavaScript and the Open Graph image.

`CLAUDE.md` describes how the code fits together; `ART_SPEC.md` is the guide for redrawing the art.
