// Plain JavaScript on purpose: the head script inlines this file's raw text to lay the page out
// before first paint, so it must run untransformed and reference nothing outside itself.

/**
 * The viewport to fit, steady while a phone's address bar slides in and out: the width, the
 * small viewport height (bars shown) to fit the room in, and the large one (bars hidden) for the
 * canvas to cover, so revealing the bottom of the screen shows more floor instead of re-fitting.
 * Browsers without these units fall back to the inner size.
 */
export function viewportSize() {
	const root = document.documentElement;
	const probe = document.createElement('div');
	probe.style.cssText = 'position:fixed;top:0;left:0;width:0;visibility:hidden;height:100svh';
	root.appendChild(probe);
	const small = probe.getBoundingClientRect().height;
	probe.style.height = '100lvh';
	const large = probe.getBoundingClientRect().height;
	probe.remove();
	const h = small || innerHeight;
	return { w: innerWidth, h, full: Math.max(h, large || innerHeight) };
}

/**
 * Picks the layout and camera for a viewport. The scale is a whole number of device pixels per
 * scene pixel: the largest at which a layout's focus fits, comparing the landscape (desktop) and
 * portrait (phone) layouts, ties to landscape. If neither reaches the minimum CSS scale (text
 * would be too small), the short layout for phones held sideways is tried; failing that, the view
 * keeps the minimum scale and crops the room around the first layout's text and switchers that
 * fit. The view never runs past the world. `fullH`, when taller than `cssH`, is extra height
 * below that the canvas also covers (see viewportSize).
 */
export function fitView(cssW, cssH, dpr, g, fullH = cssH) {
	const deviceW = cssW * dpr;
	const deviceH = cssH * dpr;
	const deviceFull = Math.max(fullH, cssH) * dpr;
	const minK = Math.ceil(g.minCssScale * dpr - 1e-9);
	const fit = (r) => Math.max(1, Math.floor(Math.min(deviceW / r.w, deviceH / r.h)));
	const kl = fit(g.layouts.landscape.focus);
	const kp = fit(g.layouts.portrait.focus);
	let layout = kl >= kp ? 'landscape' : 'portrait';
	let k = Math.max(kl, kp);
	let cropped = false;
	if (k < minK) {
		const ks = fit(g.layouts.short.focus);
		if (ks >= minK) {
			layout = 'short';
			k = ks;
		} else {
			cropped = true;
			k = minK;
			const fits = (id) => {
				const e = g.layouts[id].essentials;
				return e.w <= deviceW / k && e.h <= deviceH / k;
			};
			layout = ['landscape', 'short', 'portrait'].find(fits) ?? 'portrait';
		}
	}
	k = Math.max(k, Math.ceil(deviceW / g.world.w), Math.ceil(deviceFull / g.world.h));
	const w = Math.ceil(deviceW / k);
	const seen = Math.ceil(deviceH / k);
	const h = Math.ceil(deviceFull / k);
	const L = g.layouts[layout];
	const f = cropped ? L.essentials : L.focus;
	// On phones most spare height goes below the desk, so the top shows the ceiling, not bare wall.
	const top =
		layout === 'portrait' && !cropped ? f.y - (seen - f.h) * g.topShare : f.y + f.h / 2 - seen / 2;
	const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
	return {
		layout,
		cropped,
		devicePxPerScenePx: k,
		cssPxPerScenePx: k / dpr,
		w,
		h,
		camX: Math.round(clamp(f.x + f.w / 2 - w / 2, 0, g.world.w - w)),
		camY: Math.round(clamp(top, 0, g.world.h - h))
	};
}

export function applyView(view, root) {
	root.dataset.layout = view.layout;
	root.style.setProperty('--s', String(view.cssPxPerScenePx));
	root.style.setProperty('--cam-x', String(view.camX));
	root.style.setProperty('--cam-y', String(view.camY));
}
