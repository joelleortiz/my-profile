import { existsSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	define: {
		// Whether scripts/cv/pdf.mjs has written the CV's PDF, so /cv offers it. Read when Vite
		// starts: restart the dev server after writing the PDF.
		__CV_PDF__: JSON.stringify(existsSync('static/cv/joelle-ortiz-cv.pdf'))
	},
	build: {
		// Sprite sheets stay separate files: inlining them as base64 would bloat the JS bundle.
		assetsInlineLimit: (file) => (file.includes('/scene/art/') ? false : undefined)
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	]
});
