import { preloadLoop } from './assets';

interface NetworkInformation {
	saveData?: boolean;
	effectiveType?: string;
}

const SLOW_CONNECTIONS = new Set(['slow-2g', '2g']);
const IDLE_TIMEOUT_MS = 3000;
const NO_IDLE_CALLBACK_DELAY_MS = 1000;

/** Skipped with Data Saver on or on 2G. Returns a function that cancels the preload if it hasn't started. */
export function preloadLoopWhenIdle(): () => void {
	if (isConstrainedNetwork()) return () => {};
	return afterLoadWhenIdle(preloadLoop);
}

function isConstrainedNetwork(): boolean {
	const connection = (navigator as { connection?: NetworkInformation }).connection;
	return connection?.saveData === true || SLOW_CONNECTIONS.has(connection?.effectiveType ?? '');
}

function afterLoadWhenIdle(task: () => void): () => void {
	let cancelIdle = () => {};
	const onLoad = () => (cancelIdle = whenIdle(task));
	if (document.readyState === 'complete') onLoad();
	else addEventListener('load', onLoad, { once: true });
	return () => {
		removeEventListener('load', onLoad);
		cancelIdle();
	};
}

function whenIdle(task: () => void): () => void {
	if (typeof requestIdleCallback === 'function') {
		const id = requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
		return () => cancelIdleCallback(id);
	}
	const id = setTimeout(task, NO_IDLE_CALLBACK_DELAY_MS);
	return () => clearTimeout(id);
}
