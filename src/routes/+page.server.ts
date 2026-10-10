import { cvHasContent } from '#lib/cv.ts';
import type { PageServerLoad } from './$types';

// Whether the room links to the CV (the laptop's scroll sticker and the corkboard note). Read on
// the server, so the CV's text stays out of the homepage's JavaScript.
export const load: PageServerLoad = () => ({ cv: cvHasContent() });
