const GESTURES = ['click', 'touchend', 'keydown'] as const;
const NON_INTERACTION_KEYS = new Set([
	'Tab',
	'Escape',
	'Shift',
	'Control',
	'Alt',
	'Meta',
	'CapsLock'
]);
const LISTENING = { capture: true, passive: true };

export function onGesturesOutside(except: Element, handle: () => void): () => void {
	const listener = (event: Event) => {
		if (isInteraction(event) && !isInside(except, event.target)) handle();
	};
	for (const type of GESTURES) addEventListener(type, listener, LISTENING);
	return () => {
		for (const type of GESTURES) removeEventListener(type, listener, LISTENING);
	};
}

function isInteraction(event: Event): boolean {
	return !(event instanceof KeyboardEvent) || isInteractionKey(event);
}

function isInteractionKey(event: KeyboardEvent): boolean {
	const shortcut = event.ctrlKey || event.metaKey || event.altKey;
	return !shortcut && !NON_INTERACTION_KEYS.has(event.key);
}

function isInside(element: Element, target: EventTarget | null): boolean {
	return target instanceof Node && element.contains(target);
}
