import { GEOMETRY } from '../scene/layout.ts';
import { applyView, fitView, viewportSize, type View } from '../scene/viewport.ts';

function measure(): View {
	const { w, h, full } = viewportSize();
	return fitView(w, h, devicePixelRatio || 1, GEOMETRY, full);
}

const same = (a: View | null, b: View) =>
	!!a && (Object.keys(b) as (keyof View)[]).every((k) => a[k] === b[k]);

class ViewState {
	current = $state<View | null>(null);

	start(): () => void {
		// A phone's address bar showing or hiding fires resize too; the view stays the same then.
		const update = () => {
			const next = measure();
			if (same(this.current, next)) return;
			applyView(next, document.documentElement);
			this.current = next;
		};
		update();
		addEventListener('resize', update);
		return () => removeEventListener('resize', update);
	}
}

export const view = new ViewState();
