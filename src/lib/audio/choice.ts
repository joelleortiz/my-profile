const STORAGE_KEY = 'sound';

export function savedChoice(): boolean | undefined {
	switch (read()) {
		case 'on':
			return true;
		case 'off':
			return false;
		default:
			return undefined;
	}
}

export function saveChoice(on: boolean): void {
	try {
		localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
	} catch {
		// Storage is blocked, so the choice lasts until the page closes.
	}
}

function read(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}
